import React, { useState, useMemo } from 'react';
import type { NodeType } from '../../../entities/node-type/model/types';
import { ConfirmModal } from '../../../shared/ui/confirm-modal/ConfirmModal';
import editIcon from '../../../assets/edit.svg';
import deleteIcon from '../../../assets/delete.svg';
import styles from './NodeLibrary.module.css';

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

    const handleCancelDelete = () => {
        setNodeToDelete(null);
    };

    return (
        <div className={styles.container}>
            <div className={styles.listContainer}>
                {Object.entries(groupedNodes).map(([category, nodes]) => (
                    <div key={category} className={styles.categorySection}>
                        <div className={styles.categoryHeader}>{category}</div>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Version</th>
                                    <th>Description</th>
                                    <th className={styles.actionsHeader}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {nodes.map((n) => (
                                    <tr
                                        key={n.id}
                                        className={`${styles.row} ${selectedNodeId === n.id ? styles.selectedRow : ''}`}
                                        onClick={() => setSelectedNodeId(n.id)}
                                    >
                                        <td className={styles.nameCell}>
                                            <div className={styles.nodeName}>{n.name}</div>
                                        </td>
                                        <td className={styles.versionCell}>v{n.version}</td>
                                        <td className={styles.descCell}>{n.description}</td>
                                        <td className={styles.actionsCell}>
                                            <div className={styles.rowActions}>
                                                <button
                                                    className={styles.iconBtn}
                                                    onClick={(e) => { e.stopPropagation(); onEditNode(n); }}
                                                    title="Edit"
                                                >
                                                    <img src={editIcon} alt="Edit" className={styles.icon} />
                                                </button>
                                                <button
                                                    className={`${styles.iconBtn} ${styles.deleteIconBtn}`}
                                                    onClick={(e) => { e.stopPropagation(); setNodeToDelete(n); }}
                                                    title="Delete"
                                                >
                                                    <img src={deleteIcon} alt="Delete" className={styles.icon} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ))}
            </div>

            <ConfirmModal
                isOpen={!!nodeToDelete}
                title="Delete Node"
                description={`Are you sure you want to delete the node "${nodeToDelete?.name}"? This action cannot be undone.`}
                confirmLabel="Delete"
                onConfirm={handleConfirmDelete}
                onCancel={handleCancelDelete}
            />
        </div>
    );
};
