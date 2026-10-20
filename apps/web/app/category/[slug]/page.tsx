import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import PostList from '@/components/post-list';
import { getContentByCMS } from '@/lib/content';
import { getCategories, getPosts } from '@/lib/posts';
import { categoryText } from '../../text';

type Props = { params: Promise<{ slug: string }> };

async function findCategory(slug: string) {
  const categories = await getCategories();
  return categories.find((category) => category.slug === slug) ?? null;
}

export async function generateStaticParams() {
  const categories = await getCategories();
  return categories.map((category) => ({ slug: category.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const category = await findCategory(slug);
  if (!category) return {};

  return {
    title: category.name,
    description: category.description || undefined,
    alternates: { canonical: `/category/${category.slug}` },
  };
}

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params;
  const [category, posts, text] = await Promise.all([
    findCategory(slug),
    getPosts(slug),
    getContentByCMS('web-category', categoryText),
  ]);
  if (!category) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <Link href="/categories" className="text-sm text-zinc-500 hover:text-zinc-900">
        ← {text.allTopics}
      </Link>

      <h1 className="mt-6 text-4xl font-bold tracking-tight">{category.name}</h1>
      {category.description && <p className="mt-3 text-lg text-zinc-600">{category.description}</p>}

      <section aria-labelledby="category-posts" className="mt-12">
        <h2 id="category-posts" className="sr-only">
          {text.postsHeading}
        </h2>
        <PostList posts={posts} emptyMessage={text.empty} headingLevel="h3" />
      </section>
    </div>
  );
}