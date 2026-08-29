import { createContext } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { PresenceState, RemoteCursor, WhiteboardStroke, ReactionEvent } from '@/lib/types';

export type AdminEventHandlers = {
  onMuted?: () => void;
  onKicked?: (reason?: string) => void;
  onMeetingEnded?: () => void;
  onHostTransferred?: (isNewHost: boolean) => void;
};

export type RoomContextValue = {
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
  isHandRaised: boolean;
  setUserName: (name: string) => void;
  joinRoom: (roomCode: string, dbId: string, name: string, isCreator?: boolean) => void;
  leaveRoom: () => void;
  updatePresence: (patch: Partial<PresenceState>) => void;
  broadcastCursor: (cursor: Omit<RemoteCursor, 'id' | 'name' | 'color'>) => void;
  broadcastStroke: (stroke: WhiteboardStroke) => void;
  clearWhiteboard: () => void;
  onStroke: (cb: (stroke: WhiteboardStroke) => void) => () => void;
  onClear: (cb: () => void) => () => void;
  sendReaction: (emoji: string) => void;
  onReaction: (cb: (reaction: ReactionEvent) => void) => () => void;
  toggleHandRaise: () => void;
  registerAdminHandlers: (handlers: AdminEventHandlers) => () => void;
  // Host / Admin actions
  muteParticipant: (targetId: string) => void;
  muteAllParticipants: () => void;
  kickParticipant: (targetId: string, reason?: string) => void;
  transferHost: (targetId: string) => void;
  endMeetingForAll: () => void;
  toggleLockMeeting: (locked?: boolean) => void;
};

export const RoomContext = createContext<RoomContextValue | null>(null);
