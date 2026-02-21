import React, { useState, useMemo } from 'react';
import type { NodeType } from '../../../entities/node-type/model/types';
import { ConfirmModal } from '../../../shared/ui/confirm-modal/ConfirmModal';

interface AdminNodeLibraryProps {
    nodeTypes: NodeType[];
    onEditNode: (node: NodeType) => void;
    onDeleteNode: (node: NodeType) => void;
}

export const AdminNodeLibrary: React.FC<AdminNodeLibraryProps> = ({ nodeTypes, onEditNode, onDeleteNode }) => {
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [nodeToDelete, setNodeToDelete] = useState<NodeType | null>(null);

    const groupedNodes = useMemo(() => {
        const groups: Record<string, NodeType[]> = {};
        nodeTypes.forEach(node => {
            const cat = node.category || 'Uncategorized';
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(node);
        });
        return groups;
    }, [nodeTypes]);

    const handleConfirmDelete = () => {
        if (nodeToDelete) {
            onDeleteNode(nodeToDelete);
            setNodeToDelete(null);
            setSelectedNodeId(null);
        }
    };

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
                                                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                                    </svg>
                                                </button>
                                                <button
                                                    className="p-2 rounded-xl bg-[var(--border-muted)] hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-500 border border-[var(--border-base)] transition-all active:scale-90"
                                                    onClick={(e) => { e.stopPropagation(); setNodeToDelete(n); }}
                                                    title="Delete"
                                                >
                                                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                        <polyline points="3 6 5 6 21 6"></polyline>
                                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                                        <line x1="10" y1="11" x2="10" y2="17"></line>
                                                        <line x1="14" y1="11" x2="14" y2="17"></line>
                                                    </svg>
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


