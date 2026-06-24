import React, { useState, useEffect } from 'react';
import { useOS } from '../hooks/useOS';

interface TerminalProps {
  onClose: () => void;
  remoteLogs?: string[];
}

const Terminal: React.FC<TerminalProps> = ({ remoteLogs = [] }) => {
  const { closeApp } = useOS();
  const [logs, setLogs] = useState<string[]>([
    'MAD-OS KERNEL V1.1 INITIALIZED',
    'SECURITY LAYER ACTIVE',
    'WAITING FOR INPUT...'
  ]);
  const [pendingLogs, setPendingLogs] = useState<string[]>([]);
  const [typingLog, setTypingLog] = useState<string>('');
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    const lastRemote = remoteLogs[remoteLogs.length - 1];
    if (lastRemote && !logs.includes(lastRemote) && !pendingLogs.includes(lastRemote)) {
      setPendingLogs(prev => [...prev, lastRemote]);
    }
  }, [remoteLogs]);

  useEffect(() => {
    if (!isTyping && pendingLogs.length > 0) {
      const next = pendingLogs[0];
      setPendingLogs(prev => prev.slice(1));
      startTyping(next);
    }
  }, [isTyping, pendingLogs]);

  const startTyping = (text: string) => {
    setIsTyping(true);
    let current = '';
    const interval = setInterval(() => {
      if (current.length < text.length) {
        current = text.substring(0, current.length + 1);
        setTypingLog(current);
      } else {
        clearInterval(interval);
        setLogs(prev => [...prev, text]);
        setTypingLog('');
        setIsTyping(false);
      }
    }, 30);
  };

  return (
    <div className="flex flex-col h-full bg-[#050505]/50 font-mono text-[11px] p-6 text-white/70">
      <div className="flex-1 overflow-y-auto space-y-2">
        {logs.map((log, i) => (
          <div key={i} className="flex gap-4">
            <span className="text-white/20">[{new Date().toLocaleTimeString()}]</span>
            <span className={log.startsWith('ERR') ? 'text-red-400' : 'text-white/60'}>{log}</span>
          </div>
        ))}
        {typingLog && (
          <div className="flex gap-4">
            <span className="text-white/20">[{new Date().toLocaleTimeString()}]</span>
            <span className="text-white/80">{typingLog}</span>
          </div>
        )}
        <div className="flex gap-2 text-white/40 animate-pulse">
          <span>{'>'}</span>
          <span className="w-2 h-4 bg-white/40" />
        </div>
      </div>
    </div>
  );
};

export const TerminalPlugin = {
  id: 'terminal',
  title: 'CORE_TERMINAL',
  icon: <div className="w-5 h-5 border border-current rounded flex items-center justify-center text-[10px] font-bold">T</div>,
  component: Terminal,
};
