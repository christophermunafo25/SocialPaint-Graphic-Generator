import React from "react";
import { MAX_BRIEF } from "@/lib/generate/chatReducer";
import { UploadChipView } from "../imageUpload";
import { AttachMenu } from "../generate/AttachMenu";
import { AttachmentThumb, FileAttachment } from "../generate/AttachmentThumb";
import { useComposer, type ComposerProps } from "../generate/Composer";
import { SendButton } from "../primitives";

/** The Composer (Figma 61:504), as the template chat draws it: the text,
 * then the toolbar, the Attach button on the left and Send on the right.
 * Its Tags row holds detail tags; the template chat sends none, and has no
 * platform select or Variations stepper (PHASE-4 §8). The behaviour is the
 * legacy chat box's (useComposer): Enter sends, a pasted or dropped photo
 * attaches, Send turns to Stop while a run is in flight. Phase 5 moves
 * Generate onto it and adds the select and the stepper. */
export function ChatComposer(
  props: Omit<
    ComposerProps,
    "size" | "platform" | "onPlatformChange" | "covered" | "variations" | "onVariationsChange"
  >,
) {
  const { value, onChange, photo, running, placeholder, disabled = false, document: doc } = props;
  const c = useComposer({ ...props, size: "compact" });
  return (
    <form
      {...c.dropProps}
      className="ui-composer"
      data-drag-active={c.isDragActive || undefined}
      onSubmit={(e) => {
        e.preventDefault();
        if (!c.stopping.current) c.submit();
      }}
      onPaste={c.onPaste}
    >
      <span className="sr-only" role="status" aria-live="polite">
        {c.isDragActive ? "Drop the image to upload" : ""}
      </span>
      {c.attachedRow && (
        <div className="ui-composer__attachments">
          {photo && <AttachmentThumb src={photo.dataUrl} onRemove={c.removePhoto} />}
          {doc && <FileAttachment name={doc.name} kind={doc.kind} onRemove={c.removeDocument} />}
          {c.chip && <UploadChipView chip={c.chip} />}
        </div>
      )}
      <textarea
        ref={c.setTextarea}
        className="ui-reset ui-ring-none t-body-l ui-composer__input"
        rows={1}
        value={value}
        maxLength={MAX_BRIEF}
        placeholder={placeholder}
        aria-label="Describe the post"
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={c.onKeyDown}
      />
      {c.photoError && (
        <p role="alert" className="t-caption-s ui-composer__error">
          {c.photoError}
        </p>
      )}
      <div className="ui-composer__toolbar">
        <div className="ui-composer__inputs">
          <AttachMenu
            trigger="attach"
            containerRef={c.rootRef}
            disabled={disabled}
            onPickFile={(file) => c.takeFile(file, "upload")}
            onPickDocument={c.takeDocument}
            onPickAsset={c.takeAsset}
          />
        </div>
        <div className="ui-composer__output">
          {running ? (
            <SendButton action="stop" label="Stop" onClick={c.stop} />
          ) : (
            <SendButton type="submit" label="Send" disabled={!c.canSend} />
          )}
        </div>
      </div>
    </form>
  );
}
