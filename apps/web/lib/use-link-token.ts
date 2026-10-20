'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export function useLinkToken() {
  const searchParams = useSearchParams();
  const [token] = useState(() => searchParams.get('token') ?? '');

  useEffect(() => {
    if (searchParams.has('token')) window.history.replaceState(null, '', window.location.pathname);
  }, [searchParams]);

  return token;
}