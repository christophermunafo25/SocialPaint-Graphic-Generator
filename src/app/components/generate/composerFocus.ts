// "New chat" and opening a chat land in the composer (PROMPT §9.10). Both
// can navigate before the chat page mounts (from History, or to another
// chat's key), so the action leaves a note here and the page takes it on
// mount, once: taking the note clears it. Module state, not the URL: a
// refresh or a shared link should not steal focus.
//
// Going to History ("View all", the header's History, and the History
// button of a chat that is loading or unavailable) unmounts the control
// that was pressed, so it leaves the same kind of note for the History
// page, which lands focus on its title. Focus is never dropped to <body>.

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

let historyPending = false;

/** Ask the History page about to mount to put focus on its title. */
export function requestHistoryFocus(): void {
  historyPending = true;
}

/** True once per request, like takeComposerFocus. */
export function takeHistoryFocus(): boolean {
  const taken = historyPending;
  historyPending = false;
  return taken;
}
