import React, { useState, useEffect, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../../features/auth/store';
import { apiClient } from '../../../shared/api/client';
import type { ClientMetadata } from '../../../entities/client-metadata/model/types';
import { Icon } from '../../../shared/ui/icon';
import { ComboBox } from '../../../shared/ui/combo-box/ComboBox';
import type { SelectionGroup } from '../../../shared/ui/selection-list/SelectionList';

interface ClientMetadataEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    metadata: ClientMetadata | null;
    onSave: () => void;
    defaultOwnerId?: string;
    dataTypes: any[];
}

export const ClientMetadataEditModal: React.FC<ClientMetadataEditModalProps> = ({
    isOpen, onClose, metadata, onSave, defaultOwnerId, dataTypes
}) => {
    const queryClient = useQueryClient();
    const { user } = useAuthStore();
    const isAdmin = user?.role === 'admin';

    const [dataTypeId, setDataTypeId] = useState<string>('');
    const [ownerId, setOwnerId] = useState<string>('');

    // State for single-line vs multiline
    const [singleValue, setSingleValue] = useState<string>('');
    const [multiValues, setMultiValues] = useState<string[]>(['']);

    const categoryData: Record<string, SelectionGroup> = useMemo(() => {
        const map: Record<string, SelectionGroup> = {};

        // Put data types directly at the root level so they don't have an "all" parent folder
        dataTypes.forEach(dt => {
            const idStr = String(dt.id);
            map[dt.type] = { // Use name as the key so the label renders correctly in the list
                id: idStr,
                name: dt.type,
                icon: dt.config?.icon || 'category',
                selectable: true,
                items: [],
                children: {}
            };
        });

        return map;
    }, [dataTypes]);

    useEffect(() => {
        if (isOpen) {
            if (metadata) {
                setOwnerId(metadata.owner_id || '');
                setDataTypeId(String(metadata.data_type_id) || '');

                const md = metadata.meta_data || {};
                if (md.values && Array.isArray(md.values)) {
                    setMultiValues(md.values.length > 0 ? md.values : ['']);
                    setSingleValue('');
                } else {
                    setSingleValue(md.value || '');
                    setMultiValues(['']);
                }
            } else {
                setOwnerId(defaultOwnerId || '');
                setDataTypeId('');
                setSingleValue('');
                setMultiValues(['']);
            }
        }
    }, [isOpen, metadata, defaultOwnerId]);

    // Determine current selected data type to see if it's multiline
    const selectedDataType = useMemo(() => {
        if (!dataTypeId) return null;
        return dataTypes.find(dt => String(dt.id) === dataTypeId) || null;
    }, [dataTypeId, dataTypes]);

    const isMultiline = selectedDataType?.config?.multiline === true;

    const mutation = useMutation({
        mutationFn: async () => {
            if (!dataTypeId) throw new Error('Data Type is required');

            // Build meta_data payload
            const meta_data = isMultiline
                ? { values: multiValues.filter(v => v.trim() !== '') }
                : { value: singleValue };

            const payload = {
                owner_id: ownerId,
                data_type_id: parseInt(dataTypeId, 10),
                meta_data
            };

            if (metadata) {
                await apiClient.put(`/client-metadata/${metadata.id}`, payload);
            } else {
                await apiClient.post('/client-metadata/', payload);
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['client-metadata'] });
            onSave();
            onClose();
        },
        onError: (error: any) => {
            console.error('Failed to update Client Metadata', error);
            // Alert user so they know why the modal remains open (e.g. constraints, invalid UUID)
            const detail = error.response?.data?.detail || error.message;
            alert(`Error saving metadata: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`);
        }
    });

    if (!isOpen) return null;

    const isEdit = !!metadata;

    const getDataTypeLabel = (id: string) => {
        return dataTypes.find(dt => String(dt.id) === id)?.type;
    };
    const getDataTypeIcon = (id: string) => {
        return dataTypes.find(dt => String(dt.id) === id)?.config?.icon || 'category';
    };

    const addRow = () => {
        setMultiValues([...multiValues, '']);
    };

    const removeRow = (index: number) => {
        const newVals = [...multiValues];
        newVals.splice(index, 1);
        if (newVals.length === 0) newVals.push(''); // keep at least one row
        setMultiValues(newVals);
    };

    const updateRow = (index: number, val: string) => {
        const newVals = [...multiValues];
        newVals[index] = val;
        setMultiValues(newVals);
    };

    return (
        <div className="fixed inset-0 z-[1001] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
            <div className="w-full max-w-2xl bg-surface-800 border border-[var(--border-base)] rounded-[2.5rem] shadow-2xl overflow-hidden ring-1 ring-black/5 dark:ring-white/5 animate-in zoom-in-95 duration-500 max-h-[90vh] flex flex-col">
                <header className="px-10 py-8 border-b border-[var(--border-base)] flex flex-shrink-0 items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-brand/10 flex items-center justify-center text-brand border border-brand/20">
                            <Icon name={isEdit ? "edit" : "add"} size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-[var(--text-main)] tracking-tight">
                                {isEdit ? 'Edit Client Metadata' : 'Create Client Metadata'}
                            </h2>
                            <p className="text-[10px] text-[var(--text-muted)] font-black uppercase tracking-widest opacity-60">
                                {isEdit ? 'Update metadata properties' : 'Add new specialized metadata'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--border-muted)] transition-all"
                    >
                        <Icon name="close" size={20} />
                    </button>
                </header>

                <div className="p-10 space-y-8 overflow-y-auto flex-1">
                    {isAdmin && (
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-1">Owner ID (Client UID)</label>
                            <input
                                value={ownerId}
                                onChange={(e) => setOwnerId(e.target.value)}
                                className="w-full px-5 py-3 rounded-2xl bg-[var(--bg-app)] border border-[var(--border-base)] text-[var(--text-main)] font-medium focus:ring-2 focus:ring-brand outline-none transition-all"
                                placeholder="e.g., UUID"
                            />
                        </div>
                    )}

                    <div className="grid grid-cols-1 gap-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-1">Data Type</label>
                            <ComboBox
                                value={dataTypeId}
                                label={getDataTypeLabel(dataTypeId) || (dataTypeId ? 'Loading...' : 'Select data type...')}
                                icon={getDataTypeIcon(dataTypeId)}
                                placeholder="Select data type..."
                                data={categoryData}
                                onSelect={(item) => setDataTypeId(item.id)}
                                className="w-full"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-1">Metadata Content</label>

                        {isMultiline ? (
                            <div className="space-y-3 bg-[var(--bg-app)] border border-[var(--border-base)] rounded-2xl p-4">
                                {multiValues.map((val, idx) => (
                                    <div key={idx} className="flex items-center gap-3">
                                        <div className="flex-1">
                                            <input
                                                value={val}
                                                onChange={(e) => updateRow(idx, e.target.value)}
                                                className="w-full px-4 py-2.5 rounded-xl bg-surface-800 border border-[var(--border-base)] text-[var(--text-main)] text-sm focus:ring-2 focus:ring-brand outline-none transition-all"
                                                placeholder={`Row ${idx + 1}...`}
                                            />
                                        </div>
                                        <button
                                            onClick={() => removeRow(idx)}
                                            className="p-2.5 rounded-xl text-red-500/60 hover:text-red-500 hover:bg-red-500/10 transition-all flex-shrink-0"
                                            title="Remove Row"
                                        >
                                            <Icon name="delete" size={18} />
                                        </button>
                                    </div>
                                ))}

                                <button
                                    onClick={addRow}
                                    className="mt-2 flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-brand hover:bg-brand/10 transition-colors"
                                >
                                    <Icon name="add" size={16} />
                                    Add Row
                                </button>
                                <p className="text-[10px] text-[var(--text-muted)] italic opacity-60 mt-4">
                                    Saved as {"{ \"values\": [\"...\"] }"}
                                </p>
                            </div>
                        ) : (
                            <div>
                                <input
                                    value={singleValue}
                                    onChange={(e) => setSingleValue(e.target.value)}
                                    className="w-full px-5 py-4 rounded-2xl bg-[var(--bg-app)] border border-[var(--border-base)] text-[var(--text-main)] font-medium focus:ring-2 focus:ring-brand outline-none transition-all"
                                    placeholder="Enter single line value..."
                                />
                                <p className="text-[10px] text-[var(--text-muted)] italic opacity-60 ml-1 mt-2">
                                    Saved as {"{ \"value\": \"...\" }"}
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="px-10 py-8 bg-[var(--border-muted)]/30 border-t border-[var(--border-base)] flex flex-shrink-0 items-center justify-end gap-4">
                    <button
                        onClick={onClose}
                        className="px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] hover:text-[var(--text-main)] transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => mutation.mutate()}
                        disabled={mutation.isPending || !dataTypeId}
                        className="px-8 py-3 rounded-2xl bg-brand text-white text-[10px] font-black uppercase tracking-widest shadow-xl shadow-brand/20 hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
                    >
                        {mutation.isPending ? (isEdit ? 'Updating...' : 'Saving...') : (isEdit ? 'Save Changes' : 'Create Metadata')}
                    </button>
                </div>
            </div>
        </div>
    );
};
