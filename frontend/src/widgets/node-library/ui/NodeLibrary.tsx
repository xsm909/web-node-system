import React from 'react';
import type { NodeType } from '../../../entities/node-type/model/types';
import styles from './NodeLibrary.module.css';

interface NodeLibraryProps {
    nodeTypes: NodeType[];
    onAddNode: (node: NodeType) => void;
}

export const NodeLibrary: React.FC<NodeLibraryProps> = ({ nodeTypes, onAddNode }) => {
    return (
        <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Node Library</h3>
            <div className={styles.grid}>
                {nodeTypes.map((n) => (
                    <button
                        key={n.id}
                        className={styles.nodeItem}
                        onClick={() => onAddNode(n)}
                        title={n.description}
                    >
                        <span className={styles.nodeIcon}>📦</span>
                        <div className={styles.nodeInfo}>
                            <div className={styles.nodeName}>{n.name}</div>
                            <div className={styles.nodeMeta}>
                                <span className={styles.nodeVersion}>v{n.version}</span>
                                {n.category && <span className={styles.nodeCategory}> • {n.category}</span>}
                            </div>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
};
