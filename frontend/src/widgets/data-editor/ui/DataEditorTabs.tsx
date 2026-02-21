import React, { useState, useMemo, useEffect } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';

interface DataEditorTabsProps {
    schemaTitle?: string;
    dataTitle?: string;
    schema: any;
    data: any;
    onSchemaChange: (newSchema: any) => void;
    onDataChange: (newData: any) => void;
    readOnlyData?: boolean;
    hideDataTab?: boolean;
    hideSchemaTab?: boolean;
}

export const DataEditorTabs: React.FC<DataEditorTabsProps> = ({
    schemaTitle = "Edit Structure (JSON Schema)",
    dataTitle = "Edit Data",
    schema,
    data,
    onSchemaChange,
    onDataChange,
    readOnlyData = false,
    hideDataTab = false,
    hideSchemaTab = false
}) => {
    const [activeTab, setActiveTab] = useState<'schema' | 'data'>(hideDataTab ? 'schema' : 'data');

    // We keep local string state for CodeMirror to avoid parsing errors blocking typing
    const [schemaStr, setSchemaStr] = useState(() => JSON.stringify(schema, null, 2));
    const [dataStr, setDataStr] = useState(() => JSON.stringify(data, null, 2));

    const codeMirrorExtensions = useMemo(() => [json()], []);

    // Sync from prop to local if prop changes from outside
    useEffect(() => {
        setSchemaStr(JSON.stringify(schema, null, 2));
    }, [schema]);

    useEffect(() => {
        setDataStr(JSON.stringify(data, null, 2));
    }, [data]);

    const handleSchemaStrChange = (value: string) => {
        setSchemaStr(value);
        try {
            const parsed = JSON.parse(value);
            onSchemaChange(parsed);
        } catch (e) {
            // Invalid JSON, don't update upstream yet
        }
    };

    const handleDataStrChange = (value: string) => {
        setDataStr(value);
        try {
            const parsed = JSON.parse(value);
            onDataChange(parsed);
        } catch (e) {
            // Invalid JSON, don't update upstream yet
        }
    };

    return (
        <div className="w-full h-full flex flex-col bg-surface-900 overflow-hidden">
            <header className="px-6 pt-4 pb-0 border-b border-[var(--border-base)] flex flex-col gap-4">
                <div className="flex gap-2">
                    {!hideDataTab && (
                        <button
                            type="button"
                            className={`px-6 py-3 text-xs font-black uppercase tracking-widest transition-all border-b-2 rounded-t-xl ${activeTab === 'data'
                                ? 'text-brand border-brand bg-brand/5'
                                : 'text-[var(--text-muted)] border-transparent hover:text-[var(--text-main)] hover:bg-[var(--border-muted)] opacity-60 hover:opacity-100'
                                }`}
                            onClick={() => setActiveTab('data')}
                        >
                            {dataTitle}
                        </button>
                    )}
                    {!hideSchemaTab && (
                        <button
                            type="button"
                            className={`px-6 py-3 text-xs font-black uppercase tracking-widest transition-all border-b-2 rounded-t-xl ${activeTab === 'schema'
                                ? 'text-brand border-brand bg-brand/5'
                                : 'text-[var(--text-muted)] border-transparent hover:text-[var(--text-main)] hover:bg-[var(--border-muted)] opacity-60 hover:opacity-100'
                                }`}
                            onClick={() => setActiveTab('schema')}
                        >
                            {schemaTitle}
                        </button>
                    )}
                </div>
            </header>

            <div className="flex-1 overflow-hidden relative">
                {activeTab === 'schema' ? (
                    <div className="absolute inset-0 flex flex-col pt-4 px-6 pb-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <div className="flex-1 rounded-2xl border border-[var(--border-base)] overflow-hidden ring-1 ring-black/20 focus-within:ring-2 focus-within:ring-brand/50 focus-within:border-brand transition-all shadow-inner">
                            <CodeMirror
                                value={schemaStr}
                                height="100%"
                                theme="dark"
                                extensions={codeMirrorExtensions}
                                onChange={handleSchemaStrChange}
                                className="h-full text-sm font-mono"
                            />
                        </div>
                    </div>
                ) : (
                    <div className="absolute inset-0 flex flex-col pt-4 px-6 pb-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <div className="flex-1 rounded-2xl border border-[var(--border-base)] overflow-hidden ring-1 ring-black/20 focus-within:ring-2 focus-within:ring-brand/50 focus-within:border-brand transition-all shadow-inner">
                            <CodeMirror
                                value={dataStr}
                                height="100%"
                                theme="dark"
                                extensions={codeMirrorExtensions}
                                onChange={handleDataStrChange}
                                className="h-full text-sm font-mono"
                                editable={!readOnlyData}
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
