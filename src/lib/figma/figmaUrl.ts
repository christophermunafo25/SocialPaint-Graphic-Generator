/** A Figma file/design link that names a specific node — what "Copy link"
 * on a layer produces, and the only paste-able form (a file link without a
 * node-id has nothing to place). Mirrors the server's parseFigmaUrl. */
export const isFigmaNodeUrl = (text: string): boolean =>
  /^https:\/\/(?:www\.)?figma\.com\/(?:file|design)\/[a-zA-Z0-9]+[^?\s]*\?(?:[^#\s]*&)?node-id=[^&\s]+/.test(
    text.trim(),
  );
