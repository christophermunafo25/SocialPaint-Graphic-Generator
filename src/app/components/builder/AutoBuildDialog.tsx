import React, { useEffect, useRef, useState } from "react";
import { PencilRuler } from "lucide-react";
import type { AutoBuildResult, DesignImportResult, DesignSource } from "@/lib/types";
import { stores } from "@/lib/stores";
import { useAuth } from "@/lib/auth/AuthContext";
import { useRouter } from "../../router";
import {
  Button,
  Field,
  Input,
  Modal,
  ModalActions,
  Progress,
  SegmentedControl,
  TextArea,
  Upload,
} from "../primitives";
import { useStillOpen } from "./useStillOpen";

type Tab = "figma" | "canva" | "image";

/** What a build is doing, in the engine's own order: it reads the design,
 * decides what members edit, then names the fields and writes the caption.
 * The call runs 15 to 40 seconds and reports nothing until it ends, so the
 * steps move on a timer; their names are the engine's. */
export const BUILD_STAGES = [
  "Reading the design",
  "Choosing what to edit",
  "Writing labels and the caption",
];
const STAGE_MS = 9000;

/** The step a build is on, while it runs. */
export function useBuildStage(busy: boolean): number {
  const [stage, setStage] = useState(0);
  useEffect(() => {
    if (!busy) return;
    setStage(0);
    const id = window.setInterval(
      () => setStage((s) => Math.min(s + 1, BUILD_STAGES.length - 1)),
      STAGE_MS,
    );
    return () => window.clearInterval(id);
  }, [busy]);
  return stage;
}

/** A build in progress (329:4286): the Progress steps across the dialog,
 * "2 of 3 · Choosing what to edit", then Cancel alone. Cancel closes the
 * dialog and the result is dropped when it lands. The steps sit in a
 * status region, so each new step is read out. */
export function BuildProgress({ stage, onCancel }: { stage: number; onCancel(): void }) {
  return (
    <div className="sp-tb-dialog__form">
      <div role="status" aria-live="polite">
        <Progress
          value={(stage + 1) / BUILD_STAGES.length}
          label={`${stage + 1} of ${BUILD_STAGES.length} · ${BUILD_STAGES[stage]}`}
        />
      </div>
      <ModalActions>
        <Button kind="neutral" onClick={onCancel}>
          Cancel
        </Button>
      </ModalActions>
    </div>
  );
}

const readImageSize = (url: string) =>
  new Promise<{ width: number; height: number }>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error("We couldn't read that image."));
    img.src = url;
  });

interface AutoBuildDialogProps {
  onClose(): void;
  onBuilt(result: AutoBuildResult | DesignImportResult): void | Promise<void>;
  /** Where focus goes when it closes (New template's opener). */
  returnFocus?: React.RefObject<HTMLElement | null>;
}

/** Auto build (329:3981): a Figma or Canva link, or a flat image, and
 * Claude proposes the whole template: what stays fixed, labels, limits,
 * brand bindings, details and the caption. It lands on the canvas as real
 * fields, corrected in the inspector; there is no review screen. The
 * source is a Segmented Control across the dialog, then the design's link
 * (or the image), the optional note, and Cancel and Build template. */
export function AutoBuildDialog({ onClose, onBuilt, returnFocus }: AutoBuildDialogProps) {
  const { company } = useAuth();
  const { navigate } = useRouter();
  const [tab, setTab] = useState<Tab>("figma");
  const [figmaConnected, setFigmaConnected] = useState<boolean | null>(null);
  const [canva, setCanva] = useState<{ enabled: boolean; connected: boolean } | null>(null);
  const [links, setLinks] = useState<Record<"figma" | "canva", string>>({ figma: "", canva: "" });
  const [image, setImage] = useState<{
    file: File;
    url: string;
    width: number;
    height: number;
  } | null>(null);
  const [hint, setHint] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stage = useBuildStage(busy);
  const stillOpen = useStillOpen();
  const fileInput = useRef<HTMLInputElement>(null);
  const firstControl = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!company) return;
    let cancelled = false;
    stores.designImport
      .isConnected(company.id)
      .then((c) => !cancelled && setFigmaConnected(c))
      .catch(() => !cancelled && setFigmaConnected(false));
    stores.designImport
      .canvaStatus(company.id)
      .then((s) => !cancelled && setCanva(s))
      .catch(() => !cancelled && setCanva({ enabled: false, connected: false }));
    return () => {
      cancelled = true;
    };
  }, [company]);

  // The picked image's preview URL is released when it's replaced or the
  // dialog closes.
  useEffect(
    () => () => {
      if (image) URL.revokeObjectURL(image.url);
    },
    [image],
  );

  const pickImage = async (file: File) => {
    setError(null);
    if (!/^image\/(png|jpeg)$/.test(file.type)) {
      setError("Use a PNG or JPEG.");
      return;
    }
    const url = URL.createObjectURL(file);
    try {
      const size = await readImageSize(url);
      setImage({ file, url, ...size });
    } catch (e) {
      URL.revokeObjectURL(url);
      setError(e instanceof Error ? e.message : "We couldn't read that image.");
    }
  };

  const notConnected =
    tab === "figma"
      ? figmaConnected === false
      : tab === "canva"
        ? canva !== null && !(canva.enabled && canva.connected)
        : false;
  const checking = tab === "figma" ? figmaConnected === null : tab === "canva" && canva === null;
  const ready = tab === "image" ? image !== null : links[tab].trim() !== "" && !checking;

  const run = async () => {
    if (!company || busy || !ready) return;
    setError(null);
    setBusy(true);
    try {
      let source: DesignSource;
      if (tab === "image") {
        if (!image) return;
        const backgroundUrl = await stores.templates.uploadBackground(
          company.id,
          image.file,
          image.file.name,
        );
        // The canvas is exactly the image.
        source = {
          kind: "image",
          backgroundUrl,
          canvasWidth: image.width,
          canvasHeight: image.height,
        };
      } else {
        source = { kind: tab, url: links[tab].trim() };
      }
      const result = await stores.designImport.autoBuild(
        company.id,
        source,
        hint.trim() || undefined,
      );
      if (!stillOpen.current) return;
      await onBuilt(result);
    } catch (e) {
      if (stillOpen.current)
        setError(e instanceof Error ? e.message : "That design didn't build. Try again.");
    } finally {
      if (stillOpen.current) setBusy(false);
    }
  };

  const service = tab === "figma" ? "Figma" : "Canva";

  return (
    <Modal
      open
      onOpenChange={(next) => !next && onClose()}
      title="Auto build"
      icon={PencilRuler}
      className="sp-tb-dialog"
      returnFocus={returnFocus}
      onOpenAutoFocus={(e) => {
        if (!firstControl.current) return;
        e.preventDefault();
        firstControl.current.focus();
      }}
    >
      {busy ? (
        <BuildProgress stage={stage} onCancel={onClose} />
      ) : (
        <form
          className="sp-tb-dialog__form"
          onSubmit={(e) => {
            e.preventDefault();
            void run();
          }}
        >
          <SegmentedControl
            aria-label="Design source"
            options={[
              { id: "figma", label: "Figma link" },
              { id: "canva", label: "Canva link" },
              { id: "image", label: "Image" },
            ]}
            selectedId={tab}
            onSelect={(id) => {
              setTab(id as Tab);
              setError(null);
            }}
            className="sp-tb-dialog__source"
          />
          {notConnected ? (
            <p className="t-body-m sp-tb-dialog__note">{`${service} isn't connected for this workspace.`}</p>
          ) : tab === "image" ? (
            <Field label="Image" error={error}>
              <Upload
                placeholder="Add an image"
                thumbnail={image?.url ?? null}
                fileName={image?.file.name}
                aria-label={image ? `Image: ${image.file.name}. Replace` : "Image: Add an image"}
                onClick={() => fileInput.current?.click()}
                onDropFile={(file) => void pickImage(file)}
              />
            </Field>
          ) : (
            <Field label="Design link" error={error}>
              <Input
                ref={firstControl}
                type="url"
                value={links[tab]}
                onChange={(e) => setLinks((l) => ({ ...l, [tab]: e.target.value }))}
                placeholder={tab === "figma" ? "figma.com/design/…" : "canva.com/design/…"}
                autoComplete="off"
                spellCheck={false}
              />
            </Field>
          )}
          {!notConnected && (
            <Field label="Anything to know about this design?" optional>
              <TextArea
                value={hint}
                maxLength={500}
                onChange={(e) => setHint(e.target.value)}
                placeholder="The date and location change every week"
              />
            </Field>
          )}
          <input
            ref={fileInput}
            type="file"
            accept="image/png,image/jpeg"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void pickImage(file);
            }}
          />
          <ModalActions>
            <Button kind="neutral" onClick={onClose}>
              Cancel
            </Button>
            {notConnected ? (
              <Button
                kind="primary"
                onClick={() => {
                  onClose();
                  navigate({ name: "settings", section: "integrations" });
                }}
              >
                Open settings
              </Button>
            ) : (
              <Button kind="primary" type="submit" disabled={!ready}>
                Build template
              </Button>
            )}
          </ModalActions>
        </form>
      )}
    </Modal>
  );
}
