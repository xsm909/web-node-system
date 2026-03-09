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
            const trimmed = val.trim();
            // Only parse if it looks like a JSON structure
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

    const schemaRaw = assignment?.record?.schema?.content;
    const schemaContent = safeParse(schemaRaw) || {};
    const schemaType = schemaContent.type || 'object';

    useEffect(() => {
        if (isOpen && assignment?.record) {
            const rawData = assignment.record.data;
            let data = safeParse(rawData);

            // Critical fix: if data is empty/null but schema is primitive, 
            // DON'T initialize as {} which causes validation error
            if (data === null || data === undefined || (typeof data === 'object' && Object.keys(data).length === 0)) {
                if (schemaType === 'string') data = '';
                else if (schemaType === 'number' || schemaType === 'integer') data = 0;
                else if (schemaType === 'boolean') data = false;
                else data = {}; // Default to object only if type is object or unknown
            }

            setFormData(data);
            setIsValid(true);
        }
    }, [isOpen, assignment, schemaType]);

    if (!isOpen || !assignment) return null;

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
        <div className="fixed inset-0 z-[100] flex justify-end overflow-hidden">
            {/* Backdrop: only covers what's behind the panel */}
            <div
                className="fixed inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300"
                onClick={onClose}
            />

            {/* Side Panel (Drawer) */}
            <div className="relative w-full max-w-2xl h-full bg-surface-900 shadow-2xl flex flex-col border-l border-gray-700/50 animate-in slide-in-from-right duration-300 ease-out">

                {/* Header */}
                <div className="flex justify-between items-center px-6 py-5 border-b border-gray-800 bg-surface-800/80 backdrop-blur-md shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-2xl bg-brand/10 border border-brand/20 shadow-lg shadow-brand/10">
                            <Icon name="edit" className="text-brand" size={22} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold tracking-tight text-[var(--text-main)]">
                                Edit Metadata
                            </h2>
                            <p className="text-[11px] text-brand font-black uppercase tracking-[0.2em] mt-1 opacity-80">
                                {schemaTitle}
                            </p>
                        </div>
                    </div>
                    <button
                        className="p-2.5 hover:bg-white/5 rounded-2xl transition-all shrink-0 text-gray-400 hover:text-white group active:scale-90"
                        onClick={onClose}
                    >
                        <Icon name="close" size={24} className="group-hover:rotate-90 transition-transform duration-300" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-surface-950">
                    <div className="max-w-2xl mx-auto">
                        <RjsfForm
                            schema={schemaContent}
                            formData={formData}
                            onChange={(data, valid) => {
                                setFormData(data);
                                setIsValid(valid);
                            }}
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="flex justify-end items-center gap-4 px-8 py-6 border-t border-gray-800 bg-surface-900/95 backdrop-blur-sm shrink-0">
                    <button
                        onClick={onClose}
                        className="px-6 py-3 rounded-2xl font-bold text-sm text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-white/5 transition-all active:scale-95"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={updateMutation.isPending || !isValid}
                        className="px-8 py-3 rounded-2xl bg-brand hover:brightness-110 active:scale-95 text-white text-sm font-black transition-all shadow-xl shadow-brand/20 disabled:opacity-40 disabled:active:scale-100 flex items-center gap-3"
                    >
                        {updateMutation.isPending ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <Icon name="save" size={18} />
                        )}
                        <span>{updateMutation.isPending ? 'Saving...' : 'Save Changes'}</span>
                    </button>
                </div>
            </div>
        </div>
    );
};
