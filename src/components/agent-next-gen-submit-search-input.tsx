// SubmitSearchInput — a search field that only actually searches once the
// agent explicitly submits it (Enter, or the arrow button that appears once
// there's a value to search for), instead of lyra-ui's own `SearchInput`
// (used everywhere else in this app via `TableToolbar`'s `searchQuery`/
// `onSearchChange`), which filters on every keystroke.
//
// Built per explicit request, specifically for the Customers and Contacts
// tables: both search a (simulated) database of up to ~50k records, where
// filtering on every keystroke means re-querying that whole set on every
// character typed — fine for the handful of other tables' much smaller
// datasets, not fine here. Real, documented `TableToolbar` props
// (`searchQuery`/`onSearchChange`) have no "defer until submit" mode and no
// slot for injecting a submit button into the search field itself, and
// lyra-ui's own `SearchInput` (search-input.tsx) has no `onSubmit`-style
// prop either — its clear button and hardcoded `pr-9` leave no real room for
// a second, submit button anyway. Rather than forking either of those
// (protected lyra-ui primitives — CLAUDE.md's "never fork a shared
// component for one consumer's need" rule), this is a new, local,
// purpose-built field: same visual language (border/bg/focus-ring tokens
// `SearchInput` itself uses, so it still looks like part of the same
// design system) and the same `role="search"` leading `Search` icon/clear-
// button shape, plus its own trailing arrow submit button — composed
// entirely from real, public primitives (lyra-ui's own exported `Button`,
// `lucide-react` icons), not from anything internal to `search-input.tsx`.
//
// `CustomersListView`/`InteractionsListView` both keep TWO pieces of search
// state: what's currently TYPED (this component's own `value`/
// `onValueChange`, live, same as any other controlled input) and what's
// actually being FILTERED BY (only updated from `onSubmit`, fired on Enter
// or the arrow click). Clearing (the "X" button) submits an empty query
// immediately too — an empty search has nothing left to defer, so it resets
// results right away rather than requiring a second explicit submit.
import * as React from "react";
import { Search, X, ArrowRight } from "lucide-react";
import { Button } from "@nicecxone/lyra-ui";
import { cn } from "@/lib/utils";

export interface SubmitSearchInputProps {
  /** Live, every-keystroke value — what the field currently shows. */
  value: string;
  onValueChange: (value: string) => void;
  /** Fired on Enter or the arrow button click with the field's current
   *  value — this, not `onValueChange`, is what should actually re-run the
   *  (expensive, ~50k-record) search. Also fired with `""` from the clear
   *  button — see this file's own top-of-file doc comment for why clearing
   *  doesn't wait for a second submit. */
  onSubmit: (value: string) => void;
  placeholder?: string;
  "aria-label"?: string;
  className?: string;
}

export function SubmitSearchInput({
  value,
  onValueChange,
  onSubmit,
  placeholder = "Search",
  "aria-label": ariaLabel,
  className,
}: SubmitSearchInputProps) {
  const hasValue = value.length > 0;
  const label = ariaLabel || placeholder;

  return (
    <div className={cn("relative", className)} role="search" aria-label={label}>
      <Search
        className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-lyra-fg-secondary pointer-events-none"
        strokeWidth={1.5}
        aria-hidden="true"
      />
      <input
        type="search"
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && hasValue) onSubmit(value);
        }}
        className={cn(
          "h-8 w-full rounded-lyra-sm border border-lyra-border-strong bg-lyra-bg-field pl-9 lyra-body-md text-lyra-fg-default transition-colors",
          hasValue ? "pr-16" : "pr-9",
          "[&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none",
          "placeholder:text-lyra-fg-disabled",
          "hover:border-lyra-state-border-hover-neutral",
          "focus:border-lyra-border-active focus:outline-none focus:ring-2 focus:ring-lyra-border-focus focus:ring-offset-2"
        )}
      />
      {hasValue && (
        <button
          type="button"
          tabIndex={-1}
          onClick={() => {
            onValueChange("");
            onSubmit("");
          }}
          aria-label="Clear search"
          className="absolute right-9 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-lyra-xs text-lyra-fg-action hover:text-lyra-fg-default hover:bg-lyra-state-hover transition-colors"
        >
          <X className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
        </button>
      )}
      {hasValue && (
        <Button
          type="button"
          variant="default"
          size="icon-sm"
          title="Search"
          onClick={() => onSubmit(value)}
          className="absolute right-1 top-1/2 -translate-y-1/2"
        >
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
        </Button>
      )}
    </div>
  );
}
