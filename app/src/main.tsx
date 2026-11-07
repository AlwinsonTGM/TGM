import { FormEvent, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Goals } from "./Goals";
import "./styles.css";

function Mark() {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true">
      <path d="M4 6c1 9 6 14 16 19C30 20 35 15 36 6M12 18l8 15 8-15" />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 11.5 12 4l9 7.5M6 10v9h12v-9M10 19v-5h4v5" />
    </svg>
  );
}

function App() {
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");

  async function loadCaptures() {
    setLoading(true);
    try {
      const saved = await window.tgm.listCaptures();
      setCaptures(saved);
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadCaptures();
  }, []);

  async function saveCapture(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback("");
    const submittedText = text;
    if (!submittedText.trim()) {
      setError("Enter a capture before saving.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      const saved = await window.tgm.saveCapture(submittedText);
      setCaptures((previous) => [saved, ...previous]);
      setText((current) => current === submittedText ? "" : current);
      setFeedback("Capture saved.");
    } catch {
      setError(
        "Could not save your capture. Your text is still here; please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="shell">
      <aside className="sidebar" aria-label="Main navigation">
        <div className="brand">
          <Mark />
          <div>
            <strong>TGM</strong>
            <span>Your command center</span>
          </div>
        </div>
        <nav>
          <a className="nav-active" href="#home" aria-current="page">
            <HomeIcon />
            Home
          </a>
        </nav>
        <div className="side-note">A little progress counts.</div>
      </aside>
      <main id="home">
        <header className="topbar">
          <strong>Home</strong>
          <a href="#quick-capture">Quick capture</a>
        </header>
        <div className="content">
          <div className="intro">
            <h1>Let’s make a little progress.</h1>
            <p>
              Pick a small step, or find your way back to where you left off.
            </p>
          </div>
          <div className="home-grid">
            <div className="main-column">
              <Goals />
              <section
                id="quick-capture"
                className="capture"
                aria-labelledby="capture-heading"
              >
                <div className="section-heading">
                  <div>
                    <h2 id="capture-heading">Quick capture</h2>
                    <p className="supporting">
                      Get it out of your head. Organize it later.
                    </p>
                  </div>
                </div>
                <form onSubmit={saveCapture}>
                  <label className="sr-only" htmlFor="capture-input">
                    Quick capture
                  </label>
                  <textarea
                    id="capture-input"
                    rows={2}
                    value={text}
                    maxLength={10000}
                    placeholder="A thought, question, or next step…"
                    aria-describedby={error ? "capture-error" : undefined}
                    onChange={(event) => {
                      setText(event.target.value);
                      setError("");
                      setFeedback("");
                    }}
                  />
                  <button type="submit" disabled={saving || loading}>
                    {saving ? "Saving…" : "Save capture"}
                  </button>
                </form>
                {error && (
                  <p id="capture-error" className="error" role="alert">
                    {error}
                  </p>
                )}
                <p className="feedback" role="status">
                  {feedback}
                </p>
                <div className="capture-history" aria-live="polite">
                  {loading ? (
                    <p className="supporting">Loading captures…</p>
                  ) : loadError ? (
                    <div className="load-error" role="alert">
                      <p>
                        Could not load your captures. Your saved data may still
                        be there.
                      </p>
                      <button
                        className="secondary"
                        onClick={() => void loadCaptures()}
                      >
                        Try again
                      </button>
                    </div>
                  ) : captures.length ? (
                    <>
                      <h3>Saved captures</h3>
                      <ul>
                        {captures.map((capture) => (
                          <li key={capture.id}>{capture.text}</li>
                        ))}
                      </ul>
                    </>
                  ) : (
                    <p className="supporting">
                      Your saved captures will appear here.
                    </p>
                  )}
                </div>
              </section>
            </div>
            <aside className="focus-panel" aria-labelledby="focus-heading">
              <h2 id="focus-heading">Independent focus</h2>
              <p>Work on your own.</p>
              <p className="supporting">
                FlowState is not connected yet. Your captures remain available
                locally.
              </p>
            </aside>
          </div>
          <p className="integration-note">
            Session continuation, AGY, OpenCode, and Obsidian are not connected
            yet.
          </p>
        </div>
      </main>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
