import { describe, expect, it } from "vitest";
import {
  Badge,
  Circle,
  Image,
  List,
  Minus,
  RectangleHorizontal,
  Smile,
  Square,
  Star,
  Text,
  Triangle,
  Type,
} from "lucide-react";
import type { TemplateField } from "@/lib/types";
import { elementIcon } from "./elementIcons";

const field = (over: Partial<TemplateField>) =>
  ({
    id: "f",
    label: "F",
    fieldKey: "f",
    type: "text",
    x: 0,
    y: 0,
    width: 400,
    height: 80,
    ...over,
  }) as TemplateField;

describe("elementIcon", () => {
  it("gives text, a paragraph, a dropdown and a pill their glyphs", () => {
    expect(elementIcon(field({ type: "text" }))).toBe(Type);
    expect(elementIcon(field({ type: "text", plateColor: "#000000" }))).toBe(RectangleHorizontal);
    expect(elementIcon(field({ type: "multiline" }))).toBe(Text);
    expect(elementIcon(field({ type: "select" }))).toBe(List);
  });

  it("tells a logo from an image", () => {
    expect(elementIcon(field({ type: "image" }))).toBe(Image);
    expect(elementIcon(field({ type: "image" }), true)).toBe(Badge);
  });

  it("draws a shape's own outline, and a thin rectangle as a rule", () => {
    expect(elementIcon(field({ type: "shape", shape: "ellipse" }))).toBe(Circle);
    expect(elementIcon(field({ type: "shape", shape: "triangle" }))).toBe(Triangle);
    expect(elementIcon(field({ type: "shape", shape: "star" }))).toBe(Star);
    expect(elementIcon(field({ type: "shape", shape: "rect" }))).toBe(Square);
    expect(elementIcon(field({ type: "shape", width: 480, height: 8 }))).toBe(Minus);
    expect(elementIcon(field({ type: "icon" }))).toBe(Smile);
  });
});
