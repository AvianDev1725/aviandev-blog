type ImageType = { ext: string; mime: string; test: (bytes: Buffer) => boolean };

const startsWith = (bytes: Buffer, signature: number[]) => signature.every((byte, i) => bytes[i] === byte);

const imageTypes: ImageType[] = [
  { ext: 'png', mime: 'image/png', test: (b) => startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) },
  { ext: 'jpg', mime: 'image/jpeg', test: (b) => startsWith(b, [0xff, 0xd8, 0xff]) },
  { ext: 'gif', mime: 'image/gif', test: (b) => b.subarray(0, 4).toString('ascii') === 'GIF8' },
  {
    ext: 'webp',
    mime: 'image/webp',
    test: (b) => b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP',
  },
  { ext: 'ico', mime: 'image/x-icon', test: (b) => startsWith(b, [0x00, 0x00, 0x01, 0x00]) },
  {
    ext: 'svg',
    mime: 'image/svg+xml',
    test: (b) => {
      const head = b.subarray(0, 1024).toString('utf8').trimStart().toLowerCase();
      return head.startsWith('<svg') || (head.startsWith('<?xml') && head.includes('<svg'));
    },
  },
];

export function detectImageType(bytes: Buffer) {
  return imageTypes.find((type) => type.test(bytes)) ?? null;
}