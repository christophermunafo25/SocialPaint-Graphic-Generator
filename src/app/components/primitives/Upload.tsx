import React, { useState } from "react";
import { Image } from "lucide-react";
import { cx, type DemoStateAttr } from "./cx";

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
  "data-demo-state"?: DemoStateAttr;
}

/** Upload (Figma 216:2291): the photo field's control. The whole row is one
 * button that opens the picker (the caller's onClick), and a file dropped
 * on it goes to onDropFile. Empty, a 40 tile with the image icon and the
 * placeholder; filled, the thumbnail, the name (one line) and Replace.
 * Hover and a file dragged over the row lay state/hover over it; keyboard
 * focus rings the row. */
export const Upload = React.forwardRef<HTMLButtonElement, UploadProps>(function Upload(
  {
    placeholder,
    thumbnail,
    fileName,
    replaceLabel = "Replace",
    onDropFile,
    className,
    type = "button",
    "data-demo-state": demoState,
    ...rest
  },
  ref,
) {
  const [dragging, setDragging] = useState(false);
  const filled = Boolean(thumbnail);
  return (
    <button
      ref={ref}
      type={type}
      className={cx("ui-reset ui-tint ui-ring ui-upload", className)}
      data-value={filled ? "filled" : "empty"}
      data-demo-state={dragging ? "hover" : demoState}
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
      {filled ? (
        <>
          <img src={thumbnail ?? undefined} alt="" className="ui-upload__thumb" />
          <span className="t-body-s ui-upload__name">{fileName}</span>
          <span className="t-label-s ui-upload__replace">{replaceLabel}</span>
        </>
      ) : (
        <>
          <span className="ui-upload__tile" aria-hidden>
            <Image size={16} className="ui-icon" />
          </span>
          <span className="t-body-s ui-upload__placeholder">{placeholder}</span>
        </>
      )}
    </button>
  );
});
