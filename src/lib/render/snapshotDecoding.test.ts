import { describe, expect, it } from "vitest";
import { withSyncDecodedImages } from "./snapshotDecoding";

const PREFIX = "data:image/svg+xml;charset=utf-8,";
const PHOTO = "data:image/png;base64,iVBORw0KGgo+/A==";

/** A snapshot the way html-to-image builds one, around `inner`. */
const snapshotOf = (inner: string) =>
  PREFIX +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350"><foreignObject width="100%" height="100%" x="0" y="0" externalResourcesRequired="true"><div xmlns="http://www.w3.org/1999/xhtml">${inner}</div></foreignObject></svg>`,
  );
/** The markup a snapshot holds. */
const markupOf = (snapshot: string) => decodeURIComponent(snapshot.slice(PREFIX.length));
/** Every `<img>` tag in a snapshot's markup. */
const imgTags = (snapshot: string) => markupOf(snapshot).match(/<img\b[^>]*>/g) ?? [];
/** How many decoding attributes a tag carries: two would not parse. */
const decodingCount = (tag: string) => tag.split(' decoding="').length - 1;

describe("withSyncDecodedImages", () => {
  it("sets every image to decode synchronously and changes nothing else", () => {
    const inner = `<img src="${PHOTO}" alt="" style="width: 100%;" /><p>Launch day</p><img alt="Logo" src="${PHOTO}" />`;
    const marked = withSyncDecodedImages(snapshotOf(inner));

    expect(markupOf(marked)).toBe(
      markupOf(snapshotOf(inner.split("<img ").join('<img decoding="sync" '))),
    );
    expect(imgTags(marked)).toHaveLength(2);
    for (const tag of imgTags(marked)) expect(decodingCount(tag)).toBe(1);
  });

  it("rewrites a decoding attribute the tag already has", () => {
    // What html-to-image makes of a canvas.
    const canvas = `<img crossorigin="anonymous" decoding="async" src="${PHOTO}" />`;
    const first = `<img decoding="auto" src="${PHOTO}" />`;
    const last = `<img src="${PHOTO}" decoding="async" />`;
    const marked = withSyncDecodedImages(snapshotOf(canvas + first + last));

    expect(imgTags(marked)).toEqual([
      `<img crossorigin="anonymous" decoding="sync" src="${PHOTO}" />`,
      `<img decoding="sync" src="${PHOTO}" />`,
      `<img src="${PHOTO}" decoding="sync" />`,
    ]);
  });

  it("reads each tag on its own when only some carry the attribute", () => {
    const inner = `<img src="${PHOTO}" /><img decoding="async" src="${PHOTO}" /><img src="${PHOTO}" /><img src="${PHOTO}" decoding="async" /><img src="${PHOTO}" />`;
    const tags = imgTags(withSyncDecodedImages(snapshotOf(inner)));

    expect(tags).toHaveLength(5);
    for (const tag of tags) {
      expect(decodingCount(tag)).toBe(1);
      expect(tag).toContain(' decoding="sync"');
    }
  });

  it("is not misled by attribute values and text that look like markup", () => {
    // XMLSerializer escapes these inside an attribute value; text keeps its
    // quotes.
    const inner = `<p>an &lt;img src="x"&gt; tag, and decoding="async" in words</p><img alt="a &gt; b, decoding=&quot;async&quot;" data-decoding="async" src="${PHOTO}" /><p> decoding="async"</p>`;
    const marked = withSyncDecodedImages(snapshotOf(inner));

    expect(markupOf(marked)).toBe(
      markupOf(snapshotOf(inner.split("<img alt").join('<img decoding="sync" alt'))),
    );
  });

  it("leaves SVG images and a snapshot with no image as they are", () => {
    const vector = snapshotOf(
      `<svg xmlns="http://www.w3.org/2000/svg"><image href="${PHOTO}" width="8" height="8" /></svg><p>Launch day</p>`,
    );
    expect(withSyncDecodedImages(vector)).toBe(vector);
    expect(withSyncDecodedImages("")).toBe("");
  });

  it("leaves a nested snapshot's own tags alone", () => {
    // An image whose source is itself an SVG data URL: its markup is encoded
    // a second time, so it never reads as a tag of this snapshot.
    const nested = snapshotOf(`<img src="${PHOTO}" />`);
    const marked = withSyncDecodedImages(snapshotOf(`<img src="${nested}" />`));

    expect(imgTags(marked)).toEqual([`<img decoding="sync" src="${nested}" />`]);
  });

  it("gives the same snapshot when run again", () => {
    const once = withSyncDecodedImages(
      snapshotOf(`<img src="${PHOTO}" /><img decoding="async" src="${PHOTO}" />`),
    );
    expect(withSyncDecodedImages(once)).toBe(once);
  });

  it("stops at a tag that never closes", () => {
    const open = `${PREFIX}%3Cimg%20src%3D%22`;
    expect(withSyncDecodedImages(open)).toBe(open);
  });
});
