export type Participant = {
  id: string;
  name: string;
  isHost: boolean;
  isMicOn: boolean;
  isCamOn: boolean;
  isScreenSharing: boolean;
  isSpeaking: boolean;
  isPinned: boolean;
  avatarColor: string;
  joinedAt: number;
};

export type ChatMessage = {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  createdAt: number;
  isLocal: boolean;
};

export type WhiteboardStroke = {
  prevX: number;
  prevY: number;
  currX: number;
  currY: number;
  color: string;
  size: number;
  tool: WhiteboardTool;
};

export type WhiteboardTool = 'pen' | 'eraser' | 'rect' | 'circle' | 'arrow' | 'text';

export type RemoteCursor = {
  id: string;
  name: string;
  color: string;
  x: number;
  y: number;
};

export type PresenceState = {
  id: string;
  name: string;
  isHost: boolean;
  isMicOn: boolean;
  isCamOn: boolean;
  isScreenSharing: boolean;
  avatarColor: string;
  joinedAt: number;
};

export type SharedFile = {
  id: string;
  name: string;
  size: number;
  url: string;
  senderName: string;
  createdAt: number;
};
