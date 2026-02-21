import React, { useState } from 'react';
import { apiClient } from '../../../shared/api/client';
import type { Credential } from '../../../entities/credential/model/types';

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
        } catch {
            alert('Failed to save credential');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this credential?')) return;
        try {
            await apiClient.delete(`/admin/credentials/${id}`);
            onRefresh();
        } catch {
            alert('Failed to delete credential');
        }
    };

    if (isEditing) {
        return (
            <div className="max-w-2xl bg-surface-800 rounded-2xl border border-white/5 p-8 shadow-2xl ring-1 ring-white/5">
                <header className="mb-8">
                    <h2 className="text-xl font-semibold text-white/90">{editingId ? 'Edit' : 'Add'} Credential</h2>
                    <p className="text-sm text-white/40 mt-1">Configure your API key or security credential.</p>
                </header>

                <form onSubmit={handleSave} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-white/70 ml-1">Key Name</label>
                        <input
                            type="text"
                            value={formData.key}
                            onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand transition-all font-mono"
                            placeholder="e.g. GEMINI_API_KEY"
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-white/70 ml-1">Value</label>
                        <textarea
                            value={formData.value}
                            onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand transition-all min-h-[120px] font-mono"
                            placeholder="Paste secret value here..."
                            required
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-white/70 ml-1">Type</label>
                            <select
                                value={formData.type}
                                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand transition-all appearance-none cursor-pointer"
                            >
                                <option value="ai">AI Content</option>
                                <option value="db">Database</option>
                                <option value="telegram">Telegram</option>
                                <option value="api">Generic API</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-white/70 ml-1">Description</label>
                            <input
                                type="text"
                                value={formData.description || ''}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand transition-all"
                                placeholder="Purpose of this key"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-3 pt-4 border-t border-white/5 mt-8">
                        <button
                            type="submit"
                            className="px-6 py-2.5 rounded-xl bg-brand hover:bg-brand/90 text-white font-semibold transition-all active:scale-[0.98]"
                        >
                            Save Credential
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsEditing(false)}
                            className="px-6 py-2.5 rounded-xl text-white/60 hover:text-white hover:bg-white/5 transition-all outline-none"
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <header className="flex items-center justify-between px-2">
                <div>
                    <h2 className="text-lg font-semibold text-white/90">API Credentials</h2>
                    <p className="text-sm text-white/40">Manage your system-wide security keys and tokens.</p>
                </div>
                <button
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white text-sm font-medium transition-all active:scale-[0.98]"
                    onClick={handleOpenCreate}
                >
                    + Add New
                </button>
            </header>

            <div className="bg-surface-800 rounded-2xl border border-white/5 overflow-hidden shadow-sm ring-1 ring-white/5">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-white/5 bg-white/[0.02]">
                            <th className="px-6 py-4 text-[11px] font-semibold text-white/40 uppercase tracking-wider">Key</th>
                            <th className="px-6 py-4 text-[11px] font-semibold text-white/40 uppercase tracking-wider">Type</th>
                            <th className="px-6 py-4 text-[11px] font-semibold text-white/40 uppercase tracking-wider">Description</th>
                            <th className="px-6 py-4 text-[11px] font-semibold text-white/40 uppercase tracking-wider text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {credentials.map((c) => (
                            <tr key={c.id} className="hover:bg-white/[0.02] transition-colors group">
                                <td className="px-6 py-4">
                                    <div className="text-sm font-mono text-emerald-400 group-hover:text-emerald-300 transition-colors uppercase tracking-tight">
                                        {c.key}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand/10 text-brand ring-1 ring-inset ring-brand/20 uppercase tracking-wider">
                                        {c.type}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="text-sm text-white/40 group-hover:text-white/60 transition-colors">
                                        {c.description || <span className="italic text-white/10 font-normal">No description</span>}
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex items-center justify-end gap-2 opacity-30 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => handleOpenEdit(c)}
                                            className="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white/60 hover:text-white hover:bg-white/10 border border-white/5 transition-all"
                                        >
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => handleDelete(c.id)}
                                            className="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white/40 hover:text-red-400 hover:bg-red-500/10 border border-white/5 transition-all"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {credentials.length === 0 && (
                            <tr>
                                <td colSpan={4} className="px-6 py-12 text-center text-sm text-white/20 italic">
                                    No credentials found. Add your first API key to get started.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

