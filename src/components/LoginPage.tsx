import { LoginCard } from "@nicecxone/lyra-ui";

type Page = "agent-workspace" | "agent" | "outbound" | "login";

interface LoginPageProps {
  onNavigate?: (page: Page) => void;
}

export function LoginPage({ onNavigate }: LoginPageProps) {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-lyra-bg-surface-shell p-6 animate-in fade-in-0 duration-500">
      {/* Per explicit request: the modal header reads "Agent Workspace"
          (not lyra-ui's own default "Agent Next Gen" — that default is
          left untouched, since other consumers of `LoginCard` may still
          rely on it), and the idle-state launch button reads a plain
          "Launch" instead of repeating the app name a second time right
          below the header (`launchButtonLabel`, LoginCard's own new opt-in
          prop — see that prop's doc comment, login-card.tsx). The
          in-progress "Launching Agent Workspace…" status text is
          untouched. */}
      <LoginCard
        appName="Agent Workspace"
        launchButtonLabel="Launch"
        // Per request: hide the smiley/app-icon mark in the login modal's
        // header too. LoginCard's `headerIcon` falls back via
        // `appIcon ?? <img .../>`, and `??` treats `null` the same as
        // `undefined` — so only an explicit non-nullish empty node (not
        // `null`, and not simply omitting the prop) actually suppresses it.
        // See the same fix on the welcome modal's `icon` prop in the
        // workspace pages. lyra-ui itself is untouched.
        appIcon={<></>}
        onLaunch={() => onNavigate?.("agent")}
      />
    </div>
  );
}
