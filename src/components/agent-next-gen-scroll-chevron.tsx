// useScrollChevrons / ScrollChevronButton — a local reimplementation of
// lyra-ui's own internal scroll-chevron affordance (scroll-chevron.tsx),
// used by its real menu-style components (`Select`'s multi-select listbox,
// `MenuRadix`, `TabList`'s horizontal overflow) in place of a native
// scrollbar: a small chevron button pinned above/below (or beside) a
// scrollable list, held down — actually hovered — to continuously scroll,
// only shown while there's actually more content in that direction.
//
// Built per explicit request ("the overflow should be the chevron scroll
// like other menus") for `FiltersDropdownChip`'s field list, to match that
// same real, established pattern instead of a plain browser scrollbar.
// `useScrollChevrons`/`ScrollChevronButton` are lyra-ui's OWN real
// components already, but only used internally — not part of the package's
// public export surface (`@nicecxone/lyra-ui`'s index.ts) — so they can't
// be imported directly here. Rather than fork that internal, non-exported
// piece (a protected primitive), this reproduces the same behavior/styling
// from scratch, using only public building blocks (lucide-react's chevron
// icons, plain React/DOM APIs) — same hover-driven continuous-scroll
// mechanic, same "no hover background, just the arrow's own color" look,
// same className tokens, so it still reads as the same design-system
// affordance everywhere else already uses.
import * as React from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function useScrollChevrons(ref: React.RefObject<HTMLElement | null>, deps: React.DependencyList) {
  const [canScrollUp, setCanScrollUp] = React.useState(false);
  const [canScrollDown, setCanScrollDown] = React.useState(false);

  const update = React.useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setCanScrollUp(el.scrollTop > 0);
    setCanScrollDown(el.scrollTop + el.clientHeight < el.scrollHeight - 1);
  }, [ref]);

  React.useLayoutEffect(() => {
    requestAnimationFrame(update);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { canScrollUp, canScrollDown, onScroll: update, recompute: update };
}

export function ScrollChevronButton({ direction, onStep }: { direction: "up" | "down"; onStep: () => void }) {
  const rafRef = React.useRef<number | null>(null);

  const stop = React.useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const start = React.useCallback(() => {
    const tick = () => {
      onStep();
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [onStep]);

  React.useEffect(() => stop, [stop]);

  const Icon = direction === "up" ? ChevronUp : ChevronDown;

  return (
    <button
      type="button"
      tabIndex={-1}
      onMouseEnter={start}
      onMouseLeave={stop}
      onMouseDown={(e) => e.preventDefault()}
      aria-label={direction === "up" ? "Scroll up" : "Scroll down"}
      className={cn("shrink-0 flex items-center justify-center text-lyra-fg-secondary rounded-lyra-xs py-1")}
    >
      <Icon className="h-4 w-4" strokeWidth={1.5} />
    </button>
  );
}
