import React, { useState } from 'react';
import { useSchemas } from '../../../entities/schema/api';
import { useCreateRecord, useAssignMetadata } from '../../../entities/record/api';
import { Icon } from '../../../shared/ui/icon';

interface AssignSchemaModalProps {
    isOpen: boolean;
    onClose: () => void;
    activeClientId: string;
}

export const AssignSchemaModal: React.FC<AssignSchemaModalProps> = ({
    isOpen,
    onClose,
    activeClientId
}) => {
    const { data: schemas, isLoading } = useSchemas();
    const createRecordMutation = useCreateRecord();
    const assignMetadataMutation = useAssignMetadata();

    const [selectedSchemaId, setSelectedSchemaId] = useState<string>('');

    if (!isOpen) return null;

    const handleAssign = async () => {
        if (!selectedSchemaId) return;

        try {
            // 1. Create empty record belonging to the schema
            const newRecord = await createRecordMutation.mutateAsync({
                schema_id: selectedSchemaId,
                data: {}
            });

            // 2. Assign the record to the active client
            await assignMetadataMutation.mutateAsync({
                record_id: newRecord.id,
                entity_type: 'client',
                entity_id: activeClientId,
                owner_id: activeClientId
            });

            onClose();
        } catch (e) {
            console.error("Failed to assign schema:", e);
            alert("Failed to assign schema. Check console for details.");
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
            <div className="relative w-full max-w-md bg-surface-900 rounded-2xl shadow-2xl flex flex-col border border-gray-700">
                <div className="flex justify-between items-center p-5 border-b border-gray-800">
                    <h2 className="text-lg font-bold flex items-center gap-2 text-[var(--text-main)]">
                        <Icon name="link_add" className="text-brand" size={20} />
                        Assign Schema to Client
                    </h2>
                    <button
                        className="p-1.5 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition-colors"
                        onClick={onClose}
                    >
                        <Icon name="close" size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    <p className="text-sm text-gray-400">
                        Select a metadata schema from the registry to attach to this client. This will create a new empty dataset that managers can later edit.
                    </p>

                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-gray-500">Available Schemas</label>
                        {isLoading ? (
                            <div className="text-sm text-gray-400">Loading schemas...</div>
                        ) : (
                            <select
                                value={selectedSchemaId}
                                onChange={e => setSelectedSchemaId(e.target.value)}
                                className="w-full bg-surface-950 border border-gray-700 text-[var(--text-main)] text-sm rounded-xl px-4 py-3 outline-none focus:border-brand transition-colors"
                            >
                                <option value="" disabled>Select a schema...</option>
                                {schemas?.map(schema => (
                                    <option key={schema.id} value={schema.id}>
                                        {schema.key} {schema.is_system ? '(System)' : ''}
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>
                </div>

                <div className="flex justify-end gap-3 p-5 border-t border-gray-800 bg-surface-800/50 rounded-b-2xl">
                    <button
                        onClick={onClose}
                        className="px-5 py-2 rounded-xl text-sm font-semibold text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleAssign}
                        disabled={!selectedSchemaId || createRecordMutation.isPending || assignMetadataMutation.isPending}
                        className="px-5 py-2 rounded-xl text-sm font-bold bg-brand text-white hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100 flex items-center gap-2 shadow-lg shadow-brand/20"
                    >
                        {(createRecordMutation.isPending || assignMetadataMutation.isPending) ? 'Assigning...' : 'Assign'}
                    </button>
                </div>
            </div>
        </div>
    );
};
