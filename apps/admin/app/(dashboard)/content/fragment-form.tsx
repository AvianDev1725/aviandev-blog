'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Field, FormError } from '@/components/form';
import RichTextEditor from '@/components/rich-text-editor';
import type { RichTextLabels } from '@/components/rich-text-editor';
import { deleteJson, putJson } from '@/lib/client';
import { fill } from '@/lib/text';
import type { ContentModel, FieldDefinition } from '@/lib/content-types';
import type { ContentText } from './text';
import ImageUpload from './image-upload';

type Values = Record<string, unknown>;

export type Fragment = { key: string; model: ContentModel; data: Values };

function emptyValues(model?: ContentModel): Values {
  return Object.fromEntries((model?.fields ?? []).map((f) => [f.key, f.type === 'boolean' ? false : '']));
}

function toFormValues(model: ContentModel, data: Values): Values {
  return Object.fromEntries(
    model.fields.map((f) => {
      const value = data[f.key];
      if (f.type === 'boolean') return [f.key, Boolean(value)];
      if (f.type === 'number') return [f.key, value == null ? '' : String(value)];
      return [f.key, typeof value === 'string' ? value : ''];
    })
  );
}

function toPayload(model: ContentModel, values: Values) {
  return Object.fromEntries(
    model.fields.map((f) => {
      const value = values[f.key];
      if (f.type === 'number') return [f.key, value === '' ? null : Number(value)];
      return [f.key, value];
    })
  );
}

type Props = {
  text: ContentText;
  models: ContentModel[];
  fragment?: Fragment;
  canDelete: boolean;
  richText: RichTextLabels;
};

export default function FragmentForm({ text, models, fragment, canDelete, richText }: Props) {
  const router = useRouter();
  const isNew = !fragment;

  const [key, setKey] = useState(fragment?.key ?? '');
  const [modelKey, setModelKey] = useState(fragment?.model.key ?? '');
  const [values, setValues] = useState<Values>(() =>
    fragment ? toFormValues(fragment.model, fragment.data) : {}
  );
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);

  const model = fragment?.model ?? models.find((m) => m.key === modelKey);

  function chooseModel(next: string) {
    setModelKey(next);
    setValues(emptyValues(models.find((m) => m.key === next)));
    setFieldErrors({});
  }

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!model) return setError(text.chooseModelFirst);
    if (isNew && !key.trim()) return setError(text.keyRequired);

    setError('');
    setStatus('');
    setFieldErrors({});
    setSaving(true);
    const result = await putJson(`/content-fragments/${encodeURIComponent(key.trim())}`, {
      model: model.key,
      data: toPayload(model, values),
    });
    setSaving(false);

    if (!result.ok) {
      const errors = Object.fromEntries(
        result.details.filter((d) => d.field.startsWith('data.')).map((d) => [d.field.slice(5), d.message])
      );
      setFieldErrors(errors);
      return setError(Object.keys(errors).length > 0 ? text.fixErrors : result.error || text.errorFallback);
    }

    if (isNew) {
      router.push(`/content/${key.trim()}`);
      return;
    }
    setStatus(text.saved);
    router.refresh();
  }

  async function remove() {
    if (!fragment || !confirm(text.deleteConfirm)) return;
    const result = await deleteJson(`/content-fragments/${fragment.key}`);
    if (!result.ok) return setError(result.error || text.errorFallback);
    router.push('/content');
    router.refresh();
  }

  return (
    <form onSubmit={save} noValidate className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold text-zinc-900">
        {isNew ? text.newTitle : fill(text.editTitle, { key: fragment.key })}
      </h1>

      <div className="grid gap-4 rounded-xl bg-white p-6 ring-1 ring-zinc-200 sm:grid-cols-2">
        {isNew ? (
          <div className="space-y-1">
            <label htmlFor="fragment-model" className="text-sm font-medium text-zinc-700">
              {text.modelLabel}
            </label>
            <select
              id="fragment-model"
              value={modelKey}
              onChange={(e) => chooseModel(e.target.value)}
              className="block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900"
            >
              <option value="">{text.chooseModel}</option>
              {models.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div>
            <p className="text-sm font-medium text-zinc-700">{text.modelLabel}</p>
            <p className="mt-2 text-zinc-900">{fragment.model.name}</p>
          </div>
        )}
        <Field
          id="fragment-key"
          label={text.keyLabel}
          value={key}
          onChange={setKey}
          hint={text.keyHelp}
          disabled={!isNew}
          autoComplete="off"
        />
      </div>

      {model && (
        <div className="space-y-5 rounded-xl bg-white p-6 ring-1 ring-zinc-200">
          {model.fields.length === 0 ? (
            <p className="text-sm text-zinc-500">{text.noFields}</p>
          ) : (
            model.fields.map((field) => (
              <FieldInput
                key={field.key}
                field={field}
                value={values[field.key]}
                error={fieldErrors[field.key]}
                text={text}
                richText={richText}
                onChange={(value) => setValues((current) => ({ ...current, [field.key]: value }))}
              />
            ))
          )}
        </div>
      )}

      <FormError message={error} />
      {status && (
        <p role="status" className="text-sm text-green-700">
          {status}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-zinc-900 px-5 py-2.5 font-medium text-white hover:bg-zinc-700 disabled:opacity-60"
        >
          {saving ? text.saving : text.save}
        </button>
        {!isNew && canDelete && (
          <button
            type="button"
            onClick={remove}
            className="rounded-lg px-4 py-2.5 text-sm text-red-700 ring-1 ring-red-200 hover:bg-red-50"
          >
            {text.delete}
          </button>
        )}
      </div>
    </form>
  );
}

type FieldInputProps = {
  field: FieldDefinition;
  value: unknown;
  error?: string;
  text: ContentText;
  onChange: (value: unknown) => void;
  richText: RichTextLabels;
};

function FieldInput({ field, value, error, text, onChange, richText }: FieldInputProps) {
  const id = `value-${field.key}`;
  const labelId = `${id}-label`;
  const helpId = field.help ? `${id}-help` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [helpId, errorId].filter(Boolean).join(' ') || undefined;

  const inputClass = `w-full rounded-lg border px-3 py-2 text-zinc-900 outline-none focus:ring-1 ${error ? 'border-red-500 focus:border-red-600 focus:ring-red-600' : 'border-zinc-300 focus:border-zinc-900 focus:ring-zinc-900'
    }`;
  const common = {
    id,
    'aria-describedby': describedBy,
    'aria-invalid': error ? true : undefined,
    'aria-required': field.required || undefined,
  };

  const label = (
    <label id={labelId} htmlFor={id} className="text-sm font-medium text-zinc-700">
      {field.label}
      {field.required && (
        <>
          <span aria-hidden className="text-red-600">
            {' '}
            *
          </span>
          <span className="sr-only"> ({text.required})</span>
        </>
      )}
    </label>
  );

  const extras = (
    <>
      {field.help && (
        <p id={helpId} className="text-xs text-zinc-500">
          {field.help}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-sm text-red-600">
          {error}
        </p>
      )}
    </>
  );

  if (field.type === 'boolean') {
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <input
            {...common}
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
            className="h-4 w-4"
          />
          {label}
        </div>
        {extras}
      </div>
    );
  }

  const stringValue = typeof value === 'string' ? value : '';

  return (
    <div className="space-y-1">
      {label}
      {field.type === 'longText' && (
        <textarea {...common} rows={4} value={stringValue} onChange={(e) => onChange(e.target.value)} className={inputClass} />
      )}
      {field.type === 'richText' && (
        <RichTextEditor
          id={id}
          labelId={labelId}
          describedBy={describedBy}
          value={stringValue}
          onChange={onChange}
          labels={richText}
        />
      )}
      {field.type === 'number' && (
        <input
          {...common}
          type="number"
          inputMode="decimal"
          step="any"
          value={stringValue}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        />
      )}
      {(field.type === 'text' || field.type === 'link' || field.type === 'image') && (
        <input
          {...common}
          type="text"
          inputMode={field.type === 'text' ? undefined : 'url'}
          value={stringValue}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        />
      )}
      {field.type === 'image' && <ImageUpload inputId={`${id}-file`} text={text} onUploaded={onChange} />}
      {field.type === 'image' && /^(https?:\/\/|\/(?!\/))/i.test(stringValue) && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={stringValue} alt={text.imagePreview} className="mt-2 max-h-40 rounded-lg ring-1 ring-zinc-200" />
      )}
      {extras}
    </div>
  );
}