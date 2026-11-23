import React, { useLayoutEffect, useRef, useState } from "react";
import { Image } from "lucide-react";
import { cx, type DemoStateAttr } from "./cx";
import { useDelayedFlag } from "./motion";

export interface UploadProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "children" | "onDrop"
> {
  /** Empty: Add plus the label with its article ("Add a photo"). */
  placeholder: string;
  /** Filled: the picked photo, as its thumbnail. */
  thumbnail?: string | null;
  /** Filled: the picked file's or brand image's name. */
  fileName?: string;
  replaceLabel?: string;
  /** A file dropped on the row takes the same road as one picked. */
  onDropFile?(file: File): void;
  /** The picked file is uploading: aria-busy, and past 400 ms the tile
   * pulses as a skeleton until the photo is ready. */
  busy?: boolean;
  "data-demo-state"?: DemoStateAttr;
}

/** Upload (Figma 2211:278): the photo field's control. The whole row is one
 * button that opens the picker (the caller's onClick), and a file dropped
 * on it goes to onDropFile. Empty, a 40 tile with the image icon and the
 * placeholder; filled, the thumbnail, the name (one line) and Replace.
 * The row rests on the field's hairline, and hover and a file dragged over
 * it darken the edge; keyboard focus rings the row. A new photo develops
 * in, and a slow upload (`busy` past 400 ms) pulses the tile. */
export const Upload = React.forwardRef<HTMLButtonElement, UploadProps>(function Upload(
  {
    placeholder,
    thumbnail,
    fileName,
    replaceLabel = "Replace",
    onDropFile,
    busy = false,
    className,
    type = "button",
    "data-demo-state": demoState,
    ...rest
  },
  ref,
) {
  const [dragging, setDragging] = useState(false);
  const filled = Boolean(thumbnail);
  const pulsing = useDelayedFlag(busy);
  // A photo picked or dropped after mount develops in once it has decoded
  // (PROMPT.md section 7.6); one there at first paint is simply there.
  const firstThumb = useRef(thumbnail);
  const [pending, setPending] = useState<string | null>(null);
  useLayoutEffect(() => {
    if (!thumbnail || thumbnail === firstThumb.current) return;
    firstThumb.current = null;
    setPending(thumbnail);
  }, [thumbnail]);
  const settle = (img: HTMLImageElement) => {
    if (pending !== img.getAttribute("src")) return;
    const reveal = () => requestAnimationFrame(() => setPending(null));
    if (typeof img.decode === "function") img.decode().then(reveal, reveal);
    else reveal();
  };
  return (
    <button
      ref={ref}
      type={type}
      className={cx("ui-reset ui-fill ui-ring ui-upload", className)}
      data-value={filled ? "filled" : "empty"}
      data-demo-state={dragging ? "hover" : demoState}
      aria-busy={busy || undefined}
      onDragOver={(e) => {
        if (!onDropFile || !e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        if (!onDropFile) return;
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) onDropFile(file);
      }}
      {...rest}
    >
      {pulsing ? (
        <>
          <span className="ui-skeleton ui-upload__pulse" aria-hidden />
          <span className="t-body-m ui-upload__placeholder">{fileName ?? placeholder}</span>
        </>
      ) : filled ? (
        <>
          <img
            src={thumbnail ?? undefined}
            alt=""
            className="ui-upload__thumb"
            data-pending={pending === thumbnail || undefined}
            onLoad={(e) => settle(e.currentTarget)}
            onError={() => setPending(null)}
          />
          <span className="t-body-m ui-upload__name">{fileName}</span>
          <span className="t-label-s ui-upload__replace">{replaceLabel}</span>
        </>
      ) : (
        <>
          <span className="ui-upload__tile" aria-hidden>
            <Image size={16} className="ui-icon" />
          </span>
          <span className="t-body-m ui-upload__placeholder">{placeholder}</span>
        </>
      )}
    </button>
  );
});
