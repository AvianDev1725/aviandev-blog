'use client';

import { fill } from '@aviandev/core/text';
import BirdAvatar, { BIRDS, type Bird } from '@/components/bird-avatar';
import type { CommentText } from '@/app/text';
import { guestName } from './guest-name';

type Props = { name: string; value: Bird | null; onChange: (bird: Bird) => void; text: CommentText };

export default function BirdPicker({ name, value, onChange, text }: Props) {
  return (
    <fieldset>
      <legend className="text-sm font-medium text-zinc-800">{text.chooseBird}</legend>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {BIRDS.map((bird) => {
          const selected = value === bird;
          return (
            <label
              key={bird}
              className={`cursor-pointer rounded-full p-0.5 ring-2 transition-shadow has-[:focus-visible]:ring-zinc-900 ${
                selected ? 'ring-zinc-900' : 'ring-transparent active:ring-zinc-300 sm:hover:ring-zinc-300'
              }`}
            >
              <input
                type="radio"
                name={name}
                value={bird}
                checked={selected}
                onChange={() => onChange(bird)}
                className="sr-only"
              />
              <BirdAvatar bird={bird} size={40} />
              <span className="sr-only">{guestName(text, bird)}</span>
            </label>
          );
        })}
      </div>
      {value && <p className="mt-2 text-sm text-zinc-600">{fill(text.commentingAs, { name: guestName(text, value) })}</p>}
    </fieldset>
  );
}