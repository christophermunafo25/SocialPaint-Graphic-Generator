import React, { useState } from "react";
import { ArrowRight, Image as ImageIcon, LayoutGrid, Sparkles } from "lucide-react";
import type { FieldValues, GeneratedProposal, TemplateSchema } from "@/lib/types";
import { PLATFORMS, type PlatformId } from "@/lib/templates/platforms";
import { stores } from "@/lib/stores";
import { useAsync } from "@/lib/useAsync";
import { useAuth } from "@/lib/auth/AuthContext";
import { useBrand } from "@/lib/brand/BrandContext";
import { mergeCaption } from "@/lib/caption";
import { createCanvasMeasurer } from "@/lib/render/autoFit";
import { repairProposal } from "@/lib/generate/repairProposal";
import { stashSeed } from "@/lib/generate/seedHandoff";
import { useRouter } from "../../router";
import { Page, PageHeader } from "../layout/Page";
import { TemplateThumbnail } from "../TemplateThumbnail";

/** One proposal, ready to show: the model's output, the template it fills,
 * and the values after the measurement pass (repaired where needed). */
interface ResultCard {
  proposal: GeneratedProposal;
  schema: TemplateSchema;
  values: FieldValues;
}

interface Results {
  cards: ResultCard[];
  warnings: string[];
  model: string;
  candidateCount: number;
}

/** Generate: a member describes what they want to post; the system picks
 * templates from the company's own published library, writes the copy into
 * fields an admin exposed, and hands back editable pre-filled graphics. The
 * model never draws anything — choosing a card lands on the ordinary fill
 * page with the values seeded, where the usual open/download instrumentation
 * applies. */
export function GeneratePage({ templateIdHint }: { templateIdHint?: string }) {
  const { company, role } = useAuth();
  const { kit } = useBrand();
  const { navigate } = useRouter();

  const [brief, setBrief] = useState("");
  const [platform, setPlatform] = useState<PlatformId | null>(null);
  const [phase, setPhase] = useState<"idle" | "asking" | "measuring">("idle");
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Results | null>(null);

  const publishedState = useAsync(
    () => (company ? stores.templates.listPublished(company.id) : Promise.resolve([])),
    [company],
  );
  const published = publishedState.status === "ready" ? publishedState.data : null;
  // A stale hint (unpublished since the member left that card) degrades to a
  // library-wide generate rather than a server error.
  const hinted = templateIdHint ? published?.find((t) => t.id === templateIdHint) : undefined;

  const busy = phase !== "idle";

  const run = async () => {
    if (!company || !brief.trim() || busy) return;
    setError(null);
    setResults(null);
    setPhase("asking");
    try {
      const trimmedBrief = brief.trim();
      const res = await stores.generate.generate(company.id, {
        brief: trimmedBrief,
        platformHint: hinted ? undefined : (platform ?? undefined),
        templateIdHint: hinted?.id,
        count: 3,
      });

      // The measurement pass: the function checked character counts; only a
      // browser can check glyphs. Overflowing values get one repair round;
      // a proposal that still overflows is dropped, never shown.
      setPhase("measuring");
      const measure = createCanvasMeasurer();
      const warnings = [...res.warnings];
      const cards: ResultCard[] = [];
      for (const proposal of res.proposals) {
        const schema = await stores.templates.get(proposal.templateId);
        if (!schema) {
          warnings.push(`"${proposal.templateName}" is no longer available — skipped.`);
          continue;
        }
        const outcome = await repairProposal(
          { templateId: proposal.templateId, values: proposal.values },
          schema,
          kit,
          measure,
          (templateId, fields) =>
            stores.generate
              .repair(company.id, { templateId, brief: trimmedBrief, fields })
              .then((r) => r.values),
        );
        if (!outcome.ok) {
          warnings.push(
            `Dropped a "${proposal.templateName}" draft — its copy couldn't be made to fit the design.`,
          );
          continue;
        }
        cards.push({ proposal, schema, values: outcome.values });
      }

      if (cards.length === 0) {
        setError(
          "None of the drafts fit their templates. Try a shorter brief — or fill a template directly; the library is unaffected.",
        );
      } else {
        setResults({
          cards,
          warnings,
          model: res.meta.model,
          candidateCount: res.meta.candidateCount,
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generate failed — try again.");
    } finally {
      setPhase("idle");
    }
  };

  const choose = (card: ResultCard) => {
    stashSeed(card.schema.id, card.values);
    navigate({ name: "template", templateId: card.schema.id });
  };

  const header = (
    <PageHeader
      eyebrow={company?.name}
      title="Generate"
      description="Describe the post. The graphic comes from your own template library, so it's on brand before you touch it."
    />
  );

  // The dev backend has no Edge Functions and no model key: an honest
  // disabled state, following the designImport precedent.
  if (!stores.generate.isConfigured()) {
    return (
      <Page narrow={900}>
        {header}
        <div className="sp-emptystate">
          <p className="sp-emptystate__title">Generate isn't available on this backend</p>
          <p className="sp-emptystate__body">
            It needs the Supabase backend and an Anthropic API key (see .env.example). The template
            library and manual fill work as usual.
          </p>
        </div>
      </Page>
    );
  }

  if (published && published.length === 0) {
    return (
      <Page narrow={900}>
        {header}
        <div className="sp-emptystate">
          <p className="sp-emptystate__title">Nothing to generate from yet</p>
          <p className="sp-emptystate__body">
            Generate fills templates your design team has published — that's what keeps every result
            on brand. There are no published templates yet.
          </p>
          {role === "admin" && (
            <div className="sp-emptystate__actions">
              <button
                type="button"
                className="sp-btn sp-btn-primary"
                onClick={() => navigate({ name: "adminTemplates" })}
              >
                Open the Template Builder
              </button>
            </div>
          )}
        </div>
      </Page>
    );
  }

  return (
    <Page narrow={900}>
      {header}

      <div className="flex flex-col" style={{ gap: "var(--space-sm)" }}>
        <textarea
          className="sp-input"
          rows={4}
          value={brief}
          maxLength={1500}
          onChange={(e) => setBrief(e.target.value)}
          placeholder="We're hiring a senior nurse practitioner for the Evanston clinic, posting on LinkedIn this week."
          aria-label="Describe the post"
          disabled={busy}
          style={{ resize: "vertical" }}
        />

        {hinted ? (
          <p style={{ fontSize: "var(--type-caption-size)", color: "var(--text-muted)" }}>
            Using the template you picked: {hinted.name}.{" "}
            <button
              type="button"
              onClick={() => navigate({ name: "generate" }, { replace: true })}
              style={{ textDecoration: "underline", color: "var(--text-secondary)" }}
            >
              Choose from the whole library instead
            </button>
          </p>
        ) : (
          <div className="sp-chipbar" style={{ flexWrap: "wrap" }} aria-label="Platform">
            <button
              type="button"
              className="sp-chip"
              data-selected={platform === null || undefined}
              aria-pressed={platform === null}
              onClick={() => setPlatform(null)}
              disabled={busy}
            >
              <LayoutGrid className="sp-chip__icon" strokeWidth={1.5} aria-hidden />
              <span className="sp-chip__label">Any platform</span>
            </button>
            {PLATFORMS.map((p) => (
              <button
                key={p.id}
                type="button"
                className="sp-chip"
                data-selected={platform === p.id || undefined}
                aria-pressed={platform === p.id}
                onClick={() => setPlatform(platform === p.id ? null : p.id)}
                disabled={busy}
              >
                <p.Icon className="sp-chip__icon" strokeWidth={1.5} aria-hidden />
                <span className="sp-chip__label">{p.label}</span>
              </button>
            ))}
          </div>
        )}

        <div>
          <button
            type="button"
            className="sp-btn sp-btn-primary"
            disabled={!brief.trim() || busy}
            onClick={() => void run()}
          >
            <Sparkles style={{ width: 14, height: 14 }} />
            Generate
          </button>
        </div>
      </div>

      {error && (
        <p
          role="alert"
          style={{
            marginTop: "var(--space-sm)",
            fontSize: "var(--type-label-size)",
            color: "var(--state-danger-on-surface)",
          }}
        >
          {error}
        </p>
      )}

      {busy && (
        <div aria-busy="true" style={{ marginTop: "var(--space-lg)" }}>
          <p
            role="status"
            style={{ fontSize: "var(--type-label-size)", color: "var(--text-muted)" }}
          >
            {phase === "asking"
              ? "Reading your brief and choosing templates from your library…"
              : "Checking every line of copy fits its design…"}
          </p>
          <div className="sp-grid-media" style={{ marginTop: "var(--space-sm)" }}>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="sp-skeleton__block"
                aria-hidden
                style={{ aspectRatio: "1 / 1", borderRadius: "var(--radius-card)" }}
              />
            ))}
          </div>
        </div>
      )}

      {results && !busy && (
        <div style={{ marginTop: "var(--space-lg)" }}>
          {results.warnings.length > 0 && (
            <div style={{ marginBottom: "var(--space-sm)" }}>
              {results.warnings.map((w) => (
                <p
                  key={w}
                  style={{ fontSize: "var(--type-caption-size)", color: "var(--text-muted)" }}
                >
                  {w}
                </p>
              ))}
            </div>
          )}
          <div className="sp-grid-media">
            {results.cards.map((card, i) => (
              <ProposalCard key={`${card.schema.id}-${i}`} card={card} onChoose={choose} />
            ))}
          </div>
          {/* Provenance, in the open: which model, from which library. */}
          <p
            style={{
              marginTop: "var(--space-sm)",
              fontSize: "var(--type-caption-size)",
              color: "var(--text-muted)",
            }}
          >
            Drafted by {results.model} from{" "}
            {results.candidateCount === 1
              ? "the template you picked"
              : `${results.candidateCount} published templates`}
            . Everything stays editable before you export.
          </p>
        </div>
      )}
    </Page>
  );
}

function ProposalCard({ card, onChoose }: { card: ResultCard; onChoose(card: ResultCard): void }) {
  const { proposal, schema, values } = card;
  const caption = proposal.caption || mergeCaption(schema, values);
  return (
    <div
      className="sp-card"
      style={{
        padding: "var(--space-xs)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-2xs)",
      }}
    >
      <div
        style={{
          aspectRatio: `${schema.canvasWidth} / ${schema.canvasHeight}`,
          overflow: "hidden",
          borderRadius: "var(--radius-control)",
          border: "1px solid var(--border)",
        }}
      >
        <TemplateThumbnail template={schema} values={values} />
      </div>
      <p
        style={{
          fontSize: "var(--type-label-size)",
          fontWeight: 500,
          color: "var(--text-primary)",
        }}
      >
        {schema.name}
      </p>
      {proposal.why && (
        <p style={{ fontSize: "var(--type-caption-size)", color: "var(--text-muted)" }}>
          {proposal.why}
        </p>
      )}
      {caption && (
        <p style={{ fontSize: "var(--type-caption-size)", color: "var(--text-secondary)" }}>
          Caption: {caption}
        </p>
      )}
      {proposal.imageFieldsNeeded.length > 0 && (
        <p
          className="flex items-center gap-1.5"
          style={{ fontSize: "var(--type-caption-size)", color: "var(--text-muted)" }}
        >
          <ImageIcon style={{ width: 13, height: 13, flexShrink: 0 }} aria-hidden />
          You'll add: {proposal.imageFieldsNeeded.map((f) => f.label).join(", ")}
        </p>
      )}
      <button
        type="button"
        className="sp-btn sp-btn-primary"
        style={{ marginTop: "auto", alignSelf: "start" }}
        onClick={() => onChoose(card)}
      >
        Edit and export
        <ArrowRight style={{ width: 14, height: 14 }} />
      </button>
    </div>
  );
}
