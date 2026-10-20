export const BIRDS = ['owl', 'kingfisher', 'robin', 'heron', 'sparrow', 'parrot', 'penguin', 'flamingo', 'puffin', 'toucan', 'eagle', 'hummingbird'] as const;

export type Bird = (typeof BIRDS)[number];

const BACKGROUNDS: Record<Bird, string> = {
  owl: '#fde68a',
  kingfisher: '#bae6fd',
  robin: '#d9f99d',
  heron: '#e0e7ff',
  sparrow: '#fed7aa',
  parrot: '#fecaca',
  penguin: '#a5f3fc',
  flamingo: '#fef3c7',
  puffin: '#c7d2fe',
  toucan: '#bbf7d0',
  eagle: '#e5e7eb',
  hummingbird: '#f5d0fe',
};

function Drawing({ bird }: { bird: Bird }) {
  switch (bird) {
    case 'owl':
      return (
        <>
        <ellipse cx="32" cy="52" rx="21" ry="18" fill="#92400e"/>
        <ellipse cx="32" cy="56" rx="12" ry="12" fill="#fcd9b6"/>
        <polygon points="15,22 18,7 27,17" fill="#92400e"/>
        <polygon points="49,22 46,7 37,17" fill="#92400e"/>
        <ellipse cx="32" cy="30" rx="18" ry="15" fill="#b45309"/>
        <circle cx="25" cy="29" r="7.5" fill="#fef3c7"/>
        <circle cx="39" cy="29" r="7.5" fill="#fef3c7"/>
        <circle cx="25" cy="29" r="3.8" fill="#1c1917"/>
        <circle cx="39" cy="29" r="3.8" fill="#1c1917"/>
        <circle cx="26.3" cy="27.7" r="1.2" fill="#ffffff"/>
        <circle cx="40.3" cy="27.7" r="1.2" fill="#ffffff"/>
        <polygon points="29.5,34 34.5,34 32,40" fill="#f59e0b"/>
        </>
      );
    case 'kingfisher':
      return (
        <>
        <ellipse cx="29" cy="53" rx="19" ry="15" fill="#f97316"/>
        <ellipse cx="20" cy="52" rx="12" ry="13" fill="#0369a1"/>
        <circle cx="27" cy="28" r="13" fill="#0284c7"/>
        <ellipse cx="30" cy="33" rx="8" ry="3.2" fill="#fdba74"/>
        <ellipse cx="27" cy="39" rx="5.5" ry="3" fill="#ffffff"/>
        <circle cx="31" cy="25" r="2.6" fill="#0c0a09"/>
        <circle cx="31.8" cy="24.2" r="0.9" fill="#ffffff"/>
        <polygon points="37,24 61,28.5 37,31" fill="#1c1917"/>
        </>
      );
    case 'robin':
      return (
        <>
        <ellipse cx="30" cy="52" rx="20" ry="16" fill="#78350f"/>
        <ellipse cx="36" cy="51" rx="12" ry="12" fill="#ea580c"/>
        <circle cx="29" cy="29" r="13" fill="#78350f"/>
        <ellipse cx="36" cy="33" rx="7" ry="6.5" fill="#ea580c"/>
        <circle cx="34" cy="26" r="2.6" fill="#0c0a09"/>
        <circle cx="34.8" cy="25.2" r="0.9" fill="#ffffff"/>
        <polygon points="41,27.5 50,30 41,32.5" fill="#a16207"/>
        </>
      );
    case 'heron':
      return (
        <>
        <ellipse cx="20" cy="57" rx="17" ry="12" fill="#94a3b8"/>
        <path d="M19 52 C 16 38, 25 30, 30 22" stroke="#cbd5e1" strokeWidth="9" fill="none" strokeLinecap="round"/>
        <circle cx="32" cy="20" r="8.5" fill="#e2e8f0"/>
        <path d="M28 14.5 L14 11" stroke="#1e293b" strokeWidth="2.6" strokeLinecap="round"/>
        <path d="M28 16.5 L25 18" stroke="#1e293b" strokeWidth="2" strokeLinecap="round"/>
        <circle cx="34.5" cy="18.5" r="2.3" fill="#facc15"/>
        <circle cx="34.8" cy="18.5" r="1.1" fill="#0c0a09"/>
        <polygon points="39,17.5 59,21 39,23" fill="#eab308"/>
        </>
      );
    case 'sparrow':
      return (
        <>
        <ellipse cx="30" cy="52" rx="20" ry="16" fill="#a16207"/>
        <ellipse cx="37" cy="54" rx="11" ry="11" fill="#e7e5e4"/>
        <ellipse cx="20" cy="51" rx="11" ry="10" fill="#78350f"/>
        <path d="M14 49 L24 47 M15 53 L25 51" stroke="#fde68a" strokeWidth="1.6" strokeLinecap="round"/>
        <circle cx="29" cy="29" r="13" fill="#92400e"/>
        <ellipse cx="35" cy="32" rx="7.5" ry="5.5" fill="#e7e5e4"/>
        <ellipse cx="38" cy="39.5" rx="4.5" ry="3.2" fill="#292524"/>
        <circle cx="34" cy="26" r="2.4" fill="#0c0a09"/>
        <circle cx="34.8" cy="25.2" r="0.85" fill="#ffffff"/>
        <polygon points="41,27.5 48.5,30 41,32.5" fill="#57534e"/>
        </>
      );
    case 'parrot':
      return (
        <>
        <ellipse cx="28" cy="53" rx="19" ry="15" fill="#16a34a"/>
        <ellipse cx="20" cy="53" rx="10" ry="13" fill="#2563eb"/>
        <circle cx="29" cy="28" r="13.5" fill="#22c55e"/>
        <ellipse cx="26" cy="17" rx="8" ry="4.5" fill="#ef4444"/>
        <circle cx="35" cy="27" r="6" fill="#fef9c3"/>
        <circle cx="35" cy="27" r="2.4" fill="#0c0a09"/>
        <circle cx="35.8" cy="26.2" r="0.85" fill="#ffffff"/>
        <path d="M40 23 Q53 23 50 37 Q46 32 40 33 Z" fill="#f97316"/>
        <path d="M40 31 Q45 31 47 35 Q43 36 40 34 Z" fill="#1c1917"/>
        </>
      );
    case 'penguin':
      return (
        <>
        <ellipse cx="32" cy="53" rx="18" ry="18" fill="#1c1917"/>
        <ellipse cx="33" cy="57" rx="11.5" ry="13" fill="#fafaf9"/>
        <circle cx="31" cy="28" r="12.5" fill="#1c1917"/>
        <ellipse cx="32" cy="40.5" rx="8.5" ry="3" fill="#fbbf24"/>
        <circle cx="36" cy="27" r="4.2" fill="#ffffff"/>
        <circle cx="37" cy="27" r="2.1" fill="#0c0a09"/>
        <polygon points="42.5,28.5 50.5,31 42.5,33.5" fill="#f97316"/>
        </>
      );
    case 'flamingo':
      return (
        <>
        <ellipse cx="21" cy="56" rx="17" ry="12" fill="#f472b6"/>
        <path d="M23 51 C 10 40, 19 22, 32 22" stroke="#f9a8d4" strokeWidth="8" fill="none" strokeLinecap="round"/>
        <circle cx="34" cy="21.5" r="7.5" fill="#f9a8d4"/>
        <circle cx="35.5" cy="19.5" r="1.7" fill="#0c0a09"/>
        <path d="M40 18.5 Q51 19.5 50 30 L43 24.5 Z" fill="#f5f5f4"/>
        <path d="M47.3 23.5 Q51 25 50 30 Z" fill="#1c1917"/>
        </>
      );
    case 'puffin':
      return (
        <>
        <ellipse cx="30" cy="53" rx="19" ry="15" fill="#1c1917"/>
        <ellipse cx="35" cy="56" rx="10.5" ry="11" fill="#fafaf9"/>
        <circle cx="29" cy="28" r="13.5" fill="#1c1917"/>
        <ellipse cx="32" cy="28.5" rx="9.5" ry="8.5" fill="#f5f5f4"/>
        <circle cx="33" cy="26" r="3.2" fill="#dc2626"/>
        <circle cx="33" cy="26" r="2" fill="#0c0a09"/>
        <polygon points="40,21 52,28.5 40,36" fill="#f97316"/>
        <polygon points="40,21 45,24 45,33 40,36" fill="#475569"/>
        <path d="M47.5 26 L47.5 31" stroke="#fde047" strokeWidth="1.4" strokeLinecap="round"/>
        </>
      );
    case 'toucan':
      return (
        <>
        <ellipse cx="23" cy="53" rx="17" ry="15" fill="#1c1917"/>
        <circle cx="23" cy="28" r="12.5" fill="#1c1917"/>
        <ellipse cx="28" cy="38.5" rx="7.5" ry="5" fill="#fef9c3"/>
        <circle cx="27" cy="25" r="3.8" fill="#60a5fa"/>
        <circle cx="27.3" cy="25" r="1.8" fill="#0c0a09"/>
        <path d="M31 19 Q58 16 61 30 Q50 35 31 33 Z" fill="#f97316"/>
        <path d="M31 19 Q58 16 61 30 Q50 23 31 24 Z" fill="#facc15"/>
        <circle cx="58.5" cy="29.5" r="2.4" fill="#dc2626"/>
        </>
      );
    case 'eagle':
      return (
        <>
        <ellipse cx="30" cy="54" rx="20" ry="16" fill="#451a03"/>
        <path d="M14 44 Q30 36 46 44 L46 50 Q30 44 14 50 Z" fill="#fafaf9"/>
        <circle cx="29" cy="29" r="13.5" fill="#fafaf9"/>
        <path d="M29.5 22.5 L40 21.5" stroke="#a8a29e" strokeWidth="2" strokeLinecap="round"/>
        <circle cx="35" cy="26" r="2.6" fill="#ca8a04"/>
        <circle cx="35.4" cy="26" r="1.2" fill="#0c0a09"/>
        <path d="M40 23.5 Q52 23.5 50 35 Q47 31 41 31.5 Z" fill="#facc15"/>
        </>
      );
    case 'hummingbird':
      return (
        <>
        <ellipse cx="18" cy="37" rx="6.5" ry="17" transform="rotate(-35 18 37)" fill="#6ee7b7"/>
        <ellipse cx="27" cy="49" rx="12.5" ry="14" fill="#059669"/>
        <ellipse cx="25" cy="60" rx="6" ry="8" fill="#047857"/>
        <circle cx="30" cy="30" r="10.5" fill="#10b981"/>
        <ellipse cx="33" cy="38.5" rx="6.5" ry="4.2" fill="#db2777"/>
        <circle cx="33.5" cy="28" r="2.2" fill="#0c0a09"/>
        <circle cx="34.2" cy="27.3" r="0.8" fill="#ffffff"/>
        <polygon points="39.5,28 61,30.3 39.5,31.6" fill="#1c1917"/>
        </>
      );
  }
}

type Props = { bird: Bird; size?: number };

export function isBird(value: unknown): value is Bird {
  return typeof value === 'string' && (BIRDS as readonly string[]).includes(value);
}

export default function BirdAvatar({ bird, size = 40 }: Props) {
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 overflow-hidden rounded-full"
      style={{ width: size, height: size, background: BACKGROUNDS[bird] }}
    >
      <svg viewBox="0 0 64 64" width={size} height={size}>
        <Drawing bird={bird} />
      </svg>
    </span>
  );
}