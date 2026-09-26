// "New chat" and opening a chat land in the composer (PROMPT §9.10). Both
// can navigate before the chat page mounts (from History, or to another
// chat's key), so the action leaves a note here and the page takes it on
// mount: the seedHandoff pattern, for a focus request instead of values.
// Module state, not the URL: a refresh or a shared link should not steal
// focus.

let pending = false;

/** Ask the next chat page to mount (or the current one, when it takes the
 * request itself) to put focus in its composer. */
export function requestComposerFocus(): void {
  pending = true;
}

/** True once per request: the page that takes it owns the focus. */
export function takeComposerFocus(): boolean {
  const taken = pending;
  pending = false;
  return taken;
}
