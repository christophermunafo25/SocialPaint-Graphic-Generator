import { afterEach, describe, expect, it } from "vitest";
import {
  clearStart,
  handOffStart,
  peekStart,
  requestNewTemplate,
  takeNewTemplateRequest,
} from "./startHandoff";

afterEach(() => {
  clearStart();
  takeNewTemplateRequest();
});

describe("the start handoff", () => {
  it("holds a start until the builder clears it, however often it is read", () => {
    expect(peekStart()).toBeNull();
    handOffStart({ kind: "blank", size: { width: 1080, height: 1350 } });
    expect(peekStart()).toEqual({ kind: "blank", size: { width: 1080, height: 1350 } });
    // A second render reads the same start.
    expect(peekStart()?.kind).toBe("blank");
    clearStart();
    expect(peekStart()).toBeNull();
  });

  it("keeps only the latest start", () => {
    handOffStart({ kind: "blank", size: { width: 1080, height: 1080 } });
    handOffStart({ kind: "blank", size: { width: 1080, height: 1920 } });
    expect(peekStart()).toEqual({ kind: "blank", size: { width: 1080, height: 1920 } });
  });

  it("gives the list a request for New template once", () => {
    expect(takeNewTemplateRequest()).toBe(false);
    requestNewTemplate();
    expect(takeNewTemplateRequest()).toBe(true);
    expect(takeNewTemplateRequest()).toBe(false);
  });
});
