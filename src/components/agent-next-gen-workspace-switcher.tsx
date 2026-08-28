import * as PopoverPrimitive from "@radix-ui/react-popover";
import { AppName, AppMenu, CXoneLogo, type AppMenuGroup } from "@nicecxone/lyra-ui";
import appIcon from "@/assets/app-icon.svg";

/* ── Workspace switcher — pinned to the bottom of LeftNav ──
   The Agent Workspace 2.0 | Advanced | Premium switcher used to live in
   AppHeader's `appName` slot as a full icon+text+chevron trigger. Per
   explicit request, AgentProfile (the avatar/status/timer widget) took over
   that slot instead, and this switcher first became a small compact
   (icon-only) trigger sitting next to it — then, per a further explicit
   request, moved again to `LeftNav`'s own `footer` slot (real, documented
   prop: "content pinned to the bottom of the nav rail"), so it now sits
   fixed at the bottom of the left nav instead of anywhere in the header.
   Kept as its own small component (rather than inline JSX repeated in each
   of the three Agent Workspace page files) since all three wire it up
   identically — only `appName`/`appMenuGroups` differ per page.

   `expanded` — per a further explicit request ("show the full title of the
   selected app when the left nav is expanded"): drives `AppName`'s own real
   `compact` prop (`compact={!expanded}`), same convention `CreateNew` (this
   file's neighbor in `pinnedHeader`) already follows. Callers pass
   `expanded={navOpen}` for INLINE mode; LeftNav's overlay/narrow mode
   auto-clones its own `expanded={hoverOpen}` onto whatever `footer` renders
   instead (see left-nav.tsx's `injectExpanded`), overriding whatever was
   passed at the call site — so the icon still correctly expands on hover
   in that mode without any extra wiring here. */
export interface WorkspaceSwitcherIconProps {
  appMenuOpen: boolean;
  onAppMenuOpenChange: (open: boolean) => void;
  appMenuGroups: AppMenuGroup[];
  /** The current page's own app name (e.g. "Agent Workspace 2.0 Advanced") — used as both the trigger's accessible label and (only while collapsed) the popover's header. */
  appName: string;
  /** Whether the left nav is currently expanded — see doc comment above. Defaults to collapsed/icon-only when omitted. */
  expanded?: boolean;
}

export function WorkspaceSwitcherIcon({
  appMenuOpen,
  onAppMenuOpenChange,
  appMenuGroups,
  appName,
  expanded = false,
}: WorkspaceSwitcherIconProps) {
  return (
    <PopoverPrimitive.Root open={appMenuOpen} onOpenChange={onAppMenuOpenChange}>
      <PopoverPrimitive.Trigger asChild>
        <AppName
          icon={<img src={appIcon} alt={appName} className="h-6 w-6" />}
          name={appName}
          compact={!expanded}
          aria-expanded={appMenuOpen}
        />
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          // Anchored at the bottom of the screen now (LeftNav's footer),
          // not the top of the header — opens upward (`side="top"`) so it
          // grows into the viewport instead of off the bottom edge. Same
          // reasoning flips the animation direction below (slide in/out
          // from the bottom — i.e. from the trigger itself — instead of
          // from the top, which the original header-anchored version used).
          side="top"
          align="start"
          sideOffset={6}
          onOpenAutoFocus={(e: Event) => e.preventDefault()}
          className="z-[9999] animate-in fade-in-0 slide-in-from-bottom-2 duration-150 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-bottom-1 data-[state=closed]:duration-100"
        >
          {/* `header` only needed while the trigger is compact (icon-only)
              — same "name moves into the menu header" convention AppName's
              own `compact` doc comment describes. Once the trigger shows
              the full name itself (expanded), repeating it in the popover
              header would be redundant. */}
          <AppMenu groups={appMenuGroups} footer={<CXoneLogo />} header={!expanded ? appName : undefined} />
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
