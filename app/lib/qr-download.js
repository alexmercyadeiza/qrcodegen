import QRCode from "qrcode";

const MIN_PNG_SIZE = 4096;
const MARGIN = 4;
const OPTIONS = { errorCorrectionLevel: "H", margin: MARGIN };

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const result = new Uint8Array(data.length + 12);
  const view = new DataView(result.buffer);
  view.setUint32(0, data.length);
  result.set(new TextEncoder().encode(type), 4);
  result.set(data, 8);
  view.setUint32(result.length - 4, crc32(result.subarray(4, result.length - 4)));
  return result;
}

// Lossless, uncompressed DEFLATE. The file's size comes from actual image
// pixels, not padding or metadata added to inflate the download.
function deflateStored(bytes) {
  const blocks = Math.ceil(bytes.length / 65535);
  const output = new Uint8Array(2 + bytes.length + blocks * 5 + 4);
  output.set([0x78, 0x01]);
  let position = 2;
  let a = 1;
  let b = 0;
  for (let offset = 0; offset < bytes.length; offset += 65535) {
    const length = Math.min(65535, bytes.length - offset);
    output[position++] = offset + length === bytes.length ? 1 : 0;
    output[position++] = length & 255;
    output[position++] = length >>> 8;
    output[position++] = (~length) & 255;
    output[position++] = ((~length) >>> 8) & 255;
    output.set(bytes.subarray(offset, offset + length), position);
    position += length;
  }
  for (const byte of bytes) {
    a = (a + byte) % 65521;
    b = (b + a) % 65521;
  }
  new DataView(output.buffer).setUint32(position, ((b << 16) | a) >>> 0);
  return output;
}

export function createPngFromMatrix(modules) {
  const moduleCount = modules.size;
  const scale = Math.ceil(MIN_PNG_SIZE / (moduleCount + MARGIN * 2));
  const size = (moduleCount + MARGIN * 2) * scale;
  const rowBytes = Math.ceil(size / 8);
  const stride = rowBytes + 1;
  const pixels = new Uint8Array(stride * size);
  pixels.fill(255);

  for (let y = 0; y < size; y++) pixels[y * stride] = 0;
  for (let row = 0; row < moduleCount; row++) {
    const firstY = (row + MARGIN) * scale;
    const rowStart = firstY * stride + 1;
    for (let col = 0; col < moduleCount; col++) {
      if (!modules.get(row, col)) continue;
      const firstX = (col + MARGIN) * scale;
      for (let x = firstX; x < firstX + scale; x++) {
        pixels[rowStart + (x >>> 3)] &= ~(0x80 >>> (x & 7));
      }
    }
    const scanline = pixels.subarray(rowStart, rowStart + rowBytes);
    for (let offset = 1; offset < scale; offset++) {
      pixels.set(scanline, (firstY + offset) * stride + 1);
    }
  }

  const header = new Uint8Array(13);
  const headerView = new DataView(header.buffer);
  headerView.setUint32(0, size);
  headerView.setUint32(4, size);
  header[8] = 1; // One-bit grayscale: exact black and white, no antialiasing.
  const resolution = new Uint8Array(9);
  const resolutionView = new DataView(resolution.buffer);
  resolutionView.setUint32(0, 11811); // 300 DPI in pixels per metre.
  resolutionView.setUint32(4, 11811);
  resolution[8] = 1;

  return new Blob([
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("pHYs", resolution),
    chunk("IDAT", deflateStored(pixels)),
    chunk("IEND", new Uint8Array()),
  ], { type: "image/png" });
}

export async function createQRDownload(text, format) {
  if (format === "svg") {
    const svg = await QRCode.toString(text, { ...OPTIONS, type: "svg", width: MIN_PNG_SIZE });
    return new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  }
  if (format !== "png") throw new Error("Unsupported download format");
  const qr = QRCode.create(text, OPTIONS);
  return createPngFromMatrix(qr.modules);
}
