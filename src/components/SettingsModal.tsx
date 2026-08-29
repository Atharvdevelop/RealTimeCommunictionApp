import { useEffect, useRef, useState } from 'react';
import { X, Settings, Mic, Video, Sparkles, Sliders, Shield } from 'lucide-react';
import type { VideoFilter } from '@/lib/types';
import { cn } from '@/lib/utils';

type Props = {
  onClose: () => void;
  currentFilter: VideoFilter;
  onFilterChange: (filter: VideoFilter) => void;
  localStream: MediaStream | null;
};

const FILTERS: { id: VideoFilter; label: string; class: string }[] = [
  { id: 'none', label: 'Original', class: 'video-filter-none' },
  { id: 'blur', label: 'Soft Blur', class: 'video-filter-blur' },
  { id: 'grayscale', label: 'Studio B&W', class: 'video-filter-grayscale' },
  { id: 'warm', label: 'Warm Glow', class: 'video-filter-warm' },
  { id: 'cool', label: 'Cool Tint', class: 'video-filter-cool' },
  { id: 'sepia', label: 'Classic Sepia', class: 'video-filter-sepia' },
];

export function SettingsModal({ onClose, currentFilter, onFilterChange, localStream }: Props) {
  const [activeTab, setActiveTab] = useState<'video' | 'audio' | 'general'>('video');
  const [audioLevel, setAudioLevel] = useState(0);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (videoPreviewRef.current && localStream) {
      videoPreviewRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (!localStream) return;
    const audioTrack = localStream.getAudioTracks()[0];
    if (!audioTrack) return;

    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContext();
        const source = audioCtxRef.current.createMediaStreamSource(new MediaStream([audioTrack]));
        const analyser = audioCtxRef.current.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        analyserRef.current = analyser;
      }
      const analyser = analyserRef.current!;
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        setAudioLevel(Math.min(100, (avg / 80) * 100));
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      // ignore
    }

    return () => {
      cancelAnimationFrame(rafRef.current);
      audioCtxRef.current?.close();
    };
  }, [localStream]);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#121215] border border-white/[0.1] rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-white/40 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5 pb-2 border-b border-white/[0.06]">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold font-display text-white">Meeting Settings</h3>
            <p className="text-xs text-white/40">Adjust media effects, quality & device configurations</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex rounded-xl bg-[#18181b] p-1 gap-1">
          <button
            onClick={() => setActiveTab('video')}
            className={cn(
              "flex-1 py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5",
              activeTab === 'video' ? "bg-emerald-500 text-black font-semibold shadow-sm" : "text-white/60 hover:text-white"
            )}
          >
            <Video className="w-3.5 h-3.5" /> Video Effects
          </button>
          <button
            onClick={() => setActiveTab('audio')}
            className={cn(
              "flex-1 py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5",
              activeTab === 'audio' ? "bg-emerald-500 text-black font-semibold shadow-sm" : "text-white/60 hover:text-white"
            )}
          >
            <Mic className="w-3.5 h-3.5" /> Audio Test
          </button>
          <button
            onClick={() => setActiveTab('general')}
            className={cn(
              "flex-1 py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5",
              activeTab === 'general' ? "bg-emerald-500 text-black font-semibold shadow-sm" : "text-white/60 hover:text-white"
            )}
          >
            <Sliders className="w-3.5 h-3.5" /> Preferences
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'video' && (
          <div className="space-y-4">
            <div className="relative aspect-video rounded-2xl overflow-hidden bg-[#18181b] border border-white/[0.08]">
              {localStream ? (
                <video
                  ref={videoPreviewRef}
                  autoPlay
                  muted
                  playsInline
                  className={cn('w-full h-full object-cover -scale-x-100 transition-all', `video-filter-${currentFilter}`)}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs text-white/40">
                  Camera feed unavailable
                </div>
              )}
              <div className="absolute bottom-2.5 left-2.5 px-2 py-1 rounded-lg bg-black/60 backdrop-blur-md text-[10px] text-white/80 font-medium">
                Live Filter: {FILTERS.find((f) => f.id === currentFilter)?.label}
              </div>
            </div>

            <div>
              <label className="text-xs text-white/50 font-medium mb-2 block flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" /> Virtual Video Filters
              </label>
              <div className="grid grid-cols-3 gap-2">
                {FILTERS.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => onFilterChange(f.id)}
                    className={cn(
                      "py-2 px-3 rounded-xl border text-xs font-medium transition-all text-center truncate",
                      currentFilter === f.id
                        ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300 shadow-sm"
                        : "bg-white/[0.02] border-white/[0.06] text-white/70 hover:bg-white/[0.05]"
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'audio' && (
          <div className="space-y-4 py-2">
            <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-4 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/70 font-medium">Microphone Input Level</span>
                <span className="font-mono text-emerald-400">{Math.round(audioLevel)}%</span>
              </div>
              <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400 transition-all duration-75"
                  style={{ width: `${Math.max(4, audioLevel)}%` }}
                />
              </div>
              <p className="text-[11px] text-white/40">
                Speak normally to check if your voice level is within the green zone.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2 text-xs text-emerald-300">
              <Shield className="w-4 h-4 shrink-0" />
              <span>Hardware Echo Cancellation & Noise Suppression are active.</span>
            </div>
          </div>
        )}

        {activeTab === 'general' && (
          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
              <div>
                <span className="font-semibold text-white block">Auto Gain Control</span>
                <span className="text-white/40 text-[11px]">Automatically adjust microphone volume</span>
              </div>
              <input type="checkbox" defaultChecked className="accent-emerald-500 w-4 h-4 rounded" />
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
              <div>
                <span className="font-semibold text-white block">Bandwidth Saver Mode</span>
                <span className="text-white/40 text-[11px]">Optimize video streams on slow connections</span>
              </div>
              <input type="checkbox" className="accent-emerald-500 w-4 h-4 rounded" />
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
              <div>
                <span className="font-semibold text-white block">Play Notification Sounds</span>
                <span className="text-white/40 text-[11px]">Audio alerts on chat and user join</span>
              </div>
              <input type="checkbox" defaultChecked className="accent-emerald-500 w-4 h-4 rounded" />
            </div>
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold transition-colors"
        >
          Save & Close
        </button>
      </div>
    </div>
  );
}
