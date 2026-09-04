import { useEffect, useRef, useState, useCallback } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { PresenceState } from '@/lib/types';
import { RTC_CONFIG } from '@/lib/webrtc-config';


type SignalPayload = {
  from: string;
  to: string;
  signal: {
    type: 'offer' | 'answer' | 'candidate';
    sdp?: RTCSessionDescriptionInit;
    candidate?: RTCIceCandidateInit;
  };
};

type UseWebRTCProps = {
  channel: RealtimeChannel | null;
  localStream: MediaStream | null;
  screenStream: MediaStream | null;
  isScreenSharing: boolean;
  userId: string;
  participants: PresenceState[];
};

export function useWebRTC({
  channel,
  localStream,
  screenStream,
  isScreenSharing,
  userId,
  participants,
}: UseWebRTCProps) {
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const activeStreamRef = useRef<MediaStream | null>(null);
  // Track ICE restart debounce timers per peer
  const iceRestartTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Active outgoing stream (screen share or camera/mic)
  const activeStream = isScreenSharing && screenStream ? screenStream : localStream;
  activeStreamRef.current = activeStream;

  // Helper to create and setup a peer connection
  const createPeerConnection = useCallback((peerId: string): RTCPeerConnection => {
    // If an existing PC exists, close and replace
    if (peersRef.current.has(peerId)) {
      peersRef.current.get(peerId)?.close();
      peersRef.current.delete(peerId);
    }

    const pc = new RTCPeerConnection(RTC_CONFIG);
    peersRef.current.set(peerId, pc);

    // Attach active local tracks to peer connection
    if (activeStreamRef.current) {
      activeStreamRef.current.getTracks().forEach((track) => {
        try {
          pc.addTrack(track, activeStreamRef.current!);
        } catch {
          // ignore if already added
        }
      });
    }

    // ICE Candidate generation
    pc.onicecandidate = (event) => {
      if (event.candidate && channel) {
        channel.send({
          type: 'broadcast',
          event: 'webrtc:signal',
          payload: {
            from: userId,
            to: peerId,
            signal: {
              type: 'candidate',
              candidate: event.candidate.toJSON(),
            },
          },
        });
      }
    };

    // ─── ICE Connection State: auto-restart on failure ────────────────────
    let iceRestartPending = false;
    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      if (state === 'failed' || state === 'disconnected') {
        // Debounce: wait 4s before restarting ICE (handles transient blips)
        const existing = iceRestartTimersRef.current.get(peerId);
        if (existing) clearTimeout(existing);
        const timer = setTimeout(async () => {
          iceRestartTimersRef.current.delete(peerId);
          // Only restart if connection is still degraded and we're still tracking this peer
          if (!peersRef.current.has(peerId)) return;
          const currentState = pc.iceConnectionState;
          if (currentState !== 'failed' && currentState !== 'disconnected') return;
          if (iceRestartPending) return;
          iceRestartPending = true;
          try {
            const offer = await pc.createOffer({ iceRestart: true });
            await pc.setLocalDescription(offer);
            channel?.send({
              type: 'broadcast',
              event: 'webrtc:signal',
              payload: {
                from: userId,
                to: peerId,
                signal: { type: 'offer', sdp: pc.localDescription },
              },
            });
            console.info(`[WebRTC] ICE restart initiated for peer ${peerId} (state: ${currentState})`);
          } catch (err) {
            console.warn(`[WebRTC] ICE restart failed for peer ${peerId}:`, err);
          } finally {
            iceRestartPending = false;
          }
        }, 4000);
        iceRestartTimersRef.current.set(peerId, timer);
      } else if (state === 'connected' || state === 'completed') {
        // Clear any pending restart timer if connection recovers on its own
        const existing = iceRestartTimersRef.current.get(peerId);
        if (existing) {
          clearTimeout(existing);
          iceRestartTimersRef.current.delete(peerId);
        }
        iceRestartPending = false;
      }
    };

    // Remote track received
    pc.ontrack = (event) => {
      setRemoteStreams((prev) => {
        const existingStream = prev[peerId];
        const existingTracks = existingStream ? existingStream.getTracks() : [];
        const incomingTracks = event.streams && event.streams[0] ? event.streams[0].getTracks() : [event.track];
        
        // Merge unique tracks
        const trackMap = new Map<string, MediaStreamTrack>();
        existingTracks.forEach((t) => trackMap.set(t.id, t));
        incomingTracks.forEach((t) => trackMap.set(t.id, t));
        
        return {
          ...prev,
          [peerId]: new MediaStream(Array.from(trackMap.values())),
        };
      });
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'closed' || pc.connectionState === 'failed') {
        setRemoteStreams((prev) => {
          const next = { ...prev };
          delete next[peerId];
          return next;
        });
      }
    };

    return pc;
  }, [channel, userId]);


  // Initiate call to remote peer
  const callPeer = useCallback(async (peerId: string) => {
    if (!channel) return;
    try {
      const pc = createPeerConnection(peerId);
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      await pc.setLocalDescription(offer);

      channel.send({
        type: 'broadcast',
        event: 'webrtc:signal',
        payload: {
          from: userId,
          to: peerId,
          signal: {
            type: 'offer',
            sdp: pc.localDescription,
          },
        },
      });
    } catch (err) {
      console.warn(`[WebRTC] Error calling peer ${peerId}:`, err);
    }
  }, [channel, userId, createPeerConnection]);

  // Handle incoming signaling messages
  useEffect(() => {
    if (!channel) return;

    const handleSignal = async ({ payload }: { payload: unknown }) => {
      const p = payload as SignalPayload;
      if (!p || p.to !== userId) return;
      const { from: peerId, signal } = p;
      if (!peerId || !signal) return;

      try {
        if (signal.type === 'offer' && signal.sdp) {
          let pc = peersRef.current.get(peerId);
          if (!pc || pc.signalingState !== 'stable') {
            pc = createPeerConnection(peerId);
          }

          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));

          // Process queued ICE candidates
          const queued = pendingCandidatesRef.current.get(peerId) || [];
          for (const cand of queued) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(cand));
            } catch (e) {
              console.warn('[WebRTC] Error adding queued candidate:', e);
            }
          }
          pendingCandidatesRef.current.delete(peerId);

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          channel.send({
            type: 'broadcast',
            event: 'webrtc:signal',
            payload: {
              from: userId,
              to: peerId,
              signal: {
                type: 'answer',
                sdp: pc.localDescription,
              },
            },
          });
        } else if (signal.type === 'answer' && signal.sdp) {
          const pc = peersRef.current.get(peerId);
          if (pc && pc.signalingState === 'have-local-offer') {
            await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));

            // Process queued candidates
            const queued = pendingCandidatesRef.current.get(peerId) || [];
            for (const cand of queued) {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(cand));
              } catch (e) {
                console.warn('[WebRTC] Error adding queued candidate on answer:', e);
              }
            }
            pendingCandidatesRef.current.delete(peerId);
          }
        } else if (signal.type === 'candidate' && signal.candidate) {
          const pc = peersRef.current.get(peerId);
          if (pc && pc.remoteDescription && pc.remoteDescription.type) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
            } catch (e) {
              console.warn('[WebRTC] Error adding candidate:', e);
            }
          } else {
            const current = pendingCandidatesRef.current.get(peerId) || [];
            current.push(signal.candidate);
            pendingCandidatesRef.current.set(peerId, current);
          }
        }
      } catch (err) {
        console.warn(`[WebRTC] Error handling signal from ${peerId}:`, err);
      }
    };

    channel.on('broadcast', { event: 'webrtc:signal' }, handleSignal);

    return () => {
      // Supabase handles listener removal on channel unsubscribe
    };
  }, [channel, userId, createPeerConnection]);

  // Connect to new participants when joined
  useEffect(() => {
    if (!channel || !activeStream) return;

    const remoteParticipants = participants.filter((p) => p.id !== userId);

    remoteParticipants.forEach((p) => {
      // Deterministic initiator: peer with alphabetically higher ID initiates call
      if (userId > p.id) {
        if (!peersRef.current.has(p.id)) {
          callPeer(p.id);
        }
      }
    });

    // Clean up peers that left
    const remoteIds = new Set(remoteParticipants.map((p) => p.id));
    peersRef.current.forEach((pc, peerId) => {
      if (!remoteIds.has(peerId)) {
        pc.close();
        peersRef.current.delete(peerId);
        setRemoteStreams((prev) => {
          const next = { ...prev };
          delete next[peerId];
          return next;
        });
      }
    });
  }, [participants, userId, channel, activeStream, callPeer]);

  // Update tracks across peer connections when local stream changes
  useEffect(() => {
    if (!activeStream) return;

    peersRef.current.forEach((pc) => {
      const senders = pc.getSenders();
      activeStream.getTracks().forEach((track) => {
        const sender = senders.find((s) => s.track?.kind === track.kind);
        if (sender) {
          sender.replaceTrack(track).catch(() => {});
        } else {
          try {
            pc.addTrack(track, activeStream);
          } catch {
            // track already added
          }
        }
      });
    });
  }, [activeStream]);

  // Cleanup on unmount
  useEffect(() => {
    const peers = peersRef.current;
    const pendingCandidates = pendingCandidatesRef.current;
    const iceRestartTimers = iceRestartTimersRef.current;
    return () => {
      peers.forEach((pc) => pc.close());
      peers.clear();
      pendingCandidates.clear();
      iceRestartTimers.forEach((t) => clearTimeout(t));
      iceRestartTimers.clear();
    };
  }, []);

  // ─── Adaptive Bitrate Constraints ──────────────────────────────────────────
  // Reduce video bitrate caps as participant count grows to maintain quality under load.
  useEffect(() => {
    const peerCount = participants.length;
    // Bitrate caps in bits/second
    const maxBitrateBps =
      peerCount <= 2 ? 1_500_000 :  // 1:1 → 1.5 Mbps
      peerCount <= 4 ? 600_000 :    // small group → 600 kbps
      250_000;                       // 5+ peers → 250 kbps
    const degradation: RTCDegradationPreference = activeStreamRef.current
      ?.getVideoTracks()[0]
      ?.getSettings().displaySurface
      ? 'maintain-framerate'         // screen share: keep fps, drop resolution
      : 'balanced';                  // webcam: balance both

    peersRef.current.forEach((pc) => {
      pc.getSenders().forEach((sender) => {
        if (sender.track?.kind !== 'video') return;
        const params = sender.getParameters();
        if (!params.encodings || params.encodings.length === 0) {
          params.encodings = [{}];
        }
        params.encodings.forEach((enc) => {
          enc.maxBitrate = maxBitrateBps;
          // degradationPreference is a non-standard extension in some browsers;
          // cast to any to avoid strict-lib errors while still sending the hint.
          (enc as RTCRtpEncodingParameters & { degradationPreference?: string }).degradationPreference = degradation;
        });
        sender.setParameters(params).catch(() => {
          // Some browsers don't support setParameters mid-call; ignore
        });
      });
    });
  }, [participants.length]);


  return { remoteStreams, peersRef };
}
