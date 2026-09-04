import { Activity, ShieldCheck, Zap, Wifi, WifiOff } from 'lucide-react';
import type { NetworkStats } from '@/lib/types';
import { usePeerStats } from '@/hooks/usePeerStats';
import { cn } from '@/lib/utils';
import { useState } from 'react';

type Props = {
  /** Ref to the live RTCPeerConnection map from useWebRTC. */
  peersRef: React.RefObject<Map<string, RTCPeerConnection>>;
};

/**
 * Real-time Network Diagnostics HUD.
 * Reads actual RTCPeerConnection getStats() data via the usePeerStats hook.
 * Falls back gracefully when no peers are connected (shows "--" for each metric).
 */
export function NetworkStatsHUD({ peersRef }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const stats: NetworkStats = usePeerStats(peersRef);

  const hasPeer = (peersRef.current?.size ?? 0) > 0;

  const qualityColors = {
    excellent: {
      btn: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20',
      badge: 'bg-emerald-500/20 text-emerald-300',
      dot: 'bg-emerald-500',
      ping: 'bg-emerald-400',
    },
    good: {
      btn: 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/20',
      badge: 'bg-cyan-500/20 text-cyan-300',
      dot: 'bg-cyan-500',
      ping: 'bg-cyan-400',
    },
    fair: {
      btn: 'bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500/20',
      badge: 'bg-amber-500/20 text-amber-300',
      dot: 'bg-amber-500',
      ping: 'bg-amber-400',
    },
    poor: {
      btn: 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20',
      badge: 'bg-red-500/20 text-red-300',
      dot: 'bg-red-500',
      ping: 'bg-red-400',
    },
  };

  const colors = hasPeer ? qualityColors[stats.quality] : qualityColors.fair;
  const displayPing = hasPeer && stats.ping > 0 ? `${stats.ping}ms` : '--';

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen((v) => !v)}
        className={cn(
          'flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-xl border text-xs font-mono transition-all',
          hasPeer ? colors.btn : 'bg-white/[0.04] border-white/10 text-white/40 hover:bg-white/[0.07]'
        )}
        title="Network Diagnostics & Latency"
      >
        {hasPeer ? (
          <span className="relative flex h-2 w-2">
            <span className={cn('animate-ping absolute inline-flex h-full w-full rounded-full opacity-75', colors.ping)} />
            <span className={cn('relative inline-flex rounded-full h-2 w-2', colors.dot)} />
          </span>
        ) : (
          <WifiOff className="w-3.5 h-3.5 text-white/30" />
        )}
        <span className="hidden sm:inline font-sans font-medium text-[11px]">
          {hasPeer ? (stats.resolution ?? 'HD') : 'No peer'}
        </span>
        <span>{displayPing}</span>
      </button>

      {isOpen && (
        <div
          className="absolute right-0 top-full mt-2 w-72 rounded-2xl bg-[#18181b]/95 backdrop-blur-xl border border-white/[0.12] shadow-2xl p-3 z-50 space-y-2.5 animate-in fade-in zoom-in-95 duration-100"
          onMouseLeave={() => setIsOpen(false)}
        >
          <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
              <Activity className="w-3.5 h-3.5 text-emerald-400" /> Network Diagnostics
            </div>
            {hasPeer ? (
              <span className={cn('px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase', colors.badge)}>
                {stats.quality}
              </span>
            ) : (
              <span className="px-1.5 py-0.5 rounded-md bg-white/[0.06] text-white/30 text-[10px] font-bold uppercase">
                waiting
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            {/* RTT */}
            <div className="rounded-xl bg-white/[0.03] p-2 border border-white/[0.04]">
              <span className="text-white/40 block text-[10px] mb-0.5">Round Trip (RTT)</span>
              <span className={cn(
                'font-mono text-sm font-semibold',
                hasPeer && stats.ping > 0 ? colors.badge.split(' ')[1] : 'text-white/30'
              )}>
                {hasPeer && stats.ping > 0 ? `${stats.ping} ms` : '--'}
              </span>
            </div>

            {/* FPS */}
            <div className="rounded-xl bg-white/[0.03] p-2 border border-white/[0.04]">
              <span className="text-white/40 block text-[10px] mb-0.5">Frame Rate</span>
              <span className="font-mono text-sm font-semibold text-white">
                {hasPeer && stats.fps > 0 ? `${stats.fps} FPS` : '--'}
              </span>
            </div>

            {/* Packet Loss */}
            <div className="rounded-xl bg-white/[0.03] p-2 border border-white/[0.04]">
              <span className="text-white/40 block text-[10px] mb-0.5">Packet Loss</span>
              <span className={cn(
                'font-mono text-sm font-semibold',
                !hasPeer ? 'text-white/30' :
                stats.packetLoss === 0 ? 'text-emerald-400' :
                stats.packetLoss < 3 ? 'text-amber-400' : 'text-red-400'
              )}>
                {hasPeer ? `${stats.packetLoss}%` : '--'}
              </span>
            </div>

            {/* Bitrate */}
            <div className="rounded-xl bg-white/[0.03] p-2 border border-white/[0.04]">
              <span className="text-white/40 block text-[10px] mb-0.5">Bitrate (in)</span>
              <span className="font-mono text-sm font-semibold text-cyan-400">
                {hasPeer && stats.bitrate != null && stats.bitrate > 0
                  ? stats.bitrate >= 1000
                    ? `${(stats.bitrate / 1000).toFixed(1)} Mbps`
                    : `${stats.bitrate} kbps`
                  : '--'}
              </span>
            </div>

            {/* Resolution */}
            <div className="rounded-xl bg-white/[0.03] p-2 border border-white/[0.04]">
              <span className="text-white/40 block text-[10px] mb-0.5">Resolution</span>
              <span className="font-mono text-sm font-semibold text-white">
                {hasPeer && stats.resolution ? stats.resolution : '--'}
              </span>
            </div>

            {/* Codec */}
            <div className="rounded-xl bg-white/[0.03] p-2 border border-white/[0.04]">
              <span className="text-white/40 block text-[10px] mb-0.5">Video Codec</span>
              <span className="font-mono text-sm font-semibold text-white">
                {hasPeer && stats.codec ? stats.codec : '--'}
              </span>
            </div>
          </div>

          <div className="pt-1 flex items-center justify-between text-[11px] text-white/40 px-1 border-t border-white/[0.04]">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-400" /> DTLS-SRTP Encrypted
            </span>
            <span className="flex items-center gap-1">
              {hasPeer
                ? <><Zap className="w-3 h-3 text-amber-400" /> P2P Mesh</>
                : <><Wifi className="w-3 h-3 text-white/30" /> Waiting for peers</>
              }
            </span>
          </div>

          {!hasPeer && (
            <p className="text-[10px] text-white/25 text-center px-2">
              Live metrics appear once another participant joins the meeting.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
