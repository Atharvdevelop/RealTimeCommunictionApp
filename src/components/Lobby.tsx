import { useState } from 'react';
import { Video, ArrowRight, Plus, LogIn, Lock, Copy, Check, Users, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { generateRoomCode, cn } from '@/lib/utils';

type Props = {
  onEnterRoom: (roomCode: string, name: string, isCreator: boolean) => void;
};

export function Lobby({ onEnterRoom }: Props) {
  const [name, setName] = useState('');
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [joinCode, setJoinCode] = useState('');
  const [joinPassword, setJoinPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [generatedCode, setGeneratedCode] = useState('');

  const handleCreate = async () => {
    setError(null);
    if (!name.trim()) {
      setError('Enter your display name');
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
    onEnterRoom(code, name.trim(), true);
  };

  const handleJoin = async () => {
    setError(null);
    if (!name.trim()) {
      setError('Enter your display name');
      return;
    }
    if (!joinCode.trim()) {
      setError('Enter a room code');
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
      setError('Incorrect passcode');
      return;
    }
    onEnterRoom(data.code, name.trim(), false);
  };

  const copyCode = () => {
    if (!generatedCode) return;
    navigator.clipboard.writeText(generatedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-white flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-[120px]" />
      </div>

      <div className="relative w-full max-w-md my-auto py-4">
        <div className="text-center mb-5 sm:mb-8">
          <div className="inline-flex items-center gap-2.5 mb-3 sm:mb-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <Video className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <span className="text-2xl sm:text-3xl font-bold tracking-tight">PulseMeet</span>
          </div>
          <p className="text-white/50 text-xs sm:text-sm flex items-center justify-center gap-1.5 px-2">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> Real-time video conferencing & collaborative workspace
          </p>
        </div>

        <div className="rounded-2xl bg-[#121215]/80 backdrop-blur-xl border border-white/[0.08] p-4 sm:p-6 shadow-2xl">
          <div className="flex gap-1 p-1 rounded-xl bg-[#18181b] mb-5">
            <button
              onClick={() => setMode('create')}
              className={cn(
                'flex-1 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2',
                mode === 'create' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-white/50 hover:text-white'
              )}
            >
              <Plus className="w-4 h-4" /> Create
            </button>
            <button
              onClick={() => setMode('join')}
              className={cn(
                'flex-1 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2',
                mode === 'join' ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/20' : 'text-white/50 hover:text-white'
              )}
            >
              <LogIn className="w-4 h-4" /> Join
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs text-white/50 mb-1.5 block font-medium">Your display name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Jordan Lee"
                maxLength={30}
                className="w-full bg-[#18181b] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 focus:border-emerald-500/50 focus:outline-none transition-colors"
              />
            </div>

            {mode === 'join' && (
              <>
                <div>
                  <label className="text-xs text-white/50 mb-1.5 block font-medium">Room code</label>
                  <input
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value)}
                    placeholder="pulse-849-xyz"
                    className="w-full bg-[#18181b] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 focus:border-cyan-500/50 focus:outline-none transition-colors font-mono lowercase"
                  />
                </div>
                <div>
                  <label className="text-xs text-white/50 mb-1.5 block font-medium flex items-center gap-1.5">
                    <Lock className="w-3 h-3" /> Passcode (optional)
                  </label>
                  <input
                    value={joinPassword}
                    onChange={(e) => setJoinPassword(e.target.value)}
                    placeholder="Only if room is protected"
                    className="w-full bg-[#18181b] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none transition-colors"
                  />
                </div>
              </>
            )}

            {error && (
              <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button
              onClick={mode === 'create' ? handleCreate : handleJoin}
              disabled={loading}
              className={cn(
                'w-full py-3.5 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50',
                mode === 'create'
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/20'
                  : 'bg-cyan-500 hover:bg-cyan-400 text-white shadow-lg shadow-cyan-500/20'
              )}
            >
              {loading ? 'Connecting…' : mode === 'create' ? 'Create Meeting' : 'Join Meeting'}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </div>

          {mode === 'create' && (
            <p className="mt-4 text-xs text-white/30 text-center flex items-center justify-center gap-1.5">
              <Users className="w-3 h-3" /> Share the room code with others to invite them
            </p>
          )}
        </div>

        {generatedCode && (
          <div className="mt-3 rounded-xl bg-[#121215]/80 backdrop-blur-xl border border-emerald-500/20 p-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-white/40">Room code</p>
              <p className="font-mono text-emerald-400 text-sm">{generatedCode}</p>
            </div>
            <button onClick={copyCode} className="p-2 rounded-lg hover:bg-white/10 transition-colors">
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-white/60" />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
