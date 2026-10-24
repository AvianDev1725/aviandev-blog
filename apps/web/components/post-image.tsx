import Image from 'next/image';

type Props = { src?: unknown; alt?: unknown; width?: unknown; height?: unknown; priority?: boolean };

const isOwnUpload = (src: unknown): src is string =>
  typeof src === 'string' && /^\/media\/[A-Za-z0-9._-]+$/.test(src);

const isSize = (value: unknown): value is number => typeof value === 'number' && value > 0;

export default function PostImage({ src, alt, width, height, priority = false }: Props) {
  if (!isOwnUpload(src)) return null;
  const altText = typeof alt === 'string' ? alt : '';

  if (!isSize(width) || !isSize(height)) {
    return (
      <img
        src={src}
        alt={altText}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : undefined}
        decoding="async"
        className="h-auto w-full rounded-lg"
      />
    );
  }

  return (
    <Image
      src={src}
      alt={altText}
      width={width}
      height={height}
      sizes="(min-width: 800px) 736px, 100vw"
      preload={priority}
      className="h-auto w-full rounded-lg"
    />
  );
}