import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

export type HarnessSession = {
  id: string;
  title: string;
  project?: string;
  harness?: 'AGY' | 'OpenCode';
};

export type SessionAvailability =
  | { state: 'available'; session: HarnessSession }
  | { state: 'absent' }
  | { state: 'unavailable' };

export type SessionProvider = {
  getLastSession(): Promise<SessionAvailability>;
  resume(id: string): Promise<{ ok: boolean }>;
};

export type UseSessionResult = {
  availability: SessionAvailability | null;
  resuming: boolean;
  feedback: 'success' | 'error' | null;
  resume: () => Promise<void>;
};

const UNAVAILABLE_AVAILABILITY: SessionAvailability = { state: 'unavailable' };

export const unavailableSessionProvider: SessionProvider = {
  async getLastSession(): Promise<SessionAvailability> {
    return UNAVAILABLE_AVAILABILITY;
  },
  async resume(_id: string): Promise<{ ok: boolean }> {
    return { ok: false };
  },
};

function normalizeAvailability(value: unknown): SessionAvailability {
  if (!value || typeof value !== 'object') {
    return UNAVAILABLE_AVAILABILITY;
  }

  const candidate = value as Partial<SessionAvailability>;
  if (candidate.state === 'absent') {
    return { state: 'absent' };
  }

  if (candidate.state === 'unavailable') {
    return UNAVAILABLE_AVAILABILITY;
  }

  if (
    candidate.state === 'available' &&
    candidate.session &&
    typeof candidate.session === 'object' &&
    typeof candidate.session.id === 'string' &&
    candidate.session.id.length > 0 &&
    typeof candidate.session.title === 'string'
  ) {
    return {
      state: 'available',
      session: candidate.session,
    };
  }

  return UNAVAILABLE_AVAILABILITY;
}

export function useSession(provider: SessionProvider): UseSessionResult {
  const [availability, setAvailability] = useState<SessionAvailability | null>(null);
  const [resuming, setResuming] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<'success' | 'error' | null>(null);

  const mountedRef = useRef<boolean>(false);
  const epochRef = useRef<number>(0);
  const inFlightEpochRef = useRef<number | null>(null);
  const availabilityRef = useRef<SessionAvailability | null>(null);
  const activeProviderRef = useRef<SessionProvider | null>(null);

  useLayoutEffect(() => {
    mountedRef.current = true;
    activeProviderRef.current = provider;
    epochRef.current += 1;
    inFlightEpochRef.current = null;
    availabilityRef.current = null;

    return () => {
      mountedRef.current = false;
      activeProviderRef.current = null;
      epochRef.current += 1;
      inFlightEpochRef.current = null;
      availabilityRef.current = null;
    };
  }, [provider]);

  useEffect(() => {
    mountedRef.current = true;
    activeProviderRef.current = provider;
    const currentEpoch = ++epochRef.current;
    inFlightEpochRef.current = null;
    availabilityRef.current = null;

    setAvailability(null);
    setResuming(false);
    setFeedback(null);

    Promise.resolve()
      .then(() => provider.getLastSession())
      .then((result) => {
        if (
          !mountedRef.current ||
          activeProviderRef.current !== provider ||
          epochRef.current !== currentEpoch
        ) {
          return;
        }
        const normalized = normalizeAvailability(result);
        availabilityRef.current = normalized;
        setAvailability(normalized);
      })
      .catch(() => {
        if (
          !mountedRef.current ||
          activeProviderRef.current !== provider ||
          epochRef.current !== currentEpoch
        ) {
          return;
        }
        availabilityRef.current = UNAVAILABLE_AVAILABILITY;
        setAvailability(UNAVAILABLE_AVAILABILITY);
      });

    return () => {
      mountedRef.current = false;
      activeProviderRef.current = null;
      epochRef.current += 1;
      inFlightEpochRef.current = null;
      availabilityRef.current = null;
    };
  }, [provider]);

  const resume = useCallback(async (): Promise<void> => {
    if (!mountedRef.current || activeProviderRef.current !== provider) {
      return;
    }

    const currentAvailability = availabilityRef.current;
    if (!currentAvailability || currentAvailability.state !== 'available') {
      return;
    }

    const currentEpoch = epochRef.current;
    if (inFlightEpochRef.current === currentEpoch) {
      return;
    }

    inFlightEpochRef.current = currentEpoch;
    setResuming(true);
    setFeedback(null);

    try {
      const result = await Promise.resolve().then(() =>
        provider.resume(currentAvailability.session.id)
      );

      if (
        !mountedRef.current ||
        activeProviderRef.current !== provider ||
        epochRef.current !== currentEpoch
      ) {
        return;
      }

      inFlightEpochRef.current = null;
      setResuming(false);
      setFeedback(Boolean(result && result.ok === true) ? 'success' : 'error');
    } catch {
      if (
        !mountedRef.current ||
        activeProviderRef.current !== provider ||
        epochRef.current !== currentEpoch
      ) {
        return;
      }

      inFlightEpochRef.current = null;
      setResuming(false);
      setFeedback('error');
    }
  }, [provider]);

  return {
    availability,
    resuming,
    feedback,
    resume,
  };
}
