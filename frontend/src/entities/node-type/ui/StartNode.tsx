import { Handle, Position } from 'reactflow';
import { Icon } from '../../../shared/ui/icon';

export function StartNode({ data, selected }: any) {
    return (
        <div
            style={{ width: 220, minHeight: 80 }}
            className={`group relative bg-surface-700 border rounded-xl p-3 shadow-md transition-all animate-in fade-in duration-300 ${data?.isActive
                ? 'border-brand shadow-[0_0_10px_rgba(var(--color-brand),0.3)]'
                : selected
                    ? 'border-brand shadow-brand/20'
                    : 'border-[var(--border-base)] shadow-black/5 hover:border-brand/40'
                }`}
        >
            <div className="flex items-center gap-2 pb-2 mb-2 border-b border-[var(--border-base)]/50">
                <div className="text-brand shrink-0">
                    {data?.isActive ? (
                        <Icon name="clock" size={16} className="animate-pulse" />
                    ) : (
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                            <path d="M5 3l14 9-14 9V3z" />
                        </svg>
                    )}
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-sm font-semibold text-brand truncate block w-full">Start Process</span>
                </div>
            </div>

            <p className="text-[10px] text-[var(--text-muted)] font-medium leading-tight opacity-80 group-hover:opacity-100 transition-opacity">
                {data?.isActive ? 'Running initialization...' : 'The beginning of your automated workflow logic.'}
            </p>

            <Handle
                type="source"
                position={Position.Bottom}
                className="!w-4 !h-4 !bg-brand !border-[3px] !border-surface-800 !shadow-xl transition-transform hover:scale-125 cursor-crosshair"
            />
        </div>
    );
}


