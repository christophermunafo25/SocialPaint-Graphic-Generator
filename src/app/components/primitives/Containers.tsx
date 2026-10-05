import React, { useLayoutEffect, useRef } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cx, type IconComponent } from "./cx";
import { IconButton } from "./IconButton";

/** Card (Figma 58:476): an Insights card, title and subtitle over its
 * content. */
export function Card({
  title,
  subtitle,
  children,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cx("ui-card", className)}>
      <header className="ui-card__header">
        <h2 className="t-title-panel">{title}</h2>
        {subtitle && <p className="t-caption-m ui-card__subtitle">{subtitle}</p>}
      </header>
      {children}
    </section>
  );
}

/** Settings card (Figma 58:460): a settings section, its title and an
 * optional header action (a Button) over its rows. */
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
    <section className={cx("ui-card ui-settings-card", className)}>
      <header className="ui-settings-card__header">
        <h2 className="t-title-panel">{title}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}

/** Stat (Figma 59:449): a small label over a value. */
export function Stat({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <div className="ui-stat">
      <span className="t-label-xs ui-stat__label">{label}</span>
      <span className="t-body-s">{value}</span>
    </div>
  );
}

/** Metric (Figma 59:452): a large number with its label. */
export function Metric({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <div className="ui-metric">
      <span className="t-label-l">{label}</span>
      <span className="t-title-metric">{value}</span>
    </div>
  );
}

interface ModalBodyProps {
  title: React.ReactNode;
  icon?: IconComponent;
  children?: React.ReactNode;
  closeLabel?: string;
}

export interface ModalProps extends ModalBodyProps {
  open: boolean;
  onOpenChange(open: boolean): void;
}

/** Modal (Figma 58:484) on Radix dialog: over overlay/scrim (the component
 * draws none; PHASE-2 §8), focus held inside, Escape and the close button
 * close it and hand focus back. */
export function Modal({
  open,
  onOpenChange,
  title,
  icon: Icon,
  children,
  closeLabel = "Close",
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
          className="ui-modal"
          aria-describedby={undefined}
          onCloseAutoFocus={(e) => {
            if (!returnTo.current?.isConnected) return;
            e.preventDefault();
            returnTo.current.focus();
          }}
        >
          <div className="ui-modal__header">
            <div className="ui-modal__title">
              {Icon && <Icon size={18} className="ui-icon" aria-hidden />}
              <Dialog.Title className="t-title-card">{title}</Dialog.Title>
            </div>
            <Dialog.Close asChild>
              <IconButton icon={X} label={closeLabel} />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** A Modal's panel without the dialog behind it, for a static picture
 * (/dev/ui). */
export function ModalPanel({ title, icon: Icon, children, closeLabel = "Close" }: ModalBodyProps) {
  return (
    <div className="ui-modal ui-modal--static">
      <div className="ui-modal__header">
        <div className="ui-modal__title">
          {Icon && <Icon size={18} className="ui-icon" aria-hidden />}
          <span className="t-title-card">{title}</span>
        </div>
        <IconButton icon={X} label={closeLabel} />
      </div>
      {children}
    </div>
  );
}

/** Progress (Figma 58:450): step progress under the generating message.
 * With `steps`, the bar counts steps (1 to max) and is named by the status
 * sentence it sits under, speaking the label as its value; the drawn label
 * is then hidden from assistive tech rather than read twice (Generate). */
export function Progress({
  value,
  label,
  steps,
}: {
  value: number;
  label: string;
  steps?: { now: number; max: number; labelledBy: string };
}) {
  const percent = Math.round(Math.min(1, Math.max(0, value)) * 100);
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
      <span className="ui-progress__track">
        <span className="ui-progress__fill" style={{ width: `${percent}%` }} />
      </span>
      <span className="t-label-xs ui-progress__label" aria-hidden={steps ? true : undefined}>
        {label}
      </span>
    </div>
  );
}

/** Progress bar (Figma 58:451): import progress. */
export function ProgressBar({ value, label }: { value: number; label: string }) {
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
