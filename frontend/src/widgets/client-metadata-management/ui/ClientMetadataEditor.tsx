import React, { useState, useEffect, useRef, useImperativeHandle } from 'react';
import { useUpdateMetadata } from '../../../entities/metadata/api';
import { useProjectStore } from '../../../features/projects/store';
import type { Metadata } from '../../../entities/metadata/api';
import { useSchemas } from '../../../entities/schema/api';
import { RjsfForm } from '../../../features/data-editor/RjsfForm';

interface ClientMetadataEditorProps {
    assignment: Metadata | null;
    assignments: Metadata[]; // Added back as it's used by RjsfForm
    activeClientId?: string | null;
    onSave?: (data: any, isManual?: boolean) => void;
    onDirtyChange?: (isDirty: boolean) => void;
}

export interface ClientMetadataEditorRef {
    handleSave: () => void;
    handleSaveAndClose: () => void;
    isSaving: boolean;
    isValid: boolean;
}

export const ClientMetadataEditor = React.forwardRef<ClientMetadataEditorRef, ClientMetadataEditorProps>(({
    assignment,
    assignments,
    activeClientId,
    onSave,
    onDirtyChange
}, ref) => {
    const updateMetadataMutation = useUpdateMetadata();
    const { isProjectMode } = useProjectStore();
    const { data: schemas, isLoading: isSchemasLoading } = useSchemas();
    const [formData, setFormData] = useState<any>(undefined);
    const [isValid, setIsValid] = useState(true);
    const [validationErrors, setValidationErrors] = useState<any[]>([]);
    const [saveError, setSaveError] = useState<string | null>(null);
    const seededRecordId = useRef<string | null>(null);
    const rjsfRef = useRef<any>(null);
    const isManualSave = useRef(false);

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
            let data = typeof rawData === 'string' ? safeParse(rawData) : rawData;

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
        }
    }, [assignment?.id, schemaType, schemaContent]);
    
    const isDirty = React.useMemo(() => {
        if (!assignment || !formData) return false;
        const initialData = typeof assignment.data === 'string' ? safeParse(assignment.data) : assignment.data;
        // Compare stringified objects to detect changes
        return JSON.stringify(formData) !== JSON.stringify(initialData || {});
    }, [formData, assignment]);

    useEffect(() => {
        onDirtyChange?.(isDirty);
    }, [isDirty, onDirtyChange]);

    const handleFormSubmit = (data: any) => {
        if (!assignment?.id) {
            setSaveError("Record ID is missing. Cannot save.");
            return;
        }

        setSaveError(null);
        updateMetadataMutation.mutate({ id: assignment.id, data: { data } }, {
            onSuccess: () => {
                onSave?.(data, isManualSave.current);
                isManualSave.current = false;
            },
            onError: (err: any) => {
                const detail = err?.response?.data?.detail
                    || err?.message
                    || 'Failed to save. Please check all required fields.';
                
                // Handle structured error details from FastAPI
                const errorMessage = typeof detail === 'object' 
                    ? JSON.stringify(detail, null, 2) 
                    : String(detail);
                    
                setSaveError(errorMessage);
            },
        });
    };

    const handleSaveInternal = (isManual: boolean) => {
        const isUserMetadataInProjectMode = isProjectMode && !assignment?.project_id;
        const isLocked = !!assignment?.is_locked || isUserMetadataInProjectMode;
        if (isLocked) return;

        if (!isValid) {
            setSaveError("Form has validation errors. Please check all fields.");
        }
        isManualSave.current = isManual;
        rjsfRef.current?.submit();
    };

    useImperativeHandle(ref, () => ({
        handleSave: () => handleSaveInternal(true),
        handleSaveAndClose: () => handleSaveInternal(false),
        isSaving: updateMetadataMutation.isPending,
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

    if (!assignment) return null;

    return (
        <div className="flex-1 overflow-hidden flex flex-col">
            <div className="flex-1 overflow-y-auto px-6 py-4 custom-scrollbar">
                {saveError && (
                    <div className="mb-4 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                        <div className="font-bold flex items-center gap-1.5 mb-1 text-red-300">
                            <span className="text-sm">⚠</span> {saveError}
                        </div>
                        {validationErrors.length > 0 && (
                            <ul className="list-disc list-inside mt-1 opacity-80 space-y-0.5">
                                {validationErrors.map((err, i) => (
                                    <li key={i}>{err.stack || err.message || String(err)}</li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}

                {isLoading ? (
                    <div className="flex items-center justify-center h-32">
                        <div className="w-6 h-6 border-2 border-brand/20 border-t-brand rounded-full animate-spin" />
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
                        activeClientId={activeClientId || undefined}
                        assignments={assignments}
                        metadataId={assignment.id}
                        readOnly={!!assignment.is_locked || (isProjectMode && !assignment.project_id)}
                    />
                )}
            </div>
        </div>
    );
});
