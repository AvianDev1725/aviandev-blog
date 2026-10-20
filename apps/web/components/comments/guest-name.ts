import type { CommentText } from '@/app/text';

export function guestName(text: CommentText, bird: string | null) {
  if (!bird) return text.guestFallback;
  const key = `guest${bird.charAt(0).toUpperCase()}${bird.slice(1)}`;
  return (text as Record<string, string>)[key] ?? text.guestFallback;
}