import { describe, expect, it } from "vitest";
import { mergeVisibleOrder, mergeVisibleRefs } from "./formOrder";

type F = { id: string; static?: boolean };
const f = (id: string, fixed = false): F => (fixed ? { id, static: true } : { id });

const ids = (xs: readonly F[]) => xs.map((x) => x.id);

describe("mergeVisibleOrder", () => {
  it("swaps two visible fields around a fixed field without moving it", () => {
    const all = [f("a"), f("logo", true), f("b")];
    const out = mergeVisibleOrder(all, [f("b"), f("a")]);
    expect(ids(out)).toEqual(["b", "logo", "a"]);
    expect(out[1]).toBe(all[1]);
  });

  it("keeps every hidden element at its original index across a longer move", () => {
    const all = [f("a"), f("shape", true), f("b"), f("logo", true), f("c"), f("d")];
    const out = mergeVisibleOrder(all, [f("d"), f("a"), f("b"), f("c")]);
    expect(ids(out)).toEqual(["d", "shape", "a", "logo", "b", "c"]);
  });

  it("preserves the array length in every case", () => {
    const all = [f("a"), f("x", true), f("b"), f("c")];
    expect(mergeVisibleOrder(all, [f("c"), f("b"), f("a")])).toHaveLength(4);
    expect(mergeVisibleOrder(all, [])).toHaveLength(4);
    expect(mergeVisibleOrder(all, [f("a")])).toHaveLength(4);
    expect(mergeVisibleOrder([], [])).toHaveLength(0);
  });

  it("returns the original order unchanged when nextVisible adds an id", () => {
    const all = [f("a"), f("x", true), f("b")];
    expect(ids(mergeVisibleOrder(all, [f("b"), f("a"), f("ghost")]))).toEqual(["a", "x", "b"]);
  });

  it("returns the original order unchanged when nextVisible drops an id it should hold", () => {
    // The caller only ever passes back the same set it was shown; a subset
    // that lost a member is a bug upstream, and refusing it keeps the
    // template intact.
    const all = [f("a"), f("x", true), f("b")];
    const out = mergeVisibleOrder(all, [f("b"), f("b")]);
    expect(ids(out)).toEqual(["a", "x", "b"]);
  });

  it("does not mutate its inputs", () => {
    const all = [f("a"), f("b")];
    const next = [f("b"), f("a")];
    mergeVisibleOrder(all, next);
    expect(ids(all)).toEqual(["a", "b"]);
    expect(ids(next)).toEqual(["b", "a"]);
  });
});

describe("mergeVisibleRefs", () => {
  it("reorders visible child refs around a fixed one", () => {
    const all = ["name", "group:g2", "title"];
    expect(mergeVisibleRefs(all, ["title", "name"])).toEqual(["title", "group:g2", "name"]);
  });

  it("refuses a lossy write", () => {
    const all = ["name", "logo", "title"];
    expect(mergeVisibleRefs(all, ["title"])).toEqual(all);
    expect(mergeVisibleRefs(all, ["title", "name", "extra"])).toEqual(all);
  });
});
