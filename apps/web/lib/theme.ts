export type Theme = 'light' | 'dark';

export const THEME_KEY = 'theme';
export const THEME_COLORS: Record<Theme, string> = { light: '#ffffff', dark: '#0f0f12' };

/** Dark from 6:30 PM to 6:30 AM, India time (UTC+5:30, no daylight saving). */
const IST_OFFSET_MINUTES = 330;
export const NIGHT_START = 18 * 60 + 30; // 6:30 PM
export const NIGHT_END = 6 * 60 + 30; // 6:30 AM

/** Minutes since midnight in India. */
function indiaMinutes(now = Date.now()) {
  return (now / 60_000 + IST_OFFSET_MINUTES) % 1440;
}

export function autoTheme(now = Date.now()): Theme {
  const minutes = indiaMinutes(now);
  return minutes >= NIGHT_START || minutes < NIGHT_END ? 'dark' : 'light';
}

/** Milliseconds until the next 6:30 switch. */
export function msUntilSwitch(now = Date.now()) {
  const minutes = indiaMinutes(now);
  const next = minutes < NIGHT_END ? NIGHT_END : minutes < NIGHT_START ? NIGHT_START : NIGHT_END + 1440;
  return Math.ceil((next - minutes) * 60_000);
}

export function savedTheme(): Theme | null {
  try {
    const value = localStorage.getItem(THEME_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

export function currentTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme]);
}

/** Choosing what the clock already shows clears the saved choice, so auto takes over again. */
export function chooseTheme(theme: Theme) {
  try {
    if (theme === autoTheme()) localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, theme);
  } catch {}

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reduceMotion && 'startViewTransition' in document) {
    document.startViewTransition(() => applyTheme(theme));
  } else {
    applyTheme(theme);
  }
}

/**
 * Runs in <head> before the page paints, so there's no white flash at night.
 * Kept tiny and self-contained because it's inlined into every page.
 */
export const themeScript = `(function(){try{var t=null;try{t=localStorage.getItem('${THEME_KEY}')}catch(e){}if(t!=='light'&&t!=='dark'){var m=(Date.now()/6e4+${IST_OFFSET_MINUTES})%1440;t=(m>=${NIGHT_START}||m<${NIGHT_END})?'dark':'light'}var d=document.documentElement;d.dataset.theme=t;d.style.colorScheme=t;var c=document.querySelector('meta[name="theme-color"]');if(c)c.setAttribute('content',t==='dark'?'${THEME_COLORS.dark}':'${THEME_COLORS.light}')}catch(e){}})();`;