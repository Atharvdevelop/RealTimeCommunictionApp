import { useState } from 'react';
import {
  X, Crown, Mic, MicOff, Video, VideoOff, MonitorUp,
  UserX, Shield, Lock, Unlock, PhoneOff, MoreVertical, Link2, Check, Copy
} from 'lucide-react';
import { useRoom } from '@/context/RoomContext';
import { cn, initials } from '@/lib/utils';
import type { PresenceState } from '@/lib/types';

type Props = {
  onClose: () => void;
  onMuteAll: () => void;
  onEndMeetingForAll?: () => void;
};

export function ParticipantsDrawer({ onClose, onMuteAll, onEndMeetingForAll }: Props) {
  const {
    participants,
    userId,
    isHost,
    isLocked,
    roomCode,
    muteParticipant,
    kickParticipant,
    transferHost,
    toggleLockMeeting,
  } = useRoom();

  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [confirmKick, setConfirmKick] = useState<PresenceState | null>(null);
  const [confirmTransfer, setConfirmTransfer] = useState<PresenceState | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const sorted = [...participants].sort((a, b) => {
    if (a.isHost && !b.isHost) return -1;
    if (!a.isHost && b.isHost) return 1;
    return a.joinedAt - b.joinedAt;
  });

  const copyCode = () => {
    navigator.clipboard.writeText(roomCode ?? '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyInviteLink = () => {
    const inviteUrl = `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(roomCode ?? '')}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleMute = (pId: string) => {
    muteParticipant(pId);
    setActiveMenuId(null);
  };

  const handleKickConfirm = () => {
    if (confirmKick) {
      kickParticipant(confirmKick.id, confirmKick.name);
      setConfirmKick(null);
      setActiveMenuId(null);
    }
  };

  const handleTransferConfirm = () => {
    if (confirmTransfer) {
      transferHost(confirmTransfer.id);
      setConfirmTransfer(null);
      setActiveMenuId(null);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#121215]/95 backdrop-blur-xl border-l border-white/[0.08] relative">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-white text-sm">
            Participants <span className="text-white/40">({participants.length})</span>
          </h3>
          {isHost && (
            <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-semibold flex items-center gap-1">
              <Shield className="w-2.5 h-2.5" /> Host Controls
            </span>
          )}
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 text-white/50 hover:text-white transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Room code & Share Link banner */}
      <div className="px-4 py-3 border-b border-white/[0.06] space-y-2">
        <div className="flex items-center justify-between text-xs text-white/40">
          <span>Room code</span>
          {isLocked && <span className="text-amber-400 font-medium flex items-center gap-1"><Lock className="w-3 h-3" /> Locked</span>}
        </div>
        <div className="flex items-center justify-between rounded-xl bg-[#18181b] border border-white/[0.06] px-3 py-2">
          <span className="font-mono text-sm text-emerald-400 font-medium">{roomCode}</span>
          <button
            onClick={copyCode}
            className="text-xs text-white/70 hover:text-white transition-colors px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10"
          >
            {copied ? 'Copied!' : 'Copy Code'}
          </button>
        </div>
        <button
          onClick={copyInviteLink}
          className={cn(
            "w-full py-2 px-3 rounded-xl border text-xs font-semibold transition-all flex items-center justify-center gap-2 shadow-sm",
            copiedLink
              ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-300"
              : "bg-emerald-500/10 border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/20"
          )}
        >
          {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />}
          {copiedLink ? 'Invite Link Copied!' : 'Copy Direct Invite Link'}
        </button>
      </div>

      {/* Host Quick Admin Bar */}
      {isHost && (
        <div className="px-4 py-2.5 border-b border-white/[0.06] bg-white/[0.02] space-y-2">
          <div className="flex gap-2">
            <button
              onClick={onMuteAll}
              disabled={participants.length <= 1}
              className={cn(
                "flex-1 py-2 rounded-xl border text-xs font-medium transition-all flex items-center justify-center gap-1.5 shadow-sm",
                participants.length > 1
                  ? "bg-red-500/10 border-red-500/20 text-red-300 hover:bg-red-500/20"
                  : "bg-white/[0.02] border-white/[0.04] text-white/20 cursor-not-allowed"
              )}
            >
              <MicOff className="w-3.5 h-3.5" /> Mute All
            </button>
            <button
              onClick={() => toggleLockMeeting()}
              className={cn(
                "flex-1 py-2 rounded-xl border text-xs font-medium transition-all flex items-center justify-center gap-1.5 shadow-sm",
                isLocked
                  ? "bg-amber-500/20 border-amber-500/30 text-amber-300 hover:bg-amber-500/30"
                  : "bg-white/[0.05] border-white/[0.08] text-white/70 hover:text-white hover:bg-white/[0.08]"
              )}
            >
              {isLocked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
              {isLocked ? 'Unlock Room' : 'Lock Room'}
            </button>
          </div>
        </div>
      )}

      {/* Participants List */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
        {sorted.map((p) => {
          const isLocal = p.id === userId;
          const isMenuOpen = activeMenuId === p.id;

          return (
            <div
              key={p.id}
              className={cn(
                "relative flex items-center gap-3 rounded-xl px-2.5 py-2.5 transition-colors group",
                p.isHost ? "bg-amber-500/[0.04] border border-amber-500/10" : "hover:bg-white/[0.03]"
              )}
            >
              {/* Avatar */}
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 shadow-md"
                style={{ background: `linear-gradient(135deg, ${p.avatarColor || '#10b981'}, ${p.avatarColor || '#10b981'}99)` }}
              >
                {initials(p.name)}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate flex items-center gap-1.5 font-medium">
                  {p.name}
                  {isLocal && <span className="text-white/40 text-xs font-normal">(You)</span>}
                  {p.isHost && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-400/20 text-amber-300 text-[10px] font-bold">
                      <Crown className="w-3 h-3 text-amber-400" /> Host
                    </span>
                  )}
                </p>
                <p className="text-xs text-white/30">{p.isHost ? 'Meeting Host' : 'Guest'}</p>
              </div>

              {/* Status Icons & Controls */}
              <div className="flex items-center gap-1.5">
                {p.isScreenSharing && (
                  <span className="text-cyan-400 p-1" title="Sharing screen"><MonitorUp className="w-3.5 h-3.5" /></span>
                )}
                <span className={cn('p-1 rounded-md', p.isMicOn ? 'text-white/40' : 'text-red-400 bg-red-500/10')}>
                  {p.isMicOn ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
                </span>
                <span className={cn('p-1 rounded-md', p.isCamOn ? 'text-white/40' : 'text-red-400 bg-red-500/10')}>
                  {p.isCamOn ? <Video className="w-3.5 h-3.5" /> : <VideoOff className="w-3.5 h-3.5" />}
                </span>

                {/* Host Action Menu for Guests */}
                {isHost && !isLocal && (
                  <div className="relative">
                    <button
                      onClick={() => setActiveMenuId(isMenuOpen ? null : p.id)}
                      className={cn(
                        "p-1 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors",
                        isMenuOpen && "bg-white/10 text-white"
                      )}
                      title="Host actions"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {isMenuOpen && (
                      <div
                        className="absolute right-0 top-full mt-1 w-44 rounded-xl bg-[#1c1c21] border border-white/[0.12] shadow-2xl p-1 z-30 space-y-0.5 animate-in fade-in zoom-in-95 duration-100"
                        onMouseLeave={() => setActiveMenuId(null)}
                      >
                        {p.isMicOn && (
                          <button
                            onClick={() => handleMute(p.id)}
                            className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-white/80 hover:text-white hover:bg-white/10 flex items-center gap-2 transition-colors"
                          >
                            <MicOff className="w-3.5 h-3.5 text-amber-400" /> Mute Participant
                          </button>
                        )}
                        <button
                          onClick={() => { setConfirmTransfer(p); setActiveMenuId(null); }}
                          className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-white/80 hover:text-white hover:bg-white/10 flex items-center gap-2 transition-colors"
                        >
                          <Crown className="w-3.5 h-3.5 text-amber-400" /> Make Host
                        </button>
                        <button
                          onClick={() => { setConfirmKick(p); setActiveMenuId(null); }}
                          className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-red-400 hover:text-red-300 hover:bg-red-500/15 flex items-center gap-2 transition-colors"
                        >
                          <UserX className="w-3.5 h-3.5" /> Remove from Meeting
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Confirmation Modal for Kick */}
      {confirmKick && (
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#18181b] border border-white/[0.1] rounded-2xl p-5 max-w-xs w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-red-500/15 flex items-center justify-center text-red-400 shrink-0">
                <UserX className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white">Remove Participant?</h4>
                <p className="text-xs text-white/50">{confirmKick.name} will be removed from the call.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmKick(null)}
                className="flex-1 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-medium text-white/70 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleKickConfirm}
                className="flex-1 py-2 rounded-xl bg-red-500 hover:bg-red-400 text-xs font-semibold text-white transition-colors shadow-md shadow-red-500/20"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Transfer Host */}
      {confirmTransfer && (
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#18181b] border border-white/[0.1] rounded-2xl p-5 max-w-xs w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center text-amber-400 shrink-0">
                <Crown className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white">Make {confirmTransfer.name} Host?</h4>
                <p className="text-xs text-white/50">You will transfer host controls and become a regular guest.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmTransfer(null)}
                className="flex-1 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-medium text-white/70 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleTransferConfirm}
                className="flex-1 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-xs font-semibold text-black transition-colors"
              >
                Make Host
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
