import React from 'react';
import type { NodeType } from '../../../entities/node-type/model/types';
import styles from './NodeLibrary.module.css';

interface AdminNodeLibraryProps {
    nodeTypes: NodeType[];
    onAddNode: () => void;
    onEditNode: (node: NodeType) => void;
}

export const AdminNodeLibrary: React.FC<AdminNodeLibraryProps> = ({ nodeTypes, onAddNode, onEditNode }) => {
    return (
        <>
            <header className={styles.header}>
                <h1>Node Library</h1>
                <span className={styles.badge}>Admin</span>
                <button className={styles.addBtn} onClick={onAddNode}>
                    + Add New Node
                </button>
            </header>
            <div className={styles.content}>
                <div className={styles.grid}>
                    {nodeTypes.map((n: NodeType) => (
                        <div key={n.id} className={styles.nodeCard}>
                            <div>
                                <h3>{n.name}</h3>
                                <span className={styles.version}>v{n.version}</span>
                                <p>{n.description}</p>
                            </div>
                            <div className={styles.actions}>
                                <button className={styles.editBtn} onClick={() => onEditNode(n)}>
                                    Edit Node
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </>
    );
};
