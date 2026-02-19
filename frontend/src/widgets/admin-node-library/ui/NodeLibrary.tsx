import React, { useState } from 'react';
import type { NodeType } from '../../../entities/node-type/model/types';
import { ConfirmModal } from '../../../shared/ui/confirm-modal/ConfirmModal';
import styles from './NodeLibrary.module.css';

interface AdminNodeLibraryProps {
    nodeTypes: NodeType[];
    onEditNode: (node: NodeType) => void;
    onDeleteNode: (node: NodeType) => void;
}

export const AdminNodeLibrary: React.FC<AdminNodeLibraryProps> = ({ nodeTypes, onEditNode, onDeleteNode }) => {
    const [nodeToDelete, setNodeToDelete] = useState<NodeType | null>(null);

    const handleDeleteClick = (node: NodeType) => {
        setNodeToDelete(node);
    };

    const handleConfirmDelete = () => {
        if (nodeToDelete) {
            onDeleteNode(nodeToDelete);
            setNodeToDelete(null);
        }
    };

    const handleCancelDelete = () => {
        setNodeToDelete(null);
    };

    return (
        <div className={styles.content}>
            <div className={styles.grid}>
                {nodeTypes.map((n: NodeType) => (
                    <div key={n.id} className={styles.nodeCard}>
                        <div>
                            <h3>{n.name}</h3>
                            <div className={styles.meta}>
                                <span className={styles.version}>v{n.version}</span>
                                {n.category && <span className={styles.categoryBadge}>{n.category}</span>}
                            </div>
                            <p>{n.description}</p>
                        </div>
                        <div className={styles.actions}>
                            <button className={styles.editBtn} onClick={() => onEditNode(n)}>
                                Edit Node
                            </button>
                            <button className={styles.deleteBtn} onClick={() => handleDeleteClick(n)}>
                                Delete
                            </button>
                        </div>
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
