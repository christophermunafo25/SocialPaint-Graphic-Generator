// One run of the Generate chat, start to finish (PROMPT.md §9.2, §9.3): the
// generate call, then the measurement pass over each proposal in order,
// each draft landing in its slot as it resolves and each dropped proposal
// leaving its warning. This is the one-shot page's run pipeline, moved:
// designToSchema and measureProposal for a freestyle design, the stored
// template and one repair round for a library fill.
//
// Pure apart from what is injected (the store calls, the measurer, the
// clock, ids and the render yield), so the ordering the chat's race guards
// rely on is pinned by chatRun.test.ts. useChatController owns the run's
// refs (which run is current, its AbortController) and injects the stores.
//
// The run never mutates anything itself. It dispatches ChatActions, and it
// checks `alive()` after every await: once the run has been stopped, reset
// or superseded it dispatches nothing more, not even the warning a repair
// that the abort cut short would leave. The reducer ignores a finished
// run's actions as well, so a late result cannot touch a finished turn by
// either route.

import type {
  BrandKit,
  FieldValues,
  GenerateInput,
  GenerateMeta,
  GenerateRepairInput,
  GenerateResult,
  GeneratedProposal,
  TemplateSchema,
} from "../types";
import type { LineMeasurer } from "../render/autoFit";
import { applyVariantToSchema, defaultVariant } from "../templates/variants";
import { chatLayoutOptions } from "./draftView";
import type { ChatDraft, ChatTurn, UserTurn } from "./chat";
import {
  buildGenerateInput,
  latestDoneTurn,
  mergeKeys,
  repairBriefFor,
  type ChatAction,
} from "./chatReducer";
import { designToSchema } from "./designToSchema";
import { measureProposal } from "./measureProposal";
import { repairProposal } from "./repairProposal";
import {
  GENERATE_FAILED,
  fillingInStatus,
  overflowingDesignWarning,
  unavailableWarning,
  unfittableDraftWarning,
  type ProposalShape,
  type RunMode,
} from "./runCopy";

/** What a run calls out to. In the app: the GenerateProvider and the
 * template store through `stores`, the canvas measurer, crypto ids and a
 * timer; under vitest, fakes. */
export interface ChatRunEffects {
  generate(companyId: string, input: GenerateInput, signal: AbortSignal): Promise<GenerateResult>;
  /** A published template by id; null when it is gone. */
  getTemplate(templateId: string): Promise<TemplateSchema | null>;
  /** One repair round's rewrites, keyed by fieldKey. */
  repair(companyId: string, input: GenerateRepairInput, signal: AbortSignal): Promise<FieldValues>;
  /** A fresh measurer for the run's measurement pass. */
  measurer(): LineMeasurer;
  newId(): string;
  now(): string;
  /** Lets the page commit what was just dispatched before the loop goes
   * on, so each draft replaces its skeleton as it lands. */
  yieldToRender(): Promise<void>;
}

export interface ChatRun {
  /** The run's id, which is its assistant turn's id. */
  runId: string;
  companyId: string;
  /** The thread before the message. */
  prior: readonly ChatTurn[];
  /** The message, as the reducer appended it. */
  user: UserTurn;
  mode: RunMode;
  kit: BrandKit | null;
  /** The company's published templates, when known. Only their canvas
   * sizes are read, so step 2 can say how many sizes it is rendering
   * before each template is fetched. */
  published?: ReadonlyArray<Pick<TemplateSchema, "id" | "canvasWidth" | "canvasHeight">> | null;
  /** A template chat (Template chat PROMPT §12): one pinned template, its
   * details and its one question go on the wire; a draft that still
   * overflows after repair is kept and flagged rather than dropped; the
   * member's own values are carried forward and never repaired; each draft
   * takes a look. */
  templateChat?: boolean;
  /** Aborts the generate and repair requests (Stop). */
  signal: AbortSignal;
  /** False once the run is no longer the one the chat wants (stopped,
   * reset, superseded, or its page gone). */
  alive(): boolean;
  dispatch(action: ChatAction): void;
}

/** Runs one message's turn: step 1 while the model is asked, step 2 as
 * the proposals are measured, step 3 while a repair round is in flight and
 * in any case before the last proposal is resolved, then done, or failed
 * with the server's sentence. */
export async function runChat(run: ChatRun, fx: ChatRunEffects): Promise<void> {
  const { runId, companyId, prior, user, mode, kit, published, signal, alive, dispatch } = run;
  const templateChat = run.templateChat === true;
  try {
    const res = await fx.generate(
      companyId,
      buildGenerateInput(prior, user, mode, templateChat),
      signal,
    );
    if (!alive()) return;
    if (res.title) dispatch({ type: "titleSet", title: res.title, runId, at: fx.now() });

    // The one question (§12.6): a finished turn with no drafts, never
    // "nothing fit". Only a template chat's first message can get one.
    if (res.question?.trim() && res.proposals.length === 0) {
      dispatch({ type: "questionArrived", runId, question: res.question, at: fx.now() });
      return;
    }

    const shapes: ProposalShape[] = res.proposals.map((p) => ({
      templateName: p.templateName,
      canvas: p.design
        ? { width: p.design.canvasWidth, height: p.design.canvasHeight }
        : canvasOf(published, p.templateId),
    }));
    dispatch({
      type: "proposalsArrived",
      runId,
      proposals: shapes,
      meta: {
        model: res.meta.model,
        candidateCount: res.meta.candidateCount,
        mode: res.meta.mode === "freestyle" ? "freestyle" : mode,
      },
      warnings: res.warnings ?? [],
      ...(templateChat && shapes[0] ? { status: fillingInStatus(shapes[0].templateName) } : {}),
    });

    // What this message continues from, in a template chat: the latest
    // finished draft (its look and the values the member typed) and the
    // detail tags sent now.
    const previous = templateChat ? (latestDoneTurn(prior)?.drafts[0] ?? null) : null;
    const typedNow = (user.details ?? []).map((d) => d.fieldKey);
    // A field the member skipped in the template chat's questions stays
    // empty, whatever the model wrote into it.
    const skipped = new Set(user.interview?.skipped ?? []);
    const withoutSkipped = (p: GeneratedProposal): GeneratedProposal =>
      skipped.size === 0
        ? p
        : {
            ...p,
            values: Object.fromEntries(Object.entries(p.values).filter(([k]) => !skipped.has(k))),
          };

    // The measurement pass: the function checked character counts; only a
    // browser can check glyphs. One proposal at a time, in order.
    const measure = fx.measurer();
    const repairBrief = repairBriefFor(prior, user);
    for (const [i, proposal] of res.proposals.entries()) {
      await fx.yieldToRender();
      if (!alive()) return;
      // The bar reaches step 3 before the turn completes, whether or not a
      // repair round runs.
      if (i === res.proposals.length - 1) dispatch({ type: "checking", runId });
      const outcome = await resolveProposal(withoutSkipped(proposal), i, {
        companyId,
        kit,
        measure,
        meta: res.meta,
        repairBrief,
        signal,
        fx,
        onRepair: () => dispatch({ type: "checking", runId }),
        template: templateChat ? { previous, typedNow } : null,
      });
      if (!alive()) return;
      dispatch(
        "draft" in outcome
          ? { type: "draftResolved", runId, draft: outcome.draft }
          : { type: "draftDropped", runId, warning: outcome.warning },
      );
    }
    await fx.yieldToRender();
    if (!alive()) return;
    dispatch({ type: "done", runId, reply: res.reply, at: fx.now() });
  } catch (e) {
    // A stopped run's abort lands here too; its turn is already settled.
    if (!alive()) return;
    dispatch({
      type: "failed",
      runId,
      message: e instanceof Error ? e.message : GENERATE_FAILED,
      at: fx.now(),
    });
  }
}

/** A library proposal's canvas size from the published list, when the page
 * passed one and the template is on it. */
function canvasOf(
  published: ChatRun["published"],
  templateId: string,
): { width: number; height: number } | null {
  const t = published?.find((p) => p.id === templateId);
  return t ? { width: t.canvasWidth, height: t.canvasHeight } : null;
}

function toDraft(
  id: string,
  proposal: GeneratedProposal,
  schema: TemplateSchema,
  values: FieldValues,
  extra: Pick<ChatDraft, "variantId" | "memberKeys"> = {},
): ChatDraft {
  return {
    id,
    proposal,
    schema,
    canvas: { width: schema.canvasWidth, height: schema.canvasHeight },
    values,
    ...(extra.variantId ? { variantId: extra.variantId } : {}),
    ...(extra.memberKeys?.length ? { memberKeys: extra.memberKeys } : {}),
  };
}

/** One proposal, resolved as the page this chat replaces resolved it: a
 * draft to show, or the warning a dropped proposal leaves. */
async function resolveProposal(
  proposal: GeneratedProposal,
  index: number,
  ctx: {
    companyId: string;
    kit: BrandKit | null;
    measure: LineMeasurer;
    meta: GenerateMeta;
    /** The brief the repair round rewrites against (repairBriefFor). */
    repairBrief: string;
    signal: AbortSignal;
    fx: ChatRunEffects;
    /** A repair round is about to run: step 3. */
    onRepair: () => void;
    /** A template chat's continuity: the draft this one follows, and the
     * detail keys sent with this message. Null in a Generate chat. */
    template: { previous: ChatDraft | null; typedNow: string[] } | null;
  },
): Promise<{ draft: ChatDraft } | { warning: string }> {
  const { fx } = ctx;
  if (proposal.design) {
    // Freestyle designs have no stored template to repair against: the
    // server forces shrink sizing on all their text, so measure and drop
    // honestly. The ordinal and provenance are the ones the old page
    // stamped, so a design saved to the library answers which model made
    // it and when.
    const schema = designToSchema(proposal.design, ctx.companyId, index + 1, {
      model: ctx.meta.model,
      generatedAt: ctx.meta.generatedAt,
    });
    const fit = measureProposal(schema, proposal.values, ctx.kit, ctx.measure);
    if (!fit.ok) return { warning: overflowingDesignWarning(proposal.templateName) };
    return { draft: toDraft(fx.newId(), proposal, schema, proposal.values) };
  }
  const schema = await fx.getTemplate(proposal.templateId);
  if (!schema) return { warning: unavailableWarning(proposal.templateName) };

  // A template chat's draft keeps the previous draft's look (a new chat
  // takes the template's default), carries forward what the member typed
  // when the new proposal leaves it empty, and never sends it to repair.
  const tpl = ctx.template;
  const prev =
    tpl?.previous && tpl.previous.proposal.templateId === schema.id ? tpl.previous : null;
  const variantId = tpl
    ? ((prev?.variantId && schema.variants?.some((v) => v.id === prev.variantId)
        ? prev.variantId
        : undefined) ?? defaultVariant(schema)?.id)
    : undefined;
  const memberKeys = tpl ? mergeKeys(prev?.memberKeys, tpl.typedNow) : undefined;
  let values = proposal.values;
  if (prev?.memberKeys?.length) {
    const carried: FieldValues = { ...values };
    for (const key of prev.memberKeys) {
      if (!carried[key] && prev.values[key]) carried[key] = prev.values[key];
    }
    values = carried;
  }

  // Measured as the card paints it: the look applied, empty fields as the
  // chat shows them. Overflowing values get one repair round; in a Generate
  // chat a proposal that still overflows is dropped, never shown, while a
  // template chat keeps it and flags the fields too long (§9.6).
  const outcome = await repairProposal(
    { templateId: proposal.templateId, values },
    applyVariantToSchema(schema, variantId),
    ctx.kit,
    ctx.measure,
    (templateId, fields) => {
      ctx.onRepair();
      return fx.repair(ctx.companyId, { templateId, brief: ctx.repairBrief, fields }, ctx.signal);
    },
    {
      layout: chatLayoutOptions(schema, variantId),
      protectedKeys: new Set(memberKeys ?? []),
    },
  );
  if (!outcome.ok && !tpl) return { warning: unfittableDraftWarning(proposal.templateName) };
  return {
    draft: toDraft(fx.newId(), proposal, schema, outcome.values, { variantId, memberKeys }),
  };
}
