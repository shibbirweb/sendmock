import {
  createStereoBuffer,
  sampleRate,
  secondsToSamples,
  type StereoBuffer,
} from "./audio-buffer";

/** A small Schroeder reverb: damped combs in parallel, then allpasses. */
export function renderReverb(sendBuffer: StereoBuffer): StereoBuffer {
  const combDelaysSamples = [1557, 1617, 1491, 1422, 1277, 1356];
  const allpassDelaysSamples = [556, 441, 341];
  return {
    left: reverbChannel(
      sendBuffer.left,
      combDelaysSamples,
      allpassDelaysSamples,
      0,
    ),
    right: reverbChannel(
      sendBuffer.right,
      combDelaysSamples,
      allpassDelaysSamples,
      23,
    ),
  };
}

function reverbChannel(
  inputSamples: Float32Array,
  combDelaysSamples: number[],
  allpassDelaysSamples: number[],
  stereoSpreadSamples: number,
): Float32Array {
  const wetSamples = new Float32Array(inputSamples.length);
  for (const combDelay of combDelaysSamples) {
    const delayLength = combDelay + stereoSpreadSamples;
    const delayLine = new Float32Array(delayLength);
    let damped = 0;
    for (
      let sampleIndex = 0;
      sampleIndex < inputSamples.length;
      sampleIndex += 1
    ) {
      const delayIndex = sampleIndex % delayLength;
      const delayed = delayLine[delayIndex] ?? 0;
      damped = delayed * 0.7 + damped * 0.3;
      delayLine[delayIndex] = (inputSamples[sampleIndex] ?? 0) + damped * 0.84;
      wetSamples[sampleIndex] = (wetSamples[sampleIndex] ?? 0) + delayed;
    }
  }
  for (const allpassDelay of allpassDelaysSamples) {
    const delayLength = allpassDelay + stereoSpreadSamples;
    const delayLine = new Float32Array(delayLength);
    for (
      let sampleIndex = 0;
      sampleIndex < wetSamples.length;
      sampleIndex += 1
    ) {
      const delayIndex = sampleIndex % delayLength;
      const delayed = delayLine[delayIndex] ?? 0;
      const inputValue = wetSamples[sampleIndex] ?? 0;
      delayLine[delayIndex] = inputValue + delayed * 0.5;
      wetSamples[sampleIndex] = delayed - inputValue * 0.5;
    }
  }
  return wetSamples.map((value) => value * 0.12);
}

/** A ping-pong delay: echoes alternate left and right and soften. */
export function renderPingPongDelay(
  sendBuffer: StereoBuffer,
  delaySeconds: number,
  feedback: number,
): StereoBuffer {
  const echoBuffer = createStereoBuffer(sendBuffer.left.length);
  const delaySamples = secondsToSamples(delaySeconds);
  let leftSoftened = 0;
  let rightSoftened = 0;
  for (
    let sampleIndex = delaySamples;
    sampleIndex < sendBuffer.left.length;
    sampleIndex += 1
  ) {
    const sourceIndex = sampleIndex - delaySamples;
    const fromRight =
      (sendBuffer.right[sourceIndex] ?? 0) +
      (echoBuffer.right[sourceIndex] ?? 0) * feedback;
    const fromLeft =
      (sendBuffer.left[sourceIndex] ?? 0) +
      (echoBuffer.left[sourceIndex] ?? 0) * feedback;
    leftSoftened = leftSoftened * 0.55 + fromRight * 0.45;
    rightSoftened = rightSoftened * 0.55 + fromLeft * 0.45;
    echoBuffer.left[sampleIndex] = leftSoftened;
    echoBuffer.right[sampleIndex] = rightSoftened;
  }
  return echoBuffer;
}

/** Ducks the music a little after each kick, so the beat breathes. */
export function applyKickDucking(
  musicBuffer: StereoBuffer,
  kickTimesSeconds: number[],
  depth: number,
) {
  for (const kickTimeSeconds of kickTimesSeconds) {
    const startSample = secondsToSamples(kickTimeSeconds);
    const duckLength = secondsToSamples(0.3);
    for (let offset = 0; offset < duckLength; offset += 1) {
      const sampleIndex = startSample + offset;
      if (sampleIndex >= musicBuffer.left.length) {
        break;
      }
      const duckGain = 1 - depth * Math.exp(-(offset / sampleRate) * 12);
      musicBuffer.left[sampleIndex] =
        (musicBuffer.left[sampleIndex] ?? 0) * duckGain;
      musicBuffer.right[sampleIndex] =
        (musicBuffer.right[sampleIndex] ?? 0) * duckGain;
    }
  }
}

/** Soft limiter, peak normalise to -1 dBFS, then fade in and out. */
export function finishMaster(
  masterBuffer: StereoBuffer,
  fadeOutSeconds: number,
) {
  let peak = 0;
  for (const channel of [masterBuffer.left, masterBuffer.right]) {
    for (let sampleIndex = 0; sampleIndex < channel.length; sampleIndex += 1) {
      const limited = Math.tanh((channel[sampleIndex] ?? 0) * 1.1);
      channel[sampleIndex] = limited;
      peak = Math.max(peak, Math.abs(limited));
    }
  }
  const targetPeak = 10 ** (-1 / 20);
  const normaliseGain = peak > 0 ? targetPeak / peak : 1;
  const totalSamples = masterBuffer.left.length;
  const fadeInSamples = secondsToSamples(0.01);
  const fadeOutSamples = secondsToSamples(fadeOutSeconds);
  for (const channel of [masterBuffer.left, masterBuffer.right]) {
    for (let sampleIndex = 0; sampleIndex < totalSamples; sampleIndex += 1) {
      const fadeIn = Math.min(1, sampleIndex / fadeInSamples);
      const fadeOut = Math.min(
        1,
        (totalSamples - sampleIndex) / fadeOutSamples,
      );
      channel[sampleIndex] =
        (channel[sampleIndex] ?? 0) * normaliseGain * fadeIn * fadeOut ** 2;
    }
  }
}
