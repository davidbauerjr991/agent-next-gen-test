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
// list component (`CustomersListView`/`InteractionsListView`) exactly as
// today, completely unmodified — every filter either one already supports
// (the full "+ Filter" menus in agent-next-gen-customers-table.tsx /
// agent-next-gen-interactions-table.tsx) is what shows here, not a
// hand-picked subset and not the placeholder chip labels the reference
// screenshot happened to show (that screenshot's own "Status/Skill/
// Channel/..." chips don't correspond to this app's real Customer fields
// at all — see `AdvancedSearchCustomersProps`' own doc comment). "Messages"/
// "Threads" are selectable in the dropdown but render "Coming soon" — same
// placeholder copy the old panel already used for those two — per explicit
// request to leave those for later.
import { useState, type KeyboardEvent } from "react";
import { Search as SearchIcon } from "lucide-react";
import {
  Select,
  SearchInput,
  Button,
  type EmbeddablePanelContent,
  type ChannelType,
  type CreateNewOutboundContact,
  type SortDirection,
  type ToastItem,
} from "@nicecxone/lyra-ui";
import {
  InteractionsListView,
  type InteractionHistoryRecord,
} from "@/components/agent-next-gen-interactions-table";
import {
  CustomersListView,
  type CustomerListRecord,
  type CustomerColKey,
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

  const hasSearched = !!searched[activeType];
  const entityIsPopulated = POPULATED_ENTITY_TYPES.includes(activeType);

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
  // state is empty, so simply flipping `searched[activeType]` to `true`
  // (leaving `filterValues`/`addedFilterKeys` exactly as they already are)
  // is already correct with no extra "is anything set?" branch needed.
  const runSearch = () => {
    if (activeType === "customers") customers.onSearchChange(draftQuery);
    // Contacts' own `InteractionsListView` search field is intentionally
    // left alone here — it manages its own internal search/filter state
    // (unlike Customers, which was already lifted up to the page for the
    // Desk-tab Customers view to share) and starts empty on first reveal,
    // same as opening any other fresh view. This gate only decides WHEN to
    // reveal it, not what it's pre-filtered to; its own full toolbar
    // (search box + "+ Filter" menu, already covering every
    // `INTERACTION_HISTORY_FILTER_FIELD_DEFS` field) is right there once
    // it shows, same as it always was in the old panel.
    setSearched((prev) => ({ ...prev, [activeType]: true }));
  };

  const handleSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") runSearch();
  };

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
      <div className="flex items-center gap-2 shrink-0 px-4 pt-3 pb-3 border-b border-lyra-border-subtle">
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
      <InteractionsListView onAddToast={onAddToast} onOpenInteraction={onOpenInteraction} />
    ),
  };
}
