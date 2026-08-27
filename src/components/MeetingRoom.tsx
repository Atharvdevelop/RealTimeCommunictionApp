import { useEffect, useRef, useState, useCallback } from 'react';
import { Video, Copy, Check, Clock, ShieldAlert, Info, Crown, MicOff, UserX, AlertTriangle, Link2, Share2 } from 'lucide-react';
import { useRoom } from '@/context/RoomContext';
import { useMedia } from '@/hooks/useMedia';
import { useWebRTC } from '@/hooks/useWebRTC';
import { VideoTile } from '@/components/VideoTile';
import { ControlDock } from '@/components/ControlDock';
import { ChatDrawer } from '@/components/ChatDrawer';
import { ParticipantsDrawer } from '@/components/ParticipantsDrawer';
import { Whiteboard } from '@/components/Whiteboard';
import { cn } from '@/lib/utils';
import type { PresenceState } from '@/lib/types';

type Toast = {
  id: string;
  message: string;
  type: 'info' | 'warning' | 'danger' | 'success';
};

type Props = {
  roomCode: string;
  displayName: string;
  roomDbId: string;
  isCreator?: boolean;
  onLeave: () => void;
};

export function MeetingRoom({ roomCode, displayName, roomDbId, isCreator, onLeave }: Props) {
  const {
    joinRoom,
    leaveRoom,
    participants,
    updatePresence,
    isHost,
    userId,
    channel,
    muteAllParticipants,
    endMeetingForAll,
    registerAdminHandlers,
  } = useRoom();
  const { state, initPreview, toggleMic, toggleCam, startScreenShare, stopScreenShare, stopPreview } = useMedia();

  const { remoteStreams } = useWebRTC({
    channel,
    localStream: state.localStream,
    screenStream: state.screenStream,
    isScreenSharing: state.isScreenSharing,
    userId,
    participants,
  });

  const [chatOpen, setChatOpen] = useState(false);
  const [participantsOpen, setParticipantsOpen] = useState(false);
  const [whiteboardOpen, setWhiteboardOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [roomReady, setRoomReady] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [terminationModal, setTerminationModal] = useState<{ title: string; desc: string } | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number>(0);
  const [speakingId, setSpeakingId] = useState<string | null>(null);

  const addToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  // Join room + init media
  useEffect(() => {
    if (!roomDbId) return;
    initPreview().then(() => {
      joinRoom(roomCode, roomDbId, displayName, isCreator);
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

  // Register remote admin command handlers
  useEffect(() => {
    const unbind = registerAdminHandlers({
      onMuted: () => {
        if (state.micOn) {
          toggleMic();
        }
        addToast('You were muted by the meeting host.', 'warning');
      },
      onKicked: (reason) => {
        stopPreview();
        leaveRoom();
        setTerminationModal({
          title: 'Removed from Meeting',
          desc: reason || 'The host has removed you from this meeting.',
        });
      },
      onMeetingEnded: () => {
        stopPreview();
        leaveRoom();
        setTerminationModal({
          title: 'Meeting Ended',
          desc: 'The host has ended this meeting for all participants.',
        });
      },
      onHostTransferred: (isNewHost) => {
        if (isNewHost) {
          addToast('You are now the meeting host! 👑', 'success');
        } else {
          addToast('Host permissions have been transferred.', 'info');
        }
      },
    });
    return unbind;
  }, [registerAdminHandlers, state.micOn, toggleMic, stopPreview, leaveRoom, addToast]);

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
    muteAllParticipants();
    if (state.micOn) toggleMic();
    addToast('Muted all participants in the meeting', 'info');
  }, [muteAllParticipants, state.micOn, toggleMic, addToast]);

  const handleLeave = useCallback(() => {
    stopPreview();
    leaveRoom();
    onLeave();
  }, [stopPreview, leaveRoom, onLeave]);

  const copyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    addToast(`Room code ${roomCode} copied!`, 'info');
    setTimeout(() => setCopied(false), 2000);
  };

  const copyInviteLink = () => {
    const inviteUrl = `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(roomCode)}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopiedLink(true);
    addToast('Meeting invite link copied to clipboard! 🔗', 'success');
    setTimeout(() => setCopiedLink(false), 2500);
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
    return remoteStreams[p.id] || null;
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
    <div className="h-screen w-screen bg-[#09090b] overflow-hidden flex flex-col relative">
      {/* Toast Notification Container */}
      <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 pointer-events-none w-full max-w-sm px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "px-4 py-2.5 rounded-xl border backdrop-blur-xl shadow-2xl text-xs font-medium flex items-center gap-2.5 pointer-events-auto transition-all animate-in fade-in slide-in-from-top-2 duration-200",
              t.type === 'warning' && "bg-amber-500/15 border-amber-500/30 text-amber-300",
              t.type === 'danger' && "bg-red-500/15 border-red-500/30 text-red-300",
              t.type === 'success' && "bg-emerald-500/15 border-emerald-500/30 text-emerald-300",
              t.type === 'info' && "bg-[#18181b]/90 border-white/[0.12] text-white"
            )}
          >
            {t.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />}
            {t.type === 'danger' && <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />}
            {t.type === 'success' && <Crown className="w-4 h-4 text-emerald-400 shrink-0" />}
            {t.type === 'info' && <Info className="w-4 h-4 text-cyan-400 shrink-0" />}
            <span className="flex-1">{t.message}</span>
          </div>
        ))}
      </div>

      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#121215]/80 backdrop-blur-xl border-b border-white/[0.06] z-30">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center shadow-md">
            <Video className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-white text-sm hidden sm:inline">PulseMeet</span>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#18181b] border border-white/[0.06]">
            <Clock className="w-3.5 h-3.5 text-white/40" />
            <span className="text-sm text-white/70 font-mono tabular-nums">{formatElapsed(elapsed)}</span>
          </div>

          {/* Share Link Button */}
          <button
            onClick={copyInviteLink}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all shadow-sm",
              copiedLink
                ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                : "bg-emerald-500/10 border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/20"
            )}
            title="Copy shareable meeting invite link"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />}
            <span>{copiedLink ? 'Link Copied!' : 'Share Link'}</span>
          </button>

          {/* Room Code */}
          <button
            onClick={copyCode}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#18181b] border border-white/[0.06] hover:border-white/10 text-white/70 hover:text-white transition-colors"
            title="Copy room code"
          >
            <span className="font-mono text-sm text-white/80">{roomCode}</span>
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
              <ParticipantsDrawer
                onClose={() => setParticipantsOpen(false)}
                onMuteAll={handleMuteAll}
                onEndMeetingForAll={isHost ? endMeetingForAll : undefined}
              />
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
        isHost={isHost}
        onEndMeetingForAll={endMeetingForAll}
      />

      {/* Whiteboard overlay */}
      {whiteboardOpen && <Whiteboard onClose={() => setWhiteboardOpen(false)} />}

      {/* Termination Modal (Kicked / Meeting Ended) */}
      {terminationModal && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#121215] border border-white/[0.1] rounded-2xl p-6 max-w-sm w-full shadow-2xl text-center space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-red-500/15 text-red-400 flex items-center justify-center mx-auto shadow-lg shadow-red-500/10">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">{terminationModal.title}</h3>
              <p className="text-xs text-white/50 mt-1">{terminationModal.desc}</p>
            </div>
            <button
              onClick={() => {
                setTerminationModal(null);
                onLeave();
              }}
              className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-semibold transition-colors"
            >
              Return to Lobby
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
