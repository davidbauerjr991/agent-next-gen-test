// FiltersDropdownChip — a single "Filters" chip that opens a dropdown
// listing every filter field as a real `FilterChip`, with its own search
// box at the top to narrow that field list. Built per explicit request
// ("make the filters a single chip that says 'filters' and when clicked
// display a dropdown of the filters as if they were in responsive
// collapsed mode - add a search filters input to the top of the dropdown
// that searches for filters"), for Customers only for now.
//
// Built on lyra-ui's own real, public `Popover` primitive (`header`/
// `content`/`footer` slots) — per explicit follow-up bug report ("is
// there a min-height on this or something? it's getting cut off"). The
// earlier version was a hand-rolled `position: absolute` div anchored
// with a guessed `max-h-[70vh]` cap and no real collision detection: it
// could open past whatever space was actually available below the
// trigger, and — being plain `position: absolute` rather than portaled —
// was vulnerable to being clipped by any scrollable ancestor (e.g. the
// docked Search panel this renders inside). `Popover` solves both for
// real: its content is portaled straight to `document.body` (escapes
// ancestor overflow-clipping entirely), and Radix Popper's own
// `avoidCollisions`/`--radix-popover-content-available-height` measure
// the ACTUAL gap between the trigger and the nearest viewport edge, so
// there's no fixed height to guess at all — see `select.tsx`'s own
// multi-select listbox, the same Popover-based "search box (fixed) +
// scrollable option list" shape this mirrors.
//
// Adopting the real `Popover` also retires every hand-rolled workaround
// the old div-based version needed: no more manual outside-click
// `mousedown` listener or its `data-radix-popper-content-wrapper`
// closest() exemption (a real Radix `Popover.Root`'s own dismissable-
// layer stack already recognizes a NESTED Radix-portaled layer — e.g. a
// `FilterChip`'s own internal picker — as "inside", so selecting a filter
// value no longer risks closing this dropdown out from under it — the
// old hand-rolled div was never part of that layer stack in the first
// place, which is why it needed the workaround at all); no more manual
// `right-0`/`min-w`/`max-w` viewport-escape CSS (`align="end"` plus
// Radix's real collision detection replace it, via `maxWidth` — a real
// `Popover` prop for exactly this — instead of a calc() className hack);
// no more local open/close toggle wiring on the trigger button
// (`Popover`'s own `PopoverTrigger` "asChild" click handling covers it).
//
// The field list itself still uses the same hover-driven chevron-scroll
// affordance lyra-ui's own real menu-style components use instead of a
// native scrollbar (agent-next-gen-scroll-chevron.tsx, per explicit
// request "the overflow should be the chevron scroll like other menus")
// — same reasoning as before, just now living inside `Popover`'s
// `content` slot instead of a hand-rolled wrapper div. `content`'s own
// `h-full` stretches it to fill whatever real available height `Popover`
// computed for its body region, so the chevron-scrolling inner list — not
// `Popover`'s own body scroll region — is what actually scrolls in
// practice (mirrors `select.tsx`'s own `content` nesting a second,
// self-contained scroll region the same way).
//
// `CustomersListView` passes NO `filterDefs`/`filterValues`/`onFilterChange`/
// `onFilterClear` to `TableToolbar` at all when using this (so its own
// automatic chip-row/"+N" rendering never runs) and instead renders this
// component through `TableToolbar`'s `filters` slot — `hasFilters` there is
// `filterChips || filters || showAdvancedSearch`, so passing a real node
// into `filters` alone is enough to keep `TableToolbar` treating this
// toolbar as having filters (correct — it does), with no native chip
// rendering left to conflict with this component's own.
import { useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { FilterChip, Popover, SearchInput, type FilterChipOption } from "@nicecxone/lyra-ui";
import { cn } from "@/lib/utils";
import { useScrollChevrons, ScrollChevronButton } from "@/components/agent-next-gen-scroll-chevron";

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
  // Same hover-driven chevron-scroll affordance lyra-ui's own real menu-
  // style components use for an overflowing list (`Select`'s multi-select
  // listbox, `MenuRadix`) instead of a plain scrollbar — see
  // agent-next-gen-scroll-chevron.tsx's own top doc comment for why this
  // is a local reimplementation rather than an import from lyra-ui itself.
  const listRef = useRef<HTMLDivElement>(null);
  const { canScrollUp, canScrollDown, onScroll: onListScroll } = useScrollChevrons(listRef, [open, fieldSearch]);
  const scrollListBy = (delta: number) => {
    listRef.current?.scrollBy({ top: delta });
  };

  // Reset the field-search box on close — reopening should start showing
  // every field again, not whatever was last typed.
  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setFieldSearch("");
  };

  const activeFilterCount = Object.values(filterValues).filter((v) => v.length > 0).length;
  const hasActiveFilters = activeFilterCount > 0;
  const query = fieldSearch.trim().toLowerCase();
  const visibleDefs = query ? filterDefs.filter((f) => f.label.toLowerCase().includes(query)) : filterDefs;

  return (
    <Popover
      open={open}
      onOpenChange={handleOpenChange}
      placement="bottom"
      // `align="end"` (not the default "center") — this chip is the only
      // thing left in the toolbar's own filters area now, so it tends to
      // sit well to the right in a narrow docked panel (e.g. the
      // app-header's Search panel); aligning the panel's own end edge to
      // the trigger's end edge keeps it growing leftward, matching the
      // old hand-rolled version's `right-0` anchor without needing custom
      // CSS for it.
      align="end"
      sideOffset={4}
      showArrow={false}
      // Full-bleed content (the field list already carries its own
      // padding/insets below) — matches `select.tsx`'s own multi-select
      // listbox for the identical reason.
      bodyPadding={false}
      maxWidth="calc(100vw - 1rem)"
      className="min-w-[260px]"
      header={
        <div className="px-3 pt-3 pb-2">
          <SearchInput
            value={fieldSearch}
            onValueChange={setFieldSearch}
            placeholder="Search filters"
            aria-label="Search filters"
            size="sm"
          />
        </div>
      }
      footer={
        hasActiveFilters ? (
          <div className="px-3 pb-3 pt-2 border-t border-lyra-border-subtle">
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
          </div>
        ) : undefined
      }
      content={
        // `maxHeight: var(--radix-popover-content-available-height)` —
        // the same real CSS custom property Radix Popper sets on the
        // Content element itself (see popover.tsx's own comment on this
        // exact variable) — read directly here instead of relying on this
        // div's height:100% resolving through Popover's own body wrapper
        // (a `flex: 1 1 auto` item one level up). Custom properties
        // inherit to every descendant regardless of layout mode, so this
        // is a hard, direct cap independent of any ambiguity in that
        // intermediate flex-percentage chain — without it, if this div's
        // own height silently fell back to its natural (unclamped)
        // content size, it would grow past `Popover`'s own body region
        // and its plain, un-hidden `overflow-auto` scrollbar (not this
        // component's own hidden-scrollbar/chevron list) would end up
        // being what actually scrolls — exactly the "using the scrollbar
        // instead of the chevron scroll" bug this fixes.
        <div
          className="flex flex-col min-h-0 overflow-hidden px-3 py-1"
          style={{ maxHeight: "var(--radix-popover-content-available-height)" }}
        >
          {canScrollUp && <ScrollChevronButton direction="up" onStep={() => scrollListBy(-6)} />}
          <div
            ref={listRef}
            onScroll={onListScroll}
            className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-2 py-1 [&::-webkit-scrollbar]:hidden"
            style={{ scrollbarWidth: "none" }}
          >
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
          </div>
        </div>
      }
    >
      <button
        type="button"
        className={cn(
          "shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-lyra-md lyra-body-md-emphasis border transition-colors whitespace-nowrap",
          hasActiveFilters
            ? "bg-lyra-bg-active-subtle border-lyra-border-active text-lyra-fg-active-strong"
            : "bg-lyra-bg-control border-lyra-border-soft text-lyra-fg-default hover:bg-lyra-state-hover"
        )}
      >
        Filters{hasActiveFilters ? `: ${activeFilterCount} Active` : ""}
        <ChevronDown className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
      </button>
    </Popover>
  );
}
