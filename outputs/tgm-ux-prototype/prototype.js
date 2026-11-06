(() => {
  const SESSION_CONTEXTS = {
    "Functions practice": "TypeScript learning · Sample session",
    "Objects practice": "TypeScript learning · Sample session",
    "Review study notes": "Learning · Sample session",
    "Portfolio: next step": "Portfolio · Sample session"
  };

  const SYNTHETIC_DRAFTS = {
    memory: "Synthetic Memory Draft (Simulated): Consolidate captured session notes into temporary working context for the active task.",
    reviewer: "Synthetic Reviewer Draft (Simulated): Check captured items for clarity, scope alignment, and open verification questions."
  };

  function initPrototype() {
    const state = {
      activeSession: null,
      focusState: "idle",
      focusSession: null,
      captureCount: 0,
      activeReviewKind: null
    };

    const homeView = document.querySelector("#home-view");
    const workspaceView = document.querySelector("#workspace-view");
    const sessionTitleEl = document.querySelector("#session-title");
    const sessionContextEl = document.querySelector("#session-context");

    const captureInput = document.querySelector("#capture-input");
    const captureList = document.querySelector("#capture-list");
    const captureFeedback = document.querySelector("#capture-feedback");

    const focusStatus = document.querySelector("#focus-status");
    const startFocusBtn = document.querySelector('[data-action="start-focus"]');
    const pauseFocusBtn = document.querySelector('[data-action="pause-focus"]');
    const stopFocusBtn = document.querySelector('[data-action="stop-focus"]');

    const reviewDialog = document.querySelector("#review-dialog");
    const reviewContent = document.querySelector("#review-content");
    const reviewFeedback = document.querySelector("#review-feedback");

    function setText(el, text) {
      if (el) {
        el.textContent = text;
      }
    }

    function openDialog(dialog) {
      if (!dialog) return;
      if (typeof dialog.showModal === "function") {
        if (!dialog.open) {
          dialog.showModal();
        }
      } else {
        dialog.setAttribute("open", "");
        dialog.hidden = false;
      }
    }

    function closeDialog(dialog) {
      if (!dialog) return;
      if (typeof dialog.close === "function" && dialog.open) {
        dialog.close();
      } else {
        dialog.removeAttribute("open");
      }
    }

    function updateFocusUI() {
      const sessionLabel = state.focusSession || "current task";
      const isActive = state.focusState === "running" || state.focusState === "paused";
      const focusExplainer = document.querySelector(".focus-explainer");
      if (focusExplainer) focusExplainer.textContent = isActive ? `Focusing on ${sessionLabel} · sample only` : "Focus session · sample only";
      if (startFocusBtn) startFocusBtn.hidden = isActive;
      if (pauseFocusBtn) pauseFocusBtn.hidden = !isActive;
      if (stopFocusBtn) stopFocusBtn.hidden = !isActive;

      if (state.focusState === "idle") {
        setText(focusStatus, "Focus not started");
        if (startFocusBtn) startFocusBtn.disabled = false;
        if (pauseFocusBtn) {
          pauseFocusBtn.disabled = true;
          pauseFocusBtn.textContent = "Pause Focus";
        }
        if (stopFocusBtn) stopFocusBtn.disabled = true;
      } else if (state.focusState === "running") {
        setText(
          focusStatus,
          "Focus active · sample"
        );
        if (startFocusBtn) startFocusBtn.disabled = true;
        if (pauseFocusBtn) {
          pauseFocusBtn.disabled = false;
          pauseFocusBtn.textContent = "Pause Focus";
        }
        if (stopFocusBtn) stopFocusBtn.disabled = false;
      } else if (state.focusState === "paused") {
        setText(
          focusStatus,
          "Focus paused · sample"
        );
        if (startFocusBtn) startFocusBtn.disabled = true;
        if (pauseFocusBtn) {
          pauseFocusBtn.disabled = false;
          pauseFocusBtn.textContent = "Resume Focus";
        }
        if (stopFocusBtn) stopFocusBtn.disabled = false;
      } else if (state.focusState === "stopped") {
        setText(
          focusStatus,
          "Session stopped · task open"
        );
        if (startFocusBtn) startFocusBtn.disabled = false;
        if (pauseFocusBtn) {
          pauseFocusBtn.disabled = true;
          pauseFocusBtn.textContent = "Pause Focus";
        }
        if (stopFocusBtn) stopFocusBtn.disabled = true;
      }
    }

    function openSession(rawTitle, triggerEl) {
      const title = (rawTitle || "").trim() || "Untitled Session";
      state.activeSession = title;

      const customContext =
        triggerEl && typeof triggerEl.getAttribute === "function"
          ? triggerEl.getAttribute("data-session-context")
          : null;
      const contextText =
        customContext ||
        SESSION_CONTEXTS[title] ||
        `Disposable in-memory workspace for "${title}". All state resets on page refresh.`;

      setText(sessionTitleEl, title);
      setText(sessionContextEl, contextText);
      const continueButton = document.querySelector("#continue-session");
      if (continueButton) continueButton.setAttribute("data-open-session", title);
      setText(document.querySelector("#continue-context"), `${title} · ${contextText.replace(" · Sample session", "")}`);
      document.querySelector('nav .nav-item[data-action="home"]')?.classList.remove("active");
      document.querySelector("nav .nav-item[data-open-session]")?.classList.add("active");

      if (homeView) homeView.hidden = true;
      if (workspaceView) workspaceView.hidden = false;

      updateFocusUI();
    }

    function returnHome() {
      closeDialog(reviewDialog);
      document.querySelector("nav .nav-item[data-open-session]")?.classList.remove("active");
      document.querySelector('nav .nav-item[data-action="home"]')?.classList.add("active");
      if (workspaceView) workspaceView.hidden = true;
      if (homeView) homeView.hidden = false;
    }

    function handleCapture() {
      const rawValue = captureInput && typeof captureInput.value === "string" ? captureInput.value : "";
      const text = rawValue.trim();

      if (!text) {
        setText(
          captureFeedback,
          "Enter a note before capturing (in-memory only; nothing is saved)."
        );
        return;
      }

      if (captureList) {
        const item = document.createElement("li");
        item.textContent = text;
        captureList.appendChild(item);
      }

      state.captureCount += 1;
      if (captureInput) {
        captureInput.value = "";
      }

      setText(
        captureFeedback,
        `Captured item #${state.captureCount} in memory only (no storage; resets on refresh).`
      );
    }

    function openReview(kind) {
      state.activeReviewKind = kind;
      const sessionLabel = state.activeSession || "Active Session";
      const baseDraft = SYNTHETIC_DRAFTS[kind] || SYNTHETIC_DRAFTS.reviewer;
      const draftText = `[${sessionLabel}] ${baseDraft} (${state.captureCount} in-memory capture(s) in current view; no writes or network calls).`;

      setText(reviewContent, draftText);
      openDialog(reviewDialog);
    }

    function finishReview(decision) {
      const kindLabel = state.activeReviewKind === "memory" ? "Memory" : "Reviewer";
      closeDialog(reviewDialog);

      if (decision === "approved") {
        setText(
          reviewFeedback,
          `${kindLabel} draft approved in simulation only — no writes, storage, or network changes were made (resets on refresh).`
        );
      } else {
        setText(
          reviewFeedback,
          `${kindLabel} draft rejected in simulation only — discarded with no writes or persistence (resets on refresh).`
        );
      }
      state.activeReviewKind = null;
    }

    const sessionButtons = document.querySelectorAll("[data-open-session]");
    sessionButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const sessionTitle = btn.getAttribute("data-open-session") || btn.textContent || "Session";
        openSession(sessionTitle, btn);
      });
    });

    const homeButtons = document.querySelectorAll('[data-action="home"]');
    homeButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        returnHome();
      });
    });

    const captureButtons = document.querySelectorAll('[data-action="capture"]');
    captureButtons.forEach((btn) => {
      btn.addEventListener("click", (event) => {
        event.preventDefault();
        handleCapture();
      });
    });

    if (captureInput) {
      captureInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          handleCapture();
        }
      });
    }

    if (startFocusBtn) {
      startFocusBtn.addEventListener("click", () => {
        if (state.focusState === "running" || state.focusState === "paused") return;
        state.focusSession = state.activeSession || "current task";
        state.focusState = "running";
        updateFocusUI();
      });
    }

    if (pauseFocusBtn) {
      pauseFocusBtn.addEventListener("click", () => {
        if (state.focusState === "running") {
          state.focusState = "paused";
        } else if (state.focusState === "paused") {
          state.focusState = "running";
        }
        updateFocusUI();
      });
    }

    if (stopFocusBtn) {
      stopFocusBtn.addEventListener("click", () => {
        if (state.focusState === "running" || state.focusState === "paused") {
          state.focusState = "stopped";
          updateFocusUI();
        }
      });
    }

    const memoryButtons = document.querySelectorAll('[data-action="memory"]');
    memoryButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        openReview("memory");
      });
    });

    const reviewerButtons = document.querySelectorAll('[data-action="reviewer"]');
    reviewerButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        openReview("reviewer");
      });
    });

    const approveButtons = document.querySelectorAll('[data-action="approve-review"]');
    approveButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        finishReview("approved");
      });
    });

    const rejectButtons = document.querySelectorAll('[data-action="reject-review"]');
    rejectButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        finishReview("rejected");
      });
    });

    const timeFilter = document.querySelector("#time-filter");
    if (timeFilter) {
      timeFilter.addEventListener("change", () => {
        const maxMinutes = Number(timeFilter.value);
        document.querySelectorAll(".suggestion[data-minutes]").forEach((item) => {
          item.hidden = maxMinutes > 0 && Number(item.getAttribute("data-minutes")) > maxMinutes;
        });
      });
    }

    updateFocusUI();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initPrototype, { once: true });
  } else {
    initPrototype();
  }
})();
