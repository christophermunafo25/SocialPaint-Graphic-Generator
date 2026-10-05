import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import type { BrandAsset } from "@/lib/types";
import type { ChatDocument, ChatPhoto } from "@/lib/generate/chat";
import { DocumentReadError, readDocument } from "@/lib/generate/documentText";
import { downscaleImage } from "@/lib/render/downscaleImage";
import { loadDataUrl } from "@/lib/render/useDataUrl";
import {
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_EDGE_PX,
  UPLOAD_ACCEPT,
  imageAspectOf,
  readAndDownscale,
  rejectionMessage,
  useUploadChip,
} from "../imageUpload";

/** The textarea grows with its text to this many lines, then scrolls. */
const MAX_LINES = 6;

/** A file the pipeline refuses before reading it, as a react-dropzone
 * error code for rejectionMessage: the dropzone's own checks for the paths
 * that bypass it (a paste, the native picker). Null when it is fine. */
const fileProblem = (file: File): string | null =>
  !/^image\/(png|jpe?g|webp)$/.test(file.type)
    ? "file-invalid-type"
    : file.size > MAX_UPLOAD_BYTES
      ? "file-too-large"
      : null;

export interface ComposerProps {
  value: string;
  onChange(next: string): void;
  /** The photo waiting to go with the next message. One per message:
   * attaching another replaces it. */
  photo: ChatPhoto | null;
  onPhotoChange(next: ChatPhoto | null): void;
  /** The document waiting to go with the next message, read in the
   * browser (PROMPT §12.3). One per message: attaching another replaces
   * it. Without a handler the File row's picks are ignored. */
  document?: ChatDocument | null;
  onDocumentChange?(next: ChatDocument | null): void;
  /** A run is in flight: Send is Stop, and the text stays editable. */
  running: boolean;
  /** Only called with non-empty trimmed text, not running, not disabled,
   * and with no photo or document still being read. */
  onSubmit(): void;
  onStop(): void;
  placeholder: string;
  textareaRef?: React.Ref<HTMLTextAreaElement>;
  /** Nothing more can be sent (the chat is full, PROMPT §9.8): the
   * textarea, Send, Attach and the toolbar's controls are inert. Stop
   * stays live while a run is in flight. */
  disabled?: boolean;
}

/**
 * The Composer's behaviour (chat/ChatComposer.tsx draws it, Figma 61:504).
 *
 * Enter sends and Shift+Enter breaks the line (not mid-composition, so an
 * IME's Enter still picks its candidate). The textarea grows with its text
 * to six lines, then scrolls. Send is ready when the trimmed text is
 * non-empty, nothing is running and no photo is still being read, and Stop
 * while a run is in flight; the text stays editable through a run.
 *
 * The photo pipeline is FieldInput's, from the shared module: pasting an
 * image anywhere in the card, dropping one on it, the native picker and a
 * Brand Studio pick all go through the same accept list, size cap,
 * downscale, rejection copy and upload chip, and land as one ChatPhoto
 * with its measured aspect. The photo is a data URL in page memory and
 * never leaves the browser: this hands it to its owner and does nothing
 * else with it. No crop here: the drafts' photo slots have different
 * aspects, and the editor crops at the real slot's. When two attaches
 * overlap, the later one wins (and a removal cancels the one in flight),
 * so a slow read can never overwrite a newer choice.
 *
 * A document (the File row) is read here too, in the browser, into its
 * text (documentText.ts): nothing uploads. It shares the upload chip while
 * it is read, and a refused one says why under the text and attaches
 * nothing. Files alone never make a message: Send needs text.
 */
export function useComposer({
  value,
  photo,
  onPhotoChange,
  running,
  onSubmit,
  onStop,
  placeholder,
  textareaRef,
  disabled = false,
  document: doc = null,
  onDocumentChange,
}: ComposerProps) {
  const [photoError, setPhotoError] = useState<string | null>(null);
  const { chip, runChip, clearChip } = useUploadChip();
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  // Bumped by every attach and every removal; a read that finishes under
  // an older number has been overtaken and is dropped.
  const attachSeq = useRef(0);
  // A photo is still being read. Send waits for it: a message sent in the
  // meantime would go without the photo the member just attached, and the
  // photo would then land on the next message instead. Documents alike.
  const [readingPhoto, setReading] = useState(false);
  const [readingDoc, setReadingDoc] = useState(false);
  const reading = readingPhoto || readingDoc;
  const docSeq = useRef(0);
  // The latest handlers, for a read that finishes after a re-render.
  const onPhotoChangeRef = useRef(onPhotoChange);
  onPhotoChangeRef.current = onPhotoChange;
  const onDocumentChangeRef = useRef(onDocumentChange);
  onDocumentChangeRef.current = onDocumentChange;
  // A read that lands after its composer has gone (New chat swaps the
  // thread's composer for the Start state's) belonged to a chat that is no
  // longer on screen, and is dropped.
  useEffect(
    () => () => {
      attachSeq.current += 1;
      docSeq.current += 1;
    },
    [],
  );

  const setTextarea = useCallback(
    (el: HTMLTextAreaElement | null) => {
      inputRef.current = el;
      if (typeof textareaRef === "function") textareaRef(el);
      else if (textareaRef) {
        (textareaRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = el;
      }
    },
    [textareaRef],
  );

  // ── The photo pipeline ──────────────────────────────────────────────────
  const attach = useCallback(
    (
      name: string,
      read: () => Promise<string>,
      origin: Pick<ChatPhoto, "source" | "assetId">,
      failure: string,
    ) => {
      const seq = ++attachSeq.current;
      setReading(true);
      const processing = read()
        .then(async (dataUrl) => {
          const aspect = await imageAspectOf(dataUrl);
          if (seq !== attachSeq.current) return;
          setReading(false);
          setPhotoError(null);
          onPhotoChangeRef.current({ dataUrl, aspect, ...origin });
        })
        .catch((e: unknown) => {
          console.error("Photo decode failed", e);
          if (seq === attachSeq.current) {
            setReading(false);
            setPhotoError(failure);
          }
          throw e instanceof Error ? e : new Error(String(e));
        });
      processing.catch(() => clearChip());
      runChip(name, processing);
    },
    [runChip, clearChip],
  );

  /** A file from a paste, a drop or the picker. The drop has already been
   * through the dropzone's checks; the other two are checked here. */
  const takeFile = useCallback(
    (file: File, source: ChatPhoto["source"]) => {
      const problem = fileProblem(file);
      if (problem) {
        setPhotoError(rejectionMessage(problem));
        return;
      }
      attach(file.name, () => readAndDownscale(file), { source }, rejectionMessage(undefined));
    },
    [attach],
  );

  /** A Brand Studio logo or image: fetched as a data URL through the
   * canvas's own cache, then downscaled to the upload edge like a file,
   * exactly as FieldInput takes one. */
  const takeAsset = useCallback(
    (asset: BrandAsset) =>
      attach(
        asset.name,
        () => loadDataUrl(asset.url).then((d) => downscaleImage(d, MAX_UPLOAD_EDGE_PX)),
        { source: "brand", assetId: asset.id },
        // FieldInput's copy for the same failure.
        "We couldn't load that brand image. Try again, or upload a file.",
      ),
    [attach],
  );

  /** A document from the File row: read in the browser into its text. A
   * refusal (type, size, no text) says why and attaches nothing. */
  const takeDocument = useCallback(
    (file: File) => {
      if (!onDocumentChangeRef.current) return;
      const seq = ++docSeq.current;
      setReadingDoc(true);
      const processing = readDocument(file).then(
        (read) => {
          if (seq !== docSeq.current) return;
          setReadingDoc(false);
          setPhotoError(null);
          onDocumentChangeRef.current?.(read);
        },
        (e: unknown) => {
          if (seq === docSeq.current) {
            setReadingDoc(false);
            setPhotoError(
              e instanceof DocumentReadError ? e.message : "Couldn't find any text in that file",
            );
          }
          throw e instanceof Error ? e : new Error(String(e));
        },
      );
      processing.catch(() => clearChip());
      runChip(file.name, processing);
    },
    [runChip, clearChip],
  );

  const removeDocument = () => {
    docSeq.current += 1;
    setReadingDoc(false);
    setPhotoError(null);
    onDocumentChange?.(null);
    inputRef.current?.focus();
  };

  const removePhoto = () => {
    attachSeq.current += 1;
    setReading(false);
    setPhotoError(null);
    onPhotoChange(null);
    // The remove button leaves with the photo; keep focus in the composer.
    inputRef.current?.focus();
  };

  const onDropRejected = useCallback(
    (rejections: FileRejection[]) =>
      setPhotoError(rejectionMessage(rejections[0]?.errors[0]?.code)),
    [],
  );
  const { getRootProps, isDragActive, rootRef } = useDropzone({
    onDrop: (accepted) => {
      if (accepted[0]) takeFile(accepted[0], "upload");
    },
    onDropRejected,
    accept: UPLOAD_ACCEPT,
    maxFiles: 1,
    maxSize: MAX_UPLOAD_BYTES,
    // A drop target only: a click in the card is a click in the text, and
    // the keyboard way to a file is the Attach menu.
    noClick: true,
    noKeyboard: true,
    disabled,
  });
  // The dropzone names its root "presentation"; this root is a form and
  // keeps its own semantics.
  const { role: _role, ...dropProps } = getRootProps();

  // Pasting an image anywhere in the card attaches it; a paste with no
  // image in it is ordinary text and goes to the textarea as usual.
  const onPaste = (e: React.ClipboardEvent) => {
    if (disabled) return;
    const file = Array.from(e.clipboardData.files).find((f) => f.type.startsWith("image/"));
    if (!file) return;
    e.preventDefault();
    takeFile(file, "paste");
  };

  // ── Sending ─────────────────────────────────────────────────────────────
  // Not while a photo is still being read (the upload chip shows it), so
  // the photo always goes with the message it was attached to.
  const canSend = !running && !disabled && !reading && value.trim().length > 0;
  const submit = () => {
    if (canSend) onSubmit();
  };
  // Stop and Send are one <button>. A Stop click stops the run inside the
  // click, and React commits that before the click's default action runs,
  // so by then the button is a submit button again and the browser would
  // submit the form: one click would stop the run and send the message
  // again. A submit that arrives during a Stop click's own event is
  // dropped; the flag clears once that event's task is over.
  const stopping = useRef(false);
  const stop = () => {
    stopping.current = true;
    window.setTimeout(() => {
      stopping.current = false;
    }, 0);
    onStop();
  };
  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter" || e.shiftKey) return;
    // An IME's Enter picks its candidate. Safari reports that Enter with
    // isComposing already false but keyCode 229, so both are checked.
    if (e.nativeEvent.isComposing || e.nativeEvent.keyCode === 229) return;
    // Never a newline, even while a run is in flight or the text is empty:
    // Enter is the send key here.
    e.preventDefault();
    submit();
  };

  // ── Auto-grow ───────────────────────────────────────────────────────────
  // Measured in script rather than with `field-sizing: content`, so the
  // box grows in every browser, and so the floor can change with the state
  // (64 on an empty Start composer, one line otherwise; the CSS owns it).
  // The height collapses to auto for one read of the text's full height,
  // then takes that up to six lines; past it the box scrolls, and the
  // scroll position survives the collapse so typing at the end of a long
  // brief does not jump.
  const attachedRow = Boolean(photo || doc || chip);
  const fit = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    const scrollTop = el.scrollTop;
    el.style.height = "auto";
    const cap = (parseFloat(getComputedStyle(el).lineHeight) || 24) * MAX_LINES;
    const full = el.scrollHeight;
    el.style.height = `${Math.min(full, cap)}px`;
    el.style.overflowY = full > cap ? "auto" : "hidden";
    el.scrollTop = scrollTop;
  }, []);
  useLayoutEffect(fit, [fit, value, placeholder, attachedRow]);
  // A width change rewraps the text: refit when the box gets narrower or
  // wider (its own height changes come back here too, and are ignored).
  useEffect(() => {
    const el = inputRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    let width = el.clientWidth;
    const ro = new ResizeObserver(() => {
      if (el.clientWidth === width) return;
      width = el.clientWidth;
      fit();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [fit]);

  return {
    dropProps,
    isDragActive,
    rootRef,
    onPaste,
    setTextarea,
    onKeyDown,
    attachedRow,
    chip,
    removePhoto,
    removeDocument,
    photoError,
    canSend,
    stop,
    submit,
    stopping,
    takeFile,
    takeDocument,
    takeAsset,
  };
}
