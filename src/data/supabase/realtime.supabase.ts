import { supabase } from './client';
import type { RealtimeGateway } from '../realtime';

export const supabaseRealtime: RealtimeGateway = {
  subscribe(subscriptions) {
    let channel = supabase.channel('app-realtime-channel');
    for (const { table, onChange } of subscriptions) {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        (payload: any) =>
          onChange({ type: payload.eventType, record: payload.new, old: payload.old })
      );
    }
    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  },
};
