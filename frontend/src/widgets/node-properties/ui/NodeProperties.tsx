import React from 'react';
import type { Node } from 'reactflow';
import type { NodeType } from '../../../entities/node-type/model/types';

interface NodePropertiesProps {
    node: Node | null;
    nodeTypes: NodeType[];
    onChange: (nodeId: string, params: any) => void;
    onClose: () => void;
}

export const NodeProperties: React.FC<NodePropertiesProps> = ({
    node,
    nodeTypes,
    onChange,
    onClose,
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
        <aside className="absolute bottom-6 right-6 w-80 max-h-[calc(100%-3rem)] bg-surface-800/90 backdrop-blur-xl border border-white/10 rounded-2xl flex flex-col shadow-2xl z-[100] animate-in slide-in-from-right-4 fade-in duration-300 ring-1 ring-white/5">
            <header className="flex items-center justify-between px-6 py-4 border-b border-white/5">
                <div className="flex flex-col">
                    <h3 className="text-xs font-bold text-brand uppercase tracking-widest">Properties</h3>
                    <p className="text-[10px] text-white/40 font-mono mt-0.5">{node.data.label}</p>
                </div>
                <button
                    className="p-1.5 rounded-lg text-white/20 hover:text-white hover:bg-white/5 transition-all"
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
                    <div className="px-1 text-[9px] font-bold text-white/20 uppercase tracking-[0.2em]">Configuration</div>

                    {parameters.length > 0 ? (
                        <div className="space-y-5">
                            {parameters.map((param: any) => (
                                <div key={param.name} className="space-y-2 group">
                                    <div className="flex items-center justify-between">
                                        <label
                                            htmlFor={`param-${param.name}`}
                                            className="text-xs font-medium text-white/60 group-focus-within:text-brand transition-colors"
                                        >
                                            {param.label}
                                        </label>
                                        {param.type === 'boolean' && (
                                            <div className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full bg-white/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface-800">
                                                <input
                                                    id={`param-${param.name}`}
                                                    type="checkbox"
                                                    checked={node.data.params?.[param.name] ?? false}
                                                    onChange={(e) => handleChange(param.name, e.target.checked)}
                                                    className="sr-only"
                                                />
                                                <div
                                                    className={`
                                                        pointer-events-none block h-4 w-4 rounded-full bg-white shadow ring-0 transition-transform
                                                        ${node.data.params?.[param.name] ? 'translate-x-4 bg-brand' : 'translate-x-1 opacity-20'}
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
                                            className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-brand/50 focus:border-brand/50 transition-all font-medium"
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    (e.target as HTMLInputElement).blur();
                                                }
                                            }}
                                        />
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-8">
                            <div className="text-white/10 italic text-xs">No parameters available</div>
                        </div>
                    )}
                </div>
            </div>

            <footer className="px-6 py-4 bg-white/[0.01] border-t border-white/5">
                <div className="flex items-center gap-2 text-[10px] text-white/20">
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="16" x2="12" y2="12"></line>
                        <line x1="12" y1="8" x2="12.01" y2="8"></line>
                    </svg>
                    <span>Changes are saved automatically</span>
                </div>
            </footer>
        </aside>
    );
};

