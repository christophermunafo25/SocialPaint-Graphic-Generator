// The snapshot is URI-encoded once, so its markup is read in that form. An
// image's source is megabytes of base64 inside one attribute value, which is
// why a tag is walked with indexOf from quote to quote: a regular expression
// that has to capture a run that long finds no match in WebKit.
/** `<img ` */
const IMG_OPEN = "%3Cimg%20";
/** `="`, between an attribute's name and its value. */
const VALUE_OPEN = "%3D%22";
/** `"` */
const QUOTE = "%22";
/** A space. */
const SPACE = "%20";
/** `decoding="sync" ` */
const SYNC_ATTRIBUTE = "decoding%3D%22sync%22%20";
/** An attribute's name as XMLSerializer writes one: no escape but the colon
 * of a prefix. Anything else where a name should be means the tag is not
 * laid out as expected, and it is left as it is. */
const ATTRIBUTE_NAME = /^(?:[A-Za-z0-9_.-]|%3A)+$/;
/** No real attribute name comes near this. It keeps the test above off
 * megabytes of text when a tag is not what it seems. */
const LONGEST_NAME = 200;

/** What an `<img>` tag says about decoding: where the attribute's value is,
 * that it has no such attribute, or that the tag could not be read. */
type Decoding = { start: number; end: number } | "absent" | "unreadable";

/** Reads the `<img>` tag whose attributes start at `from`.
 *
 * It reads a name, then its value, then the next name, and never searches
 * inside a value, so text that looks like markup in an `alt` cannot mislead
 * it. XMLSerializer writes a quote inside a value as `&quot;`, so the next
 * quote always closes the value. */
function readDecoding(snapshot: string, from: number): Decoding {
  let at = from;
  for (;;) {
    // The tag's end, `>` or `/>`.
    if (snapshot.startsWith("%3E", at) || snapshot.startsWith("%2F%3E", at)) return "absent";
    const valueOpen = snapshot.indexOf(VALUE_OPEN, at);
    if (valueOpen < 0 || valueOpen - at > LONGEST_NAME) return "unreadable";
    const name = snapshot.slice(at, valueOpen);
    if (!ATTRIBUTE_NAME.test(name)) return "unreadable";
    const start = valueOpen + VALUE_OPEN.length;
    const end = snapshot.indexOf(QUOTE, start);
    if (end < 0) return "unreadable";
    if (name === "decoding") return { start, end };
    at = end + QUOTE.length;
    if (snapshot.startsWith(SPACE, at)) at += SPACE.length;
  }
}

/** The export snapshot with every `<img>` in it set to decode synchronously.
 *
 * The snapshot is html-to-image's SVG data URL: the canvas node's clone in a
 * `<foreignObject>`, serialized and URI-encoded. WebKit decodes a bitmap of
 * more than 500 KB once decoded (about 358 px square) inside an SVG image
 * off the main thread, and starts only when the snapshot is first drawn.
 * Until that decode lands the image paints nothing, so a draw made before
 * then exports the graphic without its photos, and how long the decode takes
 * depends on the machine. An `<img decoding="sync">` is decoded inside the
 * draw that paints it instead, however slow the machine.
 *
 * Chromium and Firefox already paint a snapshot's images in the draw and
 * render the same pixels with the attribute as without it. WebKit's pixels
 * change where an image is drawn smaller than it is: decoded in the draw it
 * is decoded whole and scaled as it is drawn, where the decode off the main
 * thread was made at the drawn size.
 *
 * It reaches `<img>` elements only: a CSS image has no such attribute. The
 * one large bitmap the renderer paints as a CSS image is an image field's
 * alpha mask, which still decodes after the first draw. Grain tiles are CSS
 * backgrounds too, but at 128 px square they are under WebKit's line and
 * decode in the draw as they are.
 *
 * A tag that already has the attribute gets its value rewritten: html-to-image
 * writes `decoding="async"` on the image it makes of a canvas, and a second
 * attribute would not parse. A tag that cannot be read is left as it is. */
export function withSyncDecodedImages(snapshot: string): string {
  const parts: string[] = [];
  let copied = 0;
  let tag = snapshot.indexOf(IMG_OPEN);
  while (tag >= 0) {
    const attributes = tag + IMG_OPEN.length;
    const decoding = readDecoding(snapshot, attributes);
    if (decoding === "absent") {
      parts.push(snapshot.slice(copied, attributes), SYNC_ATTRIBUTE);
      copied = attributes;
    } else if (decoding !== "unreadable") {
      parts.push(snapshot.slice(copied, decoding.start), "sync");
      copied = decoding.end;
    }
    tag = snapshot.indexOf(IMG_OPEN, Math.max(attributes, copied));
  }
  if (!parts.length) return snapshot;
  parts.push(snapshot.slice(copied));
  return parts.join("");
}
