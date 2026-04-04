import { memo, useEffect } from 'react';
import { Handle, Position, useUpdateNodeInternals } from 'reactflow';
import { Icon } from '../../../shared/ui/icon';

import { AppValuePreview } from '../../../shared/ui/app-value-preview';

/** Branch handle colors cycling through a small palette */

export const DefaultNode = memo(({ id, data, selected }: any) => {
    const updateNodeInternals = useUpdateNodeInternals();
    const maxThen: number = Number(data?.extractedMaxThen ?? data?.maxThen ?? data?.params?.MAX_THEN ?? data?.maxThan ?? 0);
    const defaultOutput: boolean = !!(data?.extractedDefaultOutput ?? data?.params?.DEFAULT_OUTPUT);
    const customOutput: boolean = !!(data?.extractedCustomOutput ?? data?.params?.CUSTOM_OUTPUT);
    const isCustomMode = customOutput;

    // Force React Flow to recalculate handle bounds when geometry/provider logic changes
    const inputsLength = data.inputs?.length || 0;
    const nodeIcon = data.icon || 'task';
    useEffect(() => {
        updateNodeInternals(id);
    }, [data.isRightInputProvider, inputsLength, maxThen, id, updateNodeInternals]);

    return (
        <div
            style={data.isRightInputProvider
                ? { width: 70, height: 70 }
                : { width: 220, minHeight: isCustomMode ? 100 : 80 }
            }
            className={`group relative bg-surface-700 border shadow-md transition-all animate-in fade-in duration-300 flex flex-col ${data.isRightInputProvider
                ? 'rounded-full items-center justify-center p-0'
                : 'rounded-xl p-3'
                } ${data.isActive
                    ? 'border-brand shadow-[0_0_10px_rgba(var(--color-brand),0.3)]'
                    : selected
                        ? 'border-brand shadow-brand/20'
                        : 'border-[var(--border-base)] shadow-black/5 hover:border-brand/40'
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
                        <span className="text-sm font-semibold text-[var(--text-main)] drop-shadow-lg">
                            {data.label}
                        </span>
                    </div>
                </div>
            )}

            {data.isRightInputProvider ? (
                <div className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center transition-all ${data.isActive || selected ? 'text-brand' : 'text-[var(--text-muted)] group-hover:text-brand'
                    }`}>
                    <Icon
                        name={data.isActive ? "clock" : nodeIcon}
                        dir={data.isActive ? 'icons' : 'node_icons'}
                        size={24}
                        className={selected ? 'text-brand' : 'text-[var(--text-muted)] group-hover:text-brand'}
                    />
                </div>
            ) : (
                <>
                    <div 
                        className="flex items-center gap-2 w-full pb-2 mb-2 border-b border-[var(--border-base)]/50 cursor-pointer"
                        onDoubleClick={(e) => {
                            e.stopPropagation();
                            if (data.onDoubleClick) {
                                data.onDoubleClick(e, { id, data, type: data.type });
                            }
                        }}
                    >
                        <Icon
                            name={data.isActive ? "clock" : (data.icon || 'task')}
                            dir={data.isActive ? 'icons' : 'node_icons'}
                            size={16}
                            className="text-brand"
                        />
                        <div className="flex flex-col min-w-0 flex-1">
                            <span className="text-sm font-semibold text-brand leading-tight truncate block w-full">
                                {data.label}
                            </span>
                        </div>
                    </div>

                    {data.params && Object.keys(data.params).length > 0 && (
                        <div className="space-y-1 opacity-90 overflow-hidden">
                            {Object.entries(data.params)
                                .filter(([key]) => !(/^[A-Z0-9_]+$/.test(key)) && !key.startsWith('_DISPLAY_'))
                                .map(([key, value]) => {
                                    // Find parameter info from node definition if available to check type
                                    const paramInfo = data.parameters?.find((p: any) => p.name === key);
                                    const isAny = paramInfo?.type === 'any';

                                    // Prefer display value if it exists
                                    const displayValue = data.params[`_DISPLAY_${key}`];
                                    const finalValue = displayValue !== undefined ? displayValue : (isAny ? 'any' : value);

                                    return (
                                        <div key={key} className="flex items-baseline gap-2 min-w-0">
                                            <span className="text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-tight shrink-0">{key}:</span>
                                            <AppValuePreview 
                                                value={finalValue} 
                                                parameterName={key} 
                                                paramDef={paramInfo}
                                                nodeTypeId={data.nodeTypeId}
                                                allParams={data.params}
                                                label={paramInfo?.label || key}
                                                onSelect={data.onSelect}
                                                onSave={data.onUpdateParams ? (val: any, displayLabel?: string) => {
                                                    const nextParams = { ...data.params, [key]: val };
                                                    const displayKey = `_DISPLAY_${key}`;
                                                    if (displayLabel) {
                                                        nextParams[displayKey] = displayLabel;
                                                    } else {
                                                        delete nextParams[displayKey];
                                                    }
                                                    data.onUpdateParams(nextParams);
                                                } : undefined}
                                                isLocked={data.isLocked}
                                                className="flex-1" 
                                                workflowParameters={data.workflowParameters}
                                            />
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

            {/* Output handles distribution */}
            {(() => {
                const totalHandles = (isCustomMode ? maxThen : 0) + ((defaultOutput || !isCustomMode) ? 1 : 0);
                if (totalHandles === 0) return null;

                const handles = [];

                // 1. Default output handle (first if enabled OR if in classic mode)
                if (defaultOutput || !isCustomMode) {
                    const slot = 1;
                    const leftPct = (slot / (totalHandles + 1)) * 100;
                    handles.push(
                        <Handle
                            key="output"
                            type="source"
                            id="output"
                            position={data.isRightInputProvider ? Position.Left : Position.Bottom}
                            style={!data.isRightInputProvider ? { left: `${leftPct}%` } : {}}
                            className={data.isRightInputProvider
                                ? `!w-4 !h-4 !border-[3px] !border-surface-800 !shadow-xl transition-transform hover:scale-125 cursor-crosshair ${selected ? '!bg-brand' : '!bg-[var(--text-muted)]'} !left-0 !-translate-x-1/2`
                                : `!w-4 !h-4 !border-[3px] !border-surface-800 !shadow-xl transition-transform hover:scale-125 cursor-crosshair ${selected ? '!bg-brand' : '!bg-[var(--text-muted)]'}`
                            }
                        />
                    );
                }

                // 2. Branch handles (only in custom mode)
                if (isCustomMode) {
                    for (let i = 0; i < maxThen; i++) {
                        const idx = i + 1;
                        const slot = (defaultOutput || !isCustomMode) ? i + 2 : i + 1;
                        const leftPct = (slot / (totalHandles + 1)) * 100;

                        let label = String(idx);
                        if (data.params) {
                            const prefix = `THEN${idx}_`;
                            const matchingKey = Object.keys(data.params).find(k => k.startsWith(prefix) && /^[A-Z0-9_]+$/.test(k));
                            if (matchingKey) {
                                label = matchingKey.substring(prefix.length).replace(/_/g, ' ');
                            }
                        }

                        handles.push(
                            <div
                                key={`then_${idx}`}
                                style={{
                                    position: 'absolute',
                                    bottom: -10,
                                    left: `${leftPct}%`,
                                    transform: 'translate(-50%, 50%)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: 4
                                }}
                            >
                                <Handle
                                    type="source"
                                    position={Position.Bottom}
                                    id={`then_${idx}`}
                                    style={{
                                        position: 'static',
                                        transform: 'none',
                                    }}
                                    className={`!w-4 !h-4 !border-[3px] !border-surface-800 !shadow-xl transition-transform hover:scale-125 cursor-crosshair ${selected ? '!bg-brand' : '!bg-[var(--text-muted)]'}`}
                                />
                                <span className="text-[10px] font-bold text-[var(--text-main)] bg-surface-900/80 backdrop-blur-md border border-[var(--border-base)] px-2 py-0.5 rounded-full shadow-lg whitespace-nowrap mt-1 min-w-[20px] text-center">
                                    {label}
                                </span>
                            </div>
                        );
                    }
                }

                return handles;
            })()}

        </div>
    );
});
