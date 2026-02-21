import React, { useState } from 'react';
import type { NodeType } from '../../../entities/node-type/model/types';
import styles from './AddNodeMenu.module.css';

interface AddNodeMenuProps {
    x: number;
    y: number;
    nodeTypes: NodeType[];
    onSelect: (type: NodeType) => void;
    onClose: () => void;
}

export const AddNodeMenu: React.FC<AddNodeMenuProps> = ({ x, y, nodeTypes, onSelect, onClose }) => {
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

    const categories = Array.from(new Set(nodeTypes.map(n => n.category || 'Other')));
    const filteredNodes = nodeTypes.filter(n => (n.category || 'Other') === selectedCategory);

    return (
        <div
            className={styles.menu}
            style={{ left: x, top: y }}
            onMouseLeave={onClose}
        >
            <div className={styles.categories}>
                <div className={styles.title}>Categories</div>
                {categories.map(cat => (
                    <div
                        key={cat}
                        className={`${styles.item} ${selectedCategory === cat ? styles.active : ''}`}
                        onMouseEnter={() => setSelectedCategory(cat)}
                    >
                        {cat}
                        <span className={styles.arrow}>›</span>
                    </div>
                ))}
            </div>

            {selectedCategory && (
                <div className={styles.nodes}>
                    <div className={styles.title}>{selectedCategory}</div>
                    {filteredNodes.map(node => (
                        <div
                            key={node.id}
                            className={styles.item}
                            onClick={() => onSelect(node)}
                        >
                            {node.name}
                        </div>
                    ))}
                    {filteredNodes.length === 0 && <div className={styles.empty}>No nodes found</div>}
                </div>
            )}
        </div>
    );
};
