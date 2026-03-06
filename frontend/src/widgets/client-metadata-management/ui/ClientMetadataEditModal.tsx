import React, { useState, useEffect, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../../features/auth/store';
import { apiClient } from '../../../shared/api/client';
import type { ClientMetadata } from '../../../entities/client-metadata/model/types';
import { Icon } from '../../../shared/ui/icon';
import { DataTypeSelect } from '../../../shared/ui/data-type-select';
interface ClientMetadataEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    metadata: ClientMetadata | null;
    onSave: () => void;
    defaultOwnerId?: string;
    dataTypes: any[];
}

import { ManagementModal } from '../../../shared/ui/management-modal';

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

    const isEdit = !!metadata;

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
        <ManagementModal
            isOpen={isOpen}
            onClose={onClose}
            icon={isEdit ? "edit" : "add"}
            title={isEdit ? 'Edit Client Metadata' : 'Create Client Metadata'}
            description={isEdit ? 'Update metadata properties' : 'Add new specialized metadata'}
            onSave={() => mutation.mutate()}
            saveButtonText={isEdit ? 'Save Changes' : 'Create Metadata'}
            isSaving={mutation.isPending}
            saveDisabled={mutation.isPending || !dataTypeId}
        >
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
                    <DataTypeSelect
                        value={dataTypeId}
                        onChange={(val: string) => setDataTypeId(val)}
                        dataTypes={dataTypes}
                        valueProp="id"
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
        </ManagementModal>
    );
};
