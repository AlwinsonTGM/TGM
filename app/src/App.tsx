import { FormEvent, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Workspace } from "./Workspace";
import { CaptureManager } from "./CaptureManager";

type Detail = { goalId: number; stepId: number | null; title: string; step: string; savedTitle: string; savedStep: string };
type IconName = "home" | "workspace" | "folder" | "book" | "arrow" | "clock" | "plus";

function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, React.ReactNode> = {
    home: <><path d="M3 11.5 12 4l9 7.5"/><path d="M6 10v9h12v-9M10 19v-5h4v5"/></>,
    workspace: <><rect x="3.5" y="5" width="17" height="14" rx="2"/><path d="m7 10 3 2-3 2m5 1h4"/></>,
    folder: <path d="M3.5 7.5h6l2 2h9v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>,
    book: <><path d="M12 7c-2-2-5-2-8-1v12c3-1 6-1 8 1m0-12c2-2 5-2 8-1v12c-3-1-6-1-8 1zm0 0v12"/></>,
    arrow: <><path d="M4 12h15M14 7l5 5-5 5"/></>,
    clock: <><circle cx="12" cy="13" r="7"/><path d="M12 9v4l3 2M9 2h6m-3 0v4"/></>,
    plus: <path d="M12 5v14M5 12h14"/>,
  };
  return <svg aria-hidden="true" className="icon" viewBox="0 0 24 24">{paths[name]}</svg>;
}
function Mark() {
  return <svg aria-hidden="true" className="mark" viewBox="0 0 40 40"><path d="M4 6c1 9 6 14 16 19C30 20 35 15 36 6M12 18l8 15 8-15"/></svg>;
}

export function App() {
  const [view, setView] = useState<"home" | "workspace">("home");
  const [workspaceVisited, setWorkspaceVisited] = useState(false);
  const [projectsRequest, setProjectsRequest] = useState(0);
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [capture, setCapture] = useState("");
  const [captureBusy, setCaptureBusy] = useState(false);
  const [captureLoading, setCaptureLoading] = useState(true);
  const [captureLoadFailed, setCaptureLoadFailed] = useState(false);
  const [captureError, setCaptureError] = useState("");
  const [captureMessage, setCaptureMessage] = useState("");
  const [goals, setGoals] = useState<Goal[]>([]);
  const [completedSteps, setCompletedSteps] = useState<CompletedStep[]>([]);
  const [stepBusy, setStepBusy] = useState(false);
  const [stepMessage, setStepMessage] = useState("");
  const [stepError, setStepError] = useState("");
  const [goalsLoading, setGoalsLoading] = useState(true);
  const [goalsLoadFailed, setGoalsLoadFailed] = useState(false);
  const [goalsError, setGoalsError] = useState("");
  const [goalBusy, setGoalBusy] = useState(false);
  const [goalMessage, setGoalMessage] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [firstStep, setFirstStep] = useState("");
  const [detail, setDetail] = useState<Detail | null>(null);
  const [captureDraft, setCaptureDraft] = useState(false);
  const [intent, setIntent] = useState<WorkIntent | null>(null);
  const [choosing, setChoosing] = useState<Goal | null>(null);
  const [showAllSteps, setShowAllSteps] = useState(false);
  const [showAllWaiting, setShowAllWaiting] = useState(false);
  const [terminalRunning, setTerminalRunning] = useState(false);
  const [startMessage, setStartMessage] = useState("");
  const captureRef = useRef<HTMLInputElement>(null);
  const goalReturnRef = useRef<HTMLElement | null>(null);
  const goalFormReturnRef = useRef<HTMLElement | null>(null);
  const chooserReturnRef = useRef<HTMLElement | null>(null);
  const dirtyDetail = Boolean(detail && (detail.title !== detail.savedTitle || detail.step !== detail.savedStep));
  const hasDraft = Boolean(capture || title || firstStep || dirtyDetail || captureDraft);
  const hasDraftRef = useRef(hasDraft);
  hasDraftRef.current = hasDraft;
  const suggestedGoals = goals.filter(goal => goal.steps.length > 0);
  const goalsWithoutSteps = goals.filter(goal => goal.steps.length === 0);

  useLayoutEffect(() => { if (formOpen) document.getElementById("goal-title")?.focus(); }, [formOpen]);
  useLayoutEffect(() => { if (detail) document.getElementById("detail-title")?.focus(); }, [detail?.goalId]);
  useLayoutEffect(() => { if (choosing) document.getElementById("work-independent")?.focus(); }, [choosing?.id]);
  useLayoutEffect(() => { if (intent?.mode === "independent") document.getElementById("independent-heading")?.focus(); }, [intent]);

  useLayoutEffect(() => {
    const protect = (event: BeforeUnloadEvent) => {
      const pendingInput = Boolean(captureRef.current?.value) || Array.from(document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("[data-draft-original]"))
        .some(input => input.value !== input.dataset.draftOriginal);
      if (!hasDraftRef.current && !pendingInput) return;
      event.preventDefault(); event.returnValue = "";
    };
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, []);

  async function loadCaptures() {
    setCaptureLoading(true);
    try { setCaptures(await window.tgm.listCaptures()); setCaptureError(""); setCaptureLoadFailed(false); }
    catch { setCaptureLoadFailed(true); setCaptureError("Couldn’t load your captures. Try again."); }
    finally { setCaptureLoading(false); }
  }
  async function loadGoals() {
    setGoalsLoading(true);
    try { const [loadedGoals, completed] = await Promise.all([window.tgm.listGoals(), window.tgm.listCompletedSteps()]); setGoals(loadedGoals); setCompletedSteps(completed); setGoalsError(""); setGoalsLoadFailed(false); }
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
    goalReturnRef.current = document.activeElement as HTMLElement;
    setChoosing(null);
    const step = goal.steps[0];
    setDetail({ goalId: goal.id, stepId: step?.id ?? null, title: goal.title, step: step?.text ?? "", savedTitle: goal.title, savedStep: step?.text ?? "" });
    setGoalsError(""); setGoalMessage("");
  }
  function closeGoal() {
    if (dirtyDetail && !window.confirm("Discard unsaved goal changes?")) return;
    setDetail(null); setGoalsError(""); setGoalMessage("");
    requestAnimationFrame(() => goalReturnRef.current?.focus());
  }
  function chooseWork(goal: Goal, trigger: HTMLElement) {
    if (terminalRunning) { setStartMessage("A terminal session is running. Return to Workspace and stop it before starting another step."); return; }
    if (dirtyDetail && !window.confirm("Discard unsaved goal changes?")) return;
    setDetail(null); setGoalMessage(""); setGoalsError("");
    chooserReturnRef.current = trigger; setChoosing(goal); setStartMessage("");
  }
  function startWork(mode: WorkIntent["mode"]) {
    if (!choosing || terminalRunning) return;
    setStepMessage(""); setStepError("");
    setIntent({ goalId: choosing.id, stepId: choosing.steps[0].id, goalTitle: choosing.title, stepText: choosing.steps[0].text, mode });
    setChoosing(null);
    if (mode !== "independent") { setWorkspaceVisited(true); setView("workspace"); }
  }
  async function completeCurrentStep() {
    if (!intent || stepBusy || goalBusy) return;
    const current = intent;
    if (detail?.goalId === current.goalId) { setStepError("Close the goal details before completing this step."); return; }
    setStepBusy(true); setStepError(""); setStepMessage("");
    try {
      const result = await window.tgm.completeStep(current.goalId, current.stepId, current.stepText);
      setGoals(result.goals); setCompletedSteps(result.completed);
      setIntent(existing => existing?.stepId === current.stepId ? null : existing);
      setChoosing(existing => existing?.id === current.goalId ? null : existing);
      setStepMessage(terminalRunning ? "Step completed. Your terminal session is still running." : "Step completed. Add another next step when you’re ready.");
      requestAnimationFrame(() => document.getElementById(view === "home" ? "home-step-result" : "workspace-step-result")?.focus());
    } catch (error) {
      setStepError(error instanceof Error && error.message.includes("TGM_GOAL_CONFLICT")
        ? "This step changed elsewhere. Reload TGM to see the latest version."
        : "Couldn’t complete this step. It is still active; try again.");
    } finally { setStepBusy(false); }
  }
  async function restoreStep(step: CompletedStep) {
    if (stepBusy || goalBusy) return;
    if (detail?.goalId === step.goalId) { setStepError("Close the goal details before restoring this step."); return; }
    setStepBusy(true); setStepError(""); setStepMessage("");
    try {
      const result = await window.tgm.restoreStep(step.goalId, step.id);
      setGoals(result.goals); setCompletedSteps(result.completed);
      setStepMessage("Step restored to your next steps.");
      requestAnimationFrame(() => document.getElementById("home-step-result")?.focus());
    } catch (error) {
      setStepError(error instanceof Error && error.message.includes("TGM_GOAL_CONFLICT")
        ? "This goal already has a next step, or the completed step changed. Finish the current step or reload TGM to see the latest version."
        : "Couldn’t restore this step. Try again.");
    } finally { setStepBusy(false); }
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
      setCaptures(current => current.map(item => item.goalId === submitted.goalId ? { ...item, goalTitle: submitted.title } : item));
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

  function goalDetails(goal: Goal) {
    if (!detail || detail.goalId !== goal.id) return null;
    return <form className="detail-form" onSubmit={saveGoal}><div className="detail-heading"><div><h3>Goal details</h3><p>Review your goal and next step.</p></div><button type="button" className="quiet" onClick={closeGoal} disabled={goalBusy}>Close details</button></div><label htmlFor="detail-title">Goal</label><input id="detail-title" data-draft-original={detail.savedTitle} value={detail.title} maxLength={500} onChange={event => setDetail({ ...detail, title: event.target.value })}/><label htmlFor="detail-step">Next step <span>{detail.stepId === null ? "Optional" : "Required"}</span></label><input id="detail-step" data-draft-original={detail.savedStep} value={detail.step} maxLength={500} onChange={event => setDetail({ ...detail, step: event.target.value })}/><button className="primary" type="submit" disabled={goalBusy || stepBusy || goalsLoading || goalsLoadFailed || !dirtyDetail}>{goalBusy ? "Saving…" : "Save changes"}</button></form>;
  }
  function workChoice(goal: Goal) {
    if (choosing?.id !== goal.id) return null;
    return <section className="work-choice" aria-labelledby="work-choice-title"><h3 id="work-choice-title">How would you like to work?</h3><p>{goal.steps[0].text} · {goal.title}</p><div className="work-options"><button id="work-independent" type="button" className="outline" disabled={stepBusy} onClick={() => startWork("independent")}>Work independently</button><button type="button" className="outline" disabled={stepBusy} onClick={() => startWork("agy")}>Antigravity CLI</button><button type="button" className="outline" disabled={stepBusy} onClick={() => startWork("opencode")}>OpenCode</button><button type="button" className="quiet" onClick={() => { setChoosing(null); requestAnimationFrame(() => chooserReturnRef.current?.focus()); }}>Cancel</button></div></section>;
  }

  function goHome() {
    setView("home");
    requestAnimationFrame(() => window.scrollTo(0, 0));
  }

  return <div className="shell">
    <aside className="sidebar" aria-label="Main navigation">
      <div className="brand"><Mark/><div><strong>TGM</strong><small>YOUR COMMAND CENTER</small></div></div>
      <nav aria-label="Sections"><button type="button" className={`nav-item ${view === "home" ? "current" : ""}`} aria-current={view === "home" ? "page" : undefined} onClick={goHome}><Icon name="home"/> Home</button><button type="button" className={`nav-item ${view === "workspace" ? "current" : ""}`} aria-current={view === "workspace" ? "page" : undefined} onClick={() => { setWorkspaceVisited(true); setView("workspace"); }}><Icon name="workspace"/> Workspace</button><button type="button" className="nav-item" onClick={() => { setView("home"); setProjectsRequest(value => value + 1); }}><Icon name="folder"/> Projects</button><span className="nav-item unavailable"><Icon name="book"/> Learning <small>SOON</small></span></nav>
      <p className="side-foot">A little progress counts.</p>
    </aside>
    <main>
      <header className="topbar"><div className="breadcrumb">{view === "home" ? "Home" : "Workspace"} <span>/ {view === "home" ? "Your space to begin" : "Your local terminal"}</span></div><div className="top-actions"><button type="button" className="quiet" onClick={() => { setView("home"); requestAnimationFrame(() => captureRef.current?.focus()); }}>Quick capture</button></div></header>
      <div className="content">
        <div hidden={view !== "home"}>
        <section aria-labelledby="home-title">
          <div className="intro"><div><h1 id="home-title">Let’s make a little progress.</h1><p>Pick a small step to get started.</p></div></div>
          <div className={`home-grid ${intent?.mode === "independent" ? "has-focus" : ""}`}><div className="steps-column">
            <div className="section-head"><div><h2>Suggested next steps</h2><p>Small enough to start. Choose what feels right.</p></div><button type="button" className={suggestedGoals.length ? "text-button" : "outline"} onClick={e => { if (!formOpen) { goalFormReturnRef.current = e.currentTarget; setFormOpen(true); } else { setFormOpen(false); requestAnimationFrame(() => goalFormReturnRef.current?.focus()); } }} aria-expanded={formOpen} aria-controls="new-goal-form"><Icon name="plus"/> {formOpen ? "Hide form" : "Add goal"}</button></div>
            {formOpen && <form id="new-goal-form" className="goal-form" onSubmit={addGoal}><h3>Add a goal</h3><label htmlFor="goal-title">Goal</label><input id="goal-title" data-draft-original="" value={title} maxLength={500} onChange={event => setTitle(event.target.value)} placeholder="What would you like to work toward?"/><label htmlFor="goal-step">First next step <span>Optional</span></label><input id="goal-step" data-draft-original="" value={firstStep} maxLength={500} onChange={event => setFirstStep(event.target.value)} placeholder="What’s one small thing you could do?"/><button className="primary" type="submit" disabled={goalBusy || stepBusy || goalsLoading || goalsLoadFailed}>{goalBusy ? "Saving…" : "Save goal"}</button></form>}
            {goalsLoading ? <p className="muted" role="status">Loading your goals…</p> : !goalsLoadFailed && (suggestedGoals.length === 0 ? <div className="empty"><p>No next steps yet.</p><span>{goalsWithoutSteps.length ? "Add a next step to a goal below when you’re ready." : "Add a goal and a first step to see it here."}</span></div> : <><div className="steps" id="suggested-steps">{(showAllSteps ? suggestedGoals : suggestedGoals.slice(0, 3)).map((goal, index) => <div key={goal.id}><article className="step"><div><h3>{goal.steps[0].text}</h3><p>{goal.title}</p></div><div className="inline-actions"><button type="button" className={index === 0 ? "primary" : "outline"} disabled={goalBusy || stepBusy} onClick={e => chooseWork(goal, e.currentTarget)} aria-label={`Start ${goal.title}`}>Start</button><button type="button" className="quiet" disabled={goalBusy || stepBusy} onClick={() => openGoal(goal)} aria-label={`Edit ${goal.title}`}>Edit</button></div></article>{workChoice(goal)}{goalDetails(goal)}</div>)}</div>{suggestedGoals.length > 3 && <button type="button" className="text-button show-more" aria-expanded={showAllSteps} aria-controls="suggested-steps" onClick={() => { if (showAllSteps && !suggestedGoals.slice(0, 3).some(goal => goal.id === detail?.goalId) && detail && suggestedGoals.some(goal => goal.id === detail.goalId)) { if (dirtyDetail && !window.confirm("Discard unsaved goal changes?")) return; setDetail(null); } if (showAllSteps && choosing && !suggestedGoals.slice(0, 3).some(goal => goal.id === choosing.id)) setChoosing(null); setShowAllSteps(!showAllSteps); }}>{showAllSteps ? "Show fewer steps" : `Show all ${suggestedGoals.length} steps`}</button>}</>)}
            {startMessage && <div className="feedback" role="status">{startMessage} <button className="text-button" type="button" onClick={() => { setWorkspaceVisited(true); setView("workspace"); }}>Open Workspace</button></div>}
            {!goalsLoading && !goalsLoadFailed && goalsWithoutSteps.length > 0 && <section className="waiting-goals" aria-labelledby="waiting-goals-title"><h3 id="waiting-goals-title">Goals without a next step</h3><div id="waiting-goals">{(showAllWaiting ? goalsWithoutSteps : goalsWithoutSteps.slice(0, 3)).map(goal => <div key={goal.id}><article className="step"><div><h3>{goal.title}</h3><p>Add a next step when you’re ready.</p></div><button type="button" className="outline" disabled={goalBusy || stepBusy} onClick={() => openGoal(goal)} aria-label={`Open ${goal.title}`}>Open <Icon name="arrow"/></button></article>{goalDetails(goal)}</div>)}</div>{goalsWithoutSteps.length > 3 && <button type="button" className="text-button show-more" aria-expanded={showAllWaiting} aria-controls="waiting-goals" onClick={() => { if (showAllWaiting && detail && goalsWithoutSteps.some(goal => goal.id === detail.goalId) && !goalsWithoutSteps.slice(0, 3).some(goal => goal.id === detail.goalId)) { if (dirtyDetail && !window.confirm("Discard unsaved goal changes?")) return; setDetail(null); } setShowAllWaiting(!showAllWaiting); }}>{showAllWaiting ? "Show fewer goals" : `Show all ${goalsWithoutSteps.length} goals`}</button>}</section>}
            {goalsError && <div className="feedback error" role="alert"><span>{goalsError}</span>{goalsLoadFailed && !goalsLoading && <button type="button" className="text-button" onClick={() => void loadGoals()}>Retry</button>}</div>}
            {goalMessage && <p className="feedback" role="status">{goalMessage}</p>}
            {stepError && <p className="feedback error" role="alert">{stepError}</p>}
            {stepMessage && <p id="home-step-result" className="feedback" role="status" tabIndex={-1}>{stepMessage}</p>}
            {completedSteps.length > 0 && <details className="completed-steps"><summary>Completed steps ({completedSteps.length})</summary><ul>{completedSteps.map(step => <li key={step.id}><div><strong>{step.text}</strong><span>{step.goalTitle}</span></div><button type="button" className="quiet" disabled={stepBusy || goalBusy} aria-label={`Restore ${step.text}`} onClick={() => void restoreStep(step)}>Restore</button></li>)}</ul></details>}
          </div>
          {intent?.mode === "independent" && <aside className="focus-panel"><div className="focus-heading"><h2>Working independently</h2><Icon name="clock"/></div><h3 id="independent-heading" tabIndex={-1}>{intent.stepText}</h3><p>{intent.goalTitle}</p><p>Timing and session history are not connected yet.</p><div className="focus-actions"><button type="button" className="primary" disabled={stepBusy || goalBusy} onClick={() => void completeCurrentStep()}>{stepBusy ? "Saving…" : "Complete step"}</button><button type="button" className="quiet" disabled={stepBusy} onClick={() => setIntent(null)}>Clear current step</button></div></aside>}</div>
        </section>
        <CaptureManager captures={captures} setCaptures={setCaptures} goals={goals} onDraftChange={setCaptureDraft} focusCapture={() => captureRef.current?.focus()} projectsRequest={projectsRequest} captureAvailable={!captureLoadFailed} captureEntry={<><div className="capture-heading"><div><h2 id="capture-heading">Quick capture</h2><p>Get it out of your head. Organize it later.</p></div><span>{captureLoading ? "Loading…" : captureLoadFailed ? "Unavailable" : `${captures.length} ${captures.length === 1 ? "note" : "notes"}`}</span></div><form onSubmit={addCapture}><label className="sr-only" htmlFor="capture-input">Capture a thought</label><input ref={captureRef} id="capture-input" value={capture} maxLength={10000} onChange={event => setCapture(event.target.value)} placeholder="A thought, question, or next step…"/><button type="submit" disabled={captureBusy || captureLoading || captureLoadFailed}>{captureBusy ? "Saving…" : "Capture"} <Icon name="arrow"/></button></form>{captureError && <div className="feedback error" role="alert">{captureError} {captureLoadFailed && !captureLoading && <button className="text-button" type="button" onClick={() => void loadCaptures()}>Retry loading</button>}</div>}{captureMessage && <p className="feedback" role="status">{captureMessage}</p>}</>}/>
        </div>
        {workspaceVisited && <Workspace active={view === "workspace"} onHome={goHome} intent={intent?.mode === "independent" ? null : intent} onRunningChange={setTerminalRunning} onComplete={() => void completeCurrentStep()} stepBusy={stepBusy || goalBusy} stepMessage={stepMessage} stepError={stepError} />}
      </div>
    </main>
  </div>;
}
