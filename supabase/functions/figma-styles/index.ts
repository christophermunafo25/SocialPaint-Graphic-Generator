import {
  figmaGet,
  getFigmaToken,
  parseFigmaFileKey,
  requireRole,
  serviceClient,
} from "../_shared/figma.ts";
import {
  GENERIC_ERROR,
  HttpError,
  handleOptions,
  jsonResponder,
  logError,
} from "../_shared/http.ts";
import { parseBody, requireString, requireUuid } from "../_shared/validate.ts";

/** Design-system import from Figma: pull a FILE's color + text styles into
 * brand palette entries and type styles. Prefers the file's published styles;
 * falls back to scanning the document for distinct solid fills and text
 * styles when nothing is published. */

interface Paint {
  type: string;
  visible?: boolean;
  color?: { r: number; g: number; b: number; a?: number };
  opacity?: number;
}

interface StyleNode {
  id: string;
  name: string;
  type: string;
  fills?: Paint[];
  style?: {
    fontFamily?: string;
    fontWeight?: number;
    fontSize?: number;
    textCase?: string;
    letterSpacing?: number;
    lineHeightPercentFontSize?: number;
  };
  children?: StyleNode[];
}

interface ColorOut {
  key: string;
  name: string;
  hex: string;
}
interface TypeStyleOut {
  key: string;
  name: string;
  font?: { source: "google"; family: string };
  weight?: number;
  fontSizePx?: number;
  uppercase?: boolean;
  letterSpacingPx?: number;
  lineHeight?: number;
}

const slug = (s: string, taken: Set<string>): string => {
  const base =
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "token";
  let key = base;
  let n = 2;
  while (taken.has(key)) key = `${base}_${n++}`;
  taken.add(key);
  return key;
};

const toHex = (c: { r: number; g: number; b: number }): string =>
  "#" +
  [c.r, c.g, c.b]
    .map((v) =>
      Math.round(v * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")
    .toUpperCase();

function firstSolidFill(node: StyleNode): Paint | undefined {
  return node.fills?.find((f) => f.type === "SOLID" && f.visible !== false && f.color);
}

function textNodeToTypeStyle(name: string, node: StyleNode, taken: Set<string>): TypeStyleOut {
  const t = node.style ?? {};
  return {
    key: slug(name, taken),
    name,
    font: t.fontFamily ? { source: "google", family: t.fontFamily } : undefined,
    weight: t.fontWeight,
    fontSizePx: t.fontSize,
    uppercase: t.textCase === "UPPER" ? true : undefined,
    letterSpacingPx: t.letterSpacing || undefined,
    lineHeight: t.lineHeightPercentFontSize ? t.lineHeightPercentFontSize / 100 : undefined,
  };
}

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  const json = jsonResponder(req);
  try {
    const body = await parseBody(req);
    const companyId = requireUuid(body.companyId, "companyId");
    const url = requireString(body.url, "url", 2048);

    const caller = await requireRole(req, companyId, "admin");
    if ("error" in caller) return json({ error: caller.error }, caller.status);
    const fileKey = parseFigmaFileKey(url);
    if (!fileKey) return json({ error: "url must be a figma.com file link." }, 400);

    const token = await getFigmaToken(serviceClient(), companyId);
    if (!token) return json({ error: "Figma is not connected for this company." }, 400);

    const colors: ColorOut[] = [];
    const typeStyles: TypeStyleOut[] = [];
    const colorKeys = new Set<string>();
    const styleKeys = new Set<string>();

    // 1. Published styles: metadata → definition nodes.
    const stylesRes = await figmaGet(`/v1/files/${fileKey}/styles`, token);
    if (stylesRes.ok) {
      const body = (await stylesRes.json()) as {
        meta?: { styles?: Array<{ node_id: string; name: string; style_type: string }> };
      };
      const metas = body.meta?.styles ?? [];
      const wanted = metas
        .filter((m) => m.style_type === "FILL" || m.style_type === "TEXT")
        .slice(0, 100);
      if (wanted.length) {
        const ids = wanted.map((m) => m.node_id).join(",");
        const nodesRes = await figmaGet(
          `/v1/files/${fileKey}/nodes?ids=${encodeURIComponent(ids)}`,
          token,
        );
        if (nodesRes.ok) {
          const nodesBody = (await nodesRes.json()) as {
            nodes: Record<string, { document: StyleNode } | null>;
          };
          for (const meta of wanted) {
            const node = nodesBody.nodes[meta.node_id]?.document;
            if (!node) continue;
            if (meta.style_type === "FILL") {
              const fill = firstSolidFill(node);
              if (fill?.color) {
                colors.push({
                  key: slug(meta.name, colorKeys),
                  name: meta.name,
                  hex: toHex(fill.color),
                });
              }
            } else if (meta.style_type === "TEXT") {
              typeStyles.push(textNodeToTypeStyle(meta.name, node, styleKeys));
            }
          }
        }
      }
    }

    // 2. Fallback: scan the document when the file publishes no styles.
    if (!colors.length && !typeStyles.length) {
      const fileRes = await figmaGet(`/v1/files/${fileKey}?depth=4`, token);
      if (!fileRes.ok)
        return json({ error: `Figma file request failed (${fileRes.status}).` }, 400);
      const fileBody = (await fileRes.json()) as { document: StyleNode };
      const seenHex = new Set<string>();
      const seenType = new Set<string>();
      const walk = (node: StyleNode) => {
        if (colors.length < 24) {
          const fill = firstSolidFill(node);
          if (fill?.color) {
            const hex = toHex(fill.color);
            if (!seenHex.has(hex)) {
              seenHex.add(hex);
              colors.push({ key: slug(node.name || hex, colorKeys), name: node.name || hex, hex });
            }
          }
        }
        if (node.type === "TEXT" && node.style && typeStyles.length < 16) {
          const sig = `${node.style.fontFamily}/${node.style.fontWeight}/${node.style.fontSize}/${node.style.textCase}`;
          if (!seenType.has(sig)) {
            seenType.add(sig);
            typeStyles.push(textNodeToTypeStyle(node.name || "Text style", node, styleKeys));
          }
        }
        for (const child of node.children ?? []) walk(child);
      };
      walk(fileBody.document);
    }

    return json({ colors, typeStyles });
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    logError("figma-styles", e);
    return json({ error: GENERIC_ERROR }, 500);
  }
});
