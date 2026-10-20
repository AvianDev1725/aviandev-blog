'use client';

import Link from 'next/link';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { fill } from '@aviandev/core/text';
import type { Bird } from '@/components/bird-avatar';
import { postApi, type SessionUser } from '@/lib/client';
import type { PublicComment } from '@/lib/comments';
import type { CommentText } from '@/app/text';
import BirdPicker from './bird-picker';

const MAX_LENGTH = 2000;

export type PostResult = { status: 'approved' | 'pending'; comment: PublicComment | null };

type Props = {
  slug: string;
  text: CommentText;
  me: SessionUser | null;
  bird: Bird | null;
  onBirdChange: (bird: Bird) => void;
  onPosted: (result: PostResult, body: string) => void;
  parentId?: number;
  onCancel?: () => void;
};

export default function CommentForm({ slug, text, me, bird, onBirdChange, onPosted, parentId, onCancel }: Props) {
  const id = useId();
  const textarea = useRef<HTMLTextAreaElement>(null);
  const startedAt = useRef(0);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [resent, setResent] = useState(false);

  useEffect(() => {
    startedAt.current = Date.now();
    if (parentId) textarea.current?.focus();
  }, [parentId]);

  if (me && !me.emailVerifiedAt) {
    return (
      <div className="space-y-2 rounded-xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200">
        <p>{text.confirmEmail}</p>
        {resent ? (
          <p role="status" className="font-medium">
            {text.resent}
          </p>
        ) : (
          <button
            type="button"
            onClick={async () => {
              if ((await postApi('/readers/resend-verification')).ok) setResent(true);
            }}
            className="py-1 font-medium underline underline-offset-2"
          >
            {text.resend}
          </button>
        )}
      </div>
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) return setError(text.emptyError);
    if (!me && !bird) return setError(text.chooseBirdError);

    const website = String(new FormData(event.currentTarget).get('website') ?? '');
    setBusy(true);
    setError('');

    const result = await postApi<PostResult>('/comments', {
      postSlug: slug,
      parentId,
      body: trimmed,
      guestAvatar: me ? undefined : bird,
      website: website || undefined,
      startedAt: startedAt.current,
    });
    setBusy(false);

    if (!result.ok) return setError(result.fields.body || result.error || text.genericError);
    setBody('');
    onPosted(result.data, trimmed);
  }

  const remaining = MAX_LENGTH - body.length;
  const loginHref = `/login?next=${encodeURIComponent(`/posts/${slug}#comments`)}`;

  return (
    <form onSubmit={submit} noValidate className="relative space-y-3">
      {!me && <BirdPicker name={`${id}-bird`} value={bird} onChange={onBirdChange} text={text} />}

      <div>
        <label htmlFor={`${id}-body`} className="sr-only">
          {parentId ? text.replyLabel : text.formLabel}
        </label>
        <textarea
          ref={textarea}
          id={`${id}-body`}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={parentId ? 3 : 4}
          maxLength={MAX_LENGTH}
          placeholder={text.placeholder}
          aria-describedby={remaining < 200 ? `${id}-count` : undefined}
          aria-invalid={error ? true : undefined}
          className="w-full resize-y rounded-xl border border-zinc-300 px-3 py-2.5 text-base focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
        />
        {remaining < 200 && (
          <p id={`${id}-count`} className="mt-1 text-xs text-zinc-500">
            {fill(text.charactersLeft, { count: remaining })}
          </p>
        )}
      </div>

      <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-500">
          {me ? (
            fill(text.commentingAs, { name: me.name })
          ) : (
            <>
              {text.guestNote}{' '}
              <Link href={loginHref} className="font-medium text-zinc-900 underline underline-offset-2">
                {text.logInInstead}
              </Link>
            </>
          )}
        </p>
        <div className="flex gap-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="h-10 rounded-full px-4 text-sm font-medium text-zinc-700 active:bg-zinc-100 sm:hover:bg-zinc-100"
            >
              {text.cancel}
            </button>
          )}
          <button
            type="submit"
            disabled={busy}
            className="h-10 rounded-full bg-zinc-900 px-5 text-sm font-medium text-white active:bg-zinc-700 disabled:opacity-60 sm:hover:bg-zinc-700"
          >
            {busy ? text.submitting : parentId ? text.replySubmit : text.submit}
          </button>
        </div>
      </div>
    </form>
  );
}