import "@fontsource-variable/inter";
import "@fontsource-variable/inter-tight";
import "@fontsource/instrument-serif/400-italic.css";
import "@repo/ui/styles.css";
import "./sidepanel.css";

import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { createApiClient, SIGN_LANGS, type SignLang } from "@signstream/shared";
import { captionAt, nextSpeed, trackErrorMessage } from "@repo/ui/caption";
import { SignPanel } from "@repo/ui/sign-panel";
import { useSignTrack } from "@repo/ui/use-sign-track";
import { parseVideoId } from "@repo/ui/youtube";

const apiUrl = import.meta.env.VITE_API_URL as string | undefined;
/** Without VITE_API_URL the panel uses the shared mock track (labelled in the UI). */
const api = createApiClient({ baseUrl: apiUrl ?? "", mock: !apiUrl });

interface Clock {
  t: number;
  rate: number;
}

function isClockMessage(msg: unknown): msg is Clock & { type: "signside:time" } {
  const m = msg as Partial<Clock> & { type?: string };
  return m?.type === "signside:time" && Number.isFinite(m.t) && Number.isFinite(m.rate);
}

function App() {
  const [tab, setTab] = useState<{ id?: number; videoId: string | null }>({ videoId: null });
  const [signing, setSigning] = useState(false);
  const [lang, setLang] = useState<SignLang>("ASL");
  const [clock, setClock] = useState<Clock>({ t: 0, rate: 1 });
  // Only ask the API once the person presses start: opening a video shouldn't spend sponsor credits.
  const { track, progress, error } = useSignTrack(api, signing ? tab.videoId : null, lang);

  // Watch the active tab for a YouTube video.
  useEffect(() => {
    const check = () =>
      chrome.tabs.query({ active: true, currentWindow: true }).then(([t]) => {
        setTab({ id: t?.id, videoId: t?.url ? parseVideoId(t.url) : null });
      });
    void check();
    chrome.tabs.onActivated.addListener(check);
    chrome.tabs.onUpdated.addListener(check);
    return () => {
      chrome.tabs.onActivated.removeListener(check);
      chrome.tabs.onUpdated.removeListener(check);
    };
  }, []);

  // Media clock from that tab's content script.
  useEffect(() => {
    const onMessage = (msg: unknown, sender: chrome.runtime.MessageSender) => {
      if (sender.tab?.id === tab.id && isClockMessage(msg)) setClock({ t: msg.t, rate: msg.rate });
    };
    chrome.runtime.onMessage.addListener(onMessage);
    return () => chrome.runtime.onMessage.removeListener(onMessage);
  }, [tab.id]);

  const connected = !!tab.videoId;
  const mode = !connected ? "none" : signing && track ? "signing" : "idle";
  const pct = Math.round((progress ?? 0) * 100);

  return (
    <SignPanel
      mode={mode}
      logoSrc="/icons/48.png"
      langs={SIGN_LANGS}
      lang={lang}
      onLang={(l) => setLang(l as SignLang)}
      speed={clock.rate}
      onSpeed={
        connected && tab.id !== undefined
          ? () => void chrome.tabs.sendMessage(tab.id!, { type: "signside:rate", rate: nextSpeed(clock.rate) }).catch(() => {})
          : undefined
      }
      head={
        !connected
          ? "No video here yet."
          : error
            ? "Can't sign this video."
            : signing
              ? `Preparing signs… ${pct}%`
              : "Video found. Connected on its own."
      }
      sub={
        !connected
          ? "Open a YouTube video and I'll connect automatically."
          : error
            ? trackErrorMessage(error)
            : signing
              ? "Turning the captions into sign language."
              : "Pick a sign language and press start. Every sentence gets signed."
      }
      sourceLabel={
        !connected ? "Not connected" : signing && track ? `Signing in ${lang}${apiUrl ? "" : " · demo track"}` : "Auto-connected"
      }
      sourceDetail={connected ? `youtube.com/watch?v=${tab.videoId}` : "Watching this tab for a video"}
      caption={captionAt(track, clock.t)}
      time={clock.t}
      onToggle={connected ? () => setSigning(!signing) : undefined}
    />
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
