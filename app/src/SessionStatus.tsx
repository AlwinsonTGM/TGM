import { useSession, unavailableSessionProvider } from "./useSession";
import type { SessionProvider } from "./useSession";
import "./session-status.css";

export type { SessionProvider, SessionAvailability, HarnessSession } from "./useSession";

export function HarnessIcon({ harness }: { harness: string }) {
  if (harness === "AGY") {
    return (
      <svg
        className="session-status-badge-icon"
        viewBox="0 0 24 24"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <linearGradient id="agy-brand-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#EA4335" />
            <stop offset="35%" stopColor="#FBBC05" />
            <stop offset="70%" stopColor="#34A853" />
            <stop offset="100%" stopColor="#4285F4" />
          </linearGradient>
        </defs>
        <path
          d="M21.751 22.607c1.34 1.005 3.35.335 1.508-1.508C17.73 15.74 18.904 1 12.037 1 5.17 1 6.342 15.74.815 21.1c-2.01 2.009.167 2.511 1.507 1.506 5.192-3.517 4.857-9.714 9.715-9.714 4.857 0 4.522 6.197 9.714 9.715z"
          fill="url(#agy-brand-grad)"
        />
      </svg>
    );
  }
  if (harness === "OpenCode") {
    return (
      <svg
        className="session-status-badge-icon"
        viewBox="0 0 24 24"
        aria-hidden="true"
        focusable="false"
      >
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M4 2a1 1 0 0 0-1 1v18a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1H4zm4 4h8v12H8V6z"
          fill="#FFFFFF"
        />
      </svg>
    );
  }
  return null;
}

export function SessionStatus({ provider = unavailableSessionProvider }: { provider?: SessionProvider }) {
  const { availability, resuming, feedback, resume } = useSession(provider);
  const isAvailable = availability?.state === "available";

  return (
    <section
      className={`session-status ${isAvailable ? "session-status-prominent" : "session-status-compact"}`}
      aria-labelledby="session-status-heading"
    >
      <div className="session-status-header">
        <h2 id="session-status-heading">Continue where you left off</h2>
        {isAvailable && availability.session.harness && (
          <span
            className={`session-status-badge session-status-badge-${availability.session.harness.toLowerCase()}`}
            title={`Harness: ${availability.session.harness === "AGY" ? "Antigravity" : availability.session.harness}`}
          >
            <HarnessIcon harness={availability.session.harness} />
            <span>{availability.session.harness === "AGY" ? "Antigravity" : availability.session.harness}</span>
          </span>
        )}
        {availability === null ? (
          <p className="session-status-note" role="status">Checking sessions…</p>
        ) : availability.state === "unavailable" ? (
          <p className="session-status-note">Session continuation is not connected yet.</p>
        ) : availability.state === "absent" ? (
          <p className="session-status-note">No previous session yet.</p>
        ) : null}
      </div>
      {isAvailable && (
        <div className="session-status-row">
          <div className="session-status-left">
            <strong className="session-status-title">{availability.session.title}</strong>
            {availability.session.project && (
              <span className="session-status-project">{availability.session.project}</span>
            )}
          </div>
          <button type="button" disabled={resuming} onClick={() => void resume()}>
            {resuming ? "Opening session…" : "Continue last session"}
          </button>
        </div>
      )}
      {feedback === "success" && <p className="session-status-feedback" role="status">Session resumed.</p>}
      {feedback === "error" && <p className="session-status-error" role="alert">Could not resume this session. Please try again.</p>}
    </section>
  );
}
