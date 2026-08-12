import React, { useEffect, useRef, useState } from "react";
import { Figma, RefreshCw, Sparkles, Upload, X } from "lucide-react";
import type { AutoBuildResult, DesignSource } from "@/lib/types";
import { stores } from "@/lib/stores";
import { useAuth } from "@/lib/auth/AuthContext";
import { useFileDrop } from "@/lib/useFileDrop";

interface AutoBuildDialogProps {
  onClose(): void;
  onBuilt(result: AutoBuildResult): void;
}

type Tab = "figma" | "canva" | "image";

/** The call runs 15–40 seconds; a bare spinner reads as broken. These mirror
 * the engine's real stages: extract → decide → write. */
const STAGES = [
  "Reading the design…",
  "Deciding what should be editable…",
  "Writing labels and the caption…",
];

const MANUAL_PATHS_NOTE =
  "The plain Figma import and the blank canvas are unaffected — you can always build this one manually.";

/** Auto-build with Claude: paste a Figma or Canva link, or upload a flat
 * image, and Claude proposes the whole template — Fixed marks, labels,
 * guardrails, brand bindings, metadata, caption. The proposal lands on the
 * canvas as real fields; there is no confirmation screen (the admin corrects
 * in the inspector, in context). Modeled on FigmaImportDialog's shell. */
export function AutoBuildDialog({ onClose, onBuilt }: AutoBuildDialogProps) {
  const { company } = useAuth();
  const [tab, setTab] = useState<Tab>("figma");
  const [figmaConnected, setFigmaConnected] = useState<boolean | null>(null);
  const [canva, setCanva] = useState<{ enabled: boolean; connected: boolean } | null>(null);
  const [url, setUrl] = useState("");
  const [hint, setHint] = useState("");
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState(0);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stageTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!company) return;
    stores.designImport
      .isConnected(company.id)
      .then(setFigmaConnected)
      .catch(() => setFigmaConnected(false));
    stores.designImport
      .canvaStatus(company.id)
      .then(setCanva)
      .catch(() => setCanva({ enabled: false, connected: false }));
  }, [company]);

  useEffect(() => () => window.clearInterval(stageTimer.current), []);

  const run = async (source: DesignSource) => {
    if (!company) return;
    setBusy(true);
    setError(null);
    setStage(0);
    stageTimer.current = window.setInterval(
      () => setStage((s) => Math.min(s + 1, STAGES.length - 1)),
      9000,
    );
    try {
      const result = await stores.designImport.autoBuild(
        company.id,
        source,
        hint.trim() || undefined,
      );
      onBuilt(result);
    } catch (e) {
      setError(`${e instanceof Error ? e.message : "Auto-build failed."} ${MANUAL_PATHS_NOTE}`);
    } finally {
      window.clearInterval(stageTimer.current);
      setBusy(false);
    }
  };

  const runImage = async (file: File) => {
    if (!company) return;
    if (!/^image\/(png|jpeg)$/.test(file.type)) {
      setError("Upload a PNG or JPEG.");
      return;
    }
    setUploadingImage(true);
    setError(null);
    try {
      const backgroundUrl = await stores.templates.uploadBackground(company.id, file, file.name);
      // Natural dimensions read client-side — the canvas is exactly the image.
      const dims = await new Promise<{ w: number; h: number }>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
        img.onerror = () => reject(new Error("Couldn't read the image."));
        img.src = URL.createObjectURL(file);
      });
      setUploadingImage(false);
      await run({ kind: "image", backgroundUrl, canvasWidth: dims.w, canvasHeight: dims.h });
    } catch (e) {
      setUploadingImage(false);
      setError(`${e instanceof Error ? e.message : "Upload failed."} ${MANUAL_PATHS_NOTE}`);
    }
  };

  const connectCanva = async () => {
    if (!company) return;
    setError(null);
    try {
      const { authorizeUrl } = await stores.designImport.canvaConnectStart(
        company.id,
        `${window.location.origin}/?canva_oauth=1`,
      );
      window.location.assign(authorizeUrl); // returns via the app's callback handler
    } catch (e) {
      setError(`${e instanceof Error ? e.message : "Canva connect failed."} ${MANUAL_PATHS_NOTE}`);
    }
  };

  const drop = useFileDrop((files) => {
    if (files[0]) void runImage(files[0]);
  });

  const tabButton = (key: Tab, label: string, disabled = false, title?: string) => (
    <button
      key={key}
      onClick={() => !disabled && setTab(key)}
      disabled={disabled}
      title={title}
      aria-pressed={tab === key}
      className="flex-1 py-1.5"
      data-radius-control
      style={{
        fontSize: "var(--type-label-size)",
        background: tab === key ? "var(--accent-wash)" : "transparent",
        color: disabled
          ? "var(--text-disabled)"
          : tab === key
            ? "var(--text-primary)"
            : "var(--text-secondary)",
        border: "1px solid",
        borderColor: tab === key ? "var(--border-strong)" : "transparent",
        cursor: disabled ? "default" : "pointer",
      }}
    >
      {label}
    </button>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg p-6 space-y-4"
        style={{ background: "var(--bg-surface)", borderRadius: "var(--radius-card)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2
            className="flex items-center gap-2"
            style={{
              fontFamily: "var(--font-head)",
              fontWeight: "var(--weight-head)",
              fontSize: 21,
              letterSpacing: "-0.01em",
              color: "var(--text-primary)",
            }}
          >
            <Sparkles className="w-5 h-5" style={{ color: "var(--state-primary)" }} />
            Auto-build with Claude
          </h2>
          <button onClick={onClose} aria-label="Close">
            <X className="w-5 h-5" style={{ color: "var(--muted-foreground)" }} />
          </button>
        </div>

        {busy ? (
          <div className="py-8 text-center space-y-3" role="status" aria-live="polite">
            <RefreshCw
              className="w-5 h-5 animate-spin mx-auto"
              style={{ color: "var(--state-primary)" }}
            />
            <p style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>
              {STAGES[stage]}
            </p>
            <p style={{ fontSize: "var(--type-caption-size)", color: "var(--text-muted)" }}>
              This takes 15–40 seconds. Everything lands editable-or-fixed on the canvas — change
              anything in the inspector.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-1.5" role="tablist" aria-label="Design source">
              {tabButton("figma", "Figma link")}
              {tabButton(
                "canva",
                "Canva link",
                !canva?.enabled,
                canva?.enabled ? undefined : "Coming soon",
              )}
              {tabButton("image", "Upload an image")}
            </div>

            {tab === "figma" && (
              <div className="space-y-3">
                {figmaConnected === false ? (
                  <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
                    Figma isn't connected yet — connect it from the plain "Import from Figma" dialog
                    first, then come back. {MANUAL_PATHS_NOTE}
                  </p>
                ) : (
                  <>
                    <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
                      Paste a frame link. Claude reads the design, decides what members should edit,
                      names every field, and writes the caption — then you correct anything in the
                      inspector.
                    </p>
                    <input
                      type="url"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://www.figma.com/design/…?node-id=…"
                      className="sp-input"
                      aria-label="Figma frame link"
                    />
                  </>
                )}
              </div>
            )}

            {tab === "canva" && canva?.enabled && (
              <div className="space-y-3">
                {!canva.connected ? (
                  <>
                    <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
                      Connect your Canva account to read designs. Each admin authorizes with their
                      own Canva login; the tokens are stored server-side and never reach this
                      browser again.
                    </p>
                    <button
                      onClick={() => void connectCanva()}
                      className="sp-btn sp-btn-primary w-full"
                    >
                      Connect Canva
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
                      Paste a Canva design link. Elements Canva reports as locked arrive Fixed;
                      unlocked text arrives editable.
                    </p>
                    <p
                      className="px-3 py-2"
                      data-radius-control
                      style={{
                        fontSize: "var(--type-caption-size)",
                        background: "var(--bg-hover)",
                        color: "var(--text-secondary)",
                      }}
                    >
                      Canva templates import with the original artwork still visible behind editable
                      text — give editable text a fill or a background shape behind it.
                    </p>
                    <input
                      type="url"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://www.canva.com/design/…"
                      className="sp-input"
                      aria-label="Canva design link"
                    />
                  </>
                )}
              </div>
            )}

            {tab === "image" && (
              <div className="space-y-3">
                <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
                  Upload a finished design as PNG or JPEG. With no layer data to read, Claude
                  proposes conservative field boxes from the image alone — expect to adjust them.
                </p>
                <label
                  {...drop.bind}
                  data-active={drop.active}
                  className="sp-dropzone flex items-center justify-center gap-2 cursor-pointer py-6"
                  style={{
                    border: "1.5px dashed var(--border-strong)",
                    borderRadius: "var(--radius-control)",
                    fontSize: "var(--type-caption-size)",
                    color: "var(--text-secondary)",
                  }}
                >
                  {uploadingImage ? (
                    <RefreshCw
                      className="w-4 h-4 animate-spin"
                      style={{ color: "var(--state-primary)" }}
                    />
                  ) : (
                    <Upload
                      className="sp-dropzone__icon w-4 h-4"
                      style={{ color: "var(--state-primary)" }}
                    />
                  )}
                  {uploadingImage ? "Uploading…" : "Drop a PNG or JPEG, or click to browse"}
                  <input
                    type="file"
                    accept="image/png,image/jpeg"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void runImage(f);
                    }}
                  />
                </label>
              </div>
            )}

            {tab !== "canva" && (
              <div>
                <label className="sp-eyebrow block mb-1" htmlFor="autobuild-hint">
                  Anything Claude should know?{" "}
                  <span style={{ textTransform: "none", color: "var(--text-disabled)" }}>
                    optional
                  </span>
                </label>
                <input
                  id="autobuild-hint"
                  className="sp-input"
                  value={hint}
                  maxLength={500}
                  onChange={(e) => setHint(e.target.value)}
                  placeholder='e.g. "The date and location change weekly; the rest is fixed"'
                />
              </div>
            )}

            {tab === "canva" && canva?.enabled && canva.connected && (
              <button
                onClick={() => void run({ kind: "canva", url: url.trim() })}
                disabled={!url.trim()}
                className="sp-btn sp-btn-primary w-full"
              >
                Auto-build from Canva
              </button>
            )}

            {tab === "figma" && figmaConnected !== false && (
              <button
                onClick={() => void run({ kind: "figma", url: url.trim() })}
                disabled={!url.trim() || figmaConnected === null}
                className="sp-btn sp-btn-primary w-full"
              >
                <Figma className="w-4 h-4" />
                {figmaConnected === null ? "Checking connection…" : "Auto-build from Figma"}
              </button>
            )}
          </>
        )}

        {error && (
          <p
            className="text-sm px-4 py-3"
            data-radius-card
            style={{ background: "var(--danger-wash)", color: "var(--destructive)" }}
          >
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
