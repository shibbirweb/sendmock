import { sampleRate, type StereoBuffer } from "./audio-buffer";

/** Writes a 16-bit stereo PCM WAV file. */
export async function writeStereoWav(
  filePath: string,
  stereoBuffer: StereoBuffer,
) {
  const frameCount = stereoBuffer.left.length;
  const dataBytes = frameCount * 4;
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
  wavBytes.setUint16(22, 2, true);
  wavBytes.setUint32(24, sampleRate, true);
  wavBytes.setUint32(28, sampleRate * 4, true);
  wavBytes.setUint16(32, 4, true);
  wavBytes.setUint16(34, 16, true);
  writeText(36, "data");
  wavBytes.setUint32(40, dataBytes, true);
  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
    const leftValue = Math.max(
      -1,
      Math.min(1, stereoBuffer.left[frameIndex] ?? 0),
    );
    const rightValue = Math.max(
      -1,
      Math.min(1, stereoBuffer.right[frameIndex] ?? 0),
    );
    wavBytes.setInt16(44 + frameIndex * 4, leftValue * 32767, true);
    wavBytes.setInt16(46 + frameIndex * 4, rightValue * 32767, true);
  }
  await Bun.write(filePath, wavBytes.buffer);
}
