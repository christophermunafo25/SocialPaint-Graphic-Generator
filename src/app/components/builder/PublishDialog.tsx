import React, { useRef, useState } from "react";
import { Link } from "lucide-react";
import type { TemplateField, TemplateSchema } from "@/lib/types";
import type { LimitOverflow } from "@/lib/templates/publishChecks";
import { TemplateThumbnail } from "../TemplateThumbnail";
import { Button, Field, Input, Modal, ModalActions, ModalBody } from "../primitives";
import { CaptionEditor } from "./CaptionEditor";

const DEFAULT_NAME = "Untitled template";

/** The template's details, edited live in the draft (undoable, autosaved)
 * the way the builder's other text edits are. */
export interface PublishDetails {
  name: string;
  captionTemplate: string;
  category: string;
  tags: string[];
  description: string;
}

/** Publish template (326:1233): the graphic on the left; on the right its
 * name, the caption with a chip for each field, category and tags, the
 * description, and any field whose limit runs past its box. A template
 * needs a real name to publish. */
export function PublishDialog({
  schema,
  details,
  fields,
  onDetails,
  overflows,
  onShowField,
  busy,
  republish,
  onPublish,
  onClose,
}: {
  /** The draft as it renders, for the preview. */
  schema: TemplateSchema;
  details: PublishDetails;
  fields: TemplateField[];
  onDetails(patch: Partial<PublishDetails>): void;
  overflows: LimitOverflow[];
  /** Close and select that field on the canvas. */
  onShowField(fieldId: string): void;
  busy: boolean;
  /** Already published: this publishes its changes. */
  republish: boolean;
  onPublish(): void;
  onClose(): void;
}) {
  const nameInput = useRef<HTMLInputElement>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  // Tags type as one line and save as a list; the line is kept as typed, so
  // a comma isn't swallowed before the next tag starts.
  const [tagsText, setTagsText] = useState(details.tags.join(", "));

  const submit = () => {
    if (busy) return;
    const name = details.name.trim();
    if (!name || name === DEFAULT_NAME) {
      setNameError("Name the template before you publish.");
      nameInput.current?.focus();
      return;
    }
    onPublish();
  };

  return (
    <Modal
      open
      onOpenChange={(next) => !next && !busy && onClose()}
      title="Publish template"
      titleStyle="card"
      className="sp-publish-dialog"
      onOpenAutoFocus={(e) => {
        e.preventDefault();
        nameInput.current?.focus();
      }}
    >
      <div className="sp-publish">
        <div className="sp-publish__preview" aria-hidden>
          <span
            className="sp-publish__art"
            style={
              { "--fit-ratio": schema.canvasWidth / schema.canvasHeight } as React.CSSProperties
            }
          >
            <TemplateThumbnail template={schema} />
          </span>
        </div>
        <form
          className="sp-publish__form"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <Field label="Name" error={nameError}>
            <Input
              ref={nameInput}
              value={details.name}
              onChange={(e) => {
                setNameError(null);
                onDetails({ name: e.target.value });
              }}
              onFocus={(e) => {
                // The default is a placeholder, not a choice: typing replaces it.
                if (e.target.value.trim() === DEFAULT_NAME) e.target.select();
              }}
            />
          </Field>
          <CaptionEditor
            value={details.captionTemplate}
            fields={fields}
            onChange={(captionTemplate) => onDetails({ captionTemplate })}
          />
          <div className="sp-publish__pair">
            <Field label="Category">
              <Input
                value={details.category}
                onChange={(e) => onDetails({ category: e.target.value })}
              />
            </Field>
            <Field label="Tags">
              <Input
                value={tagsText}
                onChange={(e) => {
                  setTagsText(e.target.value);
                  onDetails({
                    tags: e.target.value
                      .split(",")
                      .map((t) => t.trim())
                      .filter(Boolean),
                  });
                }}
              />
            </Field>
          </div>
          <Field label="Description" optional>
            <Input
              value={details.description}
              onChange={(e) => onDetails({ description: e.target.value })}
            />
          </Field>
          {overflows.map((o) => (
            <div key={o.fieldId} className="sp-publish__warning" role="status">
              <span className="t-body-s">{`${o.label} runs past its box at ${o.maxLength} characters`}</span>
              <button
                type="button"
                className="ui-reset ui-ring t-label-s sp-publish__show"
                aria-label={`Show ${o.label}`}
                onClick={() => onShowField(o.fieldId)}
              >
                Show
              </button>
            </div>
          ))}
          <ModalActions>
            <Button kind="neutral" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button
              kind="primary"
              type="submit"
              aria-disabled={busy || undefined}
              aria-busy={busy || undefined}
            >
              {busy ? "Publishing…" : republish ? "Publish changes" : "Publish"}
            </Button>
          </ModalActions>
        </form>
      </div>
    </Modal>
  );
}

/** Template published (326:1742): where it went, then a public link for it
 * or Done, which leaves you in the builder. */
export function PublishedDialog({
  name,
  onPublicLink,
  onDone,
}: {
  name: string;
  onPublicLink(): void;
  onDone(): void;
}) {
  return (
    <Modal
      open
      onOpenChange={(next) => !next && onDone()}
      title="Template published"
      titleStyle="card"
      className="sp-published-dialog"
    >
      <ModalBody>{`${name} is live in Brand Templates for your team.`}</ModalBody>
      <ModalActions>
        <Button kind="neutral" icon={Link} onClick={onPublicLink}>
          Create a public link
        </Button>
        <Button kind="primary" onClick={onDone}>
          Done
        </Button>
      </ModalActions>
    </Modal>
  );
}
