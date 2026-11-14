import { sampleRate } from "./audio-buffer";

/** Writes a 16-bit mono PCM WAV file. */
export async function writeMonoWav(
  filePath: string,
  soundSamples: Float32Array,
) {
  const dataBytes = soundSamples.length * 2;
  const wavBytes = new DataView(new ArrayBuffer(44 + dataBytes));
  const writeText = (byteOffset: number, text: string) => {
    for (
      let characterIndex = 0;
      characterIndex < text.length;
      characterIndex += 1
    ) {
      wavBytes.setUint8(
        byteOffset + characterIndex,
        text.charCodeAt(characterIndex),
      );
    }
  };
  writeText(0, "RIFF");
  wavBytes.setUint32(4, 36 + dataBytes, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  wavBytes.setUint32(16, 16, true);
  wavBytes.setUint16(20, 1, true);
  wavBytes.setUint16(22, 1, true);
  wavBytes.setUint32(24, sampleRate, true);
  wavBytes.setUint32(28, sampleRate * 2, true);
  wavBytes.setUint16(32, 2, true);
  wavBytes.setUint16(34, 16, true);
  writeText(36, "data");
  wavBytes.setUint32(40, dataBytes, true);
  soundSamples.forEach((sampleValue, sampleIndex) => {
    const clampedValue = Math.max(-1, Math.min(1, sampleValue));
    wavBytes.setInt16(44 + sampleIndex * 2, clampedValue * 32767, true);
  });
  await Bun.write(filePath, wavBytes.buffer);
}
