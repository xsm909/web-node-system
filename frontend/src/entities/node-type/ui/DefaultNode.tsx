import { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { Icon } from '../../../shared/ui/icon';

export const DefaultNode = memo(({ data, selected }: any) => {
    return (
        <div
            style={{ width: 250, height: 100 }}
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
                        {data.isActive ? 'Running...' : 'Action'}
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

            <Handle
                type="target"
                position={Position.Top}
                className={`!w-4 !h-4 !border-[3px] !border-surface-800 !shadow-xl transition-transform hover:scale-125 cursor-crosshair ${selected ? '!bg-brand' : '!bg-[var(--text-muted)]'
                    }`}
            />
            <Handle
                type="source"
                position={Position.Bottom}
                className={`!w-4 !h-4 !border-[3px] !border-surface-800 !shadow-xl transition-transform hover:scale-125 cursor-crosshair ${selected ? '!bg-brand' : '!bg-[var(--text-muted)]'
                    }`}
            />
        </div>
    );
});
