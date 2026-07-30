import { useState } from "react";

/** Turns any element (usually an upload <label>) into a drag-and-drop target
 * with an `active` flag for the .sp-dropzone highlight. Spread `bind` onto
 * the element and set data-active={active}. Click-to-pick keeps working —
 * this only ADDS the drop path. */
export function useFileDrop(onFiles: (files: File[]) => void): {
  active: boolean;
  bind: {
    onDragOver: (e: React.DragEvent) => void;
    onDragLeave: () => void;
    onDrop: (e: React.DragEvent) => void;
  };
} {
  const [active, setActive] = useState(false);
  return {
    active,
    bind: {
      onDragOver: (e) => {
        if (!e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        setActive(true);
      },
      onDragLeave: () => setActive(false),
      onDrop: (e) => {
        e.preventDefault();
        setActive(false);
        const files = Array.from(e.dataTransfer.files);
        if (files.length) onFiles(files);
      },
    },
  };
}
