import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import "./workspace.css";

type Harness = "agy" | "opencode";
type Props = { active: boolean; onHome: () => void; intent: WorkIntent | null; onRunningChange: (running: boolean) => void; onComplete: () => void; stepBusy: boolean; stepMessage: string; stepError: string };

export function Workspace({ active, onHome, intent, onRunningChange, onComplete, stepBusy, stepMessage, stepError }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const activeRef = useRef(active);
  const startingRef = useRef(false);
  const exitedDuringStartRef = useRef(false);
  const checkRequestRef = useRef(0);
  const [harness, setHarness] = useState<Harness>("opencode");
  const [folder, setFolder] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Not running");
  const [availability, setAvailability] = useState("Checking harness…");
  const [availabilityState, setAvailabilityState] = useState<"checking" | "found" | "missing" | "error">("checking");
  const [error, setError] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const [copyError, setCopyError] = useState("");

  useLayoutEffect(() => { onRunningChange(running || busy); }, [running, busy, onRunningChange]);
  useLayoutEffect(() => { if (intent && intent.mode !== "independent" && !running) setHarness(intent.mode); }, [intent]);
  useEffect(() => { setCopyMessage(""); setCopyError(""); }, [intent?.stepId]);

  async function copyStep() {
    if (!intent || !window.terminalBridge) return;
    setCopyMessage(""); setCopyError("");
    try { await window.terminalBridge.copy(intent.stepText); setCopyMessage("Step copied. Paste it when you’re ready."); }
    catch { setCopyError("Couldn’t copy the step. Select and copy its text instead."); }
  }

  function fitTerminal() {
    const element = containerRef.current;
    const terminal = terminalRef.current;
    if (!activeRef.current || !element || !terminal || !fitRef.current || !element.clientWidth || !element.clientHeight) return;
    fitRef.current.fit();
    window.terminalBridge?.resize(terminal.cols, terminal.rows);
  }

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: "Cascadia Mono, Consolas, monospace",
      theme: { background: "#061511", foreground: "#e9eee5", cursor: "#61d8b8", selectionBackground: "#456c5b" },
    });
    const fit = new FitAddon();
    terminal.loadAddon(fit);
    terminal.open(element);
    terminalRef.current = terminal;
    fitRef.current = fit;
    const bridge = window.terminalBridge;
    if (!bridge) {
      setAvailability("Terminal is unavailable in this window.");
      setAvailabilityState("error");
      setError("Open TGM as a desktop app to use the terminal.");
    }
    const input = terminal.onData(data => bridge?.write(data));
    const offData = bridge?.onData(data => terminal.write(data));
    const offExit = bridge?.onExit(exitCode => {
      if (startingRef.current) exitedDuringStartRef.current = true;
      setRunning(false);
      setStatus(`Exited (${exitCode})`);
    });
    terminal.attachCustomKeyEventHandler(event => {
      if (!bridge || event.type !== "keydown" || !event.ctrlKey || !event.shiftKey) return true;
      if (event.code === "KeyC") {
        if (terminal.hasSelection()) void bridge.copy(terminal.getSelection()).catch(() => setError("Couldn’t copy the selection."));
        return false;
      }
      if (event.code === "KeyV") {
        void bridge.paste().then(text => terminal.paste(text)).catch(() => setError("Couldn’t paste from the clipboard."));
        return false;
      }
      return true;
    });
    const observer = new ResizeObserver(() => fitTerminal());
    observer.observe(element);
    fitTerminal();
    return () => {
      observer.disconnect();
      input.dispose();
      offData?.();
      offExit?.();
      terminal.dispose();
      terminalRef.current = null;
      fitRef.current = null;
    };
  }, []);

  useEffect(() => {
    activeRef.current = active;
    if (!active) return;
    const frame = requestAnimationFrame(() => fitTerminal());
    return () => cancelAnimationFrame(frame);
  }, [active]);

  async function checkHarness(selected: Harness) {
    const request = ++checkRequestRef.current;
    if (!window.terminalBridge) return;
    setAvailabilityState("checking");
    setAvailability("Checking harness…");
    try {
      const found = await window.terminalBridge.checkHarness(selected);
      if (request !== checkRequestRef.current) return;
      setAvailabilityState(found ? "found" : "missing");
      setAvailability(found
        ? "Found on TGM’s PATH. Launch and sign-in are not checked."
        : "Not found on TGM’s PATH. Install the harness or add it to PATH, then restart TGM.");
    } catch {
      if (request === checkRequestRef.current) {
        setAvailabilityState("error");
        setAvailability("Couldn’t check this harness. Check again or restart TGM.");
      }
    }
  }
  useEffect(() => { void checkHarness(harness); }, [harness]);

  async function chooseFolder() {
    setBusy(true); setError("");
    try {
      const selected = await window.terminalBridge.chooseFolder();
      if (selected) setFolder(selected);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Couldn’t choose a folder."); }
    finally { setBusy(false); }
  }
  async function startTerminal() {
    const terminal = terminalRef.current;
    if (!folder || !terminal || !window.terminalBridge || busy || running || availabilityState !== "found") return;
    setBusy(true); setError("");
    startingRef.current = true;
    exitedDuringStartRef.current = false;
    try {
      fitTerminal();
      terminal.clear();
      await window.terminalBridge.start({ harness, cwd: folder, cols: terminal.cols, rows: terminal.rows });
      if (!exitedDuringStartRef.current) {
        setRunning(true); setStatus("Running"); terminal.focus();
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn’t start the terminal.");
      setStatus("Could not start");
    } finally { startingRef.current = false; setBusy(false); }
  }
  async function stopTerminal() {
    if (!running || busy || !window.terminalBridge) return;
    setBusy(true); setError("");
    try {
      if (await window.terminalBridge.stop()) { setRunning(false); setStatus("Stopped"); }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Couldn’t stop the terminal."); }
    finally { setBusy(false); }
  }

  return <div className="workspace" hidden={!active}>
    <div className="workspace-heading"><div><button type="button" className="quiet back-home" onClick={onHome}>Home</button><h1>Workspace</h1><p>Run an installed harness in a working folder.</p></div><span className="terminal-status" role="status">{status}</span></div>
    {intent && <div className="work-context"><span>Current step · {intent.goalTitle}</span><strong>{intent.stepText}</strong><p>This step is not sent to the terminal automatically.</p><div className="inline-actions"><button type="button" className="outline" onClick={() => void copyStep()}>Copy step</button><button type="button" className="quiet" disabled={stepBusy} onClick={onComplete}>{stepBusy ? "Saving…" : "Complete step"}</button></div>{copyMessage && <p className="feedback" role="status">{copyMessage}</p>}{copyError && <p className="feedback error" role="alert">{copyError}</p>}</div>}
    {stepError && <p className="feedback error" role="alert">{stepError}</p>}
    {stepMessage && <p id="workspace-step-result" className="feedback" role="status" tabIndex={-1}>{stepMessage}</p>}
    <div className="workspace-controls">
      <label className="harness-label" htmlFor="harness">Harness<select id="harness" value={harness} disabled={busy || running} onChange={event => { checkRequestRef.current++; setAvailabilityState("checking"); setHarness(event.target.value as Harness); }}><option value="opencode">OpenCode</option><option value="agy">Antigravity CLI</option></select></label>
      <div className="folder-control"><span>Working folder</span><div><button type="button" className="outline" disabled={busy || running || !window.terminalBridge} onClick={() => void chooseFolder()}>Choose folder</button><span className="folder-name" title={folder || undefined}>{folder || "No folder selected"}</span></div></div>
      <button type="button" className="primary" disabled={!folder || busy || running || !window.terminalBridge || availabilityState !== "found"} onClick={() => void startTerminal()}>Start terminal</button>
      <button type="button" className="outline" disabled={!running || busy} onClick={() => void stopTerminal()}>Stop session</button>
    </div>
    <p className="terminal-hint">{folder ? "The harness runs in the selected folder." : "Choose an existing working folder before starting. It does not need to be a project."}</p>
    <p className="harness-check" aria-live="polite">{availability} <button type="button" className="text-button" disabled={!window.terminalBridge} onClick={() => void checkHarness(harness)}>Check again</button></p>
    {error && <p className="feedback error" role="alert">{error}</p>}
    <div className="terminal-frame"><div className="terminal-heading"><strong>{harness === "agy" ? "Antigravity CLI" : "OpenCode"} terminal</strong><span>Local session</span></div><div className="terminal-screen" ref={containerRef} role="region" aria-label="Interactive terminal"/></div>
    <p className="terminal-hint">Copy selection: Ctrl+Shift+C · Paste: Ctrl+Shift+V. Hold Shift to select text when the terminal captures the mouse.</p>
    <p className="terminal-hint">Sessions do not persist when you close TGM.</p>
  </div>;
}
