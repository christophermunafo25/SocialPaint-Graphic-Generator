import React, { useLayoutEffect, useRef } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cx, type IconComponent } from "./cx";
import { IconButton } from "./IconButton";
import { RollDigits } from "./RollDigits";
import { Skeleton } from "./Skeleton";

export interface CardProps {
  title: React.ReactNode;
  /** A line under the header, in Body/M on text/secondary. */
  description?: React.ReactNode;
  /** The header's action: a ghost Small button. */
  action?: React.ReactNode;
  /** Loading keeps the card's surface and shows lines where its header and
   * content will be. A string title names the busy region. */
  loading?: boolean;
  children?: React.ReactNode;
  className?: string;
}

/** Card (Figma 2215:141): a raised surface at radius/xl with 24 around its
 * content and 16 between its parts. The header is the title in Title/Card
 * with an optional action on the right. */
export function Card({
  title,
  description,
  action,
  loading = false,
  children,
  className,
}: CardProps) {
  if (loading) {
    return (
      <section
        className={cx("ui-card", className)}
        aria-busy="true"
        aria-label={typeof title === "string" ? title : undefined}
      >
        <Skeleton width={140} height={14} />
        <Skeleton height={10} />
        <Skeleton width={240} height={10} />
      </section>
    );
  }
  return (
    <section className={cx("ui-card", className)}>
      <header className="ui-card__header">
        <h2 className="t-title-card">{title}</h2>
        {action}
      </header>
      {description && <p className="t-body-m ui-card__description">{description}</p>}
      {children}
    </section>
  );
}

/** Settings card (Figma 58:460): a settings section, its title and an
 * optional header action (a Button) over its rows. A Product component:
 * it keeps its earlier look until Settings is rebuilt. */
export function SettingsCard({
  title,
  action,
  children,
  className,
}: {
  title: React.ReactNode;
  action?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cx("ui-settings-card", className)}>
      <header className="ui-settings-card__header">
        <h2 className="tu-title-card">{title}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}

/** Stat (Figma 59:449): a label and its value, inside a settings card. At
 * Large it is a figure: the label over a big number, with an optional line
 * under it on text/secondary ("286 via public links", 13:15351). It
 * belongs to Settings and keeps its earlier look until that page is
 * rebuilt. */
export function Stat({
  label,
  value,
  sub,
  size = "md",
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  /** Large only. */
  sub?: React.ReactNode;
  size?: "md" | "lg";
}) {
  if (size === "lg") {
    return (
      <div className="ui-stat" data-size="lg">
        <span className="tu-label-m">{label}</span>
        <span className="tu-title-metric">{value}</span>
        {sub && <span className="tu-body-s ui-stat__sub">{sub}</span>}
      </div>
    );
  }
  return (
    <div className="ui-stat">
      <span className="tu-label-xs ui-stat__label">{label}</span>
      <span className="tu-body-m">{value}</span>
    </div>
  );
}

export interface MetricProps {
  label: React.ReactNode;
  value: React.ReactNode;
  /** The change against the period before: a Badge with its arrow. */
  delta?: React.ReactNode;
  /** What the change is measured against, in Caption/M. */
  caption?: React.ReactNode;
  /** Loading keeps the card's size and shows the shape of each part. A
   * string label names the busy region. */
  loading?: boolean;
  /** Draws the value as rolling digits (PROMPT.md section 7.7): true on
   * the render where numbers land after a change the member made, false
   * otherwise (a first load or a background refresh swaps at once). Left
   * out, the value draws as it is. Rolling needs a string or number. */
  roll?: boolean;
  className?: string;
}

/** Metric (Figma 2215:223): one number on a raised card at radius/xl. The
 * label in Label/M, the value in Title/Metric, then the change: a badge and
 * a caption. */
export function Metric({
  label,
  value,
  delta,
  caption,
  loading = false,
  roll,
  className,
}: MetricProps) {
  if (loading) {
    return (
      <div
        className={cx("ui-metric", className)}
        aria-busy="true"
        aria-label={typeof label === "string" ? label : undefined}
      >
        <Skeleton width={64} height={10} />
        <Skeleton width={120} height={29} />
        <Skeleton width={180} height={24} radius="full" />
      </div>
    );
  }
  return (
    <div className={cx("ui-metric", className)}>
      <span className="t-label-m">{label}</span>
      <span className="t-title-metric">
        {roll !== undefined && (typeof value === "string" || typeof value === "number") ? (
          <RollDigits text={String(value)} roll={roll} />
        ) : (
          value
        )}
      </span>
      {(delta || caption) && (
        <span className="ui-metric__change">
          {delta}
          {caption && <span className="t-caption-m ui-metric__caption">{caption}</span>}
        </span>
      )}
    </div>
  );
}

interface ModalBodyProps {
  title: React.ReactNode;
  /** An icon before the title (the public links dialog). */
  icon?: IconComponent;
  /** The title's style: Title/Group, or Title/Card as a dialog with an icon
   * draws it. The Template Builder's dialogs draw Title/Card with or
   * without an icon (329:2660, 329:2970). Absent, Card with an icon and
   * Group without. */
  titleStyle?: "group" | "card";
  children?: React.ReactNode;
  closeLabel?: string;
  /** A dialog that holds a form or a picker instead of a question takes
   * the wider panel. */
  wide?: boolean;
  /** A class on the panel, for a dialog the file draws at a width of its
   * own (the public links dialog's 520, 2323:888). */
  className?: string;
}

export interface ModalProps extends ModalBodyProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  /** Where focus lands when it opens (a confirmation's Cancel): call
   * preventDefault and focus it. Absent, the first control in the dialog. */
  onOpenAutoFocus?(event: Event): void;
  /** Where focus goes when it closes, for a dialog opened from another
   * dialog (New template, then Choose a size): its opener is gone by then.
   * Absent, whatever had focus when it opened. */
  returnFocus?: React.RefObject<HTMLElement | null>;
}

const titleClass = (icon: IconComponent | undefined, style: "group" | "card" | undefined) =>
  (style ?? (icon ? "card" : "group")) === "card" ? "t-title-card" : "t-title-group";

/** The inside of a dialog: the title in Title/Group, the close button in
 * the top right corner, then what the dialog holds. The close button
 * follows the title in the document, so it is the first stop for the
 * keyboard, and it is placed in the corner by the panel. A dialog with an
 * icon draws its own header (the public links dialog, 2323:888): the 18
 * icon and the title in Title/Card, 8 apart. */
function ModalInside({
  title,
  icon: Icon,
  children,
  heading,
  close,
}: Pick<ModalBodyProps, "title" | "icon" | "children"> & {
  heading(title: React.ReactNode): React.ReactNode;
  close: React.ReactNode;
}) {
  return (
    <>
      <div className="ui-modal__header">
        {Icon && <Icon size={18} strokeWidth={1.5} className="ui-icon" aria-hidden />}
        {heading(title)}
        {close}
      </div>
      {children}
    </>
  );
}

/** Dialog (Figma 2215:203) on Radix dialog: a raised panel at radius/xl
 * under Elevation/3 Floating, over surface/scrim. Focus is held inside, and
 * Escape, the close button and a click on the scrim close it and hand
 * focus back. Its body and actions are ModalBody and ModalActions. */
export function Modal({
  open,
  onOpenChange,
  title,
  icon,
  titleStyle,
  children,
  closeLabel = "Close",
  wide = false,
  className,
  onOpenAutoFocus,
  returnFocus,
}: ModalProps) {
  // Radix returns focus only to a Dialog.Trigger. A modal opened from
  // anywhere else hands focus back to whatever had it when it opened.
  const returnTo = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (open) returnTo.current = document.activeElement as HTMLElement | null;
  }, [open]);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="ui-modal-scrim" />
        <Dialog.Content
          className={cx("ui-modal", className)}
          data-wide={wide || undefined}
          aria-describedby={undefined}
          onOpenAutoFocus={onOpenAutoFocus}
          onCloseAutoFocus={(e) => {
            const target = returnFocus?.current ?? returnTo.current;
            if (!target?.isConnected) return;
            e.preventDefault();
            target.focus();
          }}
        >
          <ModalInside
            title={title}
            icon={icon}
            heading={(t) => (
              <Dialog.Title className={cx(titleClass(icon, titleStyle), "ui-modal__title")}>
                {t}
              </Dialog.Title>
            )}
            close={
              <Dialog.Close asChild>
                <IconButton
                  variant="ghost"
                  size="sm"
                  icon={X}
                  label={closeLabel}
                  className="ui-modal__close"
                />
              </Dialog.Close>
            }
          >
            {children}
          </ModalInside>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** A Modal's panel without the dialog behind it, for a static picture
 * (/dev/ui). */
export function ModalPanel({
  title,
  icon,
  titleStyle,
  children,
  closeLabel = "Close",
  wide = false,
  className,
}: ModalBodyProps) {
  return (
    <div className={cx("ui-modal ui-modal--static", className)} data-wide={wide || undefined}>
      <ModalInside
        title={title}
        icon={icon}
        heading={(t) => (
          <span className={cx(titleClass(icon, titleStyle), "ui-modal__title")}>{t}</span>
        )}
        close={
          <IconButton
            variant="ghost"
            size="sm"
            icon={X}
            label={closeLabel}
            className="ui-modal__close"
          />
        }
      >
        {children}
      </ModalInside>
    </div>
  );
}

/** A dialog's body: what the action does, in Body/M on text/secondary. A
 * string is one paragraph; anything else is laid out 12 apart. */
export function ModalBody({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return typeof children === "string" ? (
    <p className={cx("t-body-m ui-modal__body", className)}>{children}</p>
  ) : (
    <div className={cx("t-body-m ui-modal__body", className)}>{children}</div>
  );
}

/** A dialog's actions: Medium buttons 8 apart at the right, Cancel first
 * and the action last (Primary, or Destructive for one Undo can't bring
 * back). */
export function ModalActions({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cx("ui-modal__actions", className)}>{children}</div>;
}

/** Progress steps (Figma 2221:1105): a bar for each step of a run, filled
 * up to the one in hand, over the step's name in Caption/M.
 *
 * With `steps`, the bars count them (1 to max) and the progressbar is
 * named by the status sentence it sits under, speaking the label as its
 * value; the drawn label is then hidden from assistive tech rather than
 * read twice (Generate). Without, `value` is the share done of three
 * steps. */
export function Progress({
  value,
  label,
  steps,
}: {
  value: number;
  label: string;
  steps?: { now: number; max: number; labelledBy: string };
}) {
  const share = Math.min(1, Math.max(0, value));
  const percent = Math.round(share * 100);
  const max = steps?.max ?? 3;
  const done = steps ? Math.min(max, Math.max(0, steps.now)) : Math.round(share * max);
  const aria = steps
    ? {
        "aria-valuemin": 1,
        "aria-valuemax": steps.max,
        "aria-valuenow": steps.now,
        "aria-labelledby": steps.labelledBy,
      }
    : { "aria-valuemin": 0, "aria-valuemax": 100, "aria-valuenow": percent };
  return (
    <div className="ui-progress" role="progressbar" aria-valuetext={label} {...aria}>
      <span className="ui-progress__bars" aria-hidden>
        {Array.from({ length: max }, (_, i) => (
          <span key={i} className="ui-progress__bar" data-done={i < done || undefined} />
        ))}
      </span>
      <span className="t-caption-m ui-progress__label" aria-hidden={steps ? true : undefined}>
        {label}
      </span>
    </div>
  );
}

/** Progress bar (Figma 2215:272): a 4 tall track on surface/field filled
 * in text/primary. Without a `value` it is indeterminate: a part of the
 * fill slides along the track while the length of the work is unknown
 * (Brand Studio's uploads and imports), and stands still under reduced
 * motion. */
export function ProgressBar({ value, label }: { value?: number; label: string }) {
  if (value === undefined) {
    return (
      <div className="ui-progress-bar" role="progressbar" aria-label={label} data-indeterminate>
        <span className="ui-progress-bar__fill" />
      </div>
    );
  }
  const percent = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div
      className="ui-progress-bar"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
    >
      <span className="ui-progress-bar__fill" style={{ width: `${percent}%` }} />
    </div>
  );
}
