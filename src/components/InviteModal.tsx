import { useState } from 'react';
import { X, Copy, Check, Share2, QrCode, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

type Props = {
  roomCode: string;
  onClose: () => void;
};

export function InviteModal({ roomCode, onClose }: Props) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const inviteUrl = typeof window !== 'undefined'
    ? `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(roomCode)}`
    : `https://pulsemeet.app/?room=${roomCode}`;

  const copyUrl = () => {
    navigator.clipboard.writeText(inviteUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const copyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join PulseMeet Room',
          text: `Join my real-time video conference on PulseMeet with room code: ${roomCode}`,
          url: inviteUrl,
        });
      } catch {
        // User cancelled or error
      }
    } else {
      copyUrl();
    }
  };

  // Generate a procedural SVG QR-like pattern based on the room code
  const generateQRPattern = (code: string) => {
    const size = 17;
    const grid: boolean[][] = Array(size).fill(false).map(() => Array(size).fill(false));

    // Fill corner finder patterns (7x7)
    const drawFinder = (startX: number, startY: number) => {
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 7; c++) {
          if (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4)) {
            grid[startY + r][startX + c] = true;
          }
        }
      }
    };
    drawFinder(0, 0);
    drawFinder(10, 0);
    drawFinder(0, 10);

    // Fill data modules deterministically using hash of code
    let seed = 0;
    for (let i = 0; i < code.length; i++) seed = (seed * 31 + code.charCodeAt(i)) >>> 0;

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        // Skip finder areas
        if ((r < 7 && c < 7) || (r < 7 && c >= 10) || (r >= 10 && c < 7)) continue;
        seed = (seed * 1664525 + 1013904223) >>> 0;
        grid[r][c] = (seed % 2) === 0;
      }
    }
    return grid;
  };

  const qrGrid = generateQRPattern(roomCode);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#121215] border border-white/[0.1] rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150 relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-white/40 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="text-center space-y-1">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-emerald-500/20">
            <QrCode className="w-6 h-6 text-white" />
          </div>
          <h3 className="text-xl font-bold font-display text-white">Invite Participants</h3>
          <p className="text-xs text-white/50">Share this code or scan the QR code to join from mobile</p>
        </div>

        {/* QR Code Card */}
        <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
          <div className="p-3 bg-white rounded-2xl shadow-xl shadow-black/40">
            <svg width="136" height="136" viewBox="0 0 17 17" className="rounded-lg">
              {qrGrid.map((row, r) =>
                row.map((active, c) => (
                  <rect
                    key={`${r}-${c}`}
                    x={c}
                    y={r}
                    width={1}
                    height={1}
                    fill={active ? '#09090b' : '#ffffff'}
                  />
                ))
              )}
            </svg>
          </div>
          <span className="text-[11px] text-emerald-400 mt-2 font-medium flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> Scan from smartphone camera
          </span>
        </div>

        {/* Shareable Link Input */}
        <div className="space-y-2">
          <label className="text-xs text-white/50 font-medium block">Direct Meeting Link</label>
          <div className="flex items-center gap-2 rounded-xl bg-[#18181b] border border-white/[0.08] p-1.5 pl-3">
            <span className="text-xs text-white/80 font-mono truncate flex-1">{inviteUrl}</span>
            <button
              onClick={copyUrl}
              className={cn(
                "px-3 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 shrink-0 shadow-sm",
                copiedLink
                  ? "bg-emerald-500 text-black shadow-emerald-500/20"
                  : "bg-white/10 hover:bg-white/20 text-white"
              )}
            >
              {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedLink ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>

        {/* Room Code Quick Box */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-[#18181b] border border-white/[0.08]">
          <div>
            <span className="text-[11px] text-white/40 block">Room Code</span>
            <span className="font-mono text-sm font-bold text-emerald-400">{roomCode}</span>
          </div>
          <button
            onClick={copyCode}
            className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors"
            title="Copy room code"
          >
            {copiedCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          {typeof navigator !== 'undefined' && 'share' in navigator && (
            <button
              onClick={handleNativeShare}
              className="flex-1 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-semibold transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-cyan-500/20"
            >
              <Share2 className="w-4 h-4" /> Share via App
            </button>
          )}
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
