import React, { useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { useOS } from '../hooks/useOS';

const ConnectionApp: React.FC = () => {
  const os = useOS();
  const [messages, setMessages] = useState<{role: 'user' | 'system', text: string}[]>([
    { role: 'system', text: 'CONNECTION ESTABLISHED' },
    { role: 'system', text: 'WAITING FOR DATA...' }
  ]);
  const [input, setInput] = useState('');

  const send = () => {
    if (!input.trim()) return;
    const msg = { role: 'user' as const, text: input };
    setMessages(prev => [...prev, msg]);
    os.emit('CONNECTION_MSG', { text: input });
    setInput('');
  };

  return (
    <div className="flex flex-col h-full bg-black/20">
      <div className="flex-1 p-6 overflow-y-auto space-y-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] px-4 py-2 rounded-2xl text-xs tracking-wider ${
              m.role === 'user'
                ? 'bg-white text-black font-bold'
                : 'bg-white/5 text-white/60 border border-white/10'
            }`}>
              {m.text}
            </div>
          </div>
        ))}
      </div>
      <div className="p-6 border-t border-white/5 bg-white/5">
        <div className="flex gap-4">
          <input
            type="text"
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-white/20 text-xs tracking-widest uppercase"
            placeholder="TYPE_COMMAND..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send()}
          />
          <button
            onClick={send}
            className="px-6 rounded-xl bg-white text-black text-[10px] font-black uppercase tracking-[0.2em]"
          >
            SEND
          </button>
        </div>
      </div>
    </div>
  );
};

export const ConnectionPlugin = {
  id: 'connection',
  title: 'CONN_LINK',
  icon: <MessageSquare size={18} />,
  component: ConnectionApp,
};
