import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatThread } from "@/lib/generate/chat";
import { ThreadSaver } from "@/lib/generate/threadSaver";
import { stores } from "@/lib/stores";

export interface ThreadPersistence {
  /** Hand every transition of the thread here (useChatController's
   * `onChange`). */
  observe(next: ChatThread, prev: ChatThread): void;
  /** A change the last save could not write is only in memory: the dock
   * says "This chat isn't saved yet." until a save succeeds. */
  unsaved: boolean;
}

/** Saves the chat page's thread as it goes (PROMPT §9.8), through
 * stores.generateThreads. The rules are ThreadSaver's (threadSaver.ts):
 * the first finished turn creates the chat, every later one and each edit
 * (800ms after the last) update it, nothing is written while a run is in
 * flight, and a failed write only marks the chat unsaved until the next
 * save point succeeds.
 *
 * One saver per page mount, for the page's workspace and, on a reopened
 * chat, its id. `onCreated` runs when the chat on screen is saved for the
 * first time: the page takes the id and moves to the chat's address. A
 * pending edit is written at once when the tab is hidden or closed, and
 * when the page goes; a run the page's unmount stops is still saved, but
 * nothing is reported to a page that has gone. */
export function useThreadPersistence(opts: {
  companyId: string | null;
  initialId: string | null;
  onCreated(id: string): void;
}): ThreadPersistence {
  const [saver] = useState(
    () =>
      new ThreadSaver({
        companyId: opts.companyId,
        initialId: opts.initialId,
        store: stores.generateThreads,
      }),
  );
  const [unsaved, setUnsaved] = useState(false);
  const onCreated = useRef(opts.onCreated);
  onCreated.current = opts.onCreated;

  useEffect(() => {
    saver.attach({ onCreated: (id) => onCreated.current(id), onUnsaved: setUnsaved });
    const flush = () => saver.flush();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flush);
      saver.detach();
    };
  }, [saver]);

  const observe = useCallback(
    (next: ChatThread, prev: ChatThread) => saver.observe(next, prev),
    [saver],
  );
  return { observe, unsaved };
}
