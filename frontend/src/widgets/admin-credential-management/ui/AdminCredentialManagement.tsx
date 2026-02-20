import React, { useState } from 'react';
import { apiClient } from '../../../shared/api/client';
import type { Credential } from '../../../entities/credential/model/types';
import styles from './AdminCredentialManagement.module.css';

interface AdminCredentialManagementProps {
    credentials: Credential[];
    onRefresh: () => void;
}

export const AdminCredentialManagement: React.FC<AdminCredentialManagementProps> = ({ credentials, onRefresh }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState<Partial<Credential>>({
        key: '',
        value: '',
        type: 'api',
        description: ''
    });
    const [editingId, setEditingId] = useState<string | null>(null);

    const handleOpenCreate = () => {
        setFormData({ key: '', value: '', type: 'api', description: '' });
        setEditingId(null);
        setIsEditing(true);
    };

    const handleOpenEdit = (cred: Credential) => {
        setFormData(cred);
        setEditingId(cred.id);
        setIsEditing(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingId) {
                await apiClient.put(`/admin/credentials/${editingId}`, formData);
            } else {
                await apiClient.post('/admin/credentials', formData);
            }
            setIsEditing(false);
            onRefresh();
        } catch (error) {
            alert('Failed to save credential');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this credential?')) return;
        try {
            await apiClient.delete(`/admin/credentials/${id}`);
            onRefresh();
        } catch (error) {
            alert('Failed to delete credential');
        }
    };

    if (isEditing) {
        return (
            <div className={styles.formContainer}>
                <h2>{editingId ? 'Edit' : 'Add'} Credential</h2>
                <form onSubmit={handleSave} className={styles.form}>
                    <div className={styles.field}>
                        <label>Key</label>
                        <input
                            type="text"
                            value={formData.key}
                            onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                            placeholder="e.target. GEMINI_API_KEY"
                            required
                        />
                    </div>
                    <div className={styles.field}>
                        <label>Value</label>
                        <textarea
                            value={formData.value}
                            onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                            placeholder="Secret value"
                            required
                        />
                    </div>
                    <div className={styles.field}>
                        <label>Type</label>
                        <select
                            value={formData.type}
                            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                        >
                            <option value="ai">AI</option>
                            <option value="db">Database</option>
                            <option value="telegram">Telegram</option>
                            <option value="api">Generic API</option>
                        </select>
                    </div>
                    <div className={styles.field}>
                        <label>Description</label>
                        <input
                            type="text"
                            value={formData.description || ''}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            placeholder="Brief description"
                        />
                    </div>
                    <div className={styles.actions}>
                        <button type="submit" className={styles.saveBtn}>Save</button>
                        <button type="button" onClick={() => setIsEditing(false)} className={styles.cancelBtn}>Cancel</button>
                    </div>
                </form>
            </div>
        );
    }

    return (
        <div className={styles.content}>
            <div className={styles.header}>
                <button className={styles.addBtn} onClick={handleOpenCreate}>+ Add Credential</button>
            </div>
            <table className={styles.table}>
                <thead>
                    <tr>
                        <th>Key</th>
                        <th>Type</th>
                        <th>Description</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {credentials.map((c) => (
                        <tr key={c.id}>
                            <td className={styles.keyCell}>{c.key}</td>
                            <td><span className={styles.typeBadge}>{c.type}</span></td>
                            <td>{c.description}</td>
                            <td className={styles.actionsCell}>
                                <button onClick={() => handleOpenEdit(c)} className={styles.editBtn}>Edit</button>
                                <button onClick={() => handleDelete(c.id)} className={styles.deleteBtn}>Delete</button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};
