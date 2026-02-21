import React, { useState, useMemo, useEffect, useRef } from 'react';
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
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Auto-focus the input when the menu opens
    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.focus();
        }
    }, []);

    const categories = useMemo(() => {
        const cats = new Set<string>();
        nodeTypes.forEach(nt => {
            if (nt.category) cats.add(nt.category);
        });
        return Array.from(cats).sort();
    }, [nodeTypes]);

    const filteredNodesByCategory = useMemo(() => {
        if (!selectedCategory) return [];
        return nodeTypes.filter(nt => nt.category === selectedCategory).sort((a, b) => a.name.localeCompare(b.name));
    }, [nodeTypes, selectedCategory]);

    const searchFilteredNodes = useMemo(() => {
        if (!searchQuery) return [];
        const lowerQuery = searchQuery.toLowerCase();
        return nodeTypes.filter(nt =>
            nt.name.toLowerCase().includes(lowerQuery) ||
            (nt.category && nt.category.toLowerCase().includes(lowerQuery)) ||
            (nt.description && nt.description.toLowerCase().includes(lowerQuery))
        ).sort((a, b) => a.name.localeCompare(b.name));
    }, [nodeTypes, searchQuery]);

    const isSearching = searchQuery.trim().length > 0;

    return (
        <>
            {/* Background overlay for detecting click outside */}
            <div
                className="fixed inset-0 z-40 bg-transparent"
                onClick={onCancel}
                onContextMenu={(e) => {
                    e.preventDefault();
                    onCancel();
                }}
            />

            <div
                className="fixed z-50 animate-in fade-in zoom-in-95 duration-200"
                style={{ left: clientX, top: clientY }}
            >
                <div className="flex gap-2 items-start">
                    {/* Main Panel: Search + Categories (or Search Results) */}
                    <div className={`transition-all duration-300 ${isSearching ? 'w-72' : 'w-56'} bg-[var(--bg-app)] border border-[var(--border-base)] rounded-2xl shadow-2xl p-2 ring-1 ring-black/5 flex flex-col gap-1 backdrop-blur-xl bg-[var(--bg-app)]/90`}>

                        {/* Search Input */}
                        <div className="px-1 pb-1 pt-1 relative">
                            <Icon name="search" size={14} className="absolute left-4 top-1/2 -translate-y-1/2 opacity-40 text-[var(--text-main)]" />
                            <input
                                ref={inputRef}
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Search node..."
                                className="w-full bg-[var(--bg-app)] text-xs text-[var(--text-main)] pl-8 pr-8 py-2.5 rounded-xl border border-[var(--border-base)] outline-none focus:border-brand/50 transition-colors shadow-inner"
                                onKeyDown={(e) => {
                                    if (e.key === 'Escape') onCancel();
                                }}
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 opacity-40 hover:opacity-100 text-[var(--text-main)] transition-opacity p-1"
                                >
                                    <Icon name="close" size={12} />
                                </button>
                            )}
                        </div>

                        {!isSearching && (
                            <>
                                <div className="px-3 py-2 text-[10px] font-black text-brand uppercase tracking-widest opacity-50 mt-1 mb-1">Categories</div>
                                <div className="max-h-[320px] overflow-y-auto space-y-1 custom-scrollbar pr-1">
                                    {categories.map(cat => (
                                        <button
                                            key={cat}
                                            onMouseEnter={() => setSelectedCategory(cat)}
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
                                    {categories.length === 0 && (
                                        <div className="px-4 py-8 text-center">
                                            <span className="text-[var(--text-muted)] opacity-30 italic text-xs font-medium">No categories</span>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}

                        {isSearching && (
                            <>
                                <div className="px-3 py-2 text-[10px] font-black text-brand uppercase tracking-widest opacity-50 mt-1 mb-1">Search Results</div>
                                <div className="max-h-[320px] overflow-y-auto pr-1 space-y-1 custom-scrollbar">
                                    {searchFilteredNodes.map(nt => (
                                        <button
                                            key={nt.id}
                                            onClick={() => onAddNode(nt)}
                                            className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-[var(--text-muted)] hover:text-brand hover:bg-brand/10 transition-all group border border-transparent hover:border-brand/20 flex flex-col"
                                        >
                                            <div className="flex justify-between items-center w-full gap-2">
                                                <span className="truncate text-[var(--text-main)] group-hover:text-brand transition-colors">{nt.name}</span>
                                                {nt.category && <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-[var(--border-base)] text-[var(--text-muted)] opacity-70 whitespace-nowrap group-hover:text-brand group-hover:bg-brand/20 transition-all font-medium border border-transparent group-hover:border-brand/30">{nt.category}</span>}
                                            </div>
                                            <div className="text-[10px] opacity-40 group-hover:opacity-60 font-mono mt-0.5 line-clamp-1">{nt.description || 'No description'}</div>
                                        </button>
                                    ))}
                                    {searchFilteredNodes.length === 0 && (
                                        <div className="px-4 py-12 text-center">
                                            <span className="text-[var(--text-muted)] opacity-30 italic text-xs font-medium">No archetypes found</span>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>

                    {/* Secondary Panel: Node List for Category (Only visible when not searching and a category is hovered) */}
                    {!isSearching && selectedCategory && (
                        <div className="w-56 bg-[var(--bg-app)] border border-[var(--border-base)] rounded-2xl shadow-2xl p-2 ring-1 ring-black/5 flex flex-col gap-1 backdrop-blur-xl bg-[var(--bg-app)]/90 animate-in slide-in-from-left-2 duration-200">
                            <div className="px-3 py-2 text-[10px] font-black text-brand uppercase tracking-widest opacity-50 mb-1">{selectedCategory} Blueprints</div>
                            <div className="max-h-[320px] overflow-y-auto pr-1 space-y-1 custom-scrollbar">
                                {filteredNodesByCategory.map(nt => (
                                    <button
                                        key={nt.id}
                                        onClick={() => onAddNode(nt)}
                                        className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-[var(--text-muted)] hover:text-brand hover:bg-brand/10 transition-all group border border-transparent hover:border-brand/20"
                                    >
                                        <div className="truncate text-[var(--text-main)] group-hover:text-brand transition-colors">{nt.name}</div>
                                        <div className="text-[10px] opacity-40 group-hover:opacity-60 font-mono mt-0.5 line-clamp-1">{nt.description || 'No description'}</div>
                                    </button>
                                ))}
                                {filteredNodesByCategory.length === 0 && (
                                    <div className="px-4 py-12 text-center">
                                        <span className="text-[var(--text-muted)] opacity-30 italic text-xs font-medium">No archetypes found</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};
