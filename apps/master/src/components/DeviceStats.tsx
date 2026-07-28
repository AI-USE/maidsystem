import React from 'react';

export const DeviceStats = ({ devices, isPuzzleActive }: { devices: any[]; isPuzzleActive: boolean }) => {
    return (
        <div className="grid grid-cols-2 gap-4">
            {devices.map(d => {
                const isCommError = isPuzzleActive && !d.online;
                return (
                    <div key={d.id} className={`glass-panel p-4 flex flex-col gap-1 transition-all ${isCommError ? 'border-red-500 bg-red-950/25 animate-pulse' : ''}`}>
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] font-bold text-white/40 uppercase">{d.name || `Terminal_${d.id.substring(0, 6)}`}</span>
                            {isCommError && (
                                <span className="text-[8px] font-bold text-red-500 uppercase tracking-widest animate-bounce">
                                    通信エラー
                                </span>
                            )}
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-mono text-white/80">{d.activeApp || 'IDLE'}</span>
                            <div className={`w-2 h-2 rounded-full ${d.online ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
                        </div>
                        {isCommError && (
                            <div className="mt-1 text-[9px] font-bold text-red-400 uppercase tracking-tight font-mono text-center bg-red-900/30 py-1 rounded border border-red-500/20">
                                CONNECTION ERROR
                            </div>
                        )}
                        {d.submittedPasscode && (
                            <div className="mt-2 pt-2 border-t border-white/5 flex flex-col gap-0.5 text-left">
                                <span className="text-[8px] font-bold text-red-400 uppercase tracking-widest">提出回答コード</span>
                                <span className="text-xs font-mono text-red-500 font-bold bg-red-950/20 px-2 py-1 rounded border border-red-900/30 text-center truncate">{d.submittedPasscode}</span>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};
