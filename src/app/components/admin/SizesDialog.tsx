import React, { useMemo, useState } from "react";
import { Proportions } from "lucide-react";
import type { TemplateSchema } from "@/lib/types";
import type { CanvasSize } from "@/lib/templates/platforms";
import { stores } from "@/lib/stores";
import { familySizeLabels, memberFieldDiff, sameSize } from "@/lib/templates/families";
import { useRouter } from "../../router";
import { Button, Modal, Select, Status } from "../primitives";
import { CanvasSizePicker } from "../builder/CanvasSizePicker";

/** The size family of a template, oldest first: the template alone when it
 * has none. Read from the admin list, which already holds every status. */
export function familyOf(template: TemplateSchema, templates: TemplateSchema[]): TemplateSchema[] {
  if (!template.familyId) return [template];
  return templates
    .filter((t) => t.familyId === template.familyId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** What a member filling `from` would find different in `to`, one line each. */
export function diffLines(from: TemplateSchema, to: TemplateSchema): string[] {
  const diff = memberFieldDiff(from, to);
  return [
    ...diff.onlyInA.map((f) => `No ${f.label} field`),
    ...diff.onlyInB.map((f) => `${f.label} is only in this size`),
    ...diff.changed.map((c) =>
      c.reason === "type"
        ? `${c.field.label} is a different type`
        : `${c.field.label} has different options`,
    ),
  ];
}

function familyErrorMessage(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  return raw.includes("templates_family_size_key")
    ? "This family already has a template at this size. Pick another size, or remove that one from the family first."
    : "Couldn't change this template's sizes. Try again.";
}

/** Sizes (size families, Phase 2): one dialog for a template's family. Each
 * size opens in the builder or leaves the family (never deleted); a new
 * size runs the create-a-version flow; a template of a missing size that
 * belongs to no family can be linked in. */
export function SizesDialog({
  template,
  templates,
  sizes,
  onClose,
  onChanged,
  onAddSize,
}: {
  /** The template the dialog opened from. */
  template: TemplateSchema;
  /** The workspace's templates, every status. */
  templates: TemplateSchema[];
  /** The workspace's enabled sizes. */
  sizes: CanvasSize[];
  onClose(): void;
  /** A link or a removal landed: reload the list. */
  onChanged(): void;
  /** Make a version of `template` at this size. */
  onAddSize(target: { width: number; height: number }): void;
}) {
  const { navigate } = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const members = useMemo(() => familyOf(template, templates), [template, templates]);
  const labels = useMemo(() => familySizeLabels(members), [members]);
  const missingSizes = useMemo(
    () =>
      sizes.filter(
        (s) => !members.some((m) => sameSize(m, { canvasWidth: s.width, canvasHeight: s.height })),
      ),
    [sizes, members],
  );
  const linkable = useMemo(
    () =>
      templates.filter(
        (t) => !t.familyId && t.id !== template.id && !members.some((m) => sameSize(m, t)),
      ),
    [templates, template.id, members],
  );
  const linkableLabels = useMemo(() => familySizeLabels(linkable), [linkable]);

  const change = async (write: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await write();
      onChanged();
    } catch (e) {
      console.error("Changing sizes failed", e);
      setError(familyErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const link = (id: string) =>
    change(() =>
      template.familyId
        ? stores.templates.setFamily([id], template.familyId)
        : stores.templates.setFamily([template.id, id], crypto.randomUUID()),
    );
  const remove = (id: string) => change(() => stores.templates.setFamily([id], null));

  return (
    <Modal open onOpenChange={(open) => !open && onClose()} title="Sizes" icon={Proportions}>
      <ul className="sp-sizes__rows">
        {members.map((m, i) => {
          const lines = m.id === template.id ? [] : diffLines(template, m);
          return (
            <li key={m.id} className="sp-sizes__row">
              <div className="sp-sizes__rowhead">
                <span className="sp-sizes__rowname">
                  <span className="t-label-m">{labels[i]}</span>
                  <Status tone={m.status === "published" ? "active" : "neutral"} size="sm">
                    {m.status === "published" ? "Published" : "Draft"}
                  </Status>
                </span>
                <span className="sp-sizes__rowactions">
                  <Button size="sm" onClick={() => navigate({ name: "builder", templateId: m.id })}>
                    Open
                  </Button>
                  {members.length > 1 && (
                    <Button
                      size="sm"
                      disabled={busy}
                      aria-label={`Remove ${labels[i]} from this template's sizes`}
                      onClick={() => void remove(m.id)}
                    >
                      Remove
                    </Button>
                  )}
                </span>
              </div>
              <span className="t-body-s sp-sizes__name">{m.name}</span>
              {lines.length > 0 && (
                <ul className="sp-sizes__diff">
                  {lines.map((line) => (
                    <li key={line} className="t-body-s">
                      {line}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>

      {error && (
        <p role="alert" className="t-caption-s sp-sizes__error">
          {error}
        </p>
      )}

      {linkable.length > 0 && (
        <section className="sp-sizes__section" aria-labelledby="sp-sizes-link">
          <h3 id="sp-sizes-link" className="t-label-m">
            Link a template
          </h3>
          <Select
            ariaLabel="Link a template"
            value={undefined}
            placeholder="Choose a template"
            disabled={busy}
            options={linkable.map((t, i) => ({
              value: t.id,
              label: `${t.name} · ${linkableLabels[i]}`,
            }))}
            onSelect={(id) => void link(id)}
          />
        </section>
      )}

      <section className="sp-sizes__section" aria-labelledby="sp-sizes-add">
        <h3 id="sp-sizes-add" className="t-label-m">
          Add a size
        </h3>
        <CanvasSizePicker
          sizes={missingSizes}
          value={{ width: template.canvasWidth, height: template.canvasHeight }}
          onPick={onAddSize}
        />
      </section>
    </Modal>
  );
}
