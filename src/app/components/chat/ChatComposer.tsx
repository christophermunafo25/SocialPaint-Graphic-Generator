import React, { useEffect, useRef, useState } from "react";
import { Globe } from "lucide-react";
import type { PlatformId } from "@/lib/templates/platforms";
import { MAX_BRIEF, MAX_VARIATIONS, MIN_VARIATIONS } from "@/lib/generate/chatReducer";
import { upsertDetail, type DetailTagValue } from "@/lib/generate/details";
import { UploadChipView } from "../imageUpload";
import { useComposer, type ComposerProps } from "../generate/Composer";
import { DetailTag, SendButton, Stepper } from "../primitives";
import { AttachMenu, type AttachMenuHandle } from "./AttachMenu";
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
  /** Generate's details (PHASE-5 §9 D4): the attach menu's DETAILS
   * section, and the message's tags in the Tags row beside the plus. */
  details?: {
    value: readonly DetailTagValue[];
    onChange(next: DetailTagValue[]): void;
  };
  /** Whether the attach menu or Add a detail is showing. */
  onMenuOpenChange?(open: boolean): void;
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
    details,
    onMenuOpenChange,
  } = props;
  const menuRef = useRef<AttachMenuHandle>(null);
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
            ref={menuRef}
            containerRef={c.rootRef}
            disabled={disabled}
            onPickFile={(file) => c.takeFile(file, "upload")}
            onPickDocument={c.takeDocument}
            onPickAsset={c.takeAsset}
            onOpenChange={onMenuOpenChange}
            details={
              details && {
                value: details.value,
                onSet: (kind, v) => details.onChange(upsertDetail(details.value, kind, v)),
              }
            }
          />
          {details && details.value.length > 0 && (
            <TagRail>
              {details.value.map((tag) => (
                <li key={tag.fieldKey}>
                  <DetailTag
                    icon={tag.kind === "link" ? Globe : undefined}
                    editLabel={`Edit ${tag.label}: ${tag.value}`}
                    onEdit={(e) => menuRef.current?.editDetail(tag.fieldKey, e.currentTarget)}
                    removeLabel={`Remove ${tag.label}`}
                    onRemove={() => {
                      details.onChange(details.value.filter((t) => t.fieldKey !== tag.fieldKey));
                      // The x goes with its tag; focus goes to the text.
                      c.rootRef.current?.querySelector("textarea")?.focus();
                    }}
                  >
                    {tag.value}
                  </DetailTag>
                </li>
              ))}
            </TagRail>
          )}
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

/** The Tags row (13:2557): one line of tags that scrolls sideways, 48 of
 * room after the last, under a 121 fade to the composer's fill while more
 * lies past the right edge. */
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
