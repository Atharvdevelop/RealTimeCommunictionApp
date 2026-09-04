import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAudioActivity } from './useAudioActivity';

/**
 * useAudioActivity tests.
 * We mock the Web Audio API since jsdom does not implement it.
 */

type MockAnalyser = {
  fftSize: number;
  smoothingTimeConstant: number;
  frequencyBinCount: number;
  getByteFrequencyData: ReturnType<typeof vi.fn>;
  connect: ReturnType<typeof vi.fn>;
};

const mockAnalyser: MockAnalyser = {
  fftSize: 256,
  smoothingTimeConstant: 0.4,
  frequencyBinCount: 128,
  getByteFrequencyData: vi.fn(),
  connect: vi.fn(),
};

const mockSource = { connect: vi.fn(), disconnect: vi.fn() };

const mockCtx = {
  state: 'running',
  createAnalyser: vi.fn(() => mockAnalyser),
  createMediaStreamSource: vi.fn(() => mockSource),
  close: vi.fn(() => Promise.resolve()),
};

beforeEach(() => {
  vi.stubGlobal('AudioContext', vi.fn(() => mockCtx));
  vi.useFakeTimers();
  // Default: silence (all bins = 0)
  mockAnalyser.getByteFrequencyData.mockImplementation((buf: Uint8Array) => buf.fill(0));
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function buildStream(withAudioTrack = true) {
  const track = { kind: 'audio', enabled: true };
  return {
    getAudioTracks: () => (withAudioTrack ? [track] : []),
  } as unknown as MediaStream;
}

describe('useAudioActivity', () => {
  it('returns false initially (silence)', () => {
    const { result } = renderHook(() =>
      useAudioActivity(buildStream(), true)
    );
    expect(result.current).toBe(false);
  });

  it('returns false when enabled=false regardless of stream', () => {
    const { result } = renderHook(() =>
      useAudioActivity(buildStream(), false)
    );
    expect(result.current).toBe(false);
  });

  it('returns false when stream is null', () => {
    const { result } = renderHook(() =>
      useAudioActivity(null, true)
    );
    expect(result.current).toBe(false);
  });

  it('returns false when stream has no audio tracks', () => {
    const { result } = renderHook(() =>
      useAudioActivity(buildStream(false), true)
    );
    expect(result.current).toBe(false);
  });

  it('switches to speaking=true when frequency data exceeds threshold', async () => {
    // Simulate loud speech: all bins at 200
    mockAnalyser.getByteFrequencyData.mockImplementation((buf: Uint8Array) => buf.fill(200));

    const { result } = renderHook(() =>
      useAudioActivity(buildStream(), true, { threshold: 30, decayMs: 100 })
    );

    // Allow the rAF tick to fire
    await act(async () => {
      vi.runAllTimers();
    });

    expect(result.current).toBe(true);
  });

  it('decays back to false after silence following speech', async () => {
    // Start loud
    mockAnalyser.getByteFrequencyData.mockImplementation((buf: Uint8Array) => buf.fill(200));

    const { result } = renderHook(() =>
      useAudioActivity(buildStream(), true, { threshold: 30, decayMs: 200 })
    );

    await act(async () => { vi.runAllTimers(); });
    expect(result.current).toBe(true);

    // Go silent
    mockAnalyser.getByteFrequencyData.mockImplementation((buf: Uint8Array) => buf.fill(0));

    await act(async () => {
      vi.advanceTimersByTime(400); // past decayMs
    });

    expect(result.current).toBe(false);
  });
});
