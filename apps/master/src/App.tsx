import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Terminal,
  Camera,
  Zap,
  Cpu,
  Layout,
  Eye,
  ShieldAlert,
  Power,
  MessageSquare,
  AlertCircle,
  Sliders,
  Monitor,
  Clock
} from 'lucide-react';
import { DeviceStats } from './components/DeviceStats';

interface DeviceInfo {
  id: string;
  activeApp?: string;
  online: boolean;
}

const App: React.FC = () => {
  const [selectedChild, setSelectedChild] = useState<string>('all');
  const [connectedDevices, setConnectedDevices] = useState<DeviceInfo[]>([]);
  const [cameraFps, setCameraFps] = useState(10);
  const [cameraActive, setCameraActive] = useState(false);
  const [isFrozen, setIsFrozen] = useState(false);
  const [logMessage, setLogMessage] = useState('');
  const [notificationText, setNotificationText] = useState('');
  const [timerDuration, setTimerDuration] = useState(600);
  const [audioUrl, setAudioUrl] = useState('');
  const [deviceFrames, setDeviceFrames] = useState<{ [id: string]: string }>({});
  const [connectionLogs, setConnectionLogs] = useState<{ [id: string]: string[] }>({});
  const [localIp, setLocalIp] = useState('0.0.0.0');
  const [isSecurityMode, setIsSecurityMode] = useState(false);

  useEffect(() => {
    if ((window as any).electron) {
      (window as any).electron.send('GET_LOCAL_IP');
      (window as any).electron.on('LOCAL_IP_RESULT', (ip: string) => setLocalIp(ip));

      (window as any).electron.on('DEVICES_UPDATED', (devices: any[]) => {
        const formatted = devices.map(d => typeof d === 'string' ? { id: d, online: true } : d);
        setConnectedDevices(formatted);
      });

      (window as any).electron.on('CAMERA_FRAME_RECEIVED', ({ deviceId, frame }: { deviceId: string, frame: string }) => {
        setDeviceFrames(prev => ({ ...prev, [deviceId]: frame }));
      });

      (window as any).electron.on('CONNECTION_MSG_RECEIVED', ({ deviceId, text }: { deviceId: string, text: string }) => {
        setConnectionLogs(prev => ({
          ...prev,
          [deviceId]: [...(prev[deviceId] || []), text]
        }));
      });
    }
  }, []);

  const sendCommand = (type: string, payload: any = {}) => {
    if ((window as any).electron) {
      (window as any).electron.send('SEND_REMOTE_COMMAND', {
        targetId: selectedChild,
        command: { type, payload }
      });
    }
  };

  const toggleFreeze = () => {
      const newStatus = !isFrozen;
      setIsFrozen(newStatus);
      sendCommand('SET_FREEZE', { frozen: newStatus });
  };

  const toggleCamera = () => {
      const newStatus = !cameraActive;
      setCameraActive(newStatus);
      sendCommand('SET_CAMERA', { active: newStatus, fps: cameraFps });
  };

  const triggerError = () => {
      sendCommand('SHOW_ERROR', { message: 'CRITICAL_CORE_FAILURE: Memory heap corruption at 0x004F32. System integrity compromised.' });
  };

  const injectLog = () => {
      if (logMessage) {
          sendCommand('INJECT_LOG', { message: logMessage });
          setLogMessage('');
      }
  };

  const sendNotification = () => {
      if (notificationText) {
          sendCommand('SHOW_NOTIFICATION', { message: notificationText });
          setNotificationText('');
      }
  };

  const startGlobalTimer = () => {
      sendCommand('START_TIMER', { seconds: timerDuration });
  };

  const stopGlobalTimer = () => {
      sendCommand('STOP_TIMER');
  };

  const playAudio = () => {
      if (audioUrl) {
          sendCommand('PLAY_AUDIO', { url: audioUrl, options: { loop: true } });
      }
  };

  const stopAudio = () => {
      sendCommand('STOP_AUDIO', { url: audioUrl });
  };

  return (
    <div className="min-h-screen bg-[#0d0d0f] text-[#f5f5f7] flex flex-col p-8 gap-8 font-sans">
      <div className="aura-bg opacity-40" />

      {/* Header */}
      <header className="relative z-10 flex justify-between items-center bg-white/5 p-6 rounded-[24px] border border-white/10 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white/5 rounded-2xl border border-white/10">
            <Cpu className="text-white/80" />
          </div>
          <div className="flex items-center gap-6">
            <div>
                <h1 className="text-xl font-bold tracking-tight">MADOS MASTER</h1>
                <p className="text-[10px] text-white/40 uppercase tracking-[0.2em]">指令・統制センター</p>
            </div>
            <div className="px-4 py-2 bg-white/5 rounded-xl border border-white/10 flex flex-col">
                <span className="text-[8px] text-white/30 uppercase font-bold tracking-widest">Master_Server_IP</span>
                <span className="text-sm font-mono text-white/80">{localIp}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-8">
            <button
                onClick={() => setIsSecurityMode(!isSecurityMode)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${isSecurityMode ? 'bg-purple-500 text-white border-purple-400' : 'bg-white/5 text-white/40 border-white/10 hover:bg-white/10'}`}
            >
                <Eye size={16} />
                <span className="text-[10px] font-bold uppercase tracking-widest">{isSecurityMode ? '通常表示へ' : '全画面監視'}</span>
            </button>
            <div className="w-[1px] h-10 bg-white/10" />
            <div className="flex flex-col items-end">
                <span className="text-xs font-bold">{connectedDevices.length} 端末接続中</span>
                <span className="text-[10px] text-green-500 font-bold tracking-widest uppercase">ネットワーク正常</span>
            </div>
            <div className="w-[1px] h-10 bg-white/10" />
            <div className="text-right">
                <div className="text-xs font-bold opacity-60">ADMIN_MODE</div>
                <div className="text-[10px] text-white/20 uppercase font-mono">Session: {new Date().toLocaleDateString()}</div>
            </div>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-12 gap-8 overflow-hidden relative z-10">
        {isSecurityMode ? (
            <div className="col-span-12 grid grid-cols-3 gap-6 overflow-y-auto p-4">
                {connectedDevices.map((device, i) => (
                    <div key={device.id} className="relative group bg-black rounded-[24px] border border-white/5 overflow-hidden aspect-video flex items-center justify-center shadow-2xl">
                        {/* Scanline Effect Overlay */}
                        <div className="absolute inset-0 pointer-events-none z-30 opacity-20 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%]" />

                        <div className="absolute top-4 left-4 flex items-center gap-2 z-40 bg-black/80 px-3 py-1.5 rounded-lg backdrop-blur-md border border-white/10">
                             <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                             <span className="text-[9px] font-mono text-white/90 uppercase tracking-widest">CAM_{i+1} :: {device.id.substring(0, 6)}</span>
                        </div>

                        <div className="absolute bottom-4 right-4 z-40 flex flex-col items-end gap-1">
                            <span className="text-[10px] font-mono text-white/60 tabular-nums bg-black/40 px-2 py-1 rounded">
                                {new Date().toLocaleTimeString()}
                            </span>
                            <span className="text-[8px] font-bold text-green-500/80 bg-black/40 px-2 py-0.5 rounded uppercase tracking-tighter">
                                ENCRYPTED_STREAM
                            </span>
                        </div>

                        {deviceFrames[device.id] ? (
                            <img src={deviceFrames[device.id]} className="w-full h-full object-cover opacity-80 grayscale contrast-125" alt="feed" />
                        ) : (
                            <div className="text-[10px] text-white/5 uppercase tracking-[0.5em] font-black italic">SEARCHING_SIGNAL...</div>
                        )}

                        <div className="absolute inset-0 pointer-events-none border-[1px] border-white/10 z-20" />
                    </div>
                ))}
                {connectedDevices.length === 0 && (
                     <div className="col-span-3 flex items-center justify-center border-2 border-dashed border-white/5 rounded-[48px] min-h-[400px] text-white/5 uppercase tracking-[1em] font-black text-4xl">
                         EMPTY_GRID
                     </div>
                )}
            </div>
        ) : (
        <>
        {/* Sidebar: Device List */}
        <aside className="col-span-3 flex flex-col gap-4">
          <h2 className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em] px-2">デプロイ範囲</h2>
          <div className="flex-1 space-y-2 overflow-y-auto pr-2">
            <button
              onClick={() => setSelectedChild('all')}
              className={`w-full group relative flex items-center justify-between p-4 transition-all duration-300 rounded-[20px] border ${
                selectedChild === 'all'
                  ? 'bg-white/10 border-white/20 shadow-xl'
                  : 'bg-white/5 border-transparent hover:bg-white/10'
              }`}
            >
              <div className="flex items-center gap-3">
                <Users size={16} className={selectedChild === 'all' ? 'text-white' : 'text-white/40'} />
                <span className={`text-xs font-bold ${selectedChild === 'all' ? 'text-white' : 'text-white/40'}`}>BROADCAST_ALL</span>
              </div>
              <div className="px-2 py-1 bg-white/5 rounded-lg text-[10px] font-mono opacity-40">{connectedDevices.length}</div>
            </button>

            {connectedDevices.map(device => (
              <button
                key={device.id}
                onClick={() => setSelectedChild(device.id)}
                className={`w-full flex items-center gap-4 p-4 transition-all duration-300 rounded-[20px] border ${
                  selectedChild === device.id
                    ? 'bg-white/10 border-white/20 shadow-xl'
                    : 'bg-white/5 border-transparent hover:bg-white/10'
                }`}
              >
                <div className={`w-2 h-2 rounded-full ${device.online ? 'bg-green-400' : 'bg-red-400'} animate-pulse`} />
                <div className="flex flex-col items-start overflow-hidden">
                  <span className={`text-xs font-bold truncate w-full text-left ${selectedChild === device.id ? 'text-white' : 'text-white/60'}`}>
                      DEVICE_{device.id.substring(0, 8)}
                  </span>
                  <span className="text-[8px] opacity-20 font-mono uppercase tracking-tighter">
                      {device.activeApp || 'IDLE_STATE'}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </aside>

        {/* Main Content: Controls */}
        <main className="col-span-9 glass-panel p-10 flex flex-col gap-10 overflow-y-auto">
           {/* Section: Quick Stats */}
           <section>
              <div className="flex items-center gap-3 mb-6">
                <Monitor size={14} className="text-white/40" />
                <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">端末ステータス概況</h3>
              </div>
              <DeviceStats devices={connectedDevices} />
           </section>

           {/* Section: Application Control */}
           <section>
              <div className="flex items-center gap-3 mb-6">
                <Layout size={14} className="text-white/40" />
                <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">インターフェース・オーバーライド</h3>
              </div>
              <div className="grid grid-cols-3 gap-6">
                {[
                  { id: 'terminal', name: 'CORE_TERMINAL', icon: <Terminal size={20} />, color: 'bg-blue-500/10 text-blue-400' },
                  { id: 'calculator', name: 'CALC_UNIT', icon: <Sliders size={20} />, color: 'bg-green-500/10 text-green-400' },
                  { id: 'connection', name: 'CONN_LINK', icon: <MessageSquare size={20} />, color: 'bg-orange-500/10 text-orange-400' },
                  { id: 'close', name: 'TERMINATE_ALL', icon: <Power size={20} />, color: 'bg-red-500/10 text-red-400' }
                ].map(app => (
                  <button
                    key={app.id}
                    onClick={() => app.id === 'close' ? sendCommand('CLOSE_APP') : sendCommand('LAUNCH_APP', { appId: app.id })}
                    className={`flex flex-col items-center gap-4 p-8 rounded-[32px] border border-white/5 hover:border-white/20 transition-all duration-300 ${app.color} hover:bg-white/5`}
                  >
                    {app.icon}
                    <span className="text-[10px] font-bold tracking-widest">{app.name}</span>
                  </button>
                ))}
              </div>
           </section>

           <div className="grid grid-cols-2 gap-10">
                {/* Section: Environment FX */}
                <section>
                    <div className="flex items-center gap-3 mb-6">
                        <Zap size={14} className="text-white/40" />
                        <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">環境操作</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <button
                            onClick={() => sendCommand('SHAKE_SCREEN')}
                            className="flex items-center justify-center gap-3 p-4 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-all text-[10px] font-bold uppercase"
                        >
                            <Zap size={14} />
                            画面揺れ
                        </button>
                        <button
                            onClick={triggerError}
                            className="flex items-center justify-center gap-3 p-4 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-all text-[10px] font-bold uppercase text-orange-400"
                        >
                            <AlertCircle size={14} />
                            エラー表示
                        </button>
                        <button
                            onClick={toggleFreeze}
                            className={`col-span-2 flex items-center justify-center gap-3 p-5 rounded-2xl border transition-all text-[10px] font-bold uppercase ${
                                isFrozen
                                ? 'bg-red-500 border-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.4)]'
                                : 'bg-red-500/10 border-red-500/20 text-red-500 hover:bg-red-500/20'
                            }`}
                        >
                            <ShieldAlert size={16} />
                            {isFrozen ? 'システム凍結解除' : 'システム一斉凍結'}
                        </button>
                    </div>
                </section>

                {/* Section: Camera Settings */}
                <section>
                    <div className="flex items-center gap-3 mb-6">
                        <Sliders size={14} className="text-white/40" />
                        <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">視覚設定</h3>
                    </div>
                    <div className="space-y-6 bg-white/5 p-6 rounded-2xl border border-white/5">
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] font-bold uppercase text-white/40">FPS Control</span>
                            <span className="text-xs font-mono">{cameraFps} FPS</span>
                        </div>
                        <input
                            type="range" min="1" max="60" step="1"
                            className="w-full accent-white opacity-40 hover:opacity-100 transition-opacity"
                            value={cameraFps}
                            onChange={(e) => setCameraFps(parseInt(e.target.value))}
                            onMouseUp={() => cameraActive && sendCommand('SET_CAMERA', { active: true, fps: cameraFps })}
                        />
                        <button
                            onClick={toggleCamera}
                            className={`w-full flex items-center justify-center gap-3 p-4 rounded-xl border transition-all text-[10px] font-bold uppercase ${
                                cameraActive
                                ? 'bg-purple-500 border-purple-500 text-white'
                                : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
                            }`}
                        >
                            <Camera size={16} />
                            {cameraActive ? 'カメラ停止' : 'カメラ起動'}
                        </button>
                    </div>
                </section>
           </div>

           <div className="grid grid-cols-2 gap-10">
                {/* Section: Connection Monitoring */}
                <section>
                    <div className="flex items-center gap-3 mb-6">
                        <MessageSquare size={14} className="text-white/40" />
                        <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">コネクション・モニタリング</h3>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 h-[120px] overflow-y-auto font-mono text-[10px] space-y-1">
                        {selectedChild === 'all' ? (
                            <div className="text-white/20 italic uppercase tracking-widest text-center mt-8">個別端末を選択してログを表示</div>
                        ) : (
                            (connectionLogs[selectedChild] || []).length > 0 ? (
                                connectionLogs[selectedChild].map((msg, i) => (
                                    <div key={i} className="flex gap-2">
                                        <span className="text-blue-500 font-bold">[{new Date().toLocaleTimeString()}]</span>
                                        <span className="text-white/60">{msg}</span>
                                    </div>
                                ))
                            ) : (
                                <div className="text-white/20 italic uppercase tracking-widest text-center mt-8">受信ログなし</div>
                            )
                        )}
                    </div>
                </section>

           {/* Section: Remote Typing */}
           <section>
              <div className="flex items-center gap-3 mb-6">
                <MessageSquare size={14} className="text-white/40" />
                <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">リモートログ・インジェクション</h3>
              </div>
              <div className="flex gap-4">
                  <input
                    type="text"
                    placeholder="コマンドまたはナラティブ文字列を入力..."
                    className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-white/30 transition-all font-mono text-sm"
                    value={logMessage}
                    onChange={(e) => setLogMessage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && injectLog()}
                  />
                  <button
                    onClick={injectLog}
                    className="px-8 bg-white text-black font-bold rounded-2xl uppercase tracking-widest text-[10px] hover:bg-white/90 transition-all"
                  >
                    送信
                  </button>
              </div>
           </section>

                {/* Section: Global Timer */}
                <section>
                    <div className="flex items-center gap-3 mb-6">
                        <Clock size={14} className="text-white/40" />
                        <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">一斉タイマー制御</h3>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                        <div className="flex justify-between items-center mb-4">
                            <span className="text-[10px] font-bold uppercase text-white/40">Duration (Minutes)</span>
                            <span className="text-xs font-mono">{Math.floor(timerDuration / 60)}:00</span>
                        </div>
                        <input
                            type="range" min="60" max="3600" step="60"
                            className="w-full accent-white opacity-40 hover:opacity-100 transition-opacity mb-6"
                            value={timerDuration}
                            onChange={(e) => setTimerDuration(parseInt(e.target.value))}
                        />
                        <div className="flex gap-4">
                            <button
                                onClick={startGlobalTimer}
                                className="flex-1 py-3 bg-red-500 text-white font-bold rounded-xl uppercase tracking-widest text-[10px] hover:bg-red-600 transition-all"
                            >
                                タイマー開始
                            </button>
                            <button
                                onClick={stopGlobalTimer}
                                className="flex-1 py-3 bg-white/5 border border-white/10 text-white/60 font-bold rounded-xl uppercase tracking-widest text-[10px] hover:bg-white/10 transition-all"
                            >
                                停止
                            </button>
                        </div>
                    </div>
                </section>

           {/* Section: Remote Notification */}
           <section>
              <div className="flex items-center gap-3 mb-6">
                <ShieldAlert size={14} className="text-white/40" />
                <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">システム通知（画面右上）</h3>
              </div>
              <div className="flex gap-4">
                  <input
                    type="text"
                    placeholder="通知内容を入力（5秒で消えます）..."
                    className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-white/30 transition-all font-mono text-sm"
                    value={notificationText}
                    onChange={(e) => setNotificationText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && sendNotification()}
                  />
                  <button
                    onClick={sendNotification}
                    className="px-8 bg-white text-black font-bold rounded-2xl uppercase tracking-widest text-[10px] hover:bg-white/90 transition-all"
                  >
                    通知
                  </button>
              </div>
           </section>

           {/* Section: Audio Control */}
           <section>
              <div className="flex items-center gap-3 mb-6">
                <Zap size={14} className="text-white/40" />
                <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">リモートオーディオ操作</h3>
              </div>
              <div className="flex gap-4">
                  <input
                    type="text"
                    placeholder="Enter Audio URL (mp3/wav)..."
                    className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-white/30 transition-all font-mono text-sm"
                    value={audioUrl}
                    onChange={(e) => setAudioUrl(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <button
                        onClick={playAudio}
                        className="px-6 bg-white text-black font-bold rounded-2xl uppercase tracking-widest text-[10px] hover:bg-white/90 transition-all"
                    >
                        再生
                    </button>
                    <button
                        onClick={stopAudio}
                        className="px-6 bg-red-500/10 text-red-500 border border-red-500/20 font-bold rounded-2xl uppercase tracking-widest text-[10px] hover:bg-red-500/20 transition-all"
                    >
                        停止
                    </button>
                  </div>
              </div>
           </section>
           </div>

           {/* Section: Visual Monitoring */}
           <section className="flex-1">
              <div className="flex items-center gap-3 mb-6">
                <Eye size={14} className="text-white/40" />
                <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">セキュリティ・グリッド</h3>
              </div>
              <div className="grid grid-cols-2 gap-6 min-h-[320px]">
                {connectedDevices.slice(0, 4).map((device, i) => (
                    <div key={device.id} className="relative group bg-black/40 rounded-[32px] border border-white/5 overflow-hidden flex items-center justify-center aspect-video">
                        <div className="absolute top-4 left-4 flex items-center gap-2 z-20">
                             <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                             <span className="text-[8px] font-mono text-white/60 uppercase">Grid_Sector_{i+1} :: {device.id.substring(0, 6)}</span>
                        </div>

                        {deviceFrames[device.id] ? (
                            <img src={deviceFrames[device.id]} className="w-full h-full object-cover opacity-80" alt="feed" />
                        ) : (
                            <div className="flex flex-col items-center gap-3">
                                <div className="text-[10px] text-white/10 uppercase tracking-widest font-bold">信号待機中</div>
                                {cameraActive && (
                                    <div className="w-8 h-1 bg-white/5 rounded-full overflow-hidden">
                                        <motion.div
                                            initial={{ x: '-100%' }}
                                            animate={{ x: '100%' }}
                                            transition={{ repeat: Infinity, duration: 1.5 }}
                                            className="w-full h-full bg-purple-500/40"
                                        />
                                    </div>
                                )}
                            </div>
                        )}
                        <div className="absolute inset-0 pointer-events-none border-[12px] border-black/20 z-10" />
                    </div>
                ))}
                {connectedDevices.length === 0 && (
                     <div className="col-span-2 flex items-center justify-center border-2 border-dashed border-white/5 rounded-[32px] text-white/5 uppercase tracking-[0.4em] font-black text-2xl">
                         デバイス未接続
                     </div>
                )}
              </div>
           </section>
        </main>
        </>
        )}
      </div>
    </div>
  );
};

export default App;
