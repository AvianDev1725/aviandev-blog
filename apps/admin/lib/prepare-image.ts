const MAX_WIDTH = 2000;
const MAX_BYTES = 900 * 1024;
const QUALITY = 0.85;

export type PreparedImage = { file: File; width: number; height: number };

export async function prepareImage(file: File): Promise<PreparedImage> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;

  const isAnimated = file.type === 'image/gif';
  if (isAnimated || (width <= MAX_WIDTH && file.size <= MAX_BYTES)) {
    bitmap.close();
    return { file, width, height };
  }

  const scale = Math.min(1, MAX_WIDTH / width);
  const newWidth = Math.round(width * scale);
  const newHeight = Math.round(height * scale);

  const canvas = new OffscreenCanvas(newWidth, newHeight);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, newWidth, newHeight);
  bitmap.close();

  let blob = await canvas.convertToBlob({ type: 'image/webp', quality: QUALITY });
  if (blob.type !== 'image/webp') blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: QUALITY });

  const extension = blob.type === 'image/webp' ? 'webp' : 'jpg';
  const name = `${file.name.replace(/\.[^.]+$/, '')}.${extension}`;
  return { file: new File([blob], name, { type: blob.type }), width: newWidth, height: newHeight };
}