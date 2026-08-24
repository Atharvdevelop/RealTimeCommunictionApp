import { useEffect, useRef, useState, useCallback } from 'react';
import { Video, Copy, Check, Clock } from 'lucide-react';
import { useRoom } from '@/context/RoomContext';
import { useMedia } from '@/hooks/useMedia';
import { supabase } from '@/lib/supabase';
import { VideoTile } from '@/components/VideoTile';
import { ControlDock } from '@/components/ControlDock';
import { ChatDrawer } from '@/components/ChatDrawer';
import { ParticipantsDrawer } from '@/components/ParticipantsDrawer';
import { Whiteboard } from '@/components/Whiteboard';
import { cn } from '@/lib/utils';
import type { PresenceState } from '@/lib/types';

type Props = {
  roomCode: string;
  displayName: string;
  roomDbId: string;
  onLeave: () => void;
};

export function MeetingRoom({ roomCode, displayName, roomDbId, onLeave }: Props) {
  const { joinRoom, leaveRoom, participants, updatePresence, remoteCursors, isHost, userId } = useRoom();
  const { state, initPreview, toggleMic, toggleCam, startScreenShare, stopScreenShare, stopPreview } = useMedia();

  const [chatOpen, setChatOpen] = useState(false);
  const [participantsOpen, setParticipantsOpen] = useState(false);
  const [whiteboardOpen, setWhiteboardOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [roomReady, setRoomReady] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number>(0);
  const [speakingId, setSpeakingId] = useState<string | null>(null);

  // Join room + init media
  useEffect(() => {
    if (!roomDbId) return;
    initPreview().then(() => {
      joinRoom(roomCode, roomDbId, displayName);
      setRoomReady(true);
    });
    return () => {
      stopPreview();
      leaveRoom();
      cancelAnimationFrame(rafRef.current);
      audioCtxRef.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomDbId]);

  // Timer
  useEffect(() => {
    const start = Date.now();
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Sync mic/cam/screen presence
  useEffect(() => {
    updatePresence({
      isMicOn: state.micOn,
      isCamOn: state.camOn,
      isScreenSharing: state.isScreenSharing,
    });
  }, [state.micOn, state.camOn, state.isScreenSharing, updatePresence]);

  // Local audio level for active speaker detection
  useEffect(() => {
    if (!state.localStream || !state.micOn) {
      return;
    }
    const audioTrack = state.localStream.getAudioTracks()[0];
    if (!audioTrack) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContext();
        const source = audioCtxRef.current.createMediaStreamSource(new MediaStream([audioTrack]));
        const analyser = audioCtxRef.current.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        analyserRef.current = analyser;
      }
      const analyser = analyserRef.current!;
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        if (avg > 30) {
          setSpeakingId(userId);
        } else if (speakingId === userId) {
          setSpeakingId(null);
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      // ignore
    }
    return () => cancelAnimationFrame(rafRef.current);
  }, [state.localStream, state.micOn, userId, speakingId]);

  const handleToggleScreen = useCallback(async () => {
    if (state.isScreenSharing) {
      stopScreenShare();
    } else {
      await startScreenShare();
    }
  }, [state.isScreenSharing, startScreenShare, stopScreenShare]);

  const handleMuteAll = useCallback(() => {
    // Broadcast mute-all to other participants
    if (roomDbId) {
      supabase.channel(`room:${roomDbId}`).send({
        type: 'broadcast',
        event: 'mute-all',
        payload: {},
      });
    }
    // Mute local
    if (state.micOn) toggleMic();
  }, [roomDbId, state.micOn, toggleMic]);

  const handleLeave = useCallback(() => {
    stopPreview();
    leaveRoom();
    onLeave();
  }, [stopPreview, leaveRoom, onLeave]);

  const copyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatElapsed = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  // Build participant list with streams
  const localParticipant: PresenceState = participants.find((p) => p.id === userId) ?? {
    id: userId,
    name: displayName,
    isHost,
    isMicOn: state.micOn,
    isCamOn: state.camOn,
    isScreenSharing: state.isScreenSharing,
    avatarColor: '',
    joinedAt: Date.now(),
  };

  const allParticipants: PresenceState[] = [localParticipant, ...participants.filter((p) => p.id !== userId)];

  // Determine screen sharer
  const sharer = participants.find((p) => p.isScreenSharing);
  const isLocalSharing = state.isScreenSharing;
  const effectivePinned = pinnedId ?? (sharer ? sharer.id : null) ?? (isLocalSharing ? userId : null);

  // Layout: pinned/sharer spotlight vs grid
  const spotlightParticipant = effectivePinned
    ? allParticipants.find((p) => p.id === effectivePinned)
    : null;

  const gridParticipants = effectivePinned
    ? allParticipants.filter((p) => p.id !== effectivePinned)
    : allParticipants;

  const getStreamFor = (p: PresenceState): MediaStream | null => {
    if (p.id === userId) {
      return state.isScreenSharing ? state.screenStream : state.localStream;
    }
    // Remote streams not available in browser-only mode (no WebRTC server)
    return null;
  };

  // Grid columns based on count
  const gridCount = gridParticipants.length;
  const gridCols = gridCount <= 1 ? 'grid-cols-1' : gridCount <= 4 ? 'grid-cols-2' : gridCount <= 9 ? 'grid-cols-3' : 'grid-cols-4';

  if (!roomReady) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Video className="w-8 h-8 text-white" />
          </div>
          <p className="text-white/50 text-sm">Connecting to room…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-[#09090b] overflow-hidden flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#121215]/80 backdrop-blur-xl border-b border-white/[0.06] z-30">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center">
            <Video className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-white text-sm hidden sm:inline">PulseMeet</span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#18181b] border border-white/[0.06]">
            <Clock className="w-3.5 h-3.5 text-white/40" />
            <span className="text-sm text-white/70 font-mono tabular-nums">{formatElapsed(elapsed)}</span>
          </div>
          <button
            onClick={copyCode}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#18181b] border border-white/[0.06] hover:border-white/10 transition-colors"
          >
            <span className="font-mono text-sm text-emerald-400">{roomCode}</span>
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-white/40" />}
          </button>
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Video area */}
        <div className="flex-1 p-3 pb-24 overflow-hidden">
          {spotlightParticipant ? (
            <div className="h-full flex flex-col gap-2">
              {/* Spotlight tile */}
              <div className="flex-1 min-h-0">
                <VideoTile
                  participant={spotlightParticipant}
                  stream={getStreamFor(spotlightParticipant)}
                  isLocal={spotlightParticipant.id === userId}
                  isSpeaking={speakingId === spotlightParticipant.id}
                  isPinned={pinnedId === spotlightParticipant.id}
                  onPin={() => setPinnedId((prev) => (prev === spotlightParticipant.id ? null : spotlightParticipant.id))}
                />
              </div>
              {/* Carousel of others */}
              {gridParticipants.length > 0 && (
                <div className="h-28 flex gap-2 overflow-x-auto">
                  {gridParticipants.map((p) => (
                    <div key={p.id} className="w-44 shrink-0">
                      <VideoTile
                        participant={p}
                        stream={getStreamFor(p)}
                        isLocal={p.id === userId}
                        isSpeaking={speakingId === p.id}
                        isPinned={false}
                        onPin={() => setPinnedId(p.id)}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className={cn('h-full grid gap-2', gridCols)}>
              {allParticipants.map((p) => (
                <VideoTile
                  key={p.id}
                  participant={p}
                  stream={getStreamFor(p)}
                  isLocal={p.id === userId}
                  isSpeaking={speakingId === p.id}
                  isPinned={false}
                  onPin={() => setPinnedId(p.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right drawer */}
        {(chatOpen || participantsOpen) && (
          <div className="w-full max-w-xs sm:w-80 z-40 h-full">
            {chatOpen && <ChatDrawer onClose={() => setChatOpen(false)} onRead={() => setUnreadCount(0)} />}
            {participantsOpen && !chatOpen && (
              <ParticipantsDrawer onClose={() => setParticipantsOpen(false)} onMuteAll={handleMuteAll} />
            )}
          </div>
        )}
      </div>

      {/* Control Dock */}
      <ControlDock
        micOn={state.micOn}
        camOn={state.camOn}
        isScreenSharing={state.isScreenSharing}
        onToggleMic={toggleMic}
        onToggleCam={toggleCam}
        onToggleScreen={handleToggleScreen}
        onToggleWhiteboard={() => setWhiteboardOpen((v) => !v)}
        whiteboardActive={whiteboardOpen}
        onToggleChat={() => { setChatOpen((v) => !v); setParticipantsOpen(false); }}
        unreadCount={chatOpen ? 0 : unreadCount}
        onToggleParticipants={() => { setParticipantsOpen((v) => !v); setChatOpen(false); }}
        participantCount={participants.length}
        onLeave={handleLeave}
      />

      {/* Whiteboard overlay */}
      {whiteboardOpen && <Whiteboard onClose={() => setWhiteboardOpen(false)} />}
    </div>
  );
}
