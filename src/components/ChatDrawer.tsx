import { useEffect, useRef, useState, useCallback } from 'react';
import { X, Send, Smile, Paperclip, Download, FileText, Image as ImageIcon, File } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRoom } from '@/hooks/useRoom';
import type { Message } from '@/lib/supabase';
import { formatTime, cn, generateId } from '@/lib/utils';

type Props = {
  onClose: () => void;
  onRead: () => void;
};

type LocalFile = {
  id: string;
  name: string;
  size: number;
  senderName: string;
  createdAt: number;
  url: string;
  type: string;
};

const EMOJIS = ['👍', '❤️', '😂', '🎉', '👏', '🔥', '✅', '🤔', '😮', '🙏', '💯', '🚀'];

export function ChatDrawer({ onClose, onRead }: Props) {
  const { roomDbId, userId, userName, participants } = useRoom();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [showEmojis, setShowEmojis] = useState(false);
  const [sharedFiles, setSharedFiles] = useState<LocalFile[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    onRead();
  }, [onRead]);

  useEffect(() => {
    if (!roomDbId) return;
    supabase
      .from('messages')
      .select('*')
      .eq('room_id', roomDbId)
      .order('created_at', { ascending: true })
      .then(({ data }: { data: Message[] | null }) => {
        if (data) setMessages(data);
      });

    const channel = supabase
      .channel(`messages:${roomDbId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `room_id=eq.${roomDbId}`,
      }, (payload: { new: Message }) => {
        const msg = payload.new as Message;
        setMessages((prev) => [...prev, msg]);
        onRead();
      })
      .subscribe();

    // File share broadcast channel
    const fileChannel = supabase.channel(`files:${roomDbId}`);
    fileChannel
      .on('broadcast', { event: 'file' }, (payload: { payload: LocalFile }) => {
        const file = payload.payload as LocalFile;
        if (file.id !== userId) setSharedFiles((prev) => [...prev, file]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(fileChannel);
    };
  }, [roomDbId, userId, onRead]);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  const send = () => {
    if (!input.trim() || !roomDbId) return;
    const content = input.trim();
    setInput('');
    setShowEmojis(false);
    supabase.from('messages').insert({
      room_id: roomDbId,
      sender_id: userId,
      sender_name: userName,
      content,
    }).then(() => {});
  };

  const handleFile = useCallback(async (file: File) => {
    if (!roomDbId) return;
    const fileId = generateId();
    const objectKey = `${roomDbId}/${fileId}-${file.name}`;
    setUploadProgress(0);

    const { error: uploadError } = await supabase.storage
      .from('file-sharing')
      .upload(objectKey, file, { upsert: false });

    if (uploadError) {
      // Fallback: use object URL for local-only sharing
      const localUrl = URL.createObjectURL(file);
      const localFile: LocalFile = {
        id: fileId,
        name: file.name,
        size: file.size,
        senderName: userName,
        createdAt: Date.now(),
        url: localUrl,
        type: file.type,
      };
      setSharedFiles((prev) => [...prev, localFile]);
      setUploadProgress(null);
      return;
    }

    const { data: urlData } = supabase.storage.from('file-sharing').getPublicUrl(objectKey);
    const sharedFile: LocalFile = {
      id: fileId,
      name: file.name,
      size: file.size,
      senderName: userName,
      createdAt: Date.now(),
      url: urlData.publicUrl,
      type: file.type,
    };
    setSharedFiles((prev) => [...prev, sharedFile]);
    setUploadProgress(100);
    setTimeout(() => setUploadProgress(null), 500);

    supabase.channel(`files:${roomDbId}`).send({
      type: 'broadcast',
      event: 'file',
      payload: sharedFile,
    });
  }, [roomDbId, userName]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    files.forEach(handleFile);
  };

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    files.forEach(handleFile);
  };

  const insertMention = (name: string) => {
    setInput((prev) => `${prev}@${name} `);
  };

  const fileIcon = (type: string) => {
    if (type.startsWith('image/')) return <ImageIcon className="w-4 h-4" />;
    if (type === 'application/pdf') return <FileText className="w-4 h-4" />;
    return <File className="w-4 h-4" />;
  };

  return (
    <aside className="flex flex-col h-full bg-[#121215]/95 backdrop-blur-xl border-l border-white/[0.08]" role="region" aria-label="Meeting Chat">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <h3 className="font-semibold text-white text-sm font-display">In-Meeting Chat & Files</h3>
        <button onClick={onClose} aria-label="Close Chat" className="p-1.5 rounded-lg hover:bg-white/5 text-white/50 hover:text-white transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2 scroll-smooth">
        {messages.length === 0 && sharedFiles.length === 0 && (
          <div className="text-center text-white/30 text-xs py-8">
            No messages yet. Send a message or drop files!
          </div>
        )}
        {messages.map((msg) => {
          const isLocal = msg.sender_id === userId;
          return (
            <div key={msg.id} className={cn('flex flex-col', isLocal ? 'items-end' : 'items-start')}>
              {!isLocal && (
                <span className="text-xs font-medium text-emerald-400 mb-0.5 px-1">{msg.sender_name}</span>
              )}
              <div
                className={cn(
                  'max-w-[85%] rounded-2xl px-3.5 py-2 text-xs sm:text-sm',
                  isLocal
                    ? 'bg-emerald-500/20 text-white rounded-br-sm border border-emerald-500/30'
                    : 'bg-[#18181b] text-white/90 rounded-bl-sm border border-white/[0.06]'
                )}
              >
                {msg.content}
              </div>
              <span className="text-[10px] text-white/30 mt-0.5 px-1">{formatTime(new Date(msg.created_at).getTime())}</span>
            </div>
          );
        })}

        {/* Shared files */}
        {sharedFiles.length > 0 && (
          <div className="pt-2 space-y-2">
            <p className="text-xs text-white/30 font-medium px-1">Shared Files</p>
            {sharedFiles.map((file) => (
              <div key={file.id} className="flex items-center gap-3 rounded-2xl bg-[#18181b] border border-white/[0.06] p-2.5">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/15 text-cyan-400 flex items-center justify-center shrink-0">
                  {fileIcon(file.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm text-white truncate font-medium">{file.name}</p>
                  <p className="text-[11px] text-white/30">
                    {file.senderName} · {(file.size / 1024).toFixed(0)} KB
                  </p>
                </div>
                <a
                  href={file.url}
                  download={file.name}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors shrink-0"
                  title="Download File"
                >
                  <Download className="w-4 h-4" />
                </a>
              </div>
            ))}
          </div>
        )}

        {uploadProgress !== null && (
          <div className="rounded-xl bg-[#18181b] border border-white/[0.06] p-3">
            <div className="flex items-center justify-between text-xs text-white/50 mb-1.5">
              <span>Uploading file…</span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full bg-emerald-400 transition-all" style={{ width: `${uploadProgress}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* Quick mentions */}
      {participants.length > 1 && (
        <div className="px-3 pb-1.5 flex gap-1.5 flex-wrap">
          {participants.filter((p) => p.id !== userId).slice(0, 5).map((p) => (
            <button
              key={p.id}
              onClick={() => insertMention(p.name)}
              className="text-xs px-2 py-1 rounded-lg bg-white/5 text-white/50 hover:text-white hover:bg-white/10 transition-colors"
            >
              @{p.name.split(' ')[0]}
            </button>
          ))}
        </div>
      )}

      {/* Drop zone overlay */}
      {dragOver && (
        <div
          onDragLeave={() => setDragOver(false)}
          className="absolute inset-0 m-3 rounded-2xl border-2 border-dashed border-emerald-400/50 bg-emerald-500/5 flex items-center justify-center pointer-events-none z-10"
        >
          <p className="text-emerald-400 text-sm font-medium">Drop files to share</p>
        </div>
      )}

      {/* Input */}
      <div className="p-3 border-t border-white/[0.06]" onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDrop={onDrop}>
        {showEmojis && (
          <div className="flex gap-1 flex-wrap mb-2 p-2 rounded-2xl bg-[#18181b] border border-white/[0.06]">
            {EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => { setInput((prev) => prev + emoji); setShowEmojis(false); }}
                className="text-xl hover:scale-125 transition-transform p-1 active:scale-95"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2 rounded-2xl bg-[#18181b] border border-white/[0.08] px-3 py-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="text-white/40 hover:text-white transition-colors shrink-0 p-1"
            title="Attach file"
          >
            <Paperclip className="w-4.5 h-4.5" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={onFileSelect}
            className="hidden"
          />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Type a message…"
            className="flex-1 bg-transparent text-xs sm:text-sm text-white placeholder-white/30 focus:outline-none"
          />
          <button
            onClick={() => setShowEmojis((v) => !v)}
            className={cn('transition-colors shrink-0 p-1', showEmojis ? 'text-emerald-400' : 'text-white/40 hover:text-white')}
            title="Pick emoji"
          >
            <Smile className="w-4.5 h-4.5" />
          </button>
          <button
            onClick={send}
            disabled={!input.trim()}
            className="text-emerald-400 disabled:text-white/20 transition-colors shrink-0 p-1"
            title="Send Message"
          >
            <Send className="w-4.5 h-4.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
