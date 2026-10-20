'use client';

import { Field } from '@/components/form';
import ImageUpload from '@/components/image-upload';
import { fill } from '@/lib/text';
import type { PostEditorText } from './text';

const TITLE_FITS = 60;
const DESCRIPTION_FITS = 160;

export type SeoValues = { seoTitle: string; seoDescription: string; shareImage: string; noindex: boolean };

type Props = {
  text: PostEditorText;
  values: SeoValues;
  onChange: (changes: Partial<SeoValues>) => void;
  errors: Record<string, string>;
  preview: { title: string; description: string; url: string };
};

function Counter({ id, count, max, template }: { id: string; count: number; max: number; template: string }) {
  return (
    <p id={id} className={`text-xs ${count > max ? 'text-amber-700' : 'text-zinc-500'}`}>
      {fill(template, { count, max })}
    </p>
  );
}

export default function SeoPanel({ text, values, onChange, errors, preview }: Props) {
  const hasImage = /^(https?:\/\/|\/(?!\/))/i.test(values.shareImage);

  return (
    <section aria-labelledby="seo-heading" className="space-y-4 rounded-xl bg-white p-4 ring-1 ring-zinc-200">
      <div>
        <h2 id="seo-heading" className="font-semibold text-zinc-900">
          {text.seoHeading}
        </h2>
        <p className="text-xs text-zinc-500">{text.seoHelp}</p>
      </div>

      <div className="space-y-1">
        <Field
          id="seo-title"
          label={text.seoTitleLabel}
          value={values.seoTitle}
          onChange={(seoTitle) => onChange({ seoTitle })}
          error={errors.seoTitle}
          autoComplete="off"
        />
        <Counter id="seo-title-count" count={values.seoTitle.length} max={TITLE_FITS} template={text.seoCount} />
      </div>

      <div className="space-y-1">
        <label htmlFor="seo-description" className="text-sm font-medium text-zinc-700">
          {text.seoDescriptionLabel}
        </label>
        <textarea
          id="seo-description"
          rows={3}
          maxLength={200}
          value={values.seoDescription}
          onChange={(e) => onChange({ seoDescription: e.target.value })}
          aria-describedby="seo-description-count"
          aria-invalid={errors.seoDescription ? true : undefined}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
        />
        <Counter
          id="seo-description-count"
          count={values.seoDescription.length}
          max={DESCRIPTION_FITS}
          template={text.seoCount}
        />
        {errors.seoDescription && <p className="text-sm text-red-600">{errors.seoDescription}</p>}
      </div>

      <div className="space-y-1">
        <Field
          id="share-image"
          label={text.shareImageLabel}
          value={values.shareImage}
          onChange={(shareImage) => onChange({ shareImage })}
          hint={text.shareImageHelp}
          error={errors.shareImage}
          autoComplete="off"
        />
        <ImageUpload inputId="share-image-file" labels={text} onUploaded={(shareImage) => onChange({ shareImage })} />
        {hasImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={values.shareImage} alt="" className="mt-2 aspect-[1200/630] w-full rounded-lg object-cover ring-1 ring-zinc-200" />
        )}
      </div>

      <label className="flex items-center gap-2 text-sm text-zinc-700">
        <input
          type="checkbox"
          checked={values.noindex}
          onChange={(e) => onChange({ noindex: e.target.checked })}
          className="h-4 w-4"
        />
        {text.noindexLabel}
      </label>

      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{text.previewLabel}</p>
        <div className="rounded-lg bg-zinc-50 p-3 ring-1 ring-zinc-200">
          <p className="truncate text-xs text-zinc-600">{preview.url}</p>
          <p className="line-clamp-1 text-base text-blue-800">{preview.title}</p>
          <p className="line-clamp-2 text-sm text-zinc-600">{preview.description}</p>
        </div>
      </div>
    </section>
  );
}