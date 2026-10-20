'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import BirdAvatar, { isBird } from '@/components/bird-avatar';
import { deleteJson, postJson } from '@/lib/client';
import { fill, formatDate } from '@/lib/text';
import type { commentsText } from './text';

export type ModerationComment = {
  id: number;
  parentId: number | null;
  body: string;
  status: 'pending' | 'approved' | 'spam';
  guestAvatar: string | null;
  userId: number | null;
  editedAt: string | null;
  createdAt: string;
  authorName: string | null;
  authorFirstName: string | null;
  authorLastName: string | null;
  authorEmail: string | null;
  authorRole: 'reader' | 'admin' | 'super_admin' | null;
  authorBanned: boolean;
  postTitle: string;
  postSlug: string;
};

type Props = {
  comment: ModerationComment;
  text: typeof commentsText;
  guestNames: Record<string, string>;
  canBan: boolean;
  blogUrl: string;
};

function initials(comment: ModerationComment) {
  const parts = (comment.authorName ?? '').trim().split(/\s+/);
  const first = comment.authorFirstName || parts[0] || '';
  const last = comment.authorLastName || (parts.length > 1 ? parts[parts.length - 1] : '');
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase() || '?';
}

const buttonClass =
  'h-10 rounded-lg px-3 text-sm font-medium ring-1 ring-zinc-300 active:bg-zinc-100 disabled:opacity-60 md:h-8 md:hover:bg-zinc-100';

export default function CommentRow({ comment, text, guestNames, canBan, blogUrl }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [hidden, setHidden] = useState(false);
  const [replying, setReplying] = useState(false);
  const [reply, setReply] = useState('');
  const replyBox = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (replying) replyBox.current?.focus();
  }, [replying]);

  const isGuest = comment.userId === null;
  const name = isGuest ? guestNames[comment.guestAvatar ?? ''] ?? text.guest : comment.authorName ?? '';
  const role = isGuest ? text.guest : comment.authorRole === 'reader' ? text.reader : text.staff;

  async function run(request: () => Promise<{ ok: boolean; error?: string }>, hideAfter: boolean) {
    setBusy(true);
    setError('');
    const result = await request();
    setBusy(false);
    if (!result.ok) return setError(result.error || text.errorFallback);
    if (hideAfter) setHidden(true);
    router.refresh();
  }

  const moderate = (action: 'approve' | 'spam') => run(() => postJson(`/moderation/comments/${comment.id}/${action}`, {}), true);

  function remove() {
    if (!confirm(text.deleteConfirm)) return;
    run(() => deleteJson(`/moderation/comments/${comment.id}`), true);
  }

  function toggleBan() {
    if (!comment.userId) return;
    if (comment.authorBanned) return run(() => deleteJson(`/moderation/readers/${comment.userId}/ban`), false);
    if (!confirm(fill(text.banConfirm, { name }))) return;
    run(() => postJson(`/moderation/readers/${comment.userId}/ban`, {}), true);
  }

  async function sendReply() {
    const body = reply.trim();
    if (!body) return;
    setBusy(true);
    setError('');
    const result = await postJson('/comments', {
      postSlug: comment.postSlug,
      parentId: comment.parentId ?? comment.id,
      body,
      startedAt: Date.now(),
    });
    setBusy(false);
    if (!result.ok) return setError(result.error || text.errorFallback);
    setReply('');
    setReplying(false);
    setNotice(text.replied);
    router.refresh();
  }

  if (hidden) return null;

  return (
    <article className="space-y-3 rounded-xl bg-white p-4 ring-1 ring-zinc-200">
      <div className="flex gap-3">
        {isGuest ? (
          <BirdAvatar bird={isBird(comment.guestAvatar) ? comment.guestAvatar : 'owl'} size={40} />
        ) : (
          <span
            aria-hidden
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-sm font-semibold text-white"
          >
            {initials(comment)}
          </span>
        )}

        <div className="min-w-0 flex-1 space-y-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <span className="font-medium text-zinc-900">{name}</span>
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700">{role}</span>
            {comment.authorBanned && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">{text.banned}</span>
            )}
            <span className="text-zinc-500">
              {formatDate(comment.createdAt)}
              {comment.editedAt && <> · {text.edited}</>}
            </span>
          </p>
          {comment.authorEmail && <p className="truncate text-xs text-zinc-500">{comment.authorEmail}</p>}
          <p className="text-xs text-zinc-500">
            {fill(text.onPost, { title: comment.postTitle })}
            {comment.parentId && <> · {text.inThread}</>}
          </p>
        </div>
      </div>

      <p className="whitespace-pre-line break-words text-zinc-800">{comment.body}</p>

      {replying && (
        <div className="space-y-2">
          <label htmlFor={`reply-${comment.id}`} className="sr-only">
            {text.replyLabel}
          </label>
          <textarea
            ref={replyBox}
            id={`reply-${comment.id}`}
            value={reply}
            onChange={(event) => setReply(event.target.value)}
            rows={3}
            maxLength={2000}
            placeholder={text.replyPlaceholder}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={sendReply}
              disabled={busy || !reply.trim()}
              className="h-10 rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white disabled:opacity-60 md:h-8"
            >
              {busy ? text.sending : text.sendReply}
            </button>
            <button type="button" onClick={() => setReplying(false)} className={buttonClass}>
              {text.cancel}
            </button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm text-green-700">
          {notice}
        </p>
      )}

      {!replying && (
        <div className="flex flex-wrap items-center gap-2">
          {comment.status !== 'approved' && (
            <button
              type="button"
              onClick={() => moderate('approve')}
              disabled={busy}
              className="h-10 rounded-lg bg-zinc-900 px-3 text-sm font-medium text-white active:bg-zinc-700 disabled:opacity-60 md:h-8 md:hover:bg-zinc-700"
            >
              {comment.status === 'spam' ? text.notSpam : text.approve}
            </button>
          )}
          {comment.status === 'approved' && (
            <button type="button" onClick={() => setReplying(true)} disabled={busy} className={buttonClass}>
              {text.reply}
            </button>
          )}
          {comment.status !== 'spam' && (
            <button type="button" onClick={() => moderate('spam')} disabled={busy} className={buttonClass}>
              {text.spam}
            </button>
          )}
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className="h-10 rounded-lg px-3 text-sm font-medium text-red-700 ring-1 ring-red-200 active:bg-red-50 disabled:opacity-60 md:h-8 md:hover:bg-red-50"
          >
            {text.delete}
          </button>
          {canBan && comment.authorRole === 'reader' && (
            <button type="button" onClick={toggleBan} disabled={busy} className={buttonClass}>
              {comment.authorBanned ? text.unban : text.ban}
            </button>
          )}
          <a
            href={`${blogUrl}/posts/${comment.postSlug}#comments`}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto text-sm text-zinc-500 underline underline-offset-2 hover:text-zinc-900"
          >
            {text.viewPost} ↗
          </a>
        </div>
      )}
    </article>
  );
}