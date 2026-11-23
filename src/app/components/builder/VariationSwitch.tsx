import React, { useState } from "react";
import { Pencil, Plus, Star, Trash2 } from "lucide-react";
import type { TemplateVariant } from "@/lib/types";
import {
  Button,
  Field,
  IconButton,
  Input,
  Modal,
  ModalActions,
  RowMenu,
  SegmentedControl,
} from "../primitives";

/** The variations, floating over the top of the stage (322:403): a raised
 * capsule with a segment for each look, then Add a variation. The selected
 * look's menu holds Rename, Make default and Delete (the frame draws no
 * menu; the filmstrip it replaces held all three). A template with one look
 * shows Add a variation alone (325:484). */
export function VariationSwitch({
  variants,
  selectedId,
  onSelect,
  onAdd,
  onRename,
  onRemove,
  onSetDefault,
}: {
  variants: TemplateVariant[];
  selectedId: string | undefined;
  onSelect(id: string): void;
  onAdd(): void;
  onRename(id: string, name: string): void;
  onRemove(id: string): void;
  onSetDefault(id: string): void;
}) {
  const [renaming, setRenaming] = useState<TemplateVariant | null>(null);
  const [name, setName] = useState("");

  if (variants.length < 2) {
    return (
      <div className="sp-stage-looks">
        <Button kind="neutral" size="sm" icon={Plus} onClick={onAdd}>
          Add a variation
        </Button>
      </div>
    );
  }

  const selected = variants.find((v) => v.id === selectedId) ?? variants[0];

  return (
    <div className="sp-stage-looks">
      <SegmentedControl
        aria-label="Variation"
        options={variants.map((v) => ({ id: v.id, label: v.name }))}
        selectedId={selected.id}
        onSelect={onSelect}
      />
      <IconButton variant="ghost" size="sm" icon={Plus} label="Add a variation" onClick={onAdd} />
      <RowMenu
        label={`More actions for ${selected.name}`}
        groups={[
          {
            items: [
              {
                label: "Rename",
                icon: Pencil,
                movesFocus: true,
                onSelect: () => {
                  setName(selected.name);
                  setRenaming(selected);
                },
              },
              {
                label: "Make default",
                icon: Star,
                disabled: Boolean(selected.isDefault),
                onSelect: () => onSetDefault(selected.id),
              },
            ],
          },
          { items: [{ label: "Delete", icon: Trash2, onSelect: () => onRemove(selected.id) }] },
        ]}
      />
      {renaming && (
        <Modal
          open
          onOpenChange={(next) => !next && setRenaming(null)}
          title="Rename variation"
          titleStyle="card"
          className="sp-tb-dialog"
        >
          <form
            className="sp-tb-dialog__form"
            onSubmit={(e) => {
              e.preventDefault();
              const next = name.trim();
              if (next) onRename(renaming.id, next);
              setRenaming(null);
            }}
          >
            <Field label="Name">
              <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </Field>
            <ModalActions>
              <Button kind="neutral" onClick={() => setRenaming(null)}>
                Cancel
              </Button>
              <Button kind="primary" type="submit" disabled={!name.trim()}>
                Rename
              </Button>
            </ModalActions>
          </form>
        </Modal>
      )}
    </div>
  );
}
