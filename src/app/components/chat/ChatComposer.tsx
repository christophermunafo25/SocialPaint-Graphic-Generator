import React, { useEffect, useRef, useState } from "react";
import { Globe } from "lucide-react";
import type { PlatformId } from "@/lib/templates/platforms";
import { MAX_BRIEF, MAX_VARIATIONS, MIN_VARIATIONS } from "@/lib/generate/chatReducer";
import { upsertDetail, type DetailTagValue } from "@/lib/generate/details";
import { UploadChipView } from "../imageUpload";
import { useComposer, type ComposerProps } from "./useComposer";
import { DetailTag, SendButton, Stepper } from "../primitives";
import { AttachMenu, platformLabel, type AttachMenuHandle } from "./AttachMenu";
import { FileTile, PhotoTile } from "./Attachments";

export interface ChatComposerProps extends ComposerProps {
  /** The platform the next message asks for (Generate only): the attach
   * menu's OUTPUT section, and a tag at the head of the Details row. */
  platform?: {
    value: PlatformId | null;
    onChange(next: PlatformId | null): void;
  };
  /** How many variations the next message asks for (Generate only): the
   * Stepper. */
  variations?: { value: number; onChange(next: number): void };
  /** Generate's details (PHASE-5 §9 D4): the attach menu's DETAILS
   * section, and the message's tags in the Details row. */
  details?: {
    value: readonly DetailTagValue[];
    onChange(next: DetailTagValue[]): void;
  };
  /** Whether the attach menu or one of its panels is showing. */
  onMenuOpenChange?(open: boolean): void;
}

/** The Composer (new brand, 13:2454): the attachments, the text, the
 * Details row (the platform and the details as tags), then the toolbar:
 * Attach on the left, the Variations stepper and Send on the right. The
 * template chat has no platform, details or stepper. The behaviour is
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
    details,
    onMenuOpenChange,
  } = props;
  const menuRef = useRef<AttachMenuHandle>(null);
  const c = useComposer(props);
  // A tag's x goes with its tag; focus goes to the text.
  const focusText = () => c.rootRef.current?.querySelector("textarea")?.focus();
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
        className="ui-reset ui-composer__input"
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
        <p role="alert" className="tu-caption-m ui-composer__error">
          {c.photoError}
        </p>
      )}
      {(platform?.value || (details && details.value.length > 0)) && (
        <TagRail>
          {platform?.value && (
            <li key="platform">
              <DetailTag
                editLabel={`Edit platform: ${platformLabel(platform.value)}`}
                onEdit={(e) => menuRef.current?.editPlatform(e.currentTarget)}
                removeLabel={`Remove ${platformLabel(platform.value)}`}
                onRemove={() => {
                  platform.onChange(null);
                  focusText();
                }}
              >
                {platformLabel(platform.value)}
              </DetailTag>
            </li>
          )}
          {details &&
            details.value.map((tag) => (
              <li key={tag.fieldKey}>
                <DetailTag
                  icon={tag.kind === "link" ? Globe : undefined}
                  editLabel={`Edit ${tag.label}: ${tag.value}`}
                  onEdit={(e) => menuRef.current?.editDetail(tag.fieldKey, e.currentTarget)}
                  removeLabel={`Remove ${tag.label}`}
                  onRemove={() => {
                    details.onChange(details.value.filter((t) => t.fieldKey !== tag.fieldKey));
                    focusText();
                  }}
                >
                  {tag.value}
                </DetailTag>
              </li>
            ))}
        </TagRail>
      )}
      <div className="ui-composer__toolbar">
        <div className="ui-composer__inputs">
          <AttachMenu
            ref={menuRef}
            containerRef={c.rootRef}
            disabled={disabled}
            onPickFile={(file) => c.takeFile(file, "upload")}
            onPickDocument={c.takeDocument}
            onPickAsset={c.takeAsset}
            onOpenChange={onMenuOpenChange}
            platform={platform}
            details={
              details && {
                value: details.value,
                onSet: (kind, v) => details.onChange(upsertDetail(details.value, kind, v)),
              }
            }
          />
        </div>
        <div className="ui-composer__output">
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

/** The Details row (13:2454): one line of tags 8 apart that scrolls
 * sideways, 48 of room after the last, under a 121 fade to the composer's
 * fill while more lies past the right edge. */
function TagRail({ children }: { children: React.ReactNode }) {
  const listRef = useRef<HTMLUListElement>(null);
  const [more, setMore] = useState(false);
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const measure = () => setMore(list.scrollLeft + list.clientWidth < list.scrollWidth - 1);
    measure();
    list.addEventListener("scroll", measure, { passive: true });
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(list);
    return () => {
      list.removeEventListener("scroll", measure);
      observer?.disconnect();
    };
  }, [children]);
  return (
    <div className="ui-composer__tags" data-more={more || undefined}>
      <ul ref={listRef} className="ui-composer__tag-list" aria-label="Details">
        {children}
      </ul>
    </div>
  );
}
