import React, { useState, useMemo } from 'react';
import type { NodeType } from '../../../entities/node-type/model/types';
import CodeMirror from '@uiw/react-codemirror';
import { python } from '@codemirror/lang-python';
import { autocompletion, snippetCompletion } from '@codemirror/autocomplete';
import styles from './NodeTypeFormModal.module.css';

interface NodeTypeFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    editingNode: NodeType | null;
    formData: Partial<NodeType>;
    setFormData: (data: Partial<NodeType>) => void;
    onSave: (e: React.FormEvent) => void;
}

export const NodeTypeFormModal: React.FC<NodeTypeFormModalProps> = ({
    isOpen,
    onClose,
    editingNode,
    formData,
    setFormData,
    onSave,
}) => {
    const [activeTab, setActiveTab] = useState<'info' | 'code'>('info');

    const codeMirrorExtensions = useMemo(() => [
        python(),
        autocompletion({
            override: [
                (context) => {
                    const word = context.matchBefore(/\w*/);
                    if (word && word.from === word.to && !context.explicit) return null;
                    return {
                        from: word ? word.from : context.pos,
                        options: [
                            snippetCompletion('def run(inputs, params):\n\t${1:print("Hello")}\n\treturn ${2:{}}', {
                                label: 'run',
                                detail: 'Standard node function',
                                type: 'function'
                            }),
                            { label: 'inputs', type: 'variable', detail: 'Node input data' },
                            { label: 'params', type: 'variable', detail: 'Node parameters' },
                            { label: 'print', type: 'function' },
                            { label: 'return', type: 'keyword' },
                        ]
                    };
                }
            ]
        })
    ], []);

    if (!isOpen) return null;

    return (
        <div className={styles.modalOverlay}>
            <div className={styles.modal}>
                <div className={styles.modalHeader}>
                    <h2>{editingNode ? 'Edit Node Type' : 'Add New Node Type'}</h2>
                    <div className={styles.tabs}>
                        <button
                            type="button"
                            className={`${styles.tab} ${activeTab === 'info' ? styles.tabActive : ''}`}
                            onClick={() => setActiveTab('info')}
                        >
                            Node Info
                        </button>
                        <button
                            type="button"
                            className={`${styles.tab} ${activeTab === 'code' ? styles.tabActive : ''}`}
                            onClick={() => setActiveTab('code')}
                        >
                            Code
                        </button>
                    </div>
                </div>

                <form onSubmit={onSave} className={styles.form}>
                    <div className={styles.formContent}>
                        {activeTab === 'info' ? (
                            <div className={styles.tabPanel}>
                                <div className={styles.formRow}>
                                    <div className={`${styles.formGroup} ${styles.flexGrow}`}>
                                        <label>Name</label>
                                        <input
                                            className={styles.input}
                                            value={formData.name || ''}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            required
                                            placeholder="Enter node name"
                                        />
                                    </div>
                                    <div className={styles.formGroup} style={{ width: '120px' }}>
                                        <label>Version</label>
                                        <input
                                            className={styles.input}
                                            value={formData.version || ''}
                                            onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                                            required
                                            placeholder="1.0.0"
                                        />
                                    </div>
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Category</label>
                                    <input
                                        className={styles.input}
                                        value={formData.category || ''}
                                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                        placeholder="e.g. Utility, Data, Logic"
                                    />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Description</label>
                                    <textarea
                                        className={styles.textarea}
                                        value={formData.description || ''}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        placeholder="Explain what this node does..."
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className={`${styles.tabPanel} ${styles.codeTabPanel}`}>
                                <div className={`${styles.formGroup} ${styles.flexGrow}`}>
                                    <CodeMirror
                                        value={formData.code || ''}
                                        height="100%"
                                        theme="dark"
                                        extensions={codeMirrorExtensions}
                                        onChange={(value) => setFormData({ ...formData, code: value })}
                                        className={styles.codeMirrorWrapper}
                                        placeholder="# Write your node logic here..."
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className={styles.modalActions}>
                        <button type="button" className={styles.cancelBtn} onClick={onClose}>
                            Cancel
                        </button>
                        <button type="submit" className={styles.saveBtn}>
                            {editingNode ? 'Update Node' : 'Create Node'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
