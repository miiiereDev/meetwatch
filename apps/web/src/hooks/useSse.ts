import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

interface ActivityMessage {
  sessionId: string;
  item: { kind: 'join' | 'leave'; at: string; displayName: string; studentName: string | null };
}

interface RefreshMessage {
  sessionId?: string;
  kind?: string;
}

/**
 * Subscribes to the API's Server-Sent Events stream and translates pushes
 * into TanStack Query invalidations. EventSource reconnects automatically.
 */
export function useLiveEvents(): { connected: boolean } {
  const queryClient = useQueryClient();
  // Connection state is cosmetic; a failed EventSource retries on its own.
  useEffect(() => {
    const es = new EventSource('/api/events/stream');

    es.addEventListener('activity', (event) => {
      const data = JSON.parse((event as MessageEvent).data) as ActivityMessage;
      queryClient.invalidateQueries({ queryKey: ['session', data.sessionId] });
    });
    es.addEventListener('refresh', (event) => {
      const data = JSON.parse((event as MessageEvent).data) as RefreshMessage;
      if (data.kind === 'roster') {
        queryClient.invalidateQueries({ queryKey: ['roster'] });
      } else if (data.sessionId) {
        queryClient.invalidateQueries({ queryKey: ['session', data.sessionId] });
      } else {
        queryClient.invalidateQueries();
      }
    });
    es.addEventListener('sessions', () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      queryClient.invalidateQueries({ queryKey: ['session'] });
    });
    es.addEventListener('provider', () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    });

    return () => es.close();
  }, [queryClient]);

  return { connected: true };
}
