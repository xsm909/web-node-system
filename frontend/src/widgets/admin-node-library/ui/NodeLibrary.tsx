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

    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(() => {
        const saved = getCookie('node_expanded_categories');
        if (saved) return new Set(JSON.parse(saved));
        return new Set();
    });

    const toggleCategory = (path: string) => {
        setExpandedCategories(prev => {
            const next = new Set(prev);
            if (next.has(path)) next.delete(path);
            else next.add(path);
            setCookie('node_expanded_categories', JSON.stringify(Array.from(next)));
            return next;
        });
    };


    const fetchData = async () => {
        setLoading(true);
        try {
            const { data } = await apiClient.get<NodeType[]>('/admin/node-types');
            setNodeTypes(data);
        } catch {
            // Error handling
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, [refreshTrigger]);

    const filteredNodes = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return nodeTypes;

        return nodeTypes.filter(n => {
            const inName = n.name.toLowerCase().includes(q);
            const inCategory = n.category?.toLowerCase().includes(q);
            const inDesc = n.description?.toLowerCase().includes(q);
            return inName || inCategory || inDesc;
        });
    }, [nodeTypes, searchQuery]);

    const categoryTree = useMemo(() => {
        if (searchQuery.trim()) return null;
        return buildCategoryTree<NodeType>(nodeTypes);
    }, [nodeTypes, searchQuery]);

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

            <div className="bg-surface-800 rounded-2xl border border-gray-700/50 overflow-hidden shadow-xl shadow-black/10">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-gray-700 bg-surface-900/50">
                            <th className="px-6 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Name</th>
                            <th className="px-6 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Version</th>
                            <th className="px-6 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Description</th>
                            <th className="px-6 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700/50">
                        {searchQuery.trim() ? (
                            filteredNodes.map(node => (
                                <NodeRow
                                    key={node.id}
                                    node={node}
                                    onEdit={onEditNode}
                                    onDuplicate={onDuplicateNode}
                                    onDelete={setNodeToDelete}
                                    isSelected={selectedNodeId === node.id}
                                    onSelect={setSelectedNodeId}
                                />
                            ))
                        ) : (
                            categoryTree && (
                                <CategoryRows
                                    name="Uncategorized"
                                    node={categoryTree}
                                    path=""
                                    level={-1}
                                    expandedCategories={expandedCategories}
                                    onToggle={toggleCategory}
                                    onEdit={onEditNode}
                                    onDuplicate={onDuplicateNode}
                                    onDelete={setNodeToDelete}
                                    selectedNodeId={selectedNodeId}
                                    onSelectNode={setSelectedNodeId}
                                />
                            )
                        )}
                        {filteredNodes.length === 0 && (
                            <tr>
                                <td colSpan={4} className="px-6 py-12 text-center text-gray-500 italic text-sm">
                                    No nodes matching your criteria.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

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

interface NodeRowProps {
    node: NodeType;
    onEdit: (node: NodeType) => void;
    onDuplicate: (node: NodeType) => void;
    onDelete: (node: NodeType) => void;
    level?: number;
    isSelected?: boolean;
    onSelect?: (id: string) => void;
}

const NodeRow: React.FC<NodeRowProps> = ({ node, onEdit, onDuplicate, onDelete, level = 0, isSelected, onSelect }) => (
    <tr
        onClick={() => { onSelect?.(node.id); onEdit(node); }}
        className={`group hover:bg-brand/5 transition-colors cursor-pointer ${isSelected ? 'bg-brand/5' : ''}`}
    >
        <td className="px-6 py-4" style={{ paddingLeft: `${1.5 + level * 1.5}rem` }}>
            <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-surface-700 text-brand group-hover:bg-brand group-hover:text-white transition-colors">
                    <Icon name={node.icon || 'extension'} size={18} />
                </div>
                <div className="flex flex-col min-w-0">
                    <span className="text-sm font-bold text-[var(--text-main)] group-hover:text-brand transition-colors truncate">
                        {node.name}
                    </span>
                </div>
            </div>
        </td>
        <td className="px-6 py-4">
            <span className="text-xs font-mono text-brand/70 font-bold">v{node.version}</span>
        </td>
        <td className="px-6 py-4">
            <span className="text-sm text-[var(--text-muted)] opacity-60 group-hover:opacity-100 transition-opacity line-clamp-1 max-w-md">
                {node.description || <span className="italic opacity-30">No description</span>}
            </span>
        </td>
        <td className="px-6 py-4 text-right">
            <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onDuplicate(node);
                    }}
                    className="p-2 rounded-lg bg-surface-700 hover:bg-surface-600 transition-colors text-gray-400"
                    title="Duplicate"
                >
                    <Icon name="content_copy" size={16} />
                </button>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onDelete(node);
                    }}
                    className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 transition-colors text-red-400"
                    title="Delete"
                >
                    <Icon name="delete" size={16} />
                </button>
            </div>
        </td>
    </tr>
);

interface CategoryRowsProps {
    name: string;
    node: CategoryTreeNode<NodeType>;
    path: string;
    level: number;
    expandedCategories: Set<string>;
    onToggle: (path: string) => void;
    onEdit: (node: NodeType) => void;
    onDelete: (node: NodeType) => void;
    onDuplicate: (node: NodeType) => void;
    selectedNodeId: string | null;
    onSelectNode: (id: string) => void;
}

const CategoryRows: React.FC<CategoryRowsProps> = ({
    name,
    node,
    path,
    level,
    expandedCategories,
    onToggle,
    onEdit,
    onDelete,
    onDuplicate,
    selectedNodeId,
    onSelectNode
}) => {
    const isRoot = name === "Uncategorized";
    const isExpanded = isRoot || expandedCategories.has(path);

    if (isRoot) {
        return (
            <>
                {Object.entries(node.children).map(([childKey, childNode]) => (
                    <CategoryRows
                        key={childKey}
                        name={childNode.name}
                        node={childNode}
                        path={childNode.name}
                        level={0}
                        expandedCategories={expandedCategories}
                        onToggle={onToggle}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        onDuplicate={onDuplicate}
                        selectedNodeId={selectedNodeId}
                        onSelectNode={onSelectNode}
                    />
                ))}
                {node.nodes.length > 0 && (
                    <tr className="bg-surface-900/10 border-l-2 border-gray-700/30">
                        <td colSpan={4} className="px-6 py-1.5 opacity-40">
                            <div className="flex items-center gap-2">
                                <Icon name="folder_open" size={14} />
                                <span className="text-[10px] font-bold uppercase tracking-widest">Uncategorized</span>
                            </div>
                        </td>
                    </tr>
                )}
                {node.nodes.map(node => (
                    <NodeRow
                        key={node.id}
                        node={node}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        onDuplicate={onDuplicate}
                        level={0}
                        isSelected={node.id === selectedNodeId}
                        onSelect={onSelectNode}
                    />
                ))}
            </>
        );
    }

    return (
        <>
            <tr
                className="bg-surface-900/30 hover:bg-surface-700/50 cursor-pointer transition-colors border-l-2 border-brand/30"
                onClick={() => onToggle(path)}
            >
                <td colSpan={4} className="px-6 py-2" style={{ paddingLeft: `${1.5 + level * 1.5}rem` }}>
                    <div className="flex items-center gap-2">
                        <Icon
                            name={isExpanded ? 'down' : 'play'}
                            size={14}
                            className="text-gray-500 opacity-60"
                        />
                        <Icon name="folder_code" size={16} className="text-brand/70" />
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{node.name}</span>
                    </div>
                </td>
            </tr>
            {isExpanded && (
                <>
                    {Object.entries(node.children).map(([childKey, childNode]) => (
                        <CategoryRows
                            key={childKey}
                            name={childNode.name}
                            node={childNode}
                            path={`${path}|${childNode.name}`}
                            level={level + 1}
                            expandedCategories={expandedCategories}
                            onToggle={onToggle}
                            onEdit={onEdit}
                            onDelete={onDelete}
                            onDuplicate={onDuplicate}
                            selectedNodeId={selectedNodeId}
                            onSelectNode={onSelectNode}
                        />
                    ))}
                    {node.nodes.map(node => (
                        <NodeRow
                            key={node.id}
                            node={node}
                            onEdit={onEdit}
                            onDelete={onDelete}
                            onDuplicate={onDuplicate}
                            level={level + 1}
                            isSelected={node.id === selectedNodeId}
                            onSelect={onSelectNode}
                        />
                    ))}
                </>
            )}
        </>
    );
};

