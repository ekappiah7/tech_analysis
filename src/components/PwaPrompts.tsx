import { useEffect, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";

/** The install event Chromium fires; not in the standard DOM lib yet. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISSED_KEY = "ta.install.dismissed";

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // Safari exposes it here rather than through display-mode.
    (navigator as { standalone?: boolean }).standalone === true
  );
}

function InstallBanner() {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISSED_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const onPrompt = (raw: Event) => {
      raw.preventDefault();
      setEvent(raw as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!event || dismissed || isStandalone()) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Storage disabled — the banner simply returns next visit.
    }
  };

  return (
    <div className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-md rounded-lg border border-edge bg-panel p-4 shadow-xl">
      <p className="text-sm font-medium text-slate-100">Install this app</p>
      <p className="mt-1 text-xs leading-relaxed text-muted">
        Adds it to your home screen and lets you audit a statement with no
        connection — the whole calculation runs on your device.
      </p>
      <div className="mt-3 flex gap-2">
        <button
          onClick={async () => {
            await event.prompt();
            await event.userChoice;
            setEvent(null);
          }}
          className="rounded bg-edge px-3 py-1.5 text-sm text-slate-100 transition hover:bg-slate-700"
        >
          Install
        </button>
        <button
          onClick={dismiss}
          className="rounded px-3 py-1.5 text-sm text-muted transition hover:text-slate-300"
        >
          Not now
        </button>
      </div>
    </div>
  );
}

function UpdateToast() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({ immediate: true });

  if (!needRefresh) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-md rounded-lg border border-edge bg-panel p-4 shadow-xl">
      <p className="text-sm text-slate-100">A new version is ready.</p>
      <div className="mt-3 flex gap-2">
        <button
          onClick={() => void updateServiceWorker(true)}
          className="rounded bg-edge px-3 py-1.5 text-sm text-slate-100 transition hover:bg-slate-700"
        >
          Reload
        </button>
        <button
          onClick={() => setNeedRefresh(false)}
          className="rounded px-3 py-1.5 text-sm text-muted transition hover:text-slate-300"
        >
          Later
        </button>
      </div>
    </div>
  );
}

function OfflineBar() {
  const [offline, setOffline] = useState(() => !navigator.onLine);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="bg-warn/15 px-4 py-2 text-center text-xs text-warn">
      Offline — audits still work, live charts do not.
    </div>
  );
}

export { InstallBanner, UpdateToast, OfflineBar };
