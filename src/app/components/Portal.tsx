import React, { useMemo, useState } from "react";
import { ArrowRight, Search } from "lucide-react";
import { stores } from "@/lib/stores";
import { useAsync } from "@/lib/useAsync";
import { useAuth } from "@/lib/auth/AuthContext";
import { useRouter } from "../router";
import { ErrorState } from "./ErrorState";
import { TemplateThumbnail } from "./TemplateThumbnail";

/** Member-facing, company-scoped searchable template grid. SocialPaint
 * platform chrome: signature warm mesh hero, lift cards on hairlines,
 * sentence case, mono metadata. Tenant brand lives in the thumbnails. */
export function Portal() {
  const { company, role } = useAuth();
  const { navigate } = useRouter();
  const [query, setQuery] = useState("");
  const templatesState = useAsync(
    () => (company ? stores.templates.listPublished(company.id) : Promise.resolve([])),
    [company],
  );
  const templates = templatesState.status === "ready" ? templatesState.data : [];

  const filtered = useMemo(() => {
    if (!query.trim()) return templates;
    const q = query.toLowerCase();
    return templates.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        t.tags.some((tag) => tag.toLowerCase().includes(q)),
    );
  }, [templates, query]);

  return (
    <div>
      {/* Header — flat on the canvas; comfortable clearance from the sidebar */}
      <div className="max-w-7xl mx-auto px-8 sm:px-12 pt-12 pb-2">
        <p className="sp-eyebrow mb-3">{company?.name}</p>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 800,
            textTransform: "uppercase",
            fontSize: "clamp(22px, 3.2vw, 36px)",
            letterSpacing: "-0.03em",
            lineHeight: 0.95,
            color: "var(--ink)",
            marginBottom: 10,
          }}
        >
          Brand templates
        </h1>
        <p style={{ fontFamily: "var(--font-body)", color: "var(--fg-2)", fontSize: 15, maxWidth: 420, marginBottom: 24 }}>
          Pick a template, fill in the details, and download a ready-to-post on-brand graphic.
        </p>
        <div className="relative max-w-md">
          <Search className="absolute" style={{ left: 14, top: "50%", transform: "translateY(-50%)", width: 15, height: 15, color: "var(--fg-3)", zIndex: 1 }} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search templates…"
            aria-label="Search templates"
            className="sp-input"
            style={{ padding: "10px 14px 10px 38px" }}
          />
        </div>
      </div>

      {/* Grid */}
      <div className="max-w-7xl mx-auto px-8 sm:px-12 py-10">
        {templatesState.status === "loading" ? (
          <p className="text-center py-20" style={{ fontSize: 13, color: "var(--fg-3)" }}>
            Loading templates…
          </p>
        ) : templatesState.status === "error" ? (
          <ErrorState
            title="We couldn't load your templates."
            detail="Check your connection and try again."
            onRetry={templatesState.retry}
          />
        ) : templates.length === 0 ? (
          <div className="text-center py-20 space-y-3">
            <p style={{ fontSize: 14, color: "var(--fg-2)" }}>No templates published yet.</p>
            {role === "admin" && (
              <button className="sp-btn sp-btn-primary" onClick={() => navigate({ name: "adminTemplates" })}>
                Create your first template
              </button>
            )}
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center py-20" style={{ fontSize: 14, color: "var(--fg-2)" }}>
            No templates match “{query}”.
          </p>
        ) : (
          <>
            <div className="flex items-center justify-between mb-6">
              <p className="sp-eyebrow">
                {filtered.length} template{filtered.length !== 1 ? "s" : ""}
              </p>
              <p style={{ fontSize: 12, color: "var(--fg-3)" }}>Click a template to get started</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filtered.map((t) => (
                <button
                  key={t.id}
                  onClick={() => navigate({ name: "template", templateId: t.id })}
                  aria-label={t.category ? `${t.name} — ${t.category}` : t.name}
                  className="sp-flipcard-scene group text-left"
                >
                  <div className="sp-flipcard">
                    {/* Front — the card as it was */}
                    <div className="sp-flipcard__face sp-flipcard__face--front">
                      <div
                        className="w-full overflow-hidden"
                        style={{ aspectRatio: `${t.canvasWidth} / ${t.canvasHeight}`, background: "var(--paper-warm)" }}
                      >
                        <TemplateThumbnail template={t} />
                      </div>
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-3 mb-1.5">
                          <div>
                            {t.category && <p className="sp-eyebrow mb-1">{t.category}</p>}
                            <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 800, textTransform: "uppercase" as const, fontSize: 16, letterSpacing: "-0.2px", color: "var(--ink)" }}>
                              {t.name}
                            </h2>
                          </div>
                          <span
                            className="flex items-center justify-center flex-shrink-0 rounded-full"
                            style={{ width: 30, height: 30, background: "var(--peach)" }}
                          >
                            <ArrowRight style={{ width: 14, height: 14, color: "var(--ink)" }} />
                          </span>
                        </div>
                        {t.description && (
                          <p style={{ fontSize: 13, lineHeight: 1.5, color: "var(--fg-2)", marginBottom: 10 }}>{t.description}</p>
                        )}
                        <div className="flex flex-wrap gap-1.5">
                          {t.fields.map((f) => (
                            <span
                              key={f.id}
                              style={{
                                fontFamily: "var(--font-mono)",
                                fontSize: 10,
                                letterSpacing: "0.3px",
                                color: "var(--fg-2)",
                                background: "rgba(35,31,35,0.05)",
                                padding: "2px 7px",
                                borderRadius: 5,
                              }}
                            >
                              {f.label}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    {/* Back — the invitation */}
                    <div className="sp-flipcard__face sp-flipcard__face--back" aria-hidden>
                      {t.category && <p className="sp-eyebrow">{t.category}</p>}
                      <p style={{ fontFamily: "var(--font-display)", fontWeight: 800, textTransform: "uppercase" as const, fontSize: 20, letterSpacing: "-0.3px", lineHeight: 1.05, color: "var(--ink)" }}>
                        {t.name}
                      </p>
                      <span className="sp-btn sp-btn-primary" style={{ pointerEvents: "none" }}>
                        Use template
                        <ArrowRight style={{ width: 14, height: 14 }} />
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
