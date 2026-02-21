import React from 'react';
import type { Node } from 'reactflow';
import type { NodeType } from '../../../entities/node-type/model/types';

interface NodePropertiesProps {
    node: Node | null;
    nodeTypes: NodeType[];
    onChange: (nodeId: string, params: any) => void;
    onClose: () => void;
    isReadOnly?: boolean;
}

export const NodeProperties: React.FC<NodePropertiesProps> = ({
    node,
    nodeTypes,
    onChange,
    onClose,
    isReadOnly = false,
}) => {
    if (!node) return null;

    const nodeTypeData = nodeTypes.find(t => t.name === node.data.label);
    const parameters = nodeTypeData?.parameters || [];

    if (parameters.length === 0) return null;

    const handleChange = (name: string, value: any) => {
        const currentParams = node.data.params || {};
        const newParams = { ...currentParams, [name]: value };
        onChange(node.id, newParams);
    };

    return (
        <aside className="absolute bottom-6 right-6 w-80 max-h-[calc(100%-3rem)] bg-surface-800/90 backdrop-blur-xl border border-[var(--border-base)] rounded-2xl flex flex-col shadow-2xl z-[100] animate-in slide-in-from-right-4 fade-in duration-300 ring-1 ring-black/5 dark:ring-white/5">
            <header className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-base)]">
                <div className="flex flex-col">
                    <h3 className="text-xs font-bold text-brand uppercase tracking-widest">Properties</h3>
                    <p className="text-[10px] text-[var(--text-muted)] font-mono mt-0.5">{node.data.label}</p>
                </div>
                <button
                    className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--border-muted)] transition-all"
                    onClick={onClose}
                    aria-label="Close properties"
                >
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </header>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                <div className="space-y-4">
                    <div className="px-1 text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-[0.2em] opacity-40">Configuration</div>

                    {parameters.length > 0 ? (
                        <div className="space-y-5">
                            {parameters.map((param: any) => (
                                <div key={param.name} className="space-y-2 group">
                                    <div className="flex items-center justify-between">
                                        <label
                                            htmlFor={`param-${param.name}`}
                                            className="text-xs font-medium text-[var(--text-main)] opacity-70 group-focus-within:text-brand transition-colors"
                                        >
                                            {param.label}
                                        </label>
                                        {param.type === 'boolean' && (
                                            <div
                                                className={`relative inline-flex h-5 w-9 shrink-0 ${isReadOnly ? 'cursor-default opacity-50' : 'cursor-pointer'} items-center rounded-full transition-colors focus-within:ring-2 focus-within:ring-brand focus-within:ring-offset-2 ${node.data.params?.[param.name] ? 'bg-brand' : 'bg-[var(--border-base)]'}`}
                                                onClick={() => !isReadOnly && handleChange(param.name, !(node.data.params?.[param.name] ?? false))}
                                            >
                                                <input
                                                    id={`param-${param.name}`}
                                                    type="checkbox"
                                                    checked={node.data.params?.[param.name] ?? false}
                                                    onChange={(e) => !isReadOnly && handleChange(param.name, e.target.checked)}
                                                    className="sr-only"
                                                    disabled={isReadOnly}
                                                />
                                                <div
                                                    className={`
                                            pointer-events-none block h-3.5 w-3.5 rounded-full bg-white shadow ring-0 transition-transform
                                            ${node.data.params?.[param.name] ? 'translate-x-4.5' : 'translate-x-1'}
                                        `}
                                                />
                                            </div>
                                        )}
                                    </div>

                                    {param.type !== 'boolean' && (
                                        <input
                                            id={`param-${param.name}`}
                                            type={param.type === 'number' ? 'number' : 'text'}
                                            value={node.data.params?.[param.name] ?? ''}
                                            onChange={(e) => handleChange(param.name, param.type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value)}
                                            placeholder={`Enter ${param.label.toLowerCase()}...`}
                                            className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-app)] border border-[var(--border-base)] text-xs text-[var(--text-main)] placeholder:text-[var(--text-muted)] opacity-80 focus:opacity-100 focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    (e.target as HTMLInputElement).blur();
                                                }
                                            }}
                                            disabled={isReadOnly}
                                        />
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-8">
                            <div className="text-[var(--text-muted)] italic text-xs">No parameters available</div>
                        </div>
                    )}
                </div>
            </div>

            <footer className="px-6 py-4 bg-[var(--border-muted)] border-t border-[var(--border-base)]">
                {!isReadOnly && (
                    <div className="flex items-center gap-2 text-[10px] text-[var(--text-muted)]">
                        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="16" x2="12" y2="12"></line>
                            <line x1="12" y1="8" x2="12.01" y2="8"></line>
                        </svg>
                        <span>Changes are saved automatically</span>
                    </div>
                )}
            </footer>
        </aside>
    );
};


