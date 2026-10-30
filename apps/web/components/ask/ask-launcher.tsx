'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AskText } from '@/app/text';
import { getAskConfig, type AskConfig } from '@/lib/ask';
import AvianBot from './avian-bot';

const loadPanel = () => import('./ask-panel');
const AskPanel = dynamic(loadPanel, { ssr: false });

export default function AskLauncher({ text }: { text: AskText }) {
  const [config, setConfig] = useState<AskConfig | null>(null);
  const [open, setOpen] = useState(false);
  const [started, setStarted] = useState(false);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let cancelled = false;
    const run = () => getAskConfig().then((value) => !cancelled && setConfig(value));
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(run, { timeout: 3000 });
      return () => {
        cancelled = true;
        window.cancelIdleCallback(id);
      };
    }
    const timer = setTimeout(run, 1500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    requestAnimationFrame(() => button.current?.focus());
  }, []);

  if (!config?.enabled) return null;

  return (
    <>
      <button
        ref={button}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onPointerEnter={loadPanel}
        onFocus={loadPanel}
        onClick={() => {
          setStarted(true);
          setOpen(true);
        }}
        className={`ask-fab fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-4 z-30 flex items-center gap-2.5 rounded-full bg-[#0f172a] py-1.5 pl-1.5 pr-4 font-semibold text-[#ffffff] shadow-[0_10px_30px_rgb(15_23_42/0.28)] ring-1 ring-[#ffffff]/10 transition-[transform,opacity] duration-200 active:scale-95 ${open ? 'pointer-events-none scale-90 opacity-0' : ''
          }`}
      >
        <span className="rounded-full bg-[#1e293b] p-0.5">
          <AvianBot size={36} />
        </span>
        {text.button}
      </button>
      {started && <AskPanel text={text} open={open} remaining={config.remaining} onClose={close} />}
    </>
  );
}