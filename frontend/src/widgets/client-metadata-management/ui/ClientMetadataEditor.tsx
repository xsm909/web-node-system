import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { useUpdateRecord } from '../../../entities/record/api';
import { useSchemas } from '../../../entities/schema/api';
import { RjsfForm } from '../../../features/data-editor/RjsfForm';

interface ClientMetadataEditorProps {
    assignment: any; // MetaAssignment response containing nested record and schema
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
    const [saveError, setSaveError] = useState<string | null>(null);
    const seededRecordId = useRef<string | null>(null);

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

    const schemaRaw = assignment?.record?.schema?.content;
    const schemaContent = React.useMemo(() => safeParse(schemaRaw) || {}, [schemaRaw]);
    const schemaType = schemaContent.type || 'object';

    const getDefaults = (s: any): any => {
        if (!s || typeof s !== 'object') return undefined;
        if (s.default !== undefined) return s.default;

        if (s.type === 'object' && s.properties) {
            const obj: any = {};
            const requiredProps = Array.isArray(s.required) ? s.required : [];
            
            Object.entries(s.properties).forEach(([k, v]) => {
                const val = getDefaults(v);
                if (val !== undefined) {
                    obj[k] = val;
                } else if (requiredProps.includes(k)) {
                    // If required but no default, provide a "zero" value
                    const sub = v as any;
                    if (sub.type === 'array') obj[k] = [];
                    else if (sub.type === 'object') obj[k] = {};
                    else if (sub.type === 'string') obj[k] = '';
                    else if (sub.type === 'number' || sub.type === 'integer') obj[k] = 0;
                    else if (sub.type === 'boolean') obj[k] = false;
                }
            });
            return obj;
        }

        if (s.type === 'array') return [];
        if (s.type === 'string') return '';
        if (s.type === 'number' || s.type === 'integer') return 0;
        if (s.type === 'boolean') return false;

        return undefined;
    };

    useEffect(() => {
        const currentRecordId = assignment?.record?.id ?? null;
        if (currentRecordId !== seededRecordId.current) {
            seededRecordId.current = currentRecordId;
            const rawData = assignment?.record?.data;
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
            setIsValid(true);
            setSaveError(null);
            console.log("[ClientMetadataEditor] SEEDED:", {
                recordId: currentRecordId,
                assignmentId: assignment?.id,
                recordIdFallback: assignment?.record_id
            });
        }
    }, [assignment?.record?.id, schemaType]);

    const handleSaveInternal = () => {
        if (!isValid) {
            setSaveError("Form has validation errors. Please check all fields.");
            return;
        }

        if (!assignment?.record?.id) {
            setSaveError("Record ID is missing. Cannot save.");
            return;
        }

        setSaveError(null);
        updateMutation.mutate({ id: assignment.record.id, data: { data: formData } }, {
            onSuccess: () => onSaveSuccess?.(),
            onError: (err: any) => {
                const detail = err?.response?.data?.detail
                    || err?.message
                    || 'Failed to save. Please check all required fields.';
                setSaveError(String(detail));
            },
        });
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
                <div className="max-w-3xl mx-auto">
                    {saveError && (
                        <div className="mb-6 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 font-medium flex items-center gap-3">
                            <span className="text-lg">⚠</span> {saveError}
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
                            schema={schemaContent}
                            formData={formData}
                            onChange={(data, valid) => {
                                setFormData(data);
                                setIsValid(valid);
                            }}
                            extraSchemas={extraSchemas}
                            activeClientId={activeClientId}
                            assignments={assignments}
                            recordId={assignment?.record?.id || assignment?.record_id || assignment?.id}
                        />
                    )}
                </div>
            </div>
        </div>
    );
});
