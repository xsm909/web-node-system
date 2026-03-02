import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { NodeType } from '../../../entities/node-type/model/types';
import { Icon } from '../../../shared/ui/icon';
import { buildCategoryTree, type CategoryTreeNode } from '../../../shared/lib/categoryUtils';

interface AddNodeMenuProps {
    clientX: number;
    clientY: number;
    nodeTypes: NodeType[];
    onAddNode: (type: NodeType) => void;
    onCancel: () => void;
}

// ─── Recursive panel for one level of the category tree ──────────────────────

interface CategoryPanelProps {
    tree: Record<string, CategoryTreeNode>;
    breadcrumb: string[];
    onAddNode: (type: NodeType) => void;
    onNavigate: (parts: string[]) => void;
    activeDescendant: string[];  // currently hovered path below this panel
}

const CategoryPanel: React.FC<CategoryPanelProps> = ({ tree, breadcrumb, onAddNode: _onAddNode, onNavigate, activeDescendant }) => {
    const entries = Object.entries(tree).sort(([a], [b]) => a.localeCompare(b));
    const hasSubcategories = entries.some(([, n]) => Object.keys(n.children).length > 0);
    const hasLeafNodes = entries.some(([, n]) => Object.keys(n.children).length === 0 && n.nodes.length > 0);
    const isMixed = hasSubcategories || hasLeafNodes;
    void isMixed;

    return (
        <div className="w-56 bg-[var(--bg-app)] border border-[var(--border-base)] rounded-2xl shadow-2xl p-2 ring-1 ring-black/5 flex flex-col gap-1 backdrop-blur-xl bg-[var(--bg-app)]/90 animate-in slide-in-from-left-2 duration-200">
            {/* Breadcrumb */}
            {breadcrumb.length > 0 && (
                <div className="px-3 py-2 text-[10px] font-black text-brand uppercase tracking-widest opacity-50 mb-1 flex items-center gap-1 flex-wrap">
                    {breadcrumb.map((seg, i) => (
                        <React.Fragment key={i}>
                            {i > 0 && <span className="opacity-50">›</span>}
                            <span>{seg}</span>
                        </React.Fragment>
                    ))}
                </div>
            )}
            {!breadcrumb.length && (
                <div className="px-3 py-2 text-[10px] font-black text-brand uppercase tracking-widest opacity-50 mb-1">Categories</div>
            )}

            <div className="max-h-[320px] overflow-y-auto space-y-0.5 custom-scrollbar pr-1">
                {entries.map(([label, node]) => {
                    const isParent = Object.keys(node.children).length > 0;
                    const fullPath = [...breadcrumb, label];
                    const isActive = activeDescendant[breadcrumb.length] === label;

                    if (isParent) {
                        // Category that has subcategories — hover navigates deeper
                        return (
                            <button
                                key={label}
                                onMouseEnter={() => onNavigate(fullPath)}
                                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${isActive
                                    ? 'bg-brand text-white shadow-lg shadow-brand/20'
                                    : 'text-[var(--text-muted)] hover:bg-[var(--border-muted)] hover:text-[var(--text-main)]'
                                    }`}
                            >
                                <span className="truncate">{label}</span>
                                <Icon
                                    name="chevron_right"
                                    size={12}
                                    className={`transition-transform duration-300 ${isActive ? 'translate-x-1' : 'opacity-40'}`}
                                />
                            </button>
                        );
                    } else {
                        // Leaf category — hover shows nodes in next panel
                        return (
                            <button
                                key={label}
                                onMouseEnter={() => onNavigate(fullPath)}
                                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${isActive
                                    ? 'bg-brand text-white shadow-lg shadow-brand/20'
                                    : 'text-[var(--text-muted)] hover:bg-[var(--border-muted)] hover:text-[var(--text-main)]'
                                    }`}
                            >
                                <span className="truncate">{label}</span>
                                <span className={`text-[9px] ml-2 opacity-60 ${isActive ? 'opacity-80 text-white' : ''}`}>
                                    {node.nodes.length}
                                </span>
                            </button>
                        );
                    }
                })}
            </div>
        </div>
    );
};

// ─── Node list panel ──────────────────────────────────────────────────────────

interface NodeListPanelProps {
    nodes: NodeType[];
    breadcrumb: string[];
    onAddNode: (type: NodeType) => void;
}

const NodeListPanel: React.FC<NodeListPanelProps> = ({ nodes, breadcrumb, onAddNode }) => (
    <div className="w-56 bg-[var(--bg-app)] border border-[var(--border-base)] rounded-2xl shadow-2xl p-2 ring-1 ring-black/5 flex flex-col gap-1 backdrop-blur-xl bg-[var(--bg-app)]/90 animate-in slide-in-from-left-2 duration-200">
        <div className="px-3 py-2 text-[10px] font-black text-brand uppercase tracking-widest opacity-50 mb-1 flex items-center gap-1 flex-wrap">
            {breadcrumb.map((seg, i) => (
                <React.Fragment key={i}>
                    {i > 0 && <span className="opacity-50">›</span>}
                    <span>{seg}</span>
                </React.Fragment>
            ))}
        </div>
        <div className="max-h-[320px] overflow-y-auto pr-1 space-y-0.5 custom-scrollbar">
            {nodes.sort((a, b) => a.name.localeCompare(b.name)).map(nt => (
                <button
                    key={nt.id}
                    onClick={() => onAddNode(nt)}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-[var(--text-muted)] hover:text-brand hover:bg-brand/10 transition-all group border border-transparent hover:border-brand/20 flex flex-col"
                >
                    <div className="truncate text-[var(--text-main)] group-hover:text-brand transition-colors">{nt.name}</div>
                    <div className="text-[10px] opacity-40 group-hover:opacity-60 font-mono mt-0.5 line-clamp-1">{nt.description || 'No description'}</div>
                </button>
            ))}
            {nodes.length === 0 && (
                <div className="px-4 py-12 text-center">
                    <span className="text-[var(--text-muted)] opacity-30 italic text-xs">No nodes here</span>
                </div>
            )}
        </div>
    </div>
);

// ─── Main AddNodeMenu ─────────────────────────────────────────────────────────

export const AddNodeMenu: React.FC<AddNodeMenuProps> = ({ clientX, clientY, nodeTypes, onAddNode, onCancel }) => {
    const [searchQuery, setSearchQuery] = useState('');
    // hoveredPath = the path segments the user is currently hovering:
    // e.g. ['AI', 'Chat'] means: show root panel, panel for AI children, panel for Chat children/nodes
    const [hoveredPath, setHoveredPath] = useState<string[]>([]);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => { inputRef.current?.focus(); }, []);

    const categoryTree = useMemo(() => buildCategoryTree(nodeTypes), [nodeTypes]);

    const searchFilteredNodes = useMemo(() => {
        if (!searchQuery.trim()) return [];
        const q = searchQuery.toLowerCase();
        return nodeTypes.filter(nt =>
            nt.name.toLowerCase().includes(q) ||
            (nt.category && nt.category.toLowerCase().includes(q)) ||
            (nt.description && nt.description.toLowerCase().includes(q))
        ).sort((a, b) => a.name.localeCompare(b.name));
    }, [nodeTypes, searchQuery]);

    const isSearching = searchQuery.trim().length > 0;


    return (
        <>
            {/* Click-outside overlay */}
            <div
                className="fixed inset-0 z-40 bg-transparent"
                onClick={onCancel}
                onContextMenu={(e) => { e.preventDefault(); onCancel(); }}
            />

            <div
                className="fixed z-50 animate-in fade-in zoom-in-95 duration-200"
                style={{ left: clientX, top: clientY }}
            >
                <div className="flex gap-2 items-start">
                    {/* ── Left panel: search + category tree ── */}
                    <div className={`transition-all duration-300 ${isSearching ? 'w-72' : 'w-56'} bg-[var(--bg-app)] border border-[var(--border-base)] rounded-2xl shadow-2xl p-2 ring-1 ring-black/5 flex flex-col gap-1 backdrop-blur-xl bg-[var(--bg-app)]/90`}>

                        {/* Search */}
                        <div className="px-1 pb-1 pt-1 relative">
                            <Icon name="search" size={14} className="absolute left-4 top-1/2 -translate-y-1/2 opacity-40 text-[var(--text-main)]" />
                            <input
                                ref={inputRef}
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Search node..."
                                className="w-full bg-[var(--bg-app)] text-xs text-[var(--text-main)] pl-8 pr-8 py-2.5 rounded-xl border border-[var(--border-base)] outline-none focus:border-brand/50 transition-colors shadow-inner"
                                onKeyDown={(e) => { if (e.key === 'Escape') onCancel(); }}
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

                        {/* Category list (root level) — shown when not searching */}
                        {!isSearching && (
                            <>
                                <div className="px-3 py-2 text-[10px] font-black text-brand uppercase tracking-widest opacity-50 mt-1 mb-1">Categories</div>
                                <div className="max-h-[320px] overflow-y-auto space-y-0.5 custom-scrollbar pr-1">
                                    {Object.entries(categoryTree)
                                        .sort(([a], [b]) => a.localeCompare(b))
                                        .map(([label, node]) => {
                                            const isParent = Object.keys(node.children).length > 0;
                                            const isActive = hoveredPath[0] === label;
                                            return (
                                                <button
                                                    key={label}
                                                    onMouseEnter={() => setHoveredPath([label])}
                                                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${isActive
                                                        ? 'bg-brand text-white shadow-lg shadow-brand/20'
                                                        : 'text-[var(--text-muted)] hover:bg-[var(--border-muted)] hover:text-[var(--text-main)]'
                                                        }`}
                                                >
                                                    <span className="truncate">{label}</span>
                                                    {isParent
                                                        ? <Icon name="chevron_right" size={12} className={`transition-transform duration-300 ${isActive ? 'translate-x-1' : 'opacity-40'}`} />
                                                        : <span className={`text-[9px] opacity-60 ${isActive ? 'opacity-80 text-white' : ''}`}>{node.nodes.length}</span>
                                                    }
                                                </button>
                                            );
                                        })}
                                    {Object.keys(categoryTree).length === 0 && (
                                        <div className="px-4 py-8 text-center">
                                            <span className="text-[var(--text-muted)] opacity-30 italic text-xs">No categories</span>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}

                        {/* Search results */}
                        {isSearching && (
                            <>
                                <div className="px-3 py-2 text-[10px] font-black text-brand uppercase tracking-widest opacity-50 mt-1 mb-1">Search Results</div>
                                <div className="max-h-[320px] overflow-y-auto pr-1 space-y-0.5 custom-scrollbar">
                                    {searchFilteredNodes.map(nt => (
                                        <button
                                            key={nt.id}
                                            onClick={() => onAddNode(nt)}
                                            className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-[var(--text-muted)] hover:text-brand hover:bg-brand/10 transition-all group border border-transparent hover:border-brand/20 flex flex-col"
                                        >
                                            <div className="flex justify-between items-center w-full gap-2">
                                                <span className="truncate text-[var(--text-main)] group-hover:text-brand transition-colors">{nt.name}</span>
                                                {nt.category && (
                                                    <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-[var(--border-base)] text-[var(--text-muted)] opacity-70 whitespace-nowrap group-hover:text-brand group-hover:bg-brand/20 transition-all font-medium border border-transparent group-hover:border-brand/30">
                                                        {nt.category.split('|').join(' › ')}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-[10px] opacity-40 group-hover:opacity-60 font-mono mt-0.5 line-clamp-1">{nt.description || 'No description'}</div>
                                        </button>
                                    ))}
                                    {searchFilteredNodes.length === 0 && (
                                        <div className="px-4 py-12 text-center">
                                            <span className="text-[var(--text-muted)] opacity-30 italic text-xs">No nodes found</span>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>

                    {/* ── Sub-category panels (depth 1+) shown on hover when not searching ── */}
                    {!isSearching && hoveredPath.length > 0 && (() => {
                        // Collect panels to show for each depth level after root
                        const subPanels: React.ReactElement[] = [];
                        let cur = categoryTree;
                        let depth = 0;

                        for (const seg of hoveredPath) {
                            const node = cur[seg];
                            if (!node) break;
                            const childKeys = Object.keys(node.children);
                            if (childKeys.length > 0) {
                                // Has subcategories → show a CategoryPanel for those children
                                const breadcrumb = hoveredPath.slice(0, depth + 1);
                                const subtree = node.children;
                                subPanels.push(
                                    <CategoryPanel
                                        key={`panel-${depth}`}
                                        tree={subtree}
                                        breadcrumb={breadcrumb}
                                        onAddNode={onAddNode}
                                        onNavigate={setHoveredPath}
                                        activeDescendant={hoveredPath}
                                    />
                                );
                                cur = node.children;
                                depth++;
                            } else {
                                // Leaf: show node list
                                subPanels.push(
                                    <NodeListPanel
                                        key={`nodes-${depth}`}
                                        nodes={node.nodes}
                                        breadcrumb={hoveredPath.slice(0, depth + 1)}
                                        onAddNode={onAddNode}
                                    />
                                );
                                break;
                            }
                        }
                        return subPanels;
                    })()}

                </div>
            </div>
        </>
    );
};
