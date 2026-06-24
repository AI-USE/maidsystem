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
                </div>
            ))}
        </div>
    )
}
