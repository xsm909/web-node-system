import { useState, forwardRef, useImperativeHandle, useMemo } from "react";
import type { Report, ReportParameter, ReportStyle, ReportType } from "../../../entities/report/model/types";
import { Icon } from "../../../shared/ui/icon";
import { apiClient } from "../../../shared/api/client";
import type { SelectionGroup } from "../../../shared/ui/selection-list/SelectionList";
import { AIAssistantButton } from "../../../features/ai-assistant/ui/AIAssistantButton";
import CodeMirror from "@uiw/react-codemirror";
import { sql } from "@codemirror/lang-sql";
import { html } from "@codemirror/lang-html";
import { vscodeDark, vscodeLight } from "@uiw/codemirror-theme-vscode";
import { useThemeStore } from "../../../shared/lib/theme/store";

interface ReportEditorProps {
    report?: Report | null;
    styles: ReportStyle[];
    onBack: () => void;
    activeTab: 'details' | 'builder';
}

export interface ReportEditorRef {
    handleSave: () => Promise<void>;
    isSaving: boolean;
}

export const ReportEditor = forwardRef<ReportEditorRef, ReportEditorProps>(({ report, styles, onBack, activeTab }, ref) => {
    const { theme } = useThemeStore();
    const [isSaving, setIsSaving] = useState(false);

    // Explicitly memoize extensions and theme to ensure reactivity
    const editorTheme = useMemo(() => (theme === "dark" ? vscodeDark : vscodeLight), [theme]);
    const sqlExtensions = useMemo(() => [sql()], []);
    const htmlExtensions = useMemo(() => [html()], []);

    useImperativeHandle(ref, () => ({
        handleSave,
        isSaving
    }));

    // Form State
    const [name, setName] = useState(report?.name || '');
    const [type, setType] = useState<ReportType>(report?.type || 'global');
    const [description, setDescription] = useState(report?.description || '');
    const [query, setQuery] = useState(report?.query || '');
    const [template, setTemplate] = useState(report?.template || '');
    const [styleId, setStyleId] = useState(report?.style_id || '');
    const [parameters, setParameters] = useState<ReportParameter[]>(report?.parameters || []);
    const meta = report?.meta || {};

    const handleAddParameter = () => {
        setParameters([
            ...parameters,
            { id: Date.now().toString(), parameter_name: '', source: '', value_field: '', label_field: '' }
        ]);
    };

    const handleRemoveParameter = (index: number) => {
        setParameters(parameters.filter((_, i) => i !== index));
    };

    const handleParameterChange = (index: number, field: keyof ReportParameter, value: string) => {
        const newParams = [...parameters];
        newParams[index] = { ...newParams[index], [field]: value };
        setParameters(newParams);
    };

    const handleSave = async () => {
        if (!name || !query || !template) {
            alert("Name, query, and template are required");
            return;
        }

        setIsSaving(true);
        const payload = {
            name,
            type,
            description,
            query,
            template,
            style_id: styleId || null,
            meta,
            parameters: parameters.map(({ id, ...rest }: any) => rest) // strip local id
        };

        try {
            if (report?.id) {
                await apiClient.put(`/reports/${report.id}`, payload);
            } else {
                await apiClient.post('/reports', payload);
            }
            onBack();
        } catch (error) {
            console.error("Failed to save report", error);
            alert("Failed to save report. Check console for details.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleAutoGenerateTemplate = async (result: any) => {
        if (result && result.template) {
            setTemplate(result.template);
        }
    };

    const handleAutoGenerateSql = (result: any) => {
        if (typeof result === 'string') {
            setQuery(result);
        }
    };
    const modelData: Record<string, SelectionGroup> = {
        items: {
            id: 'models',
            name: 'Models',
            items: [
                { id: 'gpt-4o', name: 'gpt-4o' },
                { id: 'gpt-5o', name: 'gpt-5o' },
                { id: 'gpt-5.2', name: 'gpt-5.2' },
            ],
            children: {},
            selectable: false
        }
    };

    return (
        <div className="flex flex-col h-full bg-[var(--bg-app)] overflow-y-auto">
            <div className="p-6">
                <div className="max-w-5xl mx-auto">
                    {activeTab === 'details' ? (
                        <div className="max-w-3xl mx-auto space-y-6">
                            <div className="space-y-4">
                                <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--text-muted)]">General Information</h3>

                                <div className="space-y-1.5">
                                    <label className="text-sm font-bold text-[var(--text-main)]">Report Name *</label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="w-full px-4 py-2.5 rounded-xl bg-[var(--bg-app)] border border-[var(--border-base)] text-sm focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-all"
                                        placeholder="e.g. Monthly User Signups"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-sm font-bold text-[var(--text-main)]">Report Type</label>
                                    <select
                                        value={type}
                                        onChange={(e) => setType(e.target.value as ReportType)}
                                        className="w-full px-4 py-2.5 rounded-xl bg-[var(--bg-app)] border border-[var(--border-base)] text-sm focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-all"
                                    >
                                        <option value="global">Global</option>
                                        <option value="client">Client-Specific</option>
                                    </select>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-sm font-bold text-[var(--text-main)]">Description</label>
                                    <textarea
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        rows={4}
                                        className="w-full px-4 py-2.5 rounded-xl bg-[var(--bg-app)] border border-[var(--border-base)] text-sm focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-all resize-none"
                                        placeholder="Briefly describe what this report shows..."
                                    />
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="max-w-5xl mx-auto space-y-8">

                            {/* Query Editor */}
                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-4">
                                        <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--text-muted)]">SQL Query *</h3>
                                        <AIAssistantButton
                                            hintType="sql"
                                            onResult={handleAutoGenerateSql}
                                            label="SQL Assistant"
                                            isEmpty={!query}
                                            context={query ? { existing_query: query } : null}
                                            modelData={modelData}
                                        />
                                    </div>
                                </div>
                                <div className="rounded-xl border border-[var(--border-base)] overflow-hidden ring-1 ring-black/20 focus-within:ring-2 focus-within:ring-brand/50 focus-within:border-brand transition-all">
                                    <CodeMirror
                                        key={`sql-${theme}`}
                                        value={query}
                                        height="300px"
                                        theme={editorTheme}
                                        extensions={sqlExtensions}
                                        onChange={(value) => setQuery(value)}
                                        className="text-sm font-mono"
                                        basicSetup={{
                                            lineNumbers: true,
                                            highlightActiveLine: true,
                                            foldGutter: true,
                                        }}
                                    />
                                </div>
                                <p className="text-xs text-[var(--text-muted)] mt-1">
                                    Use <code className="bg-[var(--border-muted)] px-1 rounded text-brand">:ParamName</code> for mapped parameters.
                                </p>
                            </div>

                            {/* Template Editor */}
                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-4">
                                        <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--text-muted)]">HTML Template *</h3>
                                        <AIAssistantButton
                                            hintType="report_template"
                                            onResult={handleAutoGenerateTemplate}
                                            label="Template Assistant"
                                            isEmpty={!template}
                                            context={{ query }}
                                            modelData={modelData}
                                        />
                                    </div>
                                    <div className="w-1/3">
                                        <select
                                            value={styleId}
                                            onChange={(e) => setStyleId(e.target.value)}
                                            className="w-full px-3 py-1.5 rounded-lg bg-[var(--bg-app)] border border-[var(--border-base)] text-sm focus:outline-none"
                                        >
                                            <option value="">Default Style</option>
                                            {styles.map(s => (
                                                <option key={s.id} value={s.id}>{s.name} {s.is_default ? '(Default)' : ''}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div className="rounded-xl border border-[var(--border-base)] overflow-hidden ring-1 ring-black/20 focus-within:ring-2 focus-within:ring-brand/50 focus-within:border-brand transition-all">
                                    <CodeMirror
                                        key={`html-${theme}`}
                                        value={template}
                                        height="400px"
                                        theme={editorTheme}
                                        extensions={htmlExtensions}
                                        onChange={(value) => setTemplate(value)}
                                        className="text-sm font-mono"
                                        basicSetup={{
                                            lineNumbers: true,
                                            highlightActiveLine: true,
                                            foldGutter: true,
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Parameters */}
                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--text-muted)]">Parameters</h3>
                                    <button
                                        onClick={handleAddParameter}
                                        className="text-xs font-bold text-brand hover:underline flex items-center gap-1"
                                    >
                                        <Icon name="add" size={14} /> Add Parameter
                                    </button>
                                </div>

                                {parameters.length === 0 ? (
                                    <div className="text-center p-6 border border-dashed border-[var(--border-base)] rounded-xl text-sm text-[var(--text-muted)]">
                                        No parameters defined. The report will run without dynamic inputs.
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {parameters.map((param, index) => (
                                            <div key={index} className="flex items-start gap-4 p-4 border border-[var(--border-base)] rounded-xl bg-[var(--bg-app)]">
                                                <div className="flex-1 grid grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">Name (used in SQL)</label>
                                                        <input
                                                            value={param.parameter_name}
                                                            onChange={(e) => handleParameterChange(index, 'parameter_name', e.target.value)}
                                                            className="w-full px-3 py-2 rounded-lg border border-[var(--border-base)] text-sm"
                                                            placeholder="e.g. status"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">Source (SQL Query)</label>
                                                        <input
                                                            value={param.source}
                                                            onChange={(e) => handleParameterChange(index, 'source', e.target.value)}
                                                            className="w-full px-3 py-2 rounded-lg border border-[var(--border-base)] text-sm"
                                                            placeholder="SELECT id, username FROM users"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">Value Field</label>
                                                        <input
                                                            value={param.value_field}
                                                            onChange={(e) => handleParameterChange(index, 'value_field', e.target.value)}
                                                            className="w-full px-3 py-2 rounded-lg border border-[var(--border-base)] text-sm"
                                                            placeholder="id"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">Label Field</label>
                                                        <input
                                                            value={param.label_field}
                                                            onChange={(e) => handleParameterChange(index, 'label_field', e.target.value)}
                                                            className="w-full px-3 py-2 rounded-lg border border-[var(--border-base)] text-sm"
                                                            placeholder="username"
                                                        />
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleRemoveParameter(index)}
                                                    className="p-2 mt-5 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                                >
                                                    <Icon name="delete" size={20} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
});
