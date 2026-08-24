import { RealtimeChannel } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import type { PresenceState, RemoteCursor, WhiteboardStroke } from '@/lib/types';
import { generateId, pickAvatarColor } from '@/lib/utils';

type RoomContextValue = {
  roomId: string | null;
  roomCode: string | null;
  roomDbId: string | null;
  userId: string;
  userName: string;
  avatarColor: string;
  channel: RealtimeChannel | null;
  participants: PresenceState[];
  remoteCursors: Record<string, RemoteCursor>;
  setUserName: (name: string) => void;
  joinRoom: (roomCode: string, dbId: string, name: string) => void;
  leaveRoom: () => void;
  updatePresence: (patch: Partial<PresenceState>) => void;
  broadcastCursor: (cursor: Omit<RemoteCursor, 'id' | 'name' | 'color'>) => void;
  broadcastStroke: (stroke: WhiteboardStroke) => void;
  clearWhiteboard: () => void;
  onStroke: (cb: (stroke: WhiteboardStroke) => void) => () => void;
  onClear: (cb: () => void) => () => void;
  isHost: boolean;
};

const RoomContext = createContext<RoomContextValue | null>(null);

export function useRoom() {
  const ctx = useContext(RoomContext);
  if (!ctx) throw new Error('useRoom must be used within RoomProvider');
  return ctx;
}

export function RoomProvider({ children }: { children: ReactNode }) {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [roomDbId, setRoomDbId] = useState<string | null>(null);
  const [userId] = useState(() => generateId());
  const [userName, setUserNameState] = useState('');
  const [avatarColor] = useState(() => pickAvatarColor(userId));
  const [participants, setParticipants] = useState<PresenceState[]>([]);
  const [remoteCursors, setRemoteCursors] = useState<Record<string, RemoteCursor>>({});
  const [isHost, setIsHost] = useState(false);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const presenceRef = useRef<PresenceState | null>(null);
  const strokeCallbacks = useRef<Set<(s: WhiteboardStroke) => void>>(new Set());
  const clearCallbacks = useRef<Set<() => void>>(new Set());
  const userIdRef = useRef(userId);

  const setUserName = useCallback((name: string) => {
    setUserNameState(name);
  }, []);

  const updatePresence = useCallback((patch: Partial<PresenceState>) => {
    if (!channelRef.current || !presenceRef.current) return;
    presenceRef.current = { ...presenceRef.current, ...patch };
    channelRef.current.track(presenceRef.current);
  }, []);

  const joinRoom = useCallback((code: string, dbId: string, name: string) => {
    if (channelRef.current) return;
    setRoomId(dbId);
    setRoomCode(code);
    setRoomDbId(dbId);
    setUserNameState(name);

    const presence: PresenceState = {
      id: userIdRef.current,
      name,
      isHost: true,
      isMicOn: true,
      isCamOn: true,
      isScreenSharing: false,
      avatarColor,
      joinedAt: Date.now(),
    };
    presenceRef.current = presence;

    const ch = supabase.channel(`room:${dbId}`, {
      config: { presence: { key: userIdRef.current } },
    });

    ch.on('presence', { event: 'sync' }, () => {
      const state = ch.presenceState() as Record<string, PresenceState[]>;
      const list = Object.values(state)
        .flat()
        .sort((a, b) => a.joinedAt - b.joinedAt);
      // First joiner is host
      if (list.length > 0 && list[0].id === userIdRef.current) {
        setIsHost(true);
        presenceRef.current = { ...presenceRef.current!, isHost: true };
        ch.track(presenceRef.current);
      } else {
        setIsHost(false);
      }
      setParticipants(list);
    });

    ch.on('broadcast', { event: 'stroke' }, (payload: { payload: WhiteboardStroke }) => {
      const stroke = payload.payload as WhiteboardStroke;
      strokeCallbacks.current.forEach((cb) => cb(stroke));
    });

    ch.on('broadcast', { event: 'clear' }, () => {
      clearCallbacks.current.forEach((cb) => cb());
    });

    ch.on('broadcast', { event: 'cursor' }, (payload: { payload: RemoteCursor }) => {
      const cursor = payload.payload as RemoteCursor;
      if (cursor.id === userIdRef.current) return;
      setRemoteCursors((prev) => ({ ...prev, [cursor.id]: cursor }));
    });

    ch.subscribe(async (status: string) => {
      if (status === 'SUBSCRIBED') {
        await ch.track(presence);
      }
    });

    channelRef.current = ch;
  }, [avatarColor]);

  const leaveRoom = useCallback(() => {
    if (channelRef.current) {
      channelRef.current.untrack();
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    presenceRef.current = null;
    setRoomId(null);
    setRoomCode(null);
    setRoomDbId(null);
    setParticipants([]);
    setRemoteCursors({});
    setIsHost(false);
  }, []);

  const broadcastCursor = useCallback(
    (cursor: Omit<RemoteCursor, 'id' | 'name' | 'color'>) => {
      if (!channelRef.current) return;
      channelRef.current.send({
        type: 'broadcast',
        event: 'cursor',
        payload: { id: userIdRef.current, name: userName, color: avatarColor, ...cursor },
      });
    },
    [userName, avatarColor]
  );

  const broadcastStroke = useCallback((stroke: WhiteboardStroke) => {
    if (!channelRef.current) return;
    channelRef.current.send({ type: 'broadcast', event: 'stroke', payload: stroke });
  }, []);

  const clearWhiteboard = useCallback(() => {
    if (!channelRef.current) return;
    channelRef.current.send({ type: 'broadcast', event: 'clear', payload: {} });
    clearCallbacks.current.forEach((cb) => cb());
  }, []);

  const onStroke = useCallback((cb: (stroke: WhiteboardStroke) => void) => {
    strokeCallbacks.current.add(cb);
    return () => { strokeCallbacks.current.delete(cb); };
  }, []);

  const onClear = useCallback((cb: () => void) => {
    clearCallbacks.current.add(cb);
    return () => { clearCallbacks.current.delete(cb); };
  }, []);

  useEffect(() => {
    return () => {
      if (channelRef.current) {
        channelRef.current.untrack();
        supabase.removeChannel(channelRef.current);
      }
    };
  }, []);

  return (
    <RoomContext.Provider
      value={{
        roomId,
        roomCode,
        roomDbId,
        userId,
        userName,
        avatarColor,
        channel: channelRef.current,
        participants,
        remoteCursors,
        setUserName,
        joinRoom,
        leaveRoom,
        updatePresence,
        broadcastCursor,
        broadcastStroke,
        clearWhiteboard,
        onStroke,
        onClear,
        isHost,
      }}
    >
      {children}
    </RoomContext.Provider>
  );
}
