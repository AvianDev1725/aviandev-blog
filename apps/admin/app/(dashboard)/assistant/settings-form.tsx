'use client';

import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { fill } from '@/lib/text';
import type { AssistantText } from './text';

type Settings = {
  enabled: boolean;
  adminEnabled: boolean;
  provider: string;
  model: string;
  baseUrl: string;
  dailyLimit: number;
  perReaderLimit: number;
  answerLength: 'short' | 'medium' | 'long';
  creativity: number;
};

type Provider = {
  id: string;
  label: string;
  keyEnv: string | null;
  keySet: boolean;
  models: string[];
  needsBaseUrl: boolean;
};

export type AssistantData = { settings: Settings; providers: Provider[] };

type Status = { kind: 'idle' | 'busy' | 'ok' | 'error'; message: string };
const IDLE: Status = { kind: 'idle', message: '' };

async function send(path: string, method: 'PUT' | 'POST', body: unknown) {
  try {
    const res = await fetch(`/api${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, data };
  } catch {
    return { ok: false, data: { error: 'network error' } };
  }
}

function Card({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="space-y-4 rounded-xl bg-white p-4 ring-1 ring-zinc-200 sm:p-5">
      <div>
        <h2 className="font-semibold text-zinc-900">{title}</h2>
        {hint && <p className="mt-0.5 text-sm text-zinc-500">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Switch({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="font-medium text-zinc-900">{label}</p>
        <p className="text-sm text-zinc-500">{hint}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${checked ? 'bg-teal-600' : 'bg-zinc-300'}`}
      >
        <span
          className={`absolute left-1 top-1 h-6 w-6 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-6' : ''}`}
          aria-hidden
        />
      </button>
    </div>
  );
}

const field = 'h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-base text-zinc-900';
const labelClass = 'flex flex-col gap-1.5 text-sm font-medium text-zinc-700';
const help = 'text-xs font-normal text-zinc-500';

export default function SettingsForm({ text, initial }: { text: AssistantText; initial: AssistantData }) {
  const router = useRouter();
  const [settings, setSettings] = useState<Settings>(initial.settings);
  const [saveStatus, setSaveStatus] = useState<Status>(IDLE);
  const [testStatus, setTestStatus] = useState<Status>(IDLE);

  const provider = initial.providers.find((item) => item.id === settings.provider) ?? initial.providers[0];
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((current) => ({ ...current, [key]: value }));
    setSaveStatus(IDLE);
  };

  function changeProvider(id: string) {
    const next = initial.providers.find((item) => item.id === id);
    setSettings((current) => ({
      ...current,
      provider: id,
      model: next?.models.includes(current.model) ? current.model : (next?.models[0] ?? ''),
    }));
    setSaveStatus(IDLE);
    setTestStatus(IDLE);
  }

  const creativityLabel =
    settings.creativity <= 3 ? text.creativityLow : settings.creativity <= 6 ? text.creativityMid : text.creativityHigh;

  async function test() {
    setTestStatus({ kind: 'busy', message: text.testing });
    const { data } = await send('/assistant/test', 'POST', settings);
    setTestStatus(
      data.ok
        ? { kind: 'ok', message: fill(text.testOk, { model: settings.model, ms: data.ms }) }
        : { kind: 'error', message: fill(text.testFailed, { error: data.error ?? '' }) },
    );
  }

  async function save() {
    setSaveStatus({ kind: 'busy', message: text.saving });
    const { ok, data } = await send('/assistant/settings', 'PUT', settings);
    if (ok) {
      setSaveStatus({ kind: 'ok', message: text.saved });
      router.refresh();
    } else {
      setSaveStatus({ kind: 'error', message: fill(text.saveFailed, { error: data.error ?? '' }) });
    }
  }

  const keyLine = !provider?.keyEnv
    ? { ok: true, message: text.noKeyNeeded }
    : provider.keySet
      ? { ok: true, message: fill(text.keyFound, { env: provider.keyEnv }) }
      : { ok: false, message: fill(text.keyMissing, { env: provider.keyEnv }) };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
      className="space-y-4"
    >
      <Card title={text.switchesTitle}>
        <Switch label={text.blogSwitch} hint={text.blogSwitchHint} checked={settings.enabled} onChange={(value) => set('enabled', value)} />
        <div className="border-t border-zinc-100" />
        <Switch label={text.adminSwitch} hint={text.adminSwitchHint} checked={settings.adminEnabled} onChange={(value) => set('adminEnabled', value)} />
      </Card>

      <Card title={text.modelTitle} hint={text.modelHint}>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={labelClass}>
            {text.provider}
            <select value={settings.provider} onChange={(event) => changeProvider(event.target.value)} className={field}>
              {initial.providers.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            {text.model}
            <input
              value={settings.model}
              onChange={(event) => set('model', event.target.value)}
              list="assistant-models"
              autoComplete="off"
              spellCheck={false}
              className={field}
            />
            <datalist id="assistant-models">
              {provider?.models.map((model) => <option key={model} value={model} />)}
            </datalist>
            <span className={help}>{text.modelHelp}</span>
          </label>
          {provider?.needsBaseUrl && (
            <label className={`${labelClass} sm:col-span-2`}>
              {text.baseUrl}
              <input
                value={settings.baseUrl}
                onChange={(event) => set('baseUrl', event.target.value)}
                inputMode="url"
                autoComplete="off"
                spellCheck={false}
                placeholder="https://"
                className={field}
              />
              <span className={help}>{text.baseUrlHelp}</span>
            </label>
          )}
        </div>

        <p className={`rounded-lg px-3 py-2.5 text-sm ${keyLine.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'}`}>
          {keyLine.message}
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={test}
            disabled={testStatus.kind === 'busy' || !keyLine.ok}
            className="h-10 rounded-lg bg-white px-4 text-sm font-semibold text-zinc-800 ring-1 ring-zinc-300 hover:bg-zinc-50 disabled:opacity-50"
          >
            {text.test}
          </button>
          {testStatus.kind !== 'idle' && (
            <span
              role="status"
              className={`text-sm ${testStatus.kind === 'ok' ? 'text-emerald-700' : testStatus.kind === 'error' ? 'text-amber-800' : 'text-zinc-500'}`}
            >
              {testStatus.message}
            </span>
          )}
        </div>
      </Card>

      <Card title={text.limitsTitle} hint={text.limitsHint}>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={labelClass}>
            {text.dailyLimit}
            <input
              type="number"
              min={0}
              inputMode="numeric"
              value={settings.dailyLimit}
              onChange={(event) => set('dailyLimit', Math.max(0, Math.floor(Number(event.target.value) || 0)))}
              className={field}
            />
            <span className={help}>{text.dailyLimitHelp}</span>
          </label>
          <label className={labelClass}>
            {text.perReaderLimit}
            <input
              type="number"
              min={1}
              inputMode="numeric"
              value={settings.perReaderLimit}
              onChange={(event) => set('perReaderLimit', Math.max(1, Math.floor(Number(event.target.value) || 1)))}
              className={field}
            />
          </label>
        </div>
      </Card>

      <Card title={text.answersTitle}>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={labelClass}>
            {text.answerLength}
            <select
              value={settings.answerLength}
              onChange={(event) => set('answerLength', event.target.value as Settings['answerLength'])}
              className={field}
            >
              <option value="short">{text.lengthShort}</option>
              <option value="medium">{text.lengthMedium}</option>
              <option value="long">{text.lengthLong}</option>
            </select>
          </label>
          <label className={labelClass}>
            <span>
              {text.creativity} <span className="font-normal text-zinc-500">· {(settings.creativity / 10).toFixed(1)} · {creativityLabel}</span>
            </span>
            <input
              type="range"
              min={0}
              max={10}
              step={1}
              value={settings.creativity}
              onChange={(event) => set('creativity', Number(event.target.value))}
              className="h-11 accent-teal-600"
            />
          </label>
        </div>
        <p className="text-sm text-zinc-500">{text.wordingHint}</p>
      </Card>

      <div className="sticky bottom-[calc(5rem+env(safe-area-inset-bottom))] flex flex-wrap items-center gap-3 rounded-xl bg-white/90 p-3 ring-1 ring-zinc-200 backdrop-blur md:static md:bg-transparent md:p-0 md:ring-0">
        <button
          type="submit"
          disabled={saveStatus.kind === 'busy'}
          className="h-11 rounded-lg bg-zinc-900 px-5 text-sm font-semibold text-white hover:bg-zinc-700 disabled:opacity-60"
        >
          {saveStatus.kind === 'busy' ? text.saving : text.save}
        </button>
        {(saveStatus.kind === 'ok' || saveStatus.kind === 'error') && (
          <span role="status" className={`text-sm ${saveStatus.kind === 'ok' ? 'text-emerald-700' : 'text-amber-800'}`}>
            {saveStatus.message}
          </span>
        )}
      </div>
    </form>
  );
}