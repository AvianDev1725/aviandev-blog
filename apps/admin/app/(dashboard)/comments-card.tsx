import Link from 'next/link';
import { MessageSquare } from 'lucide-react';
import { fill } from '@/lib/text';

type Labels = { title: string; waiting: string; none: string; review: string };

export default function CommentsCard({ pending, labels }: { pending: number; labels: Labels }) {
  return (
    <Link
      href="/comments"
      className="flex items-center gap-4 rounded-xl bg-white p-4 ring-1 ring-zinc-200 active:bg-zinc-50 md:hover:bg-zinc-50"
    >
      <span
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
          pending > 0 ? 'bg-amber-100 text-amber-800' : 'bg-zinc-100 text-zinc-500'
        }`}
      >
        <MessageSquare size={20} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium text-zinc-900">{labels.title}</span>
        <span className="block text-sm text-zinc-500">
          {pending > 0 ? fill(labels.waiting, { count: pending }) : labels.none}
        </span>
      </span>
      <span className="text-sm font-medium text-zinc-700">{labels.review} →</span>
    </Link>
  );
}