import React, { useState } from 'react';
import {
  Users,
  Send,
  Monitor,
  Terminal,
  Camera,
  AlertTriangle,
  Zap,
  Activity
} from 'lucide-react';

const App: React.FC = () => {
  const [selectedChild, setSelectedChild] = useState<string>('all');
  const [connectedDevices, setConnectedDevices] = useState<string[]>([]);

  React.useEffect(() => {
    if ((window as any).electron) {
      (window as any).electron.on('DEVICES_UPDATED', (devices: string[]) => {
        setConnectedDevices(devices);
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

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-[#00ff41] font-mono flex flex-col p-6 gap-6">
      <header className="flex justify-between items-center border-b border-[#00ff41]/20 pb-4">
        <div className="flex items-center gap-3">
          <Activity className="animate-pulse" />
          <h1 className="text-2xl font-black tracking-tighter">MAD-OS MASTER CONTROL</h1>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-12 gap-6 overflow-hidden">
        <aside className="col-span-3 border border-[#00ff41]/20 rounded-lg p-4 bg-black/40">
          <div className="space-y-2">
            <button
              onClick={() => setSelectedChild('all')}
              className={`w-full text-left px-4 py-2 text-xs border transition-all ${
                selectedChild === 'all' ? 'bg-[#00ff41]/20 border-[#00ff41]' : 'border-[#00ff41]/10 hover:bg-[#00ff41]/5'
              }`}
            >
              ALL_DEVICES ({connectedDevices.length})
            </button>
            {connectedDevices.map(id => (
              <button
                key={id}
                onClick={() => setSelectedChild(id)}
                className={`w-full text-left px-4 py-2 text-[10px] border transition-all truncate ${
                  selectedChild === id ? 'bg-[#00ff41]/20 border-[#00ff41]' : 'border-[#00ff41]/10 hover:bg-[#00ff41]/5'
                }`}
              >
                DEVICE_{id.substring(0, 6)}
              </button>
            ))}
          </div>
        </aside>

        <main className="col-span-9 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => sendCommand('SHAKE_SCREEN')} className="p-4 border border-[#00ff41]/20 hover:bg-[#00ff41]/10">SHAKE_SCREEN</button>
              <button onClick={() => sendCommand('LAUNCH_APP', { appId: 'terminal' })} className="p-4 border border-[#00ff41]/20 hover:bg-[#00ff41]/10">LAUNCH_TERMINAL</button>
            </div>
        </main>
      </div>
    </div>
  );
};

export default App;
