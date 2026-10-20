import type { Metadata } from 'next';
import Link from 'next/link';
import { getContentByCMS } from '@/lib/content';
import { getCategories } from '@/lib/posts';
import { categoryText } from '../text';

export async function generateMetadata(): Promise<Metadata> {
  const text = await getContentByCMS('web-category', categoryText);
  return {
    title: text.topicsTitle,
    description: text.topicsIntro,
    alternates: { canonical: '/categories' },
  };
}

export default async function CategoriesPage() {
  const [categories, text] = await Promise.all([getCategories(), getContentByCMS('web-category', categoryText)]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-4xl font-bold tracking-tight">{text.topicsTitle}</h1>
      <p className="mt-3 text-lg text-zinc-600">{text.topicsIntro}</p>

      {categories.length === 0 ? (
        <p className="mt-8 text-zinc-500">{text.noTopics}</p>
      ) : (
        <ul className="mt-10 grid gap-4 sm:grid-cols-2">
          {categories.map((category) => (
            <li key={category.id}>
              <Link
                href={`/category/${category.slug}`}
                className="block h-full rounded-xl p-5 ring-1 ring-zinc-200 hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
              >
                <h2 className="font-semibold">{category.name}</h2>
                {category?.description && <p className="mt-1 text-sm text-zinc-600">{category?.description}</p>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}