// The snapshot is URI-encoded once, so its markup is matched in that form. A
// bitmap is megabytes of base64 between two of these, which is why the scan
// below uses indexOf: a pattern that captures a run that long does not match
// in every engine.
/** `<img ` */
const IMG_OPEN = "%3Cimg%20";
/** `>` */
const TAG_CLOSE = "%3E";
/** ` decoding="`. A quote inside an attribute value is written `&quot;`, so
 * this is never found inside one. */
const DECODING = "%20decoding%3D%22";
/** `"` */
const QUOTE = "%22";
/** `decoding="sync" ` */
const SYNC_ATTRIBUTE = "decoding%3D%22sync%22%20";

/** The export snapshot with every `<img>` in it set to decode synchronously.
 *
 * The snapshot is html-to-image's SVG data URL: the canvas node's clone in a
 * `<foreignObject>`, serialized and URI-encoded. WebKit decodes a bitmap of
 * about 500 KB or more (once decoded) inside an SVG image off the main
 * thread, and starts only when the snapshot is first drawn. Until that
 * decode lands the image paints nothing, so a draw made before then exports
 * the graphic without its photos, and how long the decode takes depends on
 * the machine. An `<img decoding="sync">` is decoded inside the draw that
 * paints it instead, however slow the machine. Chromium and Firefox already
 * paint a snapshot's images in the draw and render the same pixels with the
 * attribute as without it.
 *
 * It reaches `<img>` elements only: a CSS image has no such attribute. The
 * renderer draws every image as an `<img>` except an image field's alpha
 * mask, which is a CSS mask and still decodes after the first draw. */
export function withSyncDecodedImages(snapshot: string): string {
  let tag = snapshot.indexOf(IMG_OPEN);
  if (tag < 0) return snapshot;
  const parts: string[] = [];
  let copied = 0;
  // The next decoding attribute at or after the tag being read. It is looked
  // for again only once a tag has passed it, so the pass stays linear.
  let decoding = snapshot.indexOf(DECODING, tag);
  while (tag >= 0) {
    const attributes = tag + IMG_OPEN.length;
    // XMLSerializer writes a ">" inside an attribute value as "&gt;", so the
    // first one after the tag's name closes the tag.
    const tagEnd = snapshot.indexOf(TAG_CLOSE, attributes);
    if (tagEnd < 0) break;
    if (decoding >= 0 && decoding < tag) decoding = snapshot.indexOf(DECODING, tag);
    const valueStart = decoding + DECODING.length;
    const valueEnd = decoding >= 0 ? snapshot.indexOf(QUOTE, valueStart) : -1;
    if (valueEnd >= 0 && valueEnd < tagEnd) {
      // The tag has the attribute already (html-to-image writes "async" on
      // the image it makes of a canvas), and a second one would not parse.
      parts.push(snapshot.slice(copied, valueStart), "sync");
      copied = valueEnd;
    } else {
      parts.push(snapshot.slice(copied, attributes), SYNC_ATTRIBUTE);
      copied = attributes;
    }
    tag = snapshot.indexOf(IMG_OPEN, tagEnd);
  }
  parts.push(snapshot.slice(copied));
  return parts.join("");
}
