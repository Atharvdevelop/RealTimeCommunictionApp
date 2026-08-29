import { useEffect, useState } from 'react';
import { Activity, ShieldCheck, Zap } from 'lucide-react';
import type { NetworkStats } from '@/lib/types';
import { cn } from '@/lib/utils';

export function NetworkStatsHUD() {
  const [isOpen, setIsOpen] = useState(false);
  const [stats, setStats] = useState<NetworkStats>({
    ping: 24,
    packetLoss: 0,
    fps: 60,
    quality: 'excellent',
  });

  // Simulated live WebRTC RTCPeerConnection stats update
  useEffect(() => {
    const interval = setInterval(() => {
      // Small realistic jitter
      const jitter = Math.floor(Math.random() * 8) - 4;
      const basePing = 22;
      const currentPing = Math.max(12, basePing + jitter);
      const fps = 58 + Math.floor(Math.random() * 3);
      const packetLoss = Math.random() < 0.05 ? 0.1 : 0.0;

      setStats({
        ping: currentPing,
        packetLoss,
        fps,
        quality: currentPing < 45 ? 'excellent' : currentPing < 90 ? 'good' : 'fair',
      });
    }, 2500);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen((v) => !v)}
        className={cn(
          "flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-xl border text-xs font-mono transition-all",
          stats.quality === 'excellent' && "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20",
          stats.quality === 'good' && "bg-cyan-500/10 border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/20",
          stats.quality === 'fair' && "bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500/20"
        )}
        title="Network Diagnostics & Latency"
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
        <span className="hidden sm:inline font-sans font-medium text-[11px]">HD</span>
        <span>{stats.ping}ms</span>
      </button>

      {isOpen && (
        <div
          className="absolute right-0 top-full mt-2 w-64 rounded-2xl bg-[#18181b]/95 backdrop-blur-xl border border-white/[0.12] shadow-2xl p-3 z-50 space-y-2.5 animate-in fade-in zoom-in-95 duration-100"
          onMouseLeave={() => setIsOpen(false)}
        >
          <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
              <Activity className="w-3.5 h-3.5 text-emerald-400" /> Network Diagnostics
            </div>
            <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-[10px] font-bold uppercase">
              {stats.quality}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-xl bg-white/[0.03] p-2 border border-white/[0.04]">
              <span className="text-white/40 block text-[10px] mb-0.5">Round Trip (RTT)</span>
              <span className="font-mono text-sm font-semibold text-emerald-400">{stats.ping} ms</span>
            </div>
            <div className="rounded-xl bg-white/[0.03] p-2 border border-white/[0.04]">
              <span className="text-white/40 block text-[10px] mb-0.5">Frame Rate</span>
              <span className="font-mono text-sm font-semibold text-white">{stats.fps} FPS</span>
            </div>
            <div className="rounded-xl bg-white/[0.03] p-2 border border-white/[0.04]">
              <span className="text-white/40 block text-[10px] mb-0.5">Packet Loss</span>
              <span className="font-mono text-sm font-semibold text-white">{stats.packetLoss}%</span>
            </div>
            <div className="rounded-xl bg-white/[0.03] p-2 border border-white/[0.04]">
              <span className="text-white/40 block text-[10px] mb-0.5">Resolution</span>
              <span className="font-mono text-sm font-semibold text-cyan-400">1080p HD</span>
            </div>
          </div>

          <div className="pt-1 flex items-center justify-between text-[11px] text-white/40 px-1 border-t border-white/[0.04]">
            <span className="flex items-center gap-1"><ShieldCheck className="w-3 h-3 text-emerald-400" /> DTLS-SRTP Encrypted</span>
            <span className="flex items-center gap-1"><Zap className="w-3 h-3 text-amber-400" /> P2P Mesh</span>
          </div>
        </div>
      )}
    </div>
  );
}
