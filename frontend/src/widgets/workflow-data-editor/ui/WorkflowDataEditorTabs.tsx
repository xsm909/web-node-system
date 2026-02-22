import React, { useState, useMemo, useEffect } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';

interface WorkflowDataEditorTabsProps {
    workflowSchema: any;
    runtimeSchema: any;
    workflowData: any;
    onWorkflowSchemaChange: (value: any) => void;
    onRuntimeSchemaChange: (value: any) => void;
    onWorkflowDataChange: (value: any) => void;
}

type TabId = 'workflowSchema' | 'runtimeSchema' | 'workflowData';

const TABS: { id: TabId; label: string }[] = [
    { id: 'workflowSchema', label: 'Workflow Schema' },
    { id: 'runtimeSchema', label: 'Runtime Schema' },
    { id: 'workflowData', label: 'Workflow Data' },
];

export const WorkflowDataEditorTabs: React.FC<WorkflowDataEditorTabsProps> = ({
    workflowSchema,
    runtimeSchema,
    workflowData,
    onWorkflowSchemaChange,
    onRuntimeSchemaChange,
    onWorkflowDataChange,
}) => {
    const [activeTab, setActiveTab] = useState<TabId>('workflowSchema');

    const [workflowSchemaStr, setWorkflowSchemaStr] = useState(() => JSON.stringify(workflowSchema, null, 2));
    const [runtimeSchemaStr, setRuntimeSchemaStr] = useState(() => JSON.stringify(runtimeSchema, null, 2));
    const [workflowDataStr, setWorkflowDataStr] = useState(() => JSON.stringify(workflowData, null, 2));

    const codeMirrorExtensions = useMemo(() => [json()], []);

    useEffect(() => { setWorkflowSchemaStr(JSON.stringify(workflowSchema, null, 2)); }, [workflowSchema]);
    useEffect(() => { setRuntimeSchemaStr(JSON.stringify(runtimeSchema, null, 2)); }, [runtimeSchema]);
    useEffect(() => { setWorkflowDataStr(JSON.stringify(workflowData, null, 2)); }, [workflowData]);

    const handleChange = (value: string, setter: (v: string) => void, upstreamSetter: (v: any) => void) => {
        setter(value);
        try {
            upstreamSetter(JSON.parse(value));
        } catch {
            // Invalid JSON — don't propagate yet
        }
    };

    const activeValue = activeTab === 'workflowSchema' ? workflowSchemaStr
        : activeTab === 'runtimeSchema' ? runtimeSchemaStr
            : workflowDataStr;

    const handleActiveChange = (value: string) => {
        if (activeTab === 'workflowSchema') handleChange(value, setWorkflowSchemaStr, onWorkflowSchemaChange);
        else if (activeTab === 'runtimeSchema') handleChange(value, setRuntimeSchemaStr, onRuntimeSchemaChange);
        else handleChange(value, setWorkflowDataStr, onWorkflowDataChange);
    };

    return (
        <div className="w-full h-full flex flex-col bg-surface-900 overflow-hidden">
            <header className="px-6 pt-4 pb-0 border-b border-[var(--border-base)]">
                <div className="flex gap-1">
                    {TABS.map(tab => (
                        <button
                            key={tab.id}
                            type="button"
                            className={`px-5 py-3 text-xs font-black uppercase tracking-widest transition-all border-b-2 rounded-t-xl ${activeTab === tab.id
                                ? 'text-brand border-brand bg-brand/5'
                                : 'text-[var(--text-muted)] border-transparent hover:text-[var(--text-main)] hover:bg-[var(--border-muted)] opacity-60 hover:opacity-100'
                                }`}
                            onClick={() => setActiveTab(tab.id)}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </header>

            <div className="flex-1 overflow-hidden relative">
                <div className="absolute inset-0 flex flex-col pt-4 px-6 pb-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <div className="flex-1 rounded-2xl border border-[var(--border-base)] overflow-hidden ring-1 ring-black/20 focus-within:ring-2 focus-within:ring-brand/50 focus-within:border-brand transition-all shadow-inner">
                        <CodeMirror
                            key={activeTab}
                            value={activeValue}
                            height="100%"
                            theme="dark"
                            extensions={codeMirrorExtensions}
                            onChange={handleActiveChange}
                            className="h-full text-sm font-mono"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};
