import React from "react";
import type { PlatformId } from "@/lib/templates/platforms";
import { MAX_BRIEF, MAX_VARIATIONS, MIN_VARIATIONS } from "@/lib/generate/chatReducer";
import { UploadChipView } from "../imageUpload";
import { AttachMenu } from "../generate/AttachMenu";
import { useComposer, type ComposerProps } from "../generate/Composer";
import { SendButton, Stepper } from "../primitives";
import { FileTile, PhotoTile, PlatformSelect } from "./Attachments";

export interface ChatComposerProps extends Omit<
  ComposerProps,
  "size" | "platform" | "onPlatformChange" | "covered" | "variations" | "onVariationsChange"
> {
  /** The Start state's platform hint (Generate only): the Compact select. */
  platform?: {
    value: PlatformId | null;
    onChange(next: PlatformId | null): void;
    covered: ReadonlySet<PlatformId> | null;
    dimUncovered: boolean;
  };
  /** The Start state's Variations (Generate only): the Stepper. */
  variations?: { value: number; onChange(next: number): void };
  /** The Tags row beside the plus: the message's detail tags. */
  tags?: React.ReactNode;
}

/** The Composer (Figma 61:504): the attachments, the text, then the
 * toolbar, the Attach button and the Tags row on the left, the platform
 * select, the Variations stepper and Send on the right. The select and the
 * stepper show on Generate's Start state only (a follow-up reuses the
 * last send's); the template chat has neither. The behaviour is
 * useComposer's: Enter sends, a pasted or dropped photo attaches, Send
 * turns to Stop while a run is in flight. */
export function ChatComposer(props: ChatComposerProps) {
  const {
    value,
    onChange,
    photo,
    running,
    placeholder,
    disabled = false,
    document: doc,
    platform,
    variations,
    tags,
  } = props;
  const c = useComposer({ ...props, size: "compact", platform: undefined, variations: undefined });
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
          {photo && <PhotoTile src={photo.dataUrl} onRemove={c.removePhoto} />}
          {doc && <FileTile name={doc.name} kind={doc.kind} onRemove={c.removeDocument} />}
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
          {tags && <div className="ui-composer__tags">{tags}</div>}
        </div>
        <div className="ui-composer__output">
          {platform && (
            <PlatformSelect
              value={platform.value}
              onChange={platform.onChange}
              covered={platform.covered}
              dimUncovered={platform.dimUncovered}
            />
          )}
          {variations && (
            <Stepper
              label="Variations"
              value={variations.value}
              min={MIN_VARIATIONS}
              max={MAX_VARIATIONS}
              onChange={variations.onChange}
              disabled={disabled}
              decreaseLabel="Fewer variations"
              increaseLabel="More variations"
            />
          )}
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
