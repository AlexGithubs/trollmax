/**
 * Server-side WAV segment extractor (pure Node.js Buffer — no FFmpeg).
 * Our pipeline always stores samples as 22050 Hz mono 16-bit PCM WAV
 * (produced by trimAndEncodeAudio), so arithmetic is deterministic.
 */

const PAD_SEC = 0.15 // 150 ms natural-sounding padding on each side

/**
 * Extracts [startSec, endSec] from a PCM WAV buffer.
 * Reads the sample rate from the WAV header so it works with any rate.
 * Returns a valid standalone WAV buffer ready for upload.
 */
export function extractWavSegment(
  wavBuffer: Buffer,
  startSec: number,
  endSec: number
): Buffer {
  if (wavBuffer.length < 44) throw new Error("Buffer too small to be a valid WAV file")

  // Read sample rate from WAV header (bytes 24-27, little-endian uint32)
  const sampleRate = wavBuffer.readUInt32LE(24)
  const numChannels = wavBuffer.readUInt16LE(22)
  const bitsPerSample = wavBuffer.readUInt16LE(34)
  const blockAlign = numChannels * (bitsPerSample / 8)
  const byteRate = sampleRate * blockAlign

  // Apply padding, clamped to valid range
  const dataStart = 44
  const dataEnd = wavBuffer.length
  const totalSec = (dataEnd - dataStart) / byteRate

  const paddedStart = Math.max(0, startSec - PAD_SEC)
  const paddedEnd = Math.min(totalSec, endSec + PAD_SEC)

  // Byte offsets, aligned to blockAlign boundary
  let startByte = dataStart + Math.floor(paddedStart * byteRate)
  let endByte = dataStart + Math.ceil(paddedEnd * byteRate)

  // Align to block boundary
  startByte = dataStart + Math.floor((startByte - dataStart) / blockAlign) * blockAlign
  endByte = dataStart + Math.ceil((endByte - dataStart) / blockAlign) * blockAlign
  endByte = Math.min(endByte, dataEnd)
  startByte = Math.max(startByte, dataStart)

  const pcm = wavBuffer.slice(startByte, endByte)
  return buildWav(pcm, sampleRate, numChannels, bitsPerSample)
}

function buildWav(
  pcm: Buffer,
  sampleRate: number,
  numChannels: number,
  bitsPerSample: number
): Buffer {
  const blockAlign = numChannels * (bitsPerSample / 8)
  const byteRate = sampleRate * blockAlign
  const header = Buffer.alloc(44)

  // RIFF chunk
  header.write("RIFF", 0)
  header.writeUInt32LE(36 + pcm.length, 4)
  header.write("WAVE", 8)

  // fmt subchunk
  header.write("fmt ", 12)
  header.writeUInt32LE(16, 16)             // subchunk size
  header.writeUInt16LE(1, 20)              // PCM
  header.writeUInt16LE(numChannels, 22)
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(byteRate, 28)
  header.writeUInt16LE(blockAlign, 32)
  header.writeUInt16LE(bitsPerSample, 34)

  // data subchunk
  header.write("data", 36)
  header.writeUInt32LE(pcm.length, 40)

  return Buffer.concat([header, pcm])
}
