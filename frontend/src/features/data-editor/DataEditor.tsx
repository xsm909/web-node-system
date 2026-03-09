import React, { useEffect, useRef, useState } from 'react';
import { JSONEditor } from '@json-editor/json-editor';

interface DataEditorProps {
    schema: any;
    initialData: any;
    onChange: (data: any, isValid: boolean) => void;
    readOnly?: boolean;
}

export const DataEditor: React.FC<DataEditorProps> = ({
    schema,
    initialData,
    onChange,
    readOnly = false,
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const editorRef = useRef<JSONEditor | null>(null);
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        if (!containerRef.current) return;

        // Destroy previous instance
        if (editorRef.current) {
            editorRef.current.destroy();
            editorRef.current = null;
        }

        try {
            editorRef.current = new JSONEditor(containerRef.current, {
                schema: schema,
                startval: initialData,
                theme: 'tailwind',
                iconlib: 'spectre',
                disable_edit_json: true,
                disable_properties: true,
                disable_collapse: false,
                no_additional_properties: false,
                show_errors: 'interaction',
                object_layout: 'normal',
            });

            editorRef.current.on('change', () => {
                if (editorRef.current) {
                    const val = editorRef.current.getValue();
                    const errors = editorRef.current.validate();
                    onChange(val, errors.length === 0);
                }
            });

            editorRef.current.on('ready', () => {
                setIsReady(true);
                if (readOnly && editorRef.current) {
                    editorRef.current.disable();
                }
            });
        } catch (e) {
            console.error("Failed to initialize JSONEditor:", e);
        }

        return () => {
            if (editorRef.current) {
                editorRef.current.destroy();
                editorRef.current = null;
            }
        };
    }, [schema]); // Only re-init if schema changes drastically. 

    // Handle external data updates (if needed) without full re-init
    useEffect(() => {
        if (editorRef.current && isReady && initialData) {
            // Deep compare or simple check before overwriting to avoid cursor jumps
            // For now, we only trust initial load, but if external refresh is needed:
            // editorRef.current.setValue(initialData);
        }
    }, [initialData, isReady]);

    useEffect(() => {
        if (editorRef.current && isReady) {
            if (readOnly) editorRef.current.disable();
            else editorRef.current.enable();
        }
    }, [readOnly, isReady]);

    return (
        <div className="json-editor-container p-4 bg-gray-900 border border-gray-700 rounded-lg text-gray-200 override-tailwind-editor">
            <div ref={containerRef} />
        </div>
    );
};
