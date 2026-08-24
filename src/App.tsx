import { useState, useCallback } from 'react';
import { RoomProvider } from '@/context/RoomContext';
import { Lobby } from '@/components/Lobby';
import { PreJoin } from '@/components/PreJoin';
import { MeetingRoom } from '@/components/MeetingRoom';
import { supabase } from '@/lib/supabase';

type AppState = 'lobby' | 'prejoin' | 'meeting';

function AppInner() {
  const [appState, setAppState] = useState<AppState>('lobby');
  const [roomCode, setRoomCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [roomDbId, setRoomDbId] = useState<string | null>(null);

  const handleEnterRoom = useCallback((code: string, name: string) => {
    setRoomCode(code);
    setDisplayName(name);
    setAppState('prejoin');
  }, []);

  const handlePreJoinComplete = useCallback(async () => {
    // Look up room DB id
    const { data } = await supabase.from('rooms').select('id').eq('code', roomCode).maybeSingle();
    setRoomDbId(data?.id || `room_${roomCode}`);
    setAppState('meeting');
  }, [roomCode, displayName]);

  const handleLeave = useCallback(() => {
    setAppState('lobby');
    setRoomCode('');
    setDisplayName('');
    setRoomDbId(null);
  }, []);

  if (appState === 'lobby') {
    return <Lobby onEnterRoom={handleEnterRoom} />;
  }

  if (appState === 'prejoin') {
    return (
      <PreJoin
        roomCode={roomCode}
        displayName={displayName}
        onJoin={handlePreJoinComplete}
        onCancel={() => setAppState('lobby')}
      />
    );
  }

  if (!roomDbId) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
        <p className="text-white/50 text-sm">Room not found. Redirecting…</p>
      </div>
    );
  }

  return (
    <MeetingRoom
      roomCode={roomCode}
      displayName={displayName}
      roomDbId={roomDbId}
      onLeave={handleLeave}
    />
  );
}

export default function App() {
  return (
    <RoomProvider>
      <AppInner />
    </RoomProvider>
  );
}
