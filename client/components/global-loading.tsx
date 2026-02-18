'use client';

import { useAppSelector } from '@/lib/store';
import { api } from '@/lib/services/api';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

export function GlobalLoading() {
  const [isLoading, setIsLoading] = useState(false);
  
  // RTK Query keeps track of all queries in the state.
  // We can check if any query is in 'pending' state.
  const apiState = useAppSelector((state) => (state as any)[api.reducerPath]);
  
  useEffect(() => {
    // Check pending queries or mutations
    const hasPending = Object.values(apiState?.queries || {}).some(
        (query: any) => query?.status === 'pending'
    ) || Object.values(apiState?.mutations || {}).some(
        (mutation: any) => mutation?.status === 'pending'
    );
     
    // Small debounce to avoid flickering for fast requests
    let timeout: NodeJS.Timeout;
    if (hasPending) {
         setIsLoading(true);
    } else {
         timeout = setTimeout(() => setIsLoading(false), 300);
    }

    return () => clearTimeout(timeout);
  }, [apiState]);

  if (!isLoading) return null;

  return (
    <div className="fixed top-4 right-4 z-[9999] bg-white/90 backdrop-blur-sm border border-black/10 rounded-full px-3 py-1.5 shadow-lg flex items-center gap-2 animate-in fade-in zoom-in duration-200">
      <Loader2 className="h-4 w-4 animate-spin text-black" />
      <span className="text-xs font-medium text-black">Updating...</span>
    </div>
  );
}
