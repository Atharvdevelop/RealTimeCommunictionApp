import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl.startsWith('http') &&
  !supabaseUrl.includes('placeholder')
);

export type Room = {
  id: string;
  code: string;
  password: string | null;
  host_name: string;
  created_at: string;
};

export type Message = {
  id: string;
  room_id: string;
  sender_id: string;
  sender_name: string;
  content: string;
  created_at: string;
};

// In-Memory / LocalStorage Mock Client for Zero-Config Local Testing
class MockRealtimeChannel {
  name: string;
  private bc: BroadcastChannel | null = null;
  private listeners: { type: string; event?: string; cb: (payload: any) => void }[] = [];
  private currentPresence: any = null;

  constructor(name: string) {
    this.name = name;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.bc = new BroadcastChannel(`pulsemeet_${name}`);
        this.bc.onmessage = (e) => {
          const msg = e.data;
          if (!msg) return;
          if (msg.type === 'broadcast') {
            this.listeners
              .filter((l) => l.type === 'broadcast' && (!l.event || l.event === msg.event))
              .forEach((l) => l.cb({ payload: msg.payload }));
          } else if (msg.type === 'postgres_changes') {
            this.listeners
              .filter((l) => l.type === 'postgres_changes')
              .forEach((l) => l.cb(msg.payload));
          } else if (msg.type === 'presence_sync') {
            this.listeners
              .filter((l) => l.type === 'presence')
              .forEach((l) => l.cb({}));
          }
        };
      } catch {
        this.bc = null;
      }
    }
  }

  on(type: string, filterOrEvent: any, cb?: (payload: any) => void): this {
    if (typeof filterOrEvent === 'function') {
      this.listeners.push({ type, cb: filterOrEvent });
    } else if (typeof filterOrEvent === 'object' && filterOrEvent.event) {
      this.listeners.push({ type, event: filterOrEvent.event, cb: cb || (() => {}) });
    } else if (typeof filterOrEvent === 'string') {
      this.listeners.push({ type, event: filterOrEvent, cb: cb || (() => {}) });
    }
    return this;
  }

  subscribe(cb?: (status: string) => void): this {
    setTimeout(() => {
      if (cb) cb('SUBSCRIBED');
      this.listeners.filter((l) => l.type === 'presence').forEach((l) => l.cb({}));
    }, 10);
    return this;
  }

  async track(presence: any): Promise<'ok'> {
    this.currentPresence = presence;
    if (typeof window !== 'undefined') {
      try {
        const key = `pm_presence_${this.name}_${presence.id}`;
        localStorage.setItem(key, JSON.stringify({ ...presence, _updatedAt: Date.now() }));
      } catch {
        // ignore
      }
    }
    if (this.bc) {
      this.bc.postMessage({ type: 'presence_sync', payload: presence });
    }
    // trigger local
    this.listeners.filter((l) => l.type === 'presence').forEach((l) => l.cb({}));
    return 'ok';
  }

  untrack(): void {
    if (this.currentPresence && typeof window !== 'undefined') {
      try {
        const key = `pm_presence_${this.name}_${this.currentPresence.id}`;
        localStorage.removeItem(key);
      } catch {
        // ignore
      }
      this.currentPresence = null;
    }
    if (this.bc) {
      this.bc.postMessage({ type: 'presence_sync' });
    }
  }

  send(message: { type: string; event: string; payload: any }): void {
    if (this.bc) {
      this.bc.postMessage(message);
    }
    // Also trigger own broadcast listeners
    this.listeners
      .filter((l) => l.type === 'broadcast' && l.event === message.event)
      .forEach((l) => l.cb({ payload: message.payload }));
  }

  presenceState(): Record<string, any[]> {
    const list: any[] = [];
    if (this.currentPresence) {
      list.push(this.currentPresence);
    }
    if (typeof window !== 'undefined') {
      try {
        const prefix = `pm_presence_${this.name}_`;
        const now = Date.now();
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(prefix)) {
            const raw = localStorage.getItem(key);
            if (raw) {
              const item = JSON.parse(raw);
              if (now - (item._updatedAt || 0) < 1000 * 60 * 60) {
                if (!list.some((p) => p.id === item.id)) {
                  list.push(item);
                }
              }
            }
          }
        }
      } catch {
        // ignore
      }
    }
    return { current: list };
  }

  destroy(): void {
    this.untrack();
    if (this.bc) {
      this.bc.close();
      this.bc = null;
    }
    this.listeners = [];
  }
}

const mockChannels = new Map<string, MockRealtimeChannel>();

const createMockClient = () => {
  return {
    from: (table: string) => {
      let filterCol: string | null = null;
      let filterVal: any = null;

      const builder = {
        select: (_cols?: string) => builder,
        order: (_col: string, _opts?: any) => builder,
        eq: (col: string, val: any) => {
          filterCol = col;
          filterVal = val;
          return builder;
        },
        maybeSingle: async () => {
          if (table === 'rooms') {
            try {
              const saved = localStorage.getItem(`pm_room_${filterVal}`);
              if (saved) {
                return { data: JSON.parse(saved), error: null };
              }
            } catch {
              // ignore
            }
            // Auto-create room if joining with a code in demo mode
            const mockRoom: Room = {
              id: `room_${filterVal || 'default'}`,
              code: filterVal || 'pulse-demo',
              password: null,
              host_name: 'Host',
              created_at: new Date().toISOString(),
            };
            return { data: mockRoom, error: null };
          }
          return { data: null, error: null };
        },
        insert: async (data: any) => {
          if (table === 'rooms') {
            const room: Room = {
              id: `room_${data.code || Math.random().toString(36).slice(2)}`,
              code: data.code,
              password: data.password || null,
              host_name: data.host_name || 'Host',
              created_at: new Date().toISOString(),
            };
            try {
              localStorage.setItem(`pm_room_${data.code}`, JSON.stringify(room));
            } catch {
              // ignore
            }
            return { data: room, error: null };
          }
          if (table === 'messages') {
            const msg: Message = {
              id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              room_id: data.room_id,
              sender_id: data.sender_id,
              sender_name: data.sender_name,
              content: data.content,
              created_at: new Date().toISOString(),
            };
            try {
              const prev = JSON.parse(localStorage.getItem(`pm_msgs_${data.room_id}`) || '[]');
              prev.push(msg);
              localStorage.setItem(`pm_msgs_${data.room_id}`, JSON.stringify(prev.slice(-100)));
            } catch {
              // ignore
            }
            // Broadcast insert event
            const ch = mockChannels.get(`messages:${data.room_id}`);
            if (ch) {
              const bc = new BroadcastChannel(`pulsemeet_messages:${data.room_id}`);
              bc.postMessage({
                type: 'postgres_changes',
                payload: { new: msg, eventType: 'INSERT' },
              });
              bc.close();
            }
            return { data: msg, error: null };
          }
          return { data: null, error: null };
        },
        then: (resolve: (res: { data: any[]; error: null }) => void) => {
          if (table === 'messages') {
            try {
              const msgs = JSON.parse(localStorage.getItem(`pm_msgs_${filterVal}`) || '[]');
              resolve({ data: msgs, error: null });
            } catch {
              resolve({ data: [], error: null });
            }
          } else {
            resolve({ data: [], error: null });
          }
        },
      };
      return builder;
    },
    channel: (name: string, _config?: any) => {
      let ch = mockChannels.get(name);
      if (!ch) {
        ch = new MockRealtimeChannel(name);
        mockChannels.set(name, ch);
      }
      return ch;
    },
    removeChannel: (channel: any) => {
      if (channel && channel.name) {
        const ch = mockChannels.get(channel.name);
        if (ch) {
          ch.destroy();
          mockChannels.delete(channel.name);
        }
      }
    },
    storage: {
      from: (_bucket: string) => ({
        upload: async (_path: string, _file: File) => {
          return { data: { path: _path }, error: null };
        },
        getPublicUrl: (path: string) => {
          return { data: { publicUrl: path } };
        },
      }),
    },
  };
};

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: { persistSession: false },
      realtime: { params: { eventsPerSecond: 50 } },
    })
  : (createMockClient() as any);
