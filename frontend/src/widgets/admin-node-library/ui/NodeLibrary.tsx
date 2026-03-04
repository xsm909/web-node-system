import React, { useState, useEffect, useMemo } from 'react';
import { apiClient } from '../../../shared/api/client';
import type { NodeType } from '../../../entities/node-type/model/types';
import { ConfirmModal } from '../../../shared/ui/confirm-modal/ConfirmModal';
import { Icon } from '../../../shared/ui/icon';
import { buildCategoryTree, type CategoryTreeNode } from '../../../shared/lib/categoryUtils';
import { getCookie, setCookie, eraseCookie } from '../../../shared/lib/cookieUtils';

interface AdminNodeLibraryProps {
    onEditNode: (node: NodeType) => void;
    onDuplicateNode: (node: NodeType) => void;
    refreshTrigger?: number;
}

// --- Recursive category section -----------------------------------------------

interface CategorySectionProps {
    path: string;         // full path, e.g. "AI|Chat"
    label: string;        // last segment, e.g. "Chat"
    node: CategoryTreeNode;
    depth: number;
    onEditNode: (n: NodeType) => void;
    onDuplicateNode: (n: NodeType) => void;
    onDeleteNode: (n: NodeType) => void;
    selectedNodeId: string | null;
    onSelectNode: (id: string) => void;
    searchQuery: string;
}

const CategorySection: React.FC<CategorySectionProps> = ({
    path, label, node, depth, onEditNode, onDuplicateNode, onDeleteNode,
    selectedNodeId, onSelectNode, searchQuery,
}) => {
    const [collapsed, setCollapsed] = useState(() => {
        return localStorage.getItem(`cat_collapsed_${path}`) === 'true';
    });

    const toggleCollapsed = () => {
        setCollapsed(prev => {
            const next = !prev;
            localStorage.setItem(`cat_collapsed_${path}`, String(next));
            return next;
        });
    };

    const hasChildren = Object.keys(node.children).length > 0;
    const hasNodes = node.nodes.length > 0;
    const isRoot = depth === 0;

    const indentPx = depth * 20;

    return (
        <div className="space-y-2">
            {/* Category header */}
            <button
                className="flex items-center gap-3 w-full text-left px-2 py-1 rounded-xl hover:bg-[var(--border-muted)]/50 transition-colors group"
                style={{ paddingLeft: `${indentPx + 8}px` }}
                onClick={toggleCollapsed}
            >
                <span
                    className={`transition-transform duration-200 ${collapsed ? '-rotate-90' : ''} opacity-40 group-hover:opacity-80`}
                >
                    <Icon name="expand_more" size={14} />
                </span>
                <h2 className={`font-bold uppercase tracking-[0.15em] ${isRoot
                    ? 'text-[11px] text-brand'
                    : 'text-[10px] text-[var(--text-muted)]'
                    }`}>
                    {label}
                </h2>
                <div className="h-px flex-1 bg-[var(--border-base)] opacity-30" />
                <span className="text-[9px] font-bold text-[var(--text-muted)] opacity-30 tabular-nums">
                    {countNodes(node)}
                </span>
            </button>

            {/* Content - animated collapse */}
            <div
                className="overflow-hidden transition-all duration-300 ease-in-out"
                style={{ maxHeight: collapsed ? 0 : '9999px', opacity: collapsed ? 0 : 1 }}
            >
                {/* Subcategories */}
                {hasChildren && (
                    <div className={`space-y-3 ${hasNodes ? 'mb-4' : ''}`}>
                        {Object.entries(node.children)
                            .sort(([a], [b]) => a.localeCompare(b))
                            .map(([childLabel, childNode]) => (
                                <CategorySection
                                    key={`${path}|${childLabel}`}
                                    path={`${path}|${childLabel}`}
                                    label={childLabel}
                                    node={childNode}
                                    depth={depth + 1}
                                    onEditNode={onEditNode}
                                    onDuplicateNode={onDuplicateNode}
                                    onDeleteNode={onDeleteNode}
                                    selectedNodeId={selectedNodeId}
                                    onSelectNode={onSelectNode}
                                    searchQuery={searchQuery}
                                />
                            ))}
                    </div>
                )}

                {/* Nodes table */}
                {hasNodes && (
                    <div
                        className="bg-surface-800 rounded-2xl border border-[var(--border-base)] overflow-hidden shadow-xl shadow-black/5 dark:shadow-black/20 ring-1 ring-black/5 dark:ring-white/5"
                        style={{ marginLeft: `${indentPx}px` }}
                    >
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-[var(--border-base)] bg-[var(--border-muted)]/30">
                                    <th className="px-5 py-3 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider opacity-60">Name</th>
                                    <th className="px-5 py-3 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider opacity-60">Version</th>
                                    <th className="px-5 py-3 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider opacity-60">Description</th>
                                    <th className="px-5 py-3 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider text-right opacity-60">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border-base)]">
                                {node.nodes
                                    .sort((a, b) => a.name.localeCompare(b.name))
                                    .map(n => (
                                        <tr
                                            key={n.id}
                                            className={`hover:bg-[var(--border-muted)]/50 transition-colors group cursor-pointer ${selectedNodeId === n.id ? 'bg-brand/5' : ''}`}
                                            onClick={() => { onSelectNode(n.id); onEditNode(n); }}
                                        >
                                            <td className="px-5 py-3">
                                                <div className="text-sm font-bold text-[var(--text-main)] group-hover:text-brand transition-colors">{n.name}</div>
                                            </td>
                                            <td className="px-5 py-3">
                                                <span className="text-xs font-mono text-brand/70 group-hover:text-brand transition-colors font-bold">v{n.version}</span>
                                            </td>
                                            <td className="px-5 py-3">
                                                <div className="text-sm text-[var(--text-muted)] opacity-60 group-hover:opacity-100 transition-opacity line-clamp-1 max-w-md">
                                                    {n.description || <span className="italic opacity-30">No description</span>}
                                                </div>
                                            </td>
                                            <td className="px-5 py-3 text-right">
                                                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        className="p-2 rounded-xl bg-[var(--border-muted)] hover:bg-brand/10 text-[var(--text-muted)] hover:text-brand border border-[var(--border-base)] transition-all active:scale-90"
                                                        onClick={(e) => { e.stopPropagation(); onDuplicateNode(n); }}
                                                        title="Duplicate"
                                                    >
                                                        <Icon name="content_copy" size={13} />
                                                    </button>
                                                    <button
                                                        className="p-2 rounded-xl bg-[var(--border-muted)] hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-500 border border-[var(--border-base)] transition-all active:scale-90"
                                                        onClick={(e) => { e.stopPropagation(); onDeleteNode(n); }}
                                                        title="Delete"
                                                    >
                                                        <Icon name="delete" size={13} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

function countNodes(node: CategoryTreeNode): number {
    let count = node.nodes.length;
    for (const child of Object.values(node.children)) count += countNodes(child);
    return count;
}

// --- Flat search results ----------------------------------------------------

interface SearchResultsProps {
    nodes: NodeType[];
    onEditNode: (n: NodeType) => void;
    onDuplicateNode: (n: NodeType) => void;
    onDeleteNode: (n: NodeType) => void;
    selectedNodeId: string | null;
    onSelectNode: (id: string) => void;
}

const SearchResults: React.FC<SearchResultsProps> = ({ nodes, onEditNode, onDuplicateNode, onDeleteNode, selectedNodeId, onSelectNode }) => (
    <div className="bg-surface-800 rounded-2xl border border-[var(--border-base)] overflow-hidden shadow-xl ring-1 ring-black/5 dark:ring-white/5">
        <table className="w-full text-left border-collapse">
            <thead>
                <tr className="border-b border-[var(--border-base)] bg-[var(--border-muted)]/30">
                    <th className="px-5 py-3 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider opacity-60">Name</th>
                    <th className="px-5 py-3 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider opacity-60">Category</th>
                    <th className="px-5 py-3 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider opacity-60">Description</th>
                    <th className="px-5 py-3 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider text-right opacity-60">Actions</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-base)]">
                {nodes.map(n => (
                    <tr
                        key={n.id}
                        className={`hover:bg-[var(--border-muted)]/50 transition-colors group cursor-pointer ${selectedNodeId === n.id ? 'bg-brand/5' : ''}`}
                        onClick={() => { onSelectNode(n.id); onEditNode(n); }}
                    >
                        <td className="px-5 py-3">
                            <div className="text-sm font-bold text-[var(--text-main)] group-hover:text-brand transition-colors">{n.name}</div>
                        </td>
                        <td className="px-5 py-3">
                            <span className="text-[10px] font-mono text-[var(--text-muted)] opacity-60 group-hover:opacity-90">
                                {n.category?.split('|').join(' > ') || '-'}
                            </span>
                        </td>
                        <td className="px-5 py-3">
                            <div className="text-sm text-[var(--text-muted)] opacity-60 group-hover:opacity-100 transition-opacity line-clamp-1 max-w-md">
                                {n.description || <span className="italic opacity-30">No description</span>}
                            </div>
                        </td>
                        <td className="px-5 py-3 text-right">
                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    className="p-2 rounded-xl bg-[var(--border-muted)] hover:bg-brand/10 text-[var(--text-muted)] hover:text-brand border border-[var(--border-base)] transition-all active:scale-90"
                                    onClick={(e) => { e.stopPropagation(); onDuplicateNode(n); }}
                                    title="Duplicate"
                                >
                                    <Icon name="content_copy" size={13} />
                                </button>
                                <button
                                    className="p-2 rounded-xl bg-[var(--border-muted)] hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-500 border border-[var(--border-base)] transition-all active:scale-90"
                                    onClick={(e) => { e.stopPropagation(); onDeleteNode(n); }}
                                    title="Delete"
                                >
                                    <Icon name="delete" size={13} />
                                </button>
                            </div>
                        </td>
                    </tr>
                ))}
                {nodes.length === 0 && (
                    <tr><td colSpan={4} className="px-5 py-12 text-center text-sm text-[var(--text-muted)] opacity-40 italic">No nodes match your search</td></tr>
                )}
            </tbody>
        </table>
    </div>
);

// --- Main component -----------------------------------------------------------

export const AdminNodeLibrary: React.FC<AdminNodeLibraryProps> = ({ onEditNode, onDuplicateNode, refreshTrigger = 0 }) => {
    const [nodeTypes, setNodeTypes] = useState<NodeType[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [nodeToDelete, setNodeToDelete] = useState<NodeType | null>(null);
    const [searchQuery, setSearchQueryState] = useState(getCookie('admin_node_search') || '');

    const setSearchQuery = (query: string) => {
        if (query) {
            setCookie('admin_node_search', query);
        } else {
            eraseCookie('admin_node_search');
        }
        setSearchQueryState(query);
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const { data } = await apiClient.get('/admin/node-types');
            setNodeTypes(data);
        } catch {
            // Error handling
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, [refreshTrigger]);

    const categoryTree = useMemo(() => buildCategoryTree(nodeTypes), [nodeTypes]);

    const searchResults = useMemo(() => {
        if (!searchQuery.trim()) return [];
        const q = searchQuery.toLowerCase();
        return nodeTypes.filter(n =>
            n.name.toLowerCase().includes(q) ||
            (n.category && n.category.toLowerCase().includes(q)) ||
            (n.description && n.description.toLowerCase().includes(q))
        ).sort((a, b) => a.name.localeCompare(b.name));
    }, [nodeTypes, searchQuery]);

    const isSearching = searchQuery.trim().length > 0;

    const handleConfirmDelete = async () => {
        if (nodeToDelete) {
            try {
                await apiClient.delete(`/admin/node-types/${nodeToDelete.id}`);
                setNodeToDelete(null);
                setSelectedNodeId(null);
                fetchData();
            } catch {
                alert('Failed to delete node type');
            }
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64 bg-surface-800 rounded-3xl border border-[var(--border-base)] shadow-2xl">
                <div className="w-8 h-8 rounded-full border-2 border-[var(--border-base)] border-t-brand animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Search bar */}
            <div className="relative">
                <Icon name="search" size={14} className="absolute left-4 top-1/2 -translate-y-1/2 opacity-40 text-[var(--text-main)]" />
                <input
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search nodes by name, category or description..."
                    className="w-full bg-surface-800 border border-[var(--border-base)] rounded-2xl pl-10 pr-10 py-3.5 text-sm text-[var(--text-main)] placeholder:text-[var(--text-muted)] placeholder:opacity-40 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand/40 transition-all shadow-inner"
                />
                {searchQuery && (
                    <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-4 top-1/2 -translate-y-1/2 opacity-40 hover:opacity-100 text-[var(--text-main)] transition-opacity"
                    >
                        <Icon name="close" size={13} />
                    </button>
                )}
            </div>

            {/* Either search results or the full category tree */}
            {isSearching ? (
                <div className="space-y-3 animate-in fade-in duration-200">
                    <div className="px-2 text-[10px] font-black text-brand uppercase tracking-widest opacity-60">
                        {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} for "{searchQuery}"
                    </div>
                    <SearchResults
                        nodes={searchResults}
                        onEditNode={onEditNode}
                        onDuplicateNode={onDuplicateNode}
                        onDeleteNode={setNodeToDelete}
                        selectedNodeId={selectedNodeId}
                        onSelectNode={setSelectedNodeId}
                    />
                </div>
            ) : (
                <div className="space-y-6">
                    {Object.entries(categoryTree)
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([label, node]) => (
                            <CategorySection
                                key={label}
                                path={label}
                                label={label}
                                node={node}
                                depth={0}
                                onEditNode={onEditNode}
                                onDuplicateNode={onDuplicateNode}
                                onDeleteNode={setNodeToDelete}
                                selectedNodeId={selectedNodeId}
                                onSelectNode={setSelectedNodeId}
                                searchQuery={searchQuery}
                            />
                        ))}
                </div>
            )}

            <ConfirmModal
                isOpen={!!nodeToDelete}
                title="Delete Node"
                description={`Are you sure you want to delete "${nodeToDelete?.name}"? This action cannot be undone.`}
                confirmLabel="Delete"
                onConfirm={handleConfirmDelete}
                onCancel={() => setNodeToDelete(null)}
            />
        </div>
    );
};
