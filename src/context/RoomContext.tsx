import { RealtimeChannel } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import type { PresenceState, RemoteCursor, WhiteboardStroke } from '@/lib/types';
import { generateId, pickAvatarColor } from '@/lib/utils';

type AdminEventHandlers = {
  onMuted?: () => void;
  onKicked?: (reason?: string) => void;
  onMeetingEnded?: () => void;
  onHostTransferred?: (isNewHost: boolean) => void;
};

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
  isHost: boolean;
  isLocked: boolean;
  setUserName: (name: string) => void;
  joinRoom: (roomCode: string, dbId: string, name: string, isCreator?: boolean) => void;
  leaveRoom: () => void;
  updatePresence: (patch: Partial<PresenceState>) => void;
  broadcastCursor: (cursor: Omit<RemoteCursor, 'id' | 'name' | 'color'>) => void;
  broadcastStroke: (stroke: WhiteboardStroke) => void;
  clearWhiteboard: () => void;
  onStroke: (cb: (stroke: WhiteboardStroke) => void) => () => void;
  onClear: (cb: () => void) => () => void;
  registerAdminHandlers: (handlers: AdminEventHandlers) => () => void;
  // Host / Admin actions
  muteParticipant: (targetId: string) => void;
  muteAllParticipants: () => void;
  kickParticipant: (targetId: string, name?: string) => void;
  transferHost: (targetId: string) => void;
  endMeetingForAll: () => void;
  toggleLockMeeting: (locked?: boolean) => void;
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
  const [isLocked, setIsLocked] = useState(false);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const presenceRef = useRef<PresenceState | null>(null);
  const strokeCallbacks = useRef<Set<(s: WhiteboardStroke) => void>>(new Set());
  const clearCallbacks = useRef<Set<() => void>>(new Set());
  const adminHandlersRef = useRef<AdminEventHandlers>({});
  const userIdRef = useRef(userId);
  userIdRef.current = userId;

  const setUserName = useCallback((name: string) => {
    setUserNameState(name);
  }, []);

  const registerAdminHandlers = useCallback((handlers: AdminEventHandlers) => {
    adminHandlersRef.current = handlers;
    return () => {
      adminHandlersRef.current = {};
    };
  }, []);

  const updatePresence = useCallback((patch: Partial<PresenceState>) => {
    if (!channelRef.current || !presenceRef.current) return;
    presenceRef.current = { ...presenceRef.current, ...patch };
    channelRef.current.track(presenceRef.current);
  }, []);

  const joinRoom = useCallback((code: string, dbId: string, name: string, isCreator: boolean = false) => {
    if (channelRef.current) return;
    setRoomId(dbId);
    setRoomCode(code);
    setRoomDbId(dbId);
    setUserNameState(name);
    setIsHost(isCreator);

    const presence: PresenceState = {
      id: userIdRef.current,
      name,
      isHost: isCreator,
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
      const rawList = Object.values(state)
        .flat()
        // Deduplicate by participant ID
        .reduce<PresenceState[]>((acc, curr) => {
          if (!acc.some((p) => p.id === curr.id)) {
            acc.push(curr);
          }
          return acc;
        }, [])
        .sort((a, b) => a.joinedAt - b.joinedAt);

      if (rawList.length === 0) {
        setParticipants([]);
        return;
      }

      // Determine single true host
      // 1. Check if any participant is already marked isHost
      let hostParticipant = rawList.find((p) => p.isHost);
      // 2. If no host exists (e.g. host disconnected or none set), earliest joiner becomes host
      if (!hostParticipant && rawList.length > 0) {
        hostParticipant = rawList[0];
      }

      const activeHostId = hostParticipant ? hostParticipant.id : rawList[0]?.id;

      // Normalize participants list so ONLY activeHostId has isHost: true
      const normalizedList = rawList.map((p) => ({
        ...p,
        isHost: p.id === activeHostId,
      }));

      const amIHost = activeHostId === userIdRef.current;
      setIsHost(amIHost);

      if (presenceRef.current && presenceRef.current.isHost !== amIHost) {
        presenceRef.current = { ...presenceRef.current, isHost: amIHost };
        ch.track(presenceRef.current);
      }

      setParticipants(normalizedList);
    });

    // Whiteboard strokes & cursors
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

    // Admin commands handling
    ch.on('broadcast', { event: 'admin:mute-user' }, (payload: { payload: { targetId: string } }) => {
      if (payload.payload?.targetId === userIdRef.current) {
        adminHandlersRef.current.onMuted?.();
      }
    });

    ch.on('broadcast', { event: 'admin:mute-all' }, (payload: { payload: { hostId: string } }) => {
      if (payload.payload?.hostId !== userIdRef.current) {
        adminHandlersRef.current.onMuted?.();
      }
    });

    ch.on('broadcast', { event: 'admin:kick-user' }, (payload: { payload: { targetId: string; reason?: string } }) => {
      if (payload.payload?.targetId === userIdRef.current) {
        adminHandlersRef.current.onKicked?.(payload.payload?.reason);
      }
    });

    ch.on('broadcast', { event: 'admin:transfer-host' }, (payload: { payload: { newHostId: string } }) => {
      const amINewHost = payload.payload?.newHostId === userIdRef.current;
      setIsHost(amINewHost);
      if (presenceRef.current) {
        presenceRef.current = { ...presenceRef.current, isHost: amINewHost };
        ch.track(presenceRef.current);
      }
      adminHandlersRef.current.onHostTransferred?.(amINewHost);
    });

    ch.on('broadcast', { event: 'admin:end-meeting' }, () => {
      adminHandlersRef.current.onMeetingEnded?.();
    });

    ch.on('broadcast', { event: 'admin:lock-meeting' }, (payload: { payload: { isLocked: boolean } }) => {
      setIsLocked(Boolean(payload.payload?.isLocked));
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
    setIsLocked(false);
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

  // Admin Host Operations
  const muteParticipant = useCallback((targetId: string) => {
    if (!channelRef.current) return;
    channelRef.current.send({
      type: 'broadcast',
      event: 'admin:mute-user',
      payload: { targetId },
    });
  }, []);

  const muteAllParticipants = useCallback(() => {
    if (!channelRef.current) return;
    channelRef.current.send({
      type: 'broadcast',
      event: 'admin:mute-all',
      payload: { hostId: userIdRef.current },
    });
  }, []);

  const kickParticipant = useCallback((targetId: string, name?: string) => {
    if (!channelRef.current) return;
    channelRef.current.send({
      type: 'broadcast',
      event: 'admin:kick-user',
      payload: { targetId, reason: `Removed by host` },
    });
  }, []);

  const transferHost = useCallback((targetId: string) => {
    if (!channelRef.current) return;
    channelRef.current.send({
      type: 'broadcast',
      event: 'admin:transfer-host',
      payload: { newHostId: targetId },
    });
    setIsHost(false);
    if (presenceRef.current) {
      presenceRef.current = { ...presenceRef.current, isHost: false };
      channelRef.current.track(presenceRef.current);
    }
  }, []);

  const endMeetingForAll = useCallback(() => {
    if (!channelRef.current) return;
    channelRef.current.send({
      type: 'broadcast',
      event: 'admin:end-meeting',
      payload: { hostId: userIdRef.current },
    });
    leaveRoom();
  }, [leaveRoom]);

  const toggleLockMeeting = useCallback((locked?: boolean) => {
    if (!channelRef.current) return;
    const nextState = locked !== undefined ? locked : !isLocked;
    setIsLocked(nextState);
    channelRef.current.send({
      type: 'broadcast',
      event: 'admin:lock-meeting',
      payload: { isLocked: nextState },
    });
  }, [isLocked]);

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
        registerAdminHandlers,
        isHost,
        isLocked,
        muteParticipant,
        muteAllParticipants,
        kickParticipant,
        transferHost,
        endMeetingForAll,
        toggleLockMeeting,
      }}
    >
      {children}
    </RoomContext.Provider>
  );
}
