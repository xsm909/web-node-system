import React, { useState, useEffect } from 'react';
import { apiClient } from '../../../shared/api/client';
import type { Credential } from '../../../entities/credential/model/types';


import { Icon } from '../../../shared/ui/icon';

export const AdminCredentialManagement: React.FC = () => {
    const [credentials, setCredentials] = useState<Credential[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        setLoading(true);
        try {
            const { data } = await apiClient.get('/admin/credentials');
            setCredentials(data);
        } catch {
            // handle error
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

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
            fetchData();
        } catch {
            alert('Failed to save credential');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this credential?')) return;
        try {
            await apiClient.delete(`/admin/credentials/${id}`);
            fetchData();
        } catch {
            alert('Failed to delete credential');
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64 bg-surface-800 rounded-3xl border border-[var(--border-base)] shadow-2xl shadow-black/5 dark:shadow-black/20 ring-1 ring-black/5 dark:ring-white/5">
                <div className="w-8 h-8 rounded-full border-2 border-[var(--border-base)] border-t-brand animate-spin" />
            </div>
        );
    }

    if (isEditing) {
        return (
            <div className="max-w-2xl bg-surface-800 rounded-3xl border border-[var(--border-base)] p-8 shadow-2xl shadow-black/20 ring-1 ring-black/5 dark:ring-white/5 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <header className="mb-8">
                    <h2 className="text-xl font-bold text-[var(--text-main)]">{editingId ? 'Edit' : 'Add New'} Credential</h2>
                    <p className="text-sm text-[var(--text-muted)] mt-1 opacity-60">Configure your system-wide security keys and tokens.</p>
                </header>

                <form onSubmit={handleSave} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-[var(--text-main)] opacity-70 ml-1">Key Name</label>
                        <input
                            type="text"
                            value={formData.key}
                            onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                            className="w-full px-4 py-3.5 rounded-2xl bg-[var(--bg-app)] border border-[var(--border-base)] text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-all font-mono font-bold"
                            placeholder="e.g. GEMINI_API_KEY"
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-[var(--text-main)] opacity-70 ml-1">Value</label>
                        <textarea
                            value={formData.value}
                            onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                            className="w-full px-4 py-3.5 rounded-2xl bg-[var(--bg-app)] border border-[var(--border-base)] text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-all min-h-[140px] font-mono font-bold resize-none"
                            placeholder="Paste secret value here..."
                            required
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-[var(--text-main)] opacity-70 ml-1">Type</label>
                            <div className="relative">
                                <select
                                    value={formData.type}
                                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                    className="w-full px-4 py-3.5 rounded-2xl bg-[var(--bg-app)] border border-[var(--border-base)] text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-all appearance-none cursor-pointer font-bold"
                                >
                                    <option value="ai">AI / LLM Service</option>
                                    <option value="db">Database Accessory</option>
                                    <option value="telegram">Telegram Bot</option>
                                    <option value="api">Generic API Endpoint</option>
                                </select>
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-40">
                                    <Icon name="chevron_down" size={16} />
                                </div>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-[var(--text-main)] opacity-70 ml-1">Description</label>
                            <input
                                type="text"
                                value={formData.description || ''}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                className="w-full px-4 py-3.5 rounded-2xl bg-[var(--bg-app)] border border-[var(--border-base)] text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-all font-medium"
                                placeholder="Short purpose note"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-3 pt-6 border-t border-[var(--border-base)] mt-8">
                        <button
                            type="submit"
                            className="px-8 py-3 rounded-2xl bg-brand hover:brightness-110 text-white font-bold shadow-xl shadow-brand/20 transition-all active:scale-[0.98]"
                        >
                            Save Credential
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsEditing(false)}
                            className="px-8 py-3 rounded-2xl text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--border-muted)] border border-[var(--border-base)] transition-all font-bold active:scale-[0.98]"
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <header className="flex items-center justify-between px-2">
                <div>
                    <h2 className="text-xl font-bold text-[var(--text-main)]">API Credentials</h2>
                    <p className="text-sm text-[var(--text-muted)] opacity-60 font-medium">Manage system-wide security keys and tokens.</p>
                </div>
                <button
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand text-white text-sm font-bold shadow-lg shadow-brand/20 hover:brightness-110 active:scale-[0.98] transition-all"
                    onClick={handleOpenCreate}
                >
                    <Icon name="add" size={18} />
                    Add Access Key
                </button>
            </header>

            <div className="bg-surface-800 rounded-3xl border border-[var(--border-base)] overflow-hidden shadow-2xl shadow-black/5 dark:shadow-black/20 ring-1 ring-black/5 dark:ring-white/5">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-[var(--border-base)] bg-[var(--border-muted)]/30">
                            <th className="px-6 py-4 text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider opacity-60">Identification Key</th>
                            <th className="px-6 py-4 text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider opacity-60">Type</th>
                            <th className="px-6 py-4 text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider opacity-60">Description / Note</th>
                            <th className="px-6 py-4 text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider text-right opacity-60">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-base)]">
                        {credentials.map((c) => (
                            <tr key={c.id} className="hover:bg-[var(--border-muted)]/50 transition-colors group">
                                <td className="px-6 py-4">
                                    <div className="text-sm font-mono text-brand font-bold group-hover:brightness-110 transition-all uppercase tracking-tight">
                                        {c.key}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black bg-brand/10 text-brand ring-1 ring-inset ring-brand/20 uppercase tracking-widest">
                                        {c.type}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="text-sm text-[var(--text-muted)] opacity-70 group-hover:opacity-100 transition-opacity font-medium">
                                        {c.description || <span className="italic opacity-30 font-normal">No context provided</span>}
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => handleOpenEdit(c)}
                                            className="p-2 rounded-xl bg-[var(--border-muted)] hover:bg-brand/10 text-[var(--text-muted)] hover:text-brand border border-[var(--border-base)] transition-all active:scale-90"
                                            title="Edit Credential"
                                        >
                                            <Icon name="edit" size={14} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(c.id)}
                                            className="p-2 rounded-xl bg-[var(--border-muted)] hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-500 border border-[var(--border-base)] transition-all active:scale-90"
                                            title="Delete Credential"
                                        >
                                            <Icon name="delete" size={14} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {credentials.length === 0 && (
                            <tr>
                                <td colSpan={4} className="px-6 py-20 text-center text-sm text-[var(--text-muted)] opacity-30 font-medium italic">
                                    No secure credentials detected. Add your first access key to enable remote integrations.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

