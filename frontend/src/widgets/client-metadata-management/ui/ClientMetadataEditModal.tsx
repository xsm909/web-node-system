import React, { useState, useEffect } from 'react';
import { useUpdateRecord } from '../../../entities/record/api';
import { Icon } from '../../../shared/ui/icon';
import { RjsfForm } from '../../../features/data-editor/RjsfForm';

interface ClientMetadataEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    assignment: any; // MetaAssignment response containing nested record and schema
}

export const ClientMetadataEditModal: React.FC<ClientMetadataEditModalProps> = ({
    isOpen,
    onClose,
    assignment,
}) => {
    const updateMutation = useUpdateRecord();
    const [formData, setFormData] = useState<any>(undefined);
    const [isValid, setIsValid] = useState(true);

    const safeParse = (val: any) => {
        if (val === null || val === undefined) return val;
        if (typeof val === 'string') {
            // Check if it looks like a JSON object or array
            const trimmed = val.trim();
            if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
                (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
                try {
                    return JSON.parse(val);
                } catch (e) {
                    return val;
                }
            }
            return val;
        }
        return val;
    };

    useEffect(() => {
        if (isOpen && assignment?.record) {
            console.log('Modal Assignment:', assignment);
            const rawData = assignment.record.data;
            const data = safeParse(rawData);
            console.log('Parsed Data:', { raw: rawData, parsed: data, type: typeof data });
            setFormData(data);
            setIsValid(true);
        }
    }, [isOpen, assignment]);

    if (!isOpen || !assignment) return null;

    const schemaRaw = assignment.record?.schema?.content;
    const schemaContent = safeParse(schemaRaw) || {};
    console.log('Parsed Schema:', { raw: schemaRaw, parsed: schemaContent });

    const schemaTitle = schemaContent?.title
        || assignment.record?.schema?.key
        || 'Unknown Schema';

    const recordId = assignment.record?.id;

    const handleSave = () => {
        if (!isValid || !recordId) return;
        updateMutation.mutate({ id: recordId, data: { data: formData } }, {
            onSuccess: () => onClose(),
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
            <div className="relative w-full max-w-3xl max-h-[90vh] bg-surface-900 rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-gray-700/50">

                {/* Header */}
                <div className="flex justify-between items-center px-6 py-5 border-b border-gray-800 bg-surface-800/50 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-brand/10 border border-brand/20">
                            <Icon name="edit" className="text-brand" size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold tracking-tight text-[var(--text-main)]">
                                Edit Metadata
                            </h2>
                            <p className="text-[11px] text-[var(--text-muted)] font-bold uppercase tracking-widest opacity-60 mt-0.5">
                                {schemaTitle}
                            </p>
                        </div>
                    </div>
                    <button
                        className="p-2 hover:bg-gray-800 rounded-xl transition-colors shrink-0 text-gray-400 hover:text-white"
                        onClick={onClose}
                    >
                        <Icon name="close" size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-surface-950">
                    <RjsfForm
                        schema={schemaContent}
                        formData={formData}
                        onChange={(data, valid) => {
                            setFormData(data);
                            setIsValid(valid);
                        }}
                    />
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-800 bg-surface-900 shrink-0">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 rounded-xl font-semibold text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-gray-800 transition-colors text-sm"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={updateMutation.isPending || !isValid}
                        className="px-6 py-2.5 rounded-xl bg-brand hover:brightness-110 active:scale-95 text-white text-sm font-bold transition-all shadow-lg shadow-brand/20 disabled:opacity-50 disabled:active:scale-100 flex items-center gap-2"
                    >
                        {updateMutation.isPending ? (
                            <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                        ) : (
                            <Icon name="save" size={16} />
                        )}
                        {updateMutation.isPending ? 'Saving...' : 'Save'}
                    </button>
                </div>
            </div>
        </div>
    );
};
