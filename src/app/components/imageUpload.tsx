import React, { useCallback, useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { downscaleImage } from "@/lib/render/downscaleImage";

// ---------------------------------------------------------------------------
// The member photo upload pipeline, shared by every surface that takes one
// (the fill page's image fields, the Generate composer's photo well). One
// accept map, one size cap, one downscale, one rejection voice, one chip
// animation — extracted from FieldInput so the surfaces cannot drift.
// ---------------------------------------------------------------------------

/** Hard cap on member photo uploads — referenced in the rejection copy. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB

/** Uploads are downscaled to this long edge before anything else. Templates
 * render at schema canvas size (1440 today), so anything past 2048 costs
 * memory in three places (original, crop, double toPng) and adds no visible
 * quality. */
export const MAX_UPLOAD_EDGE_PX = 2048;

/** The react-dropzone accept map every photo dropzone shares. */
export const UPLOAD_ACCEPT = { "image/*": [".png", ".jpg", ".jpeg", ".webp"] };

export const rejectionMessage = (code: string | undefined): string => {
  switch (code) {
    case "file-too-large":
      return "That image is over 10MB. Try a smaller one.";
    case "file-invalid-type":
      return "That file type isn't supported. Use a JPG, PNG, or WEBP.";
    case "too-many-files":
      return "Please add one image at a time.";
    default:
      return "We couldn't read that file. Try a different image.";
  }
};

/** Read a picked file and downscale it to the standard long edge. The result
 * is a data URL — it lives in page state and never leaves the browser. */
export function readAndDownscale(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      downscaleImage(reader.result as string, MAX_UPLOAD_EDGE_PX)
        .then(resolve)
        .catch(reject);
    };
    reader.onerror = () => reject(new Error("read failed"));
    reader.readAsDataURL(file);
  });
}

/** A data URL's width over height, measured from the decoded pixels. */
export function imageAspectOf(dataUrl: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img.naturalWidth / img.naturalHeight);
    img.onerror = () => reject(new Error("decode failed"));
    img.src = dataUrl;
  });
}

/** Transient processing chip under a dropzone — filename, an ease-out
 * progress pass, a done tick, then it leaves as the surface takes over.
 * Motion timings from the BYQ drop-zone gem; every colour is a platform
 * token, and the gem's shimmer gradient and bar glow are omitted (the DS
 * bans gradient surfaces and shadows). */
export interface UploadChip {
  name: string;
  progress: number;
  done: boolean;
  leaving: boolean;
}

/** The chip lifecycle: 900ms ease-out cubic progress → 120ms pause → done
 * row (0.25s in) → chip-out (0.28s). Reduced motion jumps straight to done
 * and leaves without travel. The progress never lies: the last 2% holds
 * until the real work lands. */
export function useUploadChip(): {
  chip: UploadChip | null;
  runChip: (name: string, processing: Promise<void>) => void;
  clearChip: () => void;
} {
  const [chip, setChip] = useState<UploadChip | null>(null);
  const chipRafRef = useRef<number | null>(null);
  const chipTimersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  useEffect(
    () => () => {
      if (chipRafRef.current !== null) cancelAnimationFrame(chipRafRef.current);
      chipTimersRef.current.forEach(clearTimeout);
    },
    [],
  );

  const runChip = useCallback((name: string, processing: Promise<void>) => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timers = chipTimersRef.current;
    setChip({ name, progress: reduced ? 100 : 0, done: false, leaving: false });

    const finish = () => {
      timers.push(
        setTimeout(
          () => {
            setChip((c) => (c ? { ...c, done: true } : c));
            timers.push(
              setTimeout(() => {
                setChip((c) => (c ? { ...c, leaving: true } : c));
                timers.push(setTimeout(() => setChip(null), reduced ? 0 : 290));
              }, 600),
            );
          },
          reduced ? 80 : 120,
        ),
      );
    };

    if (reduced) {
      void processing.finally(finish);
      return;
    }
    const start = performance.now();
    let settled = false;
    void processing.finally(() => {
      settled = true;
    });
    const step = (now: number) => {
      const t = Math.min((now - start) / 900, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setChip((c) => (c && !c.done ? { ...c, progress: eased * 100 } : c));
      if (t < 1 || !settled) {
        // Hold the last 2% until the real work lands — never a done lie.
        if (t >= 1 && !settled) {
          setChip((c) => (c && !c.done ? { ...c, progress: 98 } : c));
        }
        chipRafRef.current = requestAnimationFrame(step);
      } else {
        chipRafRef.current = null;
        setChip((c) => (c ? { ...c, progress: 100 } : c));
        finish();
      }
    };
    chipRafRef.current = requestAnimationFrame(step);
  }, []);

  const clearChip = useCallback(() => setChip(null), []);

  return { chip, runChip, clearChip };
}

/** The chip's markup — render whenever `chip` is non-null. The done label
 * names what happens next ("Ready to crop" on a field that opens the
 * cropper; plain "Ready" where nothing does). */
export function UploadChipView({
  chip,
  doneLabel = "Ready",
}: {
  chip: UploadChip;
  doneLabel?: string;
}) {
  return (
    <div
      className={
        chip.leaving ? "sp-upload-chip sp-upload-chip--leave" : "sp-upload-chip sp-chip-in"
      }
      aria-live="polite"
    >
      <span className="sp-upload-chip__name">{chip.name}</span>
      {chip.done ? (
        <span className="sp-upload-chip__done">
          <Check aria-hidden style={{ width: 12, height: 12 }} />
          {doneLabel}
        </span>
      ) : (
        <span className="sp-upload-chip__track" aria-hidden>
          <span className="sp-upload-chip__bar" style={{ width: `${chip.progress}%` }} />
        </span>
      )}
    </div>
  );
}
