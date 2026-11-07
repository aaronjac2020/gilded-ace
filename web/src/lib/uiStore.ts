import { useCallback, useSyncExternalStore } from "react";
import { useSearchParams } from "react-router-dom";

/** Tiny external store for cross-component UI state (hover highlight, current drawer list, tour). */
function createStore<T>(initial: T) {
  let v = initial;
  const subs = new Set<() => void>();
  return {
    get: () => v,
    set: (n: T) => {
      if (n === v) return;
      v = n;
      subs.forEach((f) => f());
    },
    sub: (f: () => void) => {
      subs.add(f);
      return () => subs.delete(f);
    },
  };
}

/** Focus + context: the machine/bank/zone under the pointer anywhere; others dim. */
export const hoverStore = createStore<string | null>(null);
export const useHover = () => useSyncExternalStore(hoverStore.sub, hoverStore.get);

/** The list the drawer steps through with ←/→ (set by whichever screen opened it). */
export const drawerList = createStore<string[]>([]);
export const useDrawerList = () => useSyncExternalStore(drawerList.sub, drawerList.get);

export const tourStore = createStore<number | null>(null);
export const useTour = () => useSyncExternalStore(tourStore.sub, tourStore.get);

export const shortcutsStore = createStore(false);
export const useShortcutsOpen = () => useSyncExternalStore(shortcutsStore.sub, shortcutsStore.get);

export const commandStore = createStore(false);

/** True while month playback runs; live regions stay quiet so autoplay doesn't chatter. */
export const playingStore = createStore(false);
export const usePlaying = () => useSyncExternalStore(playingStore.sub, playingStore.get);
export const useCommandOpen = () => useSyncExternalStore(commandStore.sub, commandStore.get);

/** Open/close the machine drawer via ?machine= so it stays deep-linkable. */
export function useMachineParam(): [string | null, (id: string | null, list?: string[]) => void] {
  const [sp, setSp] = useSearchParams();
  const set = useCallback(
    (id: string | null, list?: string[]) => {
      if (list) drawerList.set(list);
      setSp(
        (p) => {
          const n = new URLSearchParams(p);
          if (id) n.set("machine", id);
          else n.delete("machine");
          return n;
        },
        { replace: true },
      );
    },
    [setSp],
  );
  return [sp.get("machine"), set];
}
