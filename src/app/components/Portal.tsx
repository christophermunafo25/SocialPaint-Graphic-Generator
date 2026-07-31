import React, { useMemo, useState } from "react";
import { ArrowRight, Search } from "lucide-react";
import { stores } from "@/lib/stores";
import { useAsync } from "@/lib/useAsync";
import { useAuth } from "@/lib/auth/AuthContext";
import { useRouter } from "../router";
import { Page, PageHeader } from "./layout/Page";
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
    <Page>
      <PageHeader
        eyebrow={company?.name}
        title="Brand templates"
        description="Pick a template, fill in the details, and download a ready-to-post on-brand graphic."
      />
      <div className="relative" style={{ maxWidth: 420, marginBottom: 24 }}>
        <Search className="absolute" style={{ left: 14, top: "50%", transform: "translateY(-50%)", width: 15, height: 15, color: "var(--text-muted)", zIndex: 1 }} />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search templates…"
          aria-label="Search templates"
          className="sp-input"
          style={{ height: 40, padding: "0 14px 0 38px" }}
        />
      </div>

      <div>
        {templatesState.status === "loading" ? (
          <p className="text-center py-20" style={{ fontSize: 13, color: "var(--text-muted)" }}>
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
            <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>No templates published yet.</p>
            {role === "admin" && (
              <button className="sp-btn sp-btn-primary" onClick={() => navigate({ name: "adminTemplates" })}>
                Create your first template
              </button>
            )}
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center py-20" style={{ fontSize: 14, color: "var(--text-secondary)" }}>
            No templates match “{query}”.
          </p>
        ) : (
          <>
            <div className="flex items-center justify-between mb-6">
              <p className="sp-eyebrow">
                {filtered.length} template{filtered.length !== 1 ? "s" : ""}
              </p>
              <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Click a template to get started</p>
            </div>
            <div className="sp-grid-media">
              {filtered.map((t) => (
                <button
                  key={t.id}
                  onClick={() => navigate({ name: "template", templateId: t.id })}
                  aria-label={t.category ? `${t.name} — ${t.category}` : t.name}
                  className="sp-flipcard-scene group text-left"
                >
                  <div className="sp-flipcard">
                    {/* Front — the card as it was */}
                    <div className="sp-flipcard__face sp-flipcard__face--front sp-media-card">
                      <div className="sp-media-card__preview">
                        {/* Cover, not contain: the artwork FILLS the frame
                            (edges crop on the mismatched axis). */}
                        <div
                          style={{
                            aspectRatio: `${t.canvasWidth} / ${t.canvasHeight}`,
                            flexShrink: 0,
                            // Pin the SHORT axis so the artwork overflows the
                            // square frame on the long one and crops there.
                            ...(t.canvasWidth / t.canvasHeight >= 1
                              ? { height: "100%" }
                              : { width: "100%" }),
                          }}
                        >
                          <TemplateThumbnail template={t} />
                        </div>
                      </div>
                      <div style={{ padding: "12px 2px 4px" }}>
                        {t.category && <p className="sp-eyebrow mb-1">{t.category}</p>}
                        <h2 style={{ fontFamily: "var(--font-head-sm)", fontWeight: 700, fontSize: 14, letterSpacing: "-0.2px", color: "var(--text-primary)" }}>
                          {t.name}
                        </h2>
                        {t.description && (
                          <p style={{ fontSize: 13, lineHeight: 1.5, color: "var(--text-secondary)", marginTop: 6 }}>{t.description}</p>
                        )}
                      </div>
                    </div>
                    {/* Back — the invitation, on the brand's deep green */}
                    <div className="sp-flipcard__face sp-flipcard__face--back sp-mesh" aria-hidden>
                      {t.category && <p className="sp-eyebrow">{t.category}</p>}
                      <p style={{ fontFamily: "var(--font-head-sm)", fontWeight: 700, fontSize: 16, letterSpacing: "-0.3px", lineHeight: 1.05 }}>
                        {t.name}
                      </p>
                      <span className="sp-btn sp-btn-solar" style={{ pointerEvents: "none" }}>
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
    </Page>
  );
}
