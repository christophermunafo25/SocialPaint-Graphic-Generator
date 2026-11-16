import React from "react";
import { Frame, Paintbrush, PencilRuler, Plus } from "lucide-react";
import { Modal } from "../primitives";
import type { IconComponent } from "../primitives/cx";

/** The four ways a template starts. */
export type StartPath = "blank" | "figma" | "build" | "canva";

const PATHS: Array<{
  id: StartPath;
  icon: IconComponent;
  label: string;
  description: string;
}> = [
  {
    id: "blank",
    icon: Plus,
    label: "Start blank",
    description: "An empty canvas at the size you choose",
  },
  {
    id: "figma",
    icon: Frame,
    label: "Import from Figma",
    description: "A frame with every layer in place",
  },
  {
    id: "build",
    icon: PencilRuler,
    label: "Auto build",
    description: "From a design link or an image",
  },
  {
    id: "canva",
    icon: Paintbrush,
    label: "Import from Canva",
    description: "A shared design from Canva",
  },
];

/** New template (329:2660): a 520 dialog of the four ways a template
 * starts, each an Option Tile drawn as an action (the icon, then its name
 * in Label/M over a line in Caption/M). Choosing one closes this and opens
 * its next step: Choose a size, or the import's own dialog.
 *
 * The imports need the Supabase backend, so the dev backend offers Start
 * blank alone. Import from Canva shows once the workspace's plan has
 * Canva. */
export function NewTemplateDialog({
  open,
  onOpenChange,
  importReady,
  canvaEnabled,
  onChoose,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
  importReady: boolean;
  canvaEnabled: boolean;
  onChoose(path: StartPath): void;
}) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="New template"
      titleStyle="card"
      className="sp-tb-dialog"
    >
      <div className="sp-new-paths">
        {PATHS.filter(
          (p) => p.id === "blank" || (importReady && (p.id !== "canva" || canvaEnabled)),
        ).map(({ id, icon: Icon, label, description }) => (
          <button
            key={id}
            type="button"
            className="ui-reset ui-tint ui-ring sp-new-path"
            onClick={() => onChoose(id)}
          >
            <Icon size={16} className="ui-icon" aria-hidden />
            <span className="sp-new-path__text">
              <span className="t-label-m">{label}</span>
              <span className="t-caption-m sp-new-path__description">{description}</span>
            </span>
          </button>
        ))}
      </div>
    </Modal>
  );
}
