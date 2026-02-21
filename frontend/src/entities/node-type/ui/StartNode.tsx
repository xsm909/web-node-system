import { Handle, Position } from 'reactflow';

export function StartNode({ selected }: any) {
    return (
        <div
            style={{ width: 250, height: 130 }}
            className={`group relative bg-surface-800 border-2 rounded-[1.5rem] p-5 shadow-2xl transition-all hover:border-emerald-500 hover:shadow-emerald-500/20 animate-in fade-in duration-300 ${selected ? 'border-emerald-500 shadow-emerald-500/20' : 'border-emerald-500/40 shadow-emerald-500/5'
                }`}
        >
            <div className="flex items-center gap-4 mb-2">
                <div className="w-10 h-10 rounded-[1rem] bg-emerald-500/10 flex items-center justify-center text-emerald-500 border border-emerald-500/20 group-hover:bg-emerald-500/20 transition-all shadow-inner">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" className="animate-pulse">
                        <path d="M5 3l14 9-14 9V3z" />
                    </svg>
                </div>
                <div className="flex flex-col">
                    <span className="text-[10px] font-black text-emerald-500/80 uppercase tracking-[0.2em] leading-tight">Initialization</span>
                    <span className="text-sm font-black text-[var(--text-main)] leading-tight">Start Process</span>
                </div>
            </div>

            <p className="text-[11px] text-[var(--text-muted)] font-bold leading-relaxed px-1 opacity-60 group-hover:opacity-100 transition-opacity">
                The absolute beginning of your automated workflow logic.
            </p>

            <Handle
                type="source"
                position={Position.Bottom}
                className="!w-4 !h-4 !bg-emerald-500 !border-[3px] !border-surface-800 !shadow-xl transition-transform hover:scale-125 cursor-crosshair"
            />
        </div>
    );
}


