import React, { useState, useMemo } from 'react';
import type { NodeType } from '../../../entities/node-type/model/types';
import { ConfirmModal } from '../../../shared/ui/confirm-modal/ConfirmModal';
import editIcon from '../../../assets/edit.svg';
import deleteIcon from '../../../assets/delete.svg';

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
                        <div className="h-px flex-1 bg-white/5"></div>
                    </div>

                    <div className="bg-surface-800 rounded-2xl border border-white/5 overflow-hidden shadow-sm ring-1 ring-white/5">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-white/5 bg-white/[0.02]">
                                    <th className="px-6 py-4 text-[11px] font-semibold text-white/40 uppercase tracking-wider">Name</th>
                                    <th className="px-6 py-4 text-[11px] font-semibold text-white/40 uppercase tracking-wider">Version</th>
                                    <th className="px-6 py-4 text-[11px] font-semibold text-white/40 uppercase tracking-wider">Description</th>
                                    <th className="px-6 py-4 text-[11px] font-semibold text-white/40 uppercase tracking-wider text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {nodes.map((n) => (
                                    <tr
                                        key={n.id}
                                        className={`hover:bg-white/[0.02] transition-colors group cursor-pointer ${selectedNodeId === n.id ? 'bg-brand/5' : ''
                                            }`}
                                        onClick={() => setSelectedNodeId(n.id)}
                                    >
                                        <td className="px-6 py-4">
                                            <div className="text-sm font-semibold text-white/90 group-hover:text-white transition-colors">{n.name}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-xs font-mono text-brand/70 group-hover:text-brand transition-colors">v{n.version}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm text-white/40 group-hover:text-white/60 transition-colors line-clamp-1 max-w-md">
                                                {n.description || <span className="italic text-white/20">No description</span>}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2 opacity-30 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    className="p-2 rounded-lg bg-white/5 hover:bg-brand/20 text-white/60 hover:text-brand border border-white/5 transition-all"
                                                    onClick={(e) => { e.stopPropagation(); onEditNode(n); }}
                                                    title="Edit"
                                                >
                                                    <img src={editIcon} alt="Edit" className="w-4 h-4 brightness-200" />
                                                </button>
                                                <button
                                                    className="p-2 rounded-lg bg-white/5 hover:bg-red-500/20 text-white/60 hover:text-red-400 border border-white/5 transition-all"
                                                    onClick={(e) => { e.stopPropagation(); setNodeToDelete(n); }}
                                                    title="Delete"
                                                >
                                                    <img src={deleteIcon} alt="Delete" className="w-4 h-4 brightness-200" />
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

