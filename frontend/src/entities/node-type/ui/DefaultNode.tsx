import { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { Icon } from '../../../shared/ui/icon';

/** Branch handle colors cycling through a small palette */
const BRANCH_COLORS = [
    '#f59e0b', // amber
    '#3b82f6', // blue
    '#a855f7', // purple
    '#10b981', // emerald
    '#ef4444', // red
    '#06b6d4', // cyan
];

export const DefaultNode = memo(({ data, selected }: any) => {
    const maxThan: number = Number(data?.maxThan ?? 0);
    const hasBranching = maxThan >= 2;

    return (
        <div
            style={{ width: 250, minHeight: hasBranching ? 120 : 100 }}
            className={`group relative bg-surface-800 border-2 rounded-[1.5rem] shadow-2xl transition-all animate-in fade-in duration-300 flex flex-col p-5 ${data.isActive
                ? 'border-brand shadow-[0_0_15px_rgba(var(--color-brand),0.5)] ring-2 ring-brand ring-offset-2 ring-offset-surface-900 animate-pulse'
                : selected
                    ? 'border-brand shadow-brand/20'
                    : 'border-[var(--border-base)] shadow-black/10 hover:border-brand/50'
                }`}
        >
            <div className="flex items-center gap-3 w-full">
                <div className={`w-10 h-10 shrink-0 rounded-[1rem] flex items-center justify-center transition-all shadow-inner ${data.isActive || selected ? 'bg-brand/20 text-brand border-brand/30' : 'bg-surface-700 text-[var(--text-muted)] border-[var(--border-base)] group-hover:bg-brand/10 group-hover:text-brand'
                    }`}>
                    <Icon name={data.isActive ? "clock" : "bolt"} size={20} className={selected ? 'text-brand' : 'text-[var(--text-muted)] group-hover:text-brand'} />
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                    <span className={`text-[10px] font-black uppercase tracking-[0.2em] leading-tight ${data.isActive || selected ? 'text-brand/80' : 'text-[var(--text-muted)]'}`}>
                        {data.isActive ? 'Running...' : hasBranching ? 'Condition' : 'Action'}
                    </span>
                    <span className="text-sm font-black text-[var(--text-main)] leading-tight truncate block w-full">
                        {data.label}
                    </span>
                </div>
            </div>

            {data.params && Object.keys(data.params).length > 0 && (
                <div className="mt-auto pt-3 flex items-center justify-between opacity-60">
                    <span className="text-[10px] font-bold text-[var(--text-muted)]">
                        {Object.keys(data.params).length} Parameters
                    </span>
                    <div className="flex gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)]"></div>
                        <div className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)] opacity-70"></div>
                        <div className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)] opacity-40"></div>
                    </div>
                </div>
            )}

            {/* Branching indicator */}
            {hasBranching && (
                <div className="mt-2 flex items-center gap-1">
                    <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--text-muted)] opacity-50">
                        <line x1="6" y1="3" x2="6" y2="15" />
                        <circle cx="18" cy="6" r="3" />
                        <circle cx="6" cy="18" r="3" />
                        <path d="M18 9a9 9 0 0 1-9 9" />
                    </svg>
                    <span className="text-[9px] font-bold text-[var(--text-muted)] opacity-50 uppercase tracking-widest">
                        {maxThan} branches
                    </span>
                </div>
            )}

            {/* Input handle (top) */}
            <Handle
                type="target"
                position={Position.Top}
                className={`!w-4 !h-4 !border-[3px] !border-surface-800 !shadow-xl transition-transform hover:scale-125 cursor-crosshair ${selected ? '!bg-brand' : '!bg-[var(--text-muted)]'
                    }`}
            />

            {/* Output handle(s) — single for normal nodes, N for branching nodes */}
            {hasBranching ? (
                Array.from({ length: maxThan }, (_, i) => {
                    const idx = i + 1; // 1-based
                    const color = BRANCH_COLORS[(i) % BRANCH_COLORS.length];
                    // Distribute handles evenly: left-offset as percentage of node width
                    const totalHandles = maxThan;
                    const leftPct = ((i + 1) / (totalHandles + 1)) * 100;

                    return (
                        <div
                            key={`than_${idx}`}
                            style={{ position: 'absolute', bottom: -22, left: `${leftPct}%`, transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}
                        >
                            {/* Branch label */}
                            <span
                                style={{ fontSize: 9, fontWeight: 900, color, opacity: 0.9, letterSpacing: '0.1em', userSelect: 'none' }}
                            >
                                {idx}
                            </span>
                            <Handle
                                type="source"
                                position={Position.Bottom}
                                id={`than_${idx}`}
                                style={{
                                    position: 'static',
                                    transform: 'none',
                                    width: 14,
                                    height: 14,
                                    background: color,
                                    border: '3px solid var(--surface-800, #1e1e2e)',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                                    cursor: 'crosshair',
                                    borderRadius: '50%',
                                    flexShrink: 0,
                                }}
                            />
                        </div>
                    );
                })
            ) : (
                <Handle
                    type="source"
                    position={Position.Bottom}
                    className={`!w-4 !h-4 !border-[3px] !border-surface-800 !shadow-xl transition-transform hover:scale-125 cursor-crosshair ${selected ? '!bg-brand' : '!bg-[var(--text-muted)]'
                        }`}
                />
            )}
        </div>
    );
});
