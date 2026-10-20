'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { JSONContent } from '@tiptap/react';
import { Field, FormError } from '@/components/form';
import RichTextEditor, { type RichTextLabels } from '@/components/rich-text-editor';
import { deleteJson, patchJson, postJson } from '@/lib/client';
import { fill, toSlug } from '@/lib/text';
import type { PostEditorText } from './text';
import SeoPanel, { type SeoValues } from './seo-panel';

export type Category = { id: number; name: string; slug: string };

export type EditorPost = {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  content: JSONContent;
  published: boolean;
  categories: Category[];
  seoTitle: string;
  seoDescription: string;
  shareImage: string;
  noindex: boolean;
};

const EXCERPT_LIMIT = 300;
const emptyDocument: JSONContent = { type: 'doc', content: [] };

type Props = {
  text: PostEditorText;
  richText: RichTextLabels;
  categories: Category[];
  post?: EditorPost;
  blogUrl: string;
};

export default function PostEditor({ text, richText, categories, post, blogUrl }: Props) {
  const router = useRouter();
  const isNew = !post;

  const [title, setTitle] = useState(post?.title ?? '');
  const [slug, setSlug] = useState(post?.slug ?? '');
  const [slugEdited, setSlugEdited] = useState(!isNew);
  const [excerpt, setExcerpt] = useState(post?.excerpt ?? '');
  const [content, setContent] = useState<JSONContent>(post?.content ?? emptyDocument);
  const [categoryIds, setCategoryIds] = useState<number[]>(post?.categories.map((c) => c.id) ?? []);
  const [published, setPublished] = useState(post?.published ?? false);
  const [seo, setSeo] = useState<SeoValues>({
    seoTitle: post?.seoTitle ?? '',
    seoDescription: post?.seoDescription ?? '',
    shareImage: post?.shareImage ?? '',
    noindex: post?.noindex ?? false,
  });
  const [previewing, setPreviewing] = useState(false);

  const [dirty, setDirty] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  function edited() {
    setDirty(true);
    setStatus('');
  }

  function changeTitle(value: string) {
    setTitle(value);
    if (!slugEdited) setSlug(toSlug(value));
    edited();
  }

  function toggleCategory(id: number) {
    setCategoryIds((current) => (current.includes(id) ? current.filter((c) => c !== id) : [...current, id]));
    edited();
  }

  async function save(nextPublished: boolean) {
    if (!title.trim()) {
      setFieldErrors({ title: text.titleRequired });
      return setError(text.fixErrors);
    }

    setFieldErrors({});
    setError('');
    setStatus('');
    setSaving(true);

    const body = { title, slug, excerpt, content, categoryIds, published: nextPublished, ...seo };
    const result = isNew
      ? await postJson<EditorPost>('/posts', body)
      : await patchJson<EditorPost>(`/posts/${post.id}`, body);
    setSaving(false);

    if (!result.ok) {
      setFieldErrors(Object.fromEntries(result.details.map((d) => [d.field, d.message])));
      return setError(result.details.length > 0 ? text.fixErrors : result.error || text.errorFallback);
    }

    setDirty(false);
    if (nextPublished && !published) setStatus(text.justPublished);
    else if (!nextPublished && published) setStatus(text.justUnpublished);
    else setStatus(text.saved);
    setPublished(nextPublished);

    if (isNew) {
      router.replace(`/posts/${result.data.id}`);
      return;
    }
    router.refresh();
  }

  async function openPreview() {
    if (!post) return;
    const tab = window.open('', '_blank');
    setPreviewing(true);
    const result = await postJson<{ token: string }>(`/admin/posts/${post.id}/preview`, {});
    setPreviewing(false);

    if (!result.ok) {
      tab?.close();
      return setError(result.error || text.errorFallback);
    }
    if (tab) {
      tab.opener = null;
      tab.location.href = `${blogUrl}/preview/${result.data.token}`;
    }
  }

  async function remove() {
    if (!post || !confirm(text.deleteConfirm)) return;
    const result = await deleteJson(`/posts/${post.id}`);
    if (!result.ok) return setError(result.error || text.errorFallback);
    setDirty(false);
    router.push('/posts');
    router.refresh();
  }

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <Link href="/posts" className="text-sm text-zinc-500 hover:text-zinc-900">
            ← {text.backToPosts}
          </Link>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-zinc-900">{isNew ? text.newTitle : text.editTitle}</h1>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${published ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                }`}
            >
              {published ? text.statusPublished : text.statusDraft}
            </span>
          </div>
        </div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-4 rounded-xl bg-white p-6 ring-1 ring-zinc-200">
          <Field
            id="post-title"
            label={text.titleLabel}
            value={title}
            onChange={changeTitle}
            error={fieldErrors.title}
            autoComplete="off"
          />
          <div className="space-y-1">
            <p id="post-content-label" className="text-sm font-medium text-zinc-700">
              {text.contentLabel}
            </p>
            <RichTextEditor
              images
              id="post-content"
              labelId="post-content-label"
              value={content}
              output="json"
              minHeightClass="min-h-96"
              onChange={(value) => {
                setContent(value as JSONContent);
                edited();
              }}
              labels={richText}
            />
          </div>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6">
          <div className="space-y-3 rounded-xl bg-white p-4 ring-1 ring-zinc-200">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => save(published)}
                disabled={saving}
                className="rounded-lg px-4 py-2 text-sm font-medium ring-1 ring-zinc-300 hover:bg-zinc-100 disabled:opacity-60"
              >
                {saving ? text.saving : published ? text.update : text.saveDraft}
              </button>
              <button
                type="button"
                onClick={() => save(!published)}
                disabled={saving}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60"
              >
                {published ? text.unpublish : text.publish}
              </button>
            </div>
            {!isNew && (
              <button
                type="button"
                onClick={openPreview}
                disabled={previewing}
                className="w-full rounded-lg px-4 py-2 text-sm font-medium ring-1 ring-zinc-300 hover:bg-zinc-100 disabled:opacity-60"
              >
                {previewing ? text.previewing : text.preview}
              </button>
            )}
            {!isNew && dirty && <p className="text-xs text-zinc-500">{text.previewUnsaved}</p>}
            <FormError message={error} />
            {status && (
              <p role="status" className="text-sm text-green-700">
                {status}
              </p>
            )}
          </div>

          <div className="space-y-4 rounded-xl bg-white p-4 ring-1 ring-zinc-200">
            <Field
              id="post-slug"
              label={text.slugLabel}
              value={slug}
              onChange={(value) => {
                setSlug(value);
                setSlugEdited(true);
                edited();
              }}
              hint={published ? text.slugLiveWarning : text.slugHelp}
              error={fieldErrors.slug}
              autoComplete="off"
            />

            <div className="space-y-1">
              <label htmlFor="post-excerpt" className="text-sm font-medium text-zinc-700">
                {text.excerptLabel}
              </label>
              <textarea
                id="post-excerpt"
                rows={4}
                value={excerpt}
                maxLength={EXCERPT_LIMIT}
                onChange={(e) => {
                  setExcerpt(e.target.value);
                  edited();
                }}
                aria-describedby="post-excerpt-help post-excerpt-count"
                aria-invalid={fieldErrors.excerpt ? true : undefined}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
              />
              <p id="post-excerpt-help" className="text-xs text-zinc-500">
                {text.excerptHelp}
              </p>
              <p id="post-excerpt-count" className="text-xs text-zinc-500">
                {fill(text.excerptCount, { count: excerpt.length, max: EXCERPT_LIMIT })}
              </p>
              {fieldErrors.excerpt && <p className="text-sm text-red-600">{fieldErrors.excerpt}</p>}
            </div>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-zinc-700">{text.categoriesLabel}</legend>
              {categories.length === 0 ? (
                <p className="text-sm text-zinc-500">
                  {text.noCategories}{' '}
                  <Link href="/categories" className="font-medium text-zinc-900 underline">
                    {text.manageCategories}
                  </Link>
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {categories.map((category) => {
                    const checked = categoryIds.includes(category.id);
                    return (
                      <label
                        key={category.id}
                        className={`flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1 text-sm ring-1 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-zinc-900 ${checked ? 'bg-zinc-900 text-white ring-zinc-900' : 'bg-white text-zinc-700 ring-zinc-300'
                          }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleCategory(category.id)}
                          className="sr-only"
                        />
                        {category.name}
                      </label>
                    );
                  })}
                </div>
              )}
              {fieldErrors.categoryIds && <p className="text-sm text-red-600">{fieldErrors.categoryIds}</p>}
            </fieldset>
          </div>
          <SeoPanel
            text={text}
            values={seo}
            errors={fieldErrors}
            onChange={(changes) => {
              setSeo((current) => ({ ...current, ...changes }));
              edited();
            }}
            preview={{
              title: seo.seoTitle || title || text.newTitle,
              description: seo.seoDescription || excerpt,
              url: `${blogUrl}/posts/${slug}`,
            }}
          />
          {!isNew && (
            <button
              type="button"
              onClick={remove}
              className="w-full rounded-lg px-4 py-2 text-sm text-red-700 ring-1 ring-red-200 hover:bg-red-50"
            >
              {text.delete}
            </button>
          )}
        </aside>
      </div>
    </div>
  );
}