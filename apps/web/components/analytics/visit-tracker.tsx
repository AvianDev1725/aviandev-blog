'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { getSession } from '@/lib/client';

const FIRST_VISIT = 'aviandev-first-visit';
const VISIT_STARTED = 'aviandev-visit-started';

let lastTracked = { path: '', at: 0 };

function newId() {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function optedOut() {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  return nav.globalPrivacyControl === true || navigator.doNotTrack === '1';
}

function isReturning() {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const first = localStorage.getItem(FIRST_VISIT);
    if (!first) {
      localStorage.setItem(FIRST_VISIT, today);
      return false;
    }
    return first < today;
  } catch {
    return false;
  }
}

function isLanding() {
  try {
    if (sessionStorage.getItem(VISIT_STARTED)) return false;
    sessionStorage.setItem(VISIT_STARTED, '1');
    return true;
  } catch {
    return true;
  }
}

function externalReferrer() {
  try {
    if (!document.referrer) return '';
    return new URL(document.referrer).host === location.host ? '' : document.referrer.slice(0, 500);
  } catch {
    return '';
  }
}

function send(path: string, body: object, beacon = false) {
  const json = JSON.stringify(body);
  if (beacon && 'sendBeacon' in navigator) {
    navigator.sendBeacon(path, new Blob([json], { type: 'application/json' }));
    return;
  }
  fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: json, keepalive: true }).catch(() => {});
}

async function signedIn() {
  try {
    const session: unknown = await getSession();
    if (!session || typeof session !== 'object') return false;
    return 'user' in session ? Boolean((session as { user: unknown }).user) : true;
  } catch {
    return false;
  }
}

export default function VisitTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname || pathname.startsWith('/preview') || optedOut()) return;
    const now = Date.now();
    if (lastTracked.path === pathname && now - lastTracked.at < 1500) return;
    lastTracked = { path: pathname, at: now };

    const id = newId();
    const landing = isLanding();
    const utmSource = landing ? (new URLSearchParams(location.search).get('utm_source') ?? '').slice(0, 100) : '';

    signedIn().then((isSignedIn) =>
      send('/api/track', {
        id,
        path: pathname.slice(0, 300),
        landing,
        returning: isReturning(),
        signedIn: isSignedIn,
        referrer: landing ? externalReferrer() : '',
        utmSource,
      }),
    );

    const isPost = pathname.startsWith('/posts/');
    let depth = 0;
    let sent = 0;

    const measure = () => {
      const body = document.querySelector('.post-body');
      if (!body) return;
      const rect = body.getBoundingClientRect();
      if (rect.height <= 0) return;
      const seen = Math.min(rect.height, Math.max(0, window.innerHeight - rect.top));
      depth = Math.max(depth, Math.round((seen / rect.height) * 100));
    };
    const flush = () => {
      if (!isPost || depth <= sent) return;
      sent = depth;
      send('/api/track/depth', { id, depth }, true);
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };

    if (isPost) {
      requestAnimationFrame(measure);
      window.addEventListener('scroll', measure, { passive: true });
      document.addEventListener('visibilitychange', onVisibility);
      window.addEventListener('pagehide', flush);
    }

    return () => {
      if (!isPost) return;
      measure();
      flush();
      window.removeEventListener('scroll', measure);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', flush);
    };
  }, [pathname]);

  return null;
}