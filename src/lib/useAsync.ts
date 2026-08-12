import { useCallback, useEffect, useRef, useState } from "react";

/** Discriminated async-load state: a failed request is an ERROR, never an
 * empty collection. UIs must branch three ways — loading / error / ready —
 * so a network failure can't masquerade as "no data" (the empty state stays
 * reserved for a genuinely empty `ready` result). */
export type AsyncState<T> =
  | { status: "loading" }
  | { status: "error"; error: Error; retry: () => void }
  | { status: "ready"; data: T };

/** Runs `loader` whenever `deps` change. A mounted flag stops a late promise
 * from setting state after unmount; `retry` re-runs the loader in place (no
 * page reload). Errors are logged here — call sites show plain copy only. */
export function useAsync<T>(loader: () => Promise<T>, deps: React.DependencyList): AsyncState<T> {
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const [tick, setTick] = useState(0);
  const retry = useCallback(() => setTick((t) => t + 1), []);
  const [state, setState] = useState<AsyncState<T>>({ status: "loading" });

  useEffect(() => {
    let alive = true;
    setState({ status: "loading" });
    loaderRef.current().then(
      (data) => {
        if (alive) setState({ status: "ready", data });
      },
      (e: unknown) => {
        console.error("Load failed", e);
        if (alive)
          setState({
            status: "error",
            error: e instanceof Error ? e : new Error(String(e)),
            retry,
          });
      },
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  return state;
}
