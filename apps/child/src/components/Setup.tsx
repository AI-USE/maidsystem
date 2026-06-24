import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Wifi, Shield, ArrowRight } from 'lucide-react';

interface SetupProps {
  onComplete: (masterIp: string) => void;
}

export const Setup: React.FC<SetupProps> = ({ onComplete }) => {
  const [ip, setIp] = useState('');
  const [kioskEnabled, setKioskEnabled] = useState(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (ip) {
      onComplete(ip);
    }
  };

  const toggleKiosk = () => {
    const newState = !kioskEnabled;
    setKioskEnabled(newState);
    if ((window as any).electron) {
        (window as any).electron.send('SET_KIOSK', newState);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-[#0f0f11] flex items-center justify-center p-6">
      <div className="aura-bg" />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md glass-panel p-10 flex flex-col items-center text-center relative z-10"
      >
        <div className="w-16 h-16 bg-white/5 rounded-[24px] flex items-center justify-center mb-8 border border-white/10">
          <Wifi className="text-white/60" size={32} />
        </div>

        <h1 className="text-2xl font-bold mb-2 tracking-tight">Establish Connection</h1>
        <p className="text-sm text-white/40 mb-10">Enter the Master Terminal IP address to pair this device.</p>

        <form onSubmit={handleSubmit} className="w-full space-y-6">
          <div className="relative">
            <input
              type="text"
              autoFocus
              placeholder="0.0.0.0"
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-center outline-none focus:border-white/30 transition-all text-xl font-mono tracking-widest placeholder:opacity-20"
              value={ip}
              onChange={(e) => setIp(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
            <div className="text-left">
                <div className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-1">Security Mode</div>
                <div className="text-xs font-bold text-white/80">Kiosk & Shortcut Lock</div>
            </div>
            <button
                type="button"
                onClick={toggleKiosk}
                className={`w-12 h-6 rounded-full transition-all relative ${kioskEnabled ? 'bg-white' : 'bg-white/10'}`}
            >
                <div className={`absolute top-1 w-4 h-4 rounded-full transition-all ${kioskEnabled ? 'right-1 bg-black' : 'left-1 bg-white/40'}`} />
            </button>
          </div>

          <button
            type="submit"
            disabled={!ip}
            className="w-full py-4 rounded-2xl bg-white text-black font-bold text-xs uppercase tracking-[0.2em] hover:bg-white/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            Initialize Pairing
            <ArrowRight size={16} />
          </button>
        </form>

        <div className="mt-10 pt-8 border-t border-white/5 w-full flex items-center justify-center gap-4 text-white/20">
          <Shield size={14} />
          <span className="text-[10px] font-bold uppercase tracking-widest">Kiosk Protocol v2.0</span>
        </div>
      </motion.div>
    </div>
  );
};
