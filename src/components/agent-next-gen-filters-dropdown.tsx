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
// wrapper is a real `flex-1 min-h-0` flex item of Popover's own body
// region (see that div's own doc comment below for why, and for the
// upstream lyra-ui fix this adopts), so the chevron-scrolling inner list
// — not Popover's own body scroll region — is what actually scrolls in
// practice, exactly like `select.tsx`'s/`tag-picker.tsx`'s own `content`
// nesting a second, self-contained scroll region the same way.
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
  // `filterValues` is in these deps too (not just `open`/`fieldSearch`) —
  // per explicit bug report ("the bottom chevron is not displaying"):
  // picking a value inside one of the `FilterChip`s below can change that
  // chip's own rendered width/label (e.g. "Group" → "Group: Enterprise"),
  // which can change the whole list's scrollable content height. Without
  // `filterValues` here, `canScrollUp`/`canScrollDown` only ever recomputed
  // on open/search-text changes (or on an actual scroll event, via
  // `onListScroll` below) — so right after picking a value, the chevrons
  // could sit stale until the next incidental scroll, at exactly the
  // moment there was newly more (or less) content to reflect.
  const { canScrollUp, canScrollDown, onScroll: onListScroll } = useScrollChevrons(listRef, [
    open,
    fieldSearch,
    filterValues,
  ]);
  const scrollListBy = (delta: number) => {
    listRef.current?.scrollBy({ top: delta });
  };

  // Reset the field-search box on close — reopening should start showing
  // every field again, not whatever was last typed.
  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setFieldSearch("");
  };

  // Per explicit bug report ("I am able to open multiple filter menus at
  // once - this is confusing - if one is open the other should close"):
  // each `FilterChip` below manages its OWN open/closed state fully
  // internally (filter-chip.tsx's own `useState`) with no `open`/
  // `onOpenChange` prop exposed to control or even observe it — there's no
  // real, public way to tell one chip "close yourself" directly. This
  // tracks which chip was most recently interacted with (a capture-phase
  // `onPointerDownCapture` on each chip's own wrapper below — fires before
  // the chip's own click handler, so it catches "the user is about to open
  // this one" without needing any cooperation from `FilterChip` itself),
  // and forces the PREVIOUSLY-active chip to remount (via a changed `key`,
  // ordinary React — not a fork of `FilterChip`) whenever a new one
  // activates, which resets that one chip's own internal `open` state back
  // to its default `false`.
  //
  // `remountKeys` holds a per-field remount counter, bumped ONLY for the
  // chip that's losing focus — never for the one gaining it. An earlier
  // version bumped a single shared `closeGeneration` and folded it into
  // every non-active chip's key including, transiently, the one about to
  // become active (its key read as "closed" until this state update
  // landed). That remounted the newly-active chip's own button between its
  // `pointerdown` and the `click` that follows it, destroying and
  // recreating the button mid-interaction and orphaning that pending click
  // — the reported "now i need to click TWICE to open a filter menu" bug.
  // Only ever touching the OUTGOING chip's counter means the chip a click
  // is currently in flight on is never remounted by that same click.
  const [activeFilterKey, setActiveFilterKey] = useState<string | null>(null);
  const [remountKeys, setRemountKeys] = useState<Record<string, number>>({});
  const handleFilterChipActivate = (key: string) => {
    if (key === activeFilterKey) return;
    if (activeFilterKey !== null) {
      setRemountKeys((prev) => ({ ...prev, [activeFilterKey]: (prev[activeFilterKey] ?? 0) + 1 }));
    }
    setActiveFilterKey(key);
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
        // `flex-1 min-h-0` — the real, bulletproof fix (adopted from
        // lyra-ui's own `Popover`/`select.tsx`/`tag-picker.tsx`, updated to
        // make Popover's body wrapper an actual flex CONTAINER — not just a
        // flex item — whenever `header`/`footer` is present, specifically
        // so a `content` slot managing its own internal scroll region can
        // shrink itself via ordinary `flex-1 min-h-0`, exactly like this).
        // My earlier attempt (reading `var(--radix-popover-content-
        // available-height)` directly here) worked around the SAME real
        // bug lyra-ui itself just fixed at its source — Popover's body
        // wrapper wasn't a real flex container, so a child's height only
        // had CSS-var-reading or percentage-height guessing to go on, both
        // fragile. With the real fix in place, plain flexbox sizing is all
        // this needs, same as `Select`'s multi-select listbox and
        // `TagPicker` (select.tsx, tag-picker.tsx) — no self-imposed
        // `max-h-[Npx]` cap the way those two add on top of `flex-1
        // min-h-0`, since our field list is a small, fixed set of known
        // filters (never open-ended the way an arbitrary option list can
        // be) and the whole point here was to only scroll once actually
        // out of real screen space, not before.
        <div className="flex flex-1 min-h-0 flex-col overflow-hidden px-3 py-1">
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
                <div key={f.key} onPointerDownCapture={() => handleFilterChipActivate(f.key)}>
                  <FilterChip
                    key={`${f.key}-${remountKeys[f.key] ?? 0}`}
                    label={f.label}
                    options={f.options}
                    selectedValues={filterValues[f.key] ?? []}
                    onSelectionChange={(vals) => onFilterChange(f.key, vals)}
                  />
                </div>
              ))
            )}
          </div>
          {canScrollDown && <ScrollChevronButton direction="down" onStep={() => scrollListBy(6)} />}
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
