import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { cmsRegistry } from '../lib/cms-registry';

const API_URL = process.env.API_URL ?? 'http://localhost:3000';

type Field = { key: string; label: string; type: string; required: boolean; help: string };
type Model = { id: number; key: string; fields: Field[] };
type Value = string | number | boolean;

function toLabel(key: string) {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
}

function toField(key: string, value: Value, typeOverride?: string): Field {
  const type =
    typeOverride ??
    (typeof value === 'boolean'
      ? 'boolean'
      : typeof value === 'number'
        ? 'number'
        : value.length > 80
          ? 'longText'
          : 'text');
  const required = typeof value === 'string' && value !== '';
  return { key, label: toLabel(key), type, required, help: '' };
}

async function main() {
  const rl = createInterface({ input, output });
  const email = (await rl.question('Super admin email: ')).trim();
  const password = await rl.question('Password: ');
  rl.close();

  const login = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!login.ok) {
    console.error('Sign in failed. Check the email and password, and that the API is running.');
    process.exit(1);
  }
  const cookie = login.headers.get('set-cookie')!.split(';')[0];

  async function api(method: string, path: string, body?: unknown) {
    const res = await fetch(`${API_URL}${path}`, {
      method,
      headers: { Cookie: cookie, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, data: await res.json().catch(() => null) };
  }

  const models = new Map(((await api('GET', '/content-models')).data as Model[]).map((m) => [m.key, m]));

  for (const entry of cmsRegistry) {
    const wanted = Object.entries(entry.fallback).map(([key, value]) => toField(key, value, entry.fieldTypes?.[key]));
    const existing = models.get(entry.key);

    if (!existing) {
      const res = await api('POST', '/content-models', {
        key: entry.key,
        name: entry.name,
        description: entry.description,
        fields: wanted,
      });
      console.log(res.status === 201 ? `✔ Created model ${entry.key}` : `✖ Model ${entry.key}: ${JSON.stringify(res.data)}`);
    } else {
      const missing = wanted.filter((field) => !existing.fields.some((f) => f.key === field.key));
      if (missing.length > 0) {
        const res = await api('PATCH', `/content-models/${existing.id}`, { fields: [...existing.fields, ...missing] });
        console.log(
          res.status === 200
            ? `✔ Added ${missing.map((f) => f.key).join(', ')} to model ${entry.key}`
            : `✖ Model ${entry.key}: ${JSON.stringify(res.data)}`
        );
      }
    }

    const fragment = await api('GET', `/content-fragments/${entry.key}`);
    if (fragment.status === 404) {
      const res = await api('PUT', `/content-fragments/${entry.key}`, { model: entry.key, data: entry.fallback });
      console.log(res.status === 201 ? `✔ Created content ${entry.key}` : `✖ Content ${entry.key}: ${JSON.stringify(res.data)}`);
    } else {
      console.log(`• Content ${entry.key} already exists, left unchanged`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});