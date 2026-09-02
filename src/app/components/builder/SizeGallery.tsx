import React, { useMemo, useRef, useState } from "react";
import { LayoutGrid, Link2, Link2Off } from "lucide-react";
import {
  aspectRatioOf,
  classifySize,
  orientationOf,
  platformById,
  type CanvasSize,
  type Platform,
  type PlatformId,
} from "@/lib/templates/platforms";
import {
  categoriesPresent,
  platformsInCategory,
  sizeMatchesQuery,
  sizesFor,
  type SizeCategoryId,
} from "@/lib/templates/sizeCategories";
import { coverFor } from "@/lib/templates/sizeCovers";
import { TemplateSearchField } from "../templates/TemplateSearchField";
import { useEdgeFade } from "../templates/useEdgeFade";
import { MAX_SIDE, MIN_SIDE, WARN_MEGAPIXELS, sideError } from "./CanvasSizePicker";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** The rail's one non-category entry. Custom is a MODE — it swaps the grid
 *  for the custom inputs — so it lives here, not in CATEGORIES. */
type RailId = SizeCategoryId | "custom";

/** Shared roving-tabindex arrows, the GroupChips contract: one stop in the
 *  tab order, arrows move within the group and select as they go. Serves
 *  both the vertical rail and the horizontal chip bar, so either arrow axis
 *  works in both. */
const rovingKeyDown =
  (count: number, activeIndex: number, focusAndSelect: (i: number) => void) =>
  (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      focusAndSelect((activeIndex + 1) % count);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      focusAndSelect((activeIndex - 1 + count) % count);
    } else if (e.key === "Home") {
      e.preventDefault();
      focusAndSelect(0);
    } else if (e.key === "End") {
      e.preventDefault();
      focusAndSelect(count - 1);
    }
  };

/** The category rail. A radio group like the chip bar — both filter one
 *  region in place, so they share one semantic instead of splitting into
 *  half-tablist, half-radio. */
function CategoryRail({
  entries,
  selected,
  onSelect,
}: {
  entries: Array<{ id: RailId; label: string }>;
  selected: RailId;
  onSelect(next: RailId): void;
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const activeIndex = Math.max(
    0,
    entries.findIndex((e) => e.id === selected),
  );
  const focusAndSelect = (i: number) => {
    onSelect(entries[i].id);
    refs.current[i]?.focus();
  };
  const onKeyDown = rovingKeyDown(entries.length, activeIndex, focusAndSelect);

  return (
    <div
      role="radiogroup"
      aria-label="Size category"
      className="flex-shrink-0 space-y-0.5"
      style={{ width: 180, overflowY: "auto" }}
    >
      {entries.map((entry, i) => {
        const isSelected = entry.id === selected;
        return (
          <button
            key={entry.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={isSelected}
            tabIndex={isSelected ? 0 : -1}
            onClick={() => onSelect(entry.id)}
            onKeyDown={onKeyDown}
            className="w-full px-3 text-left"
            data-radius-control
            style={{
              minHeight: 44, // hit target
              fontSize: "var(--type-label-size)",
              background: isSelected ? "var(--bg-hover)" : "transparent",
              color: isSelected ? "var(--text-primary)" : "var(--text-secondary)",
            }}
          >
            {entry.label}
          </button>
        );
      })}
    </div>
  );
}

/** The platform chip bar for one category: All first — there is no
 *  popularity signal in this product, so no chip pretends otherwise — then
 *  the category's platforms in PLATFORMS order with enabled-size counts. */
function PlatformChips({
  entries,
  total,
  selected,
  onSelect,
}: {
  entries: Array<{ platform: Platform; count: number }>;
  total: number;
  /** null is the All chip. */
  selected: PlatformId | null;
  onSelect(next: PlatformId | null): void;
}) {
  const { ref, atStart, atEnd } = useEdgeFade<HTMLDivElement>([entries.length]);
  const chipRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const ids: Array<PlatformId | null> = [null, ...entries.map((e) => e.platform.id)];
  const activeIndex = Math.max(0, ids.indexOf(selected));
  const focusAndSelect = (i: number) => {
    onSelect(ids[i]);
    chipRefs.current[i]?.focus();
  };
  const onKeyDown = rovingKeyDown(ids.length, activeIndex, focusAndSelect);

  const chip = (
    id: PlatformId | null,
    index: number,
    label: string,
    count: number,
    Icon: typeof LayoutGrid,
  ) => {
    const isSelected = selected === id;
    return (
      <button
        key={id ?? "all"}
        ref={(el) => {
          chipRefs.current[index] = el;
        }}
        type="button"
        role="radio"
        aria-checked={isSelected}
        tabIndex={isSelected ? 0 : -1}
        className="sp-chip"
        data-selected={isSelected || undefined}
        onClick={() => onSelect(id)}
        onKeyDown={onKeyDown}
      >
        <Icon className="sp-chip__icon" strokeWidth={1.5} aria-hidden />
        <span className="sp-chip__label">{label}</span>
        <span className="sp-chip__count">{count}</span>
      </button>
    );
  };

  return (
    <div
      className="sp-railfade"
      data-at-start={atStart || undefined}
      data-at-end={atEnd || undefined}
    >
      <div
        ref={ref}
        className="sp-railfade__track sp-chipbar"
        role="radiogroup"
        aria-label="Filter by platform"
      >
        {chip(null, 0, "All", total, LayoutGrid)}
        {entries.map((e, i) =>
          chip(e.platform.id, i + 1, e.platform.label, e.count, e.platform.Icon),
        )}
      </div>
    </div>
  );
}

/** One size card. The whole card is the control — the plate is decoration —
 *  and the chosen card wears aria-pressed, which the CSS turns into the
 *  stronger border. */
function SizeCard({
  size,
  current,
  onPick,
}: {
  size: CanvasSize;
  current: boolean;
  onPick(next: { width: number; height: number }): void;
}) {
  const cover = coverFor(size.id);
  return (
    <button
      type="button"
      className="sp-card sp-media-card sp-sizecard"
      aria-pressed={current}
      aria-label={`${size.assetType} — ${size.width} by ${size.height}`}
      onClick={() => onPick({ width: size.width, height: size.height })}
    >
      {cover ? (
        // Committed assets, not user content — inlining is safe, and it is
        // what lets the app's --cover-* tokens reach inside the SVG.
        <div
          className="sp-sizecard__plate"
          aria-hidden
          dangerouslySetInnerHTML={{ __html: cover }}
        />
      ) : (
        // No art yet: the size's true proportions as an outline, drawn large
        // on the same ground, so a half-covered grid still reads as one set.
        <div className="sp-sizecard__plate" aria-hidden>
          <div className="flex items-center justify-center" style={{ width: "72%", height: "72%" }}>
            <div
              style={{
                aspectRatio: `${size.width} / ${size.height}`,
                ...(size.width / size.height >= 1 ? { width: "100%" } : { height: "100%" }),
                border: "1px solid var(--cover-chrome-2)",
              }}
            />
          </div>
        </div>
      )}
      <div style={{ padding: "var(--space-xs) 0 var(--space-3xs)" }}>
        <span
          className="block truncate"
          style={{
            fontSize: "var(--type-label-size)",
            fontWeight: "var(--weight-ui)",
            color: "var(--text-primary)",
          }}
        >
          {size.assetType}
        </span>
        <span
          className="block"
          style={{
            marginTop: "var(--space-3xs)",
            fontFamily: "var(--font-mono)",
            fontSize: "var(--type-caption-size)",
            letterSpacing: "0.04em",
            color: "var(--text-muted)",
          }}
        >
          {size.width} × {size.height} · {aspectRatioOf(size.width, size.height)}
        </span>
      </div>
    </button>
  );
}

/** The custom inputs, lifted from CanvasSizePicker's custom tab with the
 *  same bounds, warnings, aspect link, and wording. Creation has no aspect
 *  constraint, so the aspectLock branches simply do not exist here. */
function CustomSizePane({
  value,
  onPick,
}: {
  value: { width: number; height: number };
  onPick(next: { width: number; height: number }): void;
}) {
  const [customW, setCustomW] = useState(String(value.width));
  const [customH, setCustomH] = useState(String(value.height));
  /** Aspect link for the custom inputs: typing one side computes the other. */
  const [linked, setLinked] = useState(false);
  const linkRatio = value.width / value.height;

  const w = Number(customW);
  const h = Number(customH);
  const customErr =
    customW.trim() === "" || customH.trim() === ""
      ? "Enter both sides."
      : Number.isNaN(w) || Number.isNaN(h)
        ? "Numbers only."
        : (sideError(w) ?? sideError(h));
  const customMeaning = customErr ? null : classifySize(w, h);

  return (
    <div className="space-y-2" style={{ maxWidth: 360 }}>
      <div className="flex items-center gap-1.5">
        {(
          [
            ["Width", customW, setCustomW, (side: number) => side / linkRatio, setCustomH],
            ["Height", customH, setCustomH, (side: number) => side * linkRatio, setCustomW],
          ] as const
        ).map(([label, val, setVal, other, setOther]) => (
          <label key={label} className="flex-1">
            <span className="sp-eyebrow block" style={{ marginBottom: 2 }}>
              {label}
            </span>
            <input
              type="number"
              inputMode="numeric"
              min={MIN_SIDE}
              max={MAX_SIDE}
              value={val}
              onChange={(e) => {
                setVal(e.target.value);
                const n = Number(e.target.value);
                if (linked && Number.isFinite(n) && n > 0) setOther(String(Math.round(other(n))));
              }}
              className="w-full px-2 py-1.5"
              data-radius-control
              style={{
                border: "1px solid var(--border-strong)",
                background: "var(--bg-surface)",
                fontSize: "var(--type-label-size)",
                color: "var(--text-primary)",
              }}
            />
          </label>
        ))}
        <button
          onClick={() => setLinked((v) => !v)}
          aria-pressed={linked}
          title={linked ? "Unlock the aspect ratio" : "Lock the aspect ratio while typing"}
          aria-label={linked ? "Unlock the aspect ratio" : "Lock the aspect ratio"}
          className="sp-icon-btn flex-shrink-0"
          style={{ marginTop: 16, color: linked ? "var(--state-primary)" : undefined }}
        >
          {linked ? (
            <Link2 style={{ width: 15, height: 15 }} />
          ) : (
            <Link2Off style={{ width: 15, height: 15 }} />
          )}
        </button>
      </div>

      {/* Live verdicts: the ratio and orientation as they type, and the
          platform classification so a custom number that lands on a known
          size says so. */}
      <p style={{ fontSize: "var(--type-caption-size)", color: "var(--text-secondary)" }}>
        {customErr ??
          `${aspectRatioOf(w, h)} · ${orientationOf(w, h)}${
            customMeaning && customMeaning.assetType !== "Custom size"
              ? ` · ${customMeaning.platforms
                  .map((p) => platformById(p).label)
                  .join(" · ")} ${customMeaning.assetType}`
              : ""
          }`}
      </p>
      {!customErr && w * h > WARN_MEGAPIXELS && (
        <p style={{ fontSize: "var(--type-caption-size)", color: "var(--text-secondary)" }}>
          Over 4 megapixels — exporting a canvas this large can run a phone browser out of memory.
        </p>
      )}
      <button
        onClick={() => {
          if (customErr) return;
          onPick({ width: w, height: h });
        }}
        disabled={Boolean(customErr)}
        className="sp-btn w-full"
        style={{ minHeight: 30 }}
      >
        {customErr ? "Use custom size" : `Use ${w}×${h}`}
      </button>
    </div>
  );
}

/** The start screen's size gallery: category rail, platform chips, cover
 *  grid. Replaces the 280px preset list on ONE call site — the builder's
 *  other two size surfaces stay on CanvasSizePicker, which carries the
 *  resize-time constraints this surface deliberately has no use for.
 *
 *  Picking a card only marks it and calls onPick — the three path cards
 *  below decide what happens next; choosing a size never auto-advances. */
export function SizeGallery({
  sizes,
  value,
  onPick,
}: {
  /** The workspace's enabled subset of the size catalogue. */
  sizes: CanvasSize[];
  /** The current canvas size — pressed in the grid, seeds custom mode. */
  value: { width: number; height: number };
  onPick(next: { width: number; height: number }): void;
}) {
  const present = useMemo(() => categoriesPresent(sizes), [sizes]);

  /** null means "not chosen yet": social when it has sizes, else the first
   *  populated category, else custom — so a workspace that emptied the
   *  social set still lands somewhere real. A remembered pick that loses
   *  its sizes falls back the same way. */
  const [picked, setPicked] = useState<RailId | null>(null);
  const fallback: RailId = present.some((c) => c.id === "social")
    ? "social"
    : (present[0]?.id ?? "custom");
  const category: RailId =
    picked && (picked === "custom" || present.some((c) => c.id === picked)) ? picked : fallback;

  const [platform, setPlatform] = useState<PlatformId | null>(null);
  const [query, setQuery] = useState("");

  const railEntries: Array<{ id: RailId; label: string }> = [
    ...present.map((c) => ({ id: c.id as RailId, label: c.label })),
    { id: "custom", label: "Custom size" },
  ];

  const selectCategory = (next: RailId) => {
    setPicked(next);
    // Chips are per-category; a stale platform would silently empty the grid.
    setPlatform(null);
  };

  const isCustom = category === "custom";
  const chipEntries = useMemo(
    () => (isCustom ? [] : platformsInCategory(category, sizes)),
    [isCustom, category, sizes],
  );
  const inCategory = useMemo(
    () => (isCustom ? [] : sizesFor(category, sizes, platform)),
    [isCustom, category, sizes, platform],
  );
  const visible = useMemo(
    () => (query.trim() ? inCategory.filter((s) => sizeMatchesQuery(s, query)) : inCategory),
    [inCategory, query],
  );

  const filtered = query.trim() !== "" || platform !== null;
  const announcement =
    !isCustom && filtered
      ? `${plural(visible.length, "size")}${query.trim() ? ` for “${query.trim()}”` : ""}${
          platform ? ` · ${platformById(platform).label}` : ""
        }`
      : "";

  return (
    <div className="flex items-stretch" style={{ gap: "var(--space-md)" }}>
      <CategoryRail entries={railEntries} selected={category} onSelect={selectCategory} />

      <div className="flex-1 min-w-0 space-y-3">
        {isCustom ? (
          <CustomSizePane value={value} onPick={onPick} />
        ) : (
          <>
            <TemplateSearchField
              value={query}
              onChange={setQuery}
              placeholder="Search sizes, platforms, or dimensions"
              ariaLabel="Search sizes"
            />
            <PlatformChips
              entries={chipEntries}
              total={sizesFor(category, sizes).length}
              selected={platform}
              onSelect={setPlatform}
            />

            <p className="sp-live" role="status" aria-live="polite">
              {announcement}
            </p>

            {visible.length === 0 ? (
              <div className="sp-emptystate">
                <p className="sp-emptystate__title">
                  {query.trim() ? `No sizes match “${query.trim()}”.` : "That set is empty."}
                </p>
                <div className="sp-emptystate__actions">
                  {query.trim() && (
                    <button
                      type="button"
                      className="sp-btn sp-btn-primary"
                      onClick={() => setQuery("")}
                    >
                      Clear search
                    </button>
                  )}
                  {!query.trim() && platform && (
                    <button
                      type="button"
                      className="sp-btn sp-btn-primary"
                      onClick={() => setPlatform(null)}
                    >
                      Back to all sizes
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="sp-sizegrid">
                {visible.map((s) => (
                  <SizeCard
                    key={s.id}
                    size={s}
                    current={s.width === value.width && s.height === value.height}
                    onPick={onPick}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
