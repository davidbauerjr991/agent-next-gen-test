// FiltersDropdownChip — a single "Filters" chip that opens a dropdown
// listing every filter field as a real `FilterChip`, with its own search
// box at the top to narrow that field list. Built per explicit request
// ("make the filters a single chip that says 'filters' and when clicked
// display a dropdown of the filters as if they were in responsive
// collapsed mode - add a search filters input to the top of the dropdown
// that searches for filters"), for Customers only for now.
//
// This is real, documented lyra-ui behavior already — `TableToolbar`'s own
// `collapsedFilterChip` (table.tsx) is exactly this "one chip, dropdown of
// FilterChips, Clear all at the bottom" shape, just gated behind its own
// internal `isNarrow` width measurement with no prop to force it on
// unconditionally, and with no field-search box at all. Rather than fork
// that internal, non-exported piece (a protected primitive), this
// reimplements the same shape from real, PUBLIC primitives only
// (`FilterChip`/`SearchInput`, both exported from `@nicecxone/lyra-ui`) —
// same classNames/tokens as `collapsedFilterChip` itself, so it still looks
// like part of the same design system, plus the new field-search box.
//
// `CustomersListView` passes NO `filterDefs`/`filterValues`/`onFilterChange`/
// `onFilterClear` to `TableToolbar` at all when using this (so its own
// automatic chip-row/"+N" rendering never runs) and instead renders this
// component through `TableToolbar`'s `filters` slot — `hasFilters` there is
// `filterChips || filters || showAdvancedSearch`, so passing a real node
// into `filters` alone is enough to keep `TableToolbar` treating this
// toolbar as having filters (correct — it does), with no native chip
// rendering left to conflict with this component's own.
import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { FilterChip, SearchInput, type FilterChipOption } from "@nicecxone/lyra-ui";
import { cn } from "@/lib/utils";

export interface FiltersDropdownChipProps {
  filterDefs: { key: string; label: string; options: FilterChipOption[] }[];
  filterValues: Record<string, string[]>;
  onFilterChange: (key: string, values: string[]) => void;
  onFilterClear: () => void;
}

export function FiltersDropdownChip({
  filterDefs,
  filterValues,
  onFilterChange,
  onFilterClear,
}: FiltersDropdownChipProps) {
  const [open, setOpen] = useState(false);
  const [fieldSearch, setFieldSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  // Same outside-click-closes behavior `collapsedFilterChip` gives its own
  // dropdown — mousedown (not click) so it fires before whatever the click
  // would otherwise trigger. The `data-radix-popper-content-wrapper` check
  // is the same fix `collapsedFilterChip`/`filterOverflowChip` (table.tsx)
  // both need for this identical shape: without it, picking a value inside
  // one of the `FilterChip`s below — itself a separate Radix
  // Popover/Select portaled to `document.body`, outside this container's
  // own DOM subtree — reads as an outside click and closes this whole
  // dropdown out from under the agent mid-selection. Every Radix
  // Popper-based primitive (Popover, Select, DropdownMenu, Tooltip) wraps
  // its portaled content in that same wrapper div.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if ((e.target as Element)?.closest?.("[data-radix-popper-content-wrapper]")) return;
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Reset the field-search box on close — reopening should start showing
  // every field again, not whatever was last typed.
  useEffect(() => {
    if (!open) setFieldSearch("");
  }, [open]);

  const activeFilterCount = Object.values(filterValues).filter((v) => v.length > 0).length;
  const hasActiveFilters = activeFilterCount > 0;
  const query = fieldSearch.trim().toLowerCase();
  const visibleDefs = query ? filterDefs.filter((f) => f.label.toLowerCase().includes(query)) : filterDefs;

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        className={cn(
          "inline-flex items-center gap-1.5 h-8 px-3 rounded-lyra-md lyra-body-md-emphasis border transition-colors whitespace-nowrap",
          hasActiveFilters
            ? "bg-lyra-bg-active-subtle border-lyra-border-active text-lyra-fg-active-strong"
            : "bg-lyra-bg-control border-lyra-border-soft text-lyra-fg-default hover:bg-lyra-state-hover"
        )}
      >
        Filters{hasActiveFilters ? `: ${activeFilterCount} Active` : ""}
        <ChevronDown className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
      </button>
      {open && (
        // `right-0` (not `left-0`, which `collapsedFilterChip` itself uses)
        // — this chip is the only thing left in the toolbar's own filters
        // area now, so it tends to sit well to the right in a narrow docked
        // panel (e.g. the app-header's Search panel); a fixed-width panel
        // opening flush-left of it there overflowed straight off the right
        // edge of the panel. Anchoring to the button's own right edge and
        // growing leftward instead keeps it inside a narrow container.
        // `min-w-[260px]` (not a fixed `w-[260px]`, which clipped/overflowed
        // a `FilterChip` whose own selected-values label renders wider than
        // that, e.g. "Customer ID: CST-10000 +3") — same `min-w` (not fixed
        // width) `collapsedFilterChip` itself uses, so this box always
        // grows to actually fit its widest child instead of letting one
        // poke out past its own edge. `max-w-[calc(100vw-1rem)]` is a hard
        // backstop against the viewport itself for pathologically narrow
        // cases — real collision detection (flipping/shifting to whichever
        // side actually has room) needs a positioning primitive like
        // `Popover`'s own Radix `avoidCollisions`, not plain CSS.
        <div className="absolute right-0 top-full mt-1 z-50 min-w-[260px] max-w-[calc(100vw-1rem)] rounded-lyra-md border border-lyra-border-subtle bg-lyra-bg-surface-overlay shadow-lg p-3 flex flex-col gap-2">
          <SearchInput
            value={fieldSearch}
            onValueChange={setFieldSearch}
            placeholder="Search filters"
            aria-label="Search filters"
            size="sm"
          />
          {visibleDefs.length === 0 ? (
            <p className="lyra-body-sm text-lyra-fg-disabled text-center py-2">No matching filters</p>
          ) : (
            visibleDefs.map((f) => (
              <FilterChip
                key={f.key}
                label={f.label}
                options={f.options}
                selectedValues={filterValues[f.key] ?? []}
                onSelectionChange={(vals) => onFilterChange(f.key, vals)}
              />
            ))
          )}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => {
                onFilterClear();
                setOpen(false);
              }}
              className="lyra-body-md text-lyra-fg-secondary hover:text-lyra-fg-default transition-colors text-left"
            >
              Clear all
            </button>
          )}
        </div>
      )}
    </div>
  );
}
