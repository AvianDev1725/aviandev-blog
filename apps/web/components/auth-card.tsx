import type { ReactNode } from 'react';

type Props = { title: string; intro?: string; children: ReactNode };

export default function AuthCard({ title, intro, children }: Props) {
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      {intro && <p className="mt-2 text-zinc-600">{intro}</p>}
      <div className="mt-8">{children}</div>
    </div>
  );
}