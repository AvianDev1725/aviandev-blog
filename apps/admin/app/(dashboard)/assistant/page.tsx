import { notFound } from 'next/navigation';
import { apiGet, getCurrentUser } from '@/lib/api';
import { getContentByCMS } from '@/lib/content';
import SettingsForm, { type AssistantData } from './settings-form';
import { assistantText } from './text';

export const instant = false;

export default async function AssistantPage() {
  const user = await getCurrentUser();
  if (user?.role !== 'super_admin') notFound();

  const [data, text] = await Promise.all([
    apiGet<AssistantData>('/assistant/settings'),
    getContentByCMS('admin-assistant', assistantText),
  ]);
  if (!data) notFound();

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900 sm:text-2xl">{text.title}</h1>
        <p className="mt-1 text-zinc-500">{text.subtitle}</p>
      </div>
      <SettingsForm key={JSON.stringify(data.settings)} text={text} initial={data} />
    </div>
  );
}