import type { Metadata } from 'next';
import { Suspense } from 'react';
import PostView from '@/components/post-view';
import { getManyByCMS } from '@/lib/content';
import { getPreviewPost } from '@/lib/posts';
import { postText, previewText } from '../../text';

export const metadata: Metadata = { robots: { index: false, follow: false } };

type Props = { params: Promise<{ token: string }> };

export default function PreviewPage({ params }: Props) {
  return (
    <Suspense fallback={null}>
      <Preview params={params} />
    </Suspense>
  );
}

async function Preview({ params }: Props) {
  const { token } = await params;
  const [post, text] = await Promise.all([
    getPreviewPost(token),
    getManyByCMS({ 'web-post': postText, 'web-preview': previewText }),
  ]);
  const preview = text['web-preview'];

  if (!post) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 text-center">
        <h1 className="text-2xl font-semibold">{preview.expiredTitle}</h1>
        <p className="mt-2 text-zinc-600">{preview.expiredBody}</p>
      </div>
    );
  }

  return (
    <PostView post={post} text={text['web-post']}>
      <div role="status" className="mb-8 flex flex-wrap items-center gap-3 rounded-xl bg-amber-50 p-4 ring-1 ring-amber-200">
        <span className="rounded-full bg-amber-200 px-2 py-0.5 text-xs font-semibold text-amber-900">
          {post.published ? preview.published : preview.draft}
        </span>
        <p className="text-sm text-amber-900">{preview.banner}</p>
      </div>
    </PostView>
  );
}