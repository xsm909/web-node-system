import { useState, useEffect, useMemo } from 'react';
import { apiClient } from '../../../shared/api/client';
import type { Credential } from '../../../entities/credential/model/types';
import { Icon } from '../../../shared/ui/icon';
import { ConfirmModal } from '../../../shared/ui/confirm-modal';
import { AppTable } from '../../../shared/ui/app-table';
import { AppHeader } from '../../../widgets/app-header';
import { createColumnHelper } from '@tanstack/react-table';

const columnHelper = createColumnHelper<Credential>();

interface AdminCredentialManagementProps {
    onToggleSidebar?: () => void;
    isSidebarOpen?: boolean;
}

export const AdminCredentialManagement = ({ onToggleSidebar, isSidebarOpen }: AdminCredentialManagementProps) => {
    const [credentials, setCredentials] = useState<Credential[]>([]);
    const [loading, setLoading] = useState(true);

    const [credentialToDelete, setCredentialToDelete] = useState<Credential | null>(null);

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

    const handleDelete = (credential: Credential) => {
        setCredentialToDelete(credential);
    };

    const confirmDelete = async () => {
        if (!credentialToDelete) return;
        try {
            await apiClient.delete(`/admin/credentials/${credentialToDelete.id}`);
            fetchData();
        } catch {
            alert('Failed to delete credential');
        } finally {
            setCredentialToDelete(null);
        }
    };

    const [searchQuery, setSearchQuery] = useState('');

    const filteredCredentials = useMemo(() => {
        const q = searchQuery.toLowerCase().trim();
        if (!q) return credentials;
        return credentials.filter(c => 
            c.key.toLowerCase().includes(q) || 
            c.type.toLowerCase().includes(q) || 
            (c.description || '').toLowerCase().includes(q)
        );
    }, [credentials, searchQuery]);

    const columns = useMemo(() => [
        columnHelper.accessor('key', {
            header: 'Identification Key',
            cell: info => (
                <div className="text-sm font-mono text-brand font-bold group-hover:brightness-110 transition-all uppercase tracking-tight">
                    {info.getValue()}
                </div>
            )
        }),
        columnHelper.accessor('type', {
            header: 'Type',
            cell: info => (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black bg-brand/10 text-brand ring-1 ring-inset ring-brand/20 uppercase tracking-widest">
                    {info.getValue()}
                </span>
            )
        }),
        columnHelper.accessor('description', {
            header: 'Description / Note',
            cell: info => (
                <div className="text-sm text-[var(--text-muted)] opacity-70 group-hover:opacity-100 transition-opacity font-medium">
                    {info.getValue() || <span className="italic opacity-30 font-normal">No context provided</span>}
                </div>
            )
        }),
        columnHelper.display({
            id: 'actions',
            header: () => <div className="text-right">Actions</div>,
            cell: info => {
                const c = info.row.original;
                return (
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleOpenEdit(c);
                            }}
                            className="p-2 rounded-xl bg-[var(--border-muted)] hover:bg-brand/10 text-[var(--text-muted)] hover:text-brand border border-[var(--border-base)] transition-all active:scale-90"
                            title="Edit Credential"
                        >
                            <Icon name="edit" size={14} />
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(c);
                            }}
                            className="p-2 rounded-xl bg-[var(--border-muted)] hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-500 border border-[var(--border-base)] transition-all active:scale-90"
                            title="Delete Credential"
                        >
                            <Icon name="delete" size={14} />
                        </button>
                    </div>
                );
            }
        })
    ], []);

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
        <div className="flex flex-col h-full bg-[var(--bg-app)] overflow-hidden">
            <AppHeader
                onToggleSidebar={onToggleSidebar || (() => { })}
                isSidebarOpen={isSidebarOpen}
                leftContent={
                    <div className="flex flex-col">
                        <h1 className="text-lg lg:text-xl font-semibold tracking-tight text-[var(--text-main)] opacity-90 truncate px-2 lg:px-0">
                            API Credentials
                        </h1>
                        <p className="text-[10px] text-[var(--text-muted)] font-black uppercase tracking-widest opacity-60 px-2 lg:px-0">
                            Manage system-wide security keys and tokens.
                        </p>
                    </div>
                }
                rightContent={
                    <button
                        onClick={handleOpenCreate}
                        className="flex items-center justify-center w-10 h-10 rounded-full bg-brand text-white hover:brightness-110 transition-all shadow-lg shadow-brand/20 active:scale-95 shrink-0"
                        title="Add Access Key"
                    >
                        <Icon name="add" size={20} />
                    </button>
                }
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                searchPlaceholder="Search by key, type or description..."
            />

            <AppTable
                data={filteredCredentials}
                columns={columns}
                isSearching={searchQuery.trim().length > 0}
                config={{
                    categoryExtractor: c => c.type,
                    persistCategoryKey: 'credential_expanded_categories',
                    emptyMessage: 'No secure credentials detected. Add your first access key to enable remote integrations.'
                }}
            />

            <ConfirmModal
                isOpen={!!credentialToDelete}
                title="Delete Credential"
                description={`Are you sure you want to delete the credential '${credentialToDelete?.key}'? This action cannot be undone.`}
                confirmLabel="Delete"
                isLoading={loading && !!credentialToDelete}
                onConfirm={confirmDelete}
                onCancel={() => setCredentialToDelete(null)}
            />
        </div>
    );
};

