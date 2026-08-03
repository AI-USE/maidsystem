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
  const [localPort, setLocalPort] = useState(3030);
  const [isSecurityMode, setIsSecurityMode] = useState(false);
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'fleet' | 'performance' | 'settings'>('fleet');

  // Discord & TTS States
  const [discordWebhook, setDiscordWebhook] = useState(localStorage.getItem('discordWebhook') || '');
  const [ttsEnabled, setTtsEnabled] = useState(localStorage.getItem('ttsEnabled') !== 'false');

  // Discord Bot Connection States
  const [discordToken, setDiscordToken] = useState(localStorage.getItem('discordToken') || '');
  const [discordVoiceChannel, setDiscordVoiceChannel] = useState(localStorage.getItem('discordVoiceChannel') || '');
  const [discordStatus, setDiscordStatus] = useState<'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'ERROR'>('DISCONNECTED');

  // Local synchronized puzzle timer countdown state
  const [puzzleTimer, setPuzzleTimer] = useState<number | null>(null);
  const [puzzleTimerPaused, setPuzzleTimerPaused] = useState(false);
  const [masterPuzzlePhase, setMasterPuzzlePhase] = useState<'idle' | 'prepared' | 'playing' | 'paused' | 'waiting_commentary' | 'commentary_playing'>('idle');

  const [retiredDeviceIds, setRetiredDeviceIds] = useState<string[]>([]);
  const retiredDeviceIdsRef = React.useRef<string[]>([]);
  useEffect(() => {
    retiredDeviceIdsRef.current = retiredDeviceIds;
  }, [retiredDeviceIds]);

  // Periodic Phase and Timer Sync to prevent child desynchronization or drift
  useEffect(() => {
    const isPlayingOrPaused = masterPuzzlePhase === 'playing' || masterPuzzlePhase === 'paused';
    if (isPlayingOrPaused && puzzleTimer !== null) {
      const interval = setInterval(() => {
        sendCommand('PHASE_SYNC', {
          puzzleState: masterPuzzlePhase,
          timerSeconds: puzzleTimer,
          isPaused: puzzleTimerPaused
        });
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [masterPuzzlePhase, puzzleTimer, puzzleTimerPaused]);

  // Synchronize multiple retired devices list with main process Discord voice bot
  useEffect(() => {
    if (retiredDeviceIds.length > 0) {
      const combinedNames = retiredDeviceIds.map(id => {
         const dev = connectedDevices.find(d => d.id === id);
         return dev ? (dev.name || `端末_${id.substring(0, 6)}`) : `端末_${id.substring(0, 6)}`;
      }).join('と');
      if ((window as any).electron) {
         (window as any).electron.send('SET_EMERGENCY_STATE', { active: true, name: combinedNames });
      }
    } else {
      if ((window as any).electron) {
         (window as any).electron.send('SET_EMERGENCY_STATE', { active: false });
      }
    }
  }, [retiredDeviceIds, connectedDevices]);

  // Maid Delivery States
  const [activeDeliveries, setActiveDeliveries] = useState<any[]>([]);
  const [resultsVideoSent, setResultsVideoSent] = useState(false);

  useEffect(() => {
    if ((window as any).electron) {
      (window as any).electron.on('MAID_DELIVERY_ACTIVE', (data: any) => {
          setActiveDeliveries(prev => {
              if (prev.some(d => d.itemCode === data.itemCode)) return prev;
              return [...prev, data];
          });
      });

      (window as any).electron.on('MAID_DELIVERY_CLEARED_SUCCESS', ({ itemCode }: any) => {
          setActiveDeliveries(prev => prev.filter(d => d.itemCode !== itemCode));
      });

      (window as any).electron.on('MAID_DELIVERY_RESET', () => {
          setActiveDeliveries([]);
      });
    }
  }, []);

  const handleClearMaidDelivery = (itemCode: string) => {
      if ((window as any).electron) {
          (window as any).electron.send('CLEAR_MAID_DELIVERY', { itemCode });
      }
  };

  const [isEmergencyActive, setIsEmergencyActive] = useState(false);
  const isEmergencyActiveRef = React.useRef(false);

  useEffect(() => {
    isEmergencyActiveRef.current = isEmergencyActive;
  }, [isEmergencyActive]);

  // References to handle timers and callbacks with fresh state
  const connectedDevicesRef = React.useRef<DeviceInfo[]>([]);
  const retireIntervalRef = React.useRef<any>(null);

  useEffect(() => {
    connectedDevicesRef.current = connectedDevices;
  }, [connectedDevices]);

  // Synchronize Discord connection state with Electron
  const syncDiscordConfig = () => {
    if ((window as any).electron) {
      (window as any).electron.send('UPDATE_DISCORD_CONFIG', {
        token: discordToken,
        channelId: discordVoiceChannel
      });
    }
  };

  useEffect(() => {
    syncDiscordConfig();
  }, [discordToken, discordVoiceChannel]);

  const [masterEndTimestamp, setMasterEndTimestamp] = useState<number | null>(null);
  const lastAnnouncedSecRef = React.useRef<number | null>(null);

  // Synchronized puzzle countdown timer loop (Clock/Timestamp drift-immune version)
  useEffect(() => {
    let interval: any;
    if (masterEndTimestamp !== null && !puzzleTimerPaused) {
      interval = setInterval(() => {
        const now = Date.now();
        const next = Math.max(0, Math.ceil((masterEndTimestamp - now) / 1000));

        setPuzzleTimer(next);

        if (next === lastAnnouncedSecRef.current) {
          // Already announced this second tick
          return;
        }
        lastAnnouncedSecRef.current = next;

        // Announce remaining minutes
        if (next > 0 && next % 60 === 0) {
          const mins = next / 60;
          const text = `残り${mins}分です。`;
          speakAnnouncement(text);
          sendDiscordNotification(`【システムタイマー】⏳ ${text}`);
          if ((window as any).electron) {
            (window as any).electron.send('TRIGGER_DISCORD_TTS', {
              triggerKey: `TIMER_${mins}`,
              fallbackText: `残り時間、${mins}分です。`
            });
          }
        }
        // Announce last 10 seconds
        else if (next <= 10 && next > 0) {
          speakAnnouncement(String(next));
          if ((window as any).electron) {
            (window as any).electron.send('TRIGGER_DISCORD_TTS', {
              triggerKey: `TIMER_${next}S`,
              fallbackText: String(next)
            });
          }
        }
        // Announce termination
        else if (next === 0) {
          setMasterEndTimestamp(null);
          setMasterPuzzlePhase('playing'); // Maintain playing state until child reports RESULTS_VIDEO_FINISHED

          const correctList = ["OVERRIDE_SUCCESS", "EXEC_STOP_99"];
          const closeList = ["OVERRIDE_CLOSE", "EXEC_STOP_98"];

          const successNames = connectedDevicesRef.current
            .filter(d => d.submittedPasscode && correctList.some(p => p.toUpperCase() === d.submittedPasscode.trim().toUpperCase()))
            .map(d => d.name || `端末_${d.id.substring(0,6)}`);

          const closeNames = connectedDevicesRef.current
            .filter(d => d.submittedPasscode && closeList.some(p => p.toUpperCase() === d.submittedPasscode.trim().toUpperCase()))
            .map(d => d.name || `端末_${d.id.substring(0,6)}`);

          const successStr = successNames.length > 0 ? successNames.join('と') : 'なし';
          const closeStr = closeNames.length > 0 ? closeNames.join('と') : 'なし';

          const text = `終了。ゲームシステムが停止されました。結果を発表します。成功者、${successStr}。惜敗者、${closeStr}。`;
          speakAnnouncement(text);
          sendDiscordNotification(`【システムタイマー】🛑 ${text}`);

          if ((window as any).electron) {
            (window as any).electron.send('TRIGGER_DISCORD_TTS', {
              triggerKey: 'FINISH',
              fallbackText: '制限時間終了。ゲームオーバーです。システムを強制停止します。'
            });
            (window as any).electron.send('START_POST_GAME_ANNOUNCEMENTS', {
              successStr,
              closeStr
            });
          }
        }
      }, 250); // High-fidelity 250ms interval for clock ticking
    }
    return () => clearInterval(interval);
  }, [masterEndTimestamp, puzzleTimerPaused]);

  useEffect(() => {
    if ((window as any).electron) {
      (window as any).electron.send('GET_LOCAL_IP');
      (window as any).electron.on('LOCAL_IP_RESULT', ({ ip, port }: { ip: string, port: number }) => {
          setLocalIp(ip);
          setLocalPort(port);
      });

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

        if (text.includes('RESULTS_VIDEO_FINISHED')) {
           setMasterPuzzlePhase('waiting_commentary');
        }

        if (text.includes('GAME_START_TRIGGERED')) {
           speakAnnouncement("ゲームスタート。ミッションを開始します。");
           sendDiscordNotification("【システム通知】🚀 ゲームスタート！ミッションが開始されました。制限時間7分。");
           if ((window as any).electron) {
              (window as any).electron.send('TRIGGER_DISCORD_TTS', {
                triggerKey: 'START',
                fallbackText: 'ゲームスタート。ミッションを開始します。制限時間は7分です。'
              });
           }
           setPuzzleTimer(420); // Starts the Master local 7-minute countdown
           setPuzzleTimerPaused(false);
        } else if (text.includes('EMERGENCY_RETIRE_TRIGGERED')) {
           const devName = getDeviceName(deviceId);

           setRetiredDeviceIds(prev => {
              if (prev.includes(deviceId)) return prev;
              return [...prev, deviceId];
           });

           setIsEmergencyActive(true);
           if ((window as any).electron) {
              (window as any).electron.send('SET_EMERGENCY_STATE', { active: true, name: devName });
           }
           speakAnnouncement(`${devName}がリタイアしました。`);
           sendDiscordNotification(`🚨【緊急警告】${devName}が緊急リタイアしました！`);

           if (retireIntervalRef.current) clearInterval(retireIntervalRef.current);
           retireIntervalRef.current = setInterval(() => {
               const names = retiredDeviceIdsRef.current.map(id => getDeviceName(id)).join('と');
               speakAnnouncement(`${names}リタイア`);
           }, 5000);
        }
      });

      (window as any).electron.on('PENDING_APPROVALS_UPDATED', (list: any[]) => {
          setPendingApprovals(list);
      });

      (window as any).electron.on('DISCORD_STATUS_UPDATE', ({ status }: { status: any }) => {
          setDiscordStatus(status);
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

  // Helper to resolve device name by ID
  const getDeviceName = (id: string) => {
    const dev = connectedDevicesRef.current.find(d => d.id === id);
    return dev?.name || `端末 ${id.substring(0, 6)}`;
  };

  // Discord integration helper
  const sendDiscordNotification = async (message: string) => {
    const webhookUrl = localStorage.getItem('discordWebhook') || discordWebhook;
    if (!webhookUrl) return;

    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content: message })
      });
    } catch (err) {
      console.error('Failed to send Discord webhook:', err);
    }
  };

  // TTS Speech Synthesis announcement helper
  const speakAnnouncement = (text: string) => {
    const ttsVal = localStorage.getItem('ttsEnabled') !== 'false';
    if (!ttsVal) return;

    if (isEmergencyActiveRef.current && !text.includes('リタイア') && !text.includes('解除')) {
       console.log(`Local speech block: "${text}" is suppressed due to active emergency.`);
       return;
    }

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ja-JP';
      utterance.rate = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  };

  const handlePuzzlePrepare = () => {
    sendCommand('PUZZLE_PREPARE');
    setMasterPuzzlePhase('prepared');
    speakAnnouncement("謎解きの公演準備完了。スタートまでしばらくお待ちください。");
    sendDiscordNotification("【システム通知】📢 謎解きの公演準備完了。まもなくミッションを開始します。");
    if ((window as any).electron) {
      (window as any).electron.send('START_STANDBY_LOOP');
    }
  };

  const handlePuzzleStart = () => {
    if ((window as any).electron) {
      (window as any).electron.send('STOP_STANDBY_LOOP');
    }
    sendCommand('PUZZLE_START');
    setMasterPuzzlePhase('playing');

    const endTs = Date.now() + 420000;
    setMasterEndTimestamp(endTs);
    setPuzzleTimer(420);
    setPuzzleTimerPaused(false);
    lastAnnouncedSecRef.current = null;

    // Auto trigger connection message for starting the game
    if ((window as any).electron) {
      (window as any).electron.send('TRIGGER_DISCORD_TTS', {
         triggerKey: 'START',
         fallbackText: 'ゲームスタート。ミッションを開始します。制限時間は7分です。'
      });
    }
    speakAnnouncement("ミッションを開始します。制限時間は7分です。");
    sendDiscordNotification("【システム通知】🚀 ゲームスタート！一斉ミッションが開始されました。制限時間7分。");
  };

  const handlePuzzleStop = () => {
    if ((window as any).electron) {
      (window as any).electron.send('STOP_STANDBY_LOOP');
    }
    sendCommand('PUZZLE_STOP');
    setMasterPuzzlePhase('idle');
    setMasterEndTimestamp(null);
    setPuzzleTimer(null);
    setPuzzleTimerPaused(false);
    setIsEmergencyActive(false);
    setRetiredDeviceIds([]);
    setResultsVideoSent(false); // Reset results video gate
    if ((window as any).electron) {
        (window as any).electron.send('SET_EMERGENCY_STATE', { active: false });
        (window as any).electron.send('STOP_RESULTS_LOOP');
    }
    if (retireIntervalRef.current) {
        clearInterval(retireIntervalRef.current);
        retireIntervalRef.current = null;
    }
    window.speechSynthesis.cancel();
    speakAnnouncement("解説が終了しました。");
    sendDiscordNotification("【システム通知】解説が終了しました。お疲れ様でした。");
    if ((window as any).electron) {
        (window as any).electron.send('TRIGGER_DISCORD_TTS', {
            triggerKey: 'STOP',
            fallbackText: '解説が終了しました。お疲れ様でした。'
        });
    }
  };

  const handlePuzzleRestart = () => {
    if ((window as any).electron) {
      (window as any).electron.send('STOP_STANDBY_LOOP');
    }
    sendCommand('PUZZLE_RESTART');
    setMasterPuzzlePhase('playing');

    const endTs = Date.now() + 420000;
    setMasterEndTimestamp(endTs);
    setPuzzleTimer(420);
    setPuzzleTimerPaused(false);
    lastAnnouncedSecRef.current = null;

    setIsEmergencyActive(false);
    setRetiredDeviceIds([]);
    setResultsVideoSent(false); // Reset results video gate
    if ((window as any).electron) {
        (window as any).electron.send('SET_EMERGENCY_STATE', { active: false });
        (window as any).electron.send('STOP_RESULTS_LOOP');
    }
    if (retireIntervalRef.current) {
        clearInterval(retireIntervalRef.current);
        retireIntervalRef.current = null;
    }
    window.speechSynthesis.cancel();
    speakAnnouncement("謎解きシステムが一斉再起動されました。ミッションを開始します。");
    sendDiscordNotification("【システム通知】謎解きシステムが一斉再起動されました。");
  };

  const handlePuzzlePause = () => {
    sendCommand('PUZZLE_PAUSE');
    setMasterPuzzlePhase('paused');
    setPuzzleTimerPaused(true);

    // Save remaining seconds
    if (masterEndTimestamp !== null) {
      const remaining = Math.max(0, Math.ceil((masterEndTimestamp - Date.now()) / 1000));
      setPuzzleTimer(remaining);
    }
    setMasterEndTimestamp(null);

    speakAnnouncement("ゲームを一時停止します。");
    sendDiscordNotification("【システム通知】⏸️ ゲームが一時停止されました。");
  };

  const handlePuzzleResume = () => {
    sendCommand('PUZZLE_RESUME');
    setMasterPuzzlePhase('playing');
    setPuzzleTimerPaused(false);

    // Recompute endTimestamp based on the paused remaining seconds
    const remaining = puzzleTimer || 420;
    const endTs = Date.now() + remaining * 1000;
    setMasterEndTimestamp(endTs);

    speakAnnouncement("ゲームを再開します。");
    sendDiscordNotification("【システム通知】▶️ ゲームが再開されました。");
  };

  const handleCancelRetireForDevice = (deviceId: string) => {
    if ((window as any).electron) {
      (window as any).electron.send('SEND_REMOTE_COMMAND', {
        targetId: deviceId,
        command: { type: 'PUZZLE_CANCEL_RETIRE' }
      });
    }

    const remainingRetired = retiredDeviceIds.filter(id => id !== deviceId);
    setRetiredDeviceIds(remainingRetired);

    if (remainingRetired.length === 0) {
      setIsEmergencyActive(false);
      if ((window as any).electron) {
          (window as any).electron.send('SET_EMERGENCY_STATE', { active: false });
      }
      if (retireIntervalRef.current) {
          clearInterval(retireIntervalRef.current);
          retireIntervalRef.current = null;
      }
    } else {
       // Update repeating announcement with remaining retired names
       if (retireIntervalRef.current) clearInterval(retireIntervalRef.current);
       retireIntervalRef.current = setInterval(() => {
           const names = remainingRetired.map(id => getDeviceName(id)).join('と');
           speakAnnouncement(`${names}リタイア`);
       }, 5000);
    }

    window.speechSynthesis.cancel();
    const devName = getDeviceName(deviceId);
    speakAnnouncement(`${devName}のリタイアが解除されました。`);
    sendDiscordNotification(`【システム通知】${devName}のリタイアが遠隔解除されました。`);
  };

  return (
    <div className="min-h-screen bg-[#0d0d0f] text-[#f5f5f7] flex flex-col p-8 gap-8 font-sans overflow-hidden">
      <div className="aura-bg opacity-40" />

      {/* Flashing global emergency notification bar if any child terminal has retired */}
      <AnimatePresence>
          {retiredDeviceIds.length > 0 && (
              <div className="relative z-50 flex flex-col gap-4">
                {retiredDeviceIds.map(deviceId => {
                   const devName = getDeviceName(deviceId);
                   return (
                      <motion.div
                        key={deviceId}
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="glass-panel p-6 border-red-500/50 bg-red-950/40 flex items-center justify-between"
                      >
                          <div className="flex items-center gap-4">
                              <div className="p-3 bg-red-500/20 text-red-500 rounded-xl animate-pulse">
                                  <ShieldAlert size={24} />
                              </div>
                              <div>
                                  <div className="text-sm font-black text-red-400 uppercase tracking-widest">⚠️ 緊急リタイア警報検知</div>
                                  <div className="text-xs text-white/60 font-mono mt-1">
                                       端末「{devName}」から緊急リタイア（操作停止）が申請されました。
                                  </div>
                              </div>
                          </div>
                          <button
                            onClick={() => handleCancelRetireForDevice(deviceId)}
                            className="px-6 py-2.5 bg-red-500 hover:bg-red-600 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-[0_0_20px_rgba(239,68,68,0.4)]"
                          >
                               この端末のリタイア解除を実行
                          </button>
                      </motion.div>
                   );
                })}
              </div>
          )}
      </AnimatePresence>

      {/* Active Maid Delivery Requests Notification Bar */}
      <AnimatePresence>
          {activeDeliveries.length > 0 && (
              <div className="relative z-50 flex flex-col gap-4">
                {activeDeliveries.map(delivery => {
                   const devName = getDeviceName(delivery.deviceId);
                   return (
                      <motion.div
                        key={delivery.itemCode}
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="glass-panel p-6 border-green-500/50 bg-green-950/20 flex items-center justify-between"
                      >
                          <div className="flex items-center gap-4">
                              <div className="p-3 bg-green-500/20 text-green-400 rounded-xl animate-bounce">
                                  <Zap size={24} />
                              </div>
                              <div>
                                  <div className="text-sm font-black text-green-400 uppercase tracking-widest">🛎️ メイド配達要請検知</div>
                                  <div className="text-xs text-white/80 font-mono mt-1">
                                       端末「{devName}」：部屋 <span className="text-green-400 font-bold">{delivery.roomCode}</span> より物品 <span className="text-green-400 font-bold">"{delivery.itemName}"（コード: {delivery.itemCode}）</span> の配達要請を受けました。
                                  </div>
                              </div>
                          </div>
                          <button
                            onClick={() => handleClearMaidDelivery(delivery.itemCode)}
                            className="px-6 py-2.5 bg-green-500 hover:bg-green-600 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-[0_0_20px_rgba(34,197,94,0.4)]"
                          >
                               配備完了（要請をクリア）
                          </button>
                      </motion.div>
                   );
                })}
              </div>
          )}
      </AnimatePresence>

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
                      {connectedDevices.map((device, i) => {
                          const isRetired = retiredDeviceIds.includes(device.id);
                          let borderClass = 'border-white/10';
                          if (isRetired) borderClass = 'border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)] animate-pulse';
                          else if (device.isPaused) borderClass = 'border-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.3)]';
                          else if (device.puzzleState === 'locked') borderClass = 'border-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.3)]';
                          else if (device.puzzleState === 'browsing_pdf_1') borderClass = 'border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.3)]';
                          else if (device.puzzleState === 'admin_desktop') borderClass = 'border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.3)]';

                          return (
                          <div key={device.id} className={`relative bg-white/5 border ${borderClass} rounded-3xl overflow-hidden group`}>
                              {deviceFrames[device.id] ? (
                                  <img src={deviceFrames[device.id]} className="w-full h-full object-cover grayscale brightness-75 contrast-125" alt="feed" />
                              ) : (
                                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                                      <VideoOff size={48} className="text-white/10" />
                                      <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.5em]">No_Signal</span>
                                  </div>
                              )}

                              {/* OSD Info */}
                              <div className="absolute top-6 left-6 flex flex-col gap-1 z-10">
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
                          );
                      })}
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
                <span className="text-sm font-mono text-green-400 font-bold relative z-10">http://{localIp}:{localPort}</span>
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
                <button
                    onClick={() => setActiveTab('settings')}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'settings' ? 'bg-white text-black font-bold' : 'text-white/40 hover:bg-white/5'}`}
                >
                    <Sliders size={18} />
                    <span className="text-[10px] uppercase tracking-widest">設定パネル</span>
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

                    <div className="flex flex-col gap-2 glass-panel p-4 items-center">
                        <button
                            onClick={toggleCamera}
                            className={`w-full flex items-center justify-center gap-3 p-4 rounded-xl border transition-all ${cameraActive ? 'bg-purple-500 text-white border-purple-400 shadow-lg' : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'}`}
                        >
                            {cameraActive ? <VideoOff size={20} /> : <Video size={20} />}
                            <span className="text-[10px] font-bold uppercase tracking-widest">{cameraActive ? '映像切断' : '映像一斉受信'}</span>
                        </button>
                        <div className="w-full flex flex-col gap-1 px-2">
                             <div className="flex justify-between items-center">
                                <span className="text-[7px] font-bold text-white/20 uppercase tracking-widest">Camera_FPS</span>
                                <span className="text-[9px] font-mono text-white/60">{cameraFps} FPS</span>
                             </div>
                             <input
                                type="range" min="1" max="30" step="1"
                                className="w-full accent-purple-500 opacity-60 hover:opacity-100 transition-opacity"
                                value={cameraFps}
                                onChange={(e) => {
                                    const val = parseInt(e.target.value);
                                    setCameraFps(val);
                                    if (cameraActive) {
                                        sendCommand('SET_CAMERA', { active: true, fps: val });
                                    }
                                }}
                             />
                        </div>
                    </div>

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
                                {connectedDevices.map((device, i) => {
                                    const isRetired = retiredDeviceIds.includes(device.id);
                                    let borderClass = 'border-white/10';
                                    if (isRetired) borderClass = 'border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.2)] animate-pulse';
                                    else if (device.isPaused) borderClass = 'border-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.2)]';
                                    else if (device.puzzleState === 'locked') borderClass = 'border-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.2)]';
                                    else if (device.puzzleState === 'browsing_pdf_1') borderClass = 'border-green-500 shadow-[0_0_10px_rgba(34,197,94,0.2)]';
                                    else if (device.puzzleState === 'admin_desktop') borderClass = 'border-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.2)]';

                                    return (
                                    <div key={device.id} className={`relative bg-white/5 rounded-2xl border ${borderClass} aspect-video overflow-hidden flex items-center justify-center`}>
                                         {deviceFrames[device.id] ? (
                                             <img src={deviceFrames[device.id]} className="w-full h-full object-cover grayscale opacity-80" alt="feed" />
                                         ) : (
                                             <div className="text-[8px] font-black text-white/10 uppercase tracking-[0.4em]">Signal_Wait</div>
                                         )}
                                         <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/60 rounded font-mono text-[8px] text-white/60 z-10">CAM_{i+1}</div>
                                    </div>
                                    );
                                })}
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
                                <DeviceStats devices={connectedDevices} isPuzzleActive={puzzleTimer !== null} />
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
            ) : activeTab === 'performance' ? (
                <div className="flex-1 flex flex-col gap-8 p-10 bg-white/5 border border-white/10 rounded-[48px] justify-center items-center relative overflow-hidden">
                     <div className="absolute inset-0 pointer-events-none z-0 opacity-5 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,4px_100%]" />
                     <div className="flex flex-col items-center justify-center text-center max-w-lg z-10 gap-6">
                         <div className="w-16 h-16 bg-white/5 rounded-[24px] flex items-center justify-center border border-white/10 animate-pulse mb-2">
                             <Zap className="text-white/60" size={32} />
                         </div>
                         <div>
                             <h2 className="text-3xl font-black text-white uppercase tracking-[0.4rem]">謎解き公演コントロール</h2>
                             <p className="text-xs text-white/40 uppercase tracking-[0.2rem] mt-2">公演進行用のリアルタイム制御パネル</p>
                         </div>

                         <div className="w-full h-[1px] bg-white/10 my-4" />

                         <div className="grid grid-cols-1 md:grid-cols-5 gap-4 w-full">
                             {puzzleTimer !== null && (
                                 <div className="col-span-1 md:col-span-5 p-6 bg-black/40 border border-white/5 rounded-3xl flex flex-col items-center justify-center gap-2">
                                     <span className="text-[10px] font-black uppercase tracking-widest text-white/40">制限時間カウントダウン</span>
                                     <span className="text-5xl font-mono font-black tracking-widest text-red-500 tabular-nums animate-pulse">
                                         {puzzleTimer === 0 ? '制限時間終了' : `${Math.floor(puzzleTimer / 60)}分${puzzleTimer % 60}秒`}
                                     </span>
                                 </div>
                             )}

                             <button
                                 disabled={masterPuzzlePhase !== 'idle'}
                                 onClick={handlePuzzlePrepare}
                                 className={`flex flex-col items-center gap-4 p-6 border rounded-3xl transition-all group ${masterPuzzlePhase === 'idle' ? 'bg-blue-500/10 border-blue-500/30 hover:border-blue-500/50' : 'opacity-30 cursor-not-allowed bg-white/5 border-white/5 text-white/20'}`}
                             >
                                 <div className="p-4 bg-blue-500/20 text-blue-400 rounded-2xl group-hover:scale-110 transition-transform">
                                     <Sliders size={24} />
                                 </div>
                                 <div className="text-center">
                                     <div className="text-xs font-black text-blue-400 uppercase tracking-widest">謎解き準備</div>
                                     <div className="text-[9px] text-white/40 mt-1 uppercase">Puzzle_Prepare</div>
                                 </div>
                             </button>

                             <button
                                 disabled={masterPuzzlePhase !== 'prepared'}
                                 onClick={handlePuzzleStart}
                                 className={`flex flex-col items-center gap-4 p-6 border rounded-3xl transition-all group ${masterPuzzlePhase === 'prepared' ? 'bg-green-500/10 border-green-500/30 hover:border-green-500/50' : 'opacity-30 cursor-not-allowed bg-white/5 border-white/5 text-white/20'}`}
                             >
                                 <div className="p-4 bg-green-500/20 text-green-400 rounded-2xl group-hover:scale-110 transition-transform">
                                     <Play size={24} fill="currentColor" />
                                 </div>
                                 <div className="text-center">
                                     <div className="text-xs font-black text-green-400 uppercase tracking-widest">謎解きスタート</div>
                                     <div className="text-[9px] text-white/40 mt-1 uppercase">Puzzle_Start</div>
                                 </div>
                             </button>

                             <button
                                 disabled={masterPuzzlePhase === 'idle'}
                                 onClick={() => {
                                     if (confirm("警告: 公演をストップ（中断）しますか？")) {
                                         if (confirm("本当に中断しますか？この操作は取り消せません。")) {
                                             handlePuzzleStop();
                                         }
                                     }
                                 }}
                                 className={`flex flex-col items-center gap-4 p-6 border rounded-3xl transition-all group ${masterPuzzlePhase !== 'idle' ? 'bg-red-500/10 border-red-500/30 hover:border-red-500/50' : 'opacity-30 cursor-not-allowed bg-white/5 border-white/5 text-white/20'}`}
                             >
                                 <div className="p-4 bg-red-500/20 text-red-400 rounded-2xl group-hover:scale-110 transition-transform">
                                     <Power size={24} />
                                 </div>
                                 <div className="text-center">
                                     <div className="text-xs font-black text-red-400 uppercase tracking-widest">ストップ / 中断</div>
                                     <div className="text-[9px] text-white/40 mt-1 uppercase">Puzzle_Stop</div>
                                 </div>
                             </button>

                             <button
                                 disabled={masterPuzzlePhase === 'idle' || masterPuzzlePhase === 'prepared'}
                                 onClick={() => {
                                     if (confirm("警告: 公演を一斉再起動しますか？")) {
                                         if (confirm("本当に再起動しますか？タイマーが7分にリセットされます。")) {
                                             handlePuzzleRestart();
                                         }
                                     }
                                 }}
                                 className={`flex flex-col items-center gap-4 p-6 border rounded-3xl transition-all group ${(masterPuzzlePhase !== 'idle' && masterPuzzlePhase !== 'prepared') ? 'bg-blue-500/10 border-blue-500/30 hover:border-blue-500/50' : 'opacity-30 cursor-not-allowed bg-white/5 border-white/5 text-white/20'}`}
                             >
                                 <div className="p-4 bg-blue-500/20 text-blue-400 rounded-2xl group-hover:scale-110 transition-transform">
                                     <Zap size={24} />
                                 </div>
                                 <div className="text-center">
                                     <div className="text-xs font-black text-blue-400 uppercase tracking-widest">一斉再起動</div>
                                     <div className="text-[9px] text-white/40 mt-1 uppercase">Puzzle_Restart</div>
                                 </div>
                             </button>

                             {(masterPuzzlePhase === 'playing' || masterPuzzlePhase === 'paused') ? (
                                 <button
                                     onClick={puzzleTimerPaused ? handlePuzzleResume : handlePuzzlePause}
                                     className={`flex flex-col items-center gap-4 p-6 rounded-3xl transition-all group ${puzzleTimerPaused ? 'bg-yellow-500/10 border-yellow-500/30 hover:bg-yellow-500/20' : 'bg-orange-500/10 border-orange-500/30 hover:bg-orange-500/20'}`}
                                 >
                                     <div className={`p-4 rounded-2xl group-hover:scale-110 transition-transform ${puzzleTimerPaused ? 'bg-yellow-500/20 text-yellow-400' : 'bg-orange-500/20 text-orange-400'}`}>
                                         {puzzleTimerPaused ? <Play size={24} fill="currentColor" /> : <Power size={24} className="rotate-90" />}
                                     </div>
                                     <div className="text-center">
                                         <div className={`text-xs font-black uppercase tracking-widest ${puzzleTimerPaused ? 'text-yellow-400' : 'text-orange-400'}`}>
                                             {puzzleTimerPaused ? '再開 (Resume)' : '一時停止 (Pause)'}
                                         </div>
                                         <div className="text-[9px] text-white/40 mt-1 uppercase">Puzzle_Control</div>
                                     </div>
                                 </button>
                             ) : (
                                 <div className="flex flex-col items-center justify-center p-6 border border-white/5 bg-white/5 opacity-20 rounded-3xl select-none font-mono">
                                      <Lock size={24} />
                                      <span className="text-[8px] uppercase tracking-widest mt-2">CTRL_LOCKED</span>
                                 </div>
                             )}
                         </div>

                         <div className="w-full h-[1px] bg-white/10 my-4" />

                         <div className="w-full space-y-4 text-left">
                             <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest pl-2">公演結果発表 & 解説ビデオ制御</h3>
                             <div className="max-w-md w-full">
                                 <button
                                     disabled={masterPuzzlePhase !== 'waiting_commentary'}
                                     onClick={() => {
                                         if (confirm("全子機で一斉に【解説動画】を再生しますか？")) {
                                             sendCommand('PUZZLE_RESULT_COMMENTARY');
                                             setMasterPuzzlePhase('commentary_playing');
                                         }
                                     }}
                                     className={`flex items-center justify-center gap-4 w-full p-5 rounded-2xl border transition-all ${masterPuzzlePhase === 'waiting_commentary' ? 'bg-purple-500/10 hover:bg-purple-500/20 border-purple-500/30 text-purple-400 shadow-lg' : 'opacity-30 cursor-not-allowed bg-white/5 border-white/5 text-white/20'}`}
                                 >
                                     <Play size={24} className="text-purple-400 animate-pulse" />
                                     <div className="text-left font-sans">
                                          <div className="text-xs font-black text-purple-400 uppercase tracking-widest">解説動画を一斉上映</div>
                                          <div className="text-[8px] text-white/40 mt-0.5 font-mono uppercase">PUZZLE_RESULT_COMMENTARY</div>
                                     </div>
                                 </button>
                             </div>
                         </div>
                     </div>
                </div>
            ) : (
                <div className="flex-1 flex flex-col gap-8 p-10 bg-white/5 border border-white/10 rounded-[48px] overflow-y-auto relative">
                     <div className="absolute inset-0 pointer-events-none z-0 opacity-5 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,4px_100%]" />
                     <div className="max-w-2xl w-full mx-auto space-y-8 relative z-10 py-6 font-sans">
                          <div>
                               <h2 className="text-3xl font-black text-white uppercase tracking-[0.4rem]">システム連携 & 設定</h2>
                               <p className="text-xs text-white/40 uppercase tracking-[0.2rem] mt-2">Discord 連携と音声合成 (TTS) エンジンの構成</p>
                          </div>

                          <div className="h-[1px] bg-white/10" />

                          {/* Discord API Bot Connection Settings */}
                          <div className="glass-panel p-8 bg-black/40 border-white/5 rounded-3xl space-y-6">
                               <div className="flex items-center justify-between text-white">
                                    <div className="flex items-center gap-4">
                                         <Cpu size={24} className="text-blue-400" />
                                         <div>
                                              <h3 className="text-sm font-bold uppercase tracking-wider">Discord ボット連携設定</h3>
                                              <p className="text-[10px] text-white/40 mt-0.5">ボイスチャンネルにボットを接続し、合成音声（TTS）をリアルタイム再生します。</p>
                                         </div>
                                    </div>
                                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/5">
                                         <div className={`w-2 h-2 rounded-full ${discordStatus === 'CONNECTED' ? 'bg-green-400 shadow-[0_0_10px_rgba(74,222,128,0.5)]' : discordStatus === 'CONNECTING' ? 'bg-yellow-400 animate-pulse' : discordStatus === 'ERROR' ? 'bg-red-500 animate-pulse' : 'bg-white/10'}`} />
                                         <span className="text-[9px] font-black uppercase tracking-wider font-mono">
                                              {discordStatus === 'CONNECTED' && '接続中'}
                                              {discordStatus === 'CONNECTING' && '接続試行中...'}
                                              {discordStatus === 'ERROR' && '接続エラー'}
                                              {discordStatus === 'DISCONNECTED' && '未接続'}
                                         </span>
                                    </div>
                               </div>

                               <div className="grid grid-cols-2 gap-6 pt-2">
                                    <div className="space-y-2">
                                         <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest block">ボットトークン (API Key)</label>
                                         <input
                                              type="password"
                                              placeholder="MTg4NDY..."
                                              className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3.5 text-xs font-mono text-white placeholder-white/20 outline-none focus:border-blue-500/50 transition-colors"
                                              value={discordToken}
                                              onChange={(e) => {
                                                   const token = e.target.value;
                                                   setDiscordToken(token);
                                                   localStorage.setItem('discordToken', token);
                                              }}
                                         />
                                    </div>

                                    <div className="space-y-2">
                                         <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest block">ボイスチャンネルID</label>
                                         <input
                                              type="text"
                                              placeholder="104928..."
                                              className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3.5 text-xs font-mono text-white placeholder-white/20 outline-none focus:border-blue-500/50 transition-colors"
                                              value={discordVoiceChannel}
                                              onChange={(e) => {
                                                   const ch = e.target.value;
                                                   setDiscordVoiceChannel(ch);
                                                   localStorage.setItem('discordVoiceChannel', ch);
                                              }}
                                         />
                                    </div>
                               </div>
                          </div>

                          {/* Speech Synthesis (TTS) section */}
                          <div className="glass-panel p-8 bg-black/40 border-white/5 rounded-3xl space-y-6">
                               <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4 text-white">
                                         <Zap size={24} className="text-yellow-400" />
                                         <div>
                                              <h3 className="text-sm font-bold uppercase tracking-wider">リアルタイム音声合成 (TTS)</h3>
                                              <p className="text-[10px] text-white/40 mt-0.5">アナウンス、警告、カウントダウンを親機にて合成音声で読み上げます。</p>
                                         </div>
                                    </div>
                                    <button
                                         onClick={() => {
                                              const val = !ttsEnabled;
                                              setTtsEnabled(val);
                                              localStorage.setItem('ttsEnabled', String(val));
                                         }}
                                         className={`px-5 py-2.5 rounded-xl border text-[10px] font-bold uppercase tracking-widest transition-all ${ttsEnabled ? 'bg-yellow-500/10 border-yellow-500 text-yellow-400' : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'}`}
                                    >
                                         {ttsEnabled ? '有効化中 (ACTIVE)' : '無効'}
                                    </button>
                               </div>
                          </div>

                          {/* Test Operations section */}
                          <div className="glass-panel p-8 bg-black/40 border-white/5 rounded-3xl space-y-6">
                               <div className="text-xs font-bold uppercase tracking-widest text-white/40">動作テストエリア</div>
                               <div className="grid grid-cols-2 gap-4">
                                    <button
                                         onClick={() => {
                                              if ((window as any).electron) {
                                                   (window as any).electron.send('TRIGGER_DISCORD_TTS', {
                                                        triggerKey: 'START',
                                                        fallbackText: 'テスト：ボイスチャット接続良好。これよりミッションを開始します。'
                                                   });
                                              }
                                         }}
                                         className="py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-all"
                                    >
                                         Discord TTS テスト再生
                                    </button>
                                    <button
                                         onClick={() => speakAnnouncement("音声合成テスト。親機スピーカー接続良好です。")}
                                         className="py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-all"
                                    >
                                         親機スピーカー テスト再生
                                    </button>
                               </div>
                          </div>
                     </div>
                </div>
            )}
        </main>
      </div>
    </div>
  );
};

export default App;
