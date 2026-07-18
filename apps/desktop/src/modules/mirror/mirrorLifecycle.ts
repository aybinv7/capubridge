export interface MirrorRunToken {
  runId: number;
  sessionId: number;
}

interface MirrorLeaseOperations {
  start: (serial: string) => Promise<unknown>;
  stop: (serial: string) => Promise<unknown>;
  onStopError: (serial: string, cause: unknown) => void;
}

export function createMirrorLifecycle(leaseOperations: MirrorLeaseOperations) {
  let runId = 0;
  let sessionId = 0;
  let startupTimeout: ReturnType<typeof setTimeout> | null = null;
  let leaseSerial: string | null = null;

  function clearStartupTimeout() {
    if (!startupTimeout) return;
    clearTimeout(startupTimeout);
    startupTimeout = null;
  }

  function scheduleStartupTimeout(operation: () => void, delay: number) {
    clearStartupTimeout();
    startupTimeout = setTimeout(operation, delay);
  }

  function beginRun(): MirrorRunToken {
    runId += 1;
    sessionId += 1;
    clearStartupTimeout();
    return { runId, sessionId };
  }

  function invalidate() {
    runId += 1;
    sessionId += 1;
    clearStartupTimeout();
  }

  function isCurrent(token: MirrorRunToken) {
    return token.runId === runId && token.sessionId === sessionId;
  }

  function isSessionCurrent(candidate: number) {
    return candidate === sessionId;
  }

  async function acquireLease(serial: string) {
    await leaseOperations.start(serial);
    leaseSerial = serial;
  }

  async function releaseLease(serial = leaseSerial) {
    if (!serial) return;
    try {
      await leaseOperations.stop(serial);
    } catch (cause) {
      leaseOperations.onStopError(serial, cause);
    }
    if (leaseSerial === serial) leaseSerial = null;
  }

  return {
    beginRun,
    invalidate,
    isCurrent,
    isSessionCurrent,
    scheduleStartupTimeout,
    clearStartupTimeout,
    acquireLease,
    releaseLease,
    get leaseSerial() {
      return leaseSerial;
    },
  };
}
