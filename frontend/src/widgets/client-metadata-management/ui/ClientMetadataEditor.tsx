import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { useUpdateRecord } from '../../../entities/record/api';
import { useSchemas } from '../../../entities/schema/api';
import { RjsfForm } from '../../../features/data-editor/RjsfForm';
import { Icon } from '../../../shared/ui/icon/Icon';

interface ClientMetadataEditorProps {
    assignment: any; // Record object containing optional nested schema
    assignments: any[]; // Full list of assignments for the client
    activeClientId?: string;
    onSaveSuccess?: () => void;
}

export interface ClientMetadataEditorRef {
    handleSave: () => void;
    isSaving: boolean;
    isValid: boolean;
}

export const ClientMetadataEditor = forwardRef<ClientMetadataEditorRef, ClientMetadataEditorProps>(({
    assignment,
    assignments,
    activeClientId,
    onSaveSuccess,
}, ref) => {
    const updateMutation = useUpdateRecord();
    const { data: schemas, isLoading: isSchemasLoading } = useSchemas();
    const [formData, setFormData] = useState<any>(undefined);
    const [isValid, setIsValid] = useState(true);
    const [validationErrors, setValidationErrors] = useState<any[]>([]);
    const [saveError, setSaveError] = useState<string | null>(null);
    const seededRecordId = useRef<string | null>(null);
    const rjsfRef = useRef<any>(null);

    const safeParse = (val: any) => {
        if (val === null || val === undefined) return val;
        if (typeof val === 'string') {
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

    const schemaRaw = assignment?.schema?.content;
    const schemaContent = React.useMemo(() => safeParse(schemaRaw) || {}, [schemaRaw]);
    const schemaType = schemaContent.type || 'object';

    const getDefaults = (s: any): any => {
        if (!s || typeof s !== 'object') return undefined;
        if (s.default !== undefined) return s.default;

        if (s.type === 'object' && s.properties) {
            const obj: any = {};
            
            Object.entries(s.properties).forEach(([k, v]) => {
                const val = getDefaults(v);
                if (val !== undefined) {
                    obj[k] = val;
                }
            });
            return obj;
        }

        if (s.enum && Array.isArray(s.enum) && s.enum.length > 0) {
            return s.enum[0];
        }

        if (s.type === 'array') return [];
        if (s.type === 'string') return '';
        if (s.type === 'number' || s.type === 'integer') return 0;
        if (s.type === 'boolean') return false;

        return undefined;
    };

    useEffect(() => {
        const currentRecordId = assignment?.id ?? null;
        if (currentRecordId !== seededRecordId.current) {
            seededRecordId.current = currentRecordId;
            const rawData = assignment?.data;
            let data = safeParse(rawData);

            const isEmpty = data === null || data === undefined || (typeof data === 'object' && Object.keys(data).length === 0);

            if (isEmpty) {
                // Try to get defaults from schema
                const defaults = getDefaults(schemaContent);
                if (defaults !== undefined) {
                    data = defaults;
                } else {
                    if (schemaType === 'string') data = '';
                    else if (schemaType === 'number' || schemaType === 'integer') data = 0;
                    else if (schemaType === 'boolean') data = false;
                    else data = {};
                }
            }

            setFormData(data);
            // Default to true and let RjsfForm prove it otherwise if there are errors.
            setIsValid(true); 
            setSaveError(null);
            console.log("[ClientMetadataEditor] SEEDED:", {
                recordId: currentRecordId,
            });
        }
    }, [assignment?.id, schemaType]);

    const handleFormSubmit = (data: any) => {
        if (!assignment?.id) {
            setSaveError("Record ID is missing. Cannot save.");
            return;
        }

        setSaveError(null);
        updateMutation.mutate({ id: assignment.id, data: { data } }, {
            onSuccess: () => onSaveSuccess?.(),
            onError: (err: any) => {
                const detail = err?.response?.data?.detail
                    || err?.message
                    || 'Failed to save. Please check all required fields.';
                setSaveError(String(detail));
            },
        });
    };

    const handleSaveInternal = () => {
        // We always trigger the form's submit() logic.
        // It will validate first. If valid, it triggers onSubmit handlers.
        // If invalid, it highlights the errors in the UI.
        const isLocked = !!assignment?.is_locked;
        if (isLocked) return;

        if (!isValid) {
            setSaveError("Form has validation errors. Please check all fields.");
        }
        rjsfRef.current?.submit();
    };

    useImperativeHandle(ref, () => ({
        handleSave: handleSaveInternal,
        isSaving: updateMutation.isPending,
        isValid
    }));

    const isLoading = isSchemasLoading && !schemas;

    const extraSchemas = React.useMemo(() => {
        if (!schemas) return {};
        return schemas.reduce((acc: any, s) => {
            acc[s.key] = safeParse(s.content);
            return acc;
        }, {});
    }, [schemas]);

    return (
        <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-surface-950/20 rounded-3xl border border-[var(--border-base)]">
                <div className="max-w-5xl mx-auto w-full h-full animate-in fade-in slide-in-from-bottom-4 duration-500 p-2">
                    {saveError && (
                        <div className="mb-6 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 font-medium flex flex-col gap-2 shadow-sm animate-in fade-in zoom-in-95 duration-200">
                            <div className="flex items-center gap-3">
                                <span className="text-lg">⚠</span> {saveError}
                            </div>
                            {validationErrors.length > 0 && (
                                <ul className="list-disc list-inside ml-7 mt-1 space-y-1 opacity-80">
                                    {validationErrors.map((err, i) => (
                                        <li key={i}>{err.stack || err.message || String(err)}</li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    )}

                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center h-64 gap-4">
                            <div className="w-10 h-10 border-4 border-brand/20 border-t-brand rounded-full animate-spin" />
                            <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest animate-pulse">
                                Loading Schemas...
                            </p>
                        </div>
                    ) : (
                        <RjsfForm
                            ref={rjsfRef}
                            schema={schemaContent}
                            formData={formData}
                            onChange={(data, valid, errors) => {
                                setFormData(data);
                                setIsValid(valid);
                                setValidationErrors(errors || []);
                                if (valid) setSaveError(null);
                            }}
                            onSubmit={handleFormSubmit}
                            extraSchemas={extraSchemas}
                            activeClientId={activeClientId}
                            assignments={assignments}
                            recordId={assignment?.id}
                            readOnly={!!assignment?.is_locked}
                        />
                    )}
                </div>
            </div>
        </div>
    );
});
