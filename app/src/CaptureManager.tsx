import { FormEvent, useEffect, useLayoutEffect, useRef, useState } from "react";

type Props = { captures: Capture[]; setCaptures: React.Dispatch<React.SetStateAction<Capture[]>>; goals: Goal[]; onDraftChange: (dirty: boolean) => void; focusCapture: () => void; captureEntry: React.ReactNode; captureAvailable: boolean; projectsRequest: number };

function CaptureText({ item }: { item: Capture }) {
  const [expanded, setExpanded] = useState(false);
  const preview = Array.from(item.text.split("\n").slice(0, 4).join("\n")).slice(0, 240).join("");
  const shortened = preview.length < item.text.length;
  return <><span id={`capture-text-${item.id}`}>{expanded || !shortened ? item.text : `${preview}…`}</span>{shortened && <button type="button" className="quiet capture-expand" aria-expanded={expanded} aria-controls={`capture-text-${item.id}`} aria-label={`${expanded ? "Show less" : "Show full thought"}: ${Array.from(item.text).slice(0, 60).join("")}`} onClick={() => setExpanded(!expanded)}>{expanded ? "Show less" : "Show full thought"}</button>}</>;
}

export function CaptureManager({ captures, setCaptures, goals, onDraftChange, focusCapture, captureEntry, captureAvailable, projectsRequest }: Props) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectError, setProjectError] = useState("");
  const [managing, setManaging] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectFolder, setProjectFolder] = useState<string | null>(null);
  const [projectEdit, setProjectEdit] = useState<Project | null>(null);
  const [editing, setEditing] = useState<Capture | null>(null);
  const [draft, setDraft] = useState("");
  const [target, setTarget] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [projectMessage, setProjectMessage] = useState("");
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const editRef = useRef<HTMLTextAreaElement>(null);
  const projectRef = useRef<HTMLInputElement>(null);
  const dirty = Boolean(editing && (draft !== editing.text || target !== (editing.goalId ? `goal:${editing.goalId}` : editing.projectId ? `project:${editing.projectId}` : "")));
  const projectDirty = projectEdit ? projectName !== projectEdit.name || projectFolder !== projectEdit.folder : Boolean(projectName || projectFolder);
  useLayoutEffect(() => { onDraftChange(dirty || projectDirty); }, [dirty, projectDirty, onDraftChange]);
  useLayoutEffect(() => { if (editing) editRef.current?.focus(); }, [editing?.id]);
  useLayoutEffect(() => { if (managing) projectRef.current?.focus(); }, [managing]);
  useEffect(() => { if (projectsRequest) { setManaging(true); requestAnimationFrame(() => projectRef.current?.focus()); } }, [projectsRequest]);
  async function loadProjects() {
    try { setProjects(await window.tgm.listProjects()); setProjectError(""); }
    catch { setProjectError("Couldn’t load projects. Try again."); }
  }
  useEffect(() => { void loadProjects(); }, []);
  useEffect(() => { if (captures.length <= 5) { setQuery(""); setShowAll(false); } }, [captures.length]);
  function openEdit(item: Capture) {
    if (dirty && !window.confirm("Discard your unsaved capture changes?")) return;
    setEditing(item); setDraft(item.text); setTarget(item.goalId ? `goal:${item.goalId}` : item.projectId ? `project:${item.projectId}` : ""); setError("");
  }
  function closeEdit() {
    if (dirty && !window.confirm("Discard your unsaved capture changes?")) return;
    const id = editing?.id; setEditing(null); setError(""); requestAnimationFrame(() => document.getElementById(`edit-capture-${id}`)?.focus());
  }
  async function saveEdit(event: FormEvent) {
    event.preventDefault();
    if (!editing || busy) return;
    if (!draft.trim()) { setError("Enter a thought before saving."); return; }
    const [kind, value] = target.split(":");
    setBusy(true); setError("");
    try {
      const saved = await window.tgm.updateCapture(editing.id, draft, kind === "goal" ? Number(value) : null, kind === "project" ? Number(value) : null, editing.revision);
      setCaptures(current => current.map(item => item.id === saved.id ? saved : item));
      setEditing(null); setMessage("Capture updated."); requestAnimationFrame(() => document.getElementById(`edit-capture-${saved.id}`)?.focus());
    } catch (cause) { setError(cause instanceof Error && cause.message.includes("TGM_CAPTURE_CONFLICT") ? "This capture changed elsewhere. Your draft is still here; copy it and reload before trying again." : "Couldn’t save this capture. Your draft is still here; try again."); }
    finally { setBusy(false); }
  }
  async function remove(item: Capture) {
    if (busy || !window.confirm("Delete this capture? This cannot be undone.")) return;
    setBusy(true); setError("");
    try { await window.tgm.deleteCapture(item.id, item.revision); setCaptures(current => current.filter(c => c.id !== item.id)); setMessage("Capture deleted."); focusCapture(); }
    catch { setError("Couldn’t delete this capture. It may have changed; reload and try again."); }
    finally { setBusy(false); }
  }
  async function chooseFolder() {
    try { const folder = await window.terminalBridge.chooseFolder(); if (folder) setProjectFolder(folder); }
    catch { setProjectError("Couldn’t choose a folder. Try again."); }
  }
  async function saveProject(event: FormEvent) {
    event.preventDefault();
    if (busy || !projectName.trim()) { setProjectError("Enter a project name."); return; }
    setBusy(true); setProjectError("");
    try {
      const updated = projectEdit ? await window.tgm.updateProject(projectEdit.id, projectName, projectFolder, projectEdit.active) : await window.tgm.createProject(projectName, projectFolder);
      setProjects(updated);
      if (projectEdit) setCaptures(current => current.map(item => item.projectId === projectEdit.id ? { ...item, projectName, targetActive: Number(projectEdit.active) } : item));
      setProjectName(""); setProjectFolder(null); setProjectEdit(null); setProjectMessage(projectEdit ? "Project updated." : "Project created.");
    } catch { setProjectError("Couldn’t save the project. Check its name and folder, then try again."); }
    finally { setBusy(false); }
  }
  async function toggleProject(project: Project) {
    setBusy(true); setProjectError("");
    try { setProjects(await window.tgm.updateProject(project.id, project.name, project.folder, !project.active)); setCaptures(current => current.map(item => item.projectId === project.id ? { ...item, targetActive: Number(!project.active) } : item)); }
    catch { setProjectError("Couldn’t change the project status. Try again."); }
    finally { setBusy(false); }
  }
  const effectiveQuery = captures.length > 5 ? query.trim().toLocaleLowerCase() : "";
  const filteredCaptures = captures.filter(item => `${item.text}\n${item.goalTitle ?? ""}\n${item.projectName ?? ""}`.toLocaleLowerCase().includes(effectiveQuery));
  const visibleCaptures = showAll ? filteredCaptures : filteredCaptures.slice(0, 5);
  if (editing && !visibleCaptures.some(item => item.id === editing.id) && filteredCaptures.some(item => item.id === editing.id)) visibleCaptures.push(editing);

  return <>
    <section className="capture" aria-labelledby="capture-heading">{captureEntry}
    {message && <p className="feedback" role="status">{message}</p>}
    {error && !editing && <p className="feedback error" role="alert">{error}</p>}
    {captureAvailable && captures.length > 5 && <div className="capture-search"><label htmlFor="capture-search">Find a saved thought</label><input id="capture-search" type="search" value={query} disabled={Boolean(editing)} onChange={event => { setQuery(event.target.value); setShowAll(false); }} placeholder="Search thoughts, goals, or projects"/></div>}
    {captureAvailable && effectiveQuery && filteredCaptures.length === 0 && <p className="muted">No saved thoughts match your search.</p>}
    {captureAvailable && visibleCaptures.length > 0 && <ul className="capture-list" aria-label="Saved captures">{visibleCaptures.map(item => <li key={item.id}>
      {editing?.id === item.id ? <form onSubmit={saveEdit} className="capture-edit"><label htmlFor={`capture-edit-${item.id}`}>Edit capture</label><textarea ref={editRef} id={`capture-edit-${item.id}`} data-draft-original={item.text} value={draft} maxLength={10000} disabled={busy} onChange={e => setDraft(e.target.value)}/><label htmlFor={`capture-target-${item.id}`}>Attach to</label><select id={`capture-target-${item.id}`} data-draft-original={item.goalId ? `goal:${item.goalId}` : item.projectId ? `project:${item.projectId}` : ""} value={target} disabled={busy} onChange={e => setTarget(e.target.value)}><option value="">No attachment</option>
        {item.goalId && !goals.some(g => g.id === item.goalId) && <option value={`goal:${item.goalId}`}>{item.goalTitle || "Unavailable goal"} (archived)</option>}
        {goals.length > 0 && <optgroup label="Goals">{goals.map(goal => <option key={goal.id} value={`goal:${goal.id}`}>{goal.title}</option>)}</optgroup>}
        {item.projectId && !projects.some(p => p.id === item.projectId && p.active) && <option value={`project:${item.projectId}`}>{item.projectName || "Unavailable project"} (archived)</option>}
        {projects.some(p => p.active) && <optgroup label="Projects">{projects.filter(p => p.active).map(project => <option key={project.id} value={`project:${project.id}`}>{project.name}</option>)}</optgroup>}</select>
        {projectError && <p className="feedback error">Projects couldn’t load; retry in Manage projects.</p>}{error && <p className="feedback error" role="alert">{error}</p>}<div className="inline-actions"><button className="primary" disabled={busy}>Save capture</button><button type="button" className="quiet" disabled={busy} onClick={closeEdit}>Cancel</button></div></form>
      : <><div className="capture-content"><CaptureText item={item}/>{(item.goalTitle || item.projectName) && <small>{item.goalTitle ? "Goal" : "Project"}: {item.goalTitle || item.projectName}{item.targetActive === 0 ? " (archived)" : ""}</small>}</div><div className="inline-actions"><button id={`edit-capture-${item.id}`} type="button" className="quiet" disabled={busy} aria-label={`Edit capture: ${item.text.slice(0, 60)}`} onClick={() => openEdit(item)}>Edit / attach</button><button type="button" className="quiet" disabled={busy} aria-label={`Delete capture: ${item.text.slice(0, 60)}`} onClick={() => void remove(item)}>Delete</button></div></>}
    </li>)}</ul>}
    {captureAvailable && filteredCaptures.length > 5 && <button type="button" className="text-button show-more" disabled={Boolean(editing)} aria-expanded={showAll} onClick={() => setShowAll(!showAll)}>{showAll ? "Show fewer thoughts" : `Show all ${filteredCaptures.length} thoughts`}</button>}
    </section>
    <section className="projects" aria-labelledby="projects-heading"><div className="section-head"><h2 id="projects-heading">Projects</h2><button type="button" className="text-button" aria-expanded={managing} aria-controls="project-manager" onClick={() => setManaging(!managing)}>{managing ? "Close projects" : "Manage projects"}</button></div>
    {managing && <div id="project-manager" className="project-manager"><p className="muted">A project can have a folder, or just a name.</p>
      <form onSubmit={saveProject} className="project-form"><label htmlFor="project-name">{projectEdit ? "Edit project name" : "New project name"}</label><input ref={projectRef} id="project-name" data-draft-original={projectEdit?.name ?? ""} value={projectName} maxLength={500} disabled={busy} onChange={e => setProjectName(e.target.value)} />
        <div className="project-folder"><button type="button" className="outline" onClick={() => void chooseFolder()} disabled={busy}>Choose folder</button><span>{projectFolder || "No folder (optional)"}</span>{projectFolder && <button type="button" className="quiet" disabled={busy} onClick={() => setProjectFolder(null)}>Remove folder</button>}</div>
        <div className="inline-actions"><button className="primary" disabled={busy}>{projectEdit ? "Save project" : "Create project"}</button>{projectEdit && <button className="quiet" type="button" disabled={busy} onClick={() => { if (projectDirty && !window.confirm("Discard your unsaved project changes?")) return; setProjectEdit(null); setProjectName(""); setProjectFolder(null); }}>Cancel edit</button>}</div></form>
      {projects.length > 0 && <ul className="project-list">{projects.map(project => <li key={project.id}><span>{project.name}{!project.active && " (archived)"}</span><div className="inline-actions"><button className="quiet" type="button" disabled={busy} aria-label={`Edit project: ${project.name}`} onClick={() => { if (projectDirty && !window.confirm("Discard your unsaved project changes?")) return; setProjectEdit(project); setProjectName(project.name); setProjectFolder(project.folder); projectRef.current?.focus(); }}>Edit</button><button className="quiet" type="button" disabled={busy || projectEdit?.id === project.id} aria-label={`${project.active ? "Archive" : "Restore"} project: ${project.name}`} onClick={() => void toggleProject(project)}>{project.active ? "Archive" : "Restore"}</button></div></li>)}</ul>}
      {projectMessage && <p className="feedback" role="status">{projectMessage}</p>}
      {projectError && <p className="feedback error" role="alert">{projectError} <button className="text-button" type="button" onClick={() => void loadProjects()}>Retry</button></p>}</div>}</section>
  </>;
}
