import { memo, useEffect } from 'react';
import { Handle, Position, useUpdateNodeInternals } from 'reactflow';
import { Icon } from '../../../shared/ui/icon';

/** Branch handle colors cycling through a small palette */

export const DefaultNode = memo(({ id, data, selected }: any) => {
    const updateNodeInternals = useUpdateNodeInternals();
    const maxThan: number = Number(data?.maxThan ?? 0);
    const hasBranching = maxThan >= 2;

    // Force React Flow to recalculate handle bounds when geometry/provider logic changes
    const inputsLength = data.inputs?.length || 0;
    useEffect(() => {
        updateNodeInternals(id);
    }, [data.isRightInputProvider, inputsLength, maxThan, id, updateNodeInternals]);

    return (
        <div
            style={data.isRightInputProvider
                ? { width: 70, height: 70 }
                : { width: 250, minHeight: hasBranching ? 120 : 100 }
            }
            className={`group relative bg-surface-800 border-2 shadow-2xl transition-all animate-in fade-in duration-300 flex flex-col ${data.isRightInputProvider
                ? 'rounded-full items-center justify-center p-0'
                : 'rounded-[1.5rem] p-5'
                } ${data.isActive
                    ? 'border-brand shadow-[0_0_15px_rgba(var(--color-brand),0.5)] ring-2 ring-brand ring-offset-2 ring-offset-surface-900 animate-pulse'
                    : selected
                        ? 'border-brand shadow-brand/20'
                        : 'border-[var(--border-base)] shadow-black/10 hover:border-brand/50'
                }`}
        >
            {data.isRightInputProvider && (
                <div className="absolute -top-[45px] left-1/2 -translate-x-1/2 whitespace-nowrap pointer-events-none z-10">
                    <div className="flex flex-col items-center">
                        {data.isActive && (
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] leading-tight text-brand/80 animate-pulse">
                                Running...
                            </span>
                        )}
                        <span className="text-sm font-black text-[var(--text-main)] drop-shadow-lg">
                            {data.label}
                        </span>
                    </div>
                </div>
            )}

            {data.isRightInputProvider ? (
                <div className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center transition-all shadow-inner ${data.isActive || selected ? 'bg-brand/20 text-brand border-brand/30' : 'bg-surface-700 text-[var(--text-muted)] border-[var(--border-base)] group-hover:bg-brand/10 group-hover:text-brand'
                    }`}>
                    <Icon name={data.isActive ? "clock" : "bolt"} size={24} className={selected ? 'text-brand' : 'text-[var(--text-muted)] group-hover:text-brand'} />
                </div>
            ) : (
                <>
                    <div className="flex items-center gap-3 w-full">
                        <div className={`w-10 h-10 shrink-0 rounded-[1rem] flex items-center justify-center transition-all shadow-inner ${data.isActive || selected ? 'bg-brand/20 text-brand border-brand/30' : 'bg-surface-700 text-[var(--text-muted)] border-[var(--border-base)] group-hover:bg-brand/10 group-hover:text-brand'
                            }`}>
                            <Icon
                                name={data.isActive ? "clock" : (data.icon || 'task')}
                                dir={data.isActive ? 'icons' : 'node_icons'}
                                size={20}
                                className={selected ? 'text-brand' : 'text-[var(--text-muted)] group-hover:text-brand'}
                            />
                        </div>
                        <div className="flex flex-col min-w-0 flex-1">
                            <span className={`text-[10px] font-black uppercase tracking-[0.2em] leading-tight ${data.isActive || selected ? 'text-brand/80' : 'text-[var(--text-muted)]'}`}>
                                {data.isActive ? 'Running...' : hasBranching ? 'Condition' : ''}
                            </span>
                            <span className="text-sm font-black text-[var(--text-main)] leading-tight truncate block w-full">
                                {data.label}
                            </span>
                        </div>
                    </div>

                    {data.params && Object.keys(data.params).length > 0 && (
                        <div className="mt-4 space-y-1.5 opacity-80 overflow-hidden">
                            {Object.entries(data.params)
                                .filter(([key]) => {
                                    const k = key.toLowerCase();
                                    return k !== 'than' && k !== 'max_than' && k !== 'maxthan';
                                })
                                .map(([key, value]) => {
                                    // Find parameter info from node definition if available to check type
                                    const paramInfo = data.parameters?.find((p: any) => p.name === key);
                                    const isAny = paramInfo?.type === 'any';

                                    return (
                                        <div key={key} className="flex items-baseline gap-2 min-w-0">
                                            <span className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-wider shrink-0">{key}:</span>
                                            <span className="text-[10px] font-bold text-[var(--text-main)] truncate">
                                                {isAny ? 'any' : String(value)}
                                            </span>
                                        </div>
                                    );
                                })}
                        </div>
                    )}
                </>
            )}

            {/* Input handles (right edge) dynamically based on input_schema.inputs */}
            {data.inputs && Array.isArray(data.inputs) && data.inputs.length > 0 && !data.isRightInputProvider && (
                <div className="absolute right-0 top-0 bottom-0 flex flex-col justify-center items-end pointer-events-none">
                    {data.inputs.map((input: any) => {
                        return (
                            <div key={input.name} className="relative flex items-center mb-6 last:mb-0 pointer-events-auto" style={{ right: -8 }}>
                                <span className="mr-1 text-[10px] font-bold text-[var(--text-muted)] bg-surface-900 px-1 py-0.5 rounded shadow-sm opacity-80 whitespace-nowrap">
                                    {input.label || input.name}
                                </span>
                                <Handle
                                    type="target"
                                    position={Position.Right}
                                    id={input.name}
                                    style={{
                                        position: 'relative',
                                        transform: 'none',
                                    }}
                                    className={`!w-4 !h-4 !border-[3px] !border-surface-800 !shadow-xl transition-transform hover:scale-125 cursor-crosshair ${selected ? '!bg-brand' : '!bg-[var(--text-muted)]'
                                        }`}
                                />
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Input handle (top) ALWAYS present unless provider */}
            {!data.isRightInputProvider && (
                <Handle
                    key="top-input"
                    type="target"
                    position={Position.Top}
                    id="top"
                    className={`!w-4 !h-4 !border-[3px] !border-surface-800 !shadow-xl transition-transform hover:scale-125 cursor-crosshair ${selected ? '!bg-brand' : '!bg-[var(--text-muted)]'
                        }`}
                />
            )}

            {/* Output handle(s) — single for normal nodes, N for branching nodes */}
            {hasBranching ? (
                Array.from({ length: maxThan }, (_, i) => {
                    const idx = i + 1; // 1-based
                    //const color = BRANCH_COLORS[(i) % BRANCH_COLORS.length];
                    // Distribute handles evenly: left-offset as percentage of node width
                    const totalHandles = maxThan;
                    const leftPct = ((i + 1) / (totalHandles + 1)) * 100;

                    return (
                        <div
                            key={`than_${idx}`}
                            style={{ position: 'absolute', bottom: 0, left: `${leftPct}%`, transform: 'translate(-50%, 50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}
                        >
                            {/* Branch label */}

                            <Handle
                                type="source"
                                position={Position.Bottom}
                                id={`than_${idx}`}
                                style={{
                                    position: 'static',
                                    transform: 'none',
                                }}
                                className={`!w-4 !h-4 !border-[3px] !border-surface-800 !shadow-xl transition-transform hover:scale-125 cursor-crosshair ${selected ? '!bg-brand' : '!bg-[var(--text-muted)]'
                                    }`}
                            />
                        </div>
                    );
                })
            ) : (
                <Handle
                    key={data.isRightInputProvider ? 'left-output' : 'bottom-output'}
                    type="source"
                    id="output"
                    position={data.isRightInputProvider ? Position.Left : Position.Bottom}
                    className={data.isRightInputProvider
                        ? `!w-4 !h-4 !border-[3px] !border-surface-800 !shadow-xl transition-transform hover:scale-125 cursor-crosshair ${selected ? '!bg-brand' : '!bg-[var(--text-muted)]'} !left-0 !-translate-x-1/2`
                        : `!w-4 !h-4 !border-[3px] !border-surface-800 !shadow-xl transition-transform hover:scale-125 cursor-crosshair ${selected ? '!bg-brand' : '!bg-[var(--text-muted)]'}`
                    }
                />
            )}

        </div>
    );
});
