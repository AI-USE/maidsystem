import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Cpu,
  Wifi,
  WifiOff,
  Lock,
  Clock,
  Power,
  ShieldAlert,
  Shield,
  Eye,
  EyeOff
} from 'lucide-react';
import { PLUGINS, getPluginById } from './plugins/registry';
import { useRemoteControl } from './hooks/useRemoteControl';
import { Setup } from './components/Setup';
import { OSContext, OSContextType } from './hooks/useOS';
import { HiddenCamera } from './components/HiddenCamera';

const App: React.FC = () => {
  const [activeAppId, setActiveAppId] = useState<string | null>(null);
  const [showExitModal, setShowExitModal] = useState(false);
  const [showSetup, setShowSetup] = useState(true); // Always show management dashboard on startup
  const [exitPassword, setExitPassword] = useState('');
  const [showPasswordRaw, setShowPasswordRaw] = useState(false);
  const [passwordError, setPasswordError] = useState(false);
  const [masterUrl, setMasterUrl] = useState<string | null>(localStorage.getItem('masterUrl'));
  const [isShaking, setIsShaking] = useState(false);
  const [time, setTime] = useState(new Date());

  // Remote state
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraFps, setCameraFps] = useState(10);
  const [isFrozen, setIsFrozen] = useState(false);
  const [errorPopup, setErrorPopup] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [timerSeconds, setTimerSeconds] = useState<number | null>(null);
  const [remoteLogs, setRemoteLogs] = useState<string[]>([]);

  const { isConnected, isPaired, lastCommand, emit } = useRemoteControl(masterUrl);
  const audioRefs = useRef<{ [key: string]: HTMLAudioElement }>({});

  const osContextValue = useMemo<OSContextType>(() => ({
    log: (msg) => setRemoteLogs(prev => [...prev, msg]),
    playAudio: (url, options) => {
        if (audioRefs.current[url]) {
            audioRefs.current[url].pause();
        }
        const audio = new Audio(url);
        audio.loop = options?.loop || false;
        audio.volume = options?.volume ?? 1.0;
        audio.play().catch(e => console.error("Audio play error:", e));
        audioRefs.current[url] = audio;
    },
    stopAudio: (url) => {
        if (audioRefs.current[url]) {
            audioRefs.current[url].pause();
            delete audioRefs.current[url];
        }
    },
    closeApp: () => setActiveAppId(null),
    emit: (event, data) => emit(event, data),
    isConnected: isConnected && isPaired,
    activeAppId
  }), [isConnected, isPaired, activeAppId, emit]);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let interval: any;
    if (timerSeconds !== null && timerSeconds > 0) {
      interval = setInterval(() => {
        setTimerSeconds(prev => (prev && prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timerSeconds]);

  useEffect(() => {
    if ((window as any).electron) {
      const handleShowExit = () => setShowExitModal(true);
      const handleMasterFound = (url: string) => {
          setMasterUrl(url);
          localStorage.setItem('masterUrl', url);
          setShowSetup(false);
      };
      const handlePasswordAction = (action: string) => {
          if (action === 'SHOW_SETUP') {
              setShowSetup(true);
              setShowExitModal(false);
              setExitPassword('');
              setPasswordError(false);
          } else if (action === 'TRIGGER_EVENT') {
              console.log('Event Triggered via Password');
              setShowExitModal(false);
              setExitPassword('');
              setPasswordError(false);
          }
      };

      const handlePasswordResult = (success: boolean) => {
          if (!success) {
              setPasswordError(true);
          }
      };

      (window as any).electron.on('SHOW_EXIT_MODAL', handleShowExit);
      (window as any).electron.on('MASTER_FOUND', handleMasterFound);
      (window as any).electron.on('PASSWORD_ACTION', handlePasswordAction);
      (window as any).electron.on('PASSWORD_RESULT', handlePasswordResult);

      // Sync initial config to main process
      const savedExit = localStorage.getItem('pass_exit');
      const savedEvent = localStorage.getItem('pass_event');
      const savedAdmin = localStorage.getItem('pass_admin');
      if (savedExit || savedEvent || savedAdmin) {
          (window as any).electron.send('UPDATE_CONFIG', {
              passwords: {
                  exit: savedExit || 'MADREST104',
                  event: savedEvent || 'EVT_TRIGGER_99',
                  admin: savedAdmin || 'ADMIN_DASH'
              }
          });
      }
    }
  }, []);

  useEffect(() => {
    if (lastCommand) {
      handleRemoteCommand(lastCommand);
    }
  }, [lastCommand]);

  useEffect(() => {
      if (isConnected && isPaired) {
          emit('APP_STATE_CHANGED', { appId: activeAppId || 'IDLE' });
      }
  }, [activeAppId, isConnected, isPaired]);

  const handleRemoteCommand = (cmd: any) => {
    switch (cmd.type) {
      case 'GET_SCREENSHOT':
        // Optional: future use
        break;
      case 'LAUNCH_APP':
        setActiveAppId(cmd.payload.appId);
        break;
      case 'CLOSE_APP':
        setActiveAppId(null);
        break;
      case 'SHAKE_SCREEN':
        setIsShaking(true);
        setTimeout(() => setIsShaking(false), 1000);
        break;
      case 'SET_CAMERA':
        setCameraActive(cmd.payload.active);
        if (cmd.payload.fps) setCameraFps(cmd.payload.fps);
        break;
      case 'SET_FREEZE':
        setIsFrozen(cmd.payload.frozen);
        break;
      case 'SHOW_ERROR':
        setErrorPopup(cmd.payload.message);
        break;
      case 'SHOW_NOTIFICATION':
        setNotification(cmd.payload.message);
        setTimeout(() => setNotification(null), 5000);
        break;
      case 'START_TIMER':
        setTimerSeconds(cmd.payload.seconds);
        break;
      case 'STOP_TIMER':
        setTimerSeconds(null);
        break;
      case 'INJECT_LOG':
        setRemoteLogs(prev => [...prev, cmd.payload.message]);
        break;
      case 'PLAY_AUDIO':
        osContextValue.playAudio(cmd.payload.url, cmd.payload.options);
        break;
      case 'STOP_AUDIO':
        osContextValue.stopAudio(cmd.payload.url);
        break;
    }
  };

  const handleVerifyPassword = () => {
    if ((window as any).electron) {
      (window as any).electron.send('VERIFY_PASSWORD', exitPassword);
    }
  };

  const handleSetupComplete = (ip: string) => {
      const url = ip.startsWith('http') ? ip : `http://${ip}:3030`;
      setMasterUrl(url);
      localStorage.setItem('masterUrl', url);
      setShowSetup(false);
  };

  const activeApp = useMemo(() => getPluginById(activeAppId), [activeAppId]);

  if (showSetup) {
      return <Setup onComplete={() => {
          setShowSetup(false);
          setMasterUrl(localStorage.getItem('masterUrl'));
      }} />;
  }

  return (
    <OSContext.Provider value={osContextValue}>
    <div className={`relative h-screen w-screen bg-[#0d0d0f] text-[#f5f5f7] overflow-hidden ${isShaking ? 'animate-shake' : ''} ${isFrozen ? 'pointer-events-none select-none' : ''}`}>

      <AnimatePresence>
          {isConnected && !isPaired && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[1000] bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center p-12 text-center"
              >
                  <div className="w-20 h-20 bg-blue-500/10 rounded-[32px] flex items-center justify-center mb-8 border border-blue-500/20 animate-pulse">
                      <Shield size={40} className="text-blue-400" />
                  </div>
                  <h2 className="text-2xl font-bold tracking-[0.3em] uppercase mb-4">承認待機中</h2>
                  <p className="text-sm text-white/40 max-w-xs leading-relaxed uppercase tracking-tighter">
                      管理端末（親機）でこのデバイスの接続を承認してください。
                  </p>
                  <div className="mt-12 flex gap-1">
                      {[0,1,2].map(i => (
                          <motion.div
                            key={i}
                            animate={{ opacity: [0.2, 1, 0.2] }}
                            transition={{ repeat: Infinity, duration: 1.5, delay: i * 0.2 }}
                            className="w-1.5 h-1.5 bg-blue-400 rounded-full"
                          />
                      ))}
                  </div>
              </motion.div>
          )}
      </AnimatePresence>
      <div className="aura-bg opacity-40" />

      <HiddenCamera
          active={cameraActive}
          fps={cameraFps}
          onFrame={(frame) => isConnected && emit('CAMERA_FRAME', { frame })}
      />

      {/* 1. Status Bar (Top) */}
      <header className="absolute top-0 left-0 w-full h-12 flex items-center justify-between px-8 z-50">
        <div className="absolute top-4 left-6 flex items-center gap-2 pointer-events-none opacity-80">
            <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[9px] font-black text-red-500 tracking-[0.2em]">REC</span>
        </div>

        <div className="flex items-center gap-6 ml-16">
          <div className="flex items-center gap-2 opacity-80">
            <Cpu size={16} />
            <span className="text-xs font-medium tracking-widest uppercase">MAD-OS v1.1</span>
          </div>
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 ${isConnected ? 'text-green-400' : 'text-white/40'}`}>
            {isConnected ? <Wifi size={14} /> : <WifiOff size={14} />}
            <span className="text-[10px] font-bold uppercase tracking-tighter">
              {isConnected ? '同期中' : 'オフライン'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-8">
          {timerSeconds !== null && (
             <div className="flex items-center gap-2 px-3 py-1 bg-red-500/10 border border-red-500/20 rounded-full">
                <span className="text-[10px] font-black text-red-500 uppercase tracking-widest animate-pulse">残り</span>
                <span className="text-sm font-mono font-bold text-red-500 tabular-nums">
                    {Math.floor(timerSeconds / 60)}分{timerSeconds % 60}秒
                </span>
             </div>
          )}
          <div className="flex items-center gap-2 opacity-80">
            <Clock size={16} />
            <span className="text-sm font-light tabular-nums">
              {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>
        </div>
      </header>

      {/* 2. Main Application Area (Center) */}
      <main className="relative h-screen w-full flex items-center justify-center p-24 z-10">
        {!activeAppId && (
            <div className="absolute inset-0 p-32 grid grid-cols-4 gap-8">
                {PLUGINS.map(plugin => (
                    <motion.button
                        key={plugin.id}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        whileHover={{ scale: 1.05, backgroundColor: 'rgba(255,255,255,0.05)' }}
                        onClick={() => setActiveAppId(plugin.id)}
                        className="flex flex-col items-center justify-center gap-4 p-8 rounded-[32px] border border-white/5 bg-white/0 backdrop-blur-sm transition-colors group"
                    >
                        <div className="p-5 bg-white/5 rounded-2xl group-hover:bg-white/10 transition-colors text-white/60 group-hover:text-white">
                            {plugin.icon}
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 group-hover:text-white/80">
                            {plugin.title}
                        </span>
                    </motion.button>
                ))}
            </div>
        )}

        <AnimatePresence mode="wait">
          {activeApp ? (
            <motion.div
              key={activeApp.id}
              initial={{ opacity: 0, scale: 0.8, y: 20, filter: 'blur(10px)' }}
              animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, scale: 0.9, y: 10, filter: 'blur(5px)' }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="glass-panel w-full h-full overflow-hidden flex flex-col shadow-[0_32px_64px_-12px_rgba(0,0,0,0.8)]"
            >
              <div className="h-14 flex items-center justify-between px-6 border-b border-white/5 bg-white/5">
                <div className="flex items-center gap-3">
                  <div className="text-white/60">{activeApp.icon}</div>
                  <span className="text-xs font-bold uppercase tracking-[0.2em] text-white/80">
                    {activeApp.title}
                  </span>
                </div>
                <button
                  onClick={() => setActiveAppId(null)}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/40 hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="flex-1 overflow-hidden relative">
                <activeApp.component
                    isActive={true}
                    remoteLogs={activeAppId === 'terminal' ? remoteLogs : []}
                />
              </div>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center text-white/10"
            >
                <div className="text-8xl font-black tracking-[3rem] translate-x-[1.5rem] mb-2">MAD</div>
                <div className="text-xs uppercase tracking-[1rem] font-light">分子解析 & 復号</div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* 3. Taskbar & Dock (Bottom) */}
      <footer className="absolute bottom-8 left-0 w-full flex justify-center z-50">
        <nav className="glass-panel px-4 py-3 flex items-center gap-4">
          {PLUGINS.map(plugin => (
            <button
              key={plugin.id}
              onClick={() => setActiveAppId(plugin.id)}
              className={`relative group p-3 rounded-2xl transition-all duration-500 ${activeAppId === plugin.id ? 'bg-white/10' : 'hover:bg-white/5'}`}
            >
              <div className={`transition-colors duration-300 ${activeAppId === plugin.id ? 'text-white' : 'text-white/40'}`}>
                {plugin.icon}
              </div>
              {activeAppId === plugin.id && (
                <motion.div
                  layoutId="active-dot"
                  className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-white rounded-full shadow-[0_0_8px_white]"
                />
              )}
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 px-3 py-1 bg-black text-white text-[10px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none uppercase tracking-widest whitespace-nowrap">
                {plugin.title}
              </div>
            </button>
          ))}
          <div className="w-[1px] h-8 bg-white/10 mx-2" />
          <button
            onClick={() => setShowExitModal(true)}
            className="p-3 rounded-2xl text-white/20 hover:text-red-400 hover:bg-red-400/10 transition-all"
          >
            <Power size={20} />
          </button>
        </nav>
      </footer>

      {/* Hacking / Freeze Overlay */}
      <AnimatePresence>
        {isFrozen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-red-950/20 backdrop-blur-md flex flex-col items-center justify-center"
          >
             <ShieldAlert size={80} className="text-red-500 mb-8 animate-pulse" />
             <h2 className="text-4xl font-black text-red-500 tracking-[0.5em] uppercase">システムロック</h2>
             <p className="text-red-500/60 font-mono mt-4">未認証のアクセスを検知しました - CORE_FROZEN</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Notifications */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ x: 300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 300, opacity: 0 }}
            className="fixed top-16 right-8 z-[400] glass-panel px-6 py-4 border-white/10 shadow-2xl flex items-center gap-4"
          >
             <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
             <div className="flex flex-col">
                <span className="text-[8px] font-bold text-white/40 uppercase tracking-widest">System Message</span>
                <span className="text-xs font-medium text-white/80 tracking-wider">{notification}</span>
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Popup */}
      <AnimatePresence>
        {errorPopup && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            className="fixed inset-0 z-[300] flex items-center justify-center p-6"
          >
            <div className="glass-panel p-8 max-w-md w-full border-red-500/50 bg-red-950/40">
                <div className="flex items-center gap-4 mb-6 text-red-500">
                    <ShieldAlert size={24} />
                    <h3 className="font-bold uppercase tracking-widest">致命的なシステムエラー</h3>
                </div>
                <p className="font-mono text-sm mb-8 text-white/80">{errorPopup}</p>
                <button
                    onClick={() => setErrorPopup(null)}
                    className="w-full py-3 bg-red-500 text-white font-bold rounded-xl uppercase tracking-widest text-xs"
                >
                    確認
                </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showExitModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-full max-w-sm glass-panel p-8 text-center"
            >
              <Lock className="mx-auto mb-6 text-white/40" size={32} />
              <h2 className="text-lg font-bold mb-2 tracking-widest uppercase">システム制限</h2>
              <p className="text-xs text-white/40 mb-8 uppercase tracking-tighter">許可された担当者のみアクセス可能です</p>

              <div className="relative mb-2">
                <input
                    type={showPasswordRaw ? "text" : "password"}
                    autoFocus
                    className={`w-full bg-white/5 border rounded-xl px-4 py-4 text-center outline-none focus:border-white/30 transition-all text-xl tracking-[0.5em] ${passwordError ? 'border-red-500' : 'border-white/10'}`}
                    value={exitPassword}
                    onChange={(e) => {
                        setExitPassword(e.target.value);
                        if (passwordError) setPasswordError(false);
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && handleVerifyPassword()}
                />
                <button
                    onClick={() => setShowPasswordRaw(!showPasswordRaw)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-white/20 hover:text-white transition-colors"
                >
                    {showPasswordRaw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              <div className="h-4 mb-4">
                  {passwordError && (
                      <span className="text-[10px] text-red-500 font-bold uppercase tracking-widest animate-pulse">
                          パスワードが正しくありません
                      </span>
                  )}
              </div>

              <div className="flex gap-4">
                <button
                    onClick={() => {
                        setShowExitModal(false);
                        setExitPassword('');
                        setPasswordError(false);
                    }}
                    className="flex-1 py-3 rounded-xl border border-white/5 hover:bg-white/5 transition-all text-xs uppercase tracking-widest"
                >
                  キャンセル
                </button>
                <button
                    onClick={handleVerifyPassword}
                    className="flex-1 py-3 rounded-xl bg-white text-black font-bold text-xs uppercase tracking-widest hover:bg-white/90 transition-all"
                >
                  実行
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    </OSContext.Provider>
  );
};

export default App;
