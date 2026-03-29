'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useState, useRef, useCallback } from 'react';
import { socket } from './lib/socket';
import dynamic from 'next/dynamic';

const Player = dynamic(() => import('./components/Player'), { ssr: false });

export default function Home() {
  const [playing, setPlaying] = useState(false);
  const [url, setUrl] = useState('https://www.youtube.com/watch?v=4W9_H0mdJBo');
  const [hasInteracted, setHasInteracted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [message, setMessage] = useState('');
  const [chat, setChat] = useState<{ user: string; text: string }[]>([]);

  const [roomId, setRoomId] = useState(''); // Novo estado
  const [username, setUsername] = useState(''); // Novo estado
  const [playerKey, setPlayerKey] = useState(1); // era 0

  const isRemoteEvent = useRef(false);
  const playerRef = useRef<any>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const currentTimeRef = useRef(0);
  const pendingSyncRef = useRef<{ time: number; playing: boolean } | null>(null);

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
    if (!username.trim()) return alert("Digite seu nome, dev!"); // Validação simples
    setHasInteracted(true);
    socket.connect();
    // Agora enviamos o nome real que a pessoa digitou
    socket.emit('room:join', { roomId: 'teste', username: username });
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat]);

  useEffect(() => {
    if (!hasInteracted) return;

    socket.on('room:sync_initial', ({ src, time, playing }) => {
      setUrl((currentUrl) => {
        if (src !== currentUrl) {
          setPlayerKey(k => k + 1); // só remonta se URL mudou
        }
        return src;
      });
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
      setPlayerKey(k => k + 1);
      setPlaying(false);
      setCurrentTime(0);
      currentTimeRef.current = 0;
    });

    socket.on('chat:message', (data) => {
      setChat((prev) => [...prev, data]);
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
    // Usamos o estado 'username' em vez do texto fixo "Kauan"
    socket.emit('chat:message', { roomId: 'teste', user: username, text: message });
    setMessage('');
  };

  const handleProgress = ({ playedSeconds }: { playedSeconds: number }) => {
    setCurrentTime(playedSeconds);
    currentTimeRef.current = playedSeconds;
  };

  const handlePlay = () => {
    if (isRemoteEvent.current) {
      isRemoteEvent.current = false;
      return; // ignora — foi o socket que trigou, não o usuário
    }
    socket.emit('media:play', { roomId: 'teste', time: currentTimeRef.current });
  };

  const handlePause = () => {
    if (isRemoteEvent.current) {
      isRemoteEvent.current = false;
      return;
    }
    socket.emit('media:pause', { roomId: 'teste' });
  };

  const handleUrlChange = (newUrl: string) => {
    setUrl(newUrl); // atualiza o input em tempo real
    // só emite e remonta quando o usuário para de digitar (URL completa)
  };

  const handleUrlSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      setPlayerKey(k => k + 1);
      socket.emit('media:change', { roomId: 'teste', src: url });
    }
  };

  return (
    <main className="flex h-screen max-w-[100vw] overflow-hidden bg-zinc-950 text-white font-sans">
      {!hasInteracted ? (
        <div className="flex flex-col items-center justify-center w-full min-h-screen bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-900/20 via-zinc-950 to-zinc-950 px-6">
          <div className="w-full max-w-md space-y-8 text-center">
            <div className="space-y-2">
              <h1 className="text-7xl font-black italic tracking-tighter text-white drop-shadow-2xl">
                Watch<span className="text-indigo-500 text-5xl">.</span>Party
              </h1>
            </div>

            <div className="bg-zinc-900/50 p-8 rounded-3xl border border-white/5 backdrop-blur-xl shadow-2xl space-y-6">
              <div className="space-y-2 text-left">
                <label className="text-[10px] uppercase font-bold text-zinc-500 ml-1 tracking-widest">Seu Nome</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Como quer ser chamado?"
                  className="w-full bg-zinc-800/50 border border-white/10 p-4 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-white placeholder:text-zinc-600"
                />
              </div>

              <button
                onClick={handleJoinRoom}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-indigo-600/20 active:scale-95"
              >
                Entrar na Sala
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row w-full h-screen overflow-hidden bg-zinc-950">
          {/* LADO ESQUERDO: PLAYER E CONTROLES */}
          <div className="flex-1 flex flex-col p-4 lg:p-6 overflow-y-auto scrollbar-hide">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <span className="bg-indigo-600 p-2 rounded-lg text-xl shadow-[0_0_20px_rgba(79,70,229,0.3)]">🍿</span>
                <h1 className="text-xl lg:text-2xl font-black tracking-tighter uppercase italic text-white">Rave Web</h1>
              </div>
              <div className="lg:hidden text-[10px] bg-zinc-900 px-3 py-1 rounded-full border border-white/5 text-zinc-400">
                Online: {username}
              </div>
            </div>

            {/* CONTAINER DO PLAYER COM PROPORÇÃO FIXA */}
            <div className="relative w-full shadow-2xl shadow-indigo-500/10 rounded-2xl lg:rounded-3xl overflow-hidden border border-white/5 bg-black" 
                 style={{ paddingTop: '56.25%' }}>
              <div className="absolute top-0 left-0 w-full h-full">
                <Player
                  key={playerKey}
                  url={url}
                  playing={playing}
                  onPlayerReady={handlePlayerReady}
                  onProgress={handleProgress}
                  progressInterval={500}
                  onPlay={handlePlay}
                  onPause={handlePause}
                  controls={true}
                  width="100%"
                  height="100%"
                />
              </div>
            </div>

            {/* CONTROLES ABAIXO DO VIDEO */}
            <div className="mt-6 lg:mt-8 space-y-4">
              <div className="flex flex-col gap-2">
                <label className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest ml-1">Trocar Conteúdo</label>
                <input
                  type="text"
                  value={url}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  onKeyDown={handleUrlSubmit}
                  className="w-full bg-zinc-900/50 border border-white/5 p-4 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-zinc-300 placeholder:text-zinc-700 backdrop-blur-sm"
                  placeholder="Cole o link do YouTube..."
                />
              </div>
              
              <div className="flex items-center justify-between px-1">
                <p className="text-[9px] lg:text-[10px] text-zinc-500 uppercase tracking-widest font-medium">
                  Status: <span className={playing ? "text-green-500" : "text-amber-500"}>{playing ? 'Sincronizado' : 'Pausado'}</span>
                </p>
                <p className="text-[9px] lg:text-[10px] text-zinc-400 font-mono">
                  {Math.floor(currentTime / 60)}:{(currentTime % 60).toFixed(0).padStart(2, '0')}s
                </p>
              </div>
            </div>
          </div>

          {/* LADO DIREITO: CHAT (Vira rodapé no mobile) */}
          <div className="w-full lg:w-80 lg:border-l border-t lg:border-t-0 border-white/5 bg-zinc-900/30 backdrop-blur-md flex flex-col h-[35vh] lg:h-full">
            <div className="p-4 border-b border-white/5 flex items-center justify-between">
              <h2 className="font-bold text-xs uppercase tracking-widest text-zinc-400">Chat da Sala</h2>
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            </div>

            {/* MENSAGENS */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide">
              {chat.length === 0 && (
                <p className="text-center text-zinc-700 text-[10px] mt-4 italic uppercase tracking-wider">Nenhuma mensagem ainda</p>
              )}
              {chat.map((msg, i) => (
                <div key={i} className={`flex flex-col ${msg.user === username ? 'items-end' : 'items-start'}`}>
                  <span className={`text-[9px] font-black uppercase mb-0.5 tracking-tighter ${msg.user === username ? 'text-indigo-400' : 'text-zinc-500'}`}>
                    {msg.user}
                  </span>
                  <div className={`px-3 py-2 rounded-2xl text-sm max-w-[90%] ${msg.user === username ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-zinc-800 text-zinc-200 rounded-tl-none'}`}>
                    {msg.text}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* INPUT DO CHAT */}
            <form onSubmit={handleSendMessage} className="p-4 bg-zinc-950/50">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Diga algo legal..."
                className="w-full bg-zinc-800/40 border border-white/5 p-3 rounded-xl text-sm outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
              />
            </form>
          </div>
        </div>
      )}
    </main>
  );
}