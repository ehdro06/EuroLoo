'use client';

import { useAppSelector, type RootState } from '@/lib/store';
import { api } from '@/lib/services/api';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

type RequestState = { status?: string } | undefined;

const selectHasPending = (state: RootState) => {
  const apiState = state[api.reducerPath];
  const isPending = (entry: RequestState) => entry?.status === 'pending';
  return (
    Object.values(apiState.queries).some(isPending) ||
    Object.values(apiState.mutations).some(isPending)
  );
};

export function GlobalLoading() {
  // RTK Query keeps track of all queries/mutations in the store.
  const hasPending = useAppSelector(selectHasPending);

  // Keep the indicator visible briefly after requests finish to avoid flickering.
  const [prevHasPending, setPrevHasPending] = useState(hasPending);
  const [lingering, setLingering] = useState(false);
  if (prevHasPending !== hasPending) {
    setPrevHasPending(hasPending);
    if (!hasPending) setLingering(true);
  }

  useEffect(() => {
    if (!lingering) return;
    const timeout = setTimeout(() => setLingering(false), 300);
    return () => clearTimeout(timeout);
  }, [lingering]);

  if (!hasPending && !lingering) return null;

  return (
    <div className="fixed top-4 right-4 z-[9999] bg-white/90 backdrop-blur-sm border border-black/10 rounded-full px-3 py-1.5 shadow-lg flex items-center gap-2 animate-in fade-in zoom-in duration-200">
      <Loader2 className="h-4 w-4 animate-spin text-black" />
      <span className="text-xs font-medium text-black">Updating...</span>
    </div>
  );
}
