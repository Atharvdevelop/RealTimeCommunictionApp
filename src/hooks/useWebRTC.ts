import { useEffect, useRef, useState, useCallback } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { PresenceState } from '@/lib/types';

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ],
  iceCandidatePoolSize: 10,
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

    // Add local tracks to peer connection
    if (activeStreamRef.current) {
      activeStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, activeStreamRef.current!);
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

    // Remote track received
    pc.ontrack = (event) => {
      const [stream] = event.streams;
      if (stream) {
        setRemoteStreams((prev) => ({
          ...prev,
          [peerId]: stream,
        }));
      } else if (event.track) {
        setRemoteStreams((prev) => {
          const existing = prev[peerId] || new MediaStream();
          if (!existing.getTracks().some((t) => t.id === event.track.id)) {
            existing.addTrack(event.track);
          }
          return {
            ...prev,
            [peerId]: existing,
          };
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        // Clean up remote stream if closed
        if (pc.connectionState === 'closed') {
          setRemoteStreams((prev) => {
            const next = { ...prev };
            delete next[peerId];
            return next;
          });
        }
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

    const handleSignal = async ({ payload }: { payload: any }) => {
      if (!payload || payload.to !== userId) return;
      const { from: peerId, signal } = payload;
      if (!peerId || !signal) return;

      try {
        if (signal.type === 'offer') {
          let pc = peersRef.current.get(peerId);
          if (!pc || pc.signalingState !== 'stable') {
            pc = createPeerConnection(peerId);
          }

          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));

          // Process queued ICE candidates
          const queued = pendingCandidatesRef.current.get(peerId) || [];
          for (const cand of queued) {
            await pc.addIceCandidate(new RTCIceCandidate(cand));
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
        } else if (signal.type === 'answer') {
          const pc = peersRef.current.get(peerId);
          if (pc && pc.signalingState === 'have-local-offer') {
            await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));

            // Process queued candidates
            const queued = pendingCandidatesRef.current.get(peerId) || [];
            for (const cand of queued) {
              await pc.addIceCandidate(new RTCIceCandidate(cand));
            }
            pendingCandidatesRef.current.delete(peerId);
          }
        } else if (signal.type === 'candidate' && signal.candidate) {
          const pc = peersRef.current.get(peerId);
          if (pc && pc.remoteDescription && pc.remoteDescription.type) {
            await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
          } else {
            // Queue candidate until remote description is set
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
      // Channel cleanup listener handled by Supabase
    };
  }, [channel, userId, createPeerConnection]);

  // Connect to new participants when joined
  useEffect(() => {
    if (!channel || !activeStream) return;

    const remoteParticipants = participants.filter((p) => p.id !== userId);

    remoteParticipants.forEach((p) => {
      // Polite peer initiation rule: peer with alphabetically higher ID sends offer
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
        const sender = senders.find((s) => s.track && s.track.kind === track.kind);
        if (sender) {
          sender.replaceTrack(track);
        } else {
          try {
            pc.addTrack(track, activeStream);
          } catch {
            // track might already be added
          }
        }
      });
    });
  }, [activeStream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      peersRef.current.forEach((pc) => pc.close());
      peersRef.current.clear();
      pendingCandidatesRef.current.clear();
    };
  }, []);

  return { remoteStreams };
}
