import { useEffect, useRef } from 'react';
import { MicOff, Pin, MonitorUp, Crown } from 'lucide-react';
import type { PresenceState } from '@/lib/types';
import { initials, cn } from '@/lib/utils';

type Props = {
  participant: PresenceState;
  stream: MediaStream | null;
  isLocal: boolean;
  isSpeaking: boolean;
  isPinned: boolean;
  onPin: () => void;
};

export function VideoTile({ participant, stream, isLocal, isSpeaking, isPinned, onPin }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const hasVideo = participant.isCamOn && stream?.getVideoTracks().some((t) => t.enabled);
  const isScreenSharing = participant.isScreenSharing;

  return (
    <div
      className={cn(
        'relative rounded-xl overflow-hidden bg-[#18181b] border transition-all duration-300 group',
        isSpeaking
          ? 'border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.35)]'
          : 'border-white/[0.06]',
        isPinned && 'ring-2 ring-emerald-400/50'
      )}
    >
      {hasVideo ? (
        <video
          ref={videoRef}
          autoPlay
          muted={isLocal}
          playsInline
          className={cn('w-full h-full object-cover', isLocal && !isScreenSharing && '-scale-x-100')}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold text-white shadow-lg"
            style={{ background: `linear-gradient(135deg, ${participant.avatarColor}, ${participant.avatarColor}99)` }}
          >
            {initials(participant.name)}
          </div>
        </div>
      )}

      {/* Top bar: pin + screen share indicator */}
      <div className="absolute top-0 left-0 right-0 p-2 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
        {isScreenSharing && (
          <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-cyan-500/20 backdrop-blur-sm text-cyan-300 text-xs font-medium">
            <MonitorUp className="w-3 h-3" /> Sharing
          </span>
        )}
        <div className="ml-auto">
          <button
            onClick={onPin}
            className={cn(
              'p-1.5 rounded-lg backdrop-blur-sm transition-colors',
              isPinned ? 'bg-emerald-500/30 text-emerald-300' : 'bg-black/40 text-white/70 hover:text-white'
            )}
          >
            <Pin className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Bottom label */}
      <div className="absolute bottom-0 left-0 right-0 p-2 flex items-center justify-between">
        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/50 backdrop-blur-sm text-white text-xs font-medium max-w-[80%] truncate">
          {participant.isHost && <Crown className="w-3 h-3 text-amber-400 shrink-0" />}
          <span className="truncate">{participant.name}{isLocal && ' (You)'}</span>
        </span>
        {!participant.isMicOn && (
          <span className="p-1.5 rounded-lg bg-red-500/30 backdrop-blur-sm text-red-400">
            <MicOff className="w-3.5 h-3.5" />
          </span>
        )}
      </div>
    </div>
  );
}
