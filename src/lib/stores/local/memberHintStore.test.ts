import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocalMemberHintStore } from "./localStores";

/** A Map-backed localStorage for the node test environment. */
function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => void data.delete(k),
    setItem: (k, v) => void data.set(k, String(v)),
  };
}

describe("LocalMemberHintStore", () => {
  beforeEach(() => vi.stubGlobal("localStorage", memoryStorage()));
  afterEach(() => vi.unstubAllGlobals());

  it("starts with no hints seen, per user", async () => {
    const store = new LocalMemberHintStore();
    expect(await store.get("u1")).toEqual({ plusOpened: false, templateChatsStarted: 0 });
  });

  it("counts template chats and remembers the plus, under one key", async () => {
    const store = new LocalMemberHintStore();
    expect(await store.noteTemplateChatStarted("u1")).toBe(1);
    expect(await store.noteTemplateChatStarted("u1")).toBe(2);
    await store.markPlusOpened("u1");
    expect(await store.get("u1")).toEqual({ plusOpened: true, templateChatsStarted: 2 });
    expect(await store.get("u2")).toEqual({ plusOpened: false, templateChatsStarted: 0 });
    expect(Object.keys(JSON.parse(localStorage.getItem("sp:member-hints:v1")!))).toEqual(["u1"]);
  });

  it("reads corrupt or unavailable storage as no hints yet", async () => {
    localStorage.setItem("sp:member-hints:v1", "{not json");
    const store = new LocalMemberHintStore();
    expect(await store.get("u1")).toEqual({ plusOpened: false, templateChatsStarted: 0 });
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    });
    await expect(store.markPlusOpened("u1")).resolves.toBeUndefined();
    expect(await store.get("u1")).toEqual({ plusOpened: false, templateChatsStarted: 0 });
  });
});
