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
  ShieldAlert
} from 'lucide-react';
import { TerminalPlugin } from './plugins/Terminal';
import { CameraPlugin } from './plugins/Camera';
import { useRemoteControl } from './hooks/useRemoteControl';
import { Setup } from './components/Setup';
import { OSContext, OSContextType } from './hooks/useOS';

const PLUGINS = [TerminalPlugin, CameraPlugin];

const App: React.FC = () => {
  const [activeAppId, setActiveAppId] = useState<string | null>(null);
  const [showExitModal, setShowExitModal] = useState(false);
  const [showSetup, setShowSetup] = useState(!localStorage.getItem('masterUrl'));
  const [exitPassword, setExitPassword] = useState('');
  const [masterUrl, setMasterUrl] = useState<string | null>(localStorage.getItem('masterUrl'));
  const [isShaking, setIsShaking] = useState(false);
  const [time, setTime] = useState(new Date());

  // Remote state
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraFps, setCameraFps] = useState(10);
  const [isFrozen, setIsFrozen] = useState(false);
  const [errorPopup, setErrorPopup] = useState<string | null>(null);
  const [remoteLogs, setRemoteLogs] = useState<string[]>([]);

  const { isConnected, lastCommand, emit } = useRemoteControl(masterUrl);
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
    isConnected,
    activeAppId
  }), [isConnected, activeAppId]);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

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
          } else if (action === 'TRIGGER_EVENT') {
              console.log('Event Triggered via Password');
              setShowExitModal(false);
              setExitPassword('');
          }
      };

      (window as any).electron.on('SHOW_EXIT_MODAL', handleShowExit);
      (window as any).electron.on('MASTER_FOUND', handleMasterFound);
      (window as any).electron.on('PASSWORD_ACTION', handlePasswordAction);
    }
  }, []);

  useEffect(() => {
    if (lastCommand) {
      handleRemoteCommand(lastCommand);
    }
  }, [lastCommand]);

  useEffect(() => {
      if (isConnected) {
          emit('APP_STATE_CHANGED', { appId: activeAppId || 'IDLE' });
      }
  }, [activeAppId, isConnected]);

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

  const activeApp = useMemo(() => PLUGINS.find(p => p.id === activeAppId), [activeAppId]);

  if (showSetup) {
      return <Setup onComplete={handleSetupComplete} />;
  }

  return (
    <OSContext.Provider value={osContextValue}>
    <div className={`relative h-screen w-screen bg-[#0f0f11] text-[#f5f5f7] overflow-hidden ${isShaking ? 'animate-shake' : ''} ${isFrozen ? 'pointer-events-none select-none' : ''}`}>
      <div className="aura-bg" />

      {/* 1. Status Bar (Top) */}
      <header className="absolute top-0 left-0 w-full h-12 flex items-center justify-between px-8 z-50">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 opacity-80">
            <Cpu size={16} />
            <span className="text-xs font-medium tracking-widest uppercase">MAD-OS v1.1</span>
          </div>
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 ${isConnected ? 'text-green-400' : 'text-white/40'}`}>
            {isConnected ? <Wifi size={14} /> : <WifiOff size={14} />}
            <span className="text-[10px] font-bold uppercase tracking-tighter">
              {isConnected ? 'Sync Active' : 'Offline Mode'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4 opacity-80">
          <div className="flex items-center gap-2">
            <Clock size={16} />
            <span className="text-sm font-light tabular-nums">
              {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>
        </div>
      </header>

      {/* 2. Main Application Area (Center) */}
      <main className="relative h-screen w-full flex items-center justify-center p-24 z-10">
        <AnimatePresence mode="wait">
          {activeApp ? (
            <motion.div
              key={activeApp.id}
              initial={{ opacity: 0, scale: 0.98, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 1.02, y: -10 }}
              transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
              className="glass-panel w-full h-full overflow-hidden flex flex-col"
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
                    isActive={activeAppId === 'camera' ? cameraActive : true}
                    fps={cameraFps}
                    remoteLogs={activeAppId === 'terminal' ? remoteLogs : []}
                    onFrame={(frame: string) => {
                        if (activeAppId === 'camera' && cameraActive && isConnected) {
                            emit('CAMERA_FRAME', { frame });
                        }
                    }}
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
                <div className="text-xs uppercase tracking-[1rem] font-light">Molecular Analysis & Decoding</div>
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
              className="relative group p-3 rounded-2xl transition-all duration-300 hover:bg-white/10"
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
             <h2 className="text-4xl font-black text-red-500 tracking-[0.5em] uppercase">System Locked</h2>
             <p className="text-red-500/60 font-mono mt-4">UNAUTHORIZED ACCESS DETECTED - CORE_FROZEN</p>
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
                    <h3 className="font-bold uppercase tracking-widest">Critical System Error</h3>
                </div>
                <p className="font-mono text-sm mb-8 text-white/80">{errorPopup}</p>
                <button
                    onClick={() => setErrorPopup(null)}
                    className="w-full py-3 bg-red-500 text-white font-bold rounded-xl uppercase tracking-widest text-xs"
                >
                    Acknowledge
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
              <h2 className="text-lg font-bold mb-2 tracking-widest uppercase">System Restriction</h2>
              <p className="text-xs text-white/40 mb-8 uppercase tracking-tighter">Authorized personnel only</p>

              <input
                type="password"
                autoFocus
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-center outline-none mb-6 focus:border-white/30 transition-all text-xl tracking-[0.5em]"
                value={exitPassword}
                onChange={(e) => setExitPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleVerifyPassword()}
              />

              <div className="flex gap-4">
                <button
                    onClick={() => {
                        setShowExitModal(false);
                        setExitPassword('');
                    }}
                    className="flex-1 py-3 rounded-xl border border-white/5 hover:bg-white/5 transition-all text-xs uppercase tracking-widest"
                >
                  Cancel
                </button>
                <button
                    onClick={handleVerifyPassword}
                    className="flex-1 py-3 rounded-xl bg-white text-black font-bold text-xs uppercase tracking-widest hover:bg-white/90 transition-all"
                >
                  Confirm
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
