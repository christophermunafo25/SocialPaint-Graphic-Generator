// A dev-backend hook for the screenshot run (new look, Phase 9): it holds a
// page in its loading or error state, which the instant local backend never
// shows long enough to capture. sessionStorage "sp-dev-stall" maps
// "store.method" (or "store.*") to "hang" (the promise never settles) or
// "fail" (it rejects). Absent, every call passes straight through.

type Stall = "hang" | "fail";

function readStalls(): Record<string, Stall> {
  try {
    const raw = sessionStorage.getItem("sp-dev-stall");
    return raw ? (JSON.parse(raw) as Record<string, Stall>) : {};
  } catch {
    return {};
  }
}

export function withDevStall<T extends object>(store: T, name: string): T {
  const stalls = readStalls();
  if (!Object.keys(stalls).some((k) => k.startsWith(`${name}.`))) return store;
  return new Proxy(store, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver) as unknown;
      if (typeof value !== "function" || typeof prop !== "string") return value;
      const stall = stalls[`${name}.${prop}`] ?? stalls[`${name}.*`];
      if (!stall) return value;
      return () =>
        stall === "hang"
          ? new Promise(() => {})
          : Promise.reject(new Error(`Dev stall: ${name}.${prop}`));
    },
  });
}
