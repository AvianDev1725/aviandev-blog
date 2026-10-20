'use client';

import { useState } from 'react';
import Avatar from '@/components/avatar';
import BirdAvatar, { isBird } from '@/components/bird-avatar';
import { deleteApi, patchApi, type SessionUser } from '@/lib/client';
import type { PublicComment } from '@/lib/comments';
import type { CommentText } from '@/app/text';
import type { PostResult } from './comment-form';
import { guestName } from './guest-name';
import RelativeTime from './relative-time';

type Props = {
  comment: PublicComment;
  text: CommentText;
  me: SessionUser | null | undefined;
  onReply?: () => void;
  onUpdated: (id: number, comment: PublicComment | null) => void;
  onDeleted: (id: number) => void;
};

const actionClass =
  'h-9 rounded-full px-2 text-sm font-medium text-zinc-500 active:bg-zinc-100 sm:h-auto sm:px-0 sm:hover:text-zinc-900 sm:active:bg-transparent';

export default function CommentItem({ comment, text, me, onReply, onUpdated, onDeleted }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const { author } = comment;
  const isMine = Boolean(me && author?.kind === 'reader' && author.userId === me.id);
  const name = author?.kind === 'reader' ? author.name : guestName(text, author?.avatar ?? null);

  async function save() {
    const body = draft.trim();
    if (!body) return setError(text.emptyError);
    setBusy(true);
    setError('');
    const result = await patchApi<PostResult>(`/comments/${comment.id}`, { body });
    setBusy(false);
    if (!result.ok) return setError(result.fields.body || result.error || text.genericError);
    setEditing(false);
    onUpdated(comment.id, result.data.comment);
  }

  async function remove() {
    if (!confirm(text.deleteConfirm)) return;
    const result = await deleteApi(`/comments/${comment.id}`);
    if (!result.ok) return setError(result.error || text.genericError);
    onDeleted(comment.id);
  }

  return (
    <article className="flex gap-3">
      {author?.kind === 'reader' ? (
        <Avatar name={author.name} firstName={author.firstName} lastName={author.lastName} />
      ) : author?.kind === 'guest' ? (
        <BirdAvatar bird={isBird(author.avatar) ? author.avatar : 'owl'} size={40} />
      ) : (
        <span aria-hidden className="h-10 w-10 shrink-0 rounded-full bg-zinc-100" />
      )}

      <div className="min-w-0 flex-1">
        {comment.deleted ? (
          <p className="pt-2 text-sm italic text-zinc-500">{text.deleted}</p>
        ) : (
          <>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              <span className="font-medium text-zinc-900">{name}</span>
              {author?.kind === 'reader' && author.isStaff && (
                <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-xs font-medium text-white">{text.authorBadge}</span>
              )}
              <span className="text-zinc-500">
                <RelativeTime value={comment.createdAt} justNow={text.justNow} />
                {comment.edited && <> · {text.edited}</>}
              </span>
            </p>

            {editing ? (
              <div className="mt-2 space-y-2">
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  rows={3}
                  maxLength={2000}
                  autoFocus
                  aria-label={text.edit}
                  className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-base focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={save}
                    disabled={busy}
                    className="h-9 rounded-full bg-zinc-900 px-4 text-sm font-medium text-white disabled:opacity-60"
                  >
                    {busy ? text.saving : text.save}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(false);
                      setDraft(comment.body);
                      setError('');
                    }}
                    className="h-9 rounded-full px-4 text-sm font-medium text-zinc-700 ring-1 ring-zinc-300"
                  >
                    {text.cancel}
                  </button>
                </div>
              </div>
            ) : (
              <p className="mt-1 whitespace-pre-line break-words text-zinc-800">{comment.body}</p>
            )}

            {error && (
              <p role="alert" className="mt-1 text-sm text-red-700">
                {error}
              </p>
            )}

            {!editing && (
              <div className="mt-1 flex gap-1 sm:gap-4">
                {onReply && (
                  <button type="button" onClick={onReply} className={actionClass}>
                    {text.reply}
                  </button>
                )}
                {isMine && (
                  <>
                    <button type="button" onClick={() => setEditing(true)} className={actionClass}>
                      {text.edit}
                    </button>
                    <button type="button" onClick={remove} className={actionClass}>
                      {text.delete}
                    </button>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </article>
  );
}