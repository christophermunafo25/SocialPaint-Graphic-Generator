import React, { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Copy, Eye, EyeOff, Pencil, Plus, Search, Trash2 } from "lucide-react";
import type { TemplateSchema, UsageSummary } from "@/lib/types";
import { stores } from "@/lib/stores";
import { useAsync } from "@/lib/useAsync";
import { useAuth } from "@/lib/auth/AuthContext";
import { useRouter } from "../../router";
import { Page, PageHeader } from "../layout/Page";
import { ConfirmDialog } from "../ConfirmDialog";
import { ErrorState } from "../ErrorState";
import { TemplateThumbnail } from "../TemplateThumbnail";

type StatusFilter = "all" | "published" | "draft";
type SortKey = "recent" | "name" | "downloads";

const lastUsed = (iso: string | null): string => {
  if (!iso) return "";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
};

/** Admin template list: drafts + published, search/filter/sort, usage on the
 * card, publish toggle, edit, duplicate, delete. */
export function AdminTemplates() {
  const { company } = useAuth();
  const { navigate } = useRouter();
  /** Bumped after mutations so the list reloads through the same hook. */
  const [version, setVersion] = useState(0);
  const reload = () => setVersion((v) => v + 1);
  const templatesState = useAsync(
    () => (company ? stores.templates.listAll(company.id) : Promise.resolve([])),
    [company, version],
  );
  const templates = templatesState.status === "ready" ? templatesState.data : [];

  // Usage rides along so revise-or-retire decisions don't need Insights.
  // If it's slow or fails, cards render without the usage line.
  const usageState = useAsync<UsageSummary | null>(
    () => (company ? stores.usage.getUsageSummary(company.id) : Promise.resolve(null)),
    [company, version],
  );
  const usageByTemplate = useMemo(() => {
    const rows = usageState.status === "ready" ? usageState.data?.rows ?? [] : [];
    return new Map(rows.map((r) => [r.templateId, r]));
  }, [usageState]);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortKey>("recent");

  const publishedCount = templates.filter((t) => t.status === "published").length;
  const draftCount = templates.length - publishedCount;

  const visible = useMemo(() => {
    let list =
      statusFilter === "all" ? templates : templates.filter((t) => t.status === statusFilter);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q) ||
          t.tags.some((tag) => tag.toLowerCase().includes(q)),
      );
    }
    const sorted = [...list];
    if (sort === "name") sorted.sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === "downloads")
      sorted.sort(
        (a, b) =>
          (usageByTemplate.get(b.id)?.downloads ?? 0) - (usageByTemplate.get(a.id)?.downloads ?? 0),
      );
    // "recent" keeps the store order (updatedAt desc on both backends).
    return sorted;
  }, [templates, statusFilter, query, sort, usageByTemplate]);

  const toggleStatus = async (t: TemplateSchema) => {
    await stores.templates.setStatus(t.id, t.status === "published" ? "draft" : "published");
    reload();
  };

  /** Template pending delete confirmation. */
  const [deleting, setDeleting] = useState<TemplateSchema | null>(null);

  const confirmDelete = async () => {
    if (!deleting) return;
    await stores.templates.delete(deleting.id);
    setDeleting(null);
    reload();
  };

  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  const duplicateTemplate = async (t: TemplateSchema) => {
    // "<name> copy", then "<name> copy 2", 3, … on collision.
    const names = new Set(templates.map((x) => x.name));
    const base = `${t.name} copy`;
    let name = base;
    for (let n = 2; names.has(name); n++) name = `${base} ${n}`;
    try {
      const copy = await stores.templates.duplicate(t.id, name);
      setToast("Duplicated.");
      reload();
      // The person duplicating is about to edit it — the toast covers the hop.
      toastTimer.current = window.setTimeout(
        () => navigate({ name: "builder", templateId: copy.id }),
        600,
      );
    } catch (e) {
      console.error("Duplicate failed", e);
      setToast("Couldn't duplicate. Try again.");
      toastTimer.current = window.setTimeout(() => setToast(null), 4000);
    }
  };

  return (
    <Page>
      {toast && (
        <div className="sp-toast" role="status" aria-live="polite">
          <CheckCircle2 style={{ width: 16, height: 16, color: "var(--success)", flexShrink: 0, marginTop: 1 }} />
          <span style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)" }}>{toast}</span>
        </div>
      )}
      <ConfirmDialog
        open={deleting !== null}
        title={`Delete template "${deleting?.name ?? ""}"?`}
        description="This cannot be undone."
        confirmLabel="Delete template"
        onCancel={() => setDeleting(null)}
        onConfirm={() => void confirmDelete()}
      />
      <PageHeader
        title="Templates"
        description="Create, edit, and publish — published templates appear in your team's Brand templates."
        action={
          <button className="sp-btn sp-btn-primary" onClick={() => navigate({ name: "builder", templateId: null })}>
            <Plus style={{ width: 13, height: 13 }} />
            New template
          </button>
        }
      />

      {templatesState.status === "ready" && templates.length > 0 && (
        <div className="flex flex-wrap items-center mb-6" style={{ gap: 12 }}>
          <div className="relative" style={{ width: 420, maxWidth: "100%" }}>
            <Search
              className="absolute"
              style={{ left: 12, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, color: "var(--fg-3)", zIndex: 1 }}
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search templates…"
              aria-label="Search templates"
              className="sp-input"
              style={{ height: 40, padding: "0 12px 0 34px", fontSize: 13 }}
            />
          </div>
          <div
            className="flex rounded-lg overflow-hidden"
            role="group"
            aria-label="Filter by status"
            style={{ border: "1px solid var(--hairline-strong)", height: 40 }}
          >
            {(
              [
                ["all", `All ${templates.length}`],
                ["published", `Published ${publishedCount}`],
                ["draft", `Drafts ${draftCount}`],
              ] as [StatusFilter, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setStatusFilter(key)}
                aria-pressed={statusFilter === key}
                className="px-3 flex items-center"
                style={{
                  fontSize: 12,
                  ...(statusFilter === key
                    ? { background: "var(--ink)", color: "var(--fg-on-dark-1)" }
                    : { background: "var(--lift)", color: "var(--fg-2)" }),
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            aria-label="Sort templates"
            className="sp-input"
            style={{ width: "auto", height: 40, padding: "0 10px", fontSize: 12 }}
          >
            <option value="recent">Recently edited</option>
            <option value="name">Name</option>
            <option value="downloads">Most downloaded</option>
          </select>
        </div>
      )}

      {templatesState.status === "loading" ? (
        <p className="text-center py-20" style={{ fontSize: 13, color: "var(--fg-3)" }}>Loading…</p>
      ) : templatesState.status === "error" ? (
        <ErrorState
          title="We couldn't load your templates."
          detail="Check your connection and try again."
          onRetry={templatesState.retry}
        />
      ) : templates.length === 0 ? (
        <div
          className="text-center py-24"
          style={{ border: "1.5px dashed var(--hairline-strong)", borderRadius: "var(--radius-card)" }}
        >
          <p style={{ fontFamily: "var(--font-display)", fontWeight: 800, textTransform: "uppercase" as const, fontSize: 16, color: "var(--ink)", marginBottom: 6 }}>
            Create your first template
          </p>
          <p className="max-w-md mx-auto" style={{ fontSize: 13, color: "var(--fg-2)" }}>
            Upload a PNG or import a Figma frame, map the editable fields, and publish it for your team.
          </p>
        </div>
      ) : visible.length === 0 ? (
        <p className="text-center py-20" style={{ fontSize: 14, color: "var(--fg-2)" }}>
          {query.trim()
            ? "No templates match that search."
            : statusFilter === "draft"
              ? "No drafts."
              : "Nothing published yet."}
        </p>
      ) : (
        <div className="sp-grid-media">
          {visible.map((t) => {
            const iconBtn: React.CSSProperties = {
              width: 32,
              height: 32,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            };
            return (
            <div key={t.id} className="sp-card sp-media-card flex flex-col">
              <button
                onClick={() => navigate({ name: "builder", templateId: t.id })}
                className="sp-media-card__preview"
                aria-label={`Edit ${t.name}`}
              >
                <div
                  style={{
                    aspectRatio: `${t.canvasWidth} / ${t.canvasHeight}`,
                    ...(t.canvasWidth / t.canvasHeight >= 4 / 3 ? { width: "100%" } : { height: "100%" }),
                  }}
                >
                  <TemplateThumbnail template={t} />
                </div>
              </button>
              <div style={{ padding: "12px 2px 4px" }}>
                {/* Line 1: title + icon action row on the same line */}
                <div className="flex items-center" style={{ gap: 8 }}>
                  <p className="truncate flex-1 min-w-0" style={{ fontSize: 14, fontWeight: 500, color: "var(--ink)" }}>{t.name}</p>
                  <button style={iconBtn} onClick={() => void toggleStatus(t)} title={t.status === "published" ? "Unpublish" : "Publish"}>
                    {t.status === "published" ? (
                      <EyeOff style={{ width: 16, height: 16, color: "var(--fg-3)" }} />
                    ) : (
                      <Eye style={{ width: 16, height: 16, color: "var(--solar)" }} />
                    )}
                  </button>
                  <button style={iconBtn} onClick={() => navigate({ name: "builder", templateId: t.id })} title="Edit">
                    <Pencil style={{ width: 16, height: 16, color: "var(--fg-3)" }} />
                  </button>
                  <button style={iconBtn} onClick={() => void duplicateTemplate(t)} title="Duplicate">
                    <Copy style={{ width: 16, height: 16, color: "var(--fg-3)" }} />
                  </button>
                  <button style={iconBtn} onClick={() => setDeleting(t)} title="Delete">
                    <Trash2 style={{ width: 16, height: 16, color: "var(--danger)" }} />
                  </button>
                </div>
                {/* Line 2: status */}
                <span
                  className="sp-eyebrow inline-block"
                  style={t.status === "published" ? { color: "var(--success)" } : undefined}
                >
                  {t.status}
                </span>
                {/* Line 3: meta */}
                {usageState.status === "ready" && (
                  <p style={{ fontSize: 11, color: "var(--fg-3)", marginTop: 2 }}>
                    {(() => {
                      const u = usageByTemplate.get(t.id);
                      if (!u || u.downloads === 0) return "Not used yet";
                      return `${u.downloads} download${u.downloads === 1 ? "" : "s"} · last used ${lastUsed(u.lastUsedAt)}`;
                    })()}
                  </p>
                )}
              </div>
            </div>
            );
          })}
        </div>
      )}
    </Page>
  );
}
