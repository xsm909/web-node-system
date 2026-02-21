import React, { useState, useEffect, useMemo } from 'react';
import { apiClient } from '../../../shared/api/client';
import type { NodeType } from '../../../entities/node-type/model/types';
import { ConfirmModal } from '../../../shared/ui/confirm-modal/ConfirmModal';

interface AdminNodeLibraryProps {
    onEditNode: (node: NodeType) => void;
    refreshTrigger?: number;
}

import { Icon } from '../../../shared/ui/icon';

export const AdminNodeLibrary: React.FC<AdminNodeLibraryProps> = ({ onEditNode, refreshTrigger = 0 }) => {
    const [nodeTypes, setNodeTypes] = useState<NodeType[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [nodeToDelete, setNodeToDelete] = useState<NodeType | null>(null);

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

    useEffect(() => {
        fetchData();
    }, [refreshTrigger]);

    const groupedNodes = useMemo(() => {
        const groups: Record<string, NodeType[]> = {};
        nodeTypes.forEach(node => {
            const cat = node.category || 'Uncategorized';
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(node);
        });
        return groups;
    }, [nodeTypes]);

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
            <div className="flex justify-center items-center h-64 bg-surface-800 rounded-3xl border border-[var(--border-base)] shadow-2xl shadow-black/5 dark:shadow-black/20 ring-1 ring-black/5 dark:ring-white/5">
                <div className="w-8 h-8 rounded-full border-2 border-[var(--border-base)] border-t-brand animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-12">
            {Object.entries(groupedNodes).map(([category, nodes]) => (
                <div key={category} className="space-y-4">
                    <div className="flex items-center gap-4 px-2">
                        <h2 className="text-[11px] font-bold text-brand uppercase tracking-[0.2em]">{category}</h2>
                        <div className="h-px flex-1 bg-[var(--border-base)] opacity-50"></div>
                    </div>

                    <div className="bg-surface-800 rounded-3xl border border-[var(--border-base)] overflow-hidden shadow-2xl shadow-black/5 dark:shadow-black/20 ring-1 ring-black/5 dark:ring-white/5">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-[var(--border-base)] bg-[var(--border-muted)]/30">
                                    <th className="px-6 py-4 text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider opacity-60">Name</th>
                                    <th className="px-6 py-4 text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider opacity-60">Version</th>
                                    <th className="px-6 py-4 text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider opacity-60">Description</th>
                                    <th className="px-6 py-4 text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider text-right opacity-60">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border-base)]">
                                {nodes.map((n) => (
                                    <tr
                                        key={n.id}
                                        className={`hover:bg-[var(--border-muted)]/50 transition-colors group cursor-pointer ${selectedNodeId === n.id ? 'bg-brand/5' : ''
                                            }`}
                                        onClick={() => setSelectedNodeId(n.id)}
                                    >
                                        <td className="px-6 py-4">
                                            <div className="text-sm font-bold text-[var(--text-main)] group-hover:text-brand transition-colors">{n.name}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-xs font-mono text-brand/70 group-hover:text-brand transition-colors font-bold">v{n.version}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm text-[var(--text-muted)] opacity-60 group-hover:opacity-100 transition-opacity line-clamp-1 max-w-md">
                                                {n.description || <span className="italic opacity-30">No description provided</span>}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    className="p-2 rounded-xl bg-[var(--border-muted)] hover:bg-brand/10 text-[var(--text-muted)] hover:text-brand border border-[var(--border-base)] transition-all active:scale-90"
                                                    onClick={(e) => { e.stopPropagation(); onEditNode(n); }}
                                                    title="Edit"
                                                >
                                                    <Icon name="edit" size={14} />
                                                </button>
                                                <button
                                                    className="p-2 rounded-xl bg-[var(--border-muted)] hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-500 border border-[var(--border-base)] transition-all active:scale-90"
                                                    onClick={(e) => { e.stopPropagation(); setNodeToDelete(n); }}
                                                    title="Delete"
                                                >
                                                    <Icon name="delete" size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ))}

            <ConfirmModal
                isOpen={!!nodeToDelete}
                title="Delete Node"
                description={`Are you sure you want to delete the node "${nodeToDelete?.name}"? This action cannot be undone.`}
                confirmLabel="Delete"
                onConfirm={handleConfirmDelete}
                onCancel={() => setNodeToDelete(null)}
            />
        </div>
    );
};


