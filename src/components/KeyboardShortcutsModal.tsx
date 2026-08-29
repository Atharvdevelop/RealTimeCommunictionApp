import { X, Command } from 'lucide-react';

type Props = {
  onClose: () => void;
};

const SHORTCUTS = [
  { key: 'M', action: 'Toggle Microphone (Mute / Unmute)' },
  { key: 'V', action: 'Toggle Camera (Start / Stop Video)' },
  { key: 'Space', action: 'Push-to-Talk (Hold to speak)' },
  { key: 'H', action: 'Raise / Lower Hand ✋' },
  { key: 'C', action: 'Open / Close In-Meeting Chat' },
  { key: 'P', action: 'Open / Close Participants Panel' },
  { key: 'W', action: 'Open / Close Collaborative Whiteboard' },
  { key: 'S', action: 'Toggle Screen Sharing' },
  { key: 'Esc', action: 'Close any active panel / dialog' },
  { key: '?', action: 'Show this keyboard shortcuts guide' },
];

export function KeyboardShortcutsModal({ onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#121215] border border-white/[0.1] rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-white/40 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5 pb-2 border-b border-white/[0.06]">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
            <Command className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold font-display text-white">Keyboard Shortcuts</h3>
            <p className="text-xs text-white/40">Boost your meeting productivity</p>
          </div>
        </div>

        <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
          {SHORTCUTS.map((item) => (
            <div
              key={item.key}
              className="flex items-center justify-between p-2 rounded-xl bg-white/[0.02] border border-white/[0.04] text-xs"
            >
              <span className="text-white/80">{item.action}</span>
              <kbd className="px-2.5 py-1 rounded-lg bg-[#18181b] border border-white/[0.1] text-emerald-400 font-mono font-semibold shadow-sm text-[11px]">
                {item.key}
              </kbd>
            </div>
          ))}
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-semibold transition-colors"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
