import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Mic, MicOff, Video, VideoOff, MonitorUp, MonitorOff,
  PenTool, MessageSquare, Users, PhoneOff, ChevronDown, MoreHorizontal
} from 'lucide-react';
import { useMedia } from '@/hooks/useMedia';
import { cn } from '@/lib/utils';

type Props = {
  micOn: boolean;
  camOn: boolean;
  isScreenSharing: boolean;
  onToggleMic: () => void;
  onToggleCam: () => void;
  onToggleScreen: () => void;
  onToggleWhiteboard: () => void;
  whiteboardActive: boolean;
  onToggleChat: () => void;
  unreadCount: number;
  onToggleParticipants: () => void;
  participantCount: number;
  onLeave: () => void;
  isHost?: boolean;
  onEndMeetingForAll?: () => void;
};

export function ControlDock(props: Props) {
  const { state, switchDevice } = useMedia();
  const [micMenuOpen, setMicMenuOpen] = useState(false);
  const [camMenuOpen, setCamMenuOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);

  return (
    <>
      <div className="fixed bottom-3 sm:bottom-5 left-1/2 -translate-x-1/2 z-40 max-w-[calc(100vw-1rem)] w-auto">
        <div className="flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2 py-1.5 sm:py-2 rounded-2xl bg-[#121215]/90 backdrop-blur-2xl border border-white/[0.1] shadow-2xl shadow-black/80">
          {/* Mic */}
          <div className="relative">
            <div className="flex items-center rounded-xl bg-[#18181b] overflow-hidden">
              <DockButton
                active={props.micOn}
                onClick={props.onToggleMic}
                icon={props.micOn ? <Mic className="w-4 h-4 sm:w-5 sm:h-5" /> : <MicOff className="w-4 h-4 sm:w-5 sm:h-5" />}
                danger={!props.micOn}
                label={props.micOn ? 'Mute' : 'Unmute'}
              />
              <button
                onClick={() => { setMicMenuOpen((v) => !v); setCamMenuOpen(false); setMoreMenuOpen(false); }}
                className="hidden sm:block px-1.5 border-l border-white/[0.06] text-white/40 hover:text-white transition-colors"
                title="Audio devices"
              >
                <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', micMenuOpen && 'rotate-180')} />
              </button>
            </div>
            {micMenuOpen && (
              <Dropdown onClose={() => setMicMenuOpen(false)}>
                {state.audioInputs.map((dev) => (
                  <DropdownItem
                    key={dev.deviceId}
                    active={state.selectedMicId === dev.deviceId}
                    onClick={() => { switchDevice('audio', dev.deviceId); setMicMenuOpen(false); }}
                  >
                    {dev.label}
                  </DropdownItem>
                ))}
                {state.audioInputs.length === 0 && <div className="px-3 py-2 text-xs text-white/30">No devices</div>}
              </Dropdown>
            )}
          </div>

          {/* Camera */}
          <div className="relative">
            <div className="flex items-center rounded-xl bg-[#18181b] overflow-hidden">
              <DockButton
                active={props.camOn}
                onClick={props.onToggleCam}
                icon={props.camOn ? <Video className="w-4 h-4 sm:w-5 sm:h-5" /> : <VideoOff className="w-4 h-4 sm:w-5 sm:h-5" />}
                danger={!props.camOn}
                label={props.camOn ? 'Stop Video' : 'Start Video'}
              />
              <button
                onClick={() => { setCamMenuOpen((v) => !v); setMicMenuOpen(false); setMoreMenuOpen(false); }}
                className="hidden sm:block px-1.5 border-l border-white/[0.06] text-white/40 hover:text-white transition-colors"
                title="Video devices"
              >
                <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', camMenuOpen && 'rotate-180')} />
              </button>
            </div>
            {camMenuOpen && (
              <Dropdown onClose={() => setCamMenuOpen(false)}>
                {state.videoInputs.map((dev) => (
                  <DropdownItem
                    key={dev.deviceId}
                    active={state.selectedCamId === dev.deviceId}
                    onClick={() => { switchDevice('video', dev.deviceId); setCamMenuOpen(false); }}
                  >
                    {dev.label}
                  </DropdownItem>
                ))}
                {state.videoInputs.length === 0 && <div className="px-3 py-2 text-xs text-white/30">No devices</div>}
              </Dropdown>
            )}
          </div>

          <Divider />

          {/* Desktop-only: Screen Share */}
          <div className="hidden sm:block">
            <DockButton
              active={!props.isScreenSharing}
              onClick={props.onToggleScreen}
              icon={props.isScreenSharing ? <MonitorOff className="w-5 h-5" /> : <MonitorUp className="w-5 h-5" />}
              highlight={props.isScreenSharing}
              label={props.isScreenSharing ? 'Stop Share' : 'Share Screen'}
            />
          </div>

          {/* Desktop-only: Whiteboard */}
          <div className="hidden sm:block">
            <DockButton
              active={true}
              onClick={props.onToggleWhiteboard}
              icon={<PenTool className="w-5 h-5" />}
              highlight={props.whiteboardActive}
              badge={props.whiteboardActive}
              label="Whiteboard"
            />
          </div>

          {/* Chat */}
          <DockButton
            active={true}
            onClick={props.onToggleChat}
            icon={<MessageSquare className="w-4 h-4 sm:w-5 sm:h-5" />}
            badge={props.unreadCount > 0}
            badgeCount={props.unreadCount}
            label="Chat"
          />

          {/* Participants */}
          <DockButton
            active={true}
            onClick={props.onToggleParticipants}
            icon={<Users className="w-4 h-4 sm:w-5 sm:h-5" />}
            badge={props.participantCount > 1}
            badgeCount={props.participantCount}
            label="People"
          />

          {/* Mobile "More" Menu for Whiteboard & Screen Share */}
          <div className="relative sm:hidden">
            <DockButton
              active={false}
              onClick={() => setMoreMenuOpen((v) => !v)}
              icon={<MoreHorizontal className="w-4 h-4" />}
              highlight={props.whiteboardActive || props.isScreenSharing}
              label="More tools"
            />
            {moreMenuOpen && (
              <div
                className="absolute bottom-full mb-3 right-0 w-48 rounded-2xl bg-[#18181b] border border-white/[0.12] shadow-2xl p-1.5 z-50 space-y-1 animate-in fade-in zoom-in-95 duration-100"
                onClick={() => setMoreMenuOpen(false)}
              >
                <button
                  onClick={props.onToggleWhiteboard}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-2.5 transition-colors",
                    props.whiteboardActive ? "bg-emerald-500/15 text-emerald-400" : "text-white/80 hover:bg-white/5"
                  )}
                >
                  <PenTool className="w-4 h-4" /> Whiteboard
                </button>
                <button
                  onClick={props.onToggleScreen}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-2.5 transition-colors",
                    props.isScreenSharing ? "bg-cyan-500/15 text-cyan-400" : "text-white/80 hover:bg-white/5"
                  )}
                >
                  <MonitorUp className="w-4 h-4" /> {props.isScreenSharing ? 'Stop Screen Share' : 'Share Screen'}
                </button>
              </div>
            )}
          </div>

          <Divider />

          {/* Leave Button */}
          <button
            onClick={() => setConfirmLeave(true)}
            className="flex items-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-red-500 hover:bg-red-400 text-white font-medium text-xs sm:text-sm transition-all shadow-md shadow-red-500/20 active:scale-95"
            title="Leave Meeting"
          >
            <PhoneOff className="w-4 h-4" />
            <span className="hidden md:inline">Leave</span>
          </button>
        </div>
      </div>

      {/* Leave confirmation modal */}
      {confirmLeave && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="rounded-2xl bg-[#121215] border border-white/[0.08] p-6 max-w-sm w-full shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center">
                <PhoneOff className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Leave the meeting?</h3>
                <p className="text-sm text-white/40">
                  {props.isHost
                    ? 'As the host, you can leave or end the meeting for everyone.'
                    : 'You can rejoin anytime with the room code.'}
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {props.isHost && props.onEndMeetingForAll && (
                <button
                  onClick={() => {
                    setConfirmLeave(false);
                    props.onEndMeetingForAll?.();
                  }}
                  className="w-full py-2.5 rounded-xl bg-red-500 hover:bg-red-400 text-white text-sm font-semibold transition-colors shadow-lg shadow-red-500/20"
                >
                  End Meeting for All
                </button>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmLeave(false)}
                  className="flex-1 py-2.5 rounded-xl bg-[#18181b] border border-white/[0.08] text-white/70 hover:text-white text-sm font-medium transition-colors"
                >
                  Stay
                </button>
                <button
                  onClick={() => {
                    setConfirmLeave(false);
                    props.onLeave();
                  }}
                  className={cn(
                    "flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors",
                    props.isHost
                      ? "bg-white/10 hover:bg-white/15 text-white"
                      : "bg-red-500 hover:bg-red-400 text-white shadow-md shadow-red-500/20"
                  )}
                >
                  {props.isHost ? 'Leave Only' : 'Leave Now'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function DockButton({
  active, onClick, icon, danger, highlight, badge, badgeCount, label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  danger?: boolean;
  highlight?: boolean;
  badge?: boolean;
  badgeCount?: number;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={cn(
        'relative p-2.5 rounded-xl transition-all',
        danger
          ? 'bg-red-500/15 text-red-400 hover:bg-red-500/25'
          : highlight
            ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25'
            : active
              ? 'bg-[#18181b] text-white hover:bg-white/5'
              : 'bg-[#18181b] text-white/60 hover:text-white hover:bg-white/5'
      )}
    >
      {icon}
      {badge && badgeCount && badgeCount > 0 ? (
        <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
          {badgeCount > 99 ? '99+' : badgeCount}
        </span>
      ) : badge ? (
        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#121215]" />
      ) : null}
    </button>
  );
}

function Divider() {
  return <div className="w-px h-7 bg-white/[0.08] mx-0.5" />;
}

function Dropdown({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);
  return (
    <div ref={ref} className="absolute bottom-full mb-2 left-0 w-56 rounded-xl bg-[#18181b] border border-white/[0.08] shadow-2xl p-1.5 z-10">
      {children}
    </div>
  );
}

function DropdownItem({ children, active, onClick }: { children: React.ReactNode; active?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left px-2.5 py-2 rounded-lg text-sm transition-colors truncate',
        active ? 'bg-emerald-500/15 text-emerald-400' : 'text-white/70 hover:bg-white/5'
      )}
    >
      {children}
    </button>
  );
}

