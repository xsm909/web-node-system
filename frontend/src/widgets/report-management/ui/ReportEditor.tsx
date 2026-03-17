import { useState, forwardRef, useImperativeHandle, useMemo, useRef, useEffect } from "react";
import type { Report, ReportParameter, ReportStyle, ReportType } from "../../../entities/report/model/types";
import { Icon } from "../../../shared/ui/icon";
import { apiClient } from "../../../shared/api/client";
import { python } from "@codemirror/lang-python";
import { html } from "@codemirror/lang-html";
import CodeMirror from "@uiw/react-codemirror";
import { vscodeDark, vscodeLight } from "@uiw/codemirror-theme-vscode";
import { indentUnit } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { useThemeStore } from "../../../shared/lib/theme/store";

interface ReportEditorProps {
    report?: Report | null;
    styles: ReportStyle[];
    onBack: () => void;
    activeTab: 'general' | 'code' | 'template' | 'preview';
    onDirtyChange?: (dirty: boolean) => void;
}

export interface ReportEditorRef {
    handleSave: () => Promise<void>;
    isSaving: boolean;
}

export const ReportEditor = forwardRef<ReportEditorRef, ReportEditorProps>(({ report, styles, onBack, activeTab, onDirtyChange }, ref) => {
    const { theme } = useThemeStore();
    const [isSaving, setIsSaving] = useState(false);
    const [isCompiling, setIsCompiling] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);

    const editorTheme = useMemo(() => (theme === "dark" ? vscodeDark : vscodeLight), [theme]);
    const pythonExtensions = useMemo(() => [
        python(),
        indentUnit.of('    '),
        EditorState.tabSize.of(4),
    ], []);
    const htmlExtensions = useMemo(() => [
        html(),
        indentUnit.of('    '),
        EditorState.tabSize.of(4),
    ], []);

    // Form State
    const [name, setName] = useState(report?.name || '');
    const [type, setType] = useState<ReportType>(report?.type || 'global');
    const [description, setDescription] = useState(report?.description || '');
    const [code, setCode] = useState(report?.code || 'def ParametersProcessing(parameters, mode):\n    return parameters, True\n\ndef GenerateReport(parameters):\n    return [], True');
    const [template, setTemplate] = useState(report?.template || '<table>\n  {% for row in data %}\n  <tr>\n    <td>{{ row }}</td>\n  </tr>\n  {% endfor %}\n</table>');
    const [styleId, setStyleId] = useState(report?.style_id || '');
    const [category, setCategory] = useState(report?.category || '');
    const [parameters, setParameters] = useState<ReportParameter[]>(report?.parameters || []);
    
    // Output state
    const [consoleOutput, setConsoleOutput] = useState('');
    const [schemaJson, setSchemaJson] = useState<Record<string, any>>(report?.schema_json || {});
    const [previewHtml, setPreviewHtml] = useState('');
    const [activeOutputTab, setActiveOutputTab] = useState<'console' | 'schema'>('console');

    const initialRef = useRef<any>(null);

    useEffect(() => {
        if (report && !initialRef.current) {
            initialRef.current = {
                name: report.name || '',
                type: report.type || 'global',
                description: report.description || '',
                code: report.code || '',
                template: report.template || '',
                styleId: report.style_id || '',
                category: report.category || '',
                parameters: JSON.stringify(report.parameters || []),
            };
        }
    }, [report]);

    useEffect(() => {
        if (!initialRef.current) return;
        const currentParams = JSON.stringify(parameters);
        const changed =
            name !== initialRef.current.name ||
            type !== initialRef.current.type ||
            description !== initialRef.current.description ||
            code !== initialRef.current.code ||
            template !== initialRef.current.template ||
            styleId !== initialRef.current.styleId ||
            category !== initialRef.current.category ||
            currentParams !== initialRef.current.parameters;
        onDirtyChange?.(changed);
    }, [name, type, description, code, template, styleId, category, parameters]);

    useImperativeHandle(ref, () => ({
        handleSave,
        isSaving
    }));

    const handleSave = async () => {
        if (!name || !code || !template) {
            alert("Name, code, and template are required");
            return;
        }

        setIsSaving(true);
        const payload = {
            name,
            type,
            description,
            code,
            template,
            schema_json: schemaJson,
            style_id: styleId || null,
            category: category.trim() || null,
            parameters: parameters.map(({ id, ...rest }: any) => {
                if (typeof id === 'string' && id.startsWith('temp_')) return rest;
                return { id, ...rest };
            })
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
            alert("Failed to save report.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleCompile = async () => {
        if (!report?.id) {
            alert("Please save the report first to compile (or implementation can be updated to support unsaved code)");
            return;
        }
        setIsCompiling(true);
        try {
            // We might want to save code before compiling if we rely on backend reading from DB
            // Or send code in the body. The updated router expects report_id.
            // Let's assume we save first or update router to accept code.
            // For now, let's assume we save the code first.
            await apiClient.put(`/reports/${report.id}`, { code });
            
            const res = await apiClient.post(`/reports/${report.id}/compile`);
            setConsoleOutput(res.data.console || '');
            if (res.data.success) {
                setSchemaJson(res.data.schema);
                setActiveOutputTab('schema');
            } else {
                setActiveOutputTab('console');
            }
        } catch (error: any) {
            setConsoleOutput(error.response?.data?.detail || error.message);
            setActiveOutputTab('console');
        } finally {
            setIsCompiling(false);
        }
    };

    const handleGenerate = async () => {
        if (!report?.id) {
            alert("Save report first");
            return;
        }
        setIsGenerating(true);
        try {
            await apiClient.put(`/reports/${report.id}`, { code, template });
            const res = await apiClient.post(`/reports/${report.id}/generate`, { parameters: {} });
            setPreviewHtml(res.data.html);
            setConsoleOutput(res.data.console || '');
            if (res.data.console) {
                setActiveOutputTab('console');
            }
            // After generation, ideally we'd switch to preview tab, but that's controlled by parent
        } catch (error: any) {
            alert("Generation failed: " + (error.response?.data?.detail || error.message));
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="h-full flex flex-col">
            {activeTab === 'general' && (
                <div className="max-w-3xl mx-auto w-full space-y-6 pt-4">
                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-1.5">
                            <label className="text-sm font-bold text-[var(--text-main)]">Report Name *</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-xl bg-[var(--bg-app)] border border-[var(--border-base)] text-sm focus:border-brand transition-all"
                                placeholder="e.g. Monthly Sales"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-bold text-[var(--text-main)]">Category</label>
                            <input
                                type="text"
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-xl bg-[var(--bg-app)] border border-[var(--border-base)] text-sm focus:border-brand transition-all"
                                placeholder="e.g. Finance|Reports"
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-bold text-[var(--text-main)]">Description</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={3}
                            className="w-full px-4 py-2.5 rounded-xl bg-[var(--bg-app)] border border-[var(--border-base)] text-sm focus:border-brand transition-all resize-none"
                            placeholder="Describe what this report does..."
                        />
                    </div>
                    
                    <div className="space-y-1.5">
                        <label className="text-sm font-bold text-[var(--text-main)]">Report Type</label>
                        <select
                            value={type}
                            onChange={(e) => setType(e.target.value as ReportType)}
                            className="w-full px-4 py-2.5 rounded-xl bg-[var(--bg-app)] border border-[var(--border-base)] text-sm focus:border-brand transition-all"
                        >
                            <option value="global">Global</option>
                            <option value="client">Client-Specific</option>
                        </select>
                    </div>
                </div>
            )}

            {activeTab === 'code' && (
                <div className="flex-1 flex flex-col gap-4 overflow-hidden pt-4">
                    <div className="flex justify-between items-center px-1">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">Python Engine</h3>
                        <div className="flex gap-2">
                            <button
                                onClick={handleCompile}
                                disabled={isCompiling}
                                className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-[var(--bg-app)] border border-[var(--border-base)] text-xs font-bold hover:bg-[var(--bg-hover)] transition-all disabled:opacity-50"
                            >
                                <Icon name={isCompiling ? "refresh" : "code"} size={14} className={isCompiling ? "animate-spin" : ""} />
                                Compile
                            </button>
                            <button
                                onClick={handleGenerate}
                                disabled={isGenerating}
                                className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-brand text-white text-xs font-bold hover:brightness-110 transition-all disabled:opacity-50"
                            >
                                <Icon name={isGenerating ? "refresh" : "play"} size={14} className={isGenerating ? "animate-spin" : ""} />
                                Generate
                            </button>
                        </div>
                    </div>
                    
                    <div className="flex-1 min-h-0 rounded-xl border border-[var(--border-base)] overflow-hidden shadow-sm">
                        <CodeMirror
                            value={code}
                            height="100%"
                            theme={editorTheme}
                            extensions={pythonExtensions}
                            onChange={(value) => setCode(value)}
                            className="h-full text-sm font-mono"
                        />
                    </div>

                    <div className="h-48 flex flex-col border border-[var(--border-base)] rounded-xl overflow-hidden bg-[var(--bg-app)] shadow-inner">
                        <div className="flex bg-[var(--bg-header)] border-b border-[var(--border-base)] px-2">
                            <button
                                onClick={() => setActiveOutputTab('console')}
                                className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${activeOutputTab === 'console' ? 'text-brand border-b-2 border-brand' : 'text-[var(--text-muted)] opacity-60'}`}
                            >
                                Console
                            </button>
                            <button
                                onClick={() => setActiveOutputTab('schema')}
                                className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${activeOutputTab === 'schema' ? 'text-brand border-b-2 border-brand' : 'text-[var(--text-muted)] opacity-60'}`}
                            >
                                Data Schema
                            </button>
                        </div>
                        <div className="flex-1 overflow-auto p-4 font-mono text-xs whitespace-pre-wrap selection:bg-brand/20">
                            {activeOutputTab === 'console' ? (
                                consoleOutput || <span className="opacity-30 italic">No output yet. Click Compile to run.</span>
                            ) : (
                                JSON.stringify(schemaJson, null, 2) || <span className="opacity-30 italic">No schema generated.</span>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'template' && (
                <div className="flex-1 flex flex-col gap-4 overflow-hidden pt-4">
                    <div className="flex justify-between items-center px-1">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">Jinja2 HTML Template</h3>
                        <div className="w-64">
                            <select
                                value={styleId}
                                onChange={(e) => setStyleId(e.target.value)}
                                className="w-full px-3 py-1.5 rounded-lg bg-[var(--bg-app)] border border-[var(--border-base)] text-xs focus:border-brand transition-all"
                            >
                                <option value="">Default Style</option>
                                {styles.map(s => (
                                    <option key={s.id} value={s.id}>{s.name} {s.is_default ? '(Default)' : ''}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="flex-1 min-h-0 rounded-xl border border-[var(--border-base)] overflow-hidden shadow-sm">
                        <CodeMirror
                            value={template}
                            height="100%"
                            theme={editorTheme}
                            extensions={htmlExtensions}
                            onChange={(value) => setTemplate(value)}
                            className="h-full text-sm font-mono"
                        />
                    </div>
                </div>
            )}

            {activeTab === 'preview' && (
                <div className="flex-1 flex flex-col pt-4 overflow-hidden">
                    <div className="flex-1 rounded-xl border border-[var(--border-base)] bg-white overflow-auto shadow-inner">
                        {previewHtml ? (
                            <div className="p-8" dangerouslySetInnerHTML={{ __html: previewHtml }} />
                        ) : (
                            <div className="h-full flex items-center justify-center text-[var(--text-muted)] italic text-sm">
                                Click Generate in the Code tab to see preview.
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
});
