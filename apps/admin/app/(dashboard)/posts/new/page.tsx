import { apiGet } from '@/lib/api';
import { getManyByCMS } from '@/lib/content';
import { richTextText } from '../../content/text';
import PostEditor, { type Category } from '../post-editor';
import { postEditorText } from '../text';

export const instant = false;

type Props = { searchParams: Promise<{ title?: string | string[] }> };

export default async function NewPostPage({ searchParams }: Props) {
  const [{ title }, categories, cms] = await Promise.all([
    searchParams,
    apiGet<Category[]>('/categories').then((list) => list ?? []),
    getManyByCMS({ 'admin-post-editor': postEditorText, 'admin-rich-text': richTextText }),
  ]);

  const initialTitle = typeof title === 'string' ? title.trim().slice(0, 200) : undefined;

  return (
    <PostEditor
      text={cms['admin-post-editor']}
      richText={cms['admin-rich-text']}
      categories={categories}
      blogUrl={process.env.BLOG_URL ?? 'http://localhost:3002'}
      initialTitle={initialTitle || undefined}
    />
  );
}