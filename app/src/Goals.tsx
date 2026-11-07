import { FormEvent, useEffect, useState } from "react";

type Detail = {
  goalId: number;
  stepId: number | null;
  title: string;
  step: string;
  savedTitle: string;
  savedStep: string;
};

export function Goals() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [title, setTitle] = useState("");
  const [firstStep, setFirstStep] = useState("");
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    try {
      setGoals(await window.tgm.listGoals());
      setLoadError(false);
      setError("");
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submittedTitle = title;
    const submittedStep = firstStep;
    setMessage("");
    if (!submittedTitle.trim() || (submittedStep && !submittedStep.trim())) {
      setError("Enter a goal title and, if provided, a next step.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      setGoals(await window.tgm.createGoal(submittedTitle, submittedStep));
      setLoadError(false);
      setTitle((current) => (current === submittedTitle ? "" : current));
      setFirstStep((current) => (current === submittedStep ? "" : current));
      setMessage("Goal saved.");
    } catch {
      setError("Could not save your goal. Your text is still here; please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail) return;
    const submitted = detail;
    setMessage("");
    if (!submitted.title.trim() || !submitted.step.trim()) {
      setError("Enter a goal title and a non-empty next step.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      const saved = await window.tgm.saveGoalDetails(
        submitted.goalId,
        submitted.title,
        submitted.stepId,
        submitted.step,
      );
      setGoals(saved);
      setLoadError(false);
      setDetail((current) => {
        if (
          !current ||
          current.goalId !== submitted.goalId ||
          current.stepId !== submitted.stepId
        ) {
          return current;
        }
        const savedGoal = saved.find((goal) => goal.id === submitted.goalId);
        const newStepId =
          submitted.stepId ?? (submitted.step ? savedGoal?.steps[0]?.id ?? null : null);
        return {
          ...current,
          stepId: newStepId,
          savedTitle: submitted.title,
          savedStep: submitted.step,
        };
      });
      setMessage("Changes saved.");
    } catch {
      setError("Could not save your changes. Your text is still here; please try again.");
    } finally {
      setSaving(false);
    }
  }

  function open(goal: Goal, step: GoalStep | null) {
    setDetail({
      goalId: goal.id,
      stepId: step?.id ?? null,
      title: goal.title,
      step: step?.text ?? "",
      savedTitle: goal.title,
      savedStep: step?.text ?? "",
    });
    setError("");
    setMessage("");
  }

  return (
    <section className="next-steps" aria-labelledby="steps-heading">
      <div className="section-heading">
        <div>
          <h2 id="steps-heading">Suggested next steps</h2>
          <p className="supporting">Small enough to start. Choose what feels right.</p>
        </div>
      </div>
      {loading ? (
        <p className="supporting">Loading goals…</p>
      ) : loadError ? (
        <div className="load-error" role="alert">
          <p>Could not load your goals. Your saved data may still be there.</p>
          <button className="secondary" type="button" onClick={() => void load()}>
            Retry loading goals
          </button>
        </div>
      ) : goals.some((goal) => goal.steps.length) ? (
        <ul className="suggestions">
          {goals.flatMap((goal) =>
            goal.steps.map((step) => (
              <li key={step.id}>
                <div>
                  <strong>{step.text}</strong>
                  <p>
                    From your goal: <span>{goal.title}</span>
                  </p>
                </div>
                <button
                  className="secondary"
                  type="button"
                  disabled={saving}
                  aria-label={`Open ${step.text}`}
                  onClick={() => open(goal, step)}
                >
                  Open
                </button>
              </li>
            )),
          )}
        </ul>
      ) : (
        <div className="empty-state">
          <strong>Your next step starts here.</strong>
          <p>Add a goal to get started, then give it a small next step.</p>
        </div>
      )}
      {!loading && !loadError && goals.some((goal) => goal.steps.length === 0) && (
        <div className="goals-without-steps">
          <h3>Goals without a next step</h3>
          <ul>
            {goals
              .filter((goal) => !goal.steps.length)
              .map((goal) => (
                <li key={goal.id}>
                  <span>{goal.title}</span>
                  <button
                    className="secondary"
                    type="button"
                    disabled={saving}
                    aria-label={`Add a next step to ${goal.title}`}
                    onClick={() => open(goal, null)}
                  >
                    Add a next step
                  </button>
                </li>
              ))}
          </ul>
        </div>
      )}
      {!loading && !loadError && detail && (
        <form className="goal-detail" onSubmit={save} aria-label="Goal and step details">
          <h3>Goal and step details</h3>
          <div className="goal-fields">
            <div className="field-group">
              <label htmlFor="detail-title">Goal title</label>
              <input
                id="detail-title"
                value={detail.title}
                maxLength={500}
                onChange={(event) => {
                  setDetail({ ...detail, title: event.target.value });
                  setError("");
                  setMessage("");
                }}
              />
            </div>
            <div className="field-group">
              <label htmlFor="detail-step">Next step</label>
              <input
                id="detail-step"
                value={detail.step}
                maxLength={500}
                onChange={(event) => {
                  setDetail({ ...detail, step: event.target.value });
                  setError("");
                  setMessage("");
                }}
              />
            </div>
          </div>
          <div className="goal-actions">
            <button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </button>
            <button
              className="secondary"
              type="button"
              disabled={saving}
              onClick={() => {
                setDetail(null);
                setError("");
                setMessage("");
              }}
            >
              Close details
            </button>
          </div>
        </form>
      )}
      <form className="goal-form" onSubmit={create} aria-label="Add a goal">
        <h3>Add a goal</h3>
        <div className="goal-fields">
          <div className="field-group">
            <label htmlFor="goal-title">Goal title</label>
            <input
              id="goal-title"
              value={title}
              maxLength={500}
              onChange={(event) => {
                setTitle(event.target.value);
                setError("");
                setMessage("");
              }}
            />
          </div>
          <div className="field-group">
            <label htmlFor="goal-step">First next step (optional)</label>
            <input
              id="goal-step"
              value={firstStep}
              maxLength={500}
              onChange={(event) => {
                setFirstStep(event.target.value);
                setError("");
                setMessage("");
              }}
            />
          </div>
        </div>
        <button type="submit" disabled={saving || loading || loadError}>
          {saving ? "Saving…" : "Save goal"}
        </button>
      </form>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <p className="feedback" role="status">
        {message}
      </p>
    </section>
  );
}
