import type { InputHTMLAttributes } from 'react';

type Props = InputHTMLAttributes<HTMLInputElement> & { name: string; label: string; hint?: string; error?: string };

export default function TextField({ name, label, hint, error, ...input }: Props) {
  const id = `field-${name}`;
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined;

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-zinc-800">
        {label}
      </label>
      <input
        id={id}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className="w-full rounded-lg border border-zinc-300 px-3 py-2 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
        {...input}
      />
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-zinc-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}