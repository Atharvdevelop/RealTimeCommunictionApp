import { useEffect, useRef, useState } from 'react';
import type { NetworkStats } from '@/lib/types';

/**
 * Polls real WebRTC RTCPeerConnection stats from all active peer connections
 * every `intervalMs` milliseconds and returns aggregated NetworkStats.
 *
 * Stats are sourced from `candidate-pair` (RTT), `inbound-rtp` (packet loss,
 * fps, resolution, codec), and calculated bitrate from byte deltas.
 */
export function usePeerStats(
  peersRef: React.RefObject<Map<string, RTCPeerConnection>>,
  intervalMs = 2000,
): NetworkStats {
  const [stats, setStats] = useState<NetworkStats>({
    ping: 0,
    packetLoss: 0,
    fps: 0,
    quality: 'excellent',
  });

  // Track previous byte counts to calculate bitrate deltas
  const prevBytesRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    const collectStats = async () => {
      const peers = peersRef.current;
      if (!peers || peers.size === 0) return;

      let totalRtt = 0;
      let rttCount = 0;
      let totalPacketLoss = 0;
      let totalPackets = 0;
      let totalFps = 0;
      let fpsCount = 0;
      let totalBitrate = 0;
      let bitrateCount = 0;
      let bestResolution = '';
      let detectedCodec = '';

      for (const [peerId, pc] of peers) {
        if (pc.connectionState === 'closed' || pc.connectionState === 'failed') continue;

        try {
          const report = await pc.getStats();

          // Previous total bytes for this peer (for bitrate calc)
          const prevBytes = prevBytesRef.current.get(peerId) ?? 0;
          let currentBytes = 0;

          report.forEach((entry) => {
            // ─── Round-Trip Time ───────────────────────────────────────────
            if (
              entry.type === 'candidate-pair' &&
              (entry as RTCIceCandidatePairStats).state === 'succeeded' &&
              typeof (entry as RTCIceCandidatePairStats).currentRoundTripTime === 'number'
            ) {
              const pair = entry as RTCIceCandidatePairStats;
              if (pair.currentRoundTripTime! > 0) {
                totalRtt += pair.currentRoundTripTime! * 1000; // convert to ms
                rttCount++;
              }
            }

            // ─── Inbound RTP (video) ───────────────────────────────────────
            if (entry.type === 'inbound-rtp' && (entry as RTCInboundRtpStreamStats).kind === 'video') {
              const inbound = entry as RTCInboundRtpStreamStats;

              // Packet loss
              const lost = (inbound.packetsLost as number | undefined) ?? 0;
              const received = (inbound.packetsReceived as number | undefined) ?? 0;
              const total = lost + received;
              if (total > 0) {
                totalPacketLoss += lost;
                totalPackets += total;
              }

              // Frames per second
              const fps = (inbound as unknown as { framesPerSecond?: number }).framesPerSecond;
              if (typeof fps === 'number' && fps > 0) {
                totalFps += fps;
                fpsCount++;
              }

              // Resolution
              const w = (inbound as unknown as { frameWidth?: number }).frameWidth;
              const h = (inbound as unknown as { frameHeight?: number }).frameHeight;
              if (w && h && w > 0 && h > 0) {
                bestResolution = `${w}×${h}`;
              }

              // Bitrate (bytes received)
              const bytes = (inbound.bytesReceived as number | undefined) ?? 0;
              currentBytes += bytes;
            }

            // ─── Codec ────────────────────────────────────────────────────
            if (entry.type === 'codec' && !detectedCodec) {
              const codecEntry = entry as RTCStats & { mimeType?: string };
              const mime = codecEntry.mimeType ?? '';
              if (mime.startsWith('video/')) {
                detectedCodec = mime.replace('video/', '').toUpperCase();
              }
            }
          });

          // Bitrate = (bytes_now - bytes_prev) * 8 / interval_seconds → kbps
          const deltaBytes = currentBytes - prevBytes;
          if (deltaBytes >= 0 && prevBytes > 0) {
            const kbps = (deltaBytes * 8) / (intervalMs / 1000) / 1000;
            totalBitrate += kbps;
            bitrateCount++;
          }
          prevBytesRef.current.set(peerId, currentBytes);
        } catch {
          // Skip peers that error (e.g. closed mid-iteration)
        }
      }

      // Aggregate
      const avgRtt = rttCount > 0 ? Math.round(totalRtt / rttCount) : 0;
      const pktLossPct =
        totalPackets > 0
          ? parseFloat(((totalPacketLoss / totalPackets) * 100).toFixed(2))
          : 0;
      const avgFps = fpsCount > 0 ? Math.round(totalFps / fpsCount) : 0;
      const avgBitrate = bitrateCount > 0 ? Math.round(totalBitrate / bitrateCount) : 0;

      const quality: NetworkStats['quality'] =
        avgRtt < 80 && pktLossPct < 1
          ? 'excellent'
          : avgRtt < 150 && pktLossPct < 3
          ? 'good'
          : avgRtt < 300 && pktLossPct < 8
          ? 'fair'
          : 'poor';

      setStats({
        ping: avgRtt,
        packetLoss: pktLossPct,
        fps: avgFps,
        quality,
        bitrate: avgBitrate > 0 ? avgBitrate : undefined,
        resolution: bestResolution || undefined,
        codec: detectedCodec || undefined,
      });
    };

    const id = setInterval(collectStats, intervalMs);
    return () => clearInterval(id);
  }, [peersRef, intervalMs]);

  return stats;
}
