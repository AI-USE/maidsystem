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

const stopAllGlobalBgmAndOscillators = () => {
  if (bgmAudioRef.current) {
     bgmAudioRef.current.pause();
     bgmAudioRef.current = null;
  }
  if (bgmOscillatorRef.current) {
     try {
         bgmOscillatorRef.current.stop();
     } catch (e) {}
     bgmOscillatorRef.current = null;
  }
};

const getAudioDeviceId = async (preferType: 'headphone' | 'speaker'): Promise<string | null> => {
  try {
     // Request temporary permission to read labels
     try {
       const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
       stream.getTracks().forEach(track => track.stop());
     } catch (err) {
       console.log("Mic permission warning inside getAudioDeviceId:", err);
     }

     const devices = await navigator.mediaDevices.enumerateDevices();
     const audioOutputs = devices.filter(device => device.kind === 'audiooutput');

     let targetDevice = null;
     if (preferType === 'headphone') {
         targetDevice = audioOutputs.find(d =>
             d.label.toLowerCase().includes('headphones') ||
             d.label.toLowerCase().includes('headphone') ||
             d.label.toLowerCase().includes('headset') ||
             d.label.toLowerCase().includes('イヤホン') ||
             d.label.toLowerCase().includes('ヘッドホン')
         );
     } else {
         targetDevice = audioOutputs.find(d =>
             d.label.toLowerCase().includes('speakers') ||
             d.label.toLowerCase().includes('speaker') ||
             d.label.toLowerCase().includes('built-in') ||
             d.label.toLowerCase().includes('internal') ||
             d.label.toLowerCase().includes('スピーカー')
         );
     }

     return targetDevice ? targetDevice.deviceId : null;
  } catch (err) {
     console.error("Error enumerating audio devices:", err);
     return null;
  }
};

const routeAudioToDevice = async (audioElement: HTMLAudioElement, preferType: 'headphone' | 'speaker') => {
  try {
     if (!audioElement || typeof (audioElement as any).setSinkId !== 'function') {
         return;
     }

     try {
         const deviceId = await getAudioDeviceId(preferType);
         if (deviceId) {
             console.log(`Setting ${preferType} device sink ID: ${deviceId}`);
             await (audioElement as any).setSinkId(deviceId);
         } else {
             console.log(`No specific ${preferType} device found. Using system default.`);
         }
     } catch (sinkErr) {
         console.warn(`Failsafe: routeAudioToDevice setSinkId failed for ${preferType}, falling back to system default.`, sinkErr);
     }
  } catch (err) {
     console.error(`Error in routeAudioToDevice for ${preferType}:`, err);
  }
};

const playSpeakerAlarmSynth = async (type: 'siren' | 'chime', isOffline: boolean = true) => {
  try {
     const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
     const dest = ctx.createMediaStreamDestination();

     const audio = new Audio();
     audio.srcObject = dest.stream;

     if (isOffline && typeof (audio as any).setSinkId === 'function') {
         try {
             const speakerId = await getAudioDeviceId('speaker');
             if (speakerId) {
                 await (audio as any).setSinkId(speakerId);
                 console.log("Successfully bound HTMLAudioElement stream source to physical speaker:", speakerId);
             }
         } catch (sinkErr) {
             console.warn("Failsafe: HTMLAudioElement setSinkId failed, playing through default output destination.", sinkErr);
         }
     }

     audio.play().catch(e => console.log("Stream play catch:", e));

     if (type === 'siren') {
         // Create a loud sweeping siren sound
         const osc = ctx.createOscillator();
         const gain = ctx.createGain();
         osc.type = 'sawtooth';

         // Siren sweep
         osc.frequency.setValueAtTime(400, ctx.currentTime);
         osc.frequency.linearRampToValueAtTime(800, ctx.currentTime + 0.4);
         osc.frequency.linearRampToValueAtTime(400, ctx.currentTime + 0.8);

         gain.gain.setValueAtTime(1.0, ctx.currentTime); // MAX VOLUME
         gain.gain.linearRampToValueAtTime(1.0, ctx.currentTime + 0.7);
         gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);

         osc.connect(gain);
         gain.connect(dest);
         osc.start();
         osc.stop(ctx.currentTime + 0.8);
     } else {
         // High-volume chime chord
         [523.25, 659.25, 783.99].forEach((freq, idx) => {
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
     }
  } catch (err) {
     console.error("playSpeakerAlarmSynth error:", err);
  }
};

const playRhythmTick = (freq = 880, duration = 0.1) => {
  try {
     if (!synthContextRef.current) {
         synthContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
     }
     const ctx = synthContextRef.current;
     if (ctx.state === 'suspended') ctx.resume();

     const osc = ctx.createOscillator();
     const gain = ctx.createGain();

     osc.type = 'sine';
     osc.frequency.setValueAtTime(freq, ctx.currentTime);

     gain.gain.setValueAtTime(0.15, ctx.currentTime);
     gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

     osc.connect(gain);
     gain.connect(ctx.destination);

     osc.start();
     osc.stop(ctx.currentTime + duration);
  } catch (err) {
     console.error('Failed to play rhythm tick sound:', err);
  }
};

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
         if (bgmAudioRef.current) {
             if (bgmAudioRef.current.paused) {
                 bgmAudioRef.current.play().catch(e => console.log("BGM play resume catch:", e));
             }
             return;
         }
         if (bgmOscillatorRef.current) return; // Already running

         const volumeValue = parseFloat(localStorage.getItem('bgmVolume') || '50') / 100;
         const audio = new Audio('./bgm.mp3');
         audio.loop = true;
         audio.volume = volumeValue;
         bgmAudioRef.current = audio;
         routeAudioToDevice(audio, 'headphone');

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

const speechQueue: string[] = [];
let isSpeechPlaying = false;

const speakThroughSpeaker = async (text: string) => {
  try {
     const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=ja&client=tw-ob&q=${encodeURIComponent(text)}`;
     const audio = new Audio(url);
     await routeAudioToDevice(audio, 'speaker');
     audio.play().catch(err => {
         console.warn("Google TTS speaker audio play failed, falling back to speechSynthesis:", err);
         speakWithQueue(text);
     });
  } catch (err) {
     console.warn("Failed to stream Google TTS to physical speakers, falling back to speechSynthesis:", err);
     speakWithQueue(text);
  }
};

const speakWithQueue = (text: string, forcePriority = false) => {
  if (!('speechSynthesis' in window)) return;

  // Prevent duplicate announcements from flooding the queue
  if (speechQueue.includes(text)) {
     return;
  }

  if (forcePriority) {
     window.speechSynthesis.cancel();
     speechQueue.length = 0; // Clear queue for high-priority override (e.g. emergency)
     speechQueue.push(text);
     isSpeechPlaying = false;
  } else {
     speechQueue.push(text);
  }

  processSpeechQueue();
};

const processSpeechQueue = () => {
  if (!('speechSynthesis' in window)) return;
  if (isSpeechPlaying || speechQueue.length === 0) return;

  isSpeechPlaying = true;
  const text = speechQueue.shift();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ja-JP';
  utterance.rate = 1.0;
  utterance.volume = 1.0;

  utterance.onend = () => {
     isSpeechPlaying = false;
     setTimeout(processSpeechQueue, 300);
  };

  utterance.onerror = () => {
     isSpeechPlaying = false;
     setTimeout(processSpeechQueue, 300);
  };

  window.speechSynthesis.speak(utterance);
};

const clearSpeechQueueAndCancel = () => {
  if ('speechSynthesis' in window) {
     window.speechSynthesis.cancel();
  }
  speechQueue.length = 0;
  isSpeechPlaying = false;
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
  const [puzzleState, setPuzzleState] = useState<'idle' | 'locked' | 'browsing_pdf_1' | 'boot_loading' | 'admin_desktop' | 'retired'>('idle');
  const [puzzleInput, setPuzzleInput] = useState('');
  const [showPuzzleInputRaw, setShowPuzzleInputRaw] = useState(false);
  const [puzzleError, setPuzzleError] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const [showRetireConfirm, setShowRetireConfirm] = useState(false);

  // Admin Desktop Floating PDF 2 Window State
  const [adminPdfOpen, setAdminPdfOpen] = useState(false);
  const [adminDoc1Open, setAdminDoc1Open] = useState(false);
  const [hint2Triggered, setHint2Triggered] = useState(false);
  const [showTextFallback1, setShowTextFallback1] = useState(false);
  const [showTextFallback2, setShowTextFallback2] = useState(false);

  // Fullscreen unskippable video state
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoType, setVideoType] = useState<'start' | 'admin' | 'correct' | 'close' | 'failed' | 'commentary' | 'none'>('none');
  const [useMockTimerFallback, setUseMockTimerFallback] = useState(false);

  // Admin Power Button Password Prompt State (using pass_admin)
  const [showPowerPrompt, setShowPowerPrompt] = useState(false);
  const [powerInput, setPowerInput] = useState('');
  const [powerError, setPowerError] = useState(false);

  // Admin Mock Application Windows Open States
  const [openAppId, setOpenAppId] = useState<string | null>(null);

  // Security Camera Active Channel (1 or 2)
  const [activeCamChannel, setActiveCamChannel] = useState<number>(1);
  const [camCurrentTime, setCamCurrentTime] = useState<number>(0);
  const [camDuration, setCamDuration] = useState<number>(0);
  const realGameStartTimeRef = useRef<number>(Date.now());

  // Maid controls state
  const [isEventUnlocked, setIsEventUnlocked] = useState(false);
  const [maidRoomInput, setMaidRoomInput] = useState('');
  const [maidItemInput, setMaidItemInput] = useState('');
  const [maidDeliveryState, setMaidDeliveryState] = useState<'idle' | 'testing' | 'delivering' | 'error'>('idle');
  const [maidDeliveryError, setMaidDeliveryError] = useState('');
  const [maidTimer, setMaidTimer] = useState(0);
  const [deliveredItemCodes, setDeliveredItems] = useState<string[]>([]);

  // Results & Post-Commentary State
  const [gameResult, setGameResult] = useState<'none' | 'correct' | 'close' | 'failed'>('none');
  const [postCommentaryScreen, setPostCommentaryScreen] = useState<'none' | 'success' | 'failed'>('none');

  // Execution stop state mock (Only allowed <= 20s, exactly 1 attempt)
  const [executionOverrideInput, setExecutionOverrideInput] = useState('');
  const [executionAborted, setExecutionAborted] = useState(false);
  const [overrideError, setOverrideError] = useState(false);
  const [overrideSubmitted, setOverrideSubmitted] = useState(false);
  const [overrideText, setOverrideText] = useState('');

  // Remote state
  const [cameraActive, setCameraActive] = useState(true);
  const [cameraFps, setCameraFps] = useState(10);
  const [isFrozen, setIsFrozen] = useState(false);
  const [errorPopup, setErrorPopup] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [timerSeconds, setTimerSeconds] = useState<number | null>(null);
  const [remoteLogs, setRemoteLogs] = useState<string[]>([]);

  // Offline/Forced-Offline patterns
  const [isForcedOfflineMode, setIsForcedOfflineMode] = useState(false);
  const [offlineScheduledTime, setOfflineScheduledTime] = useState<{ hour: string; minute: string; second: string } | null>(null);
  const [offlineStandbyActive, setOfflineStandbyActive] = useState(false);

  // All refs
  const pauseAnnouncementIntervalRef = useRef<any>(null);
  const cam1VideoRef = useRef<HTMLVideoElement>(null);
  const cam2VideoRef = useRef<HTMLVideoElement>(null);
  const activeVideoRef = useRef<HTMLVideoElement>(null);
  const childEndTimestampRef = useRef<number | null>(null);
  const lastAnnouncedSecRef = useRef<number | null>(null);
  const offlineRetireIntervalRef = useRef<any>(null);
  const deliveringTtsIntervalRef = useRef<any>(null);
  const typedBufferRef = useRef<string>('');
  const audioRefs = useRef<{ [key: string]: HTMLAudioElement }>({});
  const hint1AudioRef = useRef<HTMLAudioElement | null>(null);
  const hint2AudioRef = useRef<HTMLAudioElement | null>(null);
  const browsingPdf1StartTimeRef = useRef<number | null>(null);

  const keepHiraganaOnly = (val: string) => {
    return val.replace(/[^\u3040-\u309Fー]/g, '');
  };

  const keepLowercaseAlphanumericOnly = (val: string) => {
    return val.toLowerCase().replace(/[^a-z0-9]/g, '');
  };

  const verifyPasscode = (userInput: string, targetPasscode: string) => {
    if (!userInput || !targetPasscode) return false;
    const cleanUser = keepHiraganaOnly(userInput);
    const cleanTarget = keepHiraganaOnly(targetPasscode);
    if (cleanUser && cleanTarget && cleanUser === cleanTarget) return true;
    return userInput.trim().toLowerCase() === targetPasscode.trim().toLowerCase();
  };

  const formatDisplayTime = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    const datePart = `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
    const timePart = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    return `${datePart} ${timePart}`;
  };

  const getCameraDisplayTime = () => {
    if (!camDuration) {
       return formatDisplayTime(new Date(realGameStartTimeRef.current));
    }
    const offsetFromEnd = camDuration - camCurrentTime;
    if (offsetFromEnd <= 30) {
       const displayDate = new Date();
       displayDate.setHours(23, 52, 40, 0);
       displayDate.setSeconds(displayDate.getSeconds() - Math.floor(offsetFromEnd));
       return formatDisplayTime(displayDate);
    } else {
       const realStart = realGameStartTimeRef.current;
       const targetMs = realStart - 90000 - (Math.floor(offsetFromEnd) - 30) * 1000;
       return formatDisplayTime(new Date(targetMs));
    }
  };

  const { isConnected, isPaired, lastCommand, emit } = useRemoteControl(isForcedOfflineMode ? null : masterUrl);

  // State checking helper to determine online/offline dynamically
  const checkActiveOffline = useCallback(() => {
     return isForcedOfflineMode || (!isConnected || !isPaired);
  }, [isForcedOfflineMode, isConnected, isPaired]);

  const handleCameraFrame = useCallback((frame: string) => {
      const isOnline = !isForcedOfflineMode && isConnected && isPaired;
      if (isOnline) {
          emit('CAMERA_FRAME', { frame });
      }
  }, [isForcedOfflineMode, isConnected, isPaired, emit]);

  const setTimerSecondsAndTimestamp = useCallback((seconds: number | null) => {
     setTimerSeconds(seconds);
     if (seconds !== null) {
         childEndTimestampRef.current = Date.now() + seconds * 1000;
     } else {
         childEndTimestampRef.current = null;
     }
  }, []);

  // Synchronize absolute child JST timestamp countdown on pause/resume transitions
  useEffect(() => {
    if (isPaused) {
       // paused
    } else {
       if (timerSeconds !== null && timerSeconds > 0) {
           childEndTimestampRef.current = Date.now() + timerSeconds * 1000;
       }
    }
  }, [isPaused, timerSeconds]);

  useEffect(() => {
    if (videoPlaying && activeVideoRef.current) {
        activeVideoRef.current.play().catch(e => {
            console.warn("Explicit video play failed or was blocked by browser. Retrying on interaction.", e);
        });
    }
  }, [videoPlaying, videoType]);

  useEffect(() => {
    let interval: any;
    if (maidTimer > 0) {
      interval = setInterval(() => {
        setMaidTimer(prev => {
          if (prev <= 1) {
            setMaidDeliveryState('idle');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [maidTimer]);

  const getVideoSrc = useCallback(() => {
    switch (videoType) {
      case 'start': return "./videos/start/start.mp4";
      case 'admin': return "./videos/admin/boot.mp4";
      case 'correct': return "./videos/result/correct/correct.mp4";
      case 'close': return "./videos/result/close/close.mp4";
      case 'failed': return "./videos/result/failed/failed.mp4";
      case 'commentary': return "./videos/commentary/commentary.mp4";
      default: return "";
    }
  }, [videoType]);

  const handleVideoFinished = useCallback(() => {
    setVideoPlaying(false);
    setVideoProgress(100);

    if (videoType === 'start') {
      setPuzzleState('locked');
    }
    if (videoType === 'commentary') {
      let speechText = "";
      if (gameResult === 'correct') {
        setPostCommentaryScreen('success');
        speechText = "おめでとうございます。ミッションクリアです。スタッフの指示に従い、退室のご準備をお願いいたします。";
      } else {
        setPostCommentaryScreen('failed');
        speechText = "残念、タイムアップです。処刑装置が完全に作動しました。スタッフの指示に従い、退出のご案内をお待ちください。";
      }

      speakWithQueue(speechText);

      const isOffline = checkActiveOffline();
      if (!isOffline) {
          emit('CONNECTION_MSG', { text: 'COMMENTARY_VIDEO_FINISHED' });
      }
    }

    const isOffline = checkActiveOffline();
    const isResultsVideo = videoType === 'correct' || videoType === 'close' || videoType === 'failed';

    if (isResultsVideo && !isOffline) {
        emit('CONNECTION_MSG', { text: 'RESULTS_VIDEO_FINISHED' });
    }

    setVideoType('none');

    if (isOffline && isResultsVideo) {
      setTimeout(() => {
        playSynthSound('open');
        setVideoPlaying(true);
        setVideoProgress(0);
        setVideoType('commentary');
      }, 1000);
    }
  }, [videoType, gameResult, checkActiveOffline]);

  const startVideoPlayback = useCallback((type: 'start' | 'admin' | 'correct' | 'close' | 'failed' | 'commentary') => {
    playSynthSound('open');
    setUseMockTimerFallback(false);
    setVideoProgress(0);
    setVideoType(type);
    setVideoPlaying(true);
    if (type === 'start') {
        realGameStartTimeRef.current = Date.now();
    }
  }, []);

  const resetPuzzleStateAndInputs = useCallback(() => {
    setIsEventUnlocked(false);
    setDeliveredItems([]);
    setMaidRoomInput('');
    setMaidItemInput('');
    setMaidDeliveryState('idle');
    setMaidDeliveryError('');
    setExecutionOverrideInput('');
    setOverrideSubmitted(false);
    setOverrideError(false);
    setOverrideText('');
    setExecutionAborted(false);
    setShowPowerPrompt(false);
    setPowerInput('');
    setPowerError(false);
    setPuzzleInput('');
    setPuzzleError(false);
    setGameResult('none');
    setPostCommentaryScreen('none');
    setUseMockTimerFallback(false);
    setVideoProgress(0);

    // Rigorously clean up all active synthesizers, alarms, and interval loops
    stopAllGlobalBgmAndOscillators();
    if (pauseAnnouncementIntervalRef.current) {
        clearInterval(pauseAnnouncementIntervalRef.current);
        pauseAnnouncementIntervalRef.current = null;
    }
    if (offlineRetireIntervalRef.current) {
        clearInterval(offlineRetireIntervalRef.current);
        offlineRetireIntervalRef.current = null;
    }
    if (deliveringTtsIntervalRef.current) {
        clearInterval(deliveringTtsIntervalRef.current);
        deliveringTtsIntervalRef.current = null;
    }
    clearSpeechQueueAndCancel();
  }, []);

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

         if (videoPlaying && activeVideoRef.current && activeVideoRef.current.paused) {
             activeVideoRef.current.play().catch(e => console.log("Video interaction play resume catch:", e));
         }
    };
    const handleGlobalKeydown = (e: KeyboardEvent) => {
         // If typing in any input/textarea, play mechanical key ticks
         const tag = document.activeElement?.tagName.toLowerCase();
         if (tag === 'input' || tag === 'textarea') {
              playSynthSound('type');
         }

         // Buffer keyboard input if on standby/idle screens to detect exit passcode
         const isStandby = (puzzleState === 'idle' || offlineStandbyActive);
         const isInputActive = tag === 'input' || tag === 'textarea';

         if (isStandby && !isInputActive && e.key && e.key.length === 1) {
              const char = e.key;
              typedBufferRef.current = (typedBufferRef.current + char).slice(-50); // Keep last 50 chars

              const exitPass = localStorage.getItem('pass_exit') || 'まどれすと';
              if (typedBufferRef.current.endsWith(exitPass)) {
                  playSynthSound('success');
                  typedBufferRef.current = '';
                  if ((window as any).electron) {
                      (window as any).electron.send('EXIT_APP');
                  } else {
                      alert('System shutdown initiated via standby keyboard gesture (Web/Mock).');
                  }
              }
         }
    };
    window.addEventListener('click', handleGlobalClick);
    window.addEventListener('keydown', handleGlobalKeydown);
    return () => {
         window.removeEventListener('click', handleGlobalClick);
         window.removeEventListener('keydown', handleGlobalKeydown);
    };
  }, [puzzleState, videoPlaying, timerSeconds, isPaused, offlineStandbyActive]);

  // Automatic background music (BGM) playback lifecycle control
  useEffect(() => {
    if (postCommentaryScreen !== 'none') {
      stopAllGlobalBgmAndOscillators();

      const playExitBgm = () => {
         const volumeValue = parseFloat(localStorage.getItem('bgmVolume') || '50') / 100;
         const audio = new Audio('./bgm_exit.mp3');
         audio.loop = true;
         audio.volume = volumeValue;
         bgmAudioRef.current = audio;
         routeAudioToDevice(audio, 'headphone');
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
      timerSeconds !== 0 &&
      postCommentaryScreen === 'none';

    if (shouldPlayBgm) {
      if (bgmAudioRef.current && bgmAudioRef.current.src.includes('bgm_exit.mp3')) {
          stopAllGlobalBgmAndOscillators();
      }

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
      speakWithQueue("現在ゲーム停止中");
      pauseAnnouncementIntervalRef.current = setInterval(() => {
         speakWithQueue("現在ゲーム停止中");
      }, 5000);
    } else {
      if (pauseAnnouncementIntervalRef.current) {
        clearInterval(pauseAnnouncementIntervalRef.current);
        pauseAnnouncementIntervalRef.current = null;
      }
      clearSpeechQueueAndCancel();
    }
    return () => {
      if (pauseAnnouncementIntervalRef.current) {
        clearInterval(pauseAnnouncementIntervalRef.current);
      }
    };
  }, [isPaused]);

  // Handle Hint 1 & Hint 2 Timers and loopable audio streams
  useEffect(() => {
    const shouldPlayHint1 = timerSeconds !== null && timerSeconds <= 270 && puzzleState === 'locked' && !isPaused && !videoPlaying;

    if (shouldPlayHint1) {
       if (!hint1AudioRef.current) {
           const audio = new Audio('./hint1.mp3');
           audio.loop = true;
           audio.volume = parseFloat(localStorage.getItem('bgmVolume') || '50') / 100;
           hint1AudioRef.current = audio;
           routeAudioToDevice(audio, 'headphone').then(() => {
               audio.play().catch(e => console.warn("hint1 audio play failed:", e));
           });
       }
    } else {
       if (hint1AudioRef.current) {
           hint1AudioRef.current.pause();
           hint1AudioRef.current = null;
       }
    }
  }, [timerSeconds, puzzleState, isPaused, videoPlaying]);

  useEffect(() => {
    if (puzzleState === 'browsing_pdf_1') {
       if (browsingPdf1StartTimeRef.current === null) {
           browsingPdf1StartTimeRef.current = Date.now();
       }
    } else {
       browsingPdf1StartTimeRef.current = null;
    }
  }, [puzzleState]);

  useEffect(() => {
    let interval: any;
    if (puzzleState === 'browsing_pdf_1') {
       interval = setInterval(() => {
          if (browsingPdf1StartTimeRef.current !== null) {
              const elapsedSec = (Date.now() - browsingPdf1StartTimeRef.current) / 1000;
              if (elapsedSec >= 90) {
                  setHint2Triggered(true);
              }
          }
       }, 1000);
    } else {
       setHint2Triggered(false);
    }
    return () => clearInterval(interval);
  }, [puzzleState]);

  useEffect(() => {
    const shouldPlayHint2 = hint2Triggered && puzzleState === 'browsing_pdf_1' && !isPaused && !videoPlaying;

    if (shouldPlayHint2) {
       if (!hint2AudioRef.current) {
           const audio = new Audio('./hint2.mp3');
           audio.loop = true;
           audio.volume = parseFloat(localStorage.getItem('bgmVolume') || '50') / 100;
           hint2AudioRef.current = audio;
           routeAudioToDevice(audio, 'headphone').then(() => {
               audio.play().catch(e => console.warn("hint2 audio play failed:", e));
           });
       }
    } else {
       if (hint2AudioRef.current) {
           hint2AudioRef.current.pause();
           hint2AudioRef.current = null;
       }
    }
  }, [hint2Triggered, puzzleState, isPaused, videoPlaying]);

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
        startVideoPlayback('admin');
      }, 3000);

      return () => clearTimeout(videoTimeout);
    }
  }, [puzzleState, startVideoPlayback]);

  // Handle mock video playback progress and automatic dismissal (acts as a backup fallback when videoPlaying)
  useEffect(() => {
    let interval: any;
    const isMockFallback = useMockTimerFallback || !getVideoSrc();
    if (videoPlaying && isMockFallback) {
      interval = setInterval(() => {
        setVideoProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            handleVideoFinished();
            return 100;
          }
          return prev + 1; // 100 steps total, takes ~10 seconds at 100ms interval
        });
      }, 100);
    }
    return () => clearInterval(interval);
  }, [videoPlaying, useMockTimerFallback, getVideoSrc, handleVideoFinished]);

  // Execution Countdown Timer (Drift-immune absolute JST timestamp-based countdown tracker)
  // Starts ticking only after preparation is complete (i.e. 'locked', 'browsing_pdf_1', or 'admin_desktop')
  useEffect(() => {
    let interval: any;
    if (timerSeconds !== null && timerSeconds > 0 && puzzleState !== 'idle' && !isPaused) {
      const isOffline = checkActiveOffline();
      interval = setInterval(() => {
        if (isOffline) {
          setTimerSeconds(prev => {
             if (prev === null) return null;
             const next = prev - 1;
             if (next <= 0) {
                 clearInterval(interval);
                 setTimeout(() => {
                    const outcome = gameResult !== 'none' ? gameResult : 'failed';
                    startVideoPlayback(outcome);
                 }, 3000);
                 return 0;
             }

             // Announcements
             if (next === 30) {
                 speakWithQueue("間もなく処刑コードが入力できます。");
             } else if (next <= 10) {
                 const pitch = next === 1 ? 1200 : 880;
                 playRhythmTick(pitch, 0.15);
                 speakWithQueue(String(next), true);
             }
             return next;
          });
        } else {
          if (childEndTimestampRef.current !== null) {
            const now = Date.now();
            const next = Math.max(0, Math.ceil((childEndTimestampRef.current - now) / 1000));

            if (next === 0 && timerSeconds > 0) {
               // 7 minutes expiration: trigger 5-second blackout first, and 3 seconds after blackout starts, play results video.
               setTimerSeconds(0);
               setTimeout(() => {
                  const outcome = gameResult !== 'none' ? gameResult : 'failed';
                  startVideoPlayback(outcome);
               }, 3000);
            } else if (next > 0) {
               setTimerSeconds(next);

               if (next !== lastAnnouncedSecRef.current) {
                   lastAnnouncedSecRef.current = next;

                   // 1. Speak announcement at exactly 30 seconds remaining
                   if (next === 30) {
                       speakWithQueue("間もなく処刑コードが入力できます。");
                   }

                   // 2. Play rhythmic beeps and countdown speech under 10 seconds remaining
                   if (next <= 10) {
                       const pitch = next === 1 ? 1200 : 880;
                       playRhythmTick(pitch, 0.15);
                       speakWithQueue(String(next), true);
                   }
               }
            }
          }
        }
      }, isOffline ? 1000 : 250);
    }
    return () => clearInterval(interval);
  }, [timerSeconds, puzzleState, isPaused, gameResult, startVideoPlayback, checkActiveOffline]);

  // Periodically request phase synchronization from master to prevent drift
  useEffect(() => {
    let interval: any;
    const isOffline = checkActiveOffline();
    if (!isOffline) {
      interval = setInterval(() => {
         emit('CONNECTION_MSG', { text: `CHECK_PHASE_REQUEST: ${puzzleState}:${timerSeconds}` });
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [puzzleState, timerSeconds, checkActiveOffline]);

  // Offline emergency retire loud alarm loop
  // - Online: No local loops on the child terminal; notifications are handled on Master OS.
  // - Offline: Plays siren and loops a local speaker vocal warning with its room name and the retired status until Setup/Admin config panel is opened.
  useEffect(() => {
    const isOffline = checkActiveOffline();
    if (puzzleState === 'retired' && isOffline) {
       // Suppress regular BGM
       if (bgmAudioRef.current) bgmAudioRef.current.pause();

       const deviceName = localStorage.getItem('deviceName') || '端末';

       const playVocalAlarm = () => {
          playSpeakerAlarmSynth('siren', isOffline);
          const text = `警告、部屋名${deviceName}、リタイア。`;
          speakThroughSpeaker(text);
       };

       playVocalAlarm();
       offlineRetireIntervalRef.current = setInterval(playVocalAlarm, 5000);
    } else {
       if (offlineRetireIntervalRef.current) {
           clearInterval(offlineRetireIntervalRef.current);
           offlineRetireIntervalRef.current = null;
           clearSpeechQueueAndCancel();
       }
    }
    return () => {
       if (offlineRetireIntervalRef.current) {
           clearInterval(offlineRetireIntervalRef.current);
       }
    };
  }, [puzzleState, checkActiveOffline]);

  // Unified Maid delivering loop:
  // - Online: No local speaker announcement or continuous chime on the child terminal. It is sent to parent and announced on Discord TTS.
  // - Offline: Play warning chime on child terminal speakers, announce requested Room/Item name via local SpeechSynthesis for exactly 10 seconds, then automatically mark as delivered (completed) on the child terminal.
  useEffect(() => {
    if (maidDeliveryState === 'delivering') {
       const isOffline = checkActiveOffline();

       const matched = maidItemsData.find(entry =>
           entry.roomCode.toLowerCase() === maidRoomInput.toLowerCase() &&
           entry.itemCode.toLowerCase() === maidItemInput.toLowerCase()
       );
       const itemName = matched ? matched.name : '物品';
       const deviceName = localStorage.getItem('deviceName') || '端末';

       if (isOffline) {
          const speakDeliveringOffline = () => {
             playSpeakerAlarmSynth('chime', isOffline);
             const text = `部屋名${deviceName}、アイテム${itemName}、配達要請。`;
             speakThroughSpeaker(text);
          };

          speakDeliveringOffline();
          deliveringTtsIntervalRef.current = setInterval(speakDeliveringOffline, 4000); // loop every 4 seconds

          // Auto-complete (delivery finished) after exactly 10 seconds if offline
          const offlineTimer = setTimeout(() => {
              if (deliveringTtsIntervalRef.current) {
                  clearInterval(deliveringTtsIntervalRef.current);
                  deliveringTtsIntervalRef.current = null;
              }
              clearSpeechQueueAndCancel();
              // Add to delivered items list to persist the successful delivery state
              const itemToDeliver = maidItemInput;
              setDeliveredItems(prev => {
                  if (prev.includes(itemToDeliver)) return prev;
                  return [...prev, itemToDeliver];
              });
              setMaidDeliveryState('idle');
              setMaidRoomInput('');
              setMaidItemInput('');
          }, 10000);

          return () => {
              clearTimeout(offlineTimer);
              if (deliveringTtsIntervalRef.current) {
                  clearInterval(deliveringTtsIntervalRef.current);
              }
          };
       } else {
          // Online: Do not play local looping TTS announcements.
          // Play a single success chime locally at the start of delivery request submission as confirmation.
          playSynthSound('success');
       }
    } else {
       if (deliveringTtsIntervalRef.current) {
           clearInterval(deliveringTtsIntervalRef.current);
           deliveringTtsIntervalRef.current = null;
           clearSpeechQueueAndCancel();
       }
    }
    return () => {
       if (deliveringTtsIntervalRef.current) {
           clearInterval(deliveringTtsIntervalRef.current);
       }
    };
  }, [maidDeliveryState, checkActiveOffline, maidRoomInput, maidItemInput]);

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
          } else if (action === 'BOOT_ADMIN_DESKTOP') {
              console.log('Admin Desktop booted via password');
              setShowExitModal(false);
              setExitPassword('');
              setPasswordError(false);
              setPuzzleState('boot_loading');
              setTimeout(() => {
                 setPuzzleState('admin_desktop');
              }, 5000);
          } else if (action === 'TRIGGER_EVENT') {
              console.log('Event Triggered via Password');
              setShowExitModal(false);
              setExitPassword('');
              setPasswordError(false);
              setPuzzleState('browsing_pdf_1');
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
                  exit: savedExit || 'まどれすと',
                  event: savedEvent || 'えべんと',
                  admin: savedAdmin || 'あどみん',
                  setup: savedSetup || 'せっとあっぷ'
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
        setTimerSecondsAndTimestamp(cmd.payload.seconds);
        break;
      case 'STOP_TIMER':
        setTimerSecondsAndTimestamp(null);
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
      case 'PUZZLE_PREPARE': {
        resetPuzzleStateAndInputs();
        setPuzzleState('idle');
        setTimeOverride(null);
        setTimerSecondsAndTimestamp(null);
        setIsPaused(false);
        break;
      }
      case 'PUZZLE_START': {
        resetPuzzleStateAndInputs();
        // Set clock exactly to 23:53:40 of today
        const targetTime = new Date();
        targetTime.setHours(23, 53, 40, 0);
        setTimeOverride(targetTime);

        // Set execution countdown to exactly 7 minutes (420 seconds)
        setTimerSecondsAndTimestamp(420);

        // Transition to idle, then start unskippable video
        setPuzzleState('idle');

        // Trigger start video playback
        startVideoPlayback('start');
        break;
      }
      case 'PHASE_SYNC': {
        const { puzzleState: masterState, timerSeconds: masterSecs, isPaused: masterPaused } = cmd.payload;
        if (masterSecs !== undefined && timerSeconds !== null) {
          if (Math.abs(timerSeconds - masterSecs) > 2) {
            setTimerSecondsAndTimestamp(masterSecs);
          }
        }
        if (masterPaused !== undefined && isPaused !== masterPaused) {
          setIsPaused(masterPaused);
        }
        // Rigorous synchronization of 'idle' state from master
        if (masterState === 'idle' && puzzleState !== 'idle') {
           resetPuzzleStateAndInputs();
           setPuzzleState('idle');
           setTimeOverride(null);
           setTimerSecondsAndTimestamp(null);
           setIsPaused(false);
        }
        // If master is playing and child is idle, transition!
        if (masterState === 'playing' && puzzleState === 'idle' && !videoPlaying) {
          setPuzzleState('locked');
        }
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
        resetPuzzleStateAndInputs();
        setPuzzleState('idle');
        setTimeOverride(null);
        setTimerSecondsAndTimestamp(null);
        setIsPaused(false);
        break;
      case 'PUZZLE_RESTART': {
        resetPuzzleStateAndInputs();
        const targetTime = new Date();
        targetTime.setHours(23, 53, 40, 0);
        setTimeOverride(targetTime);
        setTimerSecondsAndTimestamp(420);

        // Transition to idle, then start unskippable video
        setPuzzleState('idle');

        // Trigger start video playback
        startVideoPlayback('start');
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
        startVideoPlayback('start');
        break;
      }
      case 'PUZZLE_RESULT_CORRECT': {
        startVideoPlayback('correct');
        break;
      }
      case 'PUZZLE_RESULT_CLOSE': {
        startVideoPlayback('close');
        break;
      }
      case 'PUZZLE_RESULT_FAILED': {
        startVideoPlayback('failed');
        break;
      }
      case 'PUZZLE_RESULT_COMMENTARY': {
        startVideoPlayback('commentary');
        break;
      }
      case 'PUZZLE_RETIRE': {
        setPuzzleState('retired');
        break;
      }
      case 'PUZZLE_CANCEL_RETIRE': {
        if (timerSeconds !== null && timerSeconds > 0) {
            setPuzzleState(isEventUnlocked ? 'browsing_pdf_1' : 'locked');
        } else {
            setPuzzleState('idle');
        }
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
    const eventPass = localStorage.getItem('pass_event') || 'えべんと';
    if (verifyPasscode(puzzleInput, eventPass)) {
      playSynthSound('success');
      setPuzzleState('browsing_pdf_1');
      setIsEventUnlocked(true);
      setPuzzleInput('');
      setPuzzleError(false);
      emit('CONNECTION_MSG', { text: 'PUZZLE_UNLOCKED: Correct entry password parsed.' });
    } else {
      setPuzzleError(true);
    }
  };

  const handlePowerVerifyPassword = () => {
    const adminPass = localStorage.getItem('pass_admin') || 'あどみん';
    const exitPass = localStorage.getItem('pass_exit') || 'まどれすと';
    const setupPass = localStorage.getItem('pass_setup') || 'せっとあっぷ';

    // Always allow Exit passcode to close the application in any state/phase!
    if (verifyPasscode(powerInput, exitPass)) {
        playSynthSound('success');
        setShowPowerPrompt(false);
        setPowerInput('');
        setPowerError(false);
        if ((window as any).electron) {
            (window as any).electron.send('EXIT_APP');
        } else {
            alert('System shutdown initiated (Web/Mock).');
        }
        return;
    }

    // Always allow Setup passcode to reset to setup wizard in any state/phase!
    if (verifyPasscode(powerInput, setupPass)) {
        playSynthSound('success');
        setShowPowerPrompt(false);
        setPowerInput('');
        setPowerError(false);
        resetPuzzleStateAndInputs();
        setPuzzleState('idle');
        setOfflineStandbyActive(false);
        setOfflineScheduledTime(null);
        setIsForcedOfflineMode(false);
        setShowSetup(true);
        return;
    }

    // Admin passcode is strictly restricted to active gameplay phases (locked, browsing_pdf_1) and retired state to boot Admin Desktop.
    // It cannot be used during idle, video playback, etc.
    if (verifyPasscode(powerInput, adminPass)) {
        if (puzzleState !== 'locked' && puzzleState !== 'browsing_pdf_1' && puzzleState !== 'retired') {
            setPowerError(true);
            return;
        }

        playSynthSound('success');
        setShowPowerPrompt(false);
        setPowerInput('');
        setPowerError(false);

        setPuzzleState('boot_loading');
        setTimeout(() => {
           setPuzzleState('admin_desktop');
           const isOffline = checkActiveOffline();
           if (!isOffline) {
               emit('CONNECTION_MSG', { text: 'GOV-CORE OS: Admin mode booted successfully.' });
           }
        }, 3000);
        return;
    }

    setPowerError(true);
  };

  const handleMaidDeliver = () => {
     if (maidTimer > 0) return;

     setMaidDeliveryState('testing');

     setTimeout(() => {
         const alreadyDelivered = deliveredItemCodes.includes(maidItemInput);
         if (alreadyDelivered) {
             setMaidDeliveryError("すでに配達済みです");
             setMaidDeliveryState('error');
             setMaidTimer(5);
             return;
         }

         const matched = maidItemsData.find(entry =>
             entry.roomCode.toLowerCase() === maidRoomInput.toLowerCase() &&
             entry.itemCode.toLowerCase() === maidItemInput.toLowerCase()
         );

         if (matched) {
             setMaidDeliveryState('delivering');

             // Check if we are offline (forced or connection lost)
             const isOffline = checkActiveOffline();

             if (!isOffline) {
                 emit('CONNECTION_MSG', {
                     text: `MAID_DELIVERY_REQUEST: Room: "${maidRoomInput}", Item: "${maidItemInput}", ItemName: "${matched.name}"`
                 });
             }
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
     const correctList = puzzleAnswersData.correctPasscodes || [];
     const closeList = puzzleAnswersData.closePasscodes || [];

     let outcome = 'failed';
     if (correctList.some(p => verifyPasscode(executionOverrideInput, p))) {
         outcome = 'correct';
     } else if (closeList.some(p => verifyPasscode(executionOverrideInput, p))) {
         outcome = 'close';
     }

     setGameResult(outcome as any);

     // Send password proposal to Master Console with determined outcome
     emit('CONNECTION_MSG', {
         text: `OVERRIDE_SUBMITTED: Submitted Passcode proposal: "${executionOverrideInput}" [Result: ${outcome}]`
     });
  };

  // Pattern 2 scheduled offline timer handler
  useEffect(() => {
    let interval: any;
    if (offlineStandbyActive && offlineScheduledTime) {
      interval = setInterval(() => {
        const now = new Date();
        const nowH = String(now.getHours()).padStart(2, '0');
        const nowM = String(now.getMinutes()).padStart(2, '0');
        const nowS = String(now.getSeconds()).padStart(2, '0');

        if (nowH === offlineScheduledTime.hour &&
            nowM === offlineScheduledTime.minute &&
            nowS === offlineScheduledTime.second) {

          clearInterval(interval);
          setOfflineStandbyActive(false);

          // Trigger offline auto-start game
          resetPuzzleStateAndInputs();
          const targetTime = new Date();
          targetTime.setHours(23, 53, 40, 0);
          setTimeOverride(targetTime);
          setTimerSecondsAndTimestamp(420);
          setPuzzleState('idle');

          startVideoPlayback('start');
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [offlineStandbyActive, offlineScheduledTime]);


  if (showSetup) {
      return <Setup
          onComplete={() => {
              setShowSetup(false);
              setMasterUrl(localStorage.getItem('masterUrl'));
          }}
          onStartOffline={(targetTime) => {
              setOfflineScheduledTime(targetTime);
              setIsForcedOfflineMode(true);
              setOfflineStandbyActive(true);
              setShowSetup(false);
          }}
          currentTime={timeOverride || time}
      />;
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

  const showBars = !videoPlaying && !offlineStandbyActive && puzzleState !== 'idle' && puzzleState !== 'boot_loading';

  return (
    <OSContext.Provider value={osContextValue}>
    <div className={`relative h-screen w-screen bg-[#050508] text-[#eaeaea] overflow-hidden ${isShaking ? 'animate-shake' : ''} ${isFrozen ? 'pointer-events-none select-none' : ''}`}>

      {/* Offline Standby Overlay Screen (rendered at high-z index, but does not block footer power button) */}
      <AnimatePresence>
          {offlineStandbyActive && offlineScheduledTime && (
               <motion.div
                 initial={{ opacity: 0 }}
                 animate={{ opacity: 1 }}
                 exit={{ opacity: 0 }}
                 className="fixed inset-0 z-[9400] bg-[#050508] flex flex-col items-center justify-center p-6 text-center select-none font-mono"
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
                       <div className="w-16 h-16 bg-red-950/40 rounded-[24px] flex items-center justify-center mb-6 border border-red-500/30 animate-pulse">
                           <Clock className="text-red-500" size={32} />
                       </div>

                       <h2 className="text-xl font-black tracking-[0.2em] text-white uppercase mb-2">OFFLINE_STANDBY</h2>
                       <p className="text-[10px] text-red-500/80 uppercase tracking-[0.1em] font-bold mb-8 max-w-xs leading-relaxed">
                           オフライン開催待機中。指定時刻になると自動的に開始します。
                       </p>

                       <div className="p-4 rounded-xl bg-red-950/20 border border-red-900/30 text-center w-full mb-8">
                           <span className="text-[10px] uppercase text-white/40 tracking-widest block mb-1">開始予定時刻</span>
                           <span className="text-2xl font-mono font-bold text-red-500">
                               {offlineScheduledTime.hour}時{offlineScheduledTime.minute}分{offlineScheduledTime.second}秒
                           </span>
                       </div>
                   </motion.div>
               </motion.div>
          )}
      </AnimatePresence>

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

      {/* Dynamic Warning pulsing crimson vignette for final 60 seconds */}
      {timerSeconds !== null && timerSeconds <= 60 && timerSeconds > 0 && puzzleState !== 'idle' && !isPaused && !videoPlaying && (
          <div className="fixed inset-0 pointer-events-none z-[9999] border-[8px] warning-pulse-border rounded-none" />
      )}

      {/* Post Commentary Exit Screen Overlays */}
      <AnimatePresence>
          {postCommentaryScreen === 'success' && (
               <motion.div
                 initial={{ opacity: 0 }}
                 animate={{ opacity: 1 }}
                 className="fixed inset-0 z-[10100] bg-[#050508] flex flex-col items-center justify-center p-6 text-center select-none"
               >
                    <div className="scanlines z-0" />
                    <div className="absolute inset-0 bg-[radial-gradient(rgba(34,197,94,0.15)_1.5px,transparent_1px)] [background-size:24px_24px] pointer-events-none z-0" />
                    <motion.div
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="max-w-xl w-full glass-panel p-12 border-green-500/50 bg-black/90 flex flex-col items-center gap-8 shadow-[0_0_80px_rgba(34,197,94,0.3)] z-10 border-2 rounded-[36px]"
                    >
                         <div className="w-24 h-24 rounded-full bg-green-500/10 border-2 border-green-500 flex items-center justify-center shadow-[0_0_30px_rgba(34,197,94,0.2)]">
                              <CheckCircle2 className="text-green-400 animate-bounce" size={54} />
                         </div>
                         <div className="space-y-2">
                              <h2 className="text-4xl font-extrabold tracking-[0.3em] text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-300 uppercase">
                                   MISSION SUCCESSFUL
                              </h2>
                              <p className="text-base text-green-400 font-mono tracking-[0.4em] font-black mt-2">
                                   [ 脱出成功 // OVERRIDE ACCEPTED ]
                              </p>
                         </div>
                         <div className="p-6 rounded-2xl bg-green-950/20 border border-green-900/40 text-xs leading-relaxed text-green-400 font-mono text-left w-full space-y-3 shadow-inner">
                              <div className="font-bold border-b border-green-900/30 pb-2">
                                   🎉 MISSION LOG: SYSTEM RECONCILIATION COMPLETE
                              </div>
                              <p>
                                   制限時間内に正しい処刑停止コードを検知・送信し、致死処分シーケンスの完全オーバーライドに成功しました！
                              </p>
                              <p className="text-white/80 font-bold">
                                   【退室のご案内】:
                                   ミッション完了です。スタッフの案内に従い、速やかにご退室ください。お疲れ様でした！
                              </p>
                         </div>
                         <div className="text-[10px] text-white/30 uppercase font-mono tracking-[0.2em] animate-pulse">
                              STATUS: DISPATCH_SECURITY_EXIT_DOOR_OPEN
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
                 className="fixed inset-0 z-[10100] bg-[#050508] flex flex-col items-center justify-center p-6 text-center select-none"
               >
                    <div className="scanlines z-0" />
                    <div className="absolute inset-0 bg-[radial-gradient(rgba(239,68,68,0.15)_1.5px,transparent_1px)] [background-size:24px_24px] pointer-events-none z-0" />
                    <motion.div
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="max-w-xl w-full glass-panel p-12 border-red-500/50 bg-black/90 flex flex-col items-center gap-8 shadow-[0_0_80px_rgba(239,68,68,0.3)] z-10 border-2 rounded-[36px]"
                    >
                         <div className="w-24 h-24 rounded-full bg-red-500/10 border-2 border-red-500 flex items-center justify-center shadow-[0_0_30px_rgba(239,68,68,0.2)]">
                              <ShieldAlert className="text-red-400 animate-pulse" size={54} />
                         </div>
                         <div className="space-y-2">
                              <h2 className="text-4xl font-extrabold tracking-[0.3em] text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-rose-400 uppercase">
                                   MISSION FAILED
                              </h2>
                              <p className="text-base text-red-500 font-mono tracking-[0.4em] font-black mt-2">
                                   [ 脱出失敗 // SYSTEM LOCKED OUT ]
                              </p>
                         </div>
                         <div className="p-6 rounded-2xl bg-red-950/20 border border-red-900/40 text-xs leading-relaxed text-red-400 font-mono text-left w-full space-y-3 shadow-inner">
                              <div className="font-bold border-b border-red-900/30 pb-2">
                                   🚨 ALERT: CORE TERMINATION INITIATED
                              </div>
                              <p>
                                   正しい処刑停止コードが入力されなかったか、制限時間内にシステムをオーバーライドできませんでした。生命維持保護セッションはすべて終了しました。
                              </p>
                              <p className="text-white/80 font-bold">
                                   【退出のご案内】:
                                   タイムアップです。スタッフの指示に従い、退出のご案内をお待ちください。
                              </p>
                         </div>
                         <div className="text-[10px] text-white/30 uppercase font-mono tracking-[0.2em] animate-pulse">
                              STATUS: TERMINAL_SESSION_TERMINATED_PERMANENTLY
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
                              type="text"
                              autoFocus
                              placeholder="ひらがなで入力してください"
                              className={`w-full bg-black/60 border rounded-2xl px-6 py-4 text-center outline-none focus:border-red-950/50 transition-all text-xl font-mono tracking-[0.5em] text-red-500 placeholder-red-900/40 ${puzzleError ? 'border-red-600 shadow-[0_0_15px_rgba(239,68,68,0.2)]' : 'border-red-950/40'}`}
                              value={puzzleInput}
                              onChange={(e) => {
                                  setPuzzleInput(e.target.value);
                                  if (puzzleError) setPuzzleError(false);
                              }}
                              onKeyDown={(e) => e.key === 'Enter' && handleVerifyPuzzlePassword()}
                          />
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

                       {!useMockTimerFallback && getVideoSrc() ? (
                            <video
                              ref={activeVideoRef}
                              src={getVideoSrc()}
                              autoPlay
                              playsInline
                              className="absolute inset-0 w-full h-full object-cover z-0"
                              onTimeUpdate={(e) => {
                                  const el = e.currentTarget;
                                  if (el.duration) {
                                      setVideoProgress((el.currentTime / el.duration) * 100);
                                  }
                              }}
                              onEnded={() => {
                                  handleVideoFinished();
                              }}
                              onError={() => {
                                  console.warn(`Video asset not found or failed to load: ${getVideoSrc()}. Falling back to simulated cyber progress overlay.`);
                                  setUseMockTimerFallback(true);
                              }}
                            />
                       ) : (
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
                       )}

                       {/* Video Progress Overlay in Video Panel */}
                       <div className="absolute bottom-6 inset-x-8 flex items-center gap-6 z-10">
                            <span className="text-[10px] text-white/40 tracking-widest">{String(Math.floor(videoProgress))}%</span>
                            <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                                 <div className="h-full bg-red-500 transition-all duration-100" style={{ width: `${videoProgress}%` }} />
                            </div>
                            <span className="text-[10px] text-white/40 tracking-widest">100%</span>
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
          onFrame={handleCameraFrame}
      />

      {/* 1. Status Bar (Top) */}
      {showBars && (
        <header className="fixed top-0 left-0 w-full h-12 flex items-center justify-between px-8 z-[10000] bg-[#050508]/90 border-b border-red-950/20 backdrop-blur-md">
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
      )}

      {/* 2. Main Area (Center) */}
      <main className="relative h-screen w-full flex items-center justify-center z-10 p-20 pt-20 pb-28">

        {/* State A: browsing_pdf_1 (Fullscreen absolute layout covering everything) */}
        {puzzleState === 'browsing_pdf_1' && (
            <div className="fixed inset-0 pt-12 pb-24 z-50 bg-[#050508] flex flex-col animate-fadeIn">
                <iframe
                   src="./documents/doc1.pdf#toolbar=0"
                   className="w-full h-full border-0 bg-black"
                   title="処刑装置起動手順_LOG_832.pdf"
                />
            </div>
        )}

        {/* State B: admin_desktop (GOV-CORE OS Desktop) */}
        {puzzleState === 'admin_desktop' && (
            <div className="w-full h-full flex gap-8 relative">

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
                                  {/* Mock Execution Override App */}
                                  {openAppId === 'stop_execution' && (
                                      <div className="max-w-xl mx-auto text-center space-y-8 py-4 p-8 rounded-3xl border border-amber-500/30 bg-black/80 shadow-[0_0_60px_rgba(245,158,11,0.15)] relative overflow-hidden">
                                           {/* High Tech Cybernetic Danger Grid line */}
                                           <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-600 via-amber-500 to-red-600 animate-pulse" />

                                           <div className="w-20 h-20 bg-amber-500/10 rounded-[24px] flex items-center justify-center mx-auto border-2 border-amber-500 shadow-[0_0_25px_rgba(245,158,11,0.3)] animate-bounce">
                                               <ShieldAlert className="text-amber-500" size={42} />
                                           </div>
                                           <div>
                                                <h4 className="text-2xl font-extrabold uppercase tracking-[0.2em] text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-500 to-yellow-300">
                                                     緊急致死処分停止シーケンス
                                                </h4>
                                                <p className="text-xs font-black text-amber-500/90 tracking-widest mt-2 uppercase font-mono animate-pulse">
                                                     ⚡ SYSTEM TERMINATION OVERRIDE PROTOCOL
                                                </p>
                                           </div>

                                           {overrideSubmitted ? (
                                               <div className="p-8 bg-amber-950/20 border-2 border-amber-500/40 rounded-2xl flex flex-col items-center gap-4 shadow-[0_0_30px_rgba(245,158,11,0.1)]">
                                                    <CheckCircle2 className="text-amber-400 animate-pulse" size={48} />
                                                    <span className="text-lg font-black text-amber-400 uppercase tracking-widest leading-relaxed">
                                                         {overrideText}
                                                    </span>
                                                    <span className="text-[10px] text-white/50 uppercase font-mono tracking-widest bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
                                                         STATUS: OVERRIDE_RECEPTION_COMPLETE
                                                    </span>
                                               </div>
                                           ) : (
                                               <div className="space-y-6">
                                                    <div className="p-6 rounded-2xl bg-amber-950/20 border border-amber-500/20 text-xs leading-relaxed text-left font-mono space-y-3 shadow-inner">
                                                         <div className="text-amber-400 font-bold text-sm border-b border-amber-500/20 pb-2 flex items-center gap-2">
                                                             <span>🔒 SECURITY OVERRIDE INSTRUCTIONS:</span>
                                                         </div>
                                                         <ul className="space-y-2 text-white/90 list-disc list-inside">
                                                              <li>
                                                                   この暗証コード送信機能は、制限時間が残り <span className="text-amber-400 font-extrabold underline">20秒以下</span> に到達した時のみシステムによりロックが高度解除されます。
                                                              </li>
                                                              <li>
                                                                   送信のチャンスは <span className="text-red-500 font-extrabold underline">1回限り（ワンショット）</span> です。誤入力は許されません。
                                                              </li>
                                                              <li>
                                                                   正しい STOP CODE を入力し、最下部の実行ボタンまたは Enter キーを押してください。
                                                              </li>
                                                         </ul>
                                                    </div>

                                                    <div className="relative">
                                                        <input
                                                           type="text"
                                                           disabled={timerSeconds === null || timerSeconds > 20}
                                                           placeholder={timerSeconds !== null && timerSeconds > 20 ? `🚨 残り ${timerSeconds} 秒でセキュリティ解除 🚨` : "ひらがなで STOP CODE を慎重に入力してください"}
                                                           className={`w-full bg-black/90 border-2 rounded-2xl px-6 py-4 text-center outline-none focus:border-amber-400 text-xl font-extrabold font-mono tracking-[0.4em] text-amber-400 transition-all ${
                                                               (timerSeconds === null || timerSeconds > 20)
                                                               ? 'opacity-40 cursor-not-allowed border-white/5 bg-zinc-950'
                                                               : 'border-amber-500/80 shadow-[0_0_30px_rgba(245,158,11,0.25)] focus:shadow-[0_0_40px_rgba(245,158,11,0.4)]'
                                                           }`}
                                                           value={executionOverrideInput}
                                                           onChange={(e) => {
                                                               setExecutionOverrideInput(e.target.value);
                                                               if (overrideError) setOverrideError(false);
                                                           }}
                                                           onKeyDown={(e) => e.key === 'Enter' && handleVerifyExecutionOverride()}
                                                        />
                                                    </div>

                                                    <button
                                                      disabled={timerSeconds === null || timerSeconds > 20 || overrideSubmitted}
                                                      onClick={handleVerifyExecutionOverride}
                                                      className={`w-full py-4 rounded-2xl font-black uppercase text-xs tracking-[0.2em] transition-all duration-300 ${
                                                          (timerSeconds === null || timerSeconds > 20)
                                                          ? 'bg-white/5 border border-white/5 text-white/20 cursor-not-allowed'
                                                          : 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 border-2 border-amber-400 text-white shadow-[0_0_20px_rgba(245,158,11,0.3)] hover:shadow-[0_0_35px_rgba(245,158,11,0.6)] transform hover:scale-[1.01]'
                                                      }`}
                                                    >
                                                      {timerSeconds !== null && timerSeconds > 20 ? "⚠️ システム保護中 (停止指令待機)" : "⚡ 処刑停止指令を実行 (OVERRIDE START)"}
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

                {/* Right Desktop: Prominent Mock App Icon Buttons */}
                <div className="w-80 flex flex-col gap-4">
                    <div className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] mb-1 px-1">高度管理者用モジュール</div>

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

                    {/* PDF 1 Re-opener icon */}
                    <button
                      onClick={() => setAdminDoc1Open(true)}
                      className="flex items-center gap-4 p-5 rounded-2xl border border-red-500/20 bg-black/40 text-left hover:bg-red-500/10 transition-all text-white/60"
                    >
                         <div className="p-4 bg-red-950/20 rounded-xl text-red-500">
                              <FileText size={24} />
                         </div>
                         <div>
                              <div className="text-xs font-black uppercase tracking-widest text-white">機密データ_LOG_832</div>
                              <span className="text-[8px] text-red-500/60 uppercase font-mono mt-1 block">REOPEN_PDF_DOCUMENT_1</span>
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

      {/* 3. Taskbar & Dock (Bottom) - Always visible on all screens except during Setup wizard */}
      {!showSetup && !showPowerPrompt && !showExitModal && (
      <footer className="fixed bottom-8 left-0 w-full flex justify-center z-[10200]">
        <nav className="glass-panel px-6 py-3.5 flex items-center gap-4 border-red-500/20 bg-black/90 shadow-[0_0_30px_rgba(239,68,68,0.2)]">
            <div className="text-[9px] font-bold text-white/40 uppercase tracking-[0.2em] px-2 font-mono">GOV-CORE DOCK</div>
            <div className="w-[1px] h-6 bg-white/10 mx-1" />
            <button
              onClick={() => {
                 playSynthSound('open');
                 setShowPowerPrompt(true);
              }}
              className="p-3 rounded-2xl text-red-500 hover:text-white hover:bg-red-500/10 transition-all cursor-pointer"
              title="管理者メニュー"
            >
              <Power size={20} />
            </button>
        </nav>
      </footer>
      )}

      {/* Admin Power Button Password Prompt Overlay */}
      <AnimatePresence>
        {showPowerPrompt && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10300] bg-black/85 backdrop-blur-md flex items-center justify-center p-6"
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
                    type="text"
                    autoFocus
                    placeholder="ひらがなで入力してください"
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
            className="fixed inset-0 z-[10300] bg-black/85 backdrop-blur-sm flex items-center justify-center p-6"
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
            className="fixed inset-0 z-[10300] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6"
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
                          type="text"
                          autoFocus
                          placeholder="ひらがなで入力してください"
                          className={`w-full bg-white/5 border rounded-xl px-4 py-3 text-center outline-none focus:border-white/30 transition-all text-sm font-mono tracking-[0.2em] ${passwordError ? 'border-red-500' : 'border-white/10'}`}
                          value={exitPassword}
                          onChange={(e) => {
                              setExitPassword(e.target.value);
                              if (passwordError) setPasswordError(false);
                          }}
                          onKeyDown={(e) => e.key === 'Enter' && handleVerifyPassword()}
                      />
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
                       handleVerifyPassword();
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

      {/* Global Admin Desktop Floating PDF Overlays (Permanently on top of all layers) */}
      <AnimatePresence>
          {puzzleState === 'admin_desktop' && adminPdfOpen && (
              <motion.div
                initial={{ opacity: 0, y: 30, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 30, scale: 0.95 }}
                className="fixed inset-6 z-[10250] glass-panel border-red-950/40 bg-[#050508]/98 p-4 rounded-[32px] flex flex-col overflow-hidden shadow-[0_32px_64px_rgba(0,0,0,0.9)]"
              >
                  <div className="flex items-center justify-between border-b border-white/5 pb-3 px-4 mb-3">
                       <div className="flex items-center gap-3">
                            <FileText className="text-red-500 animate-pulse" size={20} />
                            <div>
                                <h3 className="text-sm font-black text-white uppercase tracking-wider">管理者限定極秘データ_SEC_992.pdf</h3>
                            </div>
                       </div>
                       <button
                         onClick={() => setAdminPdfOpen(false)}
                         className="p-1.5 hover:bg-white/10 rounded-full transition-colors text-white/40 hover:text-white"
                       >
                            <X size={18} />
                       </button>
                  </div>

                  <div className="flex-1 rounded-2xl overflow-hidden bg-zinc-950 relative flex flex-col">
                       <iframe
                         src="./documents/doc2.pdf#toolbar=0"
                         className="w-full h-full border-0"
                         title="管理者限定極秘データ_SEC_992.pdf"
                       />
                  </div>
              </motion.div>
          )}
      </AnimatePresence>

      <AnimatePresence>
          {puzzleState === 'admin_desktop' && adminDoc1Open && (
              <motion.div
                initial={{ opacity: 0, y: 30, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 30, scale: 0.95 }}
                className="fixed inset-6 z-[10250] glass-panel border-red-950/40 bg-[#050508]/98 p-4 rounded-[32px] flex flex-col overflow-hidden shadow-[0_32px_64px_rgba(0,0,0,0.9)]"
              >
                  <div className="flex items-center justify-between border-b border-white/5 pb-3 px-4 mb-3">
                       <div className="flex items-center gap-3">
                            <FileText className="text-red-500 animate-pulse" size={20} />
                            <div>
                                <h3 className="text-sm font-black text-white uppercase tracking-wider">処刑装置起動手順_LOG_832.pdf</h3>
                            </div>
                       </div>
                       <button
                         onClick={() => setAdminDoc1Open(false)}
                         className="p-1.5 hover:bg-white/10 rounded-full transition-colors text-white/40 hover:text-white"
                       >
                            <X size={18} />
                       </button>
                  </div>

                  <div className="flex-1 rounded-2xl overflow-hidden bg-zinc-950 relative flex flex-col">
                       <iframe
                         src="./documents/doc1.pdf#toolbar=0"
                         className="w-full h-full border-0"
                         title="処刑装置起動手順_LOG_832.pdf"
                       />
                  </div>
              </motion.div>
          )}
      </AnimatePresence>
    </div>
    </OSContext.Provider>
  );
};

export default App;
