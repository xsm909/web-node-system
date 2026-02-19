import React from 'react';
import type { NodeType } from '../../../entities/node-type/model/types';
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
    if (!isOpen) return null;

    return (
        <div className={styles.modalOverlay}>
            <div className={styles.modal}>
                <h2>{editingNode ? 'Edit Node Type' : 'Add New Node Type'}</h2>
                <form onSubmit={onSave} className={styles.form}>
                    <div className={styles.formGroup}>
                        <label>Name</label>
                        <input
                            className={styles.input}
                            value={formData.name || ''}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            required
                        />
                    </div>
                    <div className={styles.formGroup}>
                        <label>Version</label>
                        <input
                            className={styles.input}
                            value={formData.version || ''}
                            onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                            required
                        />
                    </div>
                    <div className={styles.formGroup}>
                        <label>Description</label>
                        <textarea
                            className={styles.textarea}
                            value={formData.description || ''}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        />
                    </div>
                    <div className={styles.formGroup}>
                        <label>Python Code</label>
                        <textarea
                            className={`${styles.textarea} ${styles.codeEditor}`}
                            value={formData.code || ''}
                            onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                            required
                        />
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
