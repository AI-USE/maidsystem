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
  EyeOff,
  FileText,
  Camera,
  Layers,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sliders,
  ChevronRight,
  Terminal as TerminalIcon,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { Setup } from './components/Setup';
import { OSContext, OSContextType } from './hooks/useOS';
import { HiddenCamera } from './components/HiddenCamera';
import { useRemoteControl } from './hooks/useRemoteControl';

const App: React.FC = () => {
  const [showExitModal, setShowExitModal] = useState(false);
  const [showSetup, setShowSetup] = useState(true); // Always show setup wizard on startup
  const [exitPassword, setExitPassword] = useState('');
  const [showPasswordRaw, setShowPasswordRaw] = useState(false);
  const [passwordError, setPasswordError] = useState(false);
  const [masterUrl, setMasterUrl] = useState<string | null>(localStorage.getItem('masterUrl'));
  const [isShaking, setIsShaking] = useState(false);
  const [time, setTime] = useState(new Date());

  // Clock Override State for Puzzle Start
  const [timeOverride, setTimeOverride] = useState<Date | null>(null);

  // Puzzle State Machine
  // 'idle': Setup / Initial phase
  // 'locked': Fullscreen locked screen overlay, 7-minute timer, clock forced to 23:53:40
  // 'browsing_pdf_1': First PDF displayed. Standard desktop hidden. Footer has only passworded power button.
  // 'boot_loading': Loading sequence screen for GOV-CORE OS
  // 'admin_desktop': High-security Admin Desktop showing 3 big software icons + PDF Viewer 2
  const [puzzleState, setPuzzleState] = useState<'idle' | 'locked' | 'browsing_pdf_1' | 'boot_loading' | 'admin_desktop'>('idle');
  const [puzzleInput, setPuzzleInput] = useState('');
  const [showPuzzleInputRaw, setShowPuzzleInputRaw] = useState(false);
  const [puzzleError, setPuzzleError] = useState(false);

  // Admin Power Button Password Prompt State
  const [showPowerPrompt, setShowPowerPrompt] = useState(false);
  const [powerInput, setPowerInput] = useState('');
  const [powerError, setPowerError] = useState(false);

  // Admin Mock Application Windows Open States
  const [openAppId, setOpenAppId] = useState<string | null>(null);

  // Security Camera Grid enlarger
  const [selectedCam, setSelectedCam] = useState<number | null>(null);

  // Maid controls state mock
  const [maidActive, setMaidActive] = useState(true);
  const [tempVal, setTempVal] = useState(21.4);
  const [entranceLocked, setEntranceLocked] = useState(true);

  // Execution stop state mock
  const [executionOverrideInput, setExecutionOverrideInput] = useState('');
  const [executionAborted, setExecutionAborted] = useState(false);
  const [overrideError, setOverrideError] = useState(false);

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
    closeApp: () => setOpenAppId(null),
    emit: (event, data) => emit(event, data),
    isConnected: isConnected && isPaired,
    activeAppId: openAppId
  }), [isConnected, isPaired, openAppId, emit]);

  // Master Clock & Override increment
  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
      setTimeOverride(prev => {
        if (!prev) return null;
        return new Date(prev.getTime() + 1000);
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Execution Countdown Timer
  useEffect(() => {
    let interval: any;
    if (timerSeconds !== null && timerSeconds > 0) {
      interval = setInterval(() => {
        setTimerSeconds(prev => {
          if (prev && prev > 0) return prev - 1;
          return 0;
        });
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
          emit('APP_STATE_CHANGED', { appId: openAppId || 'IDLE' });
      }
  }, [openAppId, isConnected, isPaired]);

  const handleRemoteCommand = (cmd: any) => {
    switch (cmd.type) {
      case 'GET_SCREENSHOT':
        break;
      case 'LAUNCH_APP':
        setOpenAppId(cmd.payload.appId);
        break;
      case 'CLOSE_APP':
        setOpenAppId(null);
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
      case 'PUZZLE_START': {
        // Set clock exactly to 23:53:40 of today
        const targetTime = new Date();
        targetTime.setHours(23, 53, 40, 0);
        setTimeOverride(targetTime);

        // Set execution countdown to exactly 7 minutes (420 seconds)
        setTimerSeconds(420);

        setPuzzleState('locked');
        setPuzzleInput('');
        setPuzzleError(false);
        setExecutionAborted(false);
        break;
      }
      case 'PUZZLE_STOP':
        setPuzzleState('idle');
        setTimeOverride(null);
        setTimerSeconds(null);
        break;
      case 'PUZZLE_RESTART': {
        const targetTime = new Date();
        targetTime.setHours(23, 53, 40, 0);
        setTimeOverride(targetTime);
        setTimerSeconds(420);

        setPuzzleState('locked');
        setPuzzleInput('');
        setPuzzleError(false);
        setExecutionAborted(false);
        break;
      }
    }
  };

  const handleVerifyPassword = () => {
    if ((window as any).electron) {
      (window as any).electron.send('VERIFY_PASSWORD', exitPassword);
    }
  };

  const handleVerifyPuzzlePassword = () => {
    const eventPass = localStorage.getItem('pass_event') || 'EVT_TRIGGER_99';
    if (puzzleInput === eventPass) {
      setPuzzleState('browsing_pdf_1');
      setPuzzleInput('');
      setPuzzleError(false);
      emit('CONNECTION_MSG', { text: 'PUZZLE_UNLOCKED: Correct entry password parsed.' });
    } else {
      setPuzzleError(true);
    }
  };

  const handlePowerVerifyPassword = () => {
    const eventPass = localStorage.getItem('pass_event') || 'EVT_TRIGGER_99';
    if (powerInput === eventPass) {
      setShowPowerPrompt(false);
      setPowerInput('');
      setPowerError(false);

      // Start Admin Boot Sequence
      setPuzzleState('boot_loading');
      setTimeout(() => {
         setPuzzleState('admin_desktop');
         emit('CONNECTION_MSG', { text: 'GOV-CORE OS: Admin mode booted successfully.' });
      }, 5000); // 5 seconds of boot loader
    } else {
      setPowerError(true);
    }
  };

  const handleVerifyExecutionOverride = () => {
     const eventPass = localStorage.getItem('pass_event') || 'EVT_TRIGGER_99';
     if (executionOverrideInput === eventPass) {
         setExecutionAborted(true);
         setTimerSeconds(null);
         setOverrideError(false);
         emit('CONNECTION_MSG', { text: 'OVERRIDE_SUCCESSFUL: Execution stopped.' });
     } else {
         setOverrideError(true);
     }
  };

  if (showSetup) {
      return <Setup onComplete={() => {
          setShowSetup(false);
          setMasterUrl(localStorage.getItem('masterUrl'));
      }} />;
  }

  // Determine current active displayed clock
  const displayClockStr = (timeOverride || time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <OSContext.Provider value={osContextValue}>
    <div className={`relative h-screen w-screen bg-[#050508] text-[#eaeaea] overflow-hidden ${isShaking ? 'animate-shake' : ''} ${isFrozen ? 'pointer-events-none select-none' : ''}`}>

      <AnimatePresence>
          {/* Phase 1: Custom restricted passcode screen */}
          {puzzleState === 'locked' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[500] bg-[#050508] flex flex-col items-center justify-center p-6 text-center"
              >
                  <div className="scanlines z-0" />
                  <div className="absolute inset-0 opacity-10 pointer-events-none z-0">
                      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:24px_24px]" />
                  </div>

                  <motion.div
                    initial={{ scale: 0.95, y: 15 }}
                    animate={{ scale: 1, y: 0 }}
                    className="w-full max-w-md glass-panel p-10 rounded-[32px] border-red-900/30 bg-black/40 relative z-10 flex flex-col items-center shadow-[0_32px_64px_-12px_rgba(0,0,0,0.9)]"
                  >
                      <div className="w-16 h-16 bg-red-950/40 rounded-[24px] flex items-center justify-center mb-8 border border-red-500/30 animate-pulse">
                          <Lock className="text-red-500" size={32} />
                      </div>

                      <h2 className="text-xl font-black tracking-[0.3em] text-white uppercase mb-2">SYSTEM_RESTRICTED</h2>
                      <p className="text-[10px] text-red-500/80 uppercase tracking-[0.1em] font-bold mb-10 max-w-xs leading-relaxed">
                          謎解きミッション開始。ロック解除コードを入力してください。
                      </p>

                      <div className="relative w-full mb-2">
                          <input
                              type={showPuzzleInputRaw ? "text" : "password"}
                              autoFocus
                              placeholder="PASSCODE"
                              className={`w-full bg-black/60 border rounded-2xl px-6 py-4 text-center outline-none focus:border-red-950/50 transition-all text-xl font-mono tracking-[0.5em] text-red-500 placeholder-red-900/40 ${puzzleError ? 'border-red-600 shadow-[0_0_15px_rgba(239,68,68,0.2)]' : 'border-red-950/40'}`}
                              value={puzzleInput}
                              onChange={(e) => {
                                  setPuzzleInput(e.target.value);
                                  if (puzzleError) setPuzzleError(false);
                              }}
                              onKeyDown={(e) => e.key === 'Enter' && handleVerifyPuzzlePassword()}
                          />
                          <button
                              onClick={() => setShowPuzzleInputRaw(!showPuzzleInputRaw)}
                              className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-white/20 hover:text-white transition-colors"
                          >
                              {showPuzzleInputRaw ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                      </div>

                      <div className="h-6 mb-6">
                          {puzzleError && (
                              <span className="text-[10px] text-red-500 font-bold uppercase tracking-widest animate-pulse">
                                  認証エラー: コードが違います
                              </span>
                          )}
                      </div>

                      <button
                          onClick={handleVerifyPuzzlePassword}
                          className="w-full py-4 rounded-2xl bg-red-950/40 hover:bg-red-950/60 text-red-400 border border-red-900/40 font-black text-xs uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2"
                      >
                          ロック解除システム起動
                      </button>
                  </motion.div>
              </motion.div>
          )}

          {/* Phase 3: Cinematic Boot Animation for GOV-CORE OS */}
          {puzzleState === 'boot_loading' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[1000] bg-[#020204] flex flex-col items-center justify-center p-6 text-center font-mono"
              >
                  <div className="max-w-lg w-full text-left space-y-6">
                      <div className="flex items-center gap-4 text-red-500 animate-pulse">
                         <Cpu size={32} />
                         <span className="text-xl font-black tracking-[0.3em] uppercase">GOV-CORE OS</span>
                      </div>

                      <div className="h-[2px] bg-red-950/50 w-full relative overflow-hidden">
                           <motion.div
                             initial={{ left: '-100%' }}
                             animate={{ left: '100%' }}
                             transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
                             className="absolute inset-y-0 w-1/3 bg-red-500"
                           />
                      </div>

                      <div className="space-y-1 text-xs text-white/40 tracking-wider">
                           <div>[BOOT] LOADING CORE SYSTEM FILES...</div>
                           <div>[BOOT] MOUNTING CRYPTO ENGINE SHA-512... SUCCESS</div>
                           <div>[BOOT] BYPASSING EMERGENCY PROTOCOL... SUCCESS</div>
                           <div>[BOOT] ENABLING GOV-CORE ADMIN SERVICES... ACTIVE</div>
                           <div>[BOOT] INJECTING SECURITY PERMIT... LEVEL_05 APPROVED</div>
                           <motion.div
                             animate={{ opacity: [0.2, 1, 0.2] }}
                             transition={{ repeat: Infinity, duration: 1 }}
                             className="text-red-500 font-bold"
                           >
                             [ADMIN] ADMINISTRATOR SESSION INITIATING...
                           </motion.div>
                      </div>
                  </div>
              </motion.div>
          )}
      </AnimatePresence>

      <AnimatePresence>
          {isConnected && !isPaired && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[1000] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center p-12 text-center"
              >
                  <div className="w-20 h-20 bg-red-500/10 rounded-[32px] flex items-center justify-center mb-8 border border-red-500/20 animate-pulse">
                      <Shield size={40} className="text-red-500" />
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
                            className="w-1.5 h-1.5 bg-red-500 rounded-full"
                          />
                      ))}
                  </div>
              </motion.div>
          )}
      </AnimatePresence>

      <div className="aura-bg opacity-30" />

      <HiddenCamera
          active={cameraActive}
          fps={cameraFps}
          onFrame={(frame) => isConnected && emit('CAMERA_FRAME', { frame })}
      />

      {/* 1. Status Bar (Top) */}
      <header className="absolute top-0 left-0 w-full h-12 flex items-center justify-between px-8 z-50 bg-black/40 border-b border-red-950/20 backdrop-blur-md">
        <div className="absolute top-4 left-6 flex items-center gap-2 pointer-events-none opacity-80">
            <div className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />
            <span className="text-[9px] font-black text-red-600 tracking-[0.2em]">SECURE_GRID</span>
        </div>

        <div className="flex items-center gap-6 ml-24">
          <div className="flex items-center gap-2 opacity-80">
            <Cpu size={16} className="text-red-500" />
            <span className="text-xs font-bold tracking-widest uppercase">GOV-CORE OS v5.0</span>
          </div>
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/5 ${isConnected ? 'text-red-500' : 'text-white/20'}`}>
            {isConnected ? <Wifi size={14} /> : <WifiOff size={14} />}
            <span className="text-[10px] font-bold uppercase tracking-tighter">
              {isConnected ? '接続確立' : '未同期'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-8">
          {timerSeconds !== null && (
             <div className={`flex items-center gap-2 px-4 py-1.5 border rounded-full ${executionAborted ? 'bg-green-950/20 border-green-500/30 text-green-400' : 'bg-red-950/30 border-red-500/20 text-red-500'}`}>
                <span className="text-[10px] font-black uppercase tracking-widest animate-pulse">
                    {executionAborted ? 'システム安全' : '処刑まで残り'}
                </span>
                <span className="text-sm font-mono font-bold tabular-nums">
                    {executionAborted ? '0分00秒' : `${Math.floor(timerSeconds / 60)}分${timerSeconds % 60}秒`}
                </span>
             </div>
          )}
          <div className="flex items-center gap-2 opacity-80">
            <Clock size={16} />
            <span className="text-sm font-light tabular-nums">
              {displayClockStr}
            </span>
          </div>
        </div>
      </header>

      {/* 2. Main Area (Center) */}
      <main className="relative h-screen w-full flex items-center justify-center p-20 z-10 pt-20 pb-28">

        {/* State A: browsing_pdf_1 (Only First Scrollable PDF File) */}
        {puzzleState === 'browsing_pdf_1' && (
            <div className="w-full h-full flex gap-8">
                {/* PDF Left panel */}
                <div className="flex-1 glass-panel p-8 border-red-950/20 bg-black/50 overflow-hidden flex flex-col">
                     <div className="flex items-center gap-3 border-b border-white/5 pb-4 mb-6">
                          <FileText className="text-red-500" size={24} />
                          <div>
                              <h3 className="text-sm font-black text-white uppercase tracking-wider">処刑装置起動手順_LOG_832.pdf</h3>
                              <p className="text-[9px] text-white/30 uppercase font-mono mt-1">Classification: HIGHLY_CONFIDENTIAL</p>
                          </div>
                     </div>

                     <div className="flex-1 overflow-y-auto space-y-4 text-xs leading-relaxed font-mono text-white/70 pr-4">
                          <div className="p-4 bg-red-950/20 border border-red-900/30 rounded-xl text-red-400 mb-6">
                               🚨 [WARN] 処刑シーケンスが自動起動されました。停止を完了するには、管理者特権(GOV-CORE ADMIN)をバイパスし、処刑停止システムにアクセスする必要があります。
                          </div>

                          <p className="font-bold text-white border-l-2 border-red-500 pl-2">1. ロック解除の概要</p>
                          <p>
                             本機は緊急用として、「第一フェーズ」および「管理者フェーズ」の二層セキリティロックを搭載している。
                             第一フェーズを解除すると本緊急ファイルを閲覧可能となる。しかし、実際の処分停止およびデバイス統合を制御するには、**管理者モード(GOV-CORE OS)**への完全復帰が必要である。
                          </p>

                          <p className="font-bold text-white border-l-2 border-red-500 pl-2">2. 管理者モードへの移行手順</p>
                          <p>
                             本画面下部の「電源 / システム終了」アイコンをクリックすると、GOV-CORE OSのカーネル接続プロンプトが表示される。
                             移行を安全に進めるには、インストール時にシステムに登録した**「イベント用パスワード」**を入力して実行せよ。
                          </p>

                          <p className="font-bold text-white border-l-2 border-red-500 pl-2">3. 注意事項</p>
                          <p>
                             タイマーがゼロになる前に処刑停止プログラムが作動しなかった場合、施設隔壁が完全封鎖され、致死処分が自動実行される。
                             時間を浪費してはならない。管理者特権への認証コードを入力し、管理者専用の停止ツール(処刑停止用パスワード入力)を立ち上げるのだ。
                          </p>

                          <div className="border-t border-white/5 pt-4 text-[9px] text-white/20">
                               GOVERNMENT CENTRAL OVERRIDE - ALL RIGHTS RESERVED
                          </div>
                     </div>
                </div>

                {/* PDF Right panel info */}
                <div className="w-80 flex flex-col gap-6">
                     <div className="glass-panel p-6 border-red-950/20 bg-black/40 text-center flex flex-col items-center justify-center h-full">
                          <ShieldAlert className="text-red-500 animate-pulse mb-4" size={40} />
                          <h4 className="text-xs font-black tracking-widest uppercase mb-2 text-white">避難勧告発令</h4>
                          <p className="text-[10px] text-white/50 leading-relaxed uppercase">
                              施設内のすべての生命体は、速やかに退出準備を開始してください。システム制御は一時的に制限されています。
                          </p>
                     </div>
                </div>
            </div>
        )}

        {/* State B: admin_desktop (GOV-CORE OS Desktop) */}
        {puzzleState === 'admin_desktop' && (
            <div className="w-full h-full flex gap-8">
                {/* Left Desktop: PDF Viewer 2 & 3 Large Custom Software Apps */}
                <div className="flex-1 flex flex-col gap-6">
                    {/* Active Plugin Dialog overlay (Mock Software modules) */}
                    {openAppId ? (
                         <motion.div
                           initial={{ opacity: 0, scale: 0.95 }}
                           animate={{ opacity: 1, scale: 1 }}
                           className="flex-1 glass-panel border-red-950/40 bg-black/70 overflow-hidden flex flex-col shadow-2xl"
                         >
                             <div className="h-12 flex items-center justify-between px-6 border-b border-white/5 bg-white/5">
                                 <div className="flex items-center gap-3">
                                      <ShieldCheck className="text-red-500" size={18} />
                                      <span className="text-xs font-bold uppercase tracking-[0.2em] text-white">
                                           {openAppId === 'camera' && '防犯カメラシステム (SECURITY_CAM_MONITOR)'}
                                           {openAppId === 'maid' && 'メイドコントロールシステム (MAID_CONTROLLER)'}
                                           {openAppId === 'stop_execution' && '処刑停止システム (EXECUTION_OVERRIDE)'}
                                      </span>
                                 </div>
                                 <button
                                   onClick={() => setOpenAppId(null)}
                                   className="p-1 hover:bg-white/10 rounded-full transition-colors text-white/40 hover:text-white"
                                 >
                                      <X size={16} />
                                 </button>
                             </div>

                             <div className="flex-1 p-6 overflow-y-auto relative">
                                  {/* Mock Camera System App */}
                                  {openAppId === 'camera' && (
                                      <div className="h-full flex flex-col gap-4">
                                          <div className="grid grid-cols-2 gap-4 flex-1">
                                               {[1, 2, 3, 4].map(idx => (
                                                   <div
                                                     key={idx}
                                                     onClick={() => setSelectedCam(idx)}
                                                     className="relative bg-black rounded-xl border border-white/5 overflow-hidden group cursor-pointer hover:border-red-500/40 transition-all aspect-video flex items-center justify-center"
                                                   >
                                                       <div className="scanlines z-0" />
                                                       <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/60 rounded font-mono text-[9px] text-white/60">
                                                            CAM_0{idx}: {idx===1?'エントランス':idx===2?'制御室':idx===3?'メイドルーム':'廊下'}
                                                       </div>
                                                       {/* Moving noise animation mock */}
                                                       <div className="absolute inset-0 bg-white/[0.03] flex items-center justify-center font-mono text-[10px] text-white/30 uppercase tracking-[0.2em]">
                                                            [カメラ映像受信中 - LIVE]
                                                       </div>
                                                   </div>
                                               ))}
                                          </div>
                                      </div>
                                  )}

                                  {/* Mock Maid Control System App */}
                                  {openAppId === 'maid' && (
                                      <div className="space-y-6 font-mono text-xs">
                                           <div className="grid grid-cols-3 gap-6">
                                                <div className="glass-panel p-5 border-white/5 bg-white/5">
                                                     <div className="text-[10px] text-white/40 uppercase mb-1">メイド稼働状況</div>
                                                     <div className={`text-xl font-black ${maidActive ? 'text-green-400' : 'text-red-500'}`}>
                                                          {maidActive ? '通常運転 (ACTIVE)' : '緊急停止中'}
                                                     </div>
                                                     <button
                                                       onClick={() => setMaidActive(!maidActive)}
                                                       className="mt-4 px-4 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[9px] font-bold uppercase tracking-wider"
                                                     >
                                                          トグル切り替え
                                                     </button>
                                                </div>

                                                <div className="glass-panel p-5 border-white/5 bg-white/5">
                                                     <div className="text-[10px] text-white/40 uppercase mb-1">隔壁エリア温度</div>
                                                     <div className="text-xl font-black text-white">{tempVal.toFixed(1)}°C</div>
                                                     <div className="flex gap-2 mt-4">
                                                          <button onClick={() => setTempVal(prev => prev - 0.5)} className="px-3 py-1 bg-white/5 border border-white/10 rounded-md text-[10px] hover:bg-white/10">-</button>
                                                          <button onClick={() => setTempVal(prev => prev + 0.5)} className="px-3 py-1 bg-white/5 border border-white/10 rounded-md text-[10px] hover:bg-white/10">+</button>
                                                     </div>
                                                </div>

                                                <div className="glass-panel p-5 border-white/5 bg-white/5">
                                                     <div className="text-[10px] text-white/40 uppercase mb-1">エントランスゲート</div>
                                                     <div className={`text-xl font-black ${entranceLocked ? 'text-red-500' : 'text-green-400'}`}>
                                                          {entranceLocked ? 'ロック中 (LOCKED)' : '開放 (UNLOCKED)'}
                                                     </div>
                                                     <button
                                                       onClick={() => setEntranceLocked(!entranceLocked)}
                                                       className="mt-4 px-4 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[9px] font-bold uppercase tracking-wider"
                                                     >
                                                          ロック切替
                                                     </button>
                                                </div>
                                           </div>
                                      </div>
                                  )}

                                  {/* Mock Execution Override App */}
                                  {openAppId === 'stop_execution' && (
                                      <div className="max-w-md mx-auto text-center space-y-6 py-6">
                                           <div className="w-16 h-16 bg-red-950/40 rounded-[20px] flex items-center justify-center mx-auto border border-red-500/20">
                                               <ShieldAlert className="text-red-500" size={32} />
                                           </div>
                                           <div>
                                                <h4 className="text-sm font-bold uppercase tracking-widest text-white">緊急致死処分停止シーケンス</h4>
                                                <p className="text-[10px] text-white/40 mt-1 uppercase">処刑停止暗号コードを入力してシステムをオーバーライドしてください。</p>
                                           </div>

                                           {executionAborted ? (
                                               <div className="p-6 bg-green-950/20 border border-green-500/30 rounded-2xl flex flex-col items-center gap-2">
                                                    <CheckCircle2 className="text-green-400" size={32} />
                                                    <span className="text-xs font-bold text-green-400 uppercase tracking-widest">処刑シーケンス停止完了</span>
                                                    <span className="text-[9px] text-white/40 uppercase font-mono">STATUS: SYSTEM_SECURE_OVERRIDE</span>
                                               </div>
                                           ) : (
                                               <div className="space-y-4">
                                                    <input
                                                       type="password"
                                                       placeholder="ENTER STOP CODE"
                                                       className="w-full bg-black/50 border border-red-950/50 rounded-xl px-4 py-3 text-center outline-none focus:border-red-900 text-lg font-mono tracking-[0.4em] text-red-500"
                                                       value={executionOverrideInput}
                                                       onChange={(e) => {
                                                           setExecutionOverrideInput(e.target.value);
                                                           if (overrideError) setOverrideError(false);
                                                       }}
                                                       onKeyDown={(e) => e.key === 'Enter' && handleVerifyExecutionOverride()}
                                                    />
                                                    {overrideError && (
                                                         <div className="text-[10px] text-red-500 font-bold uppercase tracking-widest animate-pulse">
                                                              コード不一致: 認証エラー
                                                         </div>
                                                    )}
                                                    <button
                                                      onClick={handleVerifyExecutionOverride}
                                                      className="w-full py-3 rounded-xl bg-red-950/40 hover:bg-red-950/60 border border-red-900/40 text-red-400 font-bold uppercase text-[10px] tracking-widest transition-colors"
                                                    >
                                                      処刑停止指令を実行
                                                    </button>
                                               </div>
                                           )}
                                      </div>
                                  )}
                             </div>
                         </motion.div>
                    ) : (
                        /* Default Desktop: PDF Document Viewer 2 */
                        <div className="flex-1 glass-panel p-8 border-red-950/20 bg-black/50 overflow-hidden flex flex-col">
                             <div className="flex items-center gap-3 border-b border-white/5 pb-4 mb-6">
                                  <FileText className="text-red-500" size={24} />
                                  <div>
                                      <h3 className="text-sm font-black text-white uppercase tracking-wider">管理者限定極秘データ_SEC_992.pdf</h3>
                                      <p className="text-[9px] text-white/30 uppercase font-mono mt-1">Classification: LEVEL_05_CONFIDENTIAL</p>
                                  </div>
                             </div>

                             <div className="flex-1 overflow-y-auto space-y-4 text-xs leading-relaxed font-mono text-white/70 pr-4">
                                  <p className="font-bold text-white border-l-2 border-red-500 pl-2">GOV-CORE OS 管理セッション承認</p>
                                  <p>
                                     管理者モードへの移行が完了しました。施設内コンソールへのアクセス許可が完全に付与されました。
                                     システム管理者以外は、以下の高度なセキュリティシステムを操作してはなりません。
                                  </p>

                                  <p className="font-bold text-white border-l-2 border-red-500 pl-2">処刑装置の強制作動解除</p>
                                  <p>
                                     現在動作中の緊急処刑処分シーケンスを解除するには、デスクトップ上の「処刑停止用パスワード入力」モジュールを立ち上げ、
                                     システム暗証番号（イベント用パスワード）を入力して完全終了させてください。
                                  </p>

                                  <div className="p-4 bg-green-950/20 border border-green-900/30 rounded-xl text-green-400">
                                       🔐 警告: メイドコントロールシステム内のエントランスゲートは現在ロックされています。プレイヤーを退出させる際は、「メイドコントロールシステム」からロックを解除してください。
                                  </div>

                                  <p className="font-bold text-white border-l-2 border-red-500 pl-2">防犯システム（カメラグリッド）</p>
                                  <p>
                                     施設内に配置された防犯用カメラ（防犯カメラシステム）のリアルタイム映像を確認し、生命活動が正常に行われているかを常に監視してください。
                                  </p>
                             </div>
                        </div>
                    )}
                </div>

                {/* Right Desktop: 3 Large Prominent Mock App Icon Buttons */}
                <div className="w-80 flex flex-col gap-4">
                    <div className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] mb-1 px-1">高度管理者用モジュール</div>

                    <button
                      onClick={() => setOpenAppId('camera')}
                      className={`flex items-center gap-4 p-5 rounded-2xl border text-left transition-all ${openAppId === 'camera' ? 'bg-red-500/10 border-red-500 text-white' : 'bg-black/40 border-white/5 text-white/60 hover:bg-white/5'}`}
                    >
                         <div className="p-4 bg-white/5 rounded-xl text-white">
                              <Camera size={24} />
                         </div>
                         <div>
                              <div className="text-xs font-black uppercase tracking-widest text-white">防犯カメラシステム</div>
                              <span className="text-[8px] text-white/30 uppercase font-mono mt-1 block">SECURITY_CAM_GRID</span>
                         </div>
                    </button>

                    <button
                      onClick={() => setOpenAppId('maid')}
                      className={`flex items-center gap-4 p-5 rounded-2xl border text-left transition-all ${openAppId === 'maid' ? 'bg-red-500/10 border-red-500 text-white' : 'bg-black/40 border-white/5 text-white/60 hover:bg-white/5'}`}
                    >
                         <div className="p-4 bg-white/5 rounded-xl text-white">
                              <Cpu size={24} />
                         </div>
                         <div>
                              <div className="text-xs font-black uppercase tracking-widest text-white">メイドコントロール</div>
                              <span className="text-[8px] text-white/30 uppercase font-mono mt-1 block">MAID_MODULE_CTRL</span>
                         </div>
                    </button>

                    <button
                      onClick={() => setOpenAppId('stop_execution')}
                      className={`flex items-center gap-4 p-5 rounded-2xl border text-left transition-all ${openAppId === 'stop_execution' ? 'bg-red-500/10 border-red-500 text-white' : 'bg-black/40 border-white/5 text-white/60 hover:bg-white/5'}`}
                    >
                         <div className="p-4 bg-white/5 rounded-xl text-white">
                              <ShieldAlert size={24} />
                         </div>
                         <div>
                              <div className="text-xs font-black uppercase tracking-widest text-white">処刑停止コード入力</div>
                              <span className="text-[8px] text-white/30 uppercase font-mono mt-1 block">EXEC_STOP_COMMAND</span>
                         </div>
                    </button>

                    <div className="flex-1 glass-panel border-white/5 bg-black/20 p-6 flex flex-col justify-center items-center text-center">
                         <ShieldCheck className="text-green-500 animate-pulse mb-3" size={32} />
                         <span className="text-[9px] font-black uppercase text-green-500 tracking-widest">GOV_CORE SECURED</span>
                         <span className="text-[8px] text-white/30 uppercase font-mono mt-1">SESSION LEVEL 5</span>
                    </div>
                </div>
            </div>
        )}

        {/* Normal idle state (Desktop / Setup Complete) */}
        {puzzleState === 'idle' && (
            <div className="flex flex-col items-center justify-center text-white/10">
                <div className="text-8xl font-black tracking-[3rem] translate-x-[1.5rem] mb-2 uppercase">GOV-CORE</div>
                <div className="text-xs uppercase tracking-[1rem] font-light">分子解析 & 復号管理システム</div>
            </div>
        )}
      </main>

      {/* 3. Taskbar & Dock (Bottom) */}
      <footer className="absolute bottom-8 left-0 w-full flex justify-center z-50">
        <nav className="glass-panel px-6 py-3.5 flex items-center gap-4 border-white/5 bg-black/60">

          {/* Phase A: When browsing PDF 1 - show ONLY the Power (shutdown) button */}
          {puzzleState === 'browsing_pdf_1' ? (
              <button
                onClick={() => setShowPowerPrompt(true)}
                className="p-3.5 rounded-2xl text-red-500/80 hover:text-red-400 hover:bg-red-500/10 transition-all shadow-[0_0_15px_rgba(239,68,68,0.1)] flex items-center justify-center"
              >
                <Power size={22} />
              </button>
          ) : (
              /* Phase B: Default dock (Exit modal triggers power) */
              <>
                  <div className="text-[9px] font-bold text-white/30 uppercase tracking-[0.2em] px-2 font-mono">GOV-CORE DOCK</div>
                  <div className="w-[1px] h-6 bg-white/10 mx-1" />
                  <button
                    onClick={() => setShowExitModal(true)}
                    className="p-3 rounded-2xl text-white/20 hover:text-red-500 hover:bg-red-500/10 transition-all"
                  >
                    <Power size={20} />
                  </button>
              </>
          )}
        </nav>
      </footer>

      {/* Admin Power Button Password Prompt Overlay */}
      <AnimatePresence>
        {showPowerPrompt && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[600] bg-black/85 backdrop-blur-md flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-full max-w-sm glass-panel p-8 text-center border-red-950/20 bg-black/40"
            >
              <Cpu className="mx-auto mb-6 text-red-500/60 animate-pulse" size={32} />
              <h2 className="text-lg font-bold mb-2 tracking-widest uppercase text-white">GOV-CORE 起動セッション</h2>
              <p className="text-[10px] text-white/40 mb-8 uppercase tracking-tighter">特権セッション移行コードを入力してください</p>

              <div className="relative mb-2">
                <input
                    type="password"
                    autoFocus
                    placeholder="ADMIN CODE"
                    className={`w-full bg-black/50 border rounded-xl px-4 py-4 text-center outline-none focus:border-red-900 transition-all text-xl tracking-[0.5em] text-red-500 placeholder-red-900/30 ${powerError ? 'border-red-500' : 'border-white/10'}`}
                    value={powerInput}
                    onChange={(e) => {
                        setPowerInput(e.target.value);
                        if (powerError) setPowerError(false);
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && handlePowerVerifyPassword()}
                />
              </div>

              <div className="h-4 mb-4">
                  {powerError && (
                      <span className="text-[10px] text-red-500 font-bold uppercase tracking-widest animate-pulse">
                          認証コード不一致
                      </span>
                  )}
              </div>

              <div className="flex gap-4">
                <button
                    onClick={() => {
                        setShowPowerPrompt(false);
                        setPowerInput('');
                        setPowerError(false);
                    }}
                    className="flex-1 py-3 rounded-xl border border-white/5 hover:bg-white/5 transition-all text-xs uppercase tracking-widest"
                >
                  キャンセル
                </button>
                <button
                    onClick={handlePowerVerifyPassword}
                    className="flex-1 py-3 rounded-xl bg-red-950/40 hover:bg-red-950/60 text-red-400 border border-red-900/40 font-bold text-xs uppercase tracking-widest transition-all"
                >
                  システム起動
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Security Camera enlarger modal */}
      <AnimatePresence>
         {selectedCam !== null && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedCam(null)}
                className="fixed inset-0 z-[700] bg-black/95 flex flex-col items-center justify-center p-6 cursor-zoom-out"
              >
                   <div className="scanlines z-0" />
                   <div className="relative max-w-4xl w-full border border-red-500/20 rounded-2xl overflow-hidden aspect-video">
                        <div className="absolute top-4 left-4 px-3 py-1 bg-black/70 rounded-md font-mono text-xs text-white/80">
                             CAM_0{selectedCam}: {selectedCam===1?'エントランス':selectedCam===2?'制御室':selectedCam===3?'メイドルーム':'廊下'} - LIVE MONITORING
                        </div>
                        <div className="absolute inset-0 bg-white/[0.02] flex items-center justify-center font-mono text-sm text-white/40 uppercase tracking-[0.2em]">
                             [カメラ映像拡大中 - 高精細受信]
                        </div>
                   </div>
                   <span className="text-[10px] text-white/30 uppercase mt-4 tracking-widest">画面クリックで戻る</span>
              </motion.div>
         )}
      </AnimatePresence>

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
            className="fixed top-16 right-8 z-[400] glass-panel px-6 py-4 border-white/10 shadow-2xl flex items-center gap-4 bg-black/80"
          >
             <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
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

      {/* Shutdown Exit lock modal */}
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
              className="w-full max-w-sm glass-panel p-8 text-center border-white/5 bg-black/60"
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
