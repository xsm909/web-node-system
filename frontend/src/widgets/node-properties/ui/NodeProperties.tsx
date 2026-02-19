import React from 'react';
import type { Node } from 'reactflow';
import type { NodeType } from '../../../entities/node-type/model/types';
import styles from './NodeProperties.module.css';

interface NodePropertiesProps {
    node: Node | null;
    nodeTypes: NodeType[];
    onChange: (nodeId: string, params: any) => void;
    onClose: () => void;
}

export const NodeProperties: React.FC<NodePropertiesProps> = ({
    node,
    nodeTypes,
    onChange,
    onClose,
}) => {
    if (!node) return null;

    const nodeTypeData = nodeTypes.find(t => t.name === node.data.label);
    const parameters = nodeTypeData?.parameters || [];

    if (parameters.length === 0) return null;

    const handleChange = (name: string, value: any) => {
        const currentParams = node.data.params || {};
        const newParams = { ...currentParams, [name]: value };
        onChange(node.id, newParams);
    };

    return (
        <aside className={styles.properties}>
            <header className={styles.header}>
                <h3>Node Properties</h3>
                <button className={styles.closeBtn} onClick={onClose} aria-label="Close properties">×</button>
            </header>

            <div className={styles.content}>
                <div className={styles.infoGroup}>
                    {/* <div className={styles.infoItem}>
                        <label>ID</label>
                        <span>{node.id}</span>
                    </div> */}
                    <div className={styles.infoItem}>
                        <label>Type</label>
                        <span>{node.data.label}</span>
                    </div>
                </div>

                <div className={styles.paramsSection}>
                    <h4>Parameters</h4>
                    {parameters.length > 0 ? (
                        <div className={styles.paramsList}>
                            {parameters.map((param: any) => (
                                <div key={param.name} className={styles.paramField}>
                                    <label htmlFor={`param-${param.name}`}>{param.label}</label>
                                    {param.type === 'boolean' ? (
                                        <div className={styles.checkboxWrapper}>
                                            <input
                                                id={`param-${param.name}`}
                                                type="checkbox"
                                                checked={node.data.params?.[param.name] ?? false}
                                                onChange={(e) => handleChange(param.name, e.target.checked)}
                                            />
                                        </div>
                                    ) : (
                                        <input
                                            id={`param-${param.name}`}
                                            type={param.type === 'number' ? 'number' : 'text'}
                                            value={node.data.params?.[param.name] ?? ''}
                                            onChange={(e) => handleChange(param.name, param.type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value)}
                                            placeholder={`Enter ${param.label.toLowerCase()}...`}
                                            className={styles.input}
                                        />
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className={styles.noParams}>No parameters configured for this node.</p>
                    )}
                </div>
            </div>
        </aside>
    );
};
