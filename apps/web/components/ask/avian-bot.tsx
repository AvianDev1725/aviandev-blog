import { useId } from 'react';

export type AvianBotState = 'idle' | 'thinking' | 'speaking' | 'happy';

type Props = {
  state?: AvianBotState;
  size?: number;
  bubble?: boolean;
  label?: string;
  className?: string;
};

const feather = 'M60 20 C51 11 53 -1 60 -6 C67 -1 69 11 60 20 Z';
const vane = 'M60 18 L60 -2';

export default function AvianBot({ state = 'idle', size = 48, bubble = false, label, className = '' }: Props) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const head = `${id}-head`;
  const visor = `${id}-visor`;
  const plume = `${id}-plume`;
  const glow = `${id}-glow`;

  return (
    <span
      className={`avian-bot ${className}`}
      data-state={state}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={{ width: size, height: size, fontSize: Math.max(8, size * 0.13) }}
    >
      <svg width={size} height={size} viewBox="0 0 120 120" fill="none">
        <defs>
          <linearGradient id={head} x1="30" y1="15" x2="90" y2="90" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#f8fafc" />
            <stop offset="1" stopColor="#b6c2d1" />
          </linearGradient>
          <linearGradient id={visor} x1="60" y1="34" x2="60" y2="68" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#1e293b" />
            <stop offset="1" stopColor="#020617" />
          </linearGradient>
          <linearGradient id={plume} x1="60" y1="-6" x2="60" y2="20" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#99f6e4" />
            <stop offset="1" stopColor="#0d9488" />
          </linearGradient>
          <filter id={glow} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g className="ab-float">
          <path d="M26 120 C26 99 40 89 60 89 C80 89 94 99 94 120 Z" fill={`url(#${head})`} />
          <path d="M40 120 C40 105 48 98 60 98 C72 98 80 105 80 120" stroke="#94a3b8" strokeOpacity="0.5" strokeWidth="1.5" />
          <circle cx="60" cy="108" r="5.5" fill="#0f172a" />
          <circle className="ab-glow" cx="60" cy="108" r="3" fill="#5eead4" filter={`url(#${glow})`} />
          <rect x="52" y="80" width="16" height="11" rx="3" fill="#475569" />
          <path d="M52 84 H68 M52 87.5 H68" stroke="#94a3b8" strokeWidth="1.2" />

          <g className="ab-head">
            <g className="ab-crest">
              {[-38, 38, 0].map((angle) => (
                <g key={angle} transform={`rotate(${angle} 60 20)`}>
                  <path d={feather} fill={`url(#${plume})`} />
                  <path d={vane} stroke="#0f766e" strokeOpacity="0.45" strokeWidth="1.2" strokeLinecap="round" />
                </g>
              ))}
              <circle className="ab-glow" cx="60" cy="-2" r="2.4" fill="#ccfbf1" filter={`url(#${glow})`} />
            </g>
            <ellipse cx="60" cy="20" rx="7" ry="3.5" fill="#64748b" />

            <circle cx="22" cy="52" r="10.5" fill="#334155" />
            <circle cx="98" cy="52" r="10.5" fill="#334155" />
            <circle className="ab-glow" cx="22" cy="52" r="4.5" stroke="#5eead4" strokeWidth="2" filter={`url(#${glow})`} />
            <circle className="ab-glow" cx="98" cy="52" r="4.5" stroke="#5eead4" strokeWidth="2" filter={`url(#${glow})`} />

            <ellipse cx="60" cy="50" rx="38" ry="33" fill={`url(#${head})`} />
            <ellipse cx="45" cy="28" rx="13" ry="5" fill="#fff" opacity="0.7" transform="rotate(-18 45 28)" />

            <rect x="31" y="35" width="58" height="32" rx="16" fill={`url(#${visor})`} />
            <path d="M38 40 Q60 34 82 40" stroke="#fff" strokeOpacity="0.14" strokeWidth="2" strokeLinecap="round" />

            <g className="ab-eyes" filter={`url(#${glow})`}>
              <g className="ab-ring">
                <g className="ab-eye">
                  <circle cx="48" cy="51" r="6.5" stroke="#5eead4" strokeWidth="3.2" />
                  <circle cx="49.5" cy="49.5" r="1.8" fill="#ccfbf1" />
                </g>
                <g className="ab-eye">
                  <circle cx="72" cy="51" r="6.5" stroke="#5eead4" strokeWidth="3.2" />
                  <circle cx="73.5" cy="49.5" r="1.8" fill="#ccfbf1" />
                </g>
              </g>
              <g className="ab-happy" stroke="#5eead4" strokeWidth="3.2" strokeLinecap="round">
                <path d="M41.5 54 Q48 44 54.5 54" />
                <path d="M65.5 54 Q72 44 78.5 54" />
              </g>
              <rect className="ab-mouth" x="54" y="60.5" width="12" height="2.6" rx="1.3" fill="#5eead4" />
            </g>
          </g>
        </g>
      </svg>

      {bubble && state === 'thinking' && (
        <span className="ab-bubble" aria-hidden>
          <span />
          <span />
          <span />
        </span>
      )}
    </span>
  );
}