import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Wifi, Shield, ArrowRight, CheckCircle2, XCircle, Loader2, Eye, EyeOff, Monitor } from 'lucide-react';

interface SetupProps {
  onComplete: () => void;
}

interface OfflineSetupProps extends SetupProps {
  onStartOffline: (targetTime: { hour: string; minute: string; second: string }) => void;
  currentTime?: Date;
}

export const Setup: React.FC<OfflineSetupProps> = ({ onComplete, onStartOffline, currentTime }) => {
  const [step, setStep] = useState(1);
  const [isOfflineModeChecked, setIsOfflineModeChecked] = useState(false);
  const [deviceName, setDeviceName] = useState(() => {
      const name = localStorage.getItem('deviceName');
      if (!name || name === 'null' || name === 'undefined') return '';
      return name;
  });
  const [ip, setIp] = useState(() => {
      const saved = localStorage.getItem('masterUrl');
      if (!saved || saved === 'null' || saved === 'undefined') return '';
      return saved.replace('http://', '');
  });
  const [kioskEnabled, setKioskEnabled] = useState(true);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const keepHiraganaOnly = (val: string) => {
      return val.replace(/[^\u3040-\u309Fー]/g, '');
  };

  const [showPasswords, setShowPasswords] = useState(false);
  const [passwords, setPasswords] = useState(() => {
      const exit = localStorage.getItem('pass_exit');
      const event = localStorage.getItem('pass_event');
      const admin = localStorage.getItem('pass_admin');
      const setup = localStorage.getItem('pass_setup');
      return {
          exit: !exit || exit === 'null' || exit === 'undefined' ? 'まどれすと' : exit,
          event: !event || event === 'null' || event === 'undefined' ? 'えべんと' : event,
          admin: !admin || admin === 'null' || admin === 'undefined' ? 'あどみん' : admin,
          setup: !setup || setup === 'null' || setup === 'undefined' ? 'せっとあっぷ' : setup
      };
  });
  const [bgmVolume, setBgmVolume] = useState<number>(() => {
      const saved = localStorage.getItem('bgmVolume');
      if (!saved || saved === 'null' || saved === 'undefined') return 50;
      const parsed = parseInt(saved);
      return isNaN(parsed) ? 50 : parsed;
  });

  // Offline Mode Patterns Configuration states
  const [offlineTargetTime, setOfflineTargetTime] = useState(() => {
      const activeDate = currentTime || new Date();
      return {
          hour: String(activeDate.getHours()).padStart(2, '0'),
          minute: String(activeDate.getMinutes()).padStart(2, '0'),
          second: String(activeDate.getSeconds()).padStart(2, '0')
      };
  });

  useEffect(() => {
    if (step === 1) {
      const activeDate = new Date();
      setOfflineTargetTime({
          hour: String(activeDate.getHours()).padStart(2, '0'),
          minute: String(activeDate.getMinutes()).padStart(2, '0'),
          second: String(activeDate.getSeconds()).padStart(2, '0')
      });
    }
  }, [step]);

  const testConnection = async () => {
    setTestStatus('testing');

    let targetUrl = ip;
    if (!ip.startsWith('http')) {
        // If user didn't specify a port (no colon), append :3030 as default
        const hasPort = ip.includes(':');
        targetUrl = `http://${ip}${hasPort ? '' : ':3030'}`;
    }

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
          localStorage.setItem('deviceName', deviceName || 'UNNAMED_TERMINAL');

          let finalUrl = ip;
          if (!ip.startsWith('http')) {
              const hasPort = ip.includes(':');
              finalUrl = `http://${ip}${hasPort ? '' : ':3030'}`;
          }

          localStorage.setItem('masterUrl', finalUrl);
          setStep(2);
      } else if (step === 3) {
          localStorage.setItem('pass_exit', passwords.exit);
          localStorage.setItem('pass_event', passwords.event);
          localStorage.setItem('pass_admin', passwords.admin);
          localStorage.setItem('pass_setup', passwords.setup);
          localStorage.setItem('bgmVolume', String(bgmVolume));

          // Clear pairing on fresh setup to force re-approval if IP changed
          localStorage.removeItem('isPaired');

          if ((window as any).electron) {
              (window as any).electron.send('UPDATE_CONFIG', {
                  passwords: {
                      exit: passwords.exit,
                      event: passwords.event,
                      admin: passwords.admin,
                      setup: passwords.setup
                  },
                  kiosk: kioskEnabled
              });
          }

          if (isOfflineModeChecked) {
              onStartOffline(offlineTargetTime);
          } else {
              onComplete();
          }
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
                    <Monitor className="text-white/60" size={32} />
                </div>
                <h1 className="text-2xl font-bold mb-2 tracking-tight">端末識別設定</h1>
                <p className="text-sm text-white/40 mb-8">端末名と親機のIPアドレスを入力してください。</p>

                <div className="mb-6">
                    <label className="text-[10px] uppercase tracking-widest text-white/40 mb-2 block text-left ml-2">端末名（識別用）</label>
                    <input
                        type="text"
                        placeholder="TERMINAL_01"
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-white/30 transition-all font-mono"
                        value={deviceName}
                        onChange={(e) => setDeviceName(e.target.value)}
                    />
                </div>

                <div className="relative mb-4">
                    <label className="text-[10px] uppercase tracking-widest text-white/40 mb-2 block text-left ml-2">親機IPアドレス</label>
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
                    className="w-full py-3 mb-4 rounded-xl bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-widest hover:bg-white/10 transition-all disabled:opacity-50"
                >
                    接続テストを実行
                </button>

                <div className="pt-4 border-t border-white/5 space-y-4">
                    <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                        <div className="text-left">
                            <div className="text-xs font-bold text-white/80">オフラインモードで起動</div>
                            <div className="text-[9px] text-white/40 uppercase mt-0.5">時間予約オフライン開催</div>
                        </div>
                        <input
                            type="checkbox"
                            checked={isOfflineModeChecked}
                            onChange={(e) => setIsOfflineModeChecked(e.target.checked)}
                            className="w-5 h-5 accent-red-500 cursor-pointer"
                        />
                    </div>

                    {isOfflineModeChecked && (
                        <div className="space-y-2">
                            <label className="text-[9px] uppercase tracking-widest text-red-400 font-bold block text-left ml-2">⏳ 開始予約時刻 (JST)</label>
                            <div className="grid grid-cols-3 gap-2">
                                <select
                                    value={offlineTargetTime.hour}
                                    onChange={(e) => setOfflineTargetTime({ ...offlineTargetTime, hour: e.target.value })}
                                    className="bg-[#151518] border border-white/10 rounded-xl px-2 py-3 text-sm font-mono text-white"
                                >
                                    {Array.from({ length: 24 }).map((_, i) => (
                                        <option key={i} value={String(i).padStart(2, '0')}>{String(i).padStart(2, '0')}時</option>
                                    ))}
                                </select>
                                <select
                                    value={offlineTargetTime.minute}
                                    onChange={(e) => setOfflineTargetTime({ ...offlineTargetTime, minute: e.target.value })}
                                    className="bg-[#151518] border border-white/10 rounded-xl px-2 py-3 text-sm font-mono text-white"
                                >
                                    {Array.from({ length: 60 }).map((_, i) => (
                                        <option key={i} value={String(i).padStart(2, '0')}>{String(i).padStart(2, '0')}分</option>
                                    ))}
                                </select>
                                <select
                                    value={offlineTargetTime.second}
                                    onChange={(e) => setOfflineTargetTime({ ...offlineTargetTime, second: e.target.value })}
                                    className="bg-[#151518] border border-white/10 rounded-xl px-2 py-3 text-sm font-mono text-white"
                                >
                                    {Array.from({ length: 60 }).map((_, i) => (
                                        <option key={i} value={String(i).padStart(2, '0')}>{String(i).padStart(2, '0')}秒</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        )}

        {step === 2 && (
            <div className="w-full space-y-6">
                <div className="w-16 h-16 bg-white/5 rounded-[24px] flex items-center justify-center mx-auto mb-8 border border-white/10">
                    <Shield className="text-white/60" size={32} />
                </div>
                <div className="flex items-center justify-between mb-2">
                    <h1 className="text-2xl font-bold tracking-tight">パスワード設定 (ひらがな限定)</h1>
                </div>
                <div className="space-y-4 text-left">
                    <div>
                        <label className="text-[10px] uppercase tracking-widest text-white/40 ml-2">終了用</label>
                        <input
                            type="text"
                            placeholder="ひらがな限定"
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-white/30 transition-all font-mono"
                            value={passwords.exit}
                            onChange={(e) => setPasswords({...passwords, exit: keepHiraganaOnly(e.target.value)})}
                        />
                    </div>
                    <div>
                        <label className="text-[10px] uppercase tracking-widest text-white/40 ml-2">イベント画面ロック解除用</label>
                        <input
                            type="text"
                            placeholder="ひらがな限定"
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-white/30 transition-all font-mono"
                            value={passwords.event}
                            onChange={(e) => setPasswords({...passwords, event: keepHiraganaOnly(e.target.value)})}
                        />
                    </div>
                    <div>
                        <label className="text-[10px] uppercase tracking-widest text-white/40 ml-2">管理者用イベント解除用（電源ボタン用）</label>
                        <input
                            type="text"
                            placeholder="ひらがな限定"
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-white/30 transition-all font-mono"
                            value={passwords.admin}
                            onChange={(e) => setPasswords({...passwords, admin: keepHiraganaOnly(e.target.value)})}
                        />
                    </div>
                    <div>
                        <label className="text-[10px] uppercase tracking-widest text-white/40 ml-2">管理者ツール起動用（設定画面用）</label>
                        <input
                            type="text"
                            placeholder="ひらがな限定"
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-white/30 transition-all font-mono"
                            value={passwords.setup}
                            onChange={(e) => setPasswords({...passwords, setup: keepHiraganaOnly(e.target.value)})}
                        />
                    </div>

                    <div className="pt-4 border-t border-white/5 space-y-4">
                        <div>
                            <div className="flex justify-between items-center mb-2 px-2">
                                <label className="text-[10px] uppercase tracking-widest text-white/40">BGM音量設定</label>
                                <span className="text-xs text-white/80 font-mono font-bold">{bgmVolume}%</span>
                            </div>
                            <input
                                type="range" min="0" max="100" step="5"
                                className="w-full accent-white opacity-60 hover:opacity-100 transition-opacity"
                                value={bgmVolume}
                                onChange={(e) => setBgmVolume(parseInt(e.target.value))}
                            />
                            <p className="text-[9px] text-white/30 uppercase mt-2 leading-relaxed text-left px-2 font-mono">
                                ※ 【推奨】音声はヘッドホン出力から原則として流れるよう構成されています。
                            </p>
                        </div>

                        <div className="p-4 bg-white/5 border border-white/10 rounded-2xl">
                            <span className="text-[10px] uppercase tracking-widest text-white/40 block text-left mb-2 ml-1">🔊 オーディオ出力診断テスト</span>
                            <button
                                type="button"
                                onClick={async () => {
                                    try {
                                        // Request temporary mic permissions to retrieve output device labels
                                        try {
                                            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                                            stream.getTracks().forEach(track => track.stop());
                                        } catch (e) {}

                                        const devices = await navigator.mediaDevices.enumerateDevices();
                                        const audioOutputs = devices.filter(d => d.kind === 'audiooutput');

                                        const speaker = audioOutputs.find(d =>
                                            d.label.toLowerCase().includes('speakers') ||
                                            d.label.toLowerCase().includes('speaker') ||
                                            d.label.toLowerCase().includes('built-in') ||
                                            d.label.toLowerCase().includes('internal') ||
                                            d.label.toLowerCase().includes('スピーカー')
                                        );

                                        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
                                        const dest = ctx.createMediaStreamDestination();

                                        const audio = new Audio();
                                        audio.srcObject = dest.stream;

                                        let didBindSink = false;
                                        if (speaker && typeof (audio as any).setSinkId === 'function') {
                                            try {
                                                await (audio as any).setSinkId(speaker.deviceId);
                                                console.log("Audio Diagnostic Speaker output bound to:", speaker.label);
                                                didBindSink = true;
                                            } catch (sinkErr) {
                                                console.warn("Failsafe: Setup Speaker Test setSinkId failed, playing test chime through default output destination.", sinkErr);
                                            }
                                        }

                                        audio.play().catch(e => console.log("Test stream play catch:", e));

                                        // Play dual sine wave diagnostic chime
                                        [523.25, 659.25].forEach((freq, idx) => {
                                            const osc = ctx.createOscillator();
                                            const gain = ctx.createGain();
                                            osc.type = 'sine';
                                            osc.frequency.setValueAtTime(freq, ctx.currentTime);
                                            gain.gain.setValueAtTime(1.0, ctx.currentTime); // MAX VOLUME
                                            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
                                            osc.connect(gain);
                                            gain.connect(dest);
                                            osc.start();
                                            osc.stop(ctx.currentTime + 1.2);
                                        });

                                        alert(`スピーカー出力テスト音を最大音量で再生しました。\n検出デバイス: ${speaker ? speaker.label : 'デフォルトスピーカー'}${didBindSink ? '' : ' (デフォルト出力先にフォールバック再生)'}`);
                                    } catch (err: any) {
                                        console.error(err);
                                        alert("スピーカーテストに失敗しました: " + err.message);
                                    }
                                }}
                                className="w-full py-2.5 bg-red-950/40 hover:bg-red-950/70 text-red-400 hover:text-white border border-red-900/40 rounded-xl text-xs font-bold uppercase tracking-widest transition-all cursor-pointer"
                            >
                                スピーカー出力テスト
                            </button>
                        </div>
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
            className="w-full py-4 rounded-2xl bg-white text-black font-bold text-xs uppercase tracking-[0.2em] hover:bg-white/90 transition-all flex items-center justify-center gap-2 mt-4 animate-pulse"
        >
            {step === 3 ? (isOfflineModeChecked ? 'オフライン設定を完了して待機' : '設定を完了して開始') : '次へ'}
            <ArrowRight size={16} />
        </button>
      </motion.div>
    </div>
  );
};
