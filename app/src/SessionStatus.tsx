import { useSession, unavailableSessionProvider } from "./useSession";
import type { SessionProvider } from "./useSession";
import "./session-status.css";

export type { SessionProvider, SessionAvailability } from "./useSession";

export function SessionStatus({ provider = unavailableSessionProvider }: { provider?: SessionProvider }) {
  const { availability, resuming, feedback, resume } = useSession(provider);

  return (
    <section className="session-status" aria-labelledby="session-status-heading">
      <h2 id="session-status-heading">Continue where you left off</h2>
      {availability === null ? (
        <p className="session-status-note" role="status">Checking sessions…</p>
      ) : availability.state === "unavailable" ? (
        <p className="session-status-note">Session continuation is not connected yet.</p>
      ) : availability.state === "absent" ? (
        <p className="session-status-note">No previous session yet.</p>
      ) : (
        <div className="session-status-row">
          <div className="session-status-details">
            <strong>{availability.session.title}</strong>
            {availability.session.project && <span>{availability.session.project}</span>}
            {availability.session.harness && <span>{availability.session.harness}</span>}
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
