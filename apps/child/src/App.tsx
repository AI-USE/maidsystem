import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Minimize2, Cpu, Wifi, WifiOff, Lock } from 'lucide-react';
import { TerminalPlugin } from './plugins/Terminal';
import { CameraPlugin } from './plugins/Camera';
import { useRemoteControl } from './hooks/useRemoteControl';

const PLUGINS = [TerminalPlugin, CameraPlugin];

const App: React.FC = () => {
  const [activeAppId, setActiveAppId] = useState<string | null>(null);
  const [showExitModal, setShowExitModal] = useState(false);
  const [exitPassword, setExitPassword] = useState('');
  const [masterUrl, setMasterUrl] = useState<string | null>(null);
  const [isShaking, setIsShaking] = useState(false);
  const { isConnected, lastCommand } = useRemoteControl(masterUrl);

  useEffect(() => {
    if ((window as any).electron) {
      (window as any).electron.on('SHOW_EXIT_MODAL', () => setShowExitModal(true));
      (window as any).electron.on('MASTER_FOUND', (url: string) => setMasterUrl(url));
      (window as any).electron.send('START_DISCOVERY');
    }
  }, []);

  useEffect(() => {
    if (lastCommand) {
      handleRemoteCommand(lastCommand);
    }
  }, [lastCommand]);

  const handleRemoteCommand = (cmd: any) => {
    switch (cmd.type) {
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
    }
  };

  const handleExit = () => {
    if ((window as any).electron) {
      (window as any).electron.send('VERIFY_EXIT_PASSWORD', exitPassword);
    }
  };

  const activeApp = useMemo(() => PLUGINS.find(p => p.id === activeAppId), [activeAppId]);

  return (
    <div className={`relative h-screen w-screen bg-[#0a0a0b] overflow-hidden crt-screen ${isShaking ? 'animate-shake' : ''}`}>
      <div className="scanlines" />
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(#00ff41_1px,transparent_1px)] [background-size:20px_20px]" />
      </div>

      <header className="h-10 bg-black/50 border-b border-[#00ff41]/30 flex items-center justify-between px-4 z-50 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-[#00ff41] font-bold tracking-tighter">
            <Cpu size={18} className="animate-pulse" />
            <span className="neon-text text-sm">MAD-OS v1.0.4</span>
          </div>
          <div className="h-4 w-[1px] bg-[#00ff41]/20" />
          <nav className="flex gap-4">
            {PLUGINS.map(plugin => (
              <button
                key={plugin.id}
                onClick={() => setActiveAppId(plugin.id)}
                className={`text-[10px] uppercase tracking-widest transition-all ${
                  activeAppId === plugin.id ? 'text-[#00ff41] border-b border-[#00ff41]' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {plugin.title}
              </button>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className={`flex items-center gap-1 ${isConnected ? 'text-[#00ff41]' : 'text-gray-600'}`}>
            {isConnected ? <Wifi size={14} /> : <WifiOff size={14} />}
            <span className="text-[10px] uppercase">{isConnected ? 'Link Active' : 'Offline'}</span>
          </div>
          <div className="text-gray-500 text-[10px]">{new Date().toLocaleTimeString()}</div>
        </div>
      </header>

      <main className="relative h-[calc(100vh-40px)] w-full p-6">
        <AnimatePresence mode="wait">
          {activeApp && (
            <motion.div
              key={activeApp.id}
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 1.05, y: -10 }}
              className="glass-panel w-full h-full rounded-lg overflow-hidden flex flex-col"
            >
              <div className="h-8 bg-[#00ff41]/10 flex items-center justify-between px-4 border-b border-[#00ff41]/20">
                <div className="flex items-center gap-2">
                  {activeApp.icon}
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#00ff41]/80">
                    {activeApp.title}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button className="p-1 hover:bg-[#00ff41]/20 rounded text-[#00ff41]/50"><Minimize2 size={14} /></button>
                  <button onClick={() => setActiveAppId(null)} className="p-1 hover:bg-red-500/20 rounded text-red-500/50"><X size={14} /></button>
                </div>
              </div>
              <div className="flex-1 overflow-hidden">
                <activeApp.component onClose={() => setActiveAppId(null)} />
              </div>
            </motion.div>
          )}
          {!activeApp && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center h-full text-[#00ff41]/20"
            >
              <div className="text-6xl mb-4 tracking-[2rem] translate-x-[1rem] neon-text">MAD</div>
              <div className="text-[10px] uppercase tracking-[0.5rem] font-light">Molecular Analysis & Decoding OS</div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {showExitModal && (
        <div className="fixed inset-0 z-[10000] bg-black/90 backdrop-blur-xl flex items-center justify-center p-6 text-white">
          <div className="w-full max-w-md glass-panel p-8 rounded-2xl border-white/10 text-center">
            <h2 className="text-xl font-bold mb-4">SYSTEM_LOCK</h2>
            <input
              type="password"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-center outline-none mb-6"
              value={exitPassword}
              onChange={(e) => setExitPassword(e.target.value)}
              placeholder="ENTER PASSWORD"
              onKeyDown={(e) => e.key === 'Enter' && handleExit()}
            />
            <button onClick={handleExit} className="px-6 py-2 bg-[#00ff41]/20 border border-[#00ff41] text-[#00ff41] uppercase tracking-widest">Terminate</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
