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
// The breakpoint is intentionally higher than `TableToolbar`'s own 768 —
// not the same value. When this row is in its NON-stacked (side-by-side)
// state, `TableToolbar` only gets whatever's left of the row after
// `SubmitSearchInput`'s own share (up to its `max-w-[320px]` plus the
// row's `gap-2`) — call it ~330px. If this hook's own threshold were also
// 768, a row narrower than roughly 768+330 could report "not narrow" here
// while `TableToolbar`'s OWN remaining slice is still ≤768 and independ-
// ently renders ITS OWN internal narrow split — filters+actions wrapping
// to a second row inside an otherwise-still-side-by-side layout, which is
// not the clean single-purpose stack this hook exists to produce. Setting
// this hook's own breakpoint to `768 + 330` keeps the two thresholds
// consistent: whenever this hook reports "wide" (search and `TableToolbar`
// side by side), `TableToolbar`'s own remaining width is guaranteed to
// still clear its own 768px threshold too, so it renders its normal
// single-row shape instead of quietly re-wrapping inside its own slice.
import { useCallback, useLayoutEffect, useRef, useState } from "react";

const SEARCH_ROW_RESERVED_WIDTH = 330;
const TOOLBAR_OWN_BREAKPOINT = 768;
export const TOOLBAR_ROW_NARROW_BREAKPOINT = TOOLBAR_OWN_BREAKPOINT + SEARCH_ROW_RESERVED_WIDTH;

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
