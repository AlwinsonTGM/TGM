import { FormEvent, useEffect, useRef, useState } from "react";
import { Workspace } from "./Workspace";

type Detail = { goalId: number; stepId: number | null; title: string; step: string; savedTitle: string; savedStep: string };
type IconName = "home" | "workspace" | "book" | "arrow" | "clock" | "plus";

function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, React.ReactNode> = {
    home: <><path d="M3 11.5 12 4l9 7.5"/><path d="M6 10v9h12v-9M10 19v-5h4v5"/></>,
    workspace: <><rect x="3.5" y="5" width="17" height="14" rx="2"/><path d="m7 10 3 2-3 2m5 1h4"/></>,
    book: <><path d="M12 7c-2-2-5-2-8-1v12c3-1 6-1 8 1m0-12c2-2 5-2 8-1v12c-3-1-6-1-8 1zm0 0v12"/></>,
    arrow: <><path d="M4 12h15M14 7l5 5-5 5"/></>,
    clock: <><circle cx="12" cy="13" r="7"/><path d="M12 9v4l3 2M9 2h6m-3 0v4"/></>,
    plus: <path d="M12 5v14M5 12h14"/>,
  };
  return <svg aria-hidden="true" className="icon" viewBox="0 0 24 24">{paths[name]}</svg>;
}
function Mark({ large = false }: { large?: boolean }) {
  return <svg aria-hidden="true" className={large ? "mark mark-large" : "mark"} viewBox="0 0 40 40"><path d="M4 6c1 9 6 14 16 19C30 20 35 15 36 6M12 18l8 15 8-15"/></svg>;
}

export function App() {
  const [view, setView] = useState<"home" | "workspace">("home");
  const [workspaceVisited, setWorkspaceVisited] = useState(false);
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [capture, setCapture] = useState("");
  const [captureBusy, setCaptureBusy] = useState(false);
  const [captureLoading, setCaptureLoading] = useState(true);
  const [captureLoadFailed, setCaptureLoadFailed] = useState(false);
  const [captureError, setCaptureError] = useState("");
  const [captureMessage, setCaptureMessage] = useState("");
  const [goals, setGoals] = useState<Goal[]>([]);
  const [goalsLoading, setGoalsLoading] = useState(true);
  const [goalsLoadFailed, setGoalsLoadFailed] = useState(false);
  const [goalsError, setGoalsError] = useState("");
  const [goalBusy, setGoalBusy] = useState(false);
  const [goalMessage, setGoalMessage] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [firstStep, setFirstStep] = useState("");
  const [detail, setDetail] = useState<Detail | null>(null);
  const captureRef = useRef<HTMLInputElement>(null);
  const dirtyDetail = Boolean(detail && (detail.title !== detail.savedTitle || detail.step !== detail.savedStep));
  const hasDraft = Boolean(capture || title || firstStep || dirtyDetail);
  const suggestedGoals = goals.filter(goal => goal.steps.length > 0);
  const goalsWithoutSteps = goals.filter(goal => goal.steps.length === 0);

  useEffect(() => {
    if (!hasDraft) return;
    const protect = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, [hasDraft]);

  async function loadCaptures() {
    setCaptureLoading(true);
    try { setCaptures(await window.tgm.listCaptures()); setCaptureError(""); setCaptureLoadFailed(false); }
    catch { setCaptureLoadFailed(true); setCaptureError("Couldn’t load your captures. Try again."); }
    finally { setCaptureLoading(false); }
  }
  async function loadGoals() {
    setGoalsLoading(true);
    try { setGoals(await window.tgm.listGoals()); setGoalsError(""); setGoalsLoadFailed(false); }
    catch { setGoalsLoadFailed(true); setGoalsError("Couldn’t load your goals. Try again."); }
    finally { setGoalsLoading(false); }
  }
  useEffect(() => { void loadCaptures(); void loadGoals(); }, []);

  async function addCapture(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (captureLoading || captureLoadFailed || captureBusy) return;
    const submitted = capture;
    setCaptureMessage("");
    if (!submitted.trim()) { setCaptureError("Enter a thought before saving."); return; }
    setCaptureBusy(true); setCaptureError("");
    try {
      const saved = await window.tgm.saveCapture(submitted);
      setCaptures(current => [saved, ...current]);
      setCapture(current => current === submitted ? "" : current);
      setCaptureMessage("Thought saved.");
    } catch { setCaptureError("Couldn’t save your thought. Your draft is still here; try again."); }
    finally { setCaptureBusy(false); }
  }
  async function addGoal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (goalsLoading || goalsLoadFailed || goalBusy) return;
    const submittedTitle = title, submittedStep = firstStep;
    setGoalMessage("");
    if (!submittedTitle.trim() || (submittedStep !== "" && !submittedStep.trim())) {
      setGoalsError("Enter a goal title and, if provided, a next step."); return;
    }
    setGoalBusy(true); setGoalsError("");
    try {
      setGoals(await window.tgm.createGoal(submittedTitle, submittedStep));
      setTitle(current => current === submittedTitle ? "" : current);
      setFirstStep(current => current === submittedStep ? "" : current);
      setGoalMessage("Goal saved.");
    } catch { setGoalsError("Couldn’t save your goal. Your draft is still here; try again."); }
    finally { setGoalBusy(false); }
  }
  function openGoal(goal: Goal) {
    if (dirtyDetail && !window.confirm("Discard unsaved goal changes?")) return;
    const step = goal.steps[0];
    setDetail({ goalId: goal.id, stepId: step?.id ?? null, title: goal.title, step: step?.text ?? "", savedTitle: goal.title, savedStep: step?.text ?? "" });
    setGoalsError(""); setGoalMessage("");
  }
  function closeGoal() {
    if (dirtyDetail && !window.confirm("Discard unsaved goal changes?")) return;
    setDetail(null); setGoalsError(""); setGoalMessage("");
  }
  async function saveGoal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail || goalsLoading || goalsLoadFailed || goalBusy) return;
    const submitted = detail;
    setGoalMessage("");
    if (!submitted.title.trim() || (submitted.stepId !== null && !submitted.step.trim()) || (submitted.step !== "" && !submitted.step.trim())) {
      setGoalsError("Enter a goal title and a non-empty next step, if provided."); return;
    }
    setGoalsError(""); setGoalBusy(true);
    try {
      const updated = await window.tgm.saveGoalDetails(submitted.goalId, submitted.title, submitted.stepId, submitted.step, submitted.savedTitle, submitted.savedStep);
      setGoals(updated);
      const newStepId = submitted.stepId ?? (submitted.step ? updated.find(goal => goal.id === submitted.goalId)?.steps[0]?.id ?? null : null);
      setDetail(current => current && current.goalId === submitted.goalId && current.stepId === submitted.stepId
        ? { ...current, stepId: newStepId, savedTitle: submitted.title, savedStep: submitted.step } : current);
      setGoalMessage("Changes saved.");
    } catch (error) {
      setGoalsError(error instanceof Error && error.message.includes("TGM_GOAL_CONFLICT")
        ? "This goal changed elsewhere. Your draft is still here; copy it, then reload to see the latest version."
        : "Couldn’t save your changes. Your draft is still here; try again.");
    } finally { setGoalBusy(false); }
  }

  return <div className="shell">
    <aside className="sidebar" aria-label="Main navigation">
      <div className="brand"><Mark/><div><strong>TGM</strong><small>YOUR COMMAND CENTER</small></div></div>
      <nav aria-label="Sections"><button type="button" className={`nav-item ${view === "home" ? "current" : ""}`} aria-current={view === "home" ? "page" : undefined} onClick={() => setView("home")}><Icon name="home"/> Home</button><button type="button" className={`nav-item ${view === "workspace" ? "current" : ""}`} aria-current={view === "workspace" ? "page" : undefined} onClick={() => { setWorkspaceVisited(true); setView("workspace"); }}><Icon name="workspace"/> Workspace</button><span className="nav-item unavailable"><Icon name="book"/> Learning <small>SOON</small></span></nav>
      <div className="sidebar-section"><span>Your sessions</span><p>Sessions will appear here when connected.</p></div>
      <p className="side-foot">A little progress counts.</p>
    </aside>
    <main>
      <header className="topbar"><div className="breadcrumb">{view === "home" ? "Home" : "Workspace"} <span>/ {view === "home" ? "Your space to begin" : "Your local terminal"}</span></div><div className="top-actions"><button type="button" className="quiet" onClick={() => { setView("home"); requestAnimationFrame(() => captureRef.current?.focus()); }}>Quick capture</button><span className="focus-status"><Icon name="clock"/> Focus not connected</span></div></header>
      <div className="content">
        <div hidden={view !== "home"}>
        <section aria-labelledby="home-title">
          <div className="intro"><div><h1 id="home-title">Let’s make a little progress.</h1><p>Pick a small step, or find your way back to where you left off.</p></div><Mark large/></div>
          <div className="home-grid"><div className="steps-column">
            <div className="section-head"><div><h2>Suggested next steps</h2><p>Small enough to start. Choose what feels right.</p></div><button type="button" className="text-button" onClick={() => setFormOpen(current => !current)} aria-expanded={formOpen} aria-controls="new-goal-form"><Icon name="plus"/> {formOpen ? "Hide form" : "Add goal"}</button></div>
            {goalsLoading ? <p className="muted" role="status">Loading your goals…</p> : !goalsLoadFailed && (suggestedGoals.length === 0 ? <div className="empty"><p>No next steps yet.</p><span>Add a goal and a first step to see it here.</span></div> : <div className="steps">{suggestedGoals.map(goal => <article className="step" key={goal.id}><div><h3>{goal.steps[0].text}</h3><p>{goal.title}</p></div><button type="button" className="outline" disabled={goalBusy} onClick={() => openGoal(goal)} aria-label={`Open ${goal.title}`}>Open <Icon name="arrow"/></button></article>)}</div>)}
            {!goalsLoading && !goalsLoadFailed && goalsWithoutSteps.length > 0 && <section className="waiting-goals" aria-labelledby="waiting-goals-title"><h3 id="waiting-goals-title">Your goals</h3>{goalsWithoutSteps.map(goal => <article className="step" key={goal.id}><div><h3>{goal.title}</h3><p>Add a next step when you’re ready.</p></div><button type="button" className="outline" disabled={goalBusy} onClick={() => openGoal(goal)} aria-label={`Open ${goal.title}`}>Open <Icon name="arrow"/></button></article>)}</section>}
            {goalsError && <div className="feedback error" role="alert"><span>{goalsError}</span>{goalsLoadFailed && !goalsLoading && <button type="button" className="text-button" onClick={() => void loadGoals()}>Retry</button>}</div>}
            {goalMessage && <p className="feedback" role="status">{goalMessage}</p>}
            {formOpen && <form id="new-goal-form" className="goal-form" onSubmit={addGoal}><h3>Add a goal</h3><label htmlFor="goal-title">Goal</label><input id="goal-title" value={title} maxLength={500} onChange={event => setTitle(event.target.value)} placeholder="What would you like to work toward?"/><label htmlFor="goal-step">First next step <span>Optional</span></label><input id="goal-step" value={firstStep} maxLength={500} onChange={event => setFirstStep(event.target.value)} placeholder="What’s one small thing you could do?"/><button className="primary" type="submit" disabled={goalBusy || goalsLoading || goalsLoadFailed}>{goalBusy ? "Saving…" : "Save goal"}</button></form>}
            {detail && <form className="detail-form" onSubmit={saveGoal}><div className="detail-heading"><div><h3>Goal details</h3><p>Review your goal and next step.</p></div><button type="button" className="quiet" onClick={closeGoal} disabled={goalBusy}>Close details</button></div><label htmlFor="detail-title">Goal</label><input id="detail-title" value={detail.title} maxLength={500} onChange={event => setDetail({ ...detail, title: event.target.value })}/><label htmlFor="detail-step">Next step <span>{detail.stepId === null ? "Optional" : "Required"}</span></label><input id="detail-step" value={detail.step} maxLength={500} onChange={event => setDetail({ ...detail, step: event.target.value })}/><button className="primary" type="submit" disabled={goalBusy || goalsLoading || goalsLoadFailed || !dirtyDetail}>{goalBusy ? "Saving…" : "Save changes"}</button></form>}
            <div className="session-note"><div><strong>Continue last session</strong><span>Session history is not connected yet.</span></div></div>
          </div>
          <aside className="focus-panel"><div className="focus-heading"><h2>Independent focus</h2><Icon name="clock"/></div><h3>Work on your own.</h3><p>Focus sessions will be available here when FlowState is connected.</p><button className="primary full" type="button" disabled>Start focus <Icon name="arrow"/></button><div className="aside-note">You don’t need a perfect plan.<br/><strong>Just choose the next step.</strong></div></aside></div>
        </section>
        <section className="capture" aria-labelledby="capture-heading"><div className="capture-heading"><div><h2 id="capture-heading">Quick capture</h2><p>Get it out of your head. Organize it later.</p></div><span>{captureLoading ? "Loading…" : captureLoadFailed ? "Unavailable" : `${captures.length} ${captures.length === 1 ? "note" : "notes"}`}</span></div><form onSubmit={addCapture}><label className="sr-only" htmlFor="capture-input">Capture a thought</label><input ref={captureRef} id="capture-input" value={capture} maxLength={10000} onChange={event => setCapture(event.target.value)} placeholder="A thought, question, or next step…"/><button type="submit" disabled={captureBusy || captureLoading || captureLoadFailed}>{captureBusy ? "Saving…" : "Capture"} <Icon name="arrow"/></button></form>{captureError && <div className="feedback error" role="alert">{captureError} {captureLoadFailed && !captureLoading && <button className="text-button" type="button" onClick={() => void loadCaptures()}>Retry loading</button>}</div>}{captureMessage && <p className="feedback" role="status">{captureMessage}</p>}{!captureLoadFailed && captures.length > 0 && <ul className="capture-list" aria-label="Saved captures">{captures.map(item => <li key={item.id}>{item.text}</li>)}</ul>}</section>
        </div>
        {workspaceVisited && <Workspace active={view === "workspace"} onHome={() => setView("home")} />}
      </div>
    </main>
  </div>;
}
