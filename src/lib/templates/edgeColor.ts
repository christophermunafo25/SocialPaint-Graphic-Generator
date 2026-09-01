/** Sample the dominant color of an image's edges — the honest stand-in when
 * a background image cannot survive an aspect change and the admin chooses a
 * solid fill instead. Edges, not the whole image: the border is what a
 * `cover` crop extends, so it is the color a viewer would read as "the
 * background".
 *
 * Returns null when the image cannot be read (CORS-tainted canvas, load
 * failure) — the caller decides the fallback out loud, never silently. */
export async function dominantEdgeColor(url: string): Promise<string | null> {
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.crossOrigin = "anonymous";
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("image load failed"));
      el.src = url;
    });
    // A small resample is plenty for an average and keeps the readback cheap.
    const size = 64;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, size, size);
    const { data } = ctx.getImageData(0, 0, size, size);
    let r = 0;
    let g = 0;
    let b = 0;
    let n = 0;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (x > 1 && x < size - 2 && y > 1 && y < size - 2) continue; // edges only
        const i = (y * size + x) * 4;
        if (data[i + 3] < 128) continue; // transparent pixels say nothing
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
        n++;
      }
    }
    if (n === 0) return null;
    const hex = (v: number) =>
      Math.round(v / n)
        .toString(16)
        .padStart(2, "0");
    return `#${hex(r)}${hex(g)}${hex(b)}`;
  } catch {
    return null;
  }
}
