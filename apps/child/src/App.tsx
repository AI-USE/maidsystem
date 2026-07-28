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
  AlertCircle,
  Loader2
} from 'lucide-react';
import { Setup } from './components/Setup';
import { OSContext, OSContextType } from './hooks/useOS';
import { HiddenCamera } from './components/HiddenCamera';
import { useRemoteControl } from './hooks/useRemoteControl';
import maidItemsData from './plugins/maid_items.json';
import puzzleAnswersData from './plugins/puzzle_answers.json';

// Web Audio API Synthesizer for high-fidelity sci-fi SFX and loopable ambient BGM
const synthContextRef: { current: AudioContext | null } = { current: null };
const bgmOscillatorRef: { current: OscillatorNode | null } = { current: null };
const bgmAudioRef: { current: HTMLAudioElement | null } = { current: null };

const playSynthSound = (type: 'tap' | 'type' | 'open' | 'success' | 'bgm') => {
  try {
     if (!synthContextRef.current) {
         synthContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
     }
     const ctx = synthContextRef.current;
     if (ctx.state === 'suspended') {
         ctx.resume();
     }

     if (type === 'tap') {
         const osc = ctx.createOscillator();
         const gain = ctx.createGain();
         osc.type = 'sine';
         osc.frequency.setValueAtTime(1000, ctx.currentTime);
         osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.05);
         gain.gain.setValueAtTime(0.08, ctx.currentTime);
         gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
         osc.connect(gain);
         gain.connect(ctx.destination);
         osc.start();
         osc.stop(ctx.currentTime + 0.05);
     } else if (type === 'type') {
         const osc = ctx.createOscillator();
         const gain = ctx.createGain();
         osc.type = 'triangle';
         osc.frequency.setValueAtTime(180, ctx.currentTime);
         gain.gain.setValueAtTime(0.15, ctx.currentTime);
         gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.03);
         osc.connect(gain);
         gain.connect(ctx.destination);
         osc.start();
         osc.stop(ctx.currentTime + 0.03);
     } else if (type === 'open') {
         const osc = ctx.createOscillator();
         const gain = ctx.createGain();
         osc.type = 'sawtooth';
         osc.frequency.setValueAtTime(200, ctx.currentTime);
         osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.3);
         gain.gain.setValueAtTime(0.05, ctx.currentTime);
         gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
         osc.connect(gain);
         gain.connect(ctx.destination);
         osc.start();
         osc.stop(ctx.currentTime + 0.3);
     } else if (type === 'success') {
         // Dual chime harmony
         [523.25, 659.25].forEach((freq, idx) => {
             const osc = ctx.createOscillator();
             const gain = ctx.createGain();
             osc.type = 'sine';
             osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.1);
             gain.gain.setValueAtTime(0.12, ctx.currentTime + idx * 0.1);
             gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.1 + 0.5);
             osc.connect(gain);
             gain.connect(ctx.destination);
             osc.start(ctx.currentTime + idx * 0.1);
             osc.stop(ctx.currentTime + idx * 0.1 + 0.5);
         });
     } else if (type === 'bgm') {
         if (bgmAudioRef.current || bgmOscillatorRef.current) return; // Already running

         const volumeValue = parseFloat(localStorage.getItem('bgmVolume') || '50') / 100;
         const audio = new Audio('bgm.mp3');
         audio.loop = true;
         audio.volume = volumeValue;
         bgmAudioRef.current = audio;

         audio.play()
           .then(() => {
               console.log("Successfully started real MP3 background music in infinite loop.");
           })
           .catch(err => {
               console.warn("Could not play bgm.mp3, falling back to synthesized deep hum BGM:", err);
               bgmAudioRef.current = null;

               if (!bgmOscillatorRef.current) {
                   const osc = ctx.createOscillator();
                   const filter = ctx.createBiquadFilter();
                   const gain = ctx.createGain();

                   osc.type = 'sine';
                   osc.frequency.setValueAtTime(55, ctx.currentTime); // Low deep drone G1/A1 hum

                   // Subtle frequency modulation
                   osc.frequency.linearRampToValueAtTime(56, ctx.currentTime + 2);
                   osc.frequency.linearRampToValueAtTime(55, ctx.currentTime + 4);

                   filter.type = 'lowpass';
                   filter.frequency.value = 150;

                   gain.gain.setValueAtTime(0.35 * volumeValue, ctx.currentTime);

                   osc.connect(filter);
                   filter.connect(gain);
                   gain.connect(ctx.destination);

                   osc.start();
                   bgmOscillatorRef.current = osc;
               }
           });
     }
  } catch (e) {
     console.error("Synth Sound Error:", e);
  }
};

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
  // 'retired': Emergency Retired State
  const [puzzleState, setPuzzleState] = useState<'idle' | 'locked' | 'browsing_pdf_1' | 'boot_loading' | 'admin_desktop' | 'retired'>('idle');
  const [puzzleInput, setPuzzleInput] = useState('');
  const [showPuzzleInputRaw, setShowPuzzleInputRaw] = useState(false);
  const [puzzleError, setPuzzleError] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const pauseAnnouncementIntervalRef = useRef<any>(null);

  const [showRetireConfirm, setShowRetireConfirm] = useState(false);

  // Admin Desktop Floating PDF 2 Window State
  const [adminPdfOpen, setAdminPdfOpen] = useState(false);

  // Fullscreen unskippable video state
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoType, setVideoType] = useState<'start' | 'admin' | 'correct' | 'close' | 'failed' | 'commentary' | 'none'>('none');

  // Admin Power Button Password Prompt State (using pass_admin)
  const [showPowerPrompt, setShowPowerPrompt] = useState(false);
  const [powerInput, setPowerInput] = useState('');
  const [powerError, setPowerError] = useState(false);

  // Admin Mock Application Windows Open States
  const [openAppId, setOpenAppId] = useState<string | null>(null);

  // Security Camera Active Channel (1 or 2)
  const [activeCamChannel, setActiveCamChannel] = useState<number>(1);
  const cam1VideoRef = useRef<HTMLVideoElement>(null);
  const cam2VideoRef = useRef<HTMLVideoElement>(null);

  // Maid controls state
  const [maidRoomInput, setMaidRoomInput] = useState('');
  const [maidItemInput, setMaidItemInput] = useState('');
  const [maidDeliveryState, setMaidDeliveryState] = useState<'idle' | 'testing' | 'delivering' | 'error'>('idle');
  const [maidDeliveryError, setMaidDeliveryError] = useState('');
  const [maidTimer, setMaidTimer] = useState(0);
  const [deliveredItemCodes, setDeliveredItems] = useState<string[]>([]);

  // Results & Post-Commentary State
  const [gameResult, setGameResult] = useState<'none' | 'correct' | 'close' | 'failed'>('none');
  const [postCommentaryScreen, setPostCommentaryScreen] = useState<'none' | 'success' | 'failed'>('none');

  useEffect(() => {
    let interval: any;
    if (maidTimer > 0) {
      interval = setInterval(() => {
        setMaidTimer(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [maidTimer]);

  // Execution stop state mock (Only allowed <= 20s, exactly 1 attempt)
  const [executionOverrideInput, setExecutionOverrideInput] = useState('');
  const [executionAborted, setExecutionAborted] = useState(false);
  const [overrideError, setOverrideError] = useState(false);
  const [overrideSubmitted, setOverrideSubmitted] = useState(false);
  const [overrideText, setOverrideText] = useState('');

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

  // Global click & keydown listeners for automatic high-fidelity Tap & Type sound effects and BGM bootstrap
  useEffect(() => {
    const handleGlobalClick = () => {
         const shouldPlayBgm =
           puzzleState !== 'retired' &&
           !videoPlaying &&
           !isPaused &&
           timerSeconds !== 0;

         if (shouldPlayBgm) {
             playSynthSound('bgm');
         }
         playSynthSound('tap');
    };
    const handleGlobalKeydown = (e: KeyboardEvent) => {
         // If typing in any input/textarea, play mechanical key ticks
         const tag = document.activeElement?.tagName.toLowerCase();
         if (tag === 'input' || tag === 'textarea') {
              playSynthSound('type');
         }
    };
    window.addEventListener('click', handleGlobalClick);
    window.addEventListener('keydown', handleGlobalKeydown);
    return () => {
         window.removeEventListener('click', handleGlobalClick);
         window.removeEventListener('keydown', handleGlobalKeydown);
    };
  }, [puzzleState, videoPlaying, timerSeconds, isPaused]);

  // Automatic background music (BGM) playback lifecycle control
  useEffect(() => {
    if (postCommentaryScreen !== 'none') {
      if (bgmAudioRef.current) {
          bgmAudioRef.current.pause();
      }
      if (bgmOscillatorRef.current) {
          try { bgmOscillatorRef.current.stop(); } catch(e){}
          bgmOscillatorRef.current = null;
      }

      const playExitBgm = () => {
         const volumeValue = parseFloat(localStorage.getItem('bgmVolume') || '50') / 100;
         const audio = new Audio('bgm_exit.mp3');
         audio.loop = true;
         audio.volume = volumeValue;
         bgmAudioRef.current = audio;
         audio.play().catch(err => {
             console.warn("Could not play bgm_exit.mp3, falling back to synthesized exit drone:", err);
             bgmAudioRef.current = null;
             try {
                 if (!synthContextRef.current) {
                     synthContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
                 }
                 const ctx = synthContextRef.current;
                 const osc1 = ctx.createOscillator();
                 const osc2 = ctx.createOscillator();
                 const gain = ctx.createGain();
                 osc1.type = 'sine';
                 osc1.frequency.setValueAtTime(130.81, ctx.currentTime); // C3
                 osc2.type = 'sine';
                 osc2.frequency.setValueAtTime(164.81, ctx.currentTime); // E3
                 gain.gain.setValueAtTime(0.25 * volumeValue, ctx.currentTime);
                 osc1.connect(gain);
                 osc2.connect(gain);
                 gain.connect(ctx.destination);
                 osc1.start();
                 osc2.start();
                 bgmOscillatorRef.current = osc1;
             } catch(e){}
         });
      };
      playExitBgm();
      return;
    }

    const shouldPlayBgm =
      puzzleState !== 'retired' &&
      !videoPlaying &&
      !isPaused &&
      timerSeconds !== 0;

    if (shouldPlayBgm) {
      if (bgmAudioRef.current) {
          bgmAudioRef.current.play().catch(e => console.log("BGM play catch:", e));
      } else {
          playSynthSound('bgm');
      }
    } else {
      if (bgmAudioRef.current) {
          bgmAudioRef.current.pause();
      }
      if (bgmOscillatorRef.current) {
          try {
              bgmOscillatorRef.current.stop();
          } catch(e){}
          bgmOscillatorRef.current = null;
      }
    }
  }, [puzzleState, videoPlaying, timerSeconds, isPaused, postCommentaryScreen]);

  // Handle repeating TTS for pause state
  useEffect(() => {
    if (isPaused) {
      const speakAnnouncementLocal = (text: string) => {
        if ('speechSynthesis' in window) {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.lang = 'ja-JP';
          utterance.rate = 1.0;
          window.speechSynthesis.speak(utterance);
        }
      };

      speakAnnouncementLocal("現在ゲーム停止中");
      pauseAnnouncementIntervalRef.current = setInterval(() => {
         speakAnnouncementLocal("現在ゲーム停止中");
      }, 5000);
    } else {
      if (pauseAnnouncementIntervalRef.current) {
        clearInterval(pauseAnnouncementIntervalRef.current);
        pauseAnnouncementIntervalRef.current = null;
      }
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    }
    return () => {
      if (pauseAnnouncementIntervalRef.current) {
        clearInterval(pauseAnnouncementIntervalRef.current);
      }
    };
  }, [isPaused]);

  // Master Clock & Override increment
  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
      setTimeOverride(prev => {
        if (!prev || isPaused) return prev;
        return new Date(prev.getTime() + 1000);
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isPaused]);

  // Delay unskippable video 3 seconds after booting into Admin Desktop
  useEffect(() => {
    if (puzzleState === 'admin_desktop') {
      playSynthSound('open');
      setAdminPdfOpen(true);
      const videoTimeout = setTimeout(() => {
        setVideoPlaying(true);
        setVideoProgress(0);
        setVideoType('admin');
      }, 3000);

      return () => clearTimeout(videoTimeout);
    }
  }, [puzzleState]);

  // Handle mock video playback progress and automatic dismissal (when videoPlaying)
  useEffect(() => {
    let interval: any;
    if (videoPlaying) {
      interval = setInterval(() => {
        setVideoProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            setVideoPlaying(false);
            if (videoType === 'start') {
              setPuzzleState('locked');
            }
            if (videoType === 'commentary') {
              // Transition to exit lock screen
              if (gameResult === 'correct') {
                setPostCommentaryScreen('success');
              } else {
                setPostCommentaryScreen('failed');
              }
            }
            setVideoType('none');
            return 100;
          }
          return prev + 1; // 100 steps total, takes ~10 seconds at 100ms interval
        });
      }, 100);
    }
    return () => clearInterval(interval);
  }, [videoPlaying, videoType, gameResult]);

  // Execution Countdown Timer
  // Starts ticking only after preparation is complete (i.e. 'locked', 'browsing_pdf_1', or 'admin_desktop')
  useEffect(() => {
    let interval: any;
    if (timerSeconds !== null && timerSeconds > 0 && puzzleState !== 'idle' && !isPaused && !videoPlaying) {
      interval = setInterval(() => {
        setTimerSeconds(prev => {
          if (prev && prev > 1) return prev - 1;
          if (prev === 1) {
             // 7 minutes expiration: play direct unskippable video, then black out.
             setVideoPlaying(true);
             setVideoProgress(0);
             return 0;
          }
          return 0;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timerSeconds, puzzleState, isPaused, videoPlaying]);

  useEffect(() => {
    if ((window as any).electron) {
      const handleShowExit = () => {
          playSynthSound('open');
          setShowExitModal(true);
      };
      const handleMasterFound = (url: string) => {
          setMasterUrl(url);
          localStorage.setItem('masterUrl', url);
          setShowSetup(false);
      };
      const handlePasswordAction = (action: string) => {
          playSynthSound('success');
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
      const savedSetup = localStorage.getItem('pass_setup');
      if (savedExit || savedEvent || savedAdmin || savedSetup) {
          (window as any).electron.send('UPDATE_CONFIG', {
              passwords: {
                  exit: savedExit || 'MADREST104',
                  event: savedEvent || 'EVT_TRIGGER_99',
                  admin: savedAdmin || 'ADMIN_DASH',
                  setup: savedSetup || 'ADMIN_SETUP'
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
          emit('APP_STATE_CHANGED', {
              appId: openAppId || 'IDLE',
              puzzleState,
              isPaused
          });
      }
  }, [openAppId, isConnected, isPaired, puzzleState, isPaused]);

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

        // Transition to idle, then start unskippable video
        setPuzzleState('idle');
        setPuzzleInput('');
        setPuzzleError(false);
        setExecutionAborted(false);
        setIsPaused(false);
        setGameResult('none');
        setPostCommentaryScreen('none');

        // Trigger start video playback
        setVideoPlaying(true);
        setVideoProgress(0);
        setVideoType('start');
        break;
      }
      case 'MAID_DELIVERY_CLEARED': {
        const clearedItemCode = cmd.payload?.itemCode;
        if (clearedItemCode) {
          setDeliveredItems(prev => {
            if (prev.includes(clearedItemCode)) return prev;
            return [...prev, clearedItemCode];
          });
        }
        setMaidDeliveryState('idle');
        setMaidRoomInput('');
        setMaidItemInput('');
        break;
      }
      case 'PUZZLE_STOP':
        setPuzzleState('idle');
        setTimeOverride(null);
        setTimerSeconds(null);
        setIsPaused(false);
        setGameResult('none');
        setPostCommentaryScreen('none');
        break;
      case 'PUZZLE_RESTART': {
        const targetTime = new Date();
        targetTime.setHours(23, 53, 40, 0);
        setTimeOverride(targetTime);
        setTimerSeconds(420);

        // Transition to idle, then start unskippable video
        setPuzzleState('idle');
        setPuzzleInput('');
        setPuzzleError(false);
        setExecutionAborted(false);
        setOverrideSubmitted(false);
        setOverrideText('');
        setIsPaused(false);
        setGameResult('none');
        setPostCommentaryScreen('none');

        // Trigger start video playback
        setVideoPlaying(true);
        setVideoProgress(0);
        setVideoType('start');
        break;
      }
      case 'PUZZLE_PAUSE': {
        setIsPaused(true);
        break;
      }
      case 'PUZZLE_RESUME': {
        setIsPaused(false);
        break;
      }
      case 'PUZZLE_BROADCAST_VIDEO': {
        playSynthSound('open');
        setVideoPlaying(true);
        setVideoProgress(0);
        break;
      }
      case 'PUZZLE_RESULT_CORRECT': {
        playSynthSound('open');
        setVideoPlaying(true);
        setVideoProgress(0);
        setVideoType('correct');
        break;
      }
      case 'PUZZLE_RESULT_CLOSE': {
        playSynthSound('open');
        setVideoPlaying(true);
        setVideoProgress(0);
        setVideoType('close');
        break;
      }
      case 'PUZZLE_RESULT_FAILED': {
        playSynthSound('open');
        setVideoPlaying(true);
        setVideoProgress(0);
        setVideoType('failed');
        break;
      }
      case 'PUZZLE_RESULT_COMMENTARY': {
        playSynthSound('open');
        setVideoPlaying(true);
        setVideoProgress(0);
        setVideoType('commentary');
        break;
      }
      case 'PUZZLE_RETIRE': {
        setPuzzleState('retired');
        break;
      }
      case 'PUZZLE_CANCEL_RETIRE': {
        setPuzzleState('idle');
        break;
      }
    }
  };

  const handleVerifyPassword = () => {
    if ((window as any).electron) {
      (window as any).electron.send('VERIFY_PASSWORD', exitPassword);
    }
  };

  const handleVerifySetupPassword = (password: string) => {
    if ((window as any).electron) {
      (window as any).electron.send('VERIFY_SETUP_PASSWORD', password);
    }
  };

  const handleVerifyPuzzlePassword = () => {
    const eventPass = localStorage.getItem('pass_event') || 'EVT_TRIGGER_99';
    if (puzzleInput === eventPass) {
      playSynthSound('success');
      setPuzzleState('browsing_pdf_1');
      setPuzzleInput('');
      setPuzzleError(false);
      emit('CONNECTION_MSG', { text: 'PUZZLE_UNLOCKED: Correct entry password parsed.' });
    } else {
      setPuzzleError(true);
    }
  };

  const handlePowerVerifyPassword = () => {
    const adminPass = localStorage.getItem('pass_admin') || 'ADMIN_DASH';
    if (powerInput === adminPass) {
      playSynthSound('success');
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

  const handleMaidDeliver = () => {
     if (maidTimer > 0) return;

     if (deliveredItemCodes.includes(maidItemInput)) {
         setMaidDeliveryError("すでに配達済みです");
         setMaidDeliveryState('error');
         return;
     }

     setMaidDeliveryState('testing');

     setTimeout(() => {
         const matched = maidItemsData.find(entry => entry.roomCode === maidRoomInput && entry.itemCode === maidItemInput);

         if (matched) {
             setMaidDeliveryState('delivering');
             emit('CONNECTION_MSG', {
                 text: `MAID_DELIVERY_REQUEST: Room: "${maidRoomInput}", Item: "${maidItemInput}", ItemName: "${matched.name}"`
             });
         } else {
             setMaidDeliveryError("指定された部屋に指定されたものが見つかりませんでした");
             setMaidDeliveryState('error');
             setMaidTimer(5);
         }
     }, 3000);
  };

  const handleVerifyExecutionOverride = () => {
     // Guard: Only allowed when timerSeconds <= 20 and not yet submitted
     if (timerSeconds === null || timerSeconds > 20 || overrideSubmitted) return;

     setOverrideSubmitted(true);
     setOverrideText("処刑停止を申請しました。残り時間をお待ちください。");

     // Check passcode proposal
     const cleanInput = executionOverrideInput.trim().toUpperCase();
     const correctList = puzzleAnswersData.correctPasscodes || [];
     const closeList = puzzleAnswersData.closePasscodes || [];

     let outcome = 'failed';
     if (correctList.some(p => p.toUpperCase() === cleanInput)) {
         outcome = 'correct';
     } else if (closeList.some(p => p.toUpperCase() === cleanInput)) {
         outcome = 'close';
     }

     setGameResult(outcome as any);

     // Send password proposal to Master Console with determined outcome
     emit('CONNECTION_MSG', {
         text: `OVERRIDE_SUBMITTED: Submitted Passcode proposal: "${executionOverrideInput}" [Result: ${outcome}]`
     });
  };

  if (showSetup) {
      return <Setup onComplete={() => {
          setShowSetup(false);
          setMasterUrl(localStorage.getItem('masterUrl'));
      }} />;
  }

  // Determine current active displayed clock & Date
  const displayClockStr = (timeOverride || time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const displayDateStr = (timeOverride || time).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' });

  const handleConfirmEmergencyRetire = () => {
     playSynthSound('success');
     setShowRetireConfirm(false);
     setPuzzleState('retired');
     emit('CONNECTION_MSG', { text: 'EMERGENCY_RETIRE_TRIGGERED: Player initiated emergency retirement!' });
  };

  const getVideoTitle = () => {
    switch (videoType) {
      case 'start': return "緊急強制システム介入配信";
      case 'admin': return "管理者ブートシーケンスビデオ";
      case 'correct': return "ミッションクリア結果映像";
      case 'close': return "おしい！クリア一歩手前";
      case 'failed': return "ミッション失敗映像";
      case 'commentary': return "解説・チュートリアル上映中";
      default: return "緊急致死処分シークエンス";
    }
  };

  const getVideoSub = () => {
    switch (videoType) {
      case 'start': return "UNAUTHORIZED OVERRIDE SIGNAL DETECTED";
      case 'admin': return "GOV-CORE OS ROOT ENGINE BOOT";
      case 'correct': return "MISSION SUCCESSFUL - LIFE DECODER UNLOCKED";
      case 'close': return "MISSION CLOSE - SO NEAR AND YET SO FAR";
      case 'failed': return "MISSION FAILED - SYSTEM RE-RESTRICTED";
      case 'commentary': return "MISSION COMMENTARY AND TRUTH EXPLANATION";
      default: return "CRITICAL SYSTEM OVERRIDE PROTOCOL INITIATED";
    }
  };

  const getVideoStatus = () => {
    switch (videoType) {
      case 'start': return "CRYPTO ENGINE SYNCHRONIZING WITH FLEET...";
      case 'admin': return "ROOT SHELL INITIALIZED SUCCESSFULLY.";
      case 'correct': return "ALL TERMINALS ACCESS RESUMED SAFELY.";
      case 'close': return "PARTIAL SOLUTION DETECTED. RETRY SUSPENDED.";
      case 'failed': return "EXPIRED DECODING ENGINE DISSOLVED.";
      case 'commentary': return "COMMENTARY CHANNEL ENGAGED SUCCESSFULLY.";
      default: return "CRYPTO EXPIRED. DISSOLUTION TIME REACHED 0.";
    }
  };

  return (
    <OSContext.Provider value={osContextValue}>
    <div className={`relative h-screen w-screen bg-[#050508] text-[#eaeaea] overflow-hidden ${isShaking ? 'animate-shake' : ''} ${isFrozen ? 'pointer-events-none select-none' : ''}`}>

      {/* Screen Complete Blackout Phase once countdown timerSeconds reaches exactly 0 and video finished */}
      <AnimatePresence>
          {timerSeconds === 0 && !executionAborted && !videoPlaying && (
               <motion.div
                 initial={{ opacity: 0 }}
                 animate={{ opacity: 1 }}
                 className="fixed inset-0 z-[10000] bg-[#000000] flex flex-col items-center justify-center text-transparent cursor-none select-none pointer-events-none"
               >
                    [SYSTEM_TERMINATED]
               </motion.div>
          )}
      </AnimatePresence>

      {/* Post Commentary Exit Screen Overlays */}
      <AnimatePresence>
          {postCommentaryScreen === 'success' && (
               <motion.div
                 initial={{ opacity: 0 }}
                 animate={{ opacity: 1 }}
                 className="fixed inset-0 z-[10100] bg-black flex flex-col items-center justify-center p-6 text-center select-none"
               >
                    <div className="absolute inset-0 bg-[radial-gradient(rgba(34,197,94,0.15)_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none z-0" />
                    <motion.div
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="max-w-md w-full glass-panel p-10 border-green-500/30 bg-black/80 flex flex-col items-center gap-6 shadow-[0_0_50px_rgba(34,197,94,0.2)] z-10"
                    >
                         <CheckCircle2 className="text-green-500 animate-bounce" size={64} />
                         <div>
                              <h2 className="text-xl font-black tracking-[0.2em] text-white uppercase">MISSION_SUCCESSFUL</h2>
                              <p className="text-sm text-green-400 font-mono mt-1 tracking-widest font-black">脱出成功</p>
                         </div>
                         <div className="p-4 rounded-xl bg-green-950/20 border border-green-900/30 text-[11px] leading-relaxed text-green-400 font-mono text-left w-full">
                              🎉 【おめでとうございます！】:
                              制限時間内に正しい処刑停止コードを検知・送信し、致死処分シーケンスの完全オーバーライドに成功しました！
                              本ミッションは無事完了しました。
                         </div>
                    </motion.div>
               </motion.div>
          )}
      </AnimatePresence>

      <AnimatePresence>
          {postCommentaryScreen === 'failed' && (
               <motion.div
                 initial={{ opacity: 0 }}
                 animate={{ opacity: 1 }}
                 className="fixed inset-0 z-[10100] bg-black flex flex-col items-center justify-center p-6 text-center select-none"
               >
                    <div className="absolute inset-0 bg-[radial-gradient(rgba(239,68,68,0.15)_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none z-0" />
                    <motion.div
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="max-w-md w-full glass-panel p-10 border-red-500/30 bg-black/80 flex flex-col items-center gap-6 shadow-[0_0_50px_rgba(239,68,68,0.2)] z-10"
                    >
                         <ShieldAlert className="text-red-500 animate-pulse" size={64} />
                         <div>
                              <h2 className="text-xl font-black tracking-[0.2em] text-white uppercase">MISSION_FAILED</h2>
                              <p className="text-sm text-red-500 font-mono mt-1 tracking-widest font-black">脱出失敗</p>
                         </div>
                         <div className="p-4 rounded-xl bg-red-950/20 border border-red-900/30 text-[11px] leading-relaxed text-red-400 font-mono text-left w-full">
                              🚨 【脱出失敗】:
                              正しい処刑停止コードが入力されなかったか、制限時間内にシステムをオーバーライドできませんでした。
                              生命維持保護セッションは終了しました。
                         </div>
                    </motion.div>
               </motion.div>
          )}
      </AnimatePresence>

      {/* Pause Mode Overlay Screen */}
      <AnimatePresence>
          {isPaused && (
               <motion.div
                 initial={{ opacity: 0 }}
                 animate={{ opacity: 1 }}
                 className="fixed inset-0 z-[9600] bg-[#0d0d0f]/95 flex flex-col items-center justify-center p-6 text-center select-none"
               >
                    <div className="absolute inset-0 bg-[radial-gradient(rgba(234,179,8,0.15)_1px,transparent_1px)] [background-size:16px_16px]" />
                    <motion.div
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="max-w-md w-full glass-panel p-10 border-yellow-500/30 bg-black/80 flex flex-col items-center gap-6 shadow-[0_0_50px_rgba(234,179,8,0.2)]"
                    >
                         <AlertCircle className="text-yellow-500 animate-pulse" size={64} />
                         <div>
                              <h2 className="text-xl font-black tracking-[0.2em] text-white uppercase">SYSTEM_PAUSED</h2>
                              <p className="text-[11px] text-yellow-500 uppercase font-mono mt-1 tracking-widest font-bold">現在ゲーム停止中</p>
                         </div>
                         <div className="p-4 rounded-xl bg-yellow-950/20 border border-yellow-900/30 text-[11px] leading-relaxed text-yellow-400 font-mono text-left w-full">
                              ⚠️ 【システム一時停止】:
                              ただいま安全管理のため進行を一時的に中断しています。
                              再開されるまでそのままお待ちください。
                         </div>
                    </motion.div>
               </motion.div>
          )}
      </AnimatePresence>

      {/* Emergency Retired Screen */}
      <AnimatePresence>
          {puzzleState === 'retired' && (
               <motion.div
                 initial={{ opacity: 0 }}
                 animate={{ opacity: 1 }}
                 className="fixed inset-0 z-[9500] bg-[#000000] flex flex-col items-center justify-center p-6 text-center select-none"
               >
                    <div className="scanlines z-0" />
                    <motion.div
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="max-w-md w-full glass-panel p-10 border-red-500/20 bg-black/40 flex flex-col items-center gap-6"
                    >
                         <ShieldAlert className="text-red-500 animate-pulse" size={64} />
                         <div>
                              <h2 className="text-lg font-black tracking-[0.2em] text-white uppercase">EMERGENCY_RETIRED</h2>
                              <p className="text-[10px] text-red-500/80 uppercase font-mono mt-1 tracking-widest font-black">リタイア申請完了</p>
                         </div>
                         <div className="p-4 rounded-xl bg-red-950/20 border border-red-900/30 text-[11px] leading-relaxed text-red-400 font-mono text-left w-full">
                              🚨 【警告】: 緊急リタイアが実行されました。
                              管理端末（親機）からのロック解除操作を受信するまで、この端末での操作は一切行えません。
                         </div>
                    </motion.div>
               </motion.div>
          )}
      </AnimatePresence>

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

          {/* Phase 5: Unskippable Fullscreen Video Player Overlay */}
          {videoPlaying && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[2000] bg-black flex flex-col items-center justify-center p-8 font-mono overflow-hidden select-none"
              >
                  {/* Cyber Scanline Grid Overlay */}
                  <div className="scanlines z-0" />

                  {/* Flashing hazard warning elements */}
                  <div className="absolute top-10 left-10 flex items-center gap-4 text-red-500 animate-pulse">
                      <AlertTriangle size={32} />
                      <div className="text-left">
                          <div className="text-sm font-black tracking-widest">CRITICAL BROADCAST</div>
                          <div className="text-[10px] text-white/40 uppercase">DIRECT LINK STABLE</div>
                      </div>
                  </div>

                  <div className="absolute top-10 right-10 flex items-center gap-2 px-3 py-1 bg-red-950/40 border border-red-500/30 rounded text-red-500 font-bold text-[10px] uppercase tracking-widest animate-pulse">
                      ● EMERGENCY OVERRIDE RECEPTION
                  </div>

                  {/* Main Player Screen Container simulating real security playback */}
                  <div className="relative w-full max-w-4xl border border-white/10 rounded-3xl overflow-hidden aspect-video bg-zinc-950 flex flex-col items-center justify-center p-12">
                       {/* Interference Static Static Bars */}
                       <div className="absolute inset-0 opacity-[0.03] bg-[radial-gradient(#ffffff_2px,transparent_2px)] [background-size:16px_16px]" />

                       <div className="text-center space-y-6 max-w-xl relative z-10">
                            <motion.div
                              animate={{ scale: [1, 1.05, 1] }}
                              transition={{ repeat: Infinity, duration: 2 }}
                              className="w-20 h-20 bg-red-950/20 border border-red-500 rounded-full flex items-center justify-center mx-auto text-red-500 shadow-[0_0_30px_rgba(239,68,68,0.2)]"
                            >
                                 <ShieldAlert size={40} className="animate-bounce" />
                            </motion.div>

                            <div>
                                 <h1 className="text-2xl font-black text-white tracking-[0.3em] uppercase">{getVideoTitle()}</h1>
                                 <p className="text-xs text-red-500/80 uppercase font-bold tracking-widest mt-2">
                                      {getVideoSub()}
                                 </p>
                            </div>

                            <div className="space-y-2 p-6 bg-black/60 rounded-2xl border border-white/5 text-left text-[11px] leading-relaxed text-white/60">
                                 <div>[SYSTEM_STATUS] {getVideoStatus()}</div>
                                 <div className="text-red-500 font-bold animate-pulse">[WARN] TERMINAL INTERACTION IS RESTRICTED.</div>
                            </div>
                       </div>

                       {/* Video Progress Overlay in Video Panel */}
                       <div className="absolute bottom-6 inset-x-8 flex items-center gap-6">
                            <span className="text-[10px] text-white/40 tracking-widest">00:{String(Math.floor((videoProgress / 100) * 12)).padStart(2, '0')}</span>
                            <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                                 <div className="h-full bg-red-500 transition-all duration-100" style={{ width: `${videoProgress}%` }} />
                            </div>
                            <span className="text-[10px] text-white/40 tracking-widest">00:12</span>
                       </div>
                  </div>

                  <div className="mt-8 text-center text-xs text-white/30 uppercase tracking-[0.2em] animate-pulse">
                       ※ 処分完了までシステムは完全に強制ロックされます。
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
      <header className={`absolute top-0 left-0 w-full h-12 flex items-center justify-between px-8 z-50 bg-black/40 border-b border-red-950/20 backdrop-blur-md ${puzzleState === 'browsing_pdf_1' ? 'hidden' : ''}`}>
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

          {/* Emergency Retire Trigger Button (Displayed persistently unless retired orTerminated) */}
          {puzzleState !== 'idle' && puzzleState !== 'retired' && (
              <button
                onClick={() => {
                    playSynthSound('open');
                    setShowRetireConfirm(true);
                }}
                className="px-4 py-1 rounded-full bg-red-950/40 border border-red-500/30 text-red-500 text-[10px] font-bold uppercase tracking-widest hover:bg-red-950/70 transition-all flex items-center gap-1.5"
              >
                   <ShieldAlert size={12} />
                   緊急リタイア
              </button>
          )}
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
              {displayDateStr} {displayClockStr}
            </span>
          </div>
        </div>
      </header>

      {/* 2. Main Area (Center) */}
      <main className={`relative h-screen w-full flex items-center justify-center z-10 ${puzzleState === 'browsing_pdf_1' ? 'p-0 pt-0 pb-0' : 'p-20 pt-20 pb-28'}`}>

        {/* State A: browsing_pdf_1 (Fullscreen absolute layout covering everything) */}
        {puzzleState === 'browsing_pdf_1' && (
            <div className="fixed inset-0 z-50 bg-black flex flex-col">
                {/* Embedded PDF 1 viewport occupying 100% of the screen */}
                <iframe
                   src="/documents/doc1.pdf"
                   className="w-full h-full border-0 bg-black"
                   title="処刑装置起動手順_LOG_832.pdf"
                />

                {/* Hidden floating click trigger at the top right to open setup admin prompt */}
                <button
                   onClick={() => setShowPowerPrompt(true)}
                   className="absolute top-4 right-4 p-3 bg-red-950/40 border border-red-500/20 hover:bg-red-950/80 rounded-full text-red-500 transition-all z-50 flex items-center justify-center"
                   title="管理者メニュー起動"
                >
                     <Power size={18} />
                </button>
            </div>
        )}

        {/* State B: admin_desktop (GOV-CORE OS Desktop) */}
        {puzzleState === 'admin_desktop' && (
            <div className="w-full h-full flex gap-8 relative">
                {/* Float PDF 2 Overlay - Opens on startup default. Can be closed/reopened. */}
                <AnimatePresence>
                    {adminPdfOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: 30, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 30, scale: 0.95 }}
                          className="absolute inset-0 z-40 glass-panel border-red-950/40 bg-black/95 p-2 rounded-[32px] flex flex-col overflow-hidden shadow-[0_32px_64px_rgba(0,0,0,0.9)]"
                        >
                            <div className="flex items-center justify-between border-b border-white/5 pb-2 px-4 mb-2">
                                 <div className="flex items-center gap-3">
                                      <FileText className="text-red-500 animate-pulse" size={20} />
                                      <div>
                                          <h3 className="text-xs font-black text-white uppercase tracking-wider">管理者限定極秘データ_SEC_992.pdf</h3>
                                      </div>
                                 </div>
                                 <button
                                   onClick={() => setAdminPdfOpen(false)}
                                   className="p-1 hover:bg-white/10 rounded-full transition-colors text-white/40 hover:text-white"
                                 >
                                      <X size={16} />
                                 </button>
                            </div>

                            <div className="flex-1 rounded-2xl overflow-hidden bg-zinc-950">
                                 <iframe
                                   src="/documents/doc2.pdf"
                                   className="w-full h-full border-0"
                                   title="管理者限定極秘データ_SEC_992.pdf"
                                 />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Decoupled Admin Software windows opening in gorgeous Fullscreen overlays */}
                <AnimatePresence>
                     {openAppId && (
                         <motion.div
                           initial={{ opacity: 0, scale: 0.98 }}
                           animate={{ opacity: 1, scale: 1 }}
                           exit={{ opacity: 0, scale: 0.98 }}
                           className="fixed inset-0 z-[600] bg-black/95 flex flex-col p-8"
                         >
                             <div className="h-16 flex items-center justify-between border-b border-white/10 pb-4 mb-6">
                                 <div className="flex items-center gap-4">
                                      <ShieldCheck className="text-red-500" size={24} />
                                      <span className="text-sm font-black uppercase tracking-[0.3em] text-white">
                                           {openAppId === 'camera' && '防犯カメラシステム (SECURITY_CAM_MONITOR)'}
                                           {openAppId === 'maid' && 'メイドコントロールシステム (MAID_CONTROLLER)'}
                                           {openAppId === 'stop_execution' && '処刑停止システム (EXECUTION_OVERRIDE)'}
                                      </span>
                                 </div>
                                 <button
                                   onClick={() => setOpenAppId(null)}
                                   className="p-3 bg-white/5 hover:bg-white/15 rounded-full transition-all text-white/60 hover:text-white"
                                 >
                                      <X size={24} />
                                 </button>
                             </div>

                             <div className="flex-1 overflow-y-auto relative p-4">
                                  {/* Fullscreen Video Camera Module (Looping mp4 files with Toggle controls) */}
                                  {openAppId === 'camera' && (
                                      <div className="h-full flex flex-col gap-6">
                                          {/* Camera Channel Tabs and Playback control skip/rewind buttons */}
                                          <div className="flex justify-between items-center bg-white/5 p-4 rounded-2xl border border-white/5">
                                               <div className="flex gap-4">
                                                    <button
                                                      onClick={() => setActiveCamChannel(1)}
                                                      className={`px-6 py-3 rounded-xl border text-xs font-bold uppercase tracking-widest transition-all ${activeCamChannel === 1 ? 'bg-red-500/10 border-red-500 text-white' : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'}`}
                                                    >
                                                         CAM_01: エントランス
                                                    </button>
                                                    <button
                                                      onClick={() => setActiveCamChannel(2)}
                                                      className={`px-6 py-3 rounded-xl border text-xs font-bold uppercase tracking-widest transition-all ${activeCamChannel === 2 ? 'bg-red-500/10 border-red-500 text-white' : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'}`}
                                                    >
                                                         CAM_02: 制御室
                                                    </button>
                                               </div>

                                               {/* Video time manipulation control buttons */}
                                               <div className="flex items-center gap-2">
                                                    <button
                                                      onClick={() => {
                                                          const ref = activeCamChannel === 1 ? cam1VideoRef : cam2VideoRef;
                                                          if (ref.current) ref.current.currentTime = 0;
                                                      }}
                                                      className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 text-[10px] font-bold uppercase tracking-wider"
                                                    >
                                                         最初から
                                                    </button>
                                                    <button
                                                      onClick={() => {
                                                          const ref = activeCamChannel === 1 ? cam1VideoRef : cam2VideoRef;
                                                          if (ref.current) ref.current.currentTime = Math.max(0, ref.current.currentTime - 10);
                                                      }}
                                                      className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 text-[10px] font-bold uppercase tracking-wider"
                                                    >
                                                         10秒戻し
                                                    </button>
                                                    <button
                                                      onClick={() => {
                                                          const ref = activeCamChannel === 1 ? cam1VideoRef : cam2VideoRef;
                                                          if (ref.current) ref.current.currentTime = ref.current.currentTime + 10;
                                                      }}
                                                      className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 text-[10px] font-bold uppercase tracking-wider"
                                                    >
                                                         10秒送り
                                                    </button>
                                               </div>
                                          </div>

                                          <div className="flex-1 bg-black rounded-3xl border border-white/10 overflow-hidden relative aspect-video max-w-4xl mx-auto w-full flex items-center justify-center">
                                               <div className="scanlines z-0" />
                                               {activeCamChannel === 1 ? (
                                                    <video
                                                      key="cam1"
                                                      ref={cam1VideoRef}
                                                      src="/videos/cam1.mp4"
                                                      autoPlay
                                                      loop
                                                      muted
                                                      playsInline
                                                      className="w-full h-full object-cover"
                                                    />
                                               ) : (
                                                    <video
                                                      key="cam2"
                                                      ref={cam2VideoRef}
                                                      src="/videos/cam2.mp4"
                                                      autoPlay
                                                      loop
                                                      muted
                                                      playsInline
                                                      className="w-full h-full object-cover"
                                                    />
                                               )}
                                               <div className="absolute top-4 left-4 px-3 py-1 bg-black/80 rounded-md font-mono text-xs text-white/80">
                                                    CAM_0{activeCamChannel} - LIVE BROADCAST
                                               </div>
                                          </div>
                                      </div>
                                  )}

                                  {/* Mock Maid Control System App */}
                                  {openAppId === 'maid' && (
                                      <div className="max-w-md mx-auto space-y-6 py-6 font-mono text-center">
                                           <div className="w-16 h-16 bg-red-950/40 rounded-[20px] flex items-center justify-center mx-auto border border-red-500/20 animate-pulse">
                                               <Cpu className="text-red-500" size={32} />
                                           </div>
                                           <div>
                                                <h4 className="text-sm font-bold uppercase tracking-widest text-white">メイド配達コントロールシステム</h4>
                                                <p className="text-[10px] text-white/40 mt-1 uppercase">配達を要請する物品情報と部屋コードを入力してください。</p>
                                           </div>

                                           <div className="space-y-4 text-left">
                                                <div>
                                                     <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest block mb-1">物品がある部屋コード</label>
                                                     <input
                                                          type="text"
                                                          disabled={maidDeliveryState === 'testing' || maidDeliveryState === 'delivering' || maidTimer > 0}
                                                          placeholder="例: RM101"
                                                          className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-sm font-mono text-white outline-none focus:border-red-900 transition-colors uppercase"
                                                          value={maidRoomInput}
                                                          onChange={(e) => setMaidRoomInput(e.target.value.toUpperCase())}
                                                     />
                                                </div>

                                                <div>
                                                     <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest block mb-1">物品コード</label>
                                                     <input
                                                          type="text"
                                                          disabled={maidDeliveryState === 'testing' || maidDeliveryState === 'delivering' || maidTimer > 0}
                                                          placeholder="例: ITEM01"
                                                          className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-sm font-mono text-white outline-none focus:border-red-900 transition-colors uppercase"
                                                          value={maidItemInput}
                                                          onChange={(e) => setMaidItemInput(e.target.value.toUpperCase())}
                                                     />
                                                </div>
                                           </div>

                                           {maidDeliveryState === 'testing' && (
                                                <div className="p-4 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center gap-2">
                                                     <Loader2 size={16} className="text-white/60 animate-spin" />
                                                     <span className="text-xs text-white/60">データ照合中（3秒待機）...</span>
                                                </div>
                                           )}

                                           {maidDeliveryState === 'delivering' && (
                                                <div className="p-4 rounded-xl bg-green-950/20 border border-green-900/30 flex items-center justify-center gap-2">
                                                     <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-ping" />
                                                     <span className="text-xs text-green-400 font-bold uppercase tracking-widest">現在、メイドが物品を配達中です。</span>
                                                </div>
                                           )}

                                           {maidDeliveryState === 'error' && (
                                                <div className="p-4 rounded-xl bg-red-950/20 border border-red-900/30 flex flex-col gap-1 items-center justify-center text-red-400">
                                                     <AlertCircle size={20} />
                                                     <span className="text-xs font-bold uppercase tracking-widest">エラー: {maidDeliveryError}</span>
                                                </div>
                                           )}

                                           <button
                                                disabled={!maidRoomInput || !maidItemInput || maidDeliveryState === 'testing' || maidDeliveryState === 'delivering' || maidTimer > 0}
                                                onClick={handleMaidDeliver}
                                                className={`w-full py-3.5 rounded-xl font-bold uppercase text-[10px] tracking-widest transition-colors ${
                                                    (!maidRoomInput || !maidItemInput || maidDeliveryState === 'testing' || maidDeliveryState === 'delivering' || maidTimer > 0)
                                                    ? 'bg-white/5 border border-white/5 text-white/20 cursor-not-allowed'
                                                    : 'bg-red-950/40 hover:bg-red-950/60 border border-red-900/40 text-red-400'
                                                }`}
                                           >
                                                {maidTimer > 0 ? `入力制限中: あと ${maidTimer} 秒` : '配達を要請'}
                                           </button>
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

                                           {overrideSubmitted ? (
                                               <div className="p-6 bg-red-950/20 border border-red-900/30 rounded-2xl flex flex-col items-center gap-2">
                                                    <CheckCircle2 className="text-red-400 animate-pulse" size={32} />
                                                    <span className="text-xs font-bold text-red-400 uppercase tracking-widest">{overrideText}</span>
                                                    <span className="text-[9px] text-white/40 uppercase font-mono">STATUS: OVERRIDE_REQUESTED</span>
                                               </div>
                                           ) : (
                                               <div className="space-y-4">
                                                    <div className="p-4 rounded-2xl bg-white/5 border border-white/5 text-[11px] leading-relaxed text-white/60 text-left font-mono">
                                                         🔒 **処刑停止申請の制限条件**:
                                                         - この暗証コード送信機能は、残り時間が **20秒以下** になった時のみ有効化されます。
                                                         - 送信の試行チャンスは **1回限り（ワンショット）** です。慎重に入力してください。
                                                    </div>

                                                    <input
                                                       type="password"
                                                       disabled={timerSeconds === null || timerSeconds > 20}
                                                       placeholder={timerSeconds !== null && timerSeconds > 20 ? `残り ${timerSeconds} 秒で有効化` : "STOP CODE を入力"}
                                                       className={`w-full bg-black/50 border rounded-xl px-4 py-3 text-center outline-none focus:border-red-900 text-lg font-mono tracking-[0.4em] text-red-500 ${(timerSeconds === null || timerSeconds > 20) ? 'opacity-30 cursor-not-allowed border-white/5' : 'border-red-950/50'}`}
                                                       value={executionOverrideInput}
                                                       onChange={(e) => {
                                                           setExecutionOverrideInput(e.target.value);
                                                           if (overrideError) setOverrideError(false);
                                                       }}
                                                       onKeyDown={(e) => e.key === 'Enter' && handleVerifyExecutionOverride()}
                                                    />
                                                    <button
                                                      disabled={timerSeconds === null || timerSeconds > 20 || overrideSubmitted}
                                                      onClick={handleVerifyExecutionOverride}
                                                      className={`w-full py-3 rounded-xl font-bold uppercase text-[10px] tracking-widest transition-colors ${(timerSeconds === null || timerSeconds > 20) ? 'bg-white/5 border border-white/5 text-white/20 cursor-not-allowed' : 'bg-red-950/40 hover:bg-red-950/60 border border-red-900/40 text-red-400'}`}
                                                    >
                                                      処刑停止指令を実行
                                                    </button>
                                               </div>
                                           )}
                                      </div>
                                  )}
                             </div>
                         </motion.div>
                     )}
                </AnimatePresence>

                {/* Left Desktop: Default background workspace */}
                <div className="flex-1 flex flex-col gap-6">
                    <div className="flex-1 glass-panel border-white/5 bg-black/20 flex flex-col justify-center items-center text-center p-8">
                         <Cpu className="text-white/10 animate-pulse mb-4" size={64} />
                         <h4 className="text-xs font-black uppercase text-white/30 tracking-widest">管理者コンソール</h4>
                         <span className="text-[9px] text-white/20 uppercase font-mono mt-1">MODULES STATUS: READY</span>
                    </div>
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

                    {/* PDF 2 Re-opener icon */}
                    <button
                      onClick={() => setAdminPdfOpen(true)}
                      className="flex items-center gap-4 p-5 rounded-2xl border border-red-500/20 bg-black/40 text-left hover:bg-red-500/10 transition-all text-white/60"
                    >
                         <div className="p-4 bg-red-950/20 rounded-xl text-red-500">
                              <FileText size={24} />
                         </div>
                         <div>
                              <div className="text-xs font-black uppercase tracking-widest text-white">極秘データ_SEC_992</div>
                              <span className="text-[8px] text-red-500/60 uppercase font-mono mt-1 block">REOPEN_PDF_DOCUMENT</span>
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

        {/* Normal idle state (Desktop / Setup Complete wait screen) */}
        {puzzleState === 'idle' && (
            <div className="flex flex-col items-center justify-center text-center p-8 space-y-6">
                <div className="w-16 h-16 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center animate-pulse">
                     <Cpu size={28} className="text-white/40" />
                </div>
                <div>
                     <h2 className="text-2xl font-black text-white uppercase tracking-[0.4em]">しばらくお待ちください</h2>
                     <p className="text-[10px] text-white/30 uppercase tracking-[0.2em] font-mono mt-2 animate-pulse">
                          謎解きの公演準備完了。まもなくミッションを開始します。
                     </p>
                </div>
            </div>
        )}
      </main>

      {/* 3. Taskbar & Dock (Bottom) */}
      <footer className={`absolute bottom-8 left-0 w-full flex justify-center z-50 ${puzzleState === 'browsing_pdf_1' ? 'hidden' : ''}`}>
        <nav className="glass-panel px-6 py-3.5 flex items-center gap-4 border-white/5 bg-black/60">
              {/* Phase B: Default dock (Exit modal triggers power) */}
              <>
                  <div className="text-[9px] font-bold text-white/30 uppercase tracking-[0.2em] px-2 font-mono">GOV-CORE DOCK</div>
                  <div className="w-[1px] h-6 bg-white/10 mx-1" />
                  <button
                    onClick={() => {
                      if (puzzleState === 'admin_desktop') {
                         playSynthSound('tap');
                         alert("これは謎には関係ありません");
                      } else {
                         playSynthSound('open');
                         setShowExitModal(true);
                      }
                    }}
                    className="p-3 rounded-2xl text-white/20 hover:text-red-500 hover:bg-red-500/10 transition-all"
                  >
                    <Power size={20} />
                  </button>
              </>
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

      {/* Emergency Retire Confirmation modal */}
      <AnimatePresence>
        {showRetireConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9000] bg-black/85 backdrop-blur-sm flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-full max-w-sm glass-panel p-8 text-center border-red-500/20 bg-black/40"
            >
              <ShieldAlert className="mx-auto mb-6 text-red-500/80 animate-pulse" size={48} />
              <h2 className="text-lg font-black tracking-[0.2em] uppercase text-white">RETIRE_CONFIRM</h2>
              <p className="text-xs text-red-500/80 uppercase font-mono tracking-widest mt-2">本当にリタイアしますか？</p>
              <p className="text-[10px] text-white/40 mt-4 leading-relaxed uppercase">
                   リタイアを実行すると、親機からの遠隔解除指示があるまで、それ以降の操作が一切行えなくなります。
              </p>

              <div className="flex gap-4 mt-8">
                <button
                    onClick={() => {
                        playSynthSound('tap');
                        setShowRetireConfirm(false);
                    }}
                    className="flex-1 py-3 rounded-xl border border-white/10 hover:bg-white/5 transition-all text-xs uppercase tracking-widest"
                >
                  いいえ
                </button>
                <button
                    onClick={handleConfirmEmergencyRetire}
                    className="flex-1 py-3 rounded-xl bg-red-900 hover:bg-red-800 text-white font-black text-xs uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(239,68,68,0.2)]"
                >
                  はい、リタイアする
                </button>
              </div>
            </motion.div>
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

              <div className="space-y-4">
                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-white/40 block text-left mb-1 ml-1">管理者ツール起動または終了用パスコード</label>
                    <div className="relative">
                      <input
                          type={showPasswordRaw ? "text" : "password"}
                          autoFocus
                          className={`w-full bg-white/5 border rounded-xl px-4 py-3 text-center outline-none focus:border-white/30 transition-all text-sm font-mono tracking-[0.2em] ${passwordError ? 'border-red-500' : 'border-white/10'}`}
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
                  </div>
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
                    onClick={() => {
                       // Check custom setup password first
                       const customSetup = localStorage.getItem('pass_setup') || 'ADMIN_SETUP';
                       if (exitPassword === customSetup) {
                           playSynthSound('success');
                           setShowSetup(true);
                           setShowExitModal(false);
                           setExitPassword('');
                           setPasswordError(false);
                       } else {
                           handleVerifyPassword();
                       }
                    }}
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
