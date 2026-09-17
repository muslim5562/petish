"use client";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Download, RefreshCw, WifiOff } from "lucide-react";
type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};
type PwaContext = {
  installed: boolean;
  canInstall: boolean;
  install: () => Promise<void>;
  message: string;
  secure: boolean;
};
const Context = createContext<PwaContext>({
  installed: false,
  canInstall: false,
  install: async () => {},
  message: "",
  secure: true,
});
export const usePwa = () => useContext(Context);
export default function PwaProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [installed, setInstalled] = useState(false),
    [prompt, setPrompt] = useState<InstallEvent | null>(null),
    [offline, setOffline] = useState(false),
    [message, setMessage] = useState(""),
    [secure, setSecure] = useState(true),
    [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const reloading = useRef(false);
  useEffect(() => {
    const display = matchMedia("(display-mode: standalone)");
    const syncDisplay = () =>
      setInstalled(
        display.matches ||
          Boolean(
            (navigator as Navigator & { standalone?: boolean }).standalone,
          ),
      );
    const syncOnline = () => setOffline(!navigator.onLine);
    const installable = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallEvent);
    };
    const installedEvent = () => {
      setInstalled(true);
      setPrompt(null);
      setMessage("Petish has been added. Open it from your home screen.");
    };
    syncDisplay();
    syncOnline();
    setSecure(window.isSecureContext);
    display.addEventListener("change", syncDisplay);
    window.addEventListener("online", syncOnline);
    window.addEventListener("offline", syncOnline);
    window.addEventListener("beforeinstallprompt", installable);
    window.addEventListener("appinstalled", installedEvent);
    let disposed = false;
    let registration: ServiceWorkerRegistration | undefined;
    const cleanups: (() => void)[] = [];
    if ("serviceWorker" in navigator && window.isSecureContext) {
      const changed = () => {
        if (reloading.current) window.location.reload();
      };
      navigator.serviceWorker.addEventListener("controllerchange", changed);
      cleanups.push(() =>
        navigator.serviceWorker.removeEventListener(
          "controllerchange",
          changed,
        ),
      );
      navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .then((reg) => {
          if (disposed) return;
          registration = reg;
          if (reg.waiting) setWaiting(reg.waiting);
          const update = () => {
            const worker = reg.installing;
            if (!worker) return;
            const state = () => {
              if (
                !disposed &&
                worker.state === "installed" &&
                navigator.serviceWorker.controller
              )
                setWaiting(reg.waiting || worker);
            };
            worker.addEventListener("statechange", state);
            cleanups.push(() =>
              worker.removeEventListener("statechange", state),
            );
          };
          reg.addEventListener("updatefound", update);
          cleanups.push(() => reg.removeEventListener("updatefound", update));
        })
        .catch(() => {
          /* Normal online use still works; the install page explains connection requirements. */
        });
      const check = () => {
        if (document.visibilityState === "visible" && navigator.onLine)
          void registration?.update().catch(() => {});
      };
      document.addEventListener("visibilitychange", check);
      cleanups.push(() =>
        document.removeEventListener("visibilitychange", check),
      );
    }
    return () => {
      disposed = true;
      cleanups.forEach((fn) => fn());
      display.removeEventListener("change", syncDisplay);
      window.removeEventListener("online", syncOnline);
      window.removeEventListener("offline", syncOnline);
      window.removeEventListener("beforeinstallprompt", installable);
      window.removeEventListener("appinstalled", installedEvent);
    };
  }, []);
  async function install() {
    if (!prompt) return;
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      setPrompt(null);
      setMessage(
        choice.outcome === "accepted"
          ? "Installation requested. Follow your browser’s instructions."
          : "You can install later from your browser’s menu.",
      );
    } catch {
      setPrompt(null);
      setMessage("Open your browser’s menu to add Petish to your home screen.");
    }
  }
  return (
    <Context.Provider
      value={{ installed, canInstall: !!prompt, install, message, secure }}
    >
      {children}
      {offline && (
        <div className="pwa-connection" role="status">
          <WifiOff size={20} />
          <div>
            <strong>Connection lost</strong>
            <p>
              Keep this screen open. Reconnect before saving or uploading;
              changes are not queued for later.
            </p>
          </div>
        </div>
      )}
      {waiting && !offline && (
        <div className="pwa-connection pwa-update" role="status">
          <RefreshCw size={20} />
          <div>
            <strong>An update is ready</strong>
            <p>Save your changes before reloading.</p>
          </div>
          <button
            className="button secondary"
            onClick={() => {
              if (
                confirm(
                  "Reload Petish to update? Unsaved entries on this screen will be lost.",
                )
              ) {
                reloading.current = true;
                waiting.postMessage({ type: "ACTIVATE_UPDATE" });
              }
            }}
          >
            Update and reload
          </button>
        </div>
      )}
    </Context.Provider>
  );
}
export function InstallButton() {
  const { installed, canInstall, install, message } = usePwa();
  return (
    <div>
      {installed ? (
        <p className="install-status">Petish is already open as an app.</p>
      ) : canInstall ? (
        <button className="button primary" onClick={() => void install()}>
          <Download size={18} />
          Install Petish
        </button>
      ) : (
        <p className="install-status">
          Use the steps below to add Petish to your home screen.
        </p>
      )}
      {message && (
        <p className="fine-print" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
