import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
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
  Clock,
  Trash2,
  Video,
  VideoOff,
  Unlock,
  Lock,
  Send,
  Play
} from 'lucide-react';
import { DeviceStats } from './components/DeviceStats';

interface DeviceInfo {
  id: string;
  name?: string;
  activeApp?: string;
  online: boolean;
  lastSeen?: number;
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
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'fleet' | 'performance'>('fleet');

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

      (window as any).electron.on('PENDING_APPROVALS_UPDATED', (list: any[]) => {
          setPendingApprovals(list);
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

  const approveDevice = (id: string) => {
      if ((window as any).electron) {
          (window as any).electron.send('APPROVE_PAIRING', id);
      }
  };

  const rejectDevice = (id: string) => {
      if ((window as any).electron) {
          (window as any).electron.send('REJECT_PAIRING', id);
      }
  };

  const removeDevice = (id: string) => {
    if (confirm(`デバイス ${id.substring(0,6)} の登録を削除しますか？`)) {
        if ((window as any).electron) {
            (window as any).electron.send('REMOVE_DEVICE', id);
        }
    }
  };

  return (
    <div className="min-h-screen bg-[#0d0d0f] text-[#f5f5f7] flex flex-col p-8 gap-8 font-sans overflow-hidden">
      <div className="aura-bg opacity-40" />

      {/* Surveillance Mode Overlay */}
      <AnimatePresence>
          {isSecurityMode && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] bg-black p-10 flex flex-col gap-8"
              >
                  {/* Scanline Effect */}
                  <div className="absolute inset-0 pointer-events-none z-50 opacity-10 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,4px_100%]" />

                  <div className="flex justify-between items-center relative z-[60]">
                      <div className="flex items-center gap-4">
                          <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                          <h2 className="text-2xl font-black tracking-[0.3em] uppercase italic">System_Surveillance_Grid</h2>
                      </div>
                      <div className="flex items-center gap-8 font-mono text-xl opacity-60">
                          <span>{new Date().toLocaleDateString()}</span>
                          <Clock className="animate-pulse" />
                          <span>{new Date().toLocaleTimeString()}</span>
                          <button
                            onClick={() => setIsSecurityMode(false)}
                            className="ml-8 px-6 py-2 border border-white/20 rounded-full text-sm hover:bg-white/10 transition-all"
                          >
                            EXIT_VIEW
                          </button>
                      </div>
                  </div>

                  <div className="flex-1 grid grid-cols-3 gap-6 relative z-[60]">
                      {connectedDevices.map((device, i) => (
                          <div key={device.id} className="relative bg-white/5 border border-white/10 rounded-3xl overflow-hidden group">
                              {deviceFrames[device.id] ? (
                                  <img src={deviceFrames[device.id]} className="w-full h-full object-cover grayscale brightness-75 contrast-125" alt="feed" />
                              ) : (
                                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                                      <VideoOff size={48} className="text-white/10" />
                                      <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.5em]">No_Signal</span>
                                  </div>
                              )}

                              {/* OSD Info */}
                              <div className="absolute top-6 left-6 flex flex-col gap-1">
                                  <div className="text-xs font-black bg-black/60 px-3 py-1 rounded-sm border-l-2 border-red-500 uppercase tracking-widest">
                                      CAM_{String(i + 1).padStart(2, '0')}
                                  </div>
                                  <div className="text-[10px] font-mono bg-black/40 px-2 py-0.5 rounded-sm text-white/60">
                                      ID: {device.id.substring(0, 8)}
                                  </div>
                                  <div className="text-[10px] font-mono bg-black/40 px-2 py-0.5 rounded-sm text-white/60 uppercase">
                                      NAME: {device.name || 'UNKNOWN'}
                                  </div>
                              </div>

                              <div className="absolute bottom-6 right-6 font-mono text-[10px] text-white/40 bg-black/40 px-3 py-1 rounded-sm">
                                  {Math.floor(Math.random() * 100 + 900)}MHz / {Math.floor(Math.random() * 30 + 10)}FPS
                              </div>

                              <div className="absolute inset-0 border-2 border-white/0 group-hover:border-white/10 transition-all pointer-events-none" />
                          </div>
                      ))}
                      {connectedDevices.length === 0 && (
                          <div className="col-span-3 flex flex-col items-center justify-center opacity-10">
                              <ShieldAlert size={120} />
                              <span className="text-2xl font-black uppercase tracking-[1em] mt-8">Empty_Network_Grid</span>
                          </div>
                      )}
                  </div>

                  <div className="h-1 bg-white/5 relative overflow-hidden rounded-full">
                      <motion.div
                        animate={{ x: ['-100%', '100%'] }}
                        transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                        className="absolute inset-y-0 w-1/3 bg-white/20 blur-md"
                      />
                  </div>
              </motion.div>
          )}
      </AnimatePresence>

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
            <div className="px-4 py-2 bg-white/5 rounded-xl border border-white/10 flex flex-col group relative overflow-hidden">
                <div className="absolute inset-0 bg-green-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                <span className="text-[8px] text-white/30 uppercase font-bold tracking-widest relative z-10">Master_Connection_URL</span>
                <span className="text-sm font-mono text-green-400 font-bold relative z-10">http://{localIp}:3030</span>
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

      <AnimatePresence>
          {pendingApprovals.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="relative z-50 flex flex-col gap-4"
              >
                  {pendingApprovals.map(pending => (
                      <div key={pending.id} className="glass-panel p-6 border-blue-500/50 bg-blue-900/20 flex items-center justify-between">
                          <div className="flex items-center gap-4">
                              <div className="p-2 bg-blue-500/20 rounded-lg">
                                  <ShieldAlert size={20} className="text-blue-400" />
                              </div>
                              <div>
                                  <div className="text-sm font-bold uppercase tracking-widest text-blue-200">新規接続リクエスト</div>
                                  <div className="text-xs text-white/40 font-mono">{pending.name} ({pending.id})</div>
                              </div>
                          </div>
                          <div className="flex gap-4">
                              <button
                                onClick={() => rejectDevice(pending.id)}
                                className="px-6 py-2 rounded-xl bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-widest hover:bg-white/10 transition-all"
                              >
                                拒否
                              </button>
                              <button
                                onClick={() => approveDevice(pending.id)}
                                className="px-6 py-2 rounded-xl bg-blue-500 text-white text-[10px] font-bold uppercase tracking-widest hover:bg-blue-600 shadow-[0_0_20px_rgba(59,130,246,0.4)] transition-all"
                              >
                                承認
                              </button>
                          </div>
                      </div>
                  ))}
              </motion.div>
          )}
      </AnimatePresence>

      <div className="flex-1 flex gap-8 overflow-hidden relative z-10">
        {/* Simplified Sidebar: Tabs & Fleet List */}
        <aside className="w-80 flex flex-col gap-6">
            <div className="flex flex-col gap-2 bg-white/5 p-2 rounded-2xl border border-white/10">
                <button
                    onClick={() => setActiveTab('fleet')}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'fleet' ? 'bg-white text-black font-bold' : 'text-white/40 hover:bg-white/5'}`}
                >
                    <Users size={18} />
                    <span className="text-[10px] uppercase tracking-widest">フリート管理</span>
                </button>
                <button
                    onClick={() => setActiveTab('performance')}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'performance' ? 'bg-white text-black font-bold' : 'text-white/40 hover:bg-white/5'}`}
                >
                    <Zap size={18} />
                    <span className="text-[10px] uppercase tracking-widest">公演パネル</span>
                </button>
            </div>

            <div className="flex-1 flex flex-col gap-4 overflow-hidden">
                <div className="flex items-center justify-between px-2">
                    <h2 className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em]">端末一覧</h2>
                    <span className="text-[10px] font-mono text-white/20">{connectedDevices.length} UNITS</span>
                </div>

                <div className="flex-1 space-y-2 overflow-y-auto pr-2">
                    <button
                        onClick={() => setSelectedChild('all')}
                        className={`w-full flex items-center justify-between p-4 rounded-[20px] border transition-all ${
                            selectedChild === 'all'
                            ? 'bg-blue-500 border-blue-400 text-white shadow-lg'
                            : 'bg-white/5 border-transparent hover:bg-white/10 text-white/40'
                        }`}
                    >
                        <div className="flex items-center gap-3">
                            <Users size={16} />
                            <span className="text-[10px] font-black uppercase tracking-widest">一斉操作モード</span>
                        </div>
                    </button>

                    {connectedDevices.map(device => (
                        <div key={device.id} className="group relative">
                            <button
                                onClick={() => setSelectedChild(device.id)}
                                className={`w-full flex items-center justify-between p-4 rounded-[20px] border transition-all ${
                                    selectedChild === device.id
                                    ? 'bg-white/10 border-white/20 shadow-xl'
                                    : 'bg-white/5 border-transparent hover:bg-white/10'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`w-1.5 h-1.5 rounded-full ${device.online ? 'bg-green-400' : 'bg-red-400'} animate-pulse`} />
                                    <div className="flex flex-col items-start">
                                        <span className={`text-[10px] font-bold uppercase tracking-widest ${selectedChild === device.id ? 'text-white' : 'text-white/80'}`}>
                                            {device.name || 'UNKNOWN'}
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[8px] font-mono opacity-40">
                                                ID:{device.id.substring(0, 6)}
                                            </span>
                                            {device.lastSeen && (
                                                <span className="text-[7px] font-mono text-green-500/60 font-bold uppercase">
                                                    LIVE {Math.floor((Date.now() - device.lastSeen)/1000)}s
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <span className="text-[8px] opacity-20 font-mono uppercase truncate max-w-[60px]">{device.activeApp || 'IDLE'}</span>
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); removeDevice(device.id); }}
                                className="absolute -right-2 -top-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                            >
                                <Trash2 size={12} />
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </aside>

        {/* Main Interface: Grid and Master Controls */}
        <main className="flex-1 flex flex-col gap-8 overflow-hidden">
            {activeTab === 'fleet' ? (
                <>
                {/* Global Master Controls Bar */}
                <div className="grid grid-cols-4 gap-4">
                    <button
                        onClick={toggleFreeze}
                        className={`flex flex-col items-center gap-3 p-6 rounded-[24px] border transition-all ${isFrozen ? 'bg-red-500 text-white border-red-400 shadow-xl' : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'}`}
                    >
                        {isFrozen ? <Unlock size={24} /> : <Lock size={24} />}
                        <span className="text-[10px] font-bold uppercase tracking-widest">{isFrozen ? 'システム復旧' : '一斉凍結'}</span>
                    </button>

                    <button
                        onClick={toggleCamera}
                        className={`flex flex-col items-center gap-3 p-6 rounded-[24px] border transition-all ${cameraActive ? 'bg-purple-500 text-white border-purple-400 shadow-xl' : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'}`}
                    >
                        {cameraActive ? <VideoOff size={24} /> : <Video size={24} />}
                        <span className="text-[10px] font-bold uppercase tracking-widest">{cameraActive ? '映像切断' : '映像一斉受信'}</span>
                    </button>

                    <div className="col-span-2 glass-panel p-6 flex items-center gap-4">
                        <div className="flex-1 flex flex-col gap-2">
                             <div className="flex justify-between items-center px-1">
                                <span className="text-[8px] font-bold text-white/20 uppercase tracking-[0.2em]">一斉タイマー設定</span>
                                <span className="text-xs font-mono text-white/80">{Math.floor(timerDuration / 60)}:00</span>
                             </div>
                             <input
                                type="range" min="60" max="3600" step="60"
                                className="w-full accent-white opacity-40 hover:opacity-100 transition-opacity"
                                value={timerDuration}
                                onChange={(e) => setTimerDuration(parseInt(e.target.value))}
                             />
                        </div>
                        <button
                            onClick={startGlobalTimer}
                            className="p-4 bg-white text-black rounded-2xl hover:scale-105 transition-transform"
                        >
                            <Play size={20} fill="currentColor" />
                        </button>
                    </div>
                </div>

                {/* Central Workspace: Messaging and Monitoring */}
                <div className="flex-1 grid grid-cols-12 gap-8 overflow-hidden">
                    <div className="col-span-8 flex flex-col gap-6">
                        {/* Security Monitor Grid */}
                        <div className="flex-1 bg-black rounded-[32px] border border-white/5 overflow-hidden relative group">
                            <div className="absolute inset-0 pointer-events-none z-30 opacity-20 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%]" />

                            <div className="absolute inset-0 p-6 grid grid-cols-2 gap-4 overflow-y-auto">
                                {connectedDevices.map((device, i) => (
                                    <div key={device.id} className="relative bg-white/5 rounded-2xl border border-white/10 aspect-video overflow-hidden flex items-center justify-center">
                                         {deviceFrames[device.id] ? (
                                             <img src={deviceFrames[device.id]} className="w-full h-full object-cover grayscale opacity-80" alt="feed" />
                                         ) : (
                                             <div className="text-[8px] font-black text-white/10 uppercase tracking-[0.4em]">Signal_Wait</div>
                                         )}
                                         <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/60 rounded font-mono text-[8px] text-white/60">CAM_{i+1}</div>
                                    </div>
                                ))}
                                {connectedDevices.length === 0 && (
                                     <div className="col-span-2 flex flex-col items-center justify-center gap-4 opacity-10">
                                         <Camera size={64} />
                                         <span className="text-[10px] font-black uppercase tracking-[0.5em]">監視グリッド待機中</span>
                                     </div>
                                )}
                            </div>
                        </div>

                        {/* Quick Message Bar */}
                        <div className="glass-panel p-6 flex gap-4 items-center">
                             <div className="p-3 bg-white/5 rounded-xl text-white/40">
                                <MessageSquare size={20} />
                             </div>
                             <input
                                type="text"
                                placeholder="一斉メッセージ送信（ナラティブ文字列）..."
                                className="flex-1 bg-transparent border-none outline-none text-sm font-mono tracking-wider"
                                value={notificationText}
                                onChange={(e) => setNotificationText(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && sendNotification()}
                             />
                             <button
                                onClick={sendNotification}
                                className="p-4 bg-white/10 text-white rounded-2xl hover:bg-white/20 transition-all"
                             >
                                <Send size={18} />
                             </button>
                        </div>
                    </div>

                    {/* Right Info Panel */}
                    <div className="col-span-4 flex flex-col gap-6">
                        <section className="glass-panel p-6 flex-1 flex flex-col">
                            <div className="flex items-center gap-2 mb-6">
                                <Users size={14} className="text-white/40" />
                                <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">端末ステータス</span>
                            </div>
                            <div className="flex-1 overflow-y-auto space-y-4">
                                <DeviceStats devices={connectedDevices} />
                            </div>
                        </section>

                        <section className="glass-panel p-6 h-48 flex flex-col">
                            <div className="flex items-center gap-2 mb-4">
                                <Monitor size={14} className="text-white/40" />
                                <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">個別ログ</span>
                            </div>
                            <div className="flex-1 bg-black/20 rounded-xl p-3 overflow-y-auto font-mono text-[10px] text-white/40">
                                {selectedChild === 'all' ? (
                                    <div className="h-full flex items-center justify-center italic opacity-40">SELECT_UNIT_TO_VIEW_LOGS</div>
                                ) : (
                                    (connectionLogs[selectedChild] || []).map((msg, i) => (
                                        <div key={i} className="mb-1">{msg}</div>
                                    ))
                                )}
                            </div>
                        </section>
                    </div>
                </div>
                </>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-[48px]">
                     <div className="text-4xl font-black text-white/5 uppercase tracking-[1rem] mb-4">PERFORMANCE_PANEL</div>
                     <p className="text-[10px] text-white/20 uppercase tracking-[0.5rem] font-bold">公演用カスタムコントロール（開発中）</p>
                </div>
            )}
        </main>
      </div>
    </div>
  );
};

export default App;
