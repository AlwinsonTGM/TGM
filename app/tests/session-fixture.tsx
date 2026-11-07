import { useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { SessionStatus, type SessionProvider, type SessionAvailability } from "../src/SessionStatus";

function Fixture() {
  const [mode, setMode] = useState<"available" | "absent" | "unavailable">("unavailable");
  const [harness, setHarness] = useState<"OpenCode" | "AGY">("OpenCode");
  const [calls, setCalls] = useState(0);
  const pending = useRef<((value: { ok: boolean }) => void) | null>(null);
  const reject = useRef<(() => void) | null>(null);
  const provider = useMemo<SessionProvider>(() => ({
    async getLastSession(): Promise<SessionAvailability> {
      if (mode !== "available") return { state: mode };
      return { state: "available", session: { id: "fixture-1", title: "Functions practice", project: "TypeScript learning", harness } };
    },
    resume() {
      setCalls((n) => n + 1);
      return new Promise((resolve, rejectPromise) => {
        pending.current = resolve;
        reject.current = () => rejectPromise(new Error("fixture error"));
      });
    },
  }), [mode, harness]);
  return <>
    <div aria-label="Fixture controls">
      <button onClick={() => setMode("available")}>Fixture available</button>
      <button onClick={() => setHarness((h) => (h === "OpenCode" ? "AGY" : "OpenCode"))}>Toggle harness</button>
      <button onClick={() => setMode("absent")}>Fixture absent</button>
      <button onClick={() => setMode("unavailable")}>Fixture unavailable</button>
      <button onClick={() => pending.current?.({ ok: true })}>Confirm success</button>
      <button onClick={() => pending.current?.({ ok: false })}>Confirm failure</button>
      <button onClick={() => reject.current?.()}>Reject request</button>
      <output aria-label="Resume calls">{calls}</output>
    </div>
    <SessionStatus provider={provider} />
  </>;
}
createRoot(document.getElementById("root")!).render(<Fixture />);
