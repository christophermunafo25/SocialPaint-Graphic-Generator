import React, { useMemo, useState } from "react";
import {
  Globe,
  LayoutGrid,
  Link2,
  Link2Off,
  Mail,
  Megaphone,
  Printer,
  Search,
  Settings2,
  Users,
} from "lucide-react";
import {
  aspectRatioOf,
  classifySize,
  orientationOf,
  platformById,
  type CanvasSize,
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
import {
  Badge,
  Button,
  EmptyState,
  Field,
  IconButton,
  Input,
  Modal,
  NavItem,
  Skeleton,
} from "../primitives";
import type { IconComponent } from "../primitives/cx";
import { useRovingSelect } from "../primitives/roving";
import { LibrarySearch } from "../templates/LibrarySearch";
import { PlatformFilter } from "../templates/PlatformFilter";
import { MAX_SIDE, MIN_SIDE, WARN_MEGAPIXELS, sideError } from "./CanvasSizePicker";

type Dimensions = { width: number; height: number };

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** The rail's one entry that isn't a category. Custom is a mode: it swaps
 *  the grid for the two sides. */
type RailId = SizeCategoryId | "custom";

/** Each entry's 18 icon (329:2970). Print has no frame of its own; it takes
 *  the printer. */
const RAIL_ICON: Record<RailId, IconComponent> = {
  social: Users,
  email: Mail,
  display: Megaphone,
  web: Globe,
  print: Printer,
  general: LayoutGrid,
  custom: Settings2,
};

/** The categories, as Nav items (329:2970): one radio group, one tab stop,
 *  the arrows move and choose. They filter one region in place, as the chips
 *  do, so the two share the radio semantic. */
function CategoryRail({
  entries,
  selected,
  onSelect,
}: {
  entries: Array<{ id: RailId; label: string }>;
  selected: RailId;
  onSelect(next: RailId): void;
}) {
  const { itemProps } = useRovingSelect(
    entries,
    entries.findIndex((e) => e.id === selected),
    (e) => onSelect(e.id),
  );
  return (
    <div role="radiogroup" aria-label="Size category" className="sp-size__categories">
      {entries.map((entry, i) => {
        const isSelected = entry.id === selected;
        return (
          <NavItem
            key={entry.id}
            {...itemProps(i)}
            icon={RAIL_ICON[entry.id]}
            selected={isSelected}
            // A radio, not a page: the selected look without aria-current.
            aria-current={undefined}
            role="radio"
            aria-checked={isSelected}
            onClick={() => onSelect(entry.id)}
          >
            {entry.label}
          </NavItem>
        );
      })}
    </div>
  );
}

/** One size (329:3372): its cover on a 4:3 plate at radius/lg, then the
 *  name in Label/S over the dimensions and ratio in Caption/M, 8 apart. The
 *  whole cover is the button. The template's own size, when there is one
 *  (Make another size), is marked and can't be chosen. */
function SizeCover({
  size,
  current,
  onPick,
}: {
  size: CanvasSize;
  current: boolean;
  onPick(next: Dimensions): void;
}) {
  const platforms = size.platforms.map((p) => platformById(p).label).join(", ");
  return (
    <button
      type="button"
      className="ui-reset ui-ring sp-size-cover"
      aria-label={`${size.assetType} for ${platforms}, ${size.width} by ${size.height}${current ? ", the current size" : ""}`}
      disabled={current}
      onClick={() => onPick({ width: size.width, height: size.height })}
    >
      <span className="sp-size-cover__plate">
        <img src={coverFor(size.id)} alt="" decoding="async" />
      </span>
      <span className="sp-size-cover__text">
        <span className="sp-size-cover__name">
          <span className="t-label-s sp-size-cover__label">{size.assetType}</span>
          {current && <Badge tone="neutral">Current size</Badge>}
        </span>
        <span className="t-caption-m sp-size-cover__dims">
          {size.width} × {size.height} · {aspectRatioOf(size.width, size.height)}
        </span>
      </span>
    </button>
  );
}

/** A cover while the sizes load, in the cover's own boxes. */
function SizeCoverSkeleton() {
  return (
    <span className="sp-size-cover" aria-hidden>
      <span className="sp-size-cover__plate">
        <Skeleton width="100%" height="100%" radius="lg" />
      </span>
      <span className="sp-size-cover__text">
        <Skeleton width={96} height={9} />
        <Skeleton width={112} height={8} />
      </span>
    </span>
  );
}

/** Custom size: the two sides with the aspect link between them, what the
 *  numbers make as they're typed, and the button that uses them. The bounds
 *  and warnings are CanvasSizePicker's, one source. */
function CustomSizePane({
  seed,
  onPick,
}: {
  /** The sides it opens with. */
  seed: Dimensions;
  onPick(next: Dimensions): void;
}) {
  const [customW, setCustomW] = useState(String(seed.width));
  const [customH, setCustomH] = useState(String(seed.height));
  /** The aspect link: typing one side computes the other. */
  const [linked, setLinked] = useState(false);
  const linkRatio = seed.width / seed.height;

  const w = Number(customW);
  const h = Number(customH);
  const customErr =
    customW.trim() === "" || customH.trim() === ""
      ? "Enter both sides."
      : Number.isNaN(w) || Number.isNaN(h)
        ? "Numbers only."
        : (sideError(w) ?? sideError(h));
  const meaning = customErr ? null : classifySize(w, h);
  const verdict = customErr
    ? customErr
    : `${aspectRatioOf(w, h)} · ${orientationOf(w, h)}${
        meaning && meaning.assetType !== "Custom size"
          ? ` · ${meaning.platforms.map((p) => platformById(p).label).join(", ")} ${meaning.assetType.toLowerCase()}`
          : ""
      }`;

  const side = (
    label: "Width" | "Height",
    value: string,
    setValue: (v: string) => void,
    other: (n: number) => number,
    setOther: (v: string) => void,
  ) => (
    <Field label={label}>
      <Input
        type="number"
        inputMode="numeric"
        min={MIN_SIDE}
        max={MAX_SIDE}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          const n = Number(e.target.value);
          if (linked && Number.isFinite(n) && n > 0) setOther(String(Math.round(other(n))));
        }}
      />
    </Field>
  );

  return (
    <form
      className="sp-size-custom"
      onSubmit={(e) => {
        e.preventDefault();
        if (!customErr) onPick({ width: w, height: h });
      }}
    >
      <div className="sp-size-custom__sides">
        {side("Width", customW, setCustomW, (n) => n / linkRatio, setCustomH)}
        <IconButton
          variant="ghost"
          icon={linked ? Link2 : Link2Off}
          label={linked ? "Unlock the aspect ratio" : "Lock the aspect ratio"}
          aria-pressed={linked}
          selected={linked}
          onClick={() => setLinked((v) => !v)}
          className="sp-size-custom__link"
        />
        {side("Height", customH, setCustomH, (n) => n * linkRatio, setCustomW)}
      </div>
      <p className="t-caption-m sp-size-custom__verdict" role="status">
        {verdict}
      </p>
      {!customErr && w * h > WARN_MEGAPIXELS && (
        <p className="t-caption-m sp-size-custom__verdict">
          Over 4 megapixels: exporting a canvas this large can run a phone browser out of memory.
        </p>
      )}
      <div>
        <Button kind="primary" type="submit" disabled={Boolean(customErr)}>
          {customErr ? "Use custom size" : `Use ${w} × ${h}`}
        </Button>
      </div>
    </form>
  );
}

export type SizesState =
  | { status: "loading" }
  | { status: "error"; retry(): void }
  | { status: "ready"; sizes: CanvasSize[] };

/** Choose a size's body (329:2970): the categories on the left, 200 wide;
 *  on the right the platform chips and the search over the covers, 24
 *  apart. A size is picked by a click on its cover. */
export function SizeGallery({
  state,
  current = null,
  onPick,
}: {
  /** The workspace's enabled subset of the size catalogue. */
  state: SizesState;
  /** The template's own size (Make another size): marked, and not offered. */
  current?: Dimensions | null;
  onPick(next: Dimensions): void;
}) {
  const sizes = useMemo(() => (state.status === "ready" ? state.sizes : []), [state]);
  const present = useMemo(() => categoriesPresent(sizes), [sizes]);

  /** null is "not chosen yet": Social media when it has sizes, else the
   *  first populated category, else custom, so a workspace that turned the
   *  social set off still lands somewhere real. */
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
    // The chips are per category; a stale platform would empty the grid.
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
  const announcement = !isCustom && filtered ? plural(visible.length, "size") : "";

  if (state.status === "error") {
    return (
      <EmptyState
        icon={LayoutGrid}
        title="We couldn't load the sizes."
        action={
          <Button kind="primary" onClick={state.retry}>
            Try again
          </Button>
        }
        className="sp-size__error"
      />
    );
  }

  return (
    <div className="sp-size">
      {state.status === "loading" ? (
        <div className="sp-size__categories" aria-hidden>
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} width="100%" height={36} radius="sm" />
          ))}
        </div>
      ) : (
        <CategoryRail entries={railEntries} selected={category} onSelect={selectCategory} />
      )}

      <div className="sp-size__main">
        {state.status === "loading" ? (
          <div className="sp-size__scroll" aria-busy="true" aria-label="Loading sizes">
            <div className="sp-size__grid">
              {Array.from({ length: 8 }, (_, i) => (
                <SizeCoverSkeleton key={i} />
              ))}
            </div>
          </div>
        ) : isCustom ? (
          <CustomSizePane
            seed={current ?? sizes[0] ?? { width: 1080, height: 1080 }}
            onPick={onPick}
          />
        ) : (
          <>
            <div className="sp-size__filters">
              <PlatformFilter
                facets={chipEntries}
                selected={platform}
                onSelect={setPlatform}
                chevron={false}
                className="sp-size__chips"
              />
              <LibrarySearch
                className="sp-size__search"
                value={query}
                onChange={setQuery}
                label="Search sizes"
                placeholder="Search sizes, platforms, or dimensions"
              />
            </div>
            <p className="sp-live" role="status" aria-live="polite">
              {announcement}
            </p>
            <div className="sp-size__scroll">
              {visible.length === 0 ? (
                <EmptyState
                  icon={Search}
                  title={query.trim() ? "No sizes match that search." : "No sizes here yet."}
                  action={
                    query.trim() ? (
                      <Button kind="primary" onClick={() => setQuery("")}>
                        Clear search
                      </Button>
                    ) : platform ? (
                      <Button kind="primary" onClick={() => setPlatform(null)}>
                        Show all sizes
                      </Button>
                    ) : undefined
                  }
                  className="sp-size__empty"
                />
              ) : (
                <div className="sp-size__grid">
                  {visible.map((s) => (
                    <SizeCover
                      key={s.id}
                      size={s}
                      current={
                        current !== null && s.width === current.width && s.height === current.height
                      }
                      onPick={onPick}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Choose a size (329:2970): a 1040 dialog around the gallery. A blank
 *  template starts at the size picked here, and Make another size builds
 *  its version at it. */
export function ChooseSizeDialog({
  open,
  onOpenChange,
  state,
  current,
  onPick,
  returnFocus,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
  state: SizesState;
  current?: Dimensions | null;
  onPick(next: Dimensions): void;
  /** Where focus goes when it closes (New template's opener). */
  returnFocus?: React.RefObject<HTMLElement | null>;
}) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Choose a size"
      titleStyle="card"
      className="sp-size-dialog"
      returnFocus={returnFocus}
    >
      <SizeGallery state={state} current={current} onPick={onPick} />
    </Modal>
  );
}
