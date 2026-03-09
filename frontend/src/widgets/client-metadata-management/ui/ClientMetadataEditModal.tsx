import React, { useState, useEffect } from 'react';
import { useUpdateRecord } from '../../../entities/record/api';
import { Icon } from '../../../shared/ui/icon';
import { DataEditor } from '../../../features/data-editor/DataEditor';

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
    const [editorData, setEditorData] = useState<any>(null);
    const [isValid, setIsValid] = useState(true);

    useEffect(() => {
        if (isOpen && assignment?.record) {
            setEditorData(assignment.record.data || {});
            setIsValid(true);
        }
    }, [isOpen, assignment]);

    if (!isOpen || !assignment) return null;

    const schemaKey = assignment.record?.schema?.key || 'Unknown Schema';
    const schemaContent = assignment.record?.schema?.content || {};
    const recordId = assignment.record?.id;

    const handleSave = () => {
        if (!isValid) return;
        updateMutation.mutate({
            id: recordId,
            data: editorData
        }, {
            onSuccess: () => {
                onClose();
            }
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
            <div className="relative w-full max-w-4xl max-h-full bg-surface-900 rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-gray-700">
                <div className="flex justify-between items-center p-6 border-b border-gray-800 bg-surface-800/50">
                    <div>
                        <h2 className="text-xl font-bold tracking-tight flex items-center gap-3">
                            <Icon name="edit_document" className="text-brand" size={24} />
                            Edit Record Data
                        </h2>
                        <p className="text-sm text-gray-400 mt-1 flex items-center gap-2">
                            Schema: <span className="text-gray-200 font-mono bg-surface-700 px-2 py-0.5 rounded-md">{schemaKey}</span>
                        </p>
                    </div>
                    <button
                        className="p-2 hover:bg-gray-800 rounded-xl transition-colors shrink-0 text-gray-400 hover:text-white"
                        onClick={onClose}
                    >
                        <Icon name="close" size={24} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-surface-950">
                    {/* JSON Editor dynamically rendered here */}
                    <div className="bg-surface-800 rounded-xl border border-gray-700 overflow-hidden">
                        <DataEditor
                            schema={schemaContent}
                            initialData={editorData}
                            onChange={(data, valid) => {
                                setEditorData(data);
                                setIsValid(valid);
                            }}
                        />
                    </div>
                </div>

                <div className="flex justify-end gap-3 p-6 border-t border-gray-800 bg-surface-900">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 rounded-xl font-semibold text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={updateMutation.isPending || !isValid}
                        className="px-6 py-2.5 rounded-xl bg-brand hover:brightness-110 active:scale-95 text-white font-bold transition-all shadow-lg shadow-brand/20 disabled:opacity-50 flex items-center gap-2"
                    >
                        {updateMutation.isPending && (
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                        )}
                        <Icon name="save" size={18} />
                        Save Record
                    </button>
                </div>
            </div>
        </div>
    );
};
