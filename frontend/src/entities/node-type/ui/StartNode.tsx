import { Handle, Position } from 'reactflow';

export function StartNode() {
    return (
        <div className="group relative min-w-[180px] bg-slate-900/90 backdrop-blur-xl border-2 border-emerald-500/50 rounded-2xl p-4 shadow-2xl shadow-emerald-500/10 transition-all hover:border-emerald-500/80 hover:shadow-emerald-500/20">
            <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 border border-emerald-500/30 group-hover:bg-emerald-500/30 transition-colors shadow-inner">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                        <path d="M5 3l14 9-14 9V3z" />
                    </svg>
                </div>
                <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-emerald-500/60 uppercase tracking-widest leading-tight">Entry Point</span>
                    <span className="text-sm font-bold text-white leading-tight">Start Process</span>
                </div>
            </div>

            <p className="text-[11px] text-white/30 font-medium leading-relaxed px-1">
                Workflow begins its execution from this node.
            </p>

            <Handle
                type="source"
                position={Position.Bottom}
                className="!w-3 !h-3 !bg-emerald-500 !border-4 !border-slate-900 !shadow-lg transition-transform hover:scale-125"
            />
        </div>
    );
}

