import { useState } from 'react';
import type { ReactionEvent } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Smile } from 'lucide-react';

const POPULAR_REACTIONS = ['👏', '❤️', '🎉', '🔥', '🚀', '💡', '👍', '😂'];

type Props = {
  reactions: ReactionEvent[];
  onSendReaction: (emoji: string) => void;
};

export function FloatingReactionsOverlay({ reactions }: { reactions: ReactionEvent[] }) {
  return (
    <div className="fixed inset-0 pointer-events-none z-40 overflow-hidden">
      {reactions.map((r) => (
        <div
          key={r.id}
          className="absolute bottom-20 left-1/2 flex flex-col items-center animate-float-up pointer-events-none"
          style={{
            transform: `translateX(calc(-50% + ${r.xOffset}px))`,
          }}
        >
          <span className="text-4xl sm:text-5xl filter drop-shadow-lg select-none">{r.emoji}</span>
          <span className="text-[10px] text-white/80 bg-black/60 backdrop-blur-sm px-1.5 py-0.5 rounded-full mt-1 whitespace-nowrap">
            {r.senderName}
          </span>
        </div>
      ))}
    </div>
  );
}

export function ReactionPicker({ onSendReaction }: { onSendReaction: (emoji: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);

  const handlePick = (emoji: string) => {
    onSendReaction(emoji);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen((v) => !v)}
        className={cn(
          "p-2.5 rounded-xl transition-all",
          isOpen ? "bg-amber-500/20 text-amber-300" : "bg-[#18181b] text-white/70 hover:text-white hover:bg-white/5"
        )}
        title="React with Emoji"
      >
        <Smile className="w-4 h-4 sm:w-5 sm:h-5" />
      </button>

      {isOpen && (
        <div
          className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 p-1.5 rounded-2xl bg-[#18181b]/95 backdrop-blur-2xl border border-white/[0.12] shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-100"
          onMouseLeave={() => setIsOpen(false)}
        >
          {POPULAR_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => handlePick(emoji)}
              className="p-1.5 rounded-xl hover:bg-white/10 hover:scale-125 transition-all text-xl sm:text-2xl active:scale-95"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function FloatingReactions({ reactions, onSendReaction }: Props) {
  return (
    <>
      <FloatingReactionsOverlay reactions={reactions} />
      <ReactionPicker onSendReaction={onSendReaction} />
    </>
  );
}
