import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Wifi, Shield, ArrowRight, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

interface SetupProps {
  onComplete: () => void;
}

export const Setup: React.FC<SetupProps> = ({ onComplete }) => {
  const [step, setStep] = useState(1);
  const [ip, setIp] = useState(localStorage.getItem('masterUrl')?.replace('http://', '').replace(':3030', '') || '');
  const [kioskEnabled, setKioskEnabled] = useState(true);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [passwords, setPasswords] = useState({
      exit: localStorage.getItem('pass_exit') || 'MADREST104',
      event: localStorage.getItem('pass_event') || 'EVT_TRIGGER_99',
      admin: localStorage.getItem('pass_admin') || 'ADMIN_DASH'
  });

  const testConnection = async () => {
    setTestStatus('testing');
    const targetUrl = ip.startsWith('http') ? ip : `http://${ip}:3030`;

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        // Try to fetch the master root or a known endpoint
        const response = await fetch(targetUrl, {
            mode: 'no-cors',
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        setTestStatus('success');
    } catch (err) {
        console.error('Connection test failed:', err);
        setTestStatus('error');
    }
  };

  const saveAndNext = () => {
      if (step === 1) {
          const finalIp = ip.startsWith('http') ? ip : `http://${ip}:3030`;
          localStorage.setItem('masterUrl', finalIp);
          setStep(2);
      } else if (step === 3) {
          localStorage.setItem('pass_exit', passwords.exit);
          localStorage.setItem('pass_event', passwords.event);
          localStorage.setItem('pass_admin', passwords.admin);

          // Clear pairing on fresh setup to force re-approval if IP changed
          localStorage.removeItem('isPaired');

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

                <div className="relative mb-4">
                    <input
                        type="text"
                        placeholder="0.0.0.0"
                        className={`w-full bg-white/5 border rounded-2xl px-6 py-4 text-center outline-none transition-all text-xl font-mono tracking-widest ${
                            testStatus === 'success' ? 'border-green-500/50' :
                            testStatus === 'error' ? 'border-red-500/50' : 'border-white/10 focus:border-white/30'
                        }`}
                        value={ip}
                        onChange={(e) => {
                            setIp(e.target.value);
                            setTestStatus('idle');
                        }}
                    />
                    {testStatus !== 'idle' && (
                        <div className="absolute right-4 top-1/2 -translate-y-1/2">
                            {testStatus === 'testing' && <Loader2 size={20} className="text-white/40 animate-spin" />}
                            {testStatus === 'success' && <CheckCircle2 size={20} className="text-green-500" />}
                            {testStatus === 'error' && <XCircle size={20} className="text-red-500" />}
                        </div>
                    )}
                </div>

                <button
                    onClick={testConnection}
                    disabled={!ip || testStatus === 'testing'}
                    className="w-full py-3 mb-8 rounded-xl bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-widest hover:bg-white/10 transition-all disabled:opacity-50"
                >
                    接続テストを実行
                </button>
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
