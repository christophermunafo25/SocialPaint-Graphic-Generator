import { describe, expect, it } from "vitest";
import { inflateSync } from "node:zlib";
import { base64, crc32, encodeRgbaPng, rgbaPngDataUrl } from "./png";

/** Split a PNG into its chunks, checking each CRC on the way. */
function chunks(png: Uint8Array) {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  const out: Array<{ type: string; data: Uint8Array }> = [];
  let o = 8;
  while (o < png.length) {
    const len = view.getUint32(o);
    const type = String.fromCharCode(...png.subarray(o + 4, o + 8));
    const data = png.subarray(o + 8, o + 8 + len);
    expect(view.getUint32(o + 8 + len), `${type} crc`).toBe(
      crc32(png.subarray(o + 4, o + 8 + len)),
    );
    out.push({ type, data });
    o += 12 + len;
  }
  return out;
}

describe("crc32", () => {
  it("matches the IEND chunk every PNG ends with", () => {
    expect(crc32(new TextEncoder().encode("IEND"))).toBe(0xae426082);
  });
});

describe("encodeRgbaPng", () => {
  it("writes a valid PNG whose pixels decode back exactly", () => {
    const w = 3;
    const h = 2;
    const rgba = new Uint8ClampedArray(w * h * 4).map((_, i) => (i * 37) % 256);
    const png = encodeRgbaPng(w, h, rgba);
    expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const parts = chunks(png);
    expect(parts.map((c) => c.type)).toEqual(["IHDR", "IDAT", "IEND"]);
    const raw = inflateSync(parts[1].data);
    for (let y = 0; y < h; y++) {
      const row = raw.subarray(y * (1 + w * 4), (y + 1) * (1 + w * 4));
      expect(row[0]).toBe(0);
      expect([...row.subarray(1)]).toEqual([...rgba.subarray(y * w * 4, (y + 1) * w * 4)]);
    }
  });

  it("splits data past 65535 bytes into several stored blocks", () => {
    const rgba = new Uint8ClampedArray(200 * 200 * 4).fill(7);
    const idat = chunks(encodeRgbaPng(200, 200, rgba))[1].data;
    expect(inflateSync(idat).length).toBe(200 * (1 + 200 * 4));
  });
});

describe("base64", () => {
  it("matches the platform's encoding at every padding length", () => {
    for (const len of [0, 1, 2, 3, 10, 11]) {
      const bytes = new Uint8Array(len).map((_, i) => (i * 91 + 5) % 256);
      expect(base64(bytes)).toBe(Buffer.from(bytes).toString("base64"));
    }
  });

  it("makes a PNG data URL", () => {
    expect(rgbaPngDataUrl(1, 1, new Uint8ClampedArray(4))).toMatch(
      /^data:image\/png;base64,iVBORw0K/,
    );
  });
});
