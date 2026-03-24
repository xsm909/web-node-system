import { useState, useEffect, useMemo } from 'react';
import { apiClient } from '../../../shared/api/client';
import type { Credential } from '../../../entities/credential/model/types';
import { Icon } from '../../../shared/ui/icon';
import { ConfirmModal } from '../../../shared/ui/confirm-modal';
import { AppTable } from '../../../shared/ui/app-table';
import { AppTableStandardCell } from '../../../shared/ui/app-table/components/AppTableStandardCell';
import { AppHeader } from '../../../widgets/app-header';
import { AppFormView } from '../../../shared/ui/app-form-view';
import { AppInput, AppFormFieldRect } from '../../../shared/ui/app-input';
import { UI_CONSTANTS } from '../../../shared/ui/constants';
import { createColumnHelper } from '@tanstack/react-table';
import { AppRoundButton } from '../../../shared/ui/app-round-button/AppRoundButton';

const columnHelper = createColumnHelper<Credential>();

interface CredentialManagementProps {
    onToggleSidebar?: () => void;
    isSidebarOpen?: boolean;
}

export const CredentialManagement = ({ onToggleSidebar, isSidebarOpen }: CredentialManagementProps) => {
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
    const [initialFormState, setInitialFormState] = useState<Partial<Credential>>({
        key: '', value: '', type: 'api', description: ''
    });
    const [editingId, setEditingId] = useState<string | null>(null);

    const handleOpenCreate = () => {
        const data = { key: '', value: '', type: 'api', description: '' };
        setFormData(data);
        setInitialFormState(data);
        setEditingId(null);
        setIsEditing(true);
    };

    const handleOpenEdit = (cred: Credential) => {
        setFormData(cred);
        setInitialFormState(cred);
        setEditingId(cred.id);
        setIsEditing(true);
    };

    const handleSave = async () => {
        try {
            let savedCred: Credential;
            if (editingId) {
                const { data } = await apiClient.put(`/admin/credentials/${editingId}`, formData);
                savedCred = data;
            } else {
                const { data } = await apiClient.post('/admin/credentials', formData);
                savedCred = data;
                setEditingId(savedCred.id);
            }
            setInitialFormState(savedCred);
            setFormData(savedCred);
            fetchData();
        } catch {
            alert('Failed to save credential');
        }
    };

    const isDirty = formData.key !== initialFormState.key ||
                    formData.value !== initialFormState.value ||
                    formData.type !== initialFormState.type ||
                    formData.description !== initialFormState.description;

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
            (c.type || '').toLowerCase().includes(q) || 
            (c.description || '').toLowerCase().includes(q)
        );
    }, [credentials, searchQuery]);

    const columns = useMemo(() => [
        columnHelper.accessor('key', {
            id: 'key',
            header: 'Identification Key',
            cell: info => {
                const cred = info.row.original;
                return (
                    <AppTableStandardCell
                        icon="verified"
                        label={cred.key}
                        subtitle={cred.description}
                        isLocked={cred.is_locked}
                        isMono={true}
                    />
                );
            },
        }),
        columnHelper.accessor('type', {
            header: 'Type',
            cell: info => (
                <span className="px-2 py-0.5 rounded-full bg-surface-700 border border-[var(--border-base)] text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                    {info.getValue()}
                </span>
            ),
        }),
        columnHelper.display({
            id: 'actions',
            header: () => <div className="text-right">Actions</div>,
            cell: info => {
                const cred = info.row.original;
                return (
                    <div className="flex gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                            onClick={(e) => { e.stopPropagation(); handleOpenEdit(cred); }}
                            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-500/10 transition-colors"
                            title="Edit Credential"
                        >
                            <Icon name="edit" size={16} />
                        </button>
                        {(!cred.is_locked && (
                            <button
                                onClick={(e) => { e.stopPropagation(); handleDelete(cred); }}
                                className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                                title="Delete Credential"
                            >
                                <Icon name="delete" size={16} />
                            </button>
                        )) || (
                            <div className="p-1.5">
                                <Icon name="lock" size={16} className="text-amber-500/50" />
                            </div>
                        )}
                    </div>
                );
            },
        }),
    ], [handleOpenEdit, handleDelete]);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64 bg-surface-800 rounded-3xl border border-[var(--border-base)] shadow-2xl shadow-black/5 dark:shadow-black/20 ring-1 ring-black/5 dark:ring-white/5">
                <div className="w-8 h-8 rounded-full border-2 border-[var(--border-base)] border-t-brand animate-spin" />
            </div>
        );
    }

    if (isEditing) {
        return (
            <AppFormView
                title={editingId ? (formData.key || 'Editing') : 'Add New Credential'}
                parentTitle="API Credentials"
                icon="verified"
                isDirty={isDirty}
                isSaving={loading}
                onSave={handleSave}
                onCancel={() => setIsEditing(false)}
                saveLabel={editingId ? "Save Credential" : "Add Credential"}
                entityId={editingId ?? undefined}
                entityType="credentials"
                isLocked={!!formData.is_locked}
                onLockToggle={(locked) => {
                    setFormData(prev => ({ ...prev, is_locked: locked }));
                    fetchData();
                }}
            >
                <div className="max-w-5xl mx-auto w-full h-full animate-in fade-in slide-in-from-bottom-4 duration-500 px-2 pt-1 pb-2">
                    <header className="mb-8">
                        <p className="text-sm text-[var(--text-muted)] mt-1 opacity-60">Configure your system-wide security keys and tokens.</p>
                    </header>
                    <div className="space-y-6">
                        <AppInput
                            label="Key Name"
                            required
                            value={formData.key || ''}
                            onChange={(val) => setFormData({ ...formData, key: val })}
                            placeholder="e.g. GEMINI_API_KEY"
                            className="font-mono font-bold"
                            disabled={!!formData.is_locked}
                        />
                        <AppInput
                            label="Value"
                            required
                            multiline
                            rows={4}
                            value={formData.value || ''}
                            onChange={(val) => setFormData({ ...formData, value: val })}
                            placeholder="Paste secret value here..."
                            className="font-mono font-bold"
                            disabled={!!formData.is_locked}
                        />
                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-1.5">
                                <label className="text-sm font-bold text-[var(--text-main)]">Type</label>
                                <AppFormFieldRect disabled={!!formData.is_locked} className={UI_CONSTANTS.FORM_CONTROL_HEIGHT}>
                                    <select
                                        value={formData.type}
                                        onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                        className="w-full bg-transparent outline-none h-full text-xs font-normal cursor-pointer"
                                        disabled={!!formData.is_locked}
                                    >
                                        <option value="ai">AI / LLM Service</option>
                                        <option value="db">Database Accessory</option>
                                        <option value="telegram">Telegram Bot</option>
                                        <option value="api">Generic API Endpoint</option>
                                    </select>
                                </AppFormFieldRect>
                            </div>
                            <AppInput
                                label="Description"
                                value={formData.description || ''}
                                onChange={(val) => setFormData({ ...formData, description: val })}
                                placeholder="Short purpose note"
                                disabled={!!formData.is_locked}
                            />
                        </div>
                    </div>

                </div>
            </AppFormView>
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
                    <AppRoundButton
                        onClick={handleOpenCreate}
                        icon="add"
                        variant="brand"
                        title="Add Access Key"
                        iconSize={20}
                    />
                }
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                searchPlaceholder="Search by key, type or description..."
            />

            <AppTable
                data={filteredCredentials}
                columns={columns}
                isSearching={searchQuery.trim().length > 0}
                onRowClick={handleOpenEdit}
                config={{
                    categoryExtractor: c => c.type,
                    persistCategoryKey: 'credential_expanded_categories',
                    emptyMessage: 'No secure credentials detected. Add your first access key to enable remote integrations.',
                    indentColumnId: 'key'
                }}
            />

            <ConfirmModal
                isOpen={!!credentialToDelete}
                title="Delete Credential"
                description={credentialToDelete ? `Are you sure you want to delete the credential '${credentialToDelete.key}'? This action cannot be undone.` : ''}
                confirmLabel="Delete"
                isLoading={loading && !!credentialToDelete}
                onConfirm={confirmDelete}
                onCancel={() => setCredentialToDelete(null)}
            />
        </div>
    );
};

