function createSessionStore(defaultHarnesses) {
  const sessions = new Map();
  const defaults = new Map();
  let nextId = 0;

  function ensure(task, harness) {
    if (!Object.hasOwn(defaultHarnesses, task) || !['agy', 'opencode'].includes(harness)) {
      throw new Error('Unknown sample session or harness.');
    }
    let session = [...sessions.values()].find(item => item.task === task && item.harness === harness);
    if (!session) {
      session = { id: `sample-${++nextId}`, task, harness, lines: [], draft: '' };
      sessions.set(session.id, session);
    }
    return session;
  }

  for (const [task, harness] of Object.entries(defaultHarnesses)) defaults.set(task, ensure(task, harness).id);
  return {
    ensure,
    get: id => sessions.get(id),
    defaultFor: task => sessions.get(defaults.get(task))
  };
}

if (typeof module !== 'undefined' && module.exports) module.exports = { createSessionStore };

if (typeof document !== 'undefined') (() => {
  const $ = (selector) => document.querySelector(selector);
  const all = (selector) => document.querySelectorAll(selector);

  const contexts = {
    'Functions practice': 'TypeScript learning',
    'Objects practice': 'TypeScript learning',
    'Review study notes': 'Personal & study',
    'Portfolio: next step': 'Personal & study'
  };

  const harnesses = {
    agy: {
      id: 'agy',
      short: 'AGY',
      label: 'AGY CLI',
      terminalTitle: 'AGY Terminal',
      command: 'agy',
      faultTitle: 'AGY CLI unavailable or session restore failed.'
    },
    opencode: {
      id: 'opencode',
      short: 'OC',
      label: 'OpenCode',
      terminalTitle: 'OpenCode Terminal',
      command: 'opencode --standalone',
      faultTitle: 'OpenCode CLI unavailable or session restore failed.'
    }
  };

  const sessionStore = createSessionStore({
      'Functions practice': 'agy',
      'Objects practice': 'opencode',
      'Review study notes': 'agy',
      'Portfolio: next step': 'opencode'
  });

  const state = {
    session: 'Functions practice',
    sessionId: sessionStore.defaultFor('Functions practice').id,
    cliUnavailable: { agy: false, opencode: false },
    focus: 'idle',
    focusTarget: '',
    seconds: 0,
    completed: new Set(),
    captures: []
  };

  const format = (seconds) =>
    `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

  $('#focus-label').setAttribute('role', 'status');

  function getSessionHarness(sessionName) {
    const session = sessionName ? sessionStore.defaultFor(sessionName) : sessionStore.get(state.sessionId);
    return harnesses[session.harness];
  }

  function drawHarnesses() {
    const chosenOverride = $('#harness-choice').value;
    Object.keys(contexts).forEach((name) => {
      const bound = getSessionHarness(name);
      const badge = document.querySelector(`[data-session-badge="${name}"]`);
      if (badge) {
        badge.textContent = bound.short;
        badge.dataset.harness = bound.id;
        badge.title = `Bound to ${bound.label}`;
      }
      const stepEm = document.querySelector(`[data-step-harness="${name}"]`);
      if (stepEm) {
        const effective = chosenOverride === 'default' ? bound : harnesses[chosenOverride];
        stepEm.textContent = effective.label.toUpperCase();
      }
    });

    const activeHarness = getSessionHarness();
    const project = contexts[state.session] || 'Personal';
    $('#last-session').textContent = `${state.session} · ${project} · ${activeHarness.label}`;
    $('#workspace-context').textContent = `${project} · Bound to ${activeHarness.label} · Sample session`;
    $('#terminal-title').textContent = activeHarness.terminalTitle;
    $('#terminal-cmd').textContent = activeHarness.command;
    $('#workspace-harness').value = activeHarness.id;
    const faultBtn = $('#toggle-cli-fault');
    const unavailable = state.cliUnavailable[activeHarness.id];
    $('#terminal-ready').textContent = unavailable
      ? `${activeHarness.label} is unavailable for ${state.session}.`
      : `${activeHarness.label} session ready for ${state.session}.`;
    faultBtn.setAttribute('aria-pressed', String(unavailable));
    faultBtn.textContent = unavailable ? 'Restore CLI connection' : 'Simulate CLI unavailable';
    $('#terminal-alert').hidden = !unavailable;
    $('#terminal-alert-title').textContent = activeHarness.faultTitle;
    $('#terminal-command').disabled = unavailable;
    $('#terminal-submit').disabled = unavailable;
    $('#terminal-command').placeholder = unavailable
      ? `${activeHarness.label} is offline in this simulation…`
      : `Type a sample ${activeHarness.label} command…`;
  }

  function drawFocus() {
    const active = state.focus === 'running' || state.focus === 'paused';
    $('#timer').textContent = format(state.seconds);
    const focusLabel = active
      ? `${state.focus === 'running' ? 'Focusing' : 'Paused'} · ${state.focusTarget}`
      : state.focus === 'stopped'
        ? 'Session stopped'
        : 'Focus ready';
    if ($('#focus-label').textContent !== focusLabel) $('#focus-label').textContent = focusLabel;

    const task = state.focusTarget || state.session;
    const done = state.completed.has(task);
    const currentTask = `${state.session} ${state.completed.has(state.session) ? 'completed' : 'open'}`;
    const focusDetail = active
      ? `${state.focus === 'paused' ? 'Paused' : 'Focusing'} on ${task} · ${format(state.seconds)}`
      : state.focus === 'stopped'
        ? `Stopped at ${format(state.seconds)} · ${task} ${done ? 'completed' : 'remains open'}`
        : currentTask;
    $('#focus-detail').textContent =
      state.focusTarget && state.focusTarget !== state.session
        ? `${focusDetail} · Current task: ${currentTask}`
        : focusDetail;

    $('[data-workspace-start]').hidden = active;
    $('[data-pause]').hidden = !active;
    $('[data-pause]').textContent = state.focus === 'paused' ? 'Resume' : 'Pause';
    $('[data-stop]').hidden = !active;
    $('[data-top-pause]').hidden = !active;
    $('[data-top-pause]').textContent = state.focus === 'paused' ? 'Resume' : 'Pause';
    $('[data-top-stop]').hidden = !active;
    $('[data-start-focus] span').textContent = active ? 'Focus in progress' : 'Start focus';
    $('[data-start-focus]').disabled = active;
    $('[data-complete]').disabled = state.completed.has(state.session);
    $('[data-complete]').textContent = state.completed.has(state.session) ? 'Task completed' : 'Complete task';
  }

  function displayTerminalLine(text, muted) {
    const p = document.createElement('p');
    if (muted) p.className = 'terminal-muted';
    p.dataset.transcriptLine = '';
    p.textContent = text;
    $('#terminal-output').append(p);
  }

  function appendTerminalLine(text, muted = true) {
    sessionStore.get(state.sessionId).lines.push({ text, muted });
    displayTerminalLine(text, muted);
  }

  function showTranscript() {
    all('#terminal-output [data-transcript-line]').forEach(line => line.remove());
    const session = sessionStore.get(state.sessionId);
    session.lines.forEach(line => displayTerminalLine(line.text, line.muted));
    $('#terminal-command').value = session.draft;
  }

  function sessionFor(name, harness) {
    const session = sessionStore.ensure(name, harness);
    if (!document.querySelector(`.session[data-session-id="${session.id}"]`)) {
      const original = document.querySelector(`.session[data-session="${name}"]`);
      const button = original.cloneNode(true);
      const badge = button.querySelector('.harness-badge');
      button.dataset.sessionId = session.id;
      button.classList.remove('active');
      button.setAttribute('aria-label', `${name}, ${harnesses[harness].label} session`);
      badge.removeAttribute('data-session-badge');
      badge.textContent = harnesses[harness].short;
      badge.dataset.harness = harness;
      badge.title = `Bound to ${harnesses[harness].label}`;
      button.addEventListener('click', () => openSession(name, false, session.id));
      original.parentNode.append(button);
    }
    return session;
  }

  function openSession(name, fromStep = false, sessionId = null, moveFocus = true) {
    const defaultSession = sessionStore.defaultFor(name);
    if (!defaultSession) return;
    const override = $('#harness-choice').value;
    const session = sessionId ? sessionStore.get(sessionId) :
      fromStep && (override === 'agy' || override === 'opencode') ? sessionFor(name, override) : defaultSession;
    if (!session || session.task !== name) return;
    state.session = name;
    state.sessionId = session.id;
    $('#home-view').hidden = true;
    $('#workspace-view').hidden = false;
    $('#workspace-title').textContent = name;
    $('#breadcrumb').textContent = `Workspace / ${name}`;
    all('.session').forEach((el) => el.classList.toggle('active', el.dataset.sessionId === session.id));
    const activeSession = document.querySelector(`.session[data-session-id="${session.id}"]`);
    if (activeSession) activeSession.closest('details').open = true;
    all('.nav').forEach((el) => {
      const current = el.dataset.session === 'Functions practice';
      el.classList.toggle('active', current);
      if (current) el.setAttribute('aria-current', 'page');
      else el.removeAttribute('aria-current');
    });
    drawHarnesses();
    drawFocus();
    showTranscript();
    window.scrollTo(0, 0);
    if (moveFocus) $('#workspace-title').focus();
  }

  function home(moveFocus = true) {
    $('#workspace-view').hidden = true;
    $('#home-view').hidden = false;
    $('#breadcrumb').innerHTML = 'Home <span>/ Your space to begin</span>';
    all('.nav').forEach((el) => {
      const current = el.hasAttribute('data-home');
      el.classList.toggle('active', current);
      if (current) el.setAttribute('aria-current', 'page');
      else el.removeAttribute('aria-current');
    });
    drawHarnesses();
    window.scrollTo(0, 0);
    if (moveFocus) $('#home-title').focus();
  }

  function startFocus(target) {
    if (state.focus === 'running' || state.focus === 'paused') return;
    state.focus = 'running';
    state.focusTarget = target;
    state.seconds = 0;
    drawFocus();
  }

  function stopFocus() {
    if (state.focus === 'running' || state.focus === 'paused') {
      state.focus = 'stopped';
      drawFocus();
    }
  }

  all('[data-session]').forEach((button) => {
    if (button.classList.contains('session')) {
      const session = sessionStore.defaultFor(button.dataset.session);
      button.dataset.sessionId = session.id;
      button.setAttribute('aria-label', `${session.task}, ${harnesses[session.harness].label} session`);
    }
    button.addEventListener('click', () =>
      openSession(button.dataset.session, button.dataset.fromStep === 'true', button.dataset.sessionId)
    );
  });
  all('[data-home]').forEach((button) => button.addEventListener('click', () => home()));
  $('#continue').addEventListener('click', () => openSession(state.session, false, state.sessionId));
  $('#harness-choice').addEventListener('change', drawHarnesses);
  $('#workspace-harness').addEventListener('change', (event) => {
    const nextHarness = event.target.value;
    if (!harnesses[nextHarness]) return;
    const session = sessionFor(state.session, nextHarness);
    openSession(session.task, false, session.id, false);
  });
  $('#toggle-cli-fault').addEventListener('click', () => {
    const harness = getSessionHarness().id;
    state.cliUnavailable[harness] = !state.cliUnavailable[harness];
    drawHarnesses();
  });

  $('[data-start-focus]').addEventListener('click', () => startFocus($('#focus-target').value));
  $('[data-workspace-start]').addEventListener('click', () => startFocus(state.session));
  $('[data-pause]').addEventListener('click', () => {
    state.focus = state.focus === 'running' ? 'paused' : 'running';
    drawFocus();
  });
  $('[data-stop]').addEventListener('click', stopFocus);
  $('[data-top-pause]').addEventListener('click', () => {
    state.focus = state.focus === 'running' ? 'paused' : 'running';
    drawFocus();
  });
  $('[data-top-stop]').addEventListener('click', stopFocus);
  $('[data-complete]').addEventListener('click', () => {
    state.completed.add(state.session);
    if (state.focusTarget === state.session) stopFocus();
    drawFocus();
  });

  setInterval(() => {
    if (state.focus === 'running') {
      state.seconds++;
      drawFocus();
    }
  }, 1000);

  $('#time-filter').addEventListener('change', (event) => {
    const max = Number(event.target.value);
    all('.step').forEach((step) => {
      step.hidden = max > 0 && Number(step.dataset.minutes) > max;
    });
  });

  $('#capture-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const input = $('#capture-input');
    const text = input.value.trim();
    if (!text) {
      $('#capture-feedback').textContent = 'Write a thought first, then capture it.';
      input.focus();
      return;
    }
    state.captures.push(text);
    const item = document.createElement('li');
    item.textContent = text;
    $('#capture-list').append(item);
    $('#capture-count').textContent = `${state.captures.length} ${state.captures.length === 1 ? 'note' : 'notes'}`;
    $('#capture-feedback').textContent = 'Captured in this preview. No file was saved.';
    input.value = '';
  });

  $('#capture-jump').addEventListener('click', () => $('#capture-input').focus());

  $('#terminal-command').addEventListener('input', (event) => {
    sessionStore.get(state.sessionId).draft = event.target.value;
  });

  $('#terminal-form').addEventListener('submit', (event) => {
    event.preventDefault();
    if (state.cliUnavailable[getSessionHarness().id]) return;
    const input = $('#terminal-command');
    const cmd = input.value.trim();
    if (!cmd) return;
    const activeHarness = getSessionHarness();
    appendTerminalLine(`› ${cmd}`, false);
    if (cmd === '/focus') {
      const alreadyActive = state.focus === 'running' || state.focus === 'paused';
      startFocus(state.session);
      appendTerminalLine(
        alreadyActive
          ? `A sample focus session is already ${state.focus} for ${state.focusTarget}.`
          : `[${activeHarness.label}] Sample focus started for ${state.session}.`
      );
    } else if (cmd === '/stop') {
      const active = state.focus === 'running' || state.focus === 'paused';
      stopFocus();
      appendTerminalLine(
        active
          ? `[${activeHarness.label}] Sample focus stopped for ${state.focusTarget}; task ${state.completed.has(state.focusTarget) ? 'is completed' : 'remains open'}.`
          : 'There is no active sample focus session to stop.'
      );
    } else {
      appendTerminalLine(
        `[${activeHarness.label}] Preview only — no real CLI command was executed.`
      );
    }
    input.value = '';
    sessionStore.get(state.sessionId).draft = '';
  });

  all('[data-review]').forEach((button) =>
    button.addEventListener('click', () => {
      const kind = button.dataset.review;
      const activeHarness = getSessionHarness();
      $('#review-title').textContent =
        kind === 'memory' ? 'Review project memory' : 'Review study reviewer';
      $('#review-session').textContent = state.session;
      $('#review-harness').textContent = `${activeHarness.label} (simulated)`;
      $('#review-focus').textContent = state.focusTarget
        ? `${format(state.seconds)} · ${state.focus} · ${state.focusTarget}`
        : 'Not started';
      $('#review-count').textContent = `${state.captures.length} in this preview`;
      $('#review-editor').value =
        kind === 'memory'
          ? `# Suggested memory — ${state.session} (${activeHarness.label})\n\nAdd only the details you want to keep.\n\n- Next step: `
          : `# Reviewer — ${state.session}\n\nDraft your study notes here.\n\n## Practice\n- What would you like to recall?`;
      $('#review-dialog').showModal();
    })
  );

  $('#close-dialog').addEventListener('click', () => $('#review-dialog').close());
  $('#discard').addEventListener('click', () => $('#review-dialog').close());
  $('#approve').addEventListener('click', () => {
    $('#review-dialog').close();
    $('#capture-feedback').textContent = 'Preview approved. No file was changed.';
  });

  $('.nav[data-home]').setAttribute('aria-current', 'page');
  const params = new URLSearchParams(window.location.search);
  if (params.get('session')) {
    if (sessionStore.defaultFor(params.get('session'))) openSession(params.get('session'), false, null, false);
    else { drawHarnesses(); drawFocus(); }
  } else {
    drawHarnesses();
    drawFocus();
  }
  if (params.get('fault') === '1') {
    state.cliUnavailable[getSessionHarness().id] = true;
    drawHarnesses();
  }
  if (params.get('review') === 'memory' || params.get('review') === 'reviewer') {
    const trigger = document.querySelector(`[data-review="${params.get('review')}"]`);
    if (trigger) trigger.click();
  }
})();
