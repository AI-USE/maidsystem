import React from 'react';

export const DeviceStats = ({ devices }: { devices: any[] }) => {
    return (
        <div className="grid grid-cols-2 gap-4">
            {devices.map(d => (
                <div key={d.id} className="glass-panel p-4 flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-white/40 uppercase">Terminal_{d.id.substring(0, 6)}</span>
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-mono text-white/80">{d.activeApp || 'IDLE'}</span>
                        <div className={`w-2 h-2 rounded-full ${d.online ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
                    </div>
                    {d.submittedPasscode && (
                        <div className="mt-2 pt-2 border-t border-white/5 flex flex-col gap-0.5 text-left">
                            <span className="text-[8px] font-bold text-red-400 uppercase tracking-widest">提出回答コード</span>
                            <span className="text-xs font-mono text-red-500 font-bold bg-red-950/20 px-2 py-1 rounded border border-red-900/30 text-center truncate">{d.submittedPasscode}</span>
                        </div>
                    )}
                </div>
            ))}
        </div>
    )
}
