import React from "react";
import { Building, FileText, Plus, X } from "lucide-react";
import { Avatar } from "../primitives";

/** The pieces onboarding's steps share (Figma 257:2, PHASE-8B-ONBOARDING-
 * SCREENS.md). Styles are in src/styles/auth.css. */

/** The six-segment progress bar at the top of the form column (258:22).
 * The current step counts as done. */
export function ProgressSegments({ done, total = 6 }: { done: number; total?: number }) {
  return (
    <div
      className="sp-onb-progress"
      role="progressbar"
      aria-label="Setup progress"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={done}
    >
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className="sp-onb-progress__segment" data-done={i < done || undefined} />
      ))}
    </div>
  );
}

/** A question: its label in Label/L over the control, 12 apart (257:4002).
 * The label is the control's accessible name; pass `labelId` to the
 * control's aria-labelledby (or `htmlFor` for an input). An error sits
 * under the control, as a Field's does. */
export function Question({
  label,
  labelId,
  htmlFor,
  error,
  errorId,
  children,
}: {
  label?: string;
  labelId?: string;
  htmlFor?: string;
  error?: string | null;
  errorId?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="sp-onb-question">
      {label &&
        (htmlFor ? (
          <label id={labelId} htmlFor={htmlFor} className="t-label-l">
            {label}
          </label>
        ) : (
          <p id={labelId} className="t-label-l">
            {label}
          </p>
        ))}
      {children}
      {error && (
        <p id={errorId} className="t-caption-s sp-onb-question__error">
          {error}
        </p>
      )}
    </div>
  );
}

/** A brand colour as a 40 circle (05b), with a remove button on hover and
 * focus. */
export function ColorDot({
  hex,
  name,
  onRemove,
}: {
  hex: string;
  name: string;
  onRemove?: () => void;
}) {
  return (
    <span className="sp-onb-dot" style={{ "--_swatch": hex } as React.CSSProperties}>
      <span className="sp-onb-dot__fill" role="img" aria-label={`${name} ${hex}`} />
      {onRemove && (
        <button
          type="button"
          className="ui-reset ui-ring sp-onb-dot__remove"
          aria-label={`Remove ${name}`}
          onClick={onRemove}
        >
          <X size={12} className="ui-icon" aria-hidden />
        </button>
      )}
    </span>
  );
}

/** A brand colour as a card (07): the chip over its hex in Mono/S. */
export function ColorCard({
  hex,
  name,
  onRemove,
}: {
  hex: string;
  name: string;
  onRemove?: () => void;
}) {
  return (
    <span className="sp-onb-color-card" style={{ "--_swatch": hex } as React.CSSProperties}>
      <span className="sp-onb-color-card__chip" role="img" aria-label={name} />
      <span className="t-mono-s sp-onb-muted">{hex.toUpperCase()}</span>
      {onRemove && (
        <button
          type="button"
          className="ui-reset ui-ring sp-onb-dot__remove"
          aria-label={`Remove ${name}`}
          onClick={onRemove}
        >
          <X size={12} className="ui-icon" aria-hidden />
        </button>
      )}
    </span>
  );
}

/** The add-colour control: a 40 circle (05b) or a 56-wide tile (07). It's
 * the trigger the popover colour editor opens from. */
export const AddColorButton = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { shape: "dot" | "tile" }
>(function AddColorButton({ shape, className, ...rest }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      className={`ui-reset ui-tint ui-ring sp-onb-add-color ${className ?? ""}`}
      data-shape={shape}
      aria-label="Add a color"
      {...rest}
    >
      <Plus size={16} className="ui-icon" aria-hidden />
    </button>
  );
});

/** What the Workspace preview shows, row by row; an absent row is a
 * skeleton (PHASE-8B §9 D14). */
export interface PreviewState {
  person?: { name: string; detail?: string };
  workspace?: { name: string; detail?: string };
  firstUp?: { title: string; detail?: string };
  brand?: { logoUrl?: string; colors: string[]; font?: string };
  /** Thumbnails of the seeded starters, up to three. */
  templates?: React.ReactNode[];
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("") || "?";

/** The onboarding panel's card (Figma 258:38 and its siblings): YOU,
 * WORKSPACE, FIRST UP, BRAND and TEMPLATES, each a skeleton until its
 * answers arrive. Decorative, like the panel it sits in. */
export function WorkspacePreview({ state }: { state: PreviewState }) {
  const { person, workspace, firstUp, brand, templates } = state;
  return (
    <div className="sp-auth__card sp-onb-preview">
      <PreviewRow eyebrow="You">
        {person ? (
          <Lead
            lead={<Avatar initials={initials(person.name)} size="lg" />}
            name={person.name}
            detail={person.detail}
          />
        ) : (
          <SkeletonLead round />
        )}
      </PreviewRow>
      <PreviewRow eyebrow="Workspace">
        {workspace ? (
          <Lead
            lead={<IconTile icon={<Building size={16} className="ui-icon" />} />}
            name={workspace.name}
            detail={workspace.detail}
          />
        ) : (
          <SkeletonLead />
        )}
      </PreviewRow>
      <PreviewRow eyebrow="First up">
        {firstUp ? (
          <Lead
            lead={<IconTile icon={<FileText size={16} className="ui-icon" />} />}
            name={firstUp.title}
            detail={firstUp.detail}
          />
        ) : (
          <SkeletonLead wide />
        )}
      </PreviewRow>
      <PreviewRow eyebrow="Brand">
        <div className="sp-onb-preview__brand">
          {brand?.logoUrl ? (
            <img className="sp-onb-preview__logo" src={brand.logoUrl} alt="" />
          ) : (
            <span className="sp-onb-skeleton sp-onb-preview__logo" />
          )}
          {(brand?.colors.length ? brand.colors.slice(0, 4) : [null, null, null, null]).map(
            (hex, i) =>
              hex ? (
                <span
                  key={i}
                  className="sp-onb-preview__swatch"
                  style={{ "--_swatch": hex } as React.CSSProperties}
                />
              ) : (
                <span key={i} className="sp-onb-skeleton sp-onb-preview__swatch" />
              ),
          )}
          {brand?.font && (
            <span className="t-caption-s sp-onb-muted sp-onb-preview__font">{brand.font}</span>
          )}
        </div>
      </PreviewRow>
      <PreviewRow eyebrow="Templates">
        <div className="sp-onb-preview__templates">
          {[0, 1, 2].map((i) =>
            templates?.[i] ? (
              <span key={i} className="sp-onb-preview__thumb">
                {templates[i]}
              </span>
            ) : (
              <span key={i} className="sp-onb-skeleton sp-onb-preview__thumb" />
            ),
          )}
        </div>
      </PreviewRow>
    </div>
  );
}

function PreviewRow({ eyebrow, children }: { eyebrow: string; children: React.ReactNode }) {
  return (
    <div className="sp-onb-preview__row">
      <p className="t-mono-eyebrow sp-onb-muted">{eyebrow}</p>
      {children}
    </div>
  );
}

function Lead({ lead, name, detail }: { lead: React.ReactNode; name: string; detail?: string }) {
  return (
    <div className="sp-onb-preview__lead">
      {lead}
      <span className="sp-onb-preview__lead-text">
        <span className="t-label-m">{name}</span>
        {detail && <span className="t-caption-s sp-onb-muted">{detail}</span>}
      </span>
    </div>
  );
}

function IconTile({ icon }: { icon: React.ReactNode }) {
  return <span className="sp-onb-preview__icon">{icon}</span>;
}

function SkeletonLead({ round, wide }: { round?: boolean; wide?: boolean }) {
  return (
    <div className="sp-onb-preview__lead">
      <span className="sp-onb-skeleton sp-onb-preview__icon" data-round={round || undefined} />
      <span className="sp-onb-preview__lead-text">
        <span className="sp-onb-skeleton sp-onb-preview__line" data-wide={wide || undefined} />
        <span className="sp-onb-skeleton sp-onb-preview__line" data-short />
      </span>
    </div>
  );
}
