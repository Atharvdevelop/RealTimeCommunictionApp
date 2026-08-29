import { useEffect, useRef, useState } from 'react';
import {
  Video, ArrowRight, Plus, LogIn, Lock, Copy, Check,
  Sparkles, ShieldCheck, Zap, PenTool, MonitorUp, Mic, History, Play
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { generateRoomCode, cn } from '@/lib/utils';

type Props = {
  onEnterRoom: (roomCode: string, name: string, isCreator: boolean) => void;
};

type RecentRoom = {
  code: string;
  name: string;
  joinedAt: number;
};

export function Lobby({ onEnterRoom }: Props) {
  const [name, setName] = useState(() => {
    try {
      return localStorage.getItem('pm_user_name') || '';
    } catch {
      return '';
    }
  });
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [joinCode, setJoinCode] = useState('');
  const [joinPassword, setJoinPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [generatedCode, setGeneratedCode] = useState('');
  const [recentRooms, setRecentRooms] = useState<RecentRoom[]>([]);
  const [micLevel, setMicLevel] = useState(0);
  const [micTesting, setMicTesting] = useState(false);

  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number>(0);

  // Load recent rooms
  useEffect(() => {
    try {
      const saved = localStorage.getItem('pm_recent_rooms');
      if (saved) {
        setRecentRooms(JSON.parse(saved).slice(0, 3));
      }
    } catch {
      // ignore
    }
  }, []);

  const saveRecentRoom = (code: string, userName: string) => {
    try {
      const saved = localStorage.getItem('pm_recent_rooms');
      const list: RecentRoom[] = saved ? JSON.parse(saved) : [];
      const updated = [{ code, name: userName, joinedAt: Date.now() }, ...list.filter((r) => r.code !== code)].slice(0, 5);
      localStorage.setItem('pm_recent_rooms', JSON.stringify(updated));
      localStorage.setItem('pm_user_name', userName);
    } catch {
      // ignore
    }
  };

  // Mic test toggle
  const toggleMicTest = async () => {
    if (micTesting) {
      audioStreamRef.current?.getTracks().forEach((t) => t.stop());
      audioStreamRef.current = null;
      audioCtxRef.current?.close();
      audioCtxRef.current = null;
      cancelAnimationFrame(rafRef.current);
      setMicTesting(false);
      setMicLevel(0);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioStreamRef.current = stream;
        const ctx = new AudioContext();
        audioCtxRef.current = ctx;
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        src.connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);
        setMicTesting(true);

        const tick = () => {
          analyser.getByteFrequencyData(data);
          const avg = data.reduce((a, b) => a + b, 0) / data.length;
          setMicLevel(Math.min(100, (avg / 70) * 100));
          rafRef.current = requestAnimationFrame(tick);
        };
        tick();
      } catch {
        setError('Microphone permission denied for audio test');
      }
    }
  };

  useEffect(() => {
    return () => {
      audioStreamRef.current?.getTracks().forEach((t) => t.stop());
      audioCtxRef.current?.close();
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const handleCreate = async () => {
    setError(null);
    if (!name.trim()) {
      setError('Please enter your display name');
      return;
    }
    setLoading(true);
    const code = generateRoomCode();
    const { error: dbError } = await supabase.from('rooms').insert({
      code,
      password: null,
      host_name: name.trim(),
    });
    setLoading(false);
    if (dbError) {
      setError('Could not create room. Try again.');
      return;
    }
    setGeneratedCode(code);
    saveRecentRoom(code, name.trim());
    onEnterRoom(code, name.trim(), true);
  };

  const handleInstantDemo = async () => {
    const demoName = name.trim() || 'Demo Host';
    setName(demoName);
    const code = generateRoomCode();
    saveRecentRoom(code, demoName);
    onEnterRoom(code, demoName, true);
  };

  const handleJoin = async () => {
    setError(null);
    if (!name.trim()) {
      setError('Please enter your display name');
      return;
    }
    if (!joinCode.trim()) {
      setError('Please enter a valid room code');
      return;
    }
    setLoading(true);
    const { data, error: dbError } = await supabase
      .from('rooms')
      .select('*')
      .eq('code', joinCode.trim().toLowerCase())
      .maybeSingle();
    setLoading(false);
    if (dbError || !data) {
      setError('Room not found. Check the code and try again.');
      return;
    }
    if (data.password && data.password !== joinPassword) {
      setError('Incorrect room passcode');
      return;
    }
    saveRecentRoom(data.code, name.trim());
    onEnterRoom(data.code, name.trim(), false);
  };

  const handleQuickRejoin = (code: string) => {
    if (!name.trim()) {
      setError('Please enter your display name above first');
      return;
    }
    saveRecentRoom(code, name.trim());
    onEnterRoom(code, name.trim(), false);
  };

  const copyCode = () => {
    if (!generatedCode) return;
    navigator.clipboard.writeText(generatedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <main className="min-h-screen bg-[#09090b] text-white flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden">
      {/* Dynamic Ambient Background Glows */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-[450px] h-[450px] bg-emerald-500/10 rounded-full blur-[140px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-[450px] h-[450px] bg-cyan-500/10 rounded-full blur-[140px]" />
        <div className="absolute top-1/2 right-1/3 w-[300px] h-[300px] bg-indigo-500/10 rounded-full blur-[120px]" />
      </div>

      <div className="relative w-full max-w-4xl flex flex-col lg:flex-row items-center gap-8 z-10 py-6">
        {/* Left Col: Hero Showcase */}
        <div className="flex-1 text-center lg:text-left space-y-5">
          <div className="flex items-center justify-center lg:justify-start gap-2.5 mb-1">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/25">
              <Video className="w-5 h-5 text-black" />
            </div>
            <span className="text-2xl font-bold font-display tracking-tight text-white">PulseMeet</span>
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold shadow-sm">
            <Sparkles className="w-3.5 h-3.5" /> Next-Gen WebRTC Video Platform
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold font-display tracking-tight leading-tight">
            Seamless real-time <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-emerald-400 via-cyan-400 to-indigo-400 bg-clip-text text-transparent">
              collaboration for teams.
            </span>
          </h1>

          <p className="text-white/60 text-sm sm:text-base max-w-lg mx-auto lg:mx-0 leading-relaxed">
            Ultra-low latency HD video conferencing, synchronized live whiteboard, high-framerate screen sharing, and encrypted instant messaging with zero setup.
          </p>

          {/* Feature Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-2 gap-2.5 max-w-md mx-auto lg:mx-0 pt-2">
            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-xs font-medium text-white/80">
              <Zap className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Peer-to-Peer Mesh</span>
            </div>
            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-xs font-medium text-white/80">
              <PenTool className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Live Whiteboard Sync</span>
            </div>
            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-xs font-medium text-white/80">
              <MonitorUp className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>HD Screen Sharing</span>
            </div>
            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-xs font-medium text-white/80">
              <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>DTLS-SRTP Security</span>
            </div>
          </div>

          {/* Instant 1-Click Demo Button */}
          <div className="pt-2">
            <button
              onClick={handleInstantDemo}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-black font-bold text-xs sm:text-sm shadow-xl shadow-emerald-500/20 transition-all hover:scale-105 active:scale-95"
            >
              <Play className="w-4 h-4 fill-black" />
              <span>Launch Instant Demo Meeting</span>
            </button>
          </div>
        </div>

        {/* Right Col: Meeting Entry Card */}
        <div className="w-full max-w-md">
          <div className="rounded-3xl bg-[#121215]/85 backdrop-blur-2xl border border-white/[0.1] p-6 shadow-2xl space-y-4">
            {/* Mode Switcher */}
            <div className="flex gap-1 p-1 rounded-2xl bg-[#18181b] border border-white/[0.06]">
              <button
                onClick={() => setMode('create')}
                className={cn(
                  'flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2',
                  mode === 'create'
                    ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20'
                    : 'text-white/50 hover:text-white'
                )}
              >
                <Plus className="w-4 h-4" /> Create Room
              </button>
              <button
                onClick={() => setMode('join')}
                className={cn(
                  'flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2',
                  mode === 'join'
                    ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/20'
                    : 'text-white/50 hover:text-white'
                )}
              >
                <LogIn className="w-4 h-4" /> Join Room
              </button>
            </div>

            {/* Inputs */}
            <div className="space-y-3.5">
              <div>
                <label className="text-xs text-white/60 mb-1.5 block font-medium">Your Display Name</label>
                <input
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="e.g. Alex Morgan"
                  maxLength={30}
                  className="w-full bg-[#18181b] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 focus:border-emerald-500/50 focus:outline-none transition-colors"
                />
              </div>

              {mode === 'join' && (
                <>
                  <div>
                    <label className="text-xs text-white/60 mb-1.5 block font-medium">Room Code</label>
                    <input
                      value={joinCode}
                      onChange={(e) => {
                        setJoinCode(e.target.value);
                        if (error) setError(null);
                      }}
                      placeholder="pulse-849-xyz"
                      className="w-full bg-[#18181b] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 focus:border-cyan-500/50 focus:outline-none transition-colors font-mono lowercase"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-white/60 mb-1.5 block font-medium flex items-center gap-1.5">
                      <Lock className="w-3 h-3 text-white/40" /> Room Passcode (Optional)
                    </label>
                    <input
                      type="password"
                      value={joinPassword}
                      onChange={(e) => setJoinPassword(e.target.value)}
                      placeholder="Enter only if required"
                      className="w-full bg-[#18181b] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none transition-colors"
                    />
                  </div>
                </>
              )}

              {/* Mic Visualizer Test Bar */}
              <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={toggleMicTest}
                  className={cn(
                    "text-xs px-2.5 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 shrink-0",
                    micTesting ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" : "bg-white/5 text-white/60 hover:text-white"
                  )}
                >
                  <Mic className="w-3.5 h-3.5" />
                  <span>{micTesting ? 'Mic Live' : 'Test Mic'}</span>
                </button>
                <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400 transition-all duration-75"
                    style={{ width: `${Math.max(2, micLevel)}%` }}
                  />
                </div>
              </div>

              {error && (
                <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2 animate-in fade-in duration-150">
                  {error}
                </div>
              )}

              <button
                onClick={mode === 'create' ? handleCreate : handleJoin}
                disabled={loading}
                className={cn(
                  'w-full py-3.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50',
                  mode === 'create'
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-emerald-500/20'
                    : 'bg-cyan-500 hover:bg-cyan-400 text-black shadow-cyan-500/20'
                )}
              >
                {loading ? 'Connecting…' : mode === 'create' ? 'Create Meeting Room' : 'Join Meeting Room'}
                {!loading && <ArrowRight className="w-4 h-4" />}
              </button>
            </div>

            {/* Recent Rooms Quick Access */}
            {recentRooms.length > 0 && (
              <div className="pt-2 border-t border-white/[0.06] space-y-1.5">
                <div className="flex items-center gap-1 text-[11px] text-white/40 font-medium">
                  <History className="w-3 h-3" /> Recent Rooms
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {recentRooms.map((r) => (
                    <button
                      key={r.code}
                      onClick={() => handleQuickRejoin(r.code)}
                      className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white font-mono text-xs transition-colors border border-white/[0.06]"
                    >
                      {r.code}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {generatedCode && (
              <div className="mt-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 flex items-center justify-between animate-in fade-in duration-200">
                <div>
                  <p className="text-[10px] text-white/50">Generated Room Code</p>
                  <p className="font-mono text-emerald-400 text-sm font-semibold">{generatedCode}</p>
                </div>
                <button onClick={copyCode} className="p-2 rounded-lg hover:bg-white/10 transition-colors">
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-white/60" />}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
