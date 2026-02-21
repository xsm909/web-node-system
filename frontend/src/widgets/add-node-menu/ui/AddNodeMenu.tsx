import React, { useState, useMemo } from 'react';
import type { NodeType } from '../../../entities/node-type/model/types';
import { Icon } from '../../../shared/ui/icon';

interface AddNodeMenuProps {
    clientX: number;
    clientY: number;
    nodeTypes: NodeType[];
    onAddNode: (type: NodeType) => void;
    onCancel: () => void;
}

export const AddNodeMenu: React.FC<AddNodeMenuProps> = ({ clientX, clientY, nodeTypes, onAddNode, onCancel }) => {
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

    const categories = useMemo(() => {
        const cats = new Set<string>();
        nodeTypes.forEach(nt => {
            if (nt.category) cats.add(nt.category);
        });
        return Array.from(cats).sort();
    }, [nodeTypes]);

    const filteredNodes = useMemo(() => {
        if (!selectedCategory) return [];
        return nodeTypes.filter(nt => nt.category === selectedCategory).sort((a, b) => a.name.localeCompare(b.name));
    }, [nodeTypes, selectedCategory]);

    return (
        <div
            className="fixed z-50 animate-in fade-in zoom-in-95 duration-200"
            style={{ left: clientX, top: clientY }}
        >
            <div className="flex gap-2">
                {/* Category Selection */}
                <div className="w-48 bg-surface-800 border border-[var(--border-base)] rounded-2xl shadow-2xl p-2 ring-1 ring-black/5 flex flex-col gap-1 backdrop-blur-xl bg-surface-800/90">
                    <div className="px-3 py-2 text-[10px] font-black text-brand uppercase tracking-widest opacity-50 mb-1">Categories</div>
                    {categories.map(cat => (
                        <button
                            key={cat}
                            onMouseEnter={() => setSelectedCategory(cat)}
                            onMouseLeave={() => { }}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${selectedCategory === cat
                                ? 'bg-brand text-white shadow-lg shadow-brand/20'
                                : 'text-[var(--text-muted)] hover:bg-[var(--border-muted)] hover:text-[var(--text-main)]'
                                }`}
                        >
                            <span className="truncate">{cat}</span>
                            <Icon
                                name="chevron_right"
                                size={12}
                                className={`transition-transform duration-300 ${selectedCategory === cat ? 'translate-x-1' : 'opacity-40'}`}
                            />
                        </button>
                    ))}
                </div>

                {/* Node List */}
                {selectedCategory && (
                    <div className="w-56 bg-surface-800 border border-[var(--border-base)] rounded-2xl shadow-2xl p-2 ring-1 ring-black/5 flex flex-col gap-1 backdrop-blur-xl bg-surface-800/90 animate-in slide-in-from-left-2 duration-200" onMouseLeave={onCancel}>
                        <div className="px-3 py-2 text-[10px] font-black text-brand uppercase tracking-widest opacity-50 mb-1">{selectedCategory} Blueprints</div>
                        <div className="max-h-[320px] overflow-y-auto pr-1 space-y-1 custom-scrollbar">
                            {filteredNodes.map(nt => (
                                <button
                                    key={nt.id}
                                    onClick={() => onAddNode(nt)}
                                    className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-[var(--text-muted)] hover:text-brand hover:bg-brand/10 transition-all group border border-transparent hover:border-brand/20"
                                >
                                    <div className="truncate">{nt.name}</div>
                                    <div className="text-[10px] opacity-40 group-hover:opacity-60 font-mono mt-0.5 line-clamp-1">{nt.description || 'No description'}</div>
                                </button>
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
        </div>
    );
};
