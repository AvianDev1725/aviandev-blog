type Props = { busy: boolean; label: string; busyLabel: string };

export default function SubmitButton({ busy, label, busyLabel }: Props) {
  return (
    <button
      type="submit"
      disabled={busy}
      className="w-full rounded-lg bg-zinc-900 px-4 py-2.5 font-medium text-white hover:bg-zinc-700 disabled:opacity-60"
    >
      {busy ? busyLabel : label}
    </button>
  );
}