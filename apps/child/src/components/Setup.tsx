import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Wifi, Shield, ArrowRight } from 'lucide-react';

interface SetupProps {
  onComplete: () => void;
}

export const Setup: React.FC<SetupProps> = ({ onComplete }) => {
  const [step, setStep] = useState(1);
  const [ip, setIp] = useState(localStorage.getItem('masterUrl') || '');
  const [kioskEnabled, setKioskEnabled] = useState(true);
  const [passwords, setPasswords] = useState({
      exit: localStorage.getItem('pass_exit') || 'MADREST104',
      event: localStorage.getItem('pass_event') || 'EVT_TRIGGER_99',
      admin: localStorage.getItem('pass_admin') || 'ADMIN_DASH'
  });

  const saveAndNext = () => {
      if (step === 3) {
          localStorage.setItem('masterUrl', ip);
          localStorage.setItem('pass_exit', passwords.exit);
          localStorage.setItem('pass_event', passwords.event);
          localStorage.setItem('pass_admin', passwords.admin);

          if ((window as any).electron) {
              (window as any).electron.send('UPDATE_CONFIG', {
                  passwords,
                  kiosk: kioskEnabled
              });
          }
          onComplete();
      } else {
          setStep(step + 1);
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
    <div className="fixed inset-0 z-[200] bg-[#0d0d0f] flex items-center justify-center p-6">
      <div className="aura-bg" />
      <motion.div
        key={step}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="w-full max-w-md glass-panel p-10 flex flex-col items-center text-center relative z-10"
      >
        <div className="flex gap-2 mb-8">
            {[1,2,3].map(i => (
                <div key={i} className={`w-8 h-1 rounded-full transition-all ${step >= i ? 'bg-white' : 'bg-white/10'}`} />
            ))}
        </div>

        {step === 1 && (
            <div className="w-full">
                <div className="w-16 h-16 bg-white/5 rounded-[24px] flex items-center justify-center mx-auto mb-8 border border-white/10">
                    <Wifi className="text-white/60" size={32} />
                </div>
                <h1 className="text-2xl font-bold mb-2 tracking-tight">ネットワーク設定</h1>
                <p className="text-sm text-white/40 mb-10">親機端末のIPアドレスを入力してください。</p>
                <input
                    type="text"
                    placeholder="0.0.0.0"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-center outline-none focus:border-white/30 transition-all text-xl font-mono tracking-widest mb-8"
                    value={ip}
                    onChange={(e) => setIp(e.target.value)}
                />
            </div>
        )}

        {step === 2 && (
            <div className="w-full space-y-6">
                <div className="w-16 h-16 bg-white/5 rounded-[24px] flex items-center justify-center mx-auto mb-8 border border-white/10">
                    <Shield className="text-white/60" size={32} />
                </div>
                <h1 className="text-2xl font-bold mb-2 tracking-tight">パスワード設定</h1>
                <div className="space-y-4 text-left">
                    <div>
                        <label className="text-[10px] uppercase tracking-widest text-white/40 ml-2">終了用</label>
                        <input
                            type="text"
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-white/30 transition-all font-mono"
                            value={passwords.exit}
                            onChange={(e) => setPasswords({...passwords, exit: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="text-[10px] uppercase tracking-widest text-white/40 ml-2">イベント用</label>
                        <input
                            type="text"
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-white/30 transition-all font-mono"
                            value={passwords.event}
                            onChange={(e) => setPasswords({...passwords, event: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="text-[10px] uppercase tracking-widest text-white/40 ml-2">管理者用</label>
                        <input
                            type="text"
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-white/30 transition-all font-mono"
                            value={passwords.admin}
                            onChange={(e) => setPasswords({...passwords, admin: e.target.value})}
                        />
                    </div>
                </div>
            </div>
        )}

        {step === 3 && (
            <div className="w-full">
                <div className="w-16 h-16 bg-white/5 rounded-[24px] flex items-center justify-center mx-auto mb-8 border border-white/10">
                    <Shield className="text-white/60" size={32} />
                </div>
                <h1 className="text-2xl font-bold mb-2 tracking-tight">セキュリティ設定</h1>
                <p className="text-sm text-white/40 mb-10">本番環境での動作モードを選択してください。</p>
                <div className="flex items-center justify-between p-6 bg-white/5 rounded-2xl border border-white/10 mb-8">
                    <div className="text-left">
                        <div className="text-xs font-bold text-white/80">キオスクモード</div>
                        <div className="text-[10px] text-white/40 uppercase tracking-tighter mt-1">システムの完全遮断</div>
                    </div>
                    <button
                        onClick={toggleKiosk}
                        className={`w-12 h-6 rounded-full transition-all relative ${kioskEnabled ? 'bg-white' : 'bg-white/10'}`}
                    >
                        <div className={`absolute top-1 w-4 h-4 rounded-full transition-all ${kioskEnabled ? 'right-1 bg-black' : 'left-1 bg-white/40'}`} />
                    </button>
                </div>
            </div>
        )}

        <button
            onClick={saveAndNext}
            className="w-full py-4 rounded-2xl bg-white text-black font-bold text-xs uppercase tracking-[0.2em] hover:bg-white/90 transition-all flex items-center justify-center gap-2 mt-4"
        >
            {step === 3 ? '設定を完了して開始' : '次へ'}
            <ArrowRight size={16} />
        </button>
      </motion.div>
    </div>
  );
};
