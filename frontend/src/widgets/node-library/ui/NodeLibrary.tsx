import type { NodeType } from '../../../entities/node-type/model/types';
import styles from './NodeLibrary.module.css';

interface NodeLibraryProps {
    nodeTypes: NodeType[];
    onAddNode: (type: NodeType) => void;
}

export function NodeLibrary({ nodeTypes, onAddNode }: NodeLibraryProps) {
    return (
        <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Node Library</h3>
            <div className={styles.nodeLibrary}>
                {nodeTypes.map((type) => (
                    <button
                        key={type.id}
                        className={styles.LibraryItem}
                        onClick={() => onAddNode(type)}
                        title={type.description}
                    >
                        <span className={styles.nodeIcon}>📦</span>
                        <div className={styles.nodeInfo}>
                            <div className={styles.nodeName}>{type.name}</div>
                            <div className={styles.nodeVersion}>v{type.version}</div>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}
