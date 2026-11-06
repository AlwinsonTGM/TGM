(() => {
  const $ = (selector) => document.querySelector(selector);
  const all = (selector) => document.querySelectorAll(selector);
  const contexts = {'Functions practice':'TypeScript learning', 'Objects practice':'TypeScript learning', 'Review study notes':'Personal & study', 'Portfolio: next step':'Personal & study'};
  const state = {session:'Functions practice', focus:'idle', focusTarget:'', seconds:0, completed:new Set(), captures:[]};
  const format = (seconds) => `${String(Math.floor(seconds / 60)).padStart(2,'0')}:${String(seconds % 60).padStart(2,'0')}`;
  function drawFocus() {
    const active = state.focus === 'running' || state.focus === 'paused';
    $('#timer').textContent = format(state.seconds);
    $('#focus-label').textContent = active ? `${state.focus === 'running' ? 'Focusing' : 'Paused'} · ${state.focusTarget}` : state.focus === 'stopped' ? 'Session stopped' : 'Focus ready';
    const task = state.focusTarget || state.session;
    const done = state.completed.has(task);
    $('#focus-detail').textContent = active ? `${state.focus === 'paused' ? 'Paused' : 'Focusing'} on ${task} · ${format(state.seconds)}` : state.focus === 'stopped' ? `Stopped at ${format(state.seconds)} · ${task} ${done ? 'completed' : 'remains open'}` : `${state.session} · ${state.completed.has(state.session) ? 'completed' : 'task open'}`;
    $('[data-workspace-start]').hidden = active;
    $('[data-pause]').hidden = !active;
    $('[data-pause]').textContent = state.focus === 'paused' ? 'Resume' : 'Pause';
    $('[data-stop]').hidden = !active;
    $('[data-top-pause]').hidden = !active;
    $('[data-top-pause]').textContent = state.focus === 'paused' ? 'Resume' : 'Pause';
    $('[data-top-stop]').hidden = !active;
    $('[data-start-focus]').textContent = active ? 'Focus in progress' : 'Start focus ↗';
    $('[data-start-focus]').disabled = active;
    $('[data-complete]').disabled = state.completed.has(state.session);
    $('[data-complete]').textContent = state.completed.has(state.session) ? 'Task completed' : 'Complete task';
  }
  function openSession(name) {
    state.session = name;
    $('#home-view').hidden = true; $('#workspace-view').hidden = false;
    $('#workspace-title').textContent = name;
    $('#workspace-context').textContent = `${contexts[name] || 'Personal'} · Sample session`;
    $('#last-session').textContent = `${name} · ${contexts[name] || 'Personal'}`;
    $('#breadcrumb').textContent = `Workspace / ${name}`;
    all('.session').forEach((el) => el.classList.toggle('active',el.dataset.session === name));
    all('.nav').forEach((el) => el.classList.toggle('active',el.dataset.session === 'Functions practice'));
    drawFocus(); window.scrollTo(0,0);
  }
  function home() {
    $('#workspace-view').hidden = true; $('#home-view').hidden = false;
    $('#breadcrumb').innerHTML = 'Home <span>/ Your space to begin</span>';
    all('.nav').forEach((el) => el.classList.toggle('active',el.hasAttribute('data-home')));
    window.scrollTo(0,0);
  }
  function startFocus(target) {
    if (state.focus === 'running' || state.focus === 'paused') return;
    state.focus = 'running'; state.focusTarget = target; state.seconds = 0; drawFocus();
  }
  function stopFocus() { if (state.focus === 'running' || state.focus === 'paused') { state.focus = 'stopped'; drawFocus(); } }
  all('[data-session]').forEach((button) => button.addEventListener('click',() => openSession(button.dataset.session)));
  all('[data-home]').forEach((button) => button.addEventListener('click',home));
  $('#continue').addEventListener('click',() => openSession(state.session));
  $('[data-start-focus]').addEventListener('click',() => startFocus($('#focus-target').value));
  $('[data-workspace-start]').addEventListener('click',() => startFocus(state.session));
  $('[data-pause]').addEventListener('click',() => { state.focus = state.focus === 'running' ? 'paused' : 'running'; drawFocus(); });
  $('[data-stop]').addEventListener('click',stopFocus);
  $('[data-top-pause]').addEventListener('click',() => { state.focus = state.focus === 'running' ? 'paused' : 'running'; drawFocus(); });
  $('[data-top-stop]').addEventListener('click',stopFocus);
  $('[data-complete]').addEventListener('click',() => { state.completed.add(state.session); if (state.focusTarget === state.session) stopFocus(); drawFocus(); });
  setInterval(() => { if (state.focus === 'running') { state.seconds++; drawFocus(); } },1000);
  $('#time-filter').addEventListener('change',(event) => { const max = Number(event.target.value); all('.step').forEach((step) => { step.hidden = max > 0 && Number(step.dataset.minutes) > max; }); });
  $('#capture-form').addEventListener('submit',(event) => { event.preventDefault(); const input = $('#capture-input'); const text = input.value.trim(); if (!text) { $('#capture-feedback').textContent = 'Write a thought first, then capture it.'; input.focus(); return; } state.captures.push(text); const item = document.createElement('li'); item.textContent = text; $('#capture-list').append(item); $('#capture-count').textContent = `${state.captures.length} ${state.captures.length === 1 ? 'note' : 'notes'}`; $('#capture-feedback').textContent = 'Captured in this preview. No file was saved.'; input.value = ''; });
  $('#capture-jump').addEventListener('click',() => $('#capture-input').focus());
  document.addEventListener('keydown',(event) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); $('#capture-input').focus(); } });
  $('#terminal-form').addEventListener('submit',(event) => { event.preventDefault(); const input = $('#terminal-command'); const cmd = input.value.trim(); if (!cmd) return; const line = document.createElement('p'); line.textContent = `› ${cmd}`; $('#terminal-output').append(line); const response = document.createElement('p'); response.className = 'terminal-muted'; if (cmd === '/focus') { startFocus(state.session); response.textContent = 'Sample focus action requested.'; } else if (cmd === '/stop') { stopFocus(); response.textContent = 'Sample stop action requested.'; } else response.textContent = 'Preview only — no real command was executed.'; $('#terminal-output').append(response); input.value = ''; });
  all('[data-review]').forEach((button) => button.addEventListener('click',() => { const kind = button.dataset.review; $('#review-title').textContent = kind === 'memory' ? 'Review project memory' : 'Review study reviewer'; $('#review-session').textContent = state.session; $('#review-focus').textContent = state.focusTarget ? `${format(state.seconds)} · ${state.focus} · ${state.focusTarget}` : 'Not started'; $('#review-count').textContent = `${state.captures.length} in this preview`; $('#review-editor').value = kind === 'memory' ? `# Suggested memory — ${state.session}\n\nAdd only the details you want to keep.\n\n- Next step: ` : `# Reviewer — ${state.session}\n\nDraft your study notes here.\n\n## Practice\n- What would you like to recall?`; $('#review-dialog').showModal(); }));
  $('#close-dialog').addEventListener('click',() => $('#review-dialog').close());
  $('#discard').addEventListener('click',() => $('#review-dialog').close());
  $('#approve').addEventListener('click',() => { $('#review-dialog').close(); $('#capture-feedback').textContent = 'Preview approved. No file was changed.'; });
  drawFocus();
})();
