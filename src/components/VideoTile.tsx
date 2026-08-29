import { useEffect, useRef } from 'react';
import { MicOff, Pin, MonitorUp, Crown, Hand } from 'lucide-react';
import type { PresenceState, VideoFilter } from '@/lib/types';
import { initials, cn } from '@/lib/utils';

type Props = {
  participant: PresenceState;
  stream: MediaStream | null;
  isLocal: boolean;
  isSpeaking: boolean;
  isPinned: boolean;
  filter?: VideoFilter;
  onPin: () => void;
};

export function VideoTile({
  participant,
  stream,
  isLocal,
  isSpeaking,
  isPinned,
  filter = 'none',
  onPin,
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const hasVideo = participant.isCamOn && stream && (isLocal || stream.getVideoTracks().length > 0);
  const isScreenSharing = participant.isScreenSharing;

  const setVideoRef = (el: HTMLVideoElement | null) => {
    videoRef.current = el;
    if (el && stream) {
      if (el.srcObject !== stream) {
        el.srcObject = stream;
      }
      el.play().catch(() => {});
    }
  };

  const setAudioRef = (el: HTMLAudioElement | null) => {
    audioRef.current = el;
    if (el && stream && !isLocal) {
      if (el.srcObject !== stream) {
        el.srcObject = stream;
      }
      el.play().catch(() => {});
    }
  };

  useEffect(() => {
    if (videoRef.current && stream) {
      if (videoRef.current.srcObject !== stream) {
        videoRef.current.srcObject = stream;
      }
      videoRef.current.play().catch(() => {});
    }
  }, [stream, hasVideo]);

  useEffect(() => {
    if (audioRef.current && stream && !isLocal) {
      if (audioRef.current.srcObject !== stream) {
        audioRef.current.srcObject = stream;
      }
      audioRef.current.play().catch(() => {});
    }
  }, [stream, isLocal]);

  return (
    <div
      className={cn(
        'relative rounded-2xl overflow-hidden bg-[#18181b] border transition-all duration-300 group select-none shadow-lg w-full h-full flex items-center justify-center',
        isSpeaking
          ? 'border-emerald-400 ring-2 ring-emerald-400/40 shadow-[0_0_25px_rgba(16,185,129,0.3)]'
          : 'border-white/[0.06] hover:border-white/20',
        isPinned && 'ring-2 ring-cyan-400/50 shadow-[0_0_20px_rgba(6,182,212,0.25)]'
      )}
      role="region"
      aria-label={`Video tile for ${participant.name}`}
    >
      {/* Background audio element for remote participants to guarantee continuous playback */}
      {!isLocal && stream && (
        <audio ref={setAudioRef} autoPlay playsInline className="hidden" />
      )}

      {hasVideo ? (
        <video
          ref={setVideoRef}
          autoPlay
          muted={isLocal}
          playsInline
          className={cn(
            'w-full h-full object-cover object-center transition-all duration-200',
            isLocal && !isScreenSharing && '-scale-x-100',
            isLocal && filter && `video-filter-${filter}`
          )}
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-[#18181b] to-[#121215]">
          <div
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center text-xl sm:text-2xl font-bold text-white shadow-xl shadow-black/40 border border-white/10"
            style={{ background: `linear-gradient(135deg, ${participant.avatarColor || '#10b981'}, ${participant.avatarColor || '#10b981'}99)` }}
          >
            {initials(participant.name)}
          </div>
          <span className="text-white/40 text-xs mt-2 font-medium">Camera Off</span>
        </div>
      )}

      {/* Hand Raised Banner */}
      {participant.isHandRaised && (
        <div className="absolute top-2 left-2 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-500/90 text-black font-semibold text-xs shadow-lg animate-bounce duration-1000">
          <Hand className="w-3.5 h-3.5" />
          <span>Hand Raised</span>
        </div>
      )}

      {/* Top bar: pin + screen share indicator */}
      <div className="absolute top-0 left-0 right-0 p-2 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity z-10">
        {isScreenSharing && !participant.isHandRaised && (
          <span className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-cyan-500/30 backdrop-blur-md border border-cyan-500/40 text-cyan-300 text-xs font-semibold shadow-md">
            <MonitorUp className="w-3.5 h-3.5" /> Presenting
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={onPin}
            aria-label={isPinned ? 'Unpin participant' : 'Pin participant'}
            className={cn(
              'p-2 rounded-xl backdrop-blur-md transition-all shadow-md',
              isPinned ? 'bg-cyan-500 text-black font-bold' : 'bg-black/60 text-white/80 hover:text-white hover:bg-black/80'
            )}
            title={isPinned ? 'Unpin participant' : 'Pin to main stage'}
          >
            <Pin className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Bottom label */}
      <div className="absolute bottom-0 left-0 right-0 p-2 sm:p-2.5 flex items-center justify-between bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-6">
        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-black/60 backdrop-blur-md border border-white/[0.08] text-white text-xs font-medium max-w-[80%] truncate shadow-sm">
          {participant.isHost && <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
          <span className="truncate">{participant.name}{isLocal && ' (You)'}</span>
        </span>
        {!participant.isMicOn && (
          <span className="p-1.5 rounded-xl bg-red-500/25 backdrop-blur-md border border-red-500/30 text-red-400 shadow-sm" title="Muted">
            <MicOff className="w-3.5 h-3.5" />
          </span>
        )}
      </div>
    </div>
  );
}
