/**
 * Moments in a scene that make a sound (docs/plan/23, Sound effects). Each
 * scene lists its cues from the same constants that drive its animation, so
 * sound and picture cannot drift apart.
 */
export type UiCueKind =
  /** A button or control is pressed. */
  | "click"
  /** A window, tile, card or line appears. */
  | "appear"
  /** Data leaves along the line. */
  | "send"
  /** Data lands at the other end. */
  | "arrive"
  /** A good outcome: 200 OK, paid, done. */
  | "success"
  /** A failed outcome: declined, failed delivery. */
  | "error"
  /** Typing: one key press per character as it appears on screen. */
  | "typing"
  /** An event lights up or a check mark ticks. */
  | "fire"
  /** A page slides in. */
  | "page"
  /** A big moment: the logo, the closing line. */
  | "reveal"
  /** A sweep of air, as between scenes. */
  | "whoosh";

export type UiCue = {
  /** Frame inside the scene. */
  frame: number;
  cueKind: UiCueKind;
  lengthFrames?: number;
  /** Typing only: the on-screen typing speed and how many characters it types. */
  charactersPerFrame?: number;
  characterCount?: number;
};

/** A typing cue that types `text` at the same speed as it appears on screen. */
export function createTypingCue(
  startFrame: number,
  text: string,
  charactersPerFrame: number,
): UiCue {
  return {
    frame: startFrame,
    cueKind: "typing",
    lengthFrames: Math.ceil(text.length / charactersPerFrame),
    charactersPerFrame,
    characterCount: text.length,
  };
}

/** Fast typing is capped at 15 key presses a second so it never buzzes. */
const minimumFramesBetweenKeys = 2;

/**
 * The frames (inside the cue) on which a new character appears, using the
 * same rounding as `getTypedText`, so each key press lands with its letter.
 */
export function getKeystrokeFrames(typingCue: UiCue): number[] {
  const charactersPerFrame = typingCue.charactersPerFrame ?? 0;
  const characterCount = typingCue.characterCount ?? 0;
  const keystrokeFrames: number[] = [];
  let previousTypedCount = 0;
  for (
    let frameOffset = 0;
    frameOffset <= (typingCue.lengthFrames ?? 0);
    frameOffset += 1
  ) {
    const typedCount = Math.min(
      characterCount,
      Math.floor(frameOffset * charactersPerFrame),
    );
    const lastKeyFrame = keystrokeFrames[keystrokeFrames.length - 1];
    const isFarEnoughFromLastKey =
      lastKeyFrame === undefined ||
      frameOffset - lastKeyFrame >= minimumFramesBetweenKeys;
    if (typedCount > previousTypedCount && isFarEnoughFromLastKey) {
      keystrokeFrames.push(frameOffset);
    }
    previousTypedCount = typedCount;
  }
  return keystrokeFrames;
}
