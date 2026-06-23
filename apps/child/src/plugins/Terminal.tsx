import React from 'react';
import { Terminal as TerminalIcon } from 'lucide-react';

const Terminal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  return (
    <div className="flex flex-col h-full bg-black/80 font-mono text-sm p-4">
      <div className="flex-1 overflow-y-auto mb-2 space-y-1">
        <p className="text-gray-500">MAD-OS Kernel v1.0.4 initialized...</p>
        <p className="text-[#00ff41]">{">"} System ready.</p>
      </div>
    </div>
  );
};

export const TerminalPlugin = {
  id: 'terminal',
  title: 'TERMINAL_CORE',
  icon: <TerminalIcon size={18} />,
  component: Terminal,
};
