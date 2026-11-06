/** One line of a stack: a frame (`at ...`, `fn @ file`) or a header (the message, `Caused by:`). */
export interface StackLine {
  text: string;
  frame: boolean;
  /** A frame from the app itself, not the framework or a library. */
  app: boolean;
}

export type StackSegment = { kind: "line"; line: StackLine } | { kind: "fold"; count: number };

/** How many frames stay visible when a section has no app frame at all. */
const LEAD_FRAMES = 3;

function foldSection(frames: StackLine[], out: StackSegment[]) {
  if (frames.length === 0) return;
  let firstApp = frames.findIndex((frame) => frame.app);
  let keep: number;
  if (firstApp < 0) {
    keep = Math.min(LEAD_FRAMES, frames.length);
  } else {
    while (firstApp + 1 < frames.length && frames[firstApp + 1]?.app) firstApp += 1;
    keep = firstApp + 1;
  }
  for (let index = 0; index < keep; index += 1) {
    const frame = frames[index];
    if (frame) out.push({ kind: "line", line: frame });
  }
  if (frames.length > keep) out.push({ kind: "fold", count: frames.length - keep });
}

/**
 * Folds a stack after its first run of app frames: headers (`Caused by:`) always show, each
 * section keeps its frames up to the end of its first app run (or its first three frames when it
 * has none), and the rest becomes "N more frames".
 */
export function foldStack(lines: readonly StackLine[]): StackSegment[] {
  const out: StackSegment[] = [];
  let frames: StackLine[] = [];
  for (const line of lines) {
    if (line.frame) {
      frames.push(line);
      continue;
    }
    foldSection(frames, out);
    frames = [];
    out.push({ kind: "line", line });
  }
  foldSection(frames, out);
  return out;
}

const JAVA_FRAME = /^\s*(at\s|\.\.\.\s\d+\smore)/;

/**
 * A Java message as stack lines: `at a.b.C.d(...)` and `... N more` are frames; a frame is the
 * app's own when it starts with `appPackage`.
 */
export function javaStackLines(message: string, appPackage: string | null): StackLine[] {
  const prefix = appPackage ? `${appPackage}.` : null;
  return message.split("\n").map((text) => {
    const frame = JAVA_FRAME.test(text);
    const at = text.trimStart().slice(3);
    return { text, frame, app: frame && prefix !== null && at.startsWith(prefix) };
  });
}

/** Whether a message holds frames worth folding. */
export function hasStackFrames(lines: readonly StackLine[]): boolean {
  let frames = 0;
  for (const line of lines) if (line.frame) frames += 1;
  return frames > 0;
}
