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
            className="absolute z-[1000] flex bg-surface-800/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 ring-1 ring-white/5"
            style={{ left: x, top: y }}
            onMouseLeave={onClose}
        >
            <div className="w-48 bg-white/[0.02] border-r border-white/5 py-3">
                <div className="px-4 py-2 text-[10px] font-bold text-white/20 uppercase tracking-[0.2em]">Categories</div>
                <div className="mt-1 space-y-0.5 px-2">
                    {categories.map(cat => (
                        <div
                            key={cat}
                            className={`
                                flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition-all text-xs font-medium
                                ${selectedCategory === cat
                                    ? 'bg-brand/10 text-brand'
                                    : 'text-white/60 hover:text-white hover:bg-white/5'
                                }
                            `}
                            onMouseEnter={() => setSelectedCategory(cat)}
                        >
                            <span>{cat}</span>
                            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="opacity-40">
                                <polyline points="9 18 15 12 9 6"></polyline>
                            </svg>
                        </div>
                    ))}
                </div>
            </div>

            {selectedCategory && (
                <div className="w-56 py-3 animate-in fade-in slide-in-from-left-2 duration-200">
                    <div className="px-4 py-2 text-[10px] font-bold text-white/20 uppercase tracking-[0.2em]">{selectedCategory}</div>
                    <div className="mt-1 space-y-0.5 px-2">
                        {filteredNodes.map(node => (
                            <div
                                key={node.id}
                                className="px-3 py-2.5 rounded-xl cursor-pointer transition-all text-xs font-medium text-white/80 hover:text-white hover:bg-brand hover:shadow-lg hover:shadow-brand/20 active:scale-[0.98]"
                                onClick={() => onSelect(node)}
                            >
                                {node.name}
                            </div>
                        ))}
                        {filteredNodes.length === 0 && (
                            <div className="px-4 py-8 text-center">
                                <span className="text-white/20 italic text-xs">Empty category</span>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

