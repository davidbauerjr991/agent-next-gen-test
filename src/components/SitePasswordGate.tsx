import * as React from "react";
import { Container, PasswordInput, Button } from "@nicecxone/lyra-ui";

/* ── SitePasswordGate ──
   Blocks the ENTIRE app — every hash route, including the login screen
   itself — behind a single shared password. Sits above the hash router in
   App.tsx (wraps its return value) rather than being one more `page`, so
   there's no route that bypasses it: an unlocked-only visitor can't jump
   straight to `#/agent` (or any other hash) and skip the gate, because the
   router's own output only ever reaches the DOM once `unlocked` is true.

   This is a soft gate for keeping casual visitors off a public GitHub
   Pages test build — NOT real security. `SITE_PASSWORD` ships in the
   built JS bundle and is trivially readable by anyone who opens dev
   tools; there's no backend to actually authenticate against. Good
   enough to stop someone from stumbling onto the prototype, not to
   protect anything sensitive. To rotate the password, just edit the
   constant below. */

const SITE_PASSWORD = "4!bnFg*FK3zNfx";

const UNLOCK_STORAGE_KEY = "lyra_agent_next_gen_test_unlocked";

// Fires when an agent logs out (see `logOutOfSite` below) so the ONE
// `SitePasswordGate` instance mounted at the App.tsx root can re-lock
// itself immediately. A plain `window` event rather than lifted state or a
// context: App.tsx renders a fresh `<SitePasswordGate>` element on every
// branch of its hash router (agent / agent-with-desk / agent-advanced /
// login / default), but because every branch puts it in the exact same
// position in the tree, React treats it as the SAME component instance
// across ordinary page navigation — it does not remount, which is exactly
// what keeps an already-unlocked visitor from being re-prompted every time
// they switch pages. That also means clearing localStorage alone wouldn't
// visibly re-lock anything until a future full reload; the event tells the
// already-mounted instance to flip back to locked right now.
const LOCK_EVENT = "lyra-agent-next-gen-test:lock";

function readUnlocked(): boolean {
  try {
    return window.localStorage.getItem(UNLOCK_STORAGE_KEY) === "true";
  } catch {
    // Storage unavailable (private browsing, locked-down browser, etc.) —
    // fail closed rather than throwing; the gate just re-prompts every load.
    return false;
  }
}

function persistUnlocked() {
  try {
    window.localStorage.setItem(UNLOCK_STORAGE_KEY, "true");
  } catch {
    // Can't persist — the visitor still gets through for this page load,
    // they'll just see the gate again next time.
  }
}

/**
 * Call this from the agent's log-out handler (alongside navigating back to
 * the login page) to remove them from the password-gate session too: clears
 * the persisted unlock flag and tells the currently-mounted
 * `SitePasswordGate` to re-lock immediately, so the password prompt is what
 * they see next — logging out doesn't just return to the login screen, it
 * exits the gate's unlocked session entirely.
 */
export function logOutOfSite() {
  try {
    window.localStorage.removeItem(UNLOCK_STORAGE_KEY);
  } catch {
    // Nothing persisted to clear — the in-memory relock below still fires.
  }
  window.dispatchEvent(new Event(LOCK_EVENT));
}

interface SitePasswordGateProps {
  children: React.ReactNode;
}

export function SitePasswordGate({ children }: SitePasswordGateProps) {
  const [unlocked, setUnlocked] = React.useState(readUnlocked);
  const [value, setValue] = React.useState("");
  const [error, setError] = React.useState<string | undefined>(undefined);

  React.useEffect(() => {
    const relock = () => {
      setUnlocked(false);
      setValue("");
      setError(undefined);
    };
    window.addEventListener(LOCK_EVENT, relock);
    return () => window.removeEventListener(LOCK_EVENT, relock);
  }, []);

  if (unlocked) return <>{children}</>;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value === SITE_PASSWORD) {
      setError(undefined);
      persistUnlocked();
      setUnlocked(true);
    } else {
      setError("Incorrect password. Please try again.");
    }
  };

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-lyra-bg-surface-shell p-6 animate-in fade-in-0 duration-500">
      <Container variant="modal" headerTitle="Protected Preview" className="w-[360px]">
        <form className="flex flex-col gap-4 px-5 pb-5 pt-4" onSubmit={handleSubmit}>
          <p className="lyra-body-md text-lyra-fg-secondary">
            This prototype is password-protected. Enter the password to
            continue.
          </p>
          <PasswordInput
            label="Password"
            value={value}
            onChange={(next: string) => {
              setValue(next);
              if (error) setError(undefined);
            }}
            error={error}
            autoComplete="current-password"
          />
          <Button type="submit" size="lg" className="w-full" disabled={value.length === 0}>
            Unlock
          </Button>
        </form>
      </Container>
    </div>
  );
}
