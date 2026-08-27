import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Video, VideoOff, ArrowRight, ChevronDown, Settings, Loader2 } from 'lucide-react';
import { useMedia } from '@/hooks/useMedia';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

type Props = {
  roomCode: string;
  displayName: string;
  onJoin: (finalName: string) => void;
  onCancel: () => void;
};

export function PreJoin({ roomCode, displayName, onJoin, onCancel }: Props) {
  const { state, initPreview, toggleMic, toggleCam, switchDevice, stopPreview } = useMedia();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [name, setName] = useState(displayName || localStorage.getItem('pm_user_name') || '');
  const [micOpen, setMicOpen] = useState(false);
  const [camOpen, setCamOpen] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    initPreview();
    return () => {
      stopPreview();
      cancelAnimationFrame(rafRef.current);
      audioCtxRef.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (displayName) setName(displayName);
  }, [displayName]);

  useEffect(() => {
    if (videoRef.current && state.localStream) {
      videoRef.current.srcObject = state.localStream;
    }
  }, [state.localStream]);

  useEffect(() => {
    if (!state.localStream || !state.micOn) {
      setAudioLevel(0);
      return;
    }
    const audioTrack = state.localStream.getAudioTracks()[0];
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
        setAudioLevel(Math.min(1, avg / 80));
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      // ignore
    }
    return () => cancelAnimationFrame(rafRef.current);
  }, [state.localStream, state.micOn]);

  const handleJoin = async () => {
    setError(null);
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Please enter your name to join');
      return;
    }
    setJoining(true);
    localStorage.setItem('pm_user_name', trimmedName);
    const { data } = await supabase.from('rooms').select('id').eq('code', roomCode).maybeSingle();
    setJoining(false);
    onJoin(trimmedName);
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-white flex items-center justify-center p-3 sm:p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/3 w-96 h-96 bg-emerald-500/10 rounded-full blur-[120px]" />
      </div>

      <div className="relative w-full max-w-md sm:max-w-lg">
        <div className="text-center mb-3 sm:mb-6">
          <h1 className="text-xl sm:text-2xl font-bold mb-1">Ready to join?</h1>
          <p className="text-white/40 text-xs sm:text-sm">
            Room Code: <span className="font-mono text-emerald-400 font-medium">{roomCode}</span>
          </p>
        </div>

        <div className="rounded-2xl bg-[#121215]/80 backdrop-blur-xl border border-white/[0.08] p-4 sm:p-6 shadow-2xl space-y-3 sm:space-y-4">
          {/* Preview */}
          <div className="relative aspect-video rounded-xl overflow-hidden bg-[#18181b]">
            {state.localStream && state.camOn ? (
              <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover -scale-x-100" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center">
                {state.error ? (
                  <p className="text-red-400 text-sm px-4 text-center">{state.error}</p>
                ) : (
                  <>
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center text-2xl font-bold mb-2 shadow-lg">
                      {(name || 'G').slice(0, 2).toUpperCase()}
                    </div>
                    <p className="text-white/30 text-sm">Camera is off</p>
                  </>
                )}
              </div>
            )}
            {state.micOn && audioLevel > 0.05 && (
              <div className="absolute bottom-3 right-3 flex items-end gap-0.5 h-5">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="w-1 bg-emerald-400 rounded-full transition-all"
                    style={{ height: `${Math.max(15, Math.min(100, audioLevel * 100 * (1 - i * 0.15)))}%` }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Display Name Input */}
          <div>
            <label className="block text-xs font-medium text-white/60 mb-1.5">Your Display Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              placeholder="e.g. John Doe"
              maxLength={32}
              className="w-full px-4 py-2.5 rounded-xl bg-[#18181b] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-emerald-500/50 transition-colors placeholder:text-white/20"
            />
            {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-3">
            {/* Mic control with dropdown */}
            <div className="relative">
              <div className="flex items-center rounded-xl bg-[#18181b] border border-white/[0.08] overflow-hidden">
                <button
                  onClick={toggleMic}
                  className={cn(
                    'p-3 transition-colors',
                    state.micOn ? 'text-white hover:bg-white/5' : 'text-red-400 hover:bg-red-500/10'
                  )}
                  title={state.micOn ? 'Mute Mic' : 'Unmute Mic'}
                >
                  {state.micOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                </button>
                <button
                  onClick={() => { setMicOpen((v) => !v); setCamOpen(false); }}
                  className="px-2 border-l border-white/[0.08] text-white/40 hover:text-white transition-colors"
                >
                  <ChevronDown className={cn('w-4 h-4 transition-transform', micOpen && 'rotate-180')} />
                </button>
              </div>
              {micOpen && (
                <div className="absolute top-full mt-2 left-0 w-64 rounded-xl bg-[#18181b] border border-white/[0.08] shadow-2xl z-10 p-1.5">
                  <p className="text-xs text-white/40 px-2 py-1 flex items-center gap-1.5"><Settings className="w-3 h-3" /> Microphone</p>
                  {state.audioInputs.length === 0 && <p className="text-xs text-white/30 px-2 py-1.5">No devices found</p>}
                  {state.audioInputs.map((dev) => (
                    <button
                      key={dev.deviceId}
                      onClick={() => { switchDevice('audio', dev.deviceId); setMicOpen(false); }}
                      className={cn(
                        'w-full text-left px-2.5 py-2 rounded-lg text-sm transition-colors truncate',
                        state.selectedMicId === dev.deviceId ? 'bg-emerald-500/15 text-emerald-400' : 'text-white/70 hover:bg-white/5'
                      )}
                    >
                      {dev.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Cam control with dropdown */}
            <div className="relative">
              <div className="flex items-center rounded-xl bg-[#18181b] border border-white/[0.08] overflow-hidden">
                <button
                  onClick={toggleCam}
                  className={cn(
                    'p-3 transition-colors',
                    state.camOn ? 'text-white hover:bg-white/5' : 'text-red-400 hover:bg-red-500/10'
                  )}
                  title={state.camOn ? 'Turn off camera' : 'Turn on camera'}
                >
                  {state.camOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                </button>
                <button
                  onClick={() => { setCamOpen((v) => !v); setMicOpen(false); }}
                  className="px-2 border-l border-white/[0.08] text-white/40 hover:text-white transition-colors"
                >
                  <ChevronDown className={cn('w-4 h-4 transition-transform', camOpen && 'rotate-180')} />
                </button>
              </div>
              {camOpen && (
                <div className="absolute top-full mt-2 left-0 w-64 rounded-xl bg-[#18181b] border border-white/[0.08] shadow-2xl z-10 p-1.5">
                  <p className="text-xs text-white/40 px-2 py-1 flex items-center gap-1.5"><Settings className="w-3 h-3" /> Camera</p>
                  {state.videoInputs.length === 0 && <p className="text-xs text-white/30 px-2 py-1.5">No devices found</p>}
                  {state.videoInputs.map((dev) => (
                    <button
                      key={dev.deviceId}
                      onClick={() => { switchDevice('video', dev.deviceId); setCamOpen(false); }}
                      className={cn(
                        'w-full text-left px-2.5 py-2 rounded-lg text-sm transition-colors truncate',
                        state.selectedCamId === dev.deviceId ? 'bg-emerald-500/15 text-emerald-400' : 'text-white/70 hover:bg-white/5'
                      )}
                    >
                      {dev.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={onCancel}
              className="flex-1 py-3 rounded-xl bg-[#18181b] border border-white/[0.08] text-white/70 hover:text-white text-sm font-medium transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleJoin}
              disabled={joining || !!state.error}
              className="flex-1 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-semibold transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-50"
            >
              {joining ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              {joining ? 'Joining…' : 'Join Now'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
