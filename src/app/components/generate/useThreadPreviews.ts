import { useCallback, useEffect, useRef, useState } from "react";
import { designToSchema } from "@/lib/generate/designToSchema";
import { stores } from "@/lib/stores";
import type {
  FieldValues,
  GenerateThreadPreview,
  GenerateThreadSummary,
  TemplateSchema,
} from "@/lib/types";

/** What a chat's card paints (RecentCard, HistoryCard): the draft, once
 * there is a schema to render it with, and the width over height of its
 * canvas, for the card's placeholder box until then. */
export interface ChatCardPreview {
  preview: { schema: TemplateSchema; values: FieldValues } | null;
  /** Undefined when the chat made no draft (the stage stays bare). */
  aspect?: number;
}

const NONE: ChatCardPreview = { preview: null };

/** Width over height of a stored canvas; undefined for a degenerate one. */
function aspectOf(canvas: { width: number; height: number }): number | undefined {
  const ratio = canvas.width / canvas.height;
  return Number.isFinite(ratio) && ratio > 0 ? ratio : undefined;
}

/**
 * The previews of saved chats' cards (PROMPT.md §7.17, §7.18, §9.8): each
 * summary's `preview` is the first draft of its first finished turn, with
 * its values (never a photo: nothing stored holds one) and its canvas.
 *
 *  - A library draft paints with its template, fetched once per template
 *    however many chats use it, and only when a card first needs it. A
 *    template that is gone, no longer published, or fails to load paints
 *    nothing: the card keeps its placeholder box at the stored canvas's
 *    shape, as a reopened chat keeps the draft's card (a failure is retried
 *    the next time the list grows).
 *  - A freestyle draft rebuilds from its stored design (designToSchema),
 *    once per summary object, so a thumbnail does not re-render every time
 *    the list grows. It paints at once.
 *
 * Empty image slots take the thumbnail's placeholder portrait, as every
 * card does. Returns a lookup for the current render.
 */
export function useThreadPreviews(
  companyId: string | null,
  chats: readonly GenerateThreadSummary[],
): (chat: GenerateThreadSummary) => ChatCardPreview {
  // Library templates by id: the schema, or null when it is gone or failed.
  // Absent while it loads.
  const [templates, setTemplates] = useState<ReadonlyMap<string, TemplateSchema | null>>(
    () => new Map(),
  );
  const requested = useRef(new Set<string>());
  const designs = useRef(new WeakMap<GenerateThreadPreview, TemplateSchema>());

  useEffect(() => {
    const wanted = new Set<string>();
    for (const chat of chats) {
      const id = chat.preview && !chat.preview.design ? chat.preview.templateId : undefined;
      if (id && !requested.current.has(id)) wanted.add(id);
    }
    if (wanted.size === 0) return;
    for (const id of wanted) requested.current.add(id);
    // One state update per batch, however many templates it holds: every
    // card re-renders on an update, and a page brings up to twelve.
    void Promise.all(
      [...wanted].map((id) =>
        stores.templates.get(id).then(
          (t) => [id, t && t.status === "published" ? t : null] as const,
          (e: unknown) => {
            console.error("Load failed", e);
            requested.current.delete(id);
            return [id, null] as const;
          },
        ),
      ),
    ).then((entries) =>
      setTemplates((prev) => {
        const next = new Map(prev);
        for (const [id, t] of entries) next.set(id, t);
        return next;
      }),
    );
  }, [chats]);

  return useCallback(
    (chat: GenerateThreadSummary): ChatCardPreview => {
      const p = chat.preview;
      if (!p) return NONE;
      const aspect = aspectOf(p.canvas);
      if (p.design) {
        let schema = designs.current.get(p);
        if (!schema && companyId) {
          // The stored meta has no model or time for a preview; a
          // thumbnail records nothing, so neither is read.
          schema = designToSchema(p.design, companyId, 1, {
            model: "",
            generatedAt: chat.createdAt,
          });
          designs.current.set(p, schema);
        }
        return { preview: schema ? { schema, values: p.values } : null, aspect };
      }
      const schema = p.templateId ? templates.get(p.templateId) : null;
      return { preview: schema ? { schema, values: p.values } : null, aspect };
    },
    [companyId, templates],
  );
}
