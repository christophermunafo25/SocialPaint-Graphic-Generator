import React, { useState } from "react";
import { ArrowRight, ArrowUp, Globe, Image as ImageIcon } from "lucide-react";
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
import { Page } from "../layout/Page";
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

/** Example briefs behind the starter pills — full sentences in the product's
 * voice, so clicking one shows what a good brief looks like rather than
 * leaving a two-word stub to finish. */
const STARTERS: Array<{ label: string; brief: string }> = [
  {
    label: "Hiring",
    brief:
      "We're hiring a senior nurse practitioner for the Evanston clinic, posting on LinkedIn this week.",
  },
  {
    label: "Anniversary",
    brief: "Maria in billing hits ten years with us on Friday — we want to celebrate her.",
  },
  {
    label: "Event",
    brief: "Open house at the Lakeview location next Saturday from 10 to 2, everyone welcome.",
  },
  {
    label: "New hire",
    brief: "Welcoming James Cole, our new physical therapist, who starts Monday.",
  },
  {
    label: "Milestone",
    brief: "We just served our five thousandth patient this quarter.",
  },
  {
    label: "Spotlight",
    brief: "A spotlight on Dana at the front desk — patients keep naming her in reviews.",
  },
];

/** Generate: a member describes what they want to post; the system picks
 * templates from the company's own published library, writes the copy into
 * fields an admin exposed, and hands back editable pre-filled graphics. The
 * model never draws anything — choosing a card lands on the ordinary fill
 * page with the values seeded, where the usual open/download instrumentation
 * applies.
 *
 * Composition: a centred hero (headline, one line under it), one big prompt
 * card that IS the interface — borderless textarea, a compact platform
 * picker, a round submit — with starter pills beneath, and results below.
 * Plain canvas background; the brand lives in the graphics, not the chrome. */
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

  // Prompt-box convention: Enter sends, Shift+Enter breaks the line.
  const onBriefKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void run();
    }
  };

  const hero = (
    <div style={{ textAlign: "center", paddingTop: "var(--space-2xl)" }}>
      <h1
        style={{
          fontFamily: "var(--font-head)",
          fontWeight: "var(--weight-head)",
          fontSize: "var(--type-h3-size)",
          lineHeight: "var(--type-h3-lh)",
          letterSpacing: "var(--type-h3-track)",
          color: "var(--text-primary)",
        }}
      >
        What are we painting today?
      </h1>
      <p
        style={{
          marginTop: "var(--space-xs)",
          fontSize: "var(--type-body-size)",
          color: "var(--text-muted)",
        }}
      >
        Your brief, written into templates your design team already locked. Edit and export as
        usual.
      </p>
    </div>
  );

  // The dev backend has no Edge Functions and no model key: an honest
  // disabled state, following the designImport precedent.
  if (!stores.generate.isConfigured()) {
    return (
      <Page narrow={760}>
        {hero}
        <div className="sp-emptystate" style={{ marginTop: "var(--space-lg)" }}>
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
      <Page narrow={760}>
        {hero}
        <div className="sp-emptystate" style={{ marginTop: "var(--space-lg)" }}>
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
    <Page>
      <div style={{ maxWidth: 760, marginInline: "auto" }}>
        {hero}

        {/* The prompt card — the one control that matters, so it gets the
            stage. Elevation through surface colour, per the DS. */}
        <div
          className="sp-card"
          style={{ marginTop: "var(--space-lg)", padding: "var(--space-sm)" }}
        >
          <textarea
            rows={3}
            value={brief}
            maxLength={1500}
            onChange={(e) => setBrief(e.target.value)}
            onKeyDown={onBriefKeyDown}
            placeholder="We're hiring a senior nurse practitioner for the Evanston clinic, posting on LinkedIn this week."
            aria-label="Describe the post"
            disabled={busy}
            style={{
              width: "100%",
              background: "transparent",
              border: "none",
              outline: "none",
              resize: "none",
              fontFamily: "var(--font-ui)",
              fontSize: "var(--type-body-size)",
              lineHeight: "var(--type-body-lh)",
              color: "var(--text-primary)",
            }}
          />
          <div
            className="flex items-center justify-between gap-3"
            style={{ marginTop: "var(--space-2xs)" }}
          >
            {hinted ? (
              <p style={{ fontSize: "var(--type-caption-size)", color: "var(--text-muted)" }}>
                Using {hinted.name}.{" "}
                <button
                  type="button"
                  onClick={() => navigate({ name: "generate" }, { replace: true })}
                  style={{ textDecoration: "underline", color: "var(--text-secondary)" }}
                >
                  Search the whole library instead
                </button>
              </p>
            ) : (
              <label
                className="flex items-center gap-1.5"
                style={{
                  padding: "var(--space-3xs) var(--space-2xs)",
                  borderRadius: "var(--radius-control)",
                  background: "var(--bg-surface-raised)",
                  color: "var(--text-secondary)",
                }}
              >
                <Globe style={{ width: 14, height: 14, flexShrink: 0 }} aria-hidden />
                <select
                  value={platform ?? ""}
                  onChange={(e) => setPlatform((e.target.value || null) as PlatformId | null)}
                  aria-label="Platform"
                  disabled={busy}
                  style={{
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    fontFamily: "var(--font-ui)",
                    fontSize: "var(--type-label-size)",
                    color: "inherit",
                  }}
                >
                  <option value="">Any platform</option>
                  {PLATFORMS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <button
              type="button"
              className="sp-btn sp-btn-primary"
              disabled={!brief.trim() || busy}
              onClick={() => void run()}
              aria-label="Generate"
              title="Generate"
              style={{
                width: 38,
                height: 38,
                padding: 0,
                justifyContent: "center",
                borderRadius: "var(--radius-pill)",
                flexShrink: 0,
              }}
            >
              <ArrowUp style={{ width: 16, height: 16 }} />
            </button>
          </div>
        </div>

        {!results && !busy && (
          <div
            className="flex flex-wrap justify-center"
            style={{ gap: "var(--space-2xs)", marginTop: "var(--space-sm)" }}
          >
            {STARTERS.map((s) => (
              <button
                key={s.label}
                type="button"
                className="sp-chip"
                onClick={() => setBrief(s.brief)}
              >
                <span className="sp-chip__label">{s.label}</span>
              </button>
            ))}
          </div>
        )}

        {error && (
          <p
            role="alert"
            style={{
              marginTop: "var(--space-sm)",
              textAlign: "center",
              fontSize: "var(--type-label-size)",
              color: "var(--state-danger-on-surface)",
            }}
          >
            {error}
          </p>
        )}
      </div>

      {busy && (
        <div aria-busy="true" style={{ marginTop: "var(--space-lg)" }}>
          <p
            role="status"
            style={{
              textAlign: "center",
              fontSize: "var(--type-label-size)",
              color: "var(--text-muted)",
            }}
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
          <h2
            style={{
              fontFamily: "var(--font-head)",
              fontWeight: "var(--weight-head)",
              fontSize: "var(--type-cardtitle-size)",
              lineHeight: "var(--type-cardtitle-lh)",
              letterSpacing: "var(--type-cardtitle-track)",
              color: "var(--text-primary)",
              marginBottom: "var(--space-sm)",
            }}
          >
            Your drafts
          </h2>
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
