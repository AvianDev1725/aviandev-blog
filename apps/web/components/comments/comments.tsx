'use client';

import { useEffect, useMemo, useState } from 'react';
import { formatCount } from '@aviandev/core/text';
import BirdAvatar, { isBird, type Bird } from '@/components/bird-avatar';
import { getSession, type SessionUser } from '@/lib/client';
import type { CommentData, PublicComment } from '@/lib/comments';
import type { CommentText } from '@/app/text';
import CommentForm, { type PostResult } from './comment-form';
import CommentItem from './comment-item';
import { guestName } from './guest-name';

type Waiting = { key: number; body: string; parentId: number | null; bird: Bird | null };

const BIRD_STORAGE_KEY = 'aviandev-guest-bird';

type Props = { slug: string; initial: CommentData; text: CommentText };

export default function Comments({ slug, initial, text }: Props) {
  const [items, setItems] = useState<PublicComment[]>(initial.comments);
  const [me, setMe] = useState<SessionUser | null | undefined>(undefined);
  const [bird, setBird] = useState<Bird | null>(null);
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [notice, setNotice] = useState('');
  const [waiting, setWaiting] = useState<Waiting[]>([]);

  useEffect(() => {
    getSession().then(setMe);
    try {
      const saved = localStorage.getItem(BIRD_STORAGE_KEY);
      if (isBird(saved)) setBird(saved);
    } catch {}
  }, []);

  function chooseBird(next: Bird) {
    setBird(next);
    try {
      localStorage.setItem(BIRD_STORAGE_KEY, next);
    } catch {}
  }

  const threads = useMemo(
    () =>
      items
        .filter((comment) => comment.parentId === null)
        .map((comment) => ({ comment, replies: items.filter((reply) => reply.parentId === comment.id) })),
    [items],
  );
  const count = items.filter((comment) => !comment.deleted).length;

  function handlePosted(result: PostResult, body: string, parentId: number | null) {
    setReplyTo(null);
    if (result.comment) {
      setItems((current) => [...current, result.comment!]);
      setNotice('');
    } else {
      setWaiting((current) => [...current, { key: Date.now(), body, parentId, bird: me ? null : bird }]);
      setNotice(text.pendingNotice);
    }
  }

  function handleUpdated(id: number, comment: PublicComment | null) {
    if (comment) {
      setItems((current) => current.map((item) => (item.id === id ? comment : item)));
    } else {
      setItems((current) => current.filter((item) => item.id !== id && item.parentId !== id));
      setNotice(text.editPendingNotice);
    }
  }

  function handleDeleted(id: number) {
    setItems((current) => {
      const hasReplies = current.some((item) => item.parentId === id && !item.deleted);
      return hasReplies
        ? current.map((item) => (item.id === id ? { ...item, deleted: true, body: '', author: null } : item))
        : current.filter((item) => item.id !== id && item.parentId !== id);
    });
  }

  const formProps = { slug, text, bird, onBirdChange: chooseBird, me: me ?? null };

  const waitingCard = (entry: Waiting) => (
    <li key={entry.key} className="flex gap-3 opacity-80">
      {entry.bird ? (
        <BirdAvatar bird={entry.bird} size={40} />
      ) : (
        <span aria-hidden className="h-10 w-10 shrink-0 rounded-full bg-zinc-200" />
      )}
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium text-zinc-900">{me ? me.name : guestName(text, entry.bird)}</span>
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">{text.waiting}</span>
        </p>
        <p className="mt-1 whitespace-pre-line break-words text-zinc-700">{entry.body}</p>
      </div>
    </li>
  );

  return (
    <section id="comments" aria-labelledby="comments-heading" className="mx-auto max-w-3xl scroll-mt-20 border-t border-zinc-200 px-4 py-10">
      <h2 id="comments-heading" className="text-xl font-semibold tracking-tight">
        {count === 0 ? text.heading : formatCount(count, text.countOne, text.countMany)}
      </h2>

      <div className="mt-6">
        {me === undefined ? (
          <div className="h-36 animate-pulse rounded-xl bg-zinc-100 motion-reduce:animate-none" aria-hidden />
        ) : (
          <CommentForm {...formProps} onPosted={(result, body) => handlePosted(result, body, null)} />
        )}
      </div>

      {notice && (
        <p role="status" className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900 ring-1 ring-emerald-200">
          {notice}
        </p>
      )}

      {waiting.some((entry) => entry.parentId === null) && (
        <ol className="mt-8 space-y-6">{waiting.filter((entry) => entry.parentId === null).map(waitingCard)}</ol>
      )}

      {threads.length === 0 && waiting.length === 0 ? (
        <p className="mt-8 text-zinc-500">{text.empty}</p>
      ) : (
        <ol className="mt-8 space-y-8">
          {threads.map(({ comment, replies }) => {
            const waitingReplies = waiting.filter((entry) => entry.parentId === comment.id);
            const replying = replyTo === comment.id;
            const canReply = Boolean(me !== undefined && !comment.deleted);
            const openReply = canReply ? () => setReplyTo(comment.id) : undefined;

            return (
              <li key={comment.id}>
                <CommentItem
                  comment={comment}
                  text={text}
                  me={me}
                  onReply={openReply}
                  onUpdated={handleUpdated}
                  onDeleted={handleDeleted}
                />

                {(replies.length > 0 || waitingReplies.length > 0 || replying) && (
                  <ol className="ml-5 mt-4 space-y-5 border-l-2 border-zinc-100 pl-4 sm:ml-[3.25rem]">
                    {replies.map((reply) => (
                      <li key={reply.id}>
                        <CommentItem
                          comment={reply}
                          text={text}
                          me={me}
                          onReply={openReply}
                          onUpdated={handleUpdated}
                          onDeleted={handleDeleted}
                        />
                      </li>
                    ))}
                    {waitingReplies.map(waitingCard)}
                    {replying && (
                      <li>
                        <CommentForm
                          {...formProps}
                          parentId={comment.id}
                          onCancel={() => setReplyTo(null)}
                          onPosted={(result, body) => handlePosted(result, body, comment.id)}
                        />
                      </li>
                    )}
                  </ol>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}