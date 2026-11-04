export type DeviceOrientation = "portrait" | "landscape";

/** Android's `Surface.ROTATION_*`: quarter turns clockwise from the natural orientation. */
export type QuarterTurn = 0 | 1 | 2 | 3;

export interface RotationSettings {
  /** `accelerometer_rotation`: the device follows its sensor. */
  autoRotate: boolean;
  /** `user_rotation`: the orientation held while auto-rotate is off. */
  userRotation: QuarterTurn;
}

export type RotationShell = (serial: string, command: string) => Promise<string>;

export class RotationError extends Error {
  constructor(
    message: string,
    readonly detail?: string,
  ) {
    super(message);
    this.name = "RotationError";
  }
}

export const READ_ROTATION_COMMAND =
  "settings get system accelerometer_rotation 2>&1; settings get system user_rotation 2>&1";

export const RESTORE_AUTO_ROTATE_COMMAND = "settings put system accelerometer_rotation 1 2>&1";

const FAILURE_PATTERN = /exception|error|denied|not found|unknown|usage:|inaccessible/i;

export function lockRotationCommand(turn: QuarterTurn): string {
  return `settings put system accelerometer_rotation 0 2>&1 && settings put system user_rotation ${turn} 2>&1`;
}

/** Shell output is only ever empty or numbers here; anything else is the device saying no. */
export function shellFailure(output: string): string | null {
  const text = output.trim();
  return text && FAILURE_PATTERN.test(text) ? text : null;
}

function parseFlag(value: string | undefined, fallback: number): number {
  const text = value?.trim();
  if (!text || text === "null") return fallback;
  const number = Number(text);
  return Number.isInteger(number) ? number : Number.NaN;
}

/**
 * Reads the two settings. A device that never had auto-rotate toggled reports `null`; Android
 * then treats auto-rotate as on and the held rotation as natural, so those are the defaults.
 */
export function parseRotationSettings(output: string): RotationSettings {
  const failure = shellFailure(output);
  if (failure) throw new RotationError("The device would not report its rotation", failure);
  const [auto, user] = output.split(/\r?\n/).filter((line) => line.trim() !== "");
  const autoRotate = parseFlag(auto, 1);
  const userRotation = parseFlag(user, 0);
  if (![0, 1].includes(autoRotate) || ![0, 1, 2, 3].includes(userRotation)) {
    throw new RotationError(
      "The device reported a rotation Capubridge does not understand",
      output,
    );
  }
  return { autoRotate: autoRotate === 1, userRotation: userRotation as QuarterTurn };
}

export function orientationOfSize(width: number, height: number): DeviceOrientation | null {
  if (!(width > 0) || !(height > 0)) return null;
  return width > height ? "landscape" : "portrait";
}

export function oppositeOrientation(orientation: DeviceOrientation): DeviceOrientation {
  return orientation === "portrait" ? "landscape" : "portrait";
}

/**
 * The quarter turn that shows `target`. A phone's natural orientation is portrait, so even turns
 * are portrait and odd turns landscape; a held turn that already matches is kept, so a device held
 * upside-down landscape is not flipped to the other side.
 */
export function quarterTurnFor(target: DeviceOrientation, current: RotationSettings): QuarterTurn {
  const held = current.userRotation;
  const heldIsLandscape = held % 2 === 1;
  if (!current.autoRotate && heldIsLandscape === (target === "landscape")) return held;
  return target === "landscape" ? 1 : 0;
}

/**
 * Rotation through the device's own settings, so it survives the stream restarting and works on
 * every Android version scrcpy supports: turning auto-rotate off and holding a quarter turn, or
 * turning auto-rotate back on. Every write is read back, so a device that ignores it is reported
 * instead of looking rotated.
 */
export function createRotationController(shell: RotationShell) {
  async function read(serial: string): Promise<RotationSettings> {
    return parseRotationSettings(await shell(serial, READ_ROTATION_COMMAND));
  }

  async function write(serial: string, command: string, failureMessage: string) {
    const failure = shellFailure(await shell(serial, command));
    if (failure) throw new RotationError(failureMessage, failure);
  }

  async function hold(
    serial: string,
    target: DeviceOrientation,
    current: RotationSettings,
  ): Promise<RotationSettings> {
    const turn = quarterTurnFor(target, current);
    await write(serial, lockRotationCommand(turn), `The device refused to turn ${target}`);
    const next = await read(serial);
    if (next.autoRotate || next.userRotation !== turn) {
      throw new RotationError(`The device did not keep the ${target} orientation`);
    }
    return next;
  }

  async function restoreAuto(serial: string): Promise<RotationSettings> {
    await write(serial, RESTORE_AUTO_ROTATE_COMMAND, "The device refused to turn auto-rotate on");
    const next = await read(serial);
    if (!next.autoRotate) throw new RotationError("The device kept auto-rotate off");
    return next;
  }

  return { read, hold, restoreAuto };
}

export type RotationController = ReturnType<typeof createRotationController>;
