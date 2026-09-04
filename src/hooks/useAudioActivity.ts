import { useEffect, useRef, useState } from 'react';

type Options = {
  /** Frequency bin RMS threshold (0-255 scale). Default: 30 (~-42 dBFS) */
  threshold?: number;
  /** Decay debounce ms: stay "speaking" this long after going below threshold. Default: 400ms */
  decayMs?: number;
};

/**
 * Real-time audio activity / speaking detection using the Web Audio API.
 *
 * Uses AnalyserNode FFT byte frequency data to compute an average energy
 * level and compares it against a configurable threshold. A debounced decay
 * prevents the indicator from flickering rapidly when the speaker pauses.
 *
 * @param stream - The MediaStream to analyse (should contain at least one audio track).
 * @param enabled - Whether the microphone is currently active.
 * @param options - Threshold and debounce configuration.
 * @returns `isSpeaking` boolean.
 */
export function useAudioActivity(
  stream: MediaStream | null,
  enabled: boolean,
  { threshold = 30, decayMs = 400 }: Options = {},
): boolean {
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Keep stable refs so the rAF loop doesn't recreate on every render
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const rafRef = useRef<number>(0);
  const decayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSpeakingRef = useRef(false);

  useEffect(() => {
    if (!stream || !enabled) {
      // Tear down and reset when mic is off or no stream
      cancelAnimationFrame(rafRef.current);
      if (decayTimerRef.current) clearTimeout(decayTimerRef.current);
      isSpeakingRef.current = false;
      setIsSpeaking(false);
      return;
    }

    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) return;

    let ctx = audioCtxRef.current;
    let analyser = analyserRef.current;

    try {
      // Only create a new AudioContext when the stream or context changes
      if (!ctx || ctx.state === 'closed') {
        ctx = new AudioContext({ latencyHint: 'interactive' });
        audioCtxRef.current = ctx;
      }

      if (!analyser || analyserRef.current === null) {
        analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.4;
        analyserRef.current = analyser;

        // Disconnect old source if stream changed
        try { sourceRef.current?.disconnect(); } catch { /* ignore */ }

        const source = ctx.createMediaStreamSource(new MediaStream([audioTrack]));
        source.connect(analyser);
        sourceRef.current = source;
      }
    } catch {
      return; // AudioContext not supported or permission denied
    }

    const data = new Uint8Array(analyser.frequencyBinCount);

    const tick = () => {
      analyser!.getByteFrequencyData(data);
      // Compute arithmetic mean of frequency bin magnitudes (RMS proxy)
      const avg = data.reduce((sum, v) => sum + v, 0) / data.length;

      if (avg > threshold) {
        // Active speech detected — cancel decay, mark speaking immediately
        if (decayTimerRef.current) {
          clearTimeout(decayTimerRef.current);
          decayTimerRef.current = null;
        }
        if (!isSpeakingRef.current) {
          isSpeakingRef.current = true;
          setIsSpeaking(true);
        }
      } else if (isSpeakingRef.current && !decayTimerRef.current) {
        // Below threshold — schedule decay to avoid flicker
        decayTimerRef.current = setTimeout(() => {
          isSpeakingRef.current = false;
          setIsSpeaking(false);
          decayTimerRef.current = null;
        }, decayMs);
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
      if (decayTimerRef.current) clearTimeout(decayTimerRef.current);
    };
  }, [stream, enabled, threshold, decayMs]);

  // Full cleanup on unmount
  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      if (decayTimerRef.current) clearTimeout(decayTimerRef.current);
      try { sourceRef.current?.disconnect(); } catch { /* ignore */ }
      audioCtxRef.current?.close().catch(() => {});
    };
  }, []);

  return isSpeaking;
}
