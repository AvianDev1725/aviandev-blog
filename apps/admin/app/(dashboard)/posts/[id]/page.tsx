import { notFound } from 'next/navigation';
import { apiGet } from '@/lib/api';
import { getManyByCMS } from '@/lib/content';
import { richTextText } from '../../content/text';
import PostEditor, { type Category, type EditorPost } from '../post-editor';
import { postEditorText } from '../text';

export const instant = false;

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [post, categories, cms] = await Promise.all([
    apiGet<EditorPost>(`/admin/posts/${id}`),
    apiGet<Category[]>('/categories').then((list) => list ?? []),
    getManyByCMS({ 'admin-post-editor': postEditorText, 'admin-rich-text': richTextText }),
  ]);

  if (!post) notFound();

  return (
    <PostEditor
      key={post.id}
      text={cms['admin-post-editor']}
      richText={cms['admin-rich-text']}
      categories={categories}
      post={post}
      blogUrl={process.env.BLOG_URL ?? 'http://localhost:3002'}
    />
  );
}