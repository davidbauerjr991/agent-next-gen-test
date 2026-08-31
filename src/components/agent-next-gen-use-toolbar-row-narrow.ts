// useToolbarRowNarrow — measures a row's own rendered width (same
// ResizeObserver-on-own-root pattern `TableToolbar` itself uses for its
// `isNarrow`, table.tsx) and reports whether it should stack its children
// (search on its own full-width row, filters+actions below) instead of
// sitting them side by side.
//
// Built for `CustomersListView`/`InteractionsListView`'s own search+
// filters+actions row, per explicit request ("the row for search, filters
// and controls should be responsive... same responsiveness as depicted in
// lyra-ui"). `SubmitSearchInput` lives OUTSIDE `TableToolbar` now (a flex
// sibling, not passed through `searchQuery`/`onSearchChange` — see that
// component's own top doc comment for why), so `TableToolbar`'s own
// internal `isNarrow` — measured off its OWN root, i.e. only its own
// shrunken remainder of the shared row once our search box takes its
// share — can't by itself reproduce the real "search alone on its own
// full-width row, filters+actions on a shared row below it" shape
// `TableToolbar` uses when narrow (table.tsx's "no title" layout): that
// shape depends on search and filters/actions being able to independently
// occupy a FULL row each, which never happens while they're jammed into
// one shared flex row as fixed-width siblings. This hook drives that same
// stacking decision one level up, on the shared row itself.
//
// The breakpoint matches `TableToolbar`'s own 768 (table.tsx's `isNarrow`)
// per explicit request — this row now stacks at the same width lyra-ui's
// own toolbar does, rather than the wider threshold an earlier version
// used to keep the two independent measurements from disagreeing (that
// guard is no longer applied; below 768 this row stacks, full stop).
import { useCallback, useLayoutEffect, useRef, useState } from "react";

export const TOOLBAR_ROW_NARROW_BREAKPOINT = 768;

export function useToolbarRowNarrow(breakpoint: number = TOOLBAR_ROW_NARROW_BREAKPOINT) {
  const elRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(9999);

  const setRef = useCallback((el: HTMLDivElement | null) => {
    elRef.current = el;
  }, []);

  useLayoutEffect(() => {
    const el = elRef.current;
    if (!el) return;
    setWidth(el.getBoundingClientRect().width);
    const ro = new ResizeObserver(([entry]) => {
      setWidth(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return { ref: setRef, isNarrow: width <= breakpoint };
}
