// Agent Workspace Advanced's own "Search" experience.
//
// Per explicit request (with a reference screenshot): replaces the old
// TabList-based Search panel (`agent-next-gen-search-panel.tsx`'s
// `useSearchPanelContent`, still used UNCHANGED by `AgentNextGenPage.tsx`/
// `AgentWorkspace2WithDeskPage.tsx` — this file doesn't touch that one at
// all) with a single entity-type dropdown next to a real search field and
// an explicit "Search" button, gated behind that click rather than always
// showing live-filtered content the instant the panel opens.
//
// Deliberately a SEPARATE, self-contained file — not a change to the
// shared `agent-next-gen-search-panel.tsx` — per explicit request, so this
// can be ported to `agent-next-gen-v2`/`lyra-ui` on its own later if it's
// kept, without carrying the older tab-based panel's shape along, and
// without touching either of the other two tiers' own Search panel.
//
// Scope, per explicit request: "Customers" and "Contacts" get the real
// treatment below, reusing each one's own already-existing, already-full
// list component (`CustomersListView`/`InteractionsListView`) — every
// filter either one already supports (the full "+ Filter" menus in
// agent-next-gen-customers-table.tsx / agent-next-gen-interactions-
// table.tsx) is what shows here, not a hand-picked subset and not the
// placeholder chip labels the reference screenshot happened to show (that
// screenshot's own "Status/Skill/Channel/..." chips don't correspond to
// this app's real Customer fields at all — see `AdvancedSearchCustomersProps`'
// own doc comment). Three small, additive, backward-compatible follow-up
// requests since then (all real props those two files now expose, off by
// default — see `viewsControl`'s own doc comment on each): every filter
// shows as a live, permanent chip (no manual "+ Filter" pick, no per-chip
// remove) instead of the normal add-one-at-a-time toolbar behavior; each
// list's own in-table search field is replaced with a "Views" dropdown (a
// stand-in for a future admin-configured list — just "All" today); and,
// per the latest follow-up, those filter chips render in THIS panel's own
// always-visible header — below the entity/search/Search row, above the
// divider — rather than inside either list's toolbar, and are visible and
// usable immediately when the panel opens, before the agent ever clicks
// "Search" (see the `headerContent` filter row below, and `CUSTOMER_FILTER_
// VALUE_OPTIONS`/`INTERACTION_HISTORY_FILTER_VALUE_OPTIONS`, both widened
// from module-private to support it). "Messages"/"Threads" are selectable
// in the dropdown but render "Coming soon" — same placeholder copy the old
// panel already used for those two — per explicit request to leave those
// for later.
import { useState, useEffect, useRef, type KeyboardEvent } from "react";
import { Search as SearchIcon } from "lucide-react";
import {
  Select,
  SearchInput,
  Button,
  FilterChip,
  DateRangeFilterChip,
  type DateRangeFilterValue,
  type DateRangePickerProps,
  type EmbeddablePanelContent,
  type ChannelType,
  type CreateNewOutboundContact,
  type SortDirection,
  type ToastItem,
} from "@nicecxone/lyra-ui";
import {
  InteractionsListView,
  type InteractionHistoryRecord,
  INTERACTION_HISTORY_ADDABLE_FILTER_OPTIONS,
  INTERACTION_HISTORY_FILTER_FIELD_DEFS,
  INTERACTION_HISTORY_FILTER_VALUE_OPTIONS,
} from "@/components/agent-next-gen-interactions-table";
import {
  CustomersListView,
  type CustomerListRecord,
  type CustomerColKey,
  CUSTOMER_FILTER_FIELD_DEFS,
  CUSTOMER_FILTER_VALUE_OPTIONS,
} from "@/components/agent-next-gen-customers-table";
import {
  CustomerRowInfoPanel,
  AGENT_WORKSPACE_CUSTOMER_PANEL_TABS,
} from "@/components/agent-next-gen-customer-info-panel";

/** Which entity type is selected in the dropdown — the reference
 *  screenshot's own "Customers" box, now a real `Select` rather than a
 *  static label. `Record` key order below doubles as the dropdown's own
 *  option order. */
export type AdvancedSearchEntityType = "customers" | "contacts" | "messages" | "threads";

export const ADVANCED_SEARCH_ENTITY_LABELS: Record<AdvancedSearchEntityType, string> = {
  customers: "Customers",
  contacts: "Contacts",
  messages: "Messages",
  threads: "Threads",
};

/** Every entity type that actually has real content behind it today —
 *  drives whether the search field/button render at all, vs. going
 *  straight to "Coming soon" with no search chrome pretending there's
 *  something to search yet. */
const POPULATED_ENTITY_TYPES: AdvancedSearchEntityType[] = ["customers", "contacts"];

// Per explicit request ("all of these filters should be visible as chips
// when the search loads", later widened to show them BEFORE the search
// too): every real key each list already supports as a filter — not a
// hand-picked subset — kept permanently "added" for both entity types
// (Customers via the mount-time effect below; Contacts by simply always
// passing this constant, since it never needs to change) instead of the
// normal "starts empty, add one at a time" behavior both `CustomersListView`/
// `InteractionsListView` still default to for every other consumer. Also
// doubles as the key list this file's own `headerContent` filter row below
// iterates to build each entity's permanent `FilterChip`s.
const ALL_CUSTOMER_FILTER_KEYS = CUSTOMER_FILTER_FIELD_DEFS.map((f) => f.key);
const ALL_INTERACTION_FILTER_KEYS = INTERACTION_HISTORY_ADDABLE_FILTER_OPTIONS.map((f) => f.value);

// Per explicit request ("make this a dropdown for 'Views' that are
// configured by the admin and set it to 'All' to start"): a placeholder for
// a future admin-configured list — today there's only the one required
// entry, selected by default, same as a fresh admin setup would ship with
// nothing else configured yet.
const VIEWS_OPTIONS = [{ value: "all", label: "All" }];

/** Everything the "Customers" entity needs — deliberately the SAME shape
 *  `SearchPanelCustomersProps` (agent-next-gen-search-panel.tsx) already
 *  defines, field-for-field, so `AgentWorkspaceAdvancedPage.tsx`'s existing
 *  lifted Customers state/handlers (already built for that older hook) can
 *  be handed to this one completely unchanged — just duplicated here
 *  rather than imported from that file, so this file has no dependency on
 *  the older panel at all, matching its own "portable on its own" reason
 *  for existing as a separate file in the first place. */
export interface AdvancedSearchCustomersProps {
  onStartInteraction: (
    contact: CreateNewOutboundContact,
    channel: ChannelType,
    phone: string,
    skillId: string
  ) => void;
  addedFilterKeys: string[];
  onAddedFilterKeysChange: (keys: string[]) => void;
  filterValues: Record<string, string[]>;
  onFilterValuesChange: (values: Record<string, string[]>) => void;
  onRowClick: (row: CustomerListRecord) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sortKey: CustomerColKey | null;
  sortDir: SortDirection;
  onSort: (key: CustomerColKey) => void;
  sortedRows: CustomerListRecord[];
  selectedRow: CustomerListRecord | null;
  onCloseRow: () => void;
  onPreviousRow: () => void;
  onNextRow: () => void;
  hasPreviousRow: boolean;
  hasNextRow: boolean;
  isRowOpen?: (row: CustomerListRecord) => boolean;
}

export interface UseAdvancedSearchContentOptions {
  /** Forwarded straight through to `InteractionsListView`'s own `onAddToast`. */
  onAddToast?: (toast: Omit<ToastItem, "id">) => void;
  /** Forwarded straight through to `InteractionsListView`'s own `onOpenInteraction`. */
  onOpenInteraction?: (record: InteractionHistoryRecord) => void;
  /** Required — Advanced always has Customers access, unlike
   *  `agent-next-gen-search-panel.tsx`'s equivalent (shared with a tier
   *  that omits it), so this isn't optional here. */
  customers: AdvancedSearchCustomersProps;
}

/** Which entity types the agent has actually clicked "Search" for at least
 *  once — a plain partial `Record`, not a single flag, so switching the
 *  dropdown back and forth keeps each type's own prior "has this been
 *  searched" state, same spirit as the old TabList version keeping every
 *  tab's own content mounted independently. */
type SearchedState = Partial<Record<AdvancedSearchEntityType, boolean>>;

export function useAdvancedSearchContent({
  onAddToast,
  onOpenInteraction,
  customers,
}: UseAdvancedSearchContentOptions): EmbeddablePanelContent {
  const [activeType, setActiveType] = useState<AdvancedSearchEntityType>("customers");
  const [searched, setSearched] = useState<SearchedState>({});
  // The search field's own typed text — separate from `customers.
  // searchQuery` (the actually-applied, lifted query `CustomersListView`
  // filters by, shared with the Desk-tab Customers table) so switching
  // entity types doesn't leave a stale "Contacts" search term sitting in
  // the box while looking at Customers, or vice versa. Only committed into
  // `customers.onSearchChange` when the agent actually triggers a search
  // (`runSearch` below) — see that function's own doc comment for why
  // Contacts' own typed text here is never committed anywhere.
  const [draftQuery, setDraftQuery] = useState("");
  // Per explicit request: replaces the in-table toolbar's own search field
  // (see `viewsControl`'s own doc comment at its `CustomersListView`/
  // `InteractionsListView` call sites below) — a stand-in for a future
  // admin-configured list of saved views. Just the one "All" option today
  // (`VIEWS_OPTIONS`), selected by default; shared across both entity
  // types since there's nothing yet to keep separate per type.
  const [viewsValue, setViewsValue] = useState("all");

  // Contacts' filter state, lifted up from `InteractionsListView`'s own
  // internal `useState` (which normally owns this when `viewsControl` isn't
  // passed) into this hook instead — same reason Customers' equivalent is
  // already lifted all the way up to `AgentWorkspaceAdvancedPage.tsx`: the
  // new always-visible `FilterChip` row in `headerContent` below needs to
  // read/write these outside of `InteractionsListView`'s own render tree.
  // No `addedFilterKeys` state needed here (unlike Customers, which shares
  // its state with the Desk-tab table and so needs its own explicit "make
  // sure every key counts as added" step below) — Contacts' filters are
  // permanent and local to this file alone, so `ALL_INTERACTION_FILTER_KEYS`
  // is passed as a fixed constant directly at its `InteractionsListView`
  // call site below; it never needs to change.
  const [interactionFilterValues, setInteractionFilterValues] = useState<Record<string, string[]>>({});
  const [interactionCreateDateRangeValue, setInteractionCreateDateRangeValue] = useState<DateRangeFilterValue>("today");
  const [interactionCreateDateRangeCustom, setInteractionCreateDateRangeCustom] = useState<DateRangePickerProps["value"]>(undefined);

  // Per the latest explicit follow-up ("display them before the search is
  // implemented"): Customers' filter chips must be live from the moment
  // this panel mounts, not only after the agent clicks "Search" (the
  // previous, now-removed behavior — see `runSearch`'s own doc comment
  // below). `customers.addedFilterKeys`/`onAddedFilterKeysChange` is the
  // SAME shared, lifted state the Desk-tab Customers table's own toolbar
  // reads (`AgentWorkspaceAdvancedPage.tsx`) — setting it once here is the
  // same category of shared-state effect the old first-search version
  // already had, just moved earlier; a `hasSetCustomerFilterKeysRef` guard
  // keeps it a true one-shot so it doesn't fight an agent who's since
  // changed it some other way.
  const hasSetCustomerFilterKeysRef = useRef(false);
  useEffect(() => {
    if (hasSetCustomerFilterKeysRef.current) return;
    hasSetCustomerFilterKeysRef.current = true;
    customers.onAddedFilterKeysChange(ALL_CUSTOMER_FILTER_KEYS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasSearched = !!searched[activeType];
  const entityIsPopulated = POPULATED_ENTITY_TYPES.includes(activeType);

  // Drives the trailing "Clear" button next to the filter row below — same
  // `hasActiveFilters` semantics `TableToolbar` itself uses (table.tsx: any
  // field with at least one selected value), just recomputed here since
  // that component's own version isn't reachable once `viewsControl`
  // suppresses its whole filter render path. Deliberately ignores Contacts'
  // "Create Date" range (same scope `TableToolbar`'s own equivalent has —
  // that chip never really has an "empty" state to clear back to, unlike
  // the categorical ones).
  const customersHasActiveFilters = Object.values(customers.filterValues).some((v) => (v?.length ?? 0) > 0);
  const interactionsHasActiveFilters = Object.values(interactionFilterValues).some((v) => (v?.length ?? 0) > 0);

  const selectEntityType = (value: string) => {
    const next = value as AdvancedSearchEntityType;
    setActiveType(next);
    // Restores whatever's actually applied for the type being switched TO
    // — for Customers that's the real lifted query; every other type has
    // nothing to restore here (Contacts' own search field lives inside
    // `InteractionsListView` itself, already showing its own last value
    // there once revealed), so the box just goes blank for those, same as
    // a first-ever visit.
    setDraftQuery(next === "customers" ? customers.searchQuery : "");
  };

  // Per explicit request: clicking "Search" with nothing typed and no
  // filters added must still reveal the full list, not stay on the empty
  // state — `CustomersListView`/`InteractionsListView` already default to
  // their full, unfiltered record set whenever their own search/filter
  // state is empty, so simply flipping `searched[activeType]` to `true` is
  // already correct with no extra "is anything set?" branch needed. Also
  // called directly from every filter chip's own change handler below (not
  // just the "Search" button) per a later explicit follow-up ("when a
  // filter is selected, load the results immediately") — sticky once true,
  // so there's nothing to undo if the agent then clears that same filter.
  const revealResults = () => setSearched((prev) => ({ ...prev, [activeType]: true }));

  const runSearch = () => {
    if (activeType === "customers") {
      customers.onSearchChange(draftQuery);
    }
    // Contacts' own search text lives only in `draftQuery` above (there's
    // no separate lifted "applied" query for Contacts the way Customers
    // has `customers.searchQuery`/`onSearchChange`, since nothing else in
    // this app shares Contacts' search state) — `InteractionsListView`
    // itself has no search box to apply it to any more once `viewsControl`
    // is set, so there's nothing further to commit here; clicking "Search"
    // simply reveals the (now permanently filter-chip-driven) results.
    // Filter chips for BOTH entity types are already live before this ever
    // runs (see the mount-time effect / `ALL_INTERACTION_FILTER_KEYS`
    // constant above) — this only flips `hasSearched` to reveal the actual
    // list/rows below the chips.
    revealResults();
  };

  const handleSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") runSearch();
  };

  // Passed as `viewsControl` to both `CustomersListView` and
  // `InteractionsListView` below — see that prop's own doc comment at each
  // call site (and on the type itself, agent-next-gen-customers-table.tsx/
  // agent-next-gen-interactions-table.tsx) for what it replaces and why.
  // One shared node (not built separately per entity type) since it's the
  // exact same control either way.
  const viewsControl = (
    <Select
      options={VIEWS_OPTIONS}
      value={viewsValue}
      onValueChange={setViewsValue}
      className="w-[120px] shrink-0"
    />
  );

  return {
    title: "Search",
    // This page's own panel-render call sites (`AgentWorkspaceAdvancedPage.
    // tsx`, `searchContent`'s own doc comment) skip their normal
    // `shrink-0 px-4 pb-3 border-b` headerContent wrapper entirely for the
    // Search panel — a special case built for the OLD TabList, which
    // wanted to sit flush with no inset. This row isn't flush-edge chrome
    // the same way a tab row is, so it supplies that same padding+border
    // itself here instead.
    headerContent: (
      <div className="shrink-0 border-b border-lyra-border-subtle">
        <div className="flex items-center gap-2 px-4 pt-3 pb-3">
          <Select
            options={(Object.keys(ADVANCED_SEARCH_ENTITY_LABELS) as AdvancedSearchEntityType[]).map((key) => ({
              value: key,
              label: ADVANCED_SEARCH_ENTITY_LABELS[key],
            }))}
            value={activeType}
            onValueChange={selectEntityType}
            className="w-[150px] shrink-0"
          />
          {entityIsPopulated && (
            <>
              <SearchInput
                value={draftQuery}
                onValueChange={setDraftQuery}
                onKeyDown={handleSearchKeyDown}
                placeholder="Enter Search Term"
                aria-label={`Search ${ADVANCED_SEARCH_ENTITY_LABELS[activeType]}`}
                className="flex-1"
              />
              <Button size="md" className="shrink-0" onClick={runSearch}>
                Search
              </Button>
            </>
          )}
        </div>
        {/* Per explicit request ("move the filters above the line (under
            the select, input, search) and display them before the search is
            implemented"): every real filter for the active entity, rendered
            directly via `FilterChip`/`DateRangeFilterChip` — not through
            either list's own `TableToolbar` (suppressed entirely by
            `viewsControl` below) — so these are visible and usable the
            moment the panel opens, whether or not the agent has clicked
            "Search" yet (`hasSearched` deliberately does not gate this row).
            No `onRemove` on any chip: unlike a normal "+ Filter"-added chip,
            these are permanent for as long as this entity type is active —
            there's no add-menu left to re-add one from if removed. Per a
            later explicit follow-up ("when a filter is selected, load the
            results immediately"), every chip's own change handler also
            calls `revealResults()` — picking a value reveals the (now
            filtered) list itself, same as clicking "Search" would, instead
            of requiring that extra click afterward. A trailing "Clear"
            button (same wording/placement `TableToolbar`'s own equivalent
            uses) shows once any chip has a selection, resetting every
            chip back to empty without removing them. */}
        {entityIsPopulated && (
          <div className="flex items-center gap-2 flex-wrap px-4 pb-3">
            {activeType === "customers" ? (
              <>
                {CUSTOMER_FILTER_FIELD_DEFS.map((field) => (
                  <FilterChip
                    key={field.key}
                    label={field.label}
                    options={CUSTOMER_FILTER_VALUE_OPTIONS[field.key]}
                    selectedValues={customers.filterValues[field.key] ?? []}
                    onSelectionChange={(values) => {
                      customers.onFilterValuesChange({ ...customers.filterValues, [field.key]: values });
                      revealResults();
                    }}
                  />
                ))}
                {customersHasActiveFilters && (
                  <Button variant="ghost" size="default" onClick={() => customers.onFilterValuesChange({})}>
                    Clear
                  </Button>
                )}
              </>
            ) : (
              <>
                {INTERACTION_HISTORY_FILTER_FIELD_DEFS.map((field) => (
                  <FilterChip
                    key={field.key}
                    label={field.label}
                    options={INTERACTION_HISTORY_FILTER_VALUE_OPTIONS[field.key]}
                    selectedValues={interactionFilterValues[field.key] ?? []}
                    onSelectionChange={(values) => {
                      setInteractionFilterValues((prev) => ({ ...prev, [field.key]: values }));
                      revealResults();
                    }}
                  />
                ))}
                <DateRangeFilterChip
                  label="Create Date"
                  value={interactionCreateDateRangeValue}
                  onValueChange={(value) => {
                    setInteractionCreateDateRangeValue(value);
                    revealResults();
                  }}
                  customValue={interactionCreateDateRangeCustom}
                  onCustomValueChange={(value) => {
                    setInteractionCreateDateRangeCustom(value);
                    revealResults();
                  }}
                />
                {interactionsHasActiveFilters && (
                  <Button variant="ghost" size="default" onClick={() => setInteractionFilterValues({})}>
                    Clear
                  </Button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    ),
    body: !entityIsPopulated ? (
      <div className="overflow-y-auto flex-1 flex items-center justify-center p-4">
        <p className="lyra-body-md text-lyra-fg-disabled text-center">Coming soon</p>
      </div>
    ) : !hasSearched ? (
      <div className="overflow-y-auto flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
        <SearchIcon className="h-8 w-8 text-lyra-fg-disabled" strokeWidth={1.5} aria-hidden="true" />
        <p className="lyra-body-md-emphasis text-lyra-fg-default">
          Search or filter to see {ADVANCED_SEARCH_ENTITY_LABELS[activeType].toLowerCase()}
        </p>
        <p className="lyra-body-sm text-lyra-fg-secondary max-w-[280px]">
          Enter a search term above and click Search — or click Search with nothing entered to load
          the full list, then filter from there.
        </p>
      </div>
    ) : activeType === "customers" ? (
      // `relative` here is load-bearing, not decorative — same reasoning
      // as this exact wrapper in `agent-next-gen-search-panel.tsx`'s own
      // Customers branch: without it, `CustomerRowInfoPanel`'s full-
      // screen/narrow state (which renders `position: absolute`) falls
      // through to whatever positioned ancestor is further up the tree and
      // ends up covering this panel's own header row too, not just this
      // body.
      <div className="relative flex flex-1 min-h-0 overflow-hidden">
        <CustomersListView
          onStartInteraction={customers.onStartInteraction}
          addedFilterKeys={customers.addedFilterKeys}
          onAddedFilterKeysChange={customers.onAddedFilterKeysChange}
          filterValues={customers.filterValues}
          onFilterValuesChange={customers.onFilterValuesChange}
          onRowClick={customers.onRowClick}
          searchQuery={customers.searchQuery}
          onSearchChange={customers.onSearchChange}
          sortKey={customers.sortKey}
          sortDir={customers.sortDir}
          onSort={customers.onSort}
          sortedRows={customers.sortedRows}
          openRowId={customers.selectedRow?.contactNumber ?? null}
          leadingChannelStack
          isRowOpen={customers.isRowOpen}
          viewsControl={viewsControl}
        />
        <CustomerRowInfoPanel
          row={customers.selectedRow}
          onClose={customers.onCloseRow}
          onPrevious={customers.onPreviousRow}
          onNext={customers.onNextRow}
          hasPrevious={customers.hasPreviousRow}
          hasNext={customers.hasNextRow}
          onStartInteraction={customers.onStartInteraction}
          tabs={AGENT_WORKSPACE_CUSTOMER_PANEL_TABS}
          onAddToast={onAddToast}
          hideFullScreenToggle
          hidePrevNext
        />
      </div>
    ) : (
      <InteractionsListView
        onAddToast={onAddToast}
        onOpenInteraction={onOpenInteraction}
        viewsControl={viewsControl}
        addedFilterKeys={ALL_INTERACTION_FILTER_KEYS}
        filterValues={interactionFilterValues}
        onFilterValuesChange={setInteractionFilterValues}
        createDateRangeValue={interactionCreateDateRangeValue}
        onCreateDateRangeValueChange={setInteractionCreateDateRangeValue}
        createDateRangeCustom={interactionCreateDateRangeCustom}
        onCreateDateRangeCustomChange={setInteractionCreateDateRangeCustom}
      />
    ),
  };
}
