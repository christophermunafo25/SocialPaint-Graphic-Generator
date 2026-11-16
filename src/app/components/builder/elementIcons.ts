import {
  Badge as BadgeGlyph,
  Circle,
  Image as ImageGlyph,
  List,
  Minus,
  RectangleHorizontal,
  Smile,
  Square,
  Star,
  Text as TextGlyph,
  Triangle,
  Type as TypeGlyph,
  type LucideIcon,
} from "lucide-react";
import type { TemplateField } from "@/lib/types";

/** A rectangle this thin is a rule: the palette's Line lands 8 tall. */
const RULE_MAX_PX = 8;

/** The glyph an element wears in the Layers list and the inspector's header,
 * from the file's Layer Row icons (322:186): a T for text, lines for a
 * paragraph, a badge for a logo, a capsule for a plated pill, and a shape's
 * own outline. */
export function elementIcon(field: TemplateField, isLogo = false): LucideIcon {
  switch (field.type) {
    case "text":
      return field.plateColor ? RectangleHorizontal : TypeGlyph;
    case "multiline":
      return TextGlyph;
    case "select":
      return List;
    case "image":
      return isLogo ? BadgeGlyph : ImageGlyph;
    case "icon":
      return Smile;
    case "shape":
      switch (field.shape) {
        case "ellipse":
          return Circle;
        case "triangle":
          return Triangle;
        case "star":
          return Star;
        default:
          return Math.min(field.width, field.height) <= RULE_MAX_PX ? Minus : Square;
      }
  }
}
