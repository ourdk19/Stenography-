const MAGIC = [0x53, 0x54, 0x47, 0x31];
const HEADER_BYTES = 8;

export function getMessageCapacity(width: number, height: number): number {
  return Math.max(0, Math.floor((width * height * 3 - HEADER_BYTES * 8) / 8));
}

function channelIndexes(width: number, height: number): number[] {
  const indexes: number[] = [];
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    const offset = pixel * 4;
    indexes.push(offset, offset + 1, offset + 2);
  }
  return indexes;
}

function readHeader(data: Uint8ClampedArray, indexes: number[]): { length: number } {
  const header = new Uint8Array(HEADER_BYTES);
  for (let byte = 0; byte < HEADER_BYTES; byte += 1) {
    let value = 0;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value << 1) | (data[indexes[byte * 8 + bit]] & 1);
    }
    header[byte] = value;
  }

  if (!MAGIC.every((value, index) => header[index] === value)) {
    throw new Error('No Steganography Studio message was found in this image.');
  }

  return {
    length: new DataView(header.buffer).getUint32(4, false),
  };
}

export async function encodeMessage(image: HTMLImageElement, message: string): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d', { willReadFrequently: true });

  if (!context) {
    throw new Error('Your browser could not prepare this image for encoding.');
  }

  context.drawImage(image, 0, 0);
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const indexes = channelIndexes(canvas.width, canvas.height);
  const payload = new TextEncoder().encode(message);
  const capacity = getMessageCapacity(canvas.width, canvas.height);

  if (payload.length > capacity) {
    throw new Error(`This message needs ${payload.length.toLocaleString()} bytes, but the image holds ${capacity.toLocaleString()}.`);
  }

  const packet = new Uint8Array(HEADER_BYTES + payload.length);
  packet.set(MAGIC);
  new DataView(packet.buffer).setUint32(4, payload.length, false);
  packet.set(payload, HEADER_BYTES);

  for (let byte = 0; byte < packet.length; byte += 1) {
    for (let bit = 0; bit < 8; bit += 1) {
      const channel = indexes[byte * 8 + bit];
      const bitValue = (packet[byte] >> (7 - bit)) & 1;
      imageData.data[channel] = (imageData.data[channel] & 0xfe) | bitValue;
    }
  }

  context.putImageData(imageData, 0, 0);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('The browser could not create a PNG from this image.'));
      }
    }, 'image/png');
  });
}

export function decodeMessage(image: HTMLImageElement): string {
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d', { willReadFrequently: true });

  if (!context) {
    throw new Error('Your browser could not read this image.');
  }

  context.drawImage(image, 0, 0);
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const indexes = channelIndexes(canvas.width, canvas.height);
  const { length } = readHeader(imageData.data, indexes);
  const capacity = getMessageCapacity(canvas.width, canvas.height);

  if (length > capacity) {
    throw new Error('The embedded message header is not valid for this image.');
  }

  const payload = new Uint8Array(length);
  for (let byte = 0; byte < length; byte += 1) {
    let value = 0;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value << 1) | (imageData.data[indexes[(HEADER_BYTES + byte) * 8 + bit]] & 1);
    }
    payload[byte] = value;
  }

  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(payload);
  } catch {
    throw new Error('The message is not valid UTF-8 text.');
  }
}