'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useState, useRef, useCallback } from 'react';
import { socket } from './lib/socket';
import dynamic from 'next/dynamic';

const Player = dynamic(() => import('./components/Player'), { ssr: false });

function getUserColor(name: string): string {
  const colors = ['#888', '#999', '#777', '#aaa', '#666', '#bbb', '#555', '#ccc'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: '#1A1A1A',
      border: '1px solid #2E2E2E',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.4, fontWeight: 700, color: '#888', flexShrink: 0,
    }}>
      {name[0].toUpperCase()}
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

export default function Home() {
  const [playing, setPlaying] = useState(false);
  const [url, setUrl] = useState('https://www.youtube.com/watch?v=4W9_H0mdJBo');
  const [hasInteracted, setHasInteracted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [message, setMessage] = useState('');
  const [chat, setChat] = useState<{ user: string; text: string; time: string }[]>([]);
  const [roomId, setRoomId] = useState('');
  const [username, setUsername] = useState('');
  const [playerKey, setPlayerKey] = useState(1);
  const [toast, setToast] = useState('');
  const [urlInput, setUrlInput] = useState('');

  const isRemoteEvent = useRef(false);
  const playerRef = useRef<any>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const currentTimeRef = useRef(0);
  const pendingSyncRef = useRef<{ time: number; playing: boolean } | null>(null);
  const finalRoomId = roomId.trim() || 'geral';

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const handlePlayerReady = useCallback((player: any) => {
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
    if (!username.trim()) return alert('Digite seu nome!');
    setHasInteracted(true);
    setUrlInput(url);
    socket.connect();
    socket.emit('room:join', { roomId: finalRoomId, username });
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat]);

  useEffect(() => {
    if (!hasInteracted) return;

    socket.on('room:sync_initial', ({ src, time, playing }) => {
      setUrl((currentUrl) => {
        if (src !== currentUrl) setPlayerKey(k => k + 1);
        return src;
      });
      setUrlInput(src);
      pendingSyncRef.current = { time, playing };
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
      setPlayerKey(k => k + 1);
      setPlaying(false);
      setCurrentTime(0);
      currentTimeRef.current = 0;
      showToast('🎬 Vídeo alterado para todos');
    });

    socket.on('chat:message', (data) => {
      setChat((prev) => [...prev, { ...data, time: formatChatTime() }]);
    });

    return () => {
      socket.off('room:sync_initial');
      socket.off('media:play');
      socket.off('media:pause');
      socket.off('media:change');
      socket.off('chat:message');
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

  const handleSeek = (seconds: number) => {
    if (isRemoteEvent.current) {
      isRemoteEvent.current = false;
      return;
    }
    console.log("⏩ Seek local detectado:", seconds);
    socket.emit('media:play', { roomId: finalRoomId, time: seconds });
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;
    setUrl(urlInput);
    setPlayerKey(k => k + 1);
    socket.emit('media:change', { roomId: finalRoomId, src: urlInput });
    showToast('🎬 Vídeo alterado para todos');
  };

  return (
    <main style={{
      display: 'flex', minHeight: '100vh',
      background: 'var(--bg)', color: 'var(--text)',
      fontFamily: 'var(--font-main)', overflow: 'hidden',
    }}>

      {!hasInteracted ? (
        /* ─── LOGIN ──────────────────────────────────────────────── */
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', width: '100%', minHeight: '100vh',
          padding: '24px', position: 'relative', overflow: 'hidden',
        }}>
          {/* Barely-visible purple orbs — only at extremes */}
          <div className="login-orb" style={{
            width: 700, height: 700,
            background: 'rgba(80,40,180,1)',
            opacity: 0.05,
            bottom: '-300px', right: '-200px',
          }} />
          <div className="login-orb" style={{
            width: 400, height: 400,
            background: 'rgba(60,30,140,1)',
            opacity: 0.04,
            top: '-150px', left: '-100px',
          }} />

          <div style={{ width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 40, position: 'relative', zIndex: 1 }}>

            {/* Logo */}
            <div style={{ textAlign: 'center' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 14, marginBottom: 10 }}>
                <div className="logo-icon">🍿</div>
                <span style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.04em', color: 'var(--text)' }}>
                  Watch<span style={{ color: '#333' }}>.</span>Party
                </span>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: 13, fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
                sync · realtime
              </p>
            </div>

            {/* Card */}
            <div className="glass-card" style={{ padding: 30, display: 'flex', flexDirection: 'column', gap: 18 }}>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em', fontFamily: 'var(--font-mono)' }}>
                  Seu nome
                </label>
                <input
                  className="input-base"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleJoinRoom()}
                  placeholder="Como quer ser chamado?"
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em', fontFamily: 'var(--font-mono)' }}>
                  Código da sala
                </label>
                <input
                  className="input-base"
                  type="text"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleJoinRoom()}
                  placeholder="Deixe vazio para sala pública"
                />
              </div>

              {/* Thin purple line before button — only accent touch */}
              <div style={{
                height: 1,
                background: 'linear-gradient(90deg, transparent, rgba(100,60,220,0.3), transparent)',
              }} />

              <button className="btn-primary" onClick={handleJoinRoom} style={{ width: '100%' }}>
                Entrar na Sala →
              </button>
            </div>
          </div>
        </div>

      ) : (
        /* ─── MAIN LAYOUT ────────────────────────────────────────── */
        <div className="layout">

          {toast && <div className="toast">{toast}</div>}

          {/* ── PLAYER COLUMN ──────────────────────────────────────── */}
          <div className="player-col">

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="logo-icon">🍿</div>
                <span style={{ fontWeight: 800, fontSize: 15, letterSpacing: '-0.02em', textTransform: 'uppercase', color: 'var(--text)' }}>
                  Rave Web
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className={`pill ${playing ? 'pill-live' : 'pill-paused'}`}>
                  <span className="glow-dot" style={{ background: playing ? '#4ade80' : '#fbbf24' }} />
                  {playing ? 'ao vivo' : 'pausado'}
                </span>

                <span className="pill pill-room">
                  <Avatar name={username} size={15} />
                  {username}
                  <span style={{ color: 'var(--text-muted)', marginLeft: 1 }}>· #{finalRoomId}</span>
                </span>
              </div>
            </div>
            {/* ── PLAYER CONTAINER (Dynamic Aspect Ratio) ────────────────── */}
            <div style={{
              flex: 1,
              minHeight: 0,
              display: 'flex',
              alignItems: 'center', // CORRIGIDO: 'I' maiúsculo
              justifyContent: 'center',
              marginBottom: 16,
              flexShrink: 0,
            }}>
              <div style={{
                aspectRatio: '16/9',
                width: '100%',
                // maxWidth evita que o container fique maior que o vídeo real em telas grandes
                maxWidth: 'calc(100vh * 1.77)',
                maxHeight: '100%',

                borderRadius: 14,
                overflow: 'hidden',
                border: '1px solid var(--border)',
                background: '#000',
                boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
                position: 'relative',
              }}>
                <div style={{ position: 'absolute', inset: 0 }}>
                  <Player
                    key={playerKey}
                    url={url}
                    playing={playing}
                    onPlayerReady={handlePlayerReady}
                    onProgress={handleProgress}
                    onSeek={handleSeek}
                    progressInterval={500}
                    onPlay={handlePlay}
                    onPause={handlePause}
                    controls={true}
                    width="100%"
                    height="100%"
                  />
                </div>
              </div>
            </div>

            {/* URL bar */}
            <div style={{ marginTop: 14, flexShrink: 0 }}>
              <form onSubmit={handleUrlSubmit} style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1, position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: 'var(--text-muted)' }}>
                    🔗
                  </span>
                  <input
                    className="input-base"
                    type="text"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    style={{ paddingLeft: 36, fontSize: 13, color: 'var(--text-sub)' }}
                    placeholder="Cole o link do YouTube..."
                  />
                </div>
                <button type="submit" className="btn-ghost" style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                  Trocar →
                </button>
              </form>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 7 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {formatTime(currentTime)}
                </span>
              </div>
            </div>
          </div>

          {/* ── CHAT COLUMN ────────────────────────────────────────── */}
          <div className="chat-col">

            {/* Thin purple top line — only accent in the whole sidebar */}
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: 1,
              background: 'linear-gradient(90deg, transparent, rgba(100,60,220,0.35), transparent)',
            }} />

            {/* Chat header */}
            <div style={{
              padding: '16px 18px', marginTop: 1,
              borderBottom: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              flexShrink: 0,
            }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em', fontFamily: 'var(--font-mono)' }}>
                Chat da sala
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="glow-dot" style={{ background: '#4ade80' }} />
                <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>online</span>
              </div>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px 6px' }}>
              {chat.length === 0 ? (
                <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                  <span style={{ fontSize: 22, opacity: 0.2 }}>👁</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)' }}>
                    assistindo junto...
                  </span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {chat.map((msg, i) => {
                    const isMe = msg.user === username;
                    const prevUser = i > 0 ? chat[i - 1].user : null;
                    const showAvatar = msg.user !== prevUser;

                    return (
                      <div key={i} className="msg-in" style={{
                        display: 'flex', flexDirection: 'column',
                        alignItems: isMe ? 'flex-end' : 'flex-start',
                        marginTop: showAvatar ? 12 : 2,
                      }}>
                        {showAvatar && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5, flexDirection: isMe ? 'row-reverse' : 'row' }}>
                            <Avatar name={msg.user} size={18} />
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#555' }}>
                              {msg.user}
                            </span>
                            <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{msg.time}</span>
                          </div>
                        )}
                        <div className={`bubble ${isMe ? 'bubble-me' : 'bubble-other'}`}>
                          {msg.text}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={chatEndRef} />
                </div>
              )}
            </div>

            {/* Chat input */}
            <form
              onSubmit={handleSendMessage}
              style={{ padding: '10px 14px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, flexShrink: 0 }}
            >
              <input
                className="input-base"
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Diga algo..."
                style={{ fontSize: 13 }}
              />
              <button
                type="submit"
                style={{
                  background: '#1C1C1C',
                  border: '1px solid #2E2E2E',
                  borderRadius: 10,
                  width: 42, height: 42, cursor: 'pointer', fontSize: 15,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s', flexShrink: 0, color: 'var(--text-sub)',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#3E3E3E'; e.currentTarget.style.color = 'var(--text)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#2E2E2E'; e.currentTarget.style.color = 'var(--text-sub)'; }}
                onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.92)')}
                onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
              >
                ↑
              </button>
            </form>
          </div>

        </div>
      )}
    </main>
  );
}