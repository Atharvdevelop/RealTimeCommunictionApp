export type Participant = {
  id: string;
  name: string;
  isHost: boolean;
  isMicOn: boolean;
  isCamOn: boolean;
  isScreenSharing: boolean;
  isSpeaking: boolean;
  isPinned: boolean;
  isHandRaised?: boolean;
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
  isHandRaised?: boolean;
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

export type ReactionEvent = {
  id: string;
  emoji: string;
  senderName: string;
  senderId: string;
  timestamp: number;
  xOffset: number;
};

export type VideoFilter = 'none' | 'blur' | 'grayscale' | 'warm' | 'cool' | 'sepia';

export type NetworkQuality = 'excellent' | 'good' | 'fair' | 'poor';

export type NetworkStats = {
  ping: number;        // Round-trip time in ms (from RTCPeerConnection candidate-pair stats)
  packetLoss: number;  // Packet loss in %
  fps: number;         // Incoming video framerate
  quality: NetworkQuality;
  // Extended real stats (undefined when no peer connected yet)
  bitrate?: number;    // Incoming bitrate in kbps
  resolution?: string; // e.g. "1280×720"
  codec?: string;      // e.g. "VP8" | "H264"
};

