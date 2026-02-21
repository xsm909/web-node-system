import React, { useEffect, useRef, useState } from 'react';
import { JSONEditor } from '@json-editor/json-editor';

interface JsonEditorWrapperProps {
    schema?: any;
    value?: any;
    onChange?: (value: any) => void;
    readOnly?: boolean;
}

export const JsonEditorWrapper: React.FC<JsonEditorWrapperProps> = ({
    schema = {},
    value = {},
    onChange,
    readOnly = false,
}) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const jsonEditorInstance = useRef<any>(null);
    const [isLoaded, setIsLoaded] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const onChangeRef = useRef(onChange);
    useEffect(() => {
        onChangeRef.current = onChange;
    }, [onChange]);

    useEffect(() => {
        if (!editorRef.current) return;
        setError(null);

        // Ensure schema is an object
        let validSchema = typeof schema === 'object' && schema !== null ? { ...schema } : {};
        if (Object.keys(validSchema).length === 0) {
            validSchema = {
                type: "object",
                properties: {}
            };
        } else if (!validSchema.type) {
            validSchema.type = "object";
        }

        try {
            // Initialize editor
            jsonEditorInstance.current = new JSONEditor(editorRef.current, {
                schema: validSchema,
                startval: value || {},
                theme: 'tailwind',
                disable_edit_json: true,
                disable_properties: false,
                disable_collapse: true,
                no_additional_properties: false,
                object_layout: 'normal',
            });

            if (readOnly) {
                jsonEditorInstance.current.disable();
            }

            jsonEditorInstance.current.on('change', () => {
                const currentOnChange = onChangeRef.current;
                if (currentOnChange && !readOnly) {
                    currentOnChange(jsonEditorInstance.current.getValue());
                }
            });

            jsonEditorInstance.current.on('ready', () => {
                setIsLoaded(true);
            });
        } catch (e) {
            console.error("Failed to initialize JSONEditor:", e);
            setError("Failed to render editor: Invalid Schema.");
        }

        return () => {
            if (jsonEditorInstance.current) {
                jsonEditorInstance.current.destroy();
                jsonEditorInstance.current = null;
            }
        };
    }, [schema, readOnly]); // Re-initialize only when schema or readOnly changes

    // We do not want to re-initialize on every value change to not lose focus,
    // but if the parent forces a completely new value from outside, we might need to set it.
    // In our semantic flow, the editor drives the data mostly, but let's sync if needed.
    useEffect(() => {
        if (jsonEditorInstance.current && isLoaded && value) {
            // Check if different to avoid infinite loops and losing focus
            if (JSON.stringify(jsonEditorInstance.current.getValue()) !== JSON.stringify(value)) {
                jsonEditorInstance.current.setValue(value);
            }
        }
    }, [value, isLoaded]);

    return (
        <div className="w-full h-full p-4 overflow-y-auto bg-[var(--bg-app)] text-[var(--text-main)]">
            <style>
                {`
                /* Hide only the main root title, keep child titles */
                div[data-schemapath="root"] > h3.je-object__title { display: none !important; }
                div[data-schemapath="root"] > label.je-object__title { display: none !important; }
                div[data-schemapath="root"] > span.je-object__title { display: none !important; }

                .je-object__title { font-weight: bold; margin-bottom: 0.5rem; }
                .je-indented-panel { margin-left: 1rem; border-left: 2px solid var(--border-base); padding-left: 1rem; }
                
                /* Override button styles so default text appears cleanly with tailwind */
                .json-editor-btn {
                    padding: 0.25rem 0.5rem;
                    border-radius: 0.25rem;
                    border: 1px solid var(--border-base);
                    background-color: var(--bg-surface);
                    font-size: 0.75rem;
                    cursor: pointer;
                    margin: 0.2rem;
                    transition: all 0.2s;
                }
                .json-editor-btn:hover {
                    background-color: var(--border-muted);
                }

                /* Overrides for tailwind theme on dark mode */
                [data-theme="tailwind"] .bg-white { background-color: transparent !important; }
                `}
            </style>
            {error && (
                <div className="w-full mb-4 p-4 border border-red-500/50 bg-red-500/10 text-red-500 rounded-xl text-sm font-bold flex items-center justify-center">
                    {error}
                </div>
            )}
            <div ref={editorRef} style={{ display: error ? 'none' : 'block' }} />
        </div>
    );
};
