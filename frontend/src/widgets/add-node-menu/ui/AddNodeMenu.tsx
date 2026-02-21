import React, { useState } from 'react';
import type { NodeType } from '../../../entities/node-type/model/types';

interface AddNodeMenuProps {
    x: number;
    y: number;
    nodeTypes: NodeType[];
    onSelect: (type: NodeType) => void;
    onClose: () => void;
}

export const AddNodeMenu: React.FC<AddNodeMenuProps> = ({ x, y, nodeTypes, onSelect, onClose }) => {
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

    const categories = Array.from(new Set(nodeTypes.map(n => n.category || 'Other')));
    const filteredNodes = nodeTypes.filter(n => (n.category || 'Other') === selectedCategory);

    return (
        <div
            className="absolute z-[1000] flex bg-surface-800/95 backdrop-blur-2xl border border-[var(--border-base)] rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] overflow-hidden animate-in fade-in zoom-in-95 duration-200 ring-1 ring-black/5 dark:ring-white/5"
            style={{ left: x, top: y }}
            onMouseLeave={onClose}
        >
            <div className="w-48 bg-[var(--border-muted)]/30 border-r border-[var(--border-base)] py-4">
                <div className="px-5 py-2 text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em] opacity-50">Blueprint Categories</div>
                <div className="mt-2 space-y-1 px-2">
                    {categories.map(cat => (
                        <div
                            key={cat}
                            className={`
                                flex items-center justify-between px-3 py-3 rounded-2xl cursor-pointer transition-all text-xs font-bold
                                ${selectedCategory === cat
                                    ? 'bg-brand/10 text-brand ring-1 ring-brand/20'
                                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--border-muted)]'
                                }
                            `}
                            onMouseEnter={() => setSelectedCategory(cat)}
                        >
                            <span>{cat}</span>
                            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-300 ${selectedCategory === cat ? 'translate-x-1' : 'opacity-40'}`}>
                                <polyline points="9 18 15 12 9 6"></polyline>
                            </svg>
                        </div>
                    ))}
                </div>
            </div>

            {selectedCategory && (
                <div className="w-56 py-4 animate-in fade-in slide-in-from-left-4 duration-300 ease-out bg-surface-800">
                    <div className="px-5 py-2 text-[10px] font-black text-brand uppercase tracking-[0.2em] opacity-80">{selectedCategory}</div>
                    <div className="mt-2 space-y-1 px-2">
                        {filteredNodes.map(node => (
                            <div
                                key={node.id}
                                className="px-4 py-3 rounded-2xl cursor-pointer transition-all text-xs font-bold text-[var(--text-main)] hover:text-white hover:bg-brand hover:shadow-xl hover:shadow-brand/20 active:scale-95 group flex items-center gap-2"
                                onClick={() => onSelect(node)}
                            >
                                <div className="w-1.5 h-1.5 rounded-full bg-brand group-hover:bg-white transition-colors"></div>
                                {node.name}
                            </div>
                        ))}
                        {filteredNodes.length === 0 && (
                            <div className="px-4 py-12 text-center">
                                <span className="text-[var(--text-muted)] opacity-30 italic text-xs font-medium">No archetypes found</span>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>

    );
};

