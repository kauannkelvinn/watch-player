'use client';

import { useEffect, useState, useRef, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import ReactPlayer from 'react-player';
import type { ChatMessage, RoomState, User } from '@watchparty/types';
import { socket } from './lib/socket';
import dynamic from 'next/dynamic';
import { Link as LinkIcon, Send, Copy, Monitor, Users, Play, Pause, Hash, Moon, Sun, PanelRightClose, PanelRightOpen, Maximize, Minimize } from 'lucide-react';

const Player = dynamic(() => import('./components/Player'), { ssr: false });

function getUserColor(name: string): string {
  const colors = ['#9B8AFF', '#B8A8FF', '#8A7AE8', '#AFA0F0', '#C0B0FF', '#8878D8'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function Avatar({ name, size = 26 }: { name: string; size?: number }) {
  const color = getUserColor(name);
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: '#1A1228',
      border: `1px solid rgba(124,92,252,0.28)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.38, fontWeight: 700, color,
      flexShrink: 0,
    }}>
      {name[0]?.toUpperCase() || '?'}
    </div>
  );
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatChatTime(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function HomeContent() {
  const searchParams = useSearchParams();

  const [playing, setPlaying] = useState(false);
  const [url, setUrl] = useState('https://www.youtube.com/watch?v=4W9_H0mdJBo');
  const [hasInteracted, setHasInteracted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [message, setMessage] = useState('');
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [username, setUsername] = useState('');
  const [playerKey, setPlayerKey] = useState(1);
  const [toast, setToast] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [isLight, setIsLight] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [roomInput, setRoomInput] = useState('');
  const [generatedId] = useState(() => Math.random().toString(36).substring(2, 8));

  const roomIdFromUrl = searchParams.get('room')?.toLowerCase();
  const finalRoomId = roomIdFromUrl || (roomInput.trim() || generatedId).toLowerCase();

  const isRemoteEvent = useRef(false);
  const playerRef = useRef<ReactPlayer | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const currentTimeRef = useRef(0);
  const pendingSyncRef = useRef<Pick<RoomState, 'time' | 'playing'> | null>(null);

  const toggleTheme = () => {
    setIsLight(!isLight);
    document.body.classList.toggle('light');
  };

  const toggleFullscreen = useCallback(() => {
    const doc = document as Document & { webkitFullscreenElement?: Element; webkitExitFullscreen?: () => Promise<void> };
    const docEl = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };

    if (!document.fullscreenElement && !doc.webkitFullscreenElement) {
      if (docEl.requestFullscreen) void docEl.requestFullscreen();
      else void docEl.webkitRequestFullscreen?.();
    } else {
      if (document.exitFullscreen) void document.exitFullscreen();
      else void doc.webkitExitFullscreen?.();
    }
  }, []);

  useEffect(() => {
    const syncFullscreen = () => {
      const doc = document as Document & { webkitFullscreenElement?: Element };
      setIsFullscreen(!!(document.fullscreenElement ?? doc.webkitFullscreenElement));
    };

    document.addEventListener('fullscreenchange', syncFullscreen);
    document.addEventListener('webkitfullscreenchange', syncFullscreen);
    return () => {
      document.removeEventListener('fullscreenchange', syncFullscreen);
      document.removeEventListener('webkitfullscreenchange', syncFullscreen);
    };
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const handlePlayerReady = useCallback((player: ReactPlayer | null) => {
    playerRef.current = player;
    if (pendingSyncRef.current) {
      setTimeout(() => {
        playerRef.current?.seekTo(pendingSyncRef.current!.time, 'seconds');
        if (pendingSyncRef.current!.playing) setPlaying(true);
        pendingSyncRef.current = null;
      }, 300);
    }
  }, []);

  const handleJoinRoom = () => {
    if (!username.trim()) return alert('Enter your name!');
    socket.connect();
    socket.once('connect', () => {
      socket.emit('room:join', { roomId: finalRoomId, username });
      setHasInteracted(true);
      setUrlInput(url);
    });
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat]);

  useEffect(() => {
    if (!hasInteracted) return;

    socket.on('room:sync_initial', ({ src, time, playing: isPlaying }) => {
      setUrl((currentUrl) => {
        if (src !== currentUrl) setPlayerKey((key) => key + 1);
        return src;
      });
      setUrlInput(src);
      pendingSyncRef.current = { time, playing: isPlaying };
    });

    socket.on('media:play', ({ time }) => {
      isRemoteEvent.current = true;
      setPlaying(true);
      playerRef.current?.seekTo(time, 'seconds');
    });

    socket.on('media:pause', () => {
      isRemoteEvent.current = true;
      setPlaying(false);
    });

    socket.on('media:change', ({ src }) => {
      setUrl(src);
      setUrlInput(src);
      setPlayerKey((key) => key + 1);
      setPlaying(false);
      setCurrentTime(0);
      currentTimeRef.current = 0;
      showToast('Video changed for everyone');
    });

    socket.on('chat:message', (data) => {
      setChat((prev) => [...prev, {
        roomId: data.roomId,
        user: data.user,
        text: data.text,
        time: data.time || formatChatTime(),
        isSystem: data.isSystem,
      }]);
    });

    socket.on('room:users', (userList) => {
      setUsers(userList);
    });

    return () => {
      socket.off('room:sync_initial');
      socket.off('media:play');
      socket.off('media:pause');
      socket.off('media:change');
      socket.off('chat:message');
      socket.off('room:users');
    };
  }, [hasInteracted]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    socket.emit('chat:message', { roomId: finalRoomId, user: username, text: message });
    setMessage('');
  };

  const handleProgress = ({ playedSeconds }: { playedSeconds: number }) => {
    setCurrentTime(playedSeconds);
    currentTimeRef.current = playedSeconds;
  };

  const handlePlay = () => {
    if (isRemoteEvent.current) { isRemoteEvent.current = false; return; }
    socket.emit('media:play', { roomId: finalRoomId, time: currentTimeRef.current });
  };

  const handlePause = () => {
    if (isRemoteEvent.current) { isRemoteEvent.current = false; return; }
    socket.emit('media:pause', { roomId: finalRoomId });
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;
    setUrl(urlInput);
    setPlayerKey((key) => key + 1);
    socket.emit('media:change', { roomId: finalRoomId, src: urlInput });
  };

  const handleCopyLink = () => {
    const shareUrl = `${window.location.origin}?room=${finalRoomId}`;
    navigator.clipboard.writeText(shareUrl);
    showToast('Room link copied!');
  };

  if (!hasInteracted) {
    return (
      <main style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', minHeight: '100vh', padding: '24px', position: 'relative', overflow: 'hidden' }}>
          <div className="login-orb" style={{ width: 700, height: 700, background: 'rgba(80,40,180,1)', opacity: 0.05, bottom: '-300px', right: '-200px' }} />
          <div className="login-orb" style={{ width: 400, height: 400, background: 'rgba(60,30,140,1)', opacity: 0.04, top: '-150px', left: '-100px' }} />
          <div style={{ width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 40, position: 'relative', zIndex: 1 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 14, marginBottom: 10 }}>
                <span style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.04em', color: 'var(--text)' }}>
                  Watch<span style={{ color: '#333' }}>.</span> Party
                </span>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>sync · realtime</p>
            </div>
            <div className="glass-card" style={{ padding: 30, display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em', fontFamily: 'var(--font-mono)' }}>Your name</label>
                <input className="input-base" type="text" value={username} onChange={(e) => setUsername(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleJoinRoom()} placeholder="What should we call you?" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em', fontFamily: 'var(--font-mono)' }}>Room code</label>
                <input
                  className="input-base"
                  type="text"
                  value={roomIdFromUrl || roomInput || generatedId}
                  onChange={(e) => setRoomInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleJoinRoom()}
                  placeholder="Create one or use the generated code"
                />
              </div>
              <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(100,60,220,0.3), transparent)' }} />
              <button className="btn-primary" onClick={handleJoinRoom} style={{ width: '100%' }}>Join Room →</button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main
      className="fixed inset-0 flex flex-col landscape:flex-row md:flex-row overflow-hidden bg-background"
      style={{ color: 'var(--text)' }}
    >
      {toast && <div className="toast">{toast}</div>}

      <div
        className={`relative flex flex-col bg-black landscape:h-full landscape:flex-1 md:h-full md:flex-1 ${
          isChatOpen ? 'h-[40dvh] shrink-0' : 'flex-1 min-h-0'
        }`}
      >
        <div className="app-header shrink-0">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
              <span style={{ fontWeight: 800, fontSize: 12, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text)' }}>Watch. Party</span>
              <span style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 2 }}><Hash size={8} /> {finalRoomId}</span>
            </div>
          </div>
          <span className={`pill ${playing ? 'pill-live' : 'pill-paused'}`} style={{ gap: 6 }}>
            {playing ? <Play size={10} fill="currentColor" /> : <Pause size={10} fill="currentColor" />}
            {playing ? 'live' : 'paused'}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              onClick={() => setIsChatOpen((open) => !open)}
              className="btn-icon"
              title={isChatOpen ? 'Hide chat' : 'Show chat'}
              aria-pressed={isChatOpen}
            >
              {isChatOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
            </button>
            <button
              type="button"
              onClick={toggleFullscreen}
              className="btn-icon"
              title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              aria-pressed={isFullscreen}
            >
              {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
            </button>
            <button type="button" onClick={toggleTheme} className="btn-icon">
              {isLight ? <Moon size={16} /> : <Sun size={16} />}
            </button>
            <div className="pill-room" title={users.map((user) => user.username).join(', ')}>
              <Users size={14} style={{ marginRight: 6 }} />
              <span style={{ fontSize: 11, fontWeight: 700 }}>{users.length}</span>
            </div>
            <button className="btn-icon" onClick={handleCopyLink}><Copy size={14} /></button>
          </div>
        </div>

        <div className="player-area relative flex-1 min-h-0 w-full flex items-center justify-center">
          <div className="player-frame w-full h-full max-h-full">
            <div style={{ position: 'absolute', inset: 0 }}>
              <Player key={playerKey} url={url} playing={playing} onPlayerReady={handlePlayerReady} onProgress={handleProgress} progressInterval={500} onPlay={handlePlay} onPause={handlePause} controls={true} width="100%" height="100%" />
            </div>
          </div>
        </div>

        <div className="url-bar shrink-0">
          <form onSubmit={handleUrlSubmit}>
            <div className="url-bar-inner">
              <LinkIcon size={13} color="var(--text-muted)" />
              <input className="url-input" type="text" value={urlInput} onChange={(e) => setUrlInput(e.target.value)} placeholder="Paste YouTube link..." style={{ marginLeft: 8 }} />
              <span className="url-time">{formatTime(currentTime)}</span>
              <button type="submit" className="url-btn">Change →</button>
            </div>
          </form>
        </div>
      </div>

      {isChatOpen && (
      <aside className="flex flex-col flex-1 min-h-0 bg-background landscape:w-[320px] landscape:flex-none landscape:border-l landscape:border-white/10 md:w-[350px] md:flex-none md:border-l md:border-white/10 transition-all overflow-hidden">
        <div className="chat-header shrink-0">
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em', fontFamily: 'var(--font-mono)' }}>Chat</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="glow-dot" style={{ background: '#4ade80' }} />
            <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>online</span>
          </div>
        </div>

        <div className="chat-messages scrollbar-hide flex-1 overflow-y-auto">
          {chat.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, opacity: 0.12 }}>
              <Monitor size={32} />
              <span style={{ fontSize: 10, letterSpacing: '0.08em', fontFamily: 'var(--font-mono)' }}>waiting for messages...</span>
            </div>
          ) : (
            chat.map((msg, i) => {
              const isMe = msg.user === username;
              const prevUser = i > 0 ? chat[i - 1].user : null;
              const showMeta = msg.user !== prevUser;
              return (
                <div key={i} className="msg-in" style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', marginTop: showMeta ? 14 : 2 }}>
                  {showMeta && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5, flexDirection: isMe ? 'row-reverse' : 'row' }}>
                      <Avatar name={msg.user} size={18} />
                      <span style={{ fontSize: 11, fontWeight: 700, color: getUserColor(msg.user) }}>{msg.user}</span>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{msg.time}</span>
                    </div>
                  )}
                  <div className={isMe ? 'bubble-me' : 'bubble-other'}>{msg.text}</div>
                </div>
              );
            })
          )}
          <div ref={chatEndRef} />
        </div>

        <form onSubmit={handleSendMessage} className="chat-input-area flex-none pb-safe">
          <input className="chat-input" type="text" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Say something..." />
          <button type="submit" className="chat-send">
            <Send size={15} />
          </button>
        </form>
      </aside>
      )}
    </main>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div style={{ background: '#080808', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#707070', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>loading interface...</div>}>
      <HomeContent />
    </Suspense>
  );
}
