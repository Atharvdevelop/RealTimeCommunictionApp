import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Video, Copy, Check, Clock, ShieldAlert, Info, Crown,
  AlertTriangle, Link2, LayoutGrid, Maximize2, HelpCircle
} from 'lucide-react';
import { useRoom } from '@/hooks/useRoom';
import { useMedia } from '@/hooks/useMedia';
import { useWebRTC } from '@/hooks/useWebRTC';
import { useRecorder } from '@/hooks/useRecorder';
import { VideoTile } from '@/components/VideoTile';
import { ControlDock } from '@/components/ControlDock';
import { ChatDrawer } from '@/components/ChatDrawer';
import { ParticipantsDrawer } from '@/components/ParticipantsDrawer';
import { Whiteboard } from '@/components/Whiteboard';
import { NetworkStatsHUD } from '@/components/NetworkStatsHUD';
import { InviteModal } from '@/components/InviteModal';
import { KeyboardShortcutsModal } from '@/components/KeyboardShortcutsModal';
import { SettingsModal } from '@/components/SettingsModal';
import { FloatingReactionsOverlay } from '@/components/FloatingReactions';
import { cn } from '@/lib/utils';
import type { PresenceState, ReactionEvent, VideoFilter } from '@/lib/types';

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
    isHandRaised,
    toggleHandRaise,
    sendReaction,
    onReaction,
    muteAllParticipants,
    endMeetingForAll,
    registerAdminHandlers,
  } = useRoom();

  const {
    state,
    initPreview,
    toggleMic,
    toggleCam,
    startScreenShare,
    stopScreenShare,
    stopPreview,
  } = useMedia();

  const { remoteStreams } = useWebRTC({
    channel,
    localStream: state.localStream,
    screenStream: state.screenStream,
    isScreenSharing: state.isScreenSharing,
    userId,
    participants,
  });

  const { isRecording, formattedDuration, startRecording, stopRecording } = useRecorder();

  const [chatOpen, setChatOpen] = useState(false);
  const [participantsOpen, setParticipantsOpen] = useState(false);
  const [whiteboardOpen, setWhiteboardOpen] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [shortcutsModalOpen, setShortcutsModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [videoFilter, setVideoFilter] = useState<VideoFilter>('none');
  const [layoutMode, setLayoutMode] = useState<'auto' | 'grid' | 'spotlight'>('auto');

  const [unreadCount, setUnreadCount] = useState(0);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [roomReady, setRoomReady] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [floatingReactions, setFloatingReactions] = useState<ReactionEvent[]>([]);
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

  // Subscribe to reaction events
  useEffect(() => {
    const unbind = onReaction((reaction) => {
      setFloatingReactions((prev) => [...prev, reaction]);
      setTimeout(() => {
        setFloatingReactions((prev) => prev.filter((r) => r.id !== reaction.id));
      }, 3000);
    });
    return unbind;
  }, [onReaction]);

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

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore when typing in inputs
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

      if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        toggleMic();
        addToast(!state.micOn ? 'Microphone Unmuted' : 'Microphone Muted', 'info');
      } else if (e.key === 'v' || e.key === 'V') {
        e.preventDefault();
        toggleCam();
        addToast(!state.camOn ? 'Camera Turned On' : 'Camera Turned Off', 'info');
      } else if (e.key === 'h' || e.key === 'H') {
        e.preventDefault();
        toggleHandRaise();
        addToast(!isHandRaised ? 'Hand Raised ✋' : 'Hand Lowered', 'info');
      } else if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        setChatOpen((v) => !v);
        setParticipantsOpen(false);
      } else if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        setParticipantsOpen((v) => !v);
        setChatOpen(false);
      } else if (e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        setWhiteboardOpen((v) => !v);
      } else if (e.key === '?') {
        e.preventDefault();
        setShortcutsModalOpen((v) => !v);
      } else if (e.key === 'Escape') {
        setChatOpen(false);
        setParticipantsOpen(false);
        setWhiteboardOpen(false);
        setInviteModalOpen(false);
        setShortcutsModalOpen(false);
        setSettingsModalOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.micOn, state.camOn, isHandRaised, toggleMic, toggleCam, toggleHandRaise, addToast]);

  const handleToggleScreen = useCallback(async () => {
    if (state.isScreenSharing) {
      stopScreenShare();
    } else {
      await startScreenShare();
    }
  }, [state.isScreenSharing, startScreenShare, stopScreenShare]);

  const handleToggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
      addToast('Meeting recording saved and downloaded! 🎬', 'success');
    } else {
      const activeStream = state.isScreenSharing && state.screenStream
        ? state.screenStream
        : state.localStream;
      if (!activeStream) {
        addToast('No media stream available to record.', 'warning');
        return;
      }
      const started = startRecording(activeStream);
      if (started) {
        addToast('Recording meeting session started (1080p WebM)...', 'info');
      }
    }
  }, [isRecording, state.isScreenSharing, state.screenStream, state.localStream, startRecording, stopRecording, addToast]);

  const handleMuteAll = useCallback(() => {
    muteAllParticipants();
    if (state.micOn) toggleMic();
    addToast('Muted all participants in the meeting', 'info');
  }, [muteAllParticipants, state.micOn, toggleMic, addToast]);

  const handleLeave = useCallback(() => {
    if (isRecording) stopRecording();
    stopPreview();
    leaveRoom();
    onLeave();
  }, [isRecording, stopRecording, stopPreview, leaveRoom, onLeave]);

  const copyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    addToast(`Room code ${roomCode} copied!`, 'info');
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
    isHandRaised,
    avatarColor: '',
    joinedAt: Date.now(),
  };

  const allParticipants: PresenceState[] = [localParticipant, ...participants.filter((p) => p.id !== userId)];

  // Determine screen sharer
  const sharer = participants.find((p) => p.isScreenSharing);
  const isLocalSharing = state.isScreenSharing;
  const effectivePinned = layoutMode === 'grid'
    ? null
    : (pinnedId ?? (sharer ? sharer.id : null) ?? (isLocalSharing ? userId : null));

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

  // Dynamic grid responsive columns and rows
  const gridCount = gridParticipants.length;
  const gridLayout =
    gridCount <= 1
      ? 'grid-cols-1 grid-rows-1'
      : gridCount === 2
        ? 'grid-cols-1 sm:grid-cols-2 grid-rows-2 sm:grid-rows-1'
        : gridCount <= 4
          ? 'grid-cols-2 grid-rows-2'
          : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 auto-rows-fr';

  if (!roomReady) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-3xl bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center mx-auto mb-4 animate-pulse shadow-lg shadow-emerald-500/20">
            <Video className="w-7 h-7 sm:w-8 sm:h-8 text-black" />
          </div>
          <p className="text-white/50 text-sm font-medium">Connecting to encrypted room…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-[#09090b] overflow-hidden flex flex-col relative">
      {/* Live Floating Reactions Overlay */}
      <FloatingReactionsOverlay reactions={floatingReactions} />

      {/* Toast Notification Container */}
      <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 pointer-events-none w-full max-w-sm px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "px-3.5 py-2.5 rounded-2xl border backdrop-blur-2xl shadow-2xl text-xs font-semibold flex items-center gap-2.5 pointer-events-auto transition-all animate-in fade-in slide-in-from-top-2 duration-200",
              t.type === 'warning' && "bg-amber-500/15 border-amber-500/30 text-amber-300",
              t.type === 'danger' && "bg-red-500/15 border-red-500/30 text-red-300",
              t.type === 'success' && "bg-emerald-500/15 border-emerald-500/30 text-emerald-300",
              t.type === 'info' && "bg-[#18181b]/95 border-white/[0.12] text-white"
            )}
          >
            {t.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />}
            {t.type === 'danger' && <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />}
            {t.type === 'success' && <Crown className="w-4 h-4 text-emerald-400 shrink-0" />}
            {t.type === 'info' && <Info className="w-4 h-4 text-cyan-400 shrink-0" />}
            <span className="flex-1 truncate">{t.message}</span>
          </div>
        ))}
      </div>

      {/* Top Header Bar */}
      <header className="flex items-center justify-between px-3 sm:px-5 py-2.5 bg-[#121215]/85 backdrop-blur-2xl border-b border-white/[0.08] z-30 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center shadow-md shadow-emerald-500/20 shrink-0">
            <Video className="w-4.5 h-4.5 text-black font-bold" />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-white text-sm font-display hidden xs:inline sm:inline">PulseMeet</span>
            <span className="hidden md:inline px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase">
              Live Room
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2.5">
          {/* Duration Timer */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#18181b] border border-white/[0.06]">
            <Clock className="w-3.5 h-3.5 text-white/40" />
            <span className="text-xs sm:text-sm text-white/80 font-mono tabular-nums">{formatElapsed(elapsed)}</span>
          </div>

          {/* Network Health Diagnostics HUD */}
          <NetworkStatsHUD />

          {/* Layout Mode Switcher */}
          <button
            onClick={() => setLayoutMode((prev) => (prev === 'grid' ? 'spotlight' : 'grid'))}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#18181b] border border-white/[0.06] hover:border-white/10 text-white/70 hover:text-white text-xs transition-colors"
            title="Toggle Grid / Spotlight View"
          >
            {layoutMode === 'grid' ? <Maximize2 className="w-3.5 h-3.5" /> : <LayoutGrid className="w-3.5 h-3.5" />}
            <span className="capitalize">{layoutMode === 'grid' ? 'Spotlight' : 'Grid'}</span>
          </button>

          {/* Share & QR Invite Modal Button */}
          <button
            onClick={() => setInviteModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-500/25 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 text-xs font-bold transition-all shadow-sm"
            title="Open invite modal & QR code"
          >
            <Link2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Invite / QR</span>
            <span className="sm:hidden">Invite</span>
          </button>

          {/* Room Code */}
          <button
            onClick={copyCode}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-[#18181b] border border-white/[0.06] hover:border-white/10 text-white/70 hover:text-white transition-colors"
            title="Copy room code"
          >
            <span className="font-mono text-xs sm:text-sm text-white/90 font-medium">{roomCode}</span>
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-white/40" />}
          </button>

          {/* Shortcuts Help Button */}
          <button
            onClick={() => setShortcutsModalOpen(true)}
            className="p-2 rounded-xl bg-[#18181b] border border-white/[0.06] hover:border-white/10 text-white/50 hover:text-white transition-colors"
            title="Keyboard shortcuts (?)"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main video area */}
      <main className="flex-1 min-h-0 flex overflow-hidden relative" role="main">
        <div className="flex-1 h-full p-2 sm:p-4 pb-24 sm:pb-28 flex items-center justify-center overflow-hidden">
          {spotlightParticipant ? (
            <div className="w-full h-full max-h-full flex flex-col gap-2">
              {/* Spotlight main tile */}
              <div className="flex-1 min-h-0 flex items-center justify-center">
                <div className="w-full h-full max-w-5xl max-h-full flex items-center justify-center">
                  <VideoTile
                    participant={spotlightParticipant}
                    stream={getStreamFor(spotlightParticipant)}
                    isLocal={spotlightParticipant.id === userId}
                    isSpeaking={speakingId === spotlightParticipant.id}
                    isPinned={pinnedId === spotlightParticipant.id}
                    filter={spotlightParticipant.id === userId ? videoFilter : 'none'}
                    onPin={() => setPinnedId((prev) => (prev === spotlightParticipant.id ? null : spotlightParticipant.id))}
                  />
                </div>
              </div>
              {/* Thumbnail carousel of others */}
              {gridParticipants.length > 0 && (
                <div className="h-24 sm:h-28 flex gap-2 overflow-x-auto pb-1 shrink-0 justify-center">
                  {gridParticipants.map((p) => (
                    <div key={p.id} className="w-36 sm:w-44 shrink-0 h-full">
                      <VideoTile
                        participant={p}
                        stream={getStreamFor(p)}
                        isLocal={p.id === userId}
                        isSpeaking={speakingId === p.id}
                        isPinned={false}
                        filter={p.id === userId ? videoFilter : 'none'}
                        onPin={() => setPinnedId(p.id)}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : gridParticipants.length === 1 ? (
            /* Single Participant View: Centered, aspect-video optimized framing */
            <div className="w-full h-full max-w-5xl max-h-full flex items-center justify-center p-1">
              <div className="w-full h-full max-h-full flex items-center justify-center">
                <VideoTile
                  participant={allParticipants[0]}
                  stream={getStreamFor(allParticipants[0])}
                  isLocal={allParticipants[0].id === userId}
                  isSpeaking={speakingId === allParticipants[0].id}
                  isPinned={false}
                  filter={allParticipants[0].id === userId ? videoFilter : 'none'}
                  onPin={() => setPinnedId(allParticipants[0].id)}
                />
              </div>
            </div>
          ) : (
            <div className={cn('w-full h-full max-h-full grid gap-2 sm:gap-3', gridLayout)}>
              {allParticipants.map((p) => (
                <div key={p.id} className="w-full h-full min-h-0">
                  <VideoTile
                    participant={p}
                    stream={getStreamFor(p)}
                    isLocal={p.id === userId}
                    isSpeaking={speakingId === p.id}
                    isPinned={false}
                    filter={p.id === userId ? videoFilter : 'none'}
                    onPin={() => setPinnedId(p.id)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Drawers: Fullscreen overlay on mobile, fixed sidebar on desktop */}
        {(chatOpen || participantsOpen) && (
          <div className="fixed inset-0 sm:relative sm:inset-auto w-full sm:w-80 z-50 h-full bg-[#121215] sm:bg-transparent animate-in fade-in sm:animate-none duration-150">
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
      </main>

      {/* Control Dock */}
      <ControlDock
        micOn={state.micOn}
        camOn={state.camOn}
        isScreenSharing={state.isScreenSharing}
        isHandRaised={isHandRaised}
        isRecording={isRecording}
        recordingDuration={formattedDuration}
        onToggleMic={toggleMic}
        onToggleCam={toggleCam}
        onToggleScreen={handleToggleScreen}
        onToggleHandRaise={toggleHandRaise}
        onToggleRecording={handleToggleRecording}
        onOpenSettings={() => setSettingsModalOpen(true)}
        onToggleWhiteboard={() => setWhiteboardOpen((v) => !v)}
        whiteboardActive={whiteboardOpen}
        onToggleChat={() => { setChatOpen((v) => !v); setParticipantsOpen(false); }}
        unreadCount={chatOpen ? 0 : unreadCount}
        onToggleParticipants={() => { setParticipantsOpen((v) => !v); setChatOpen(false); }}
        participantCount={participants.length}
        onSendReaction={sendReaction}
        onLeave={handleLeave}
        isHost={isHost}
        onEndMeetingForAll={endMeetingForAll}
      />

      {/* Whiteboard overlay */}
      {whiteboardOpen && <Whiteboard onClose={() => setWhiteboardOpen(false)} />}

      {/* Invite Modal with QR Code */}
      {inviteModalOpen && (
        <InviteModal roomCode={roomCode} onClose={() => setInviteModalOpen(false)} />
      )}

      {/* Keyboard Shortcuts Modal */}
      {shortcutsModalOpen && (
        <KeyboardShortcutsModal onClose={() => setShortcutsModalOpen(false)} />
      )}

      {/* Settings & Video Filters Modal */}
      {settingsModalOpen && (
        <SettingsModal
          onClose={() => setSettingsModalOpen(false)}
          currentFilter={videoFilter}
          onFilterChange={setVideoFilter}
          localStream={state.localStream}
        />
      )}

      {/* Termination Modal (Kicked / Meeting Ended) */}
      {terminationModal && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#121215] border border-white/[0.1] rounded-3xl p-6 max-w-sm w-full shadow-2xl text-center space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-red-500/15 text-red-400 flex items-center justify-center mx-auto shadow-lg shadow-red-500/10">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white font-display">{terminationModal.title}</h3>
              <p className="text-xs text-white/50 mt-1">{terminationModal.desc}</p>
            </div>
            <button
              onClick={() => {
                setTerminationModal(null);
                onLeave();
              }}
              className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold transition-colors shadow-lg shadow-emerald-500/20"
            >
              Return to Lobby
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
