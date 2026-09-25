import React, { useId, useMemo } from "react";
import { ChevronDown, Globe } from "lucide-react";
import { PLATFORMS, type PlatformId } from "@/lib/templates/platforms";
import { Select, type SelectOption } from "../ui/Select";

const platformIconStyle: React.CSSProperties = { width: 14, height: 14, flexShrink: 0 };

/** The Figma draws the chevron inside a 16px icon box at 80% of the box
 * (lucide's geometry at 12.8px), stroked at 1.2. */
const CHEVRON = 12.8;

/** The composer's platform hint (Figma "Generate · Chat", sp-select
 * 328:840): the app's Select with the chat's tile trigger, a 36px tile
 * reading "Any platform" or the chosen platform over a chevron, with no
 * leading mark (the Figma draws none). The menu is the Select's own and
 * lists what the old Generate page listed: "Any platform" with the globe,
 * then every platform in PLATFORMS order with its mark.
 *
 * `covered` is the set of platforms the published library has templates
 * for (null while it loads). With `dimUncovered` on (library mode, a
 * non-empty library), the rest stay pickable but dim, and the menu says
 * why: the hint is a preference, and the server falls back to the whole
 * library with a warning when nothing matches. */
export function PlatformSelect({
  value,
  onChange,
  covered,
  dimUncovered,
  disabled,
}: {
  value: PlatformId | null;
  onChange(next: PlatformId | null): void;
  covered: ReadonlySet<PlatformId> | null;
  dimUncovered: boolean;
  disabled?: boolean;
}) {
  const id = `sp-chat-platform${useId()}`;
  const options = useMemo<Array<SelectOption<string>>>(
    () => [
      { value: "", label: "Any platform", icon: <Globe style={platformIconStyle} aria-hidden /> },
      ...PLATFORMS.map((p) => ({
        value: p.id as string,
        label: p.label,
        icon: <p.Icon style={platformIconStyle} aria-hidden />,
        dimmed: dimUncovered && covered !== null && !covered.has(p.id),
      })),
    ],
    [covered, dimUncovered],
  );
  const anyDimmed = options.some((o) => o.dimmed);

  return (
    <Select
      id={id}
      ariaLabel="Platform"
      value={value ?? ""}
      options={options}
      onSelect={(v) => onChange((v || null) as PlatformId | null)}
      placeholder="Any platform"
      disabled={disabled}
      triggerClassName="sp-chat-select"
      triggerChevron={
        <span className="sp-chat-select__chevron" aria-hidden>
          <ChevronDown size={CHEVRON} strokeWidth={1.2} absoluteStrokeWidth />
        </span>
      }
      menuMinWidth={220}
      menuCaption={
        anyDimmed
          ? "Dimmed platforms have no published templates yet. Picking one is a preference, and the whole library is still considered."
          : undefined
      }
    />
  );
}
