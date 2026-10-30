'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

// Remembers the token after it's removed from the address bar, so it isn't lost
// if the form is re-created. It only lives in memory for this page visit.
let rememberedToken = '';

export function useLinkToken() {
  const searchParams = useSearchParams();
  const fromUrl = searchParams.get('token');
  if (fromUrl) rememberedToken = fromUrl;

  const [token] = useState(() => fromUrl ?? rememberedToken);

  useEffect(() => {
    if (searchParams.has('token')) window.history.replaceState(null, '', window.location.pathname);
  }, [searchParams]);

  return token;
}