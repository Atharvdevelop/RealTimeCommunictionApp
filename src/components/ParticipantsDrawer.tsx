import { X, Crown, Mic, MicOff, Video, VideoOff, MonitorUp } from 'lucide-react';
import { useRoom } from '@/context/RoomContext';
import { cn, initials } from '@/lib/utils';

type Props = {
  onClose: () => void;
  onMuteAll: () => void;
};

export function ParticipantsDrawer({ onClose, onMuteAll }: Props) {
  const { participants, userId, isHost, roomCode } = useRoom();

  const sorted = [...participants].sort((a, b) => {
    if (a.isHost && !b.isHost) return -1;
    if (!a.isHost && b.isHost) return 1;
    return a.joinedAt - b.joinedAt;
  });

  const copyCode = () => {
    navigator.clipboard.writeText(roomCode ?? '');
  };

  return (
    <div className="flex flex-col h-full bg-[#121215]/90 backdrop-blur-xl border-l border-white/[0.08]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <h3 className="font-semibold text-white text-sm">
          Participants <span className="text-white/40">({participants.length})</span>
        </h3>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 text-white/50 hover:text-white transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Room code */}
      <div className="px-4 py-3 border-b border-white/[0.06]">
        <p className="text-xs text-white/40 mb-1.5">Room code</p>
        <div className="flex items-center justify-between rounded-xl bg-[#18181b] border border-white/[0.06] px-3 py-2">
          <span className="font-mono text-sm text-emerald-400">{roomCode}</span>
          <button
            onClick={copyCode}
            className="text-xs text-white/50 hover:text-white transition-colors px-2 py-1 rounded-lg hover:bg-white/5"
          >
            Copy
          </button>
        </div>
      </div>

      {/* Mute all (host only) */}
      {isHost && participants.length > 1 && (
        <div className="px-4 py-2.5 border-b border-white/[0.06]">
          <button
            onClick={onMuteAll}
            className="w-full py-2.5 rounded-xl bg-[#18181b] border border-white/[0.06] text-white/70 hover:text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
          >
            <MicOff className="w-4 h-4" /> Mute All
          </button>
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
        {sorted.map((p) => {
          const isLocal = p.id === userId;
          return (
            <div
              key={p.id}
              className="flex items-center gap-3 rounded-xl px-2.5 py-2.5 hover:bg-white/[0.03] transition-colors"
            >
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                style={{ background: `linear-gradient(135deg, ${p.avatarColor}, ${p.avatarColor}99)` }}
              >
                {initials(p.name)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate flex items-center gap-1.5">
                  {p.name}
                  {isLocal && <span className="text-white/40 text-xs">(You)</span>}
                  {p.isHost && <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                </p>
                <p className="text-xs text-white/30">{p.isHost ? 'Host' : 'Guest'}</p>
              </div>
              <div className="flex items-center gap-1.5">
                {p.isScreenSharing && (
                  <span className="text-cyan-400"><MonitorUp className="w-4 h-4" /></span>
                )}
                <span className={cn(p.isMicOn ? 'text-white/40' : 'text-red-400')}>
                  {p.isMicOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                </span>
                <span className={cn(p.isCamOn ? 'text-white/40' : 'text-red-400')}>
                  {p.isCamOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
