const PIX_KEY = process.env.PIX_RECEIVER_KEY ?? "lvsenna2@gmail.com";
const PIX_MERCHANT_NAME = process.env.PIX_MERCHANT_NAME ?? "BOLAO DO LOBO";
const PIX_MERCHANT_CITY = process.env.PIX_MERCHANT_CITY ?? "BRASIL";

type PixPayloadInput = {
  amount: number;
  description?: string | null;
  transactionId: string;
};

type QrMatrix = {
  modules: boolean[][];
  size: number;
};

const QR_VERSION = 10;
const QR_SIZE = 21 + (QR_VERSION - 1) * 4;
const QR_TOTAL_CODEWORDS = 346;
const QR_ECC_CODEWORDS_PER_BLOCK = 26;
const QR_NUM_ERROR_CORRECTION_BLOCKS = 5;
const QR_DATA_CODEWORDS = QR_TOTAL_CODEWORDS - QR_ECC_CODEWORDS_PER_BLOCK * QR_NUM_ERROR_CORRECTION_BLOCKS;

function normalizeAscii(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "")
    .trim();
}

function clip(value: string, maxLength: number) {
  return normalizeAscii(value).slice(0, maxLength);
}

function emv(id: string, value: string) {
  if (value.length > 99) {
    throw new Error(`Campo Pix ${id} excede 99 caracteres.`);
  }

  return `${id}${String(value.length).padStart(2, "0")}${value}`;
}

function crc16Ccitt(payload: string) {
  let crc = 0xffff;

  for (let index = 0; index < payload.length; index += 1) {
    crc ^= payload.charCodeAt(index) << 8;

    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export function createPixTransactionId() {
  return `LOBO${crypto.randomUUID().replace(/-/g, "").slice(0, 16).toUpperCase()}`;
}

export function getPixReceiverKey() {
  return PIX_KEY;
}

export function createPixPayload({ amount, description, transactionId }: PixPayloadInput) {
  const merchantAccount = [
    emv("00", "br.gov.bcb.pix"),
    emv("01", PIX_KEY),
    description ? emv("02", clip(description, 60)) : ""
  ].join("");
  const amountValue = amount > 0 ? amount.toFixed(2) : "";
  const additionalData = emv("05", clip(transactionId, 25));
  const payloadWithoutCrc = [
    emv("00", "01"),
    emv("26", merchantAccount),
    emv("52", "0000"),
    emv("53", "986"),
    amountValue ? emv("54", amountValue) : "",
    emv("58", "BR"),
    emv("59", clip(PIX_MERCHANT_NAME, 25)),
    emv("60", clip(PIX_MERCHANT_CITY, 15)),
    emv("62", additionalData),
    "6304"
  ].join("");

  return `${payloadWithoutCrc}${crc16Ccitt(payloadWithoutCrc)}`;
}

function appendBits(bits: number[], value: number, length: number) {
  for (let index = length - 1; index >= 0; index -= 1) {
    bits.push((value >>> index) & 1);
  }
}

function toCodewords(value: string) {
  const bytes = Array.from(new TextEncoder().encode(value));
  const bits: number[] = [];

  appendBits(bits, 0b0100, 4);
  appendBits(bits, bytes.length, 16);
  bytes.forEach((byte) => appendBits(bits, byte, 8));

  const capacityBits = QR_DATA_CODEWORDS * 8;
  appendBits(bits, 0, Math.min(4, capacityBits - bits.length));

  while (bits.length % 8 !== 0) {
    bits.push(0);
  }

  const codewords: number[] = [];

  for (let index = 0; index < bits.length; index += 8) {
    let codeword = 0;

    for (let offset = 0; offset < 8; offset += 1) {
      codeword = (codeword << 1) | bits[index + offset];
    }

    codewords.push(codeword);
  }

  for (let pad = 0xec; codewords.length < QR_DATA_CODEWORDS; pad ^= 0xec ^ 0x11) {
    codewords.push(pad);
  }

  if (codewords.length > QR_DATA_CODEWORDS) {
    throw new Error("Codigo Pix grande demais para o QR interno.");
  }

  return codewords;
}

function reedSolomonMultiply(left: number, right: number) {
  let result = 0;

  for (let index = 0; index < 8; index += 1) {
    result = (result << 1) ^ ((result >>> 7) * 0x11d);
    result ^= ((right >>> (7 - index)) & 1) * left;
  }

  return result & 0xff;
}

function reedSolomonDivisor(degree: number) {
  const result = Array<number>(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;

  for (let index = 0; index < degree; index += 1) {
    for (let item = 0; item < degree; item += 1) {
      result[item] = reedSolomonMultiply(result[item], root);

      if (item + 1 < degree) {
        result[item] ^= result[item + 1];
      }
    }

    root = reedSolomonMultiply(root, 0x02);
  }

  return result;
}

function reedSolomonRemainder(data: number[], divisor: number[]) {
  const result = Array<number>(divisor.length).fill(0);

  data.forEach((codeword) => {
    const factor = codeword ^ (result.shift() ?? 0);
    result.push(0);

    divisor.forEach((coefficient, index) => {
      result[index] ^= reedSolomonMultiply(coefficient, factor);
    });
  });

  return result;
}

function interleaveBlocks(dataCodewords: number[]) {
  const divisor = reedSolomonDivisor(QR_ECC_CODEWORDS_PER_BLOCK);
  const shortBlockCount = QR_NUM_ERROR_CORRECTION_BLOCKS - (QR_TOTAL_CODEWORDS % QR_NUM_ERROR_CORRECTION_BLOCKS);
  const shortBlockDataLength =
    Math.floor(QR_TOTAL_CODEWORDS / QR_NUM_ERROR_CORRECTION_BLOCKS) -
    QR_ECC_CODEWORDS_PER_BLOCK;
  const blocks: number[][] = [];
  let offset = 0;

  for (let blockIndex = 0; blockIndex < QR_NUM_ERROR_CORRECTION_BLOCKS; blockIndex += 1) {
    const dataLength = shortBlockDataLength + (blockIndex < shortBlockCount ? 0 : 1);
    const data = dataCodewords.slice(offset, offset + dataLength);
    offset += dataLength;
    blocks.push([...data, ...reedSolomonRemainder(data, divisor)]);
  }

  const result: number[] = [];
  const maxBlockLength = Math.max(...blocks.map((block) => block.length));

  for (let index = 0; index < maxBlockLength; index += 1) {
    blocks.forEach((block, blockIndex) => {
      if (index === shortBlockDataLength && blockIndex < shortBlockCount) {
        return;
      }

      const codeword = block[index];

      if (codeword !== undefined) {
        result.push(codeword);
      }
    });
  }

  return result;
}

function getBit(value: number, index: number) {
  return ((value >>> index) & 1) !== 0;
}

function createEmptyMatrix() {
  return {
    isFunction: Array.from({ length: QR_SIZE }, () => Array<boolean>(QR_SIZE).fill(false)),
    modules: Array.from({ length: QR_SIZE }, () => Array<boolean>(QR_SIZE).fill(false))
  };
}

function setFunctionModule(
  matrix: ReturnType<typeof createEmptyMatrix>,
  x: number,
  y: number,
  dark: boolean
) {
  matrix.modules[y][x] = dark;
  matrix.isFunction[y][x] = true;
}

function drawFinderPattern(matrix: ReturnType<typeof createEmptyMatrix>, centerX: number, centerY: number) {
  for (let y = -4; y <= 4; y += 1) {
    for (let x = -4; x <= 4; x += 1) {
      const targetX = centerX + x;
      const targetY = centerY + y;

      if (targetX < 0 || targetX >= QR_SIZE || targetY < 0 || targetY >= QR_SIZE) {
        continue;
      }

      const distance = Math.max(Math.abs(x), Math.abs(y));
      setFunctionModule(matrix, targetX, targetY, distance !== 2 && distance !== 4);
    }
  }
}

function drawAlignmentPattern(
  matrix: ReturnType<typeof createEmptyMatrix>,
  centerX: number,
  centerY: number
) {
  for (let y = -2; y <= 2; y += 1) {
    for (let x = -2; x <= 2; x += 1) {
      setFunctionModule(matrix, centerX + x, centerY + y, Math.max(Math.abs(x), Math.abs(y)) !== 1);
    }
  }
}

function drawFunctionPatterns(matrix: ReturnType<typeof createEmptyMatrix>) {
  drawFinderPattern(matrix, 3, 3);
  drawFinderPattern(matrix, QR_SIZE - 4, 3);
  drawFinderPattern(matrix, 3, QR_SIZE - 4);

  for (let index = 8; index < QR_SIZE - 8; index += 1) {
    setFunctionModule(matrix, 6, index, index % 2 === 0);
    setFunctionModule(matrix, index, 6, index % 2 === 0);
  }

  const positions = [6, 28, 50];
  positions.forEach((x) => {
    positions.forEach((y) => {
      const overlapsFinder =
        (x === 6 && y === 6) || (x === 6 && y === 50) || (x === 50 && y === 6);

      if (!overlapsFinder) {
        drawAlignmentPattern(matrix, x, y);
      }
    });
  });

  setFunctionModule(matrix, 8, QR_SIZE - 8, true);
}

function drawFormatBits(matrix: ReturnType<typeof createEmptyMatrix>, mask: number) {
  const data = mask;
  let remainder = data;

  for (let index = 0; index < 10; index += 1) {
    remainder = (remainder << 1) ^ (((remainder >>> 9) & 1) * 0x537);
  }

  const bits = ((data << 10) | remainder) ^ 0x5412;

  for (let index = 0; index <= 5; index += 1) {
    setFunctionModule(matrix, 8, index, getBit(bits, index));
  }

  setFunctionModule(matrix, 8, 7, getBit(bits, 6));
  setFunctionModule(matrix, 8, 8, getBit(bits, 7));
  setFunctionModule(matrix, 7, 8, getBit(bits, 8));

  for (let index = 9; index < 15; index += 1) {
    setFunctionModule(matrix, 14 - index, 8, getBit(bits, index));
  }

  for (let index = 0; index < 8; index += 1) {
    setFunctionModule(matrix, QR_SIZE - 1 - index, 8, getBit(bits, index));
  }

  for (let index = 8; index < 15; index += 1) {
    setFunctionModule(matrix, 8, QR_SIZE - 15 + index, getBit(bits, index));
  }

  setFunctionModule(matrix, 8, QR_SIZE - 8, true);
}

function drawVersionBits(matrix: ReturnType<typeof createEmptyMatrix>) {
  let remainder = QR_VERSION;

  for (let index = 0; index < 12; index += 1) {
    remainder = (remainder << 1) ^ (((remainder >>> 11) & 1) * 0x1f25);
  }

  const bits = (QR_VERSION << 12) | remainder;

  for (let index = 0; index < 18; index += 1) {
    const bit = getBit(bits, index);
    const a = QR_SIZE - 11 + (index % 3);
    const b = Math.floor(index / 3);
    setFunctionModule(matrix, a, b, bit);
    setFunctionModule(matrix, b, a, bit);
  }
}

function maskApplies(mask: number, x: number, y: number) {
  const product = x * y;

  switch (mask) {
    case 0:
      return (x + y) % 2 === 0;
    case 1:
      return y % 2 === 0;
    case 2:
      return x % 3 === 0;
    case 3:
      return (x + y) % 3 === 0;
    case 4:
      return (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0;
    case 5:
      return ((product % 2) + (product % 3)) % 2 === 0;
    case 6:
      return (((product % 2) + (product % 3)) % 2) === 0;
    default:
      return ((((x + y) % 2) + (product % 3)) % 2) === 0;
  }
}

function drawCodewords(matrix: ReturnType<typeof createEmptyMatrix>, codewords: number[]) {
  let bitIndex = 0;
  let upward = true;

  for (let right = QR_SIZE - 1; right >= 1; right -= 2) {
    if (right === 6) {
      right = 5;
    }

    for (let vertical = 0; vertical < QR_SIZE; vertical += 1) {
      for (let column = 0; column < 2; column += 1) {
        const x = right - column;
        const y = upward ? QR_SIZE - 1 - vertical : vertical;

        if (matrix.isFunction[y][x]) {
          continue;
        }

        const codeword = codewords[Math.floor(bitIndex / 8)];
        matrix.modules[y][x] = codeword === undefined ? false : getBit(codeword, 7 - (bitIndex % 8));
        bitIndex += 1;
      }
    }

    upward = !upward;
  }
}

function applyMask(matrix: ReturnType<typeof createEmptyMatrix>, mask: number) {
  for (let y = 0; y < QR_SIZE; y += 1) {
    for (let x = 0; x < QR_SIZE; x += 1) {
      if (!matrix.isFunction[y][x] && maskApplies(mask, x, y)) {
        matrix.modules[y][x] = !matrix.modules[y][x];
      }
    }
  }
}

function createQrMatrix(value: string): QrMatrix {
  const matrix = createEmptyMatrix();
  const mask = 0;

  drawFunctionPatterns(matrix);
  drawVersionBits(matrix);
  drawCodewords(matrix, interleaveBlocks(toCodewords(value)));
  applyMask(matrix, mask);
  drawFormatBits(matrix, mask);

  return {
    modules: matrix.modules,
    size: QR_SIZE
  };
}

export function createQrSvg(value: string) {
  const matrix = createQrMatrix(value);
  const quietZone = 4;
  const size = matrix.size + quietZone * 2;
  const cells: string[] = [];

  matrix.modules.forEach((row, y) => {
    row.forEach((dark, x) => {
      if (dark) {
        cells.push(`<rect x="${x + quietZone}" y="${y + quietZone}" width="1" height="1"/>`);
      }
    });
  });

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">`,
    `<rect width="${size}" height="${size}" fill="#fff"/>`,
    `<g fill="#071044">${cells.join("")}</g>`,
    "</svg>"
  ].join("");
}

export function createQrSvgDataUri(value: string) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(createQrSvg(value))}`;
}
