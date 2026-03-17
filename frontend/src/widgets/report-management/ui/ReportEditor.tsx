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
import { autocompletion, snippetCompletion } from "@codemirror/autocomplete";
import { getPythonHints, type PythonHint } from "../../../shared/api/python-hints";

interface ReportEditorProps {
    report?: Report | null;
    styles: ReportStyle[];
    onBack: () => void;
    activeTab: 'general' | 'code' | 'template' | 'preview';
    onTabChange?: (tab: 'general' | 'code' | 'template' | 'preview') => void;
    onDirtyChange?: (dirty: boolean) => void;
}

export interface ReportEditorRef {
    handleSave: () => Promise<void>;
    handleCompile: () => Promise<void>;
    handleGenerate: () => Promise<void>;
    isSaving: boolean;
    isCompiling: boolean;
    isGenerating: boolean;
}

export const ReportEditor = forwardRef<ReportEditorRef, ReportEditorProps>(({ report, styles, onBack, activeTab, onTabChange, onDirtyChange }, ref) => {
    const { theme } = useThemeStore();
    const [isSaving, setIsSaving] = useState(false);
    const [isCompiling, setIsCompiling] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);

    const [dynamicHints, setDynamicHints] = useState<PythonHint[]>([]);

    useEffect(() => {
        const fetchHints = async () => {
            const hints = await getPythonHints();
            setDynamicHints(hints);
        };
        fetchHints();
    }, []);

    const editorTheme = useMemo(() => (theme === "dark" ? vscodeDark : vscodeLight), [theme]);
    
    const pythonExtensions = useMemo(() => [
        python(),
        indentUnit.of('    '),
        EditorState.tabSize.of(4),
        autocompletion({
            override: [
                (context) => {
                    const word = context.matchBefore(/[\w\.]*/);
                    if (!word || (word.from === word.to && !context.explicit)) return null;
                    
                    const isMethod = word.text.includes('.');
                    let currentHints = dynamicHints;

                    if (isMethod) {
                        const parts = word.text.split('.');
                        const prefix = parts.slice(0, -1).join('.');
                        currentHints = dynamicHints.filter(h => h.label.startsWith(prefix + '.'));
                        
                        return {
                            from: word.from + prefix.length + 1,
                            options: currentHints.map(h => ({
                                label: h.label.split('.').pop() || h.label,
                                type: h.type,
                                detail: h.detail,
                                boost: h.boost
                            }))
                        };
                    }

                    return {
                        from: word.from,
                        options: [
                            ...dynamicHints.filter(h => !h.label.includes('.')).map(h => {
                                if (h.snippet) {
                                    return snippetCompletion(h.snippet, {
                                        label: h.label,
                                        detail: h.detail,
                                        type: h.type,
                                        boost: h.boost
                                    });
                                }
                                return {
                                    label: h.label,
                                    type: h.type,
                                    detail: h.detail,
                                    boost: h.boost
                                };
                            }),
                            { label: 'report_parameters', type: 'variable', detail: 'Report parameters (subscriptable)' },
                            { label: 'ReportParameters', type: 'variable', detail: 'Report parameters (alias)' },
                            { label: 'UserExecutor', type: 'variable', detail: 'Current user context (id, username, role)' },
                            { label: 'ReportExecutor', type: 'variable', detail: 'Report execution context (id)' },
                            { label: 'rows', type: 'variable', detail: 'Report data rows' },
                            { label: 'mode', type: 'variable', detail: 'Execution mode' },
                        ]
                    };
                }
            ]
        })
    ], [dynamicHints]);
    const htmlExtensions = useMemo(() => [
        html(),
        indentUnit.of('    '),
        EditorState.tabSize.of(4),
    ], []);

    // Form State
    const [name, setName] = useState(report?.name || '');
    const [type, setType] = useState<ReportType>(report?.type || 'global');
    const [description, setDescription] = useState(report?.description || '');
    const [code, setCode] = useState(report?.code || 'def ParametersProcessing(report_parameters, mode):\n    #ReportExecutor.id\n\n    return report_parameters, True, ""\n\ndef GenerateReport(report_parameters):\n\n    #>>you code here<<\n\n    #result here\n    report_result = {\n    }\n    return report_result, True');
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
        handleCompile,
        handleGenerate,
        isSaving,
        isCompiling,
        isGenerating
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
            } else {
                if (res.data.validation_reason) {
                    setConsoleOutput(prev => `[VALIDATION FAILED] ${res.data.validation_reason}\n\n${prev}`);
                }
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
            if (res.data.validation_error) {
                setPreviewHtml(`<div style="padding: 2rem; background: #fff5f5; border: 1px solid #feb2b2; color: #c53030; border-radius: 1rem; font-family: sans-serif;">
                    <h3 style="margin-top: 0;">Validation Error</h3>
                    <p>${res.data.validation_error}</p>
                </div>`);
                onTabChange?.('preview');
            } else {
                setPreviewHtml(res.data.html);
            }
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

                    {/* Parameter Management */}
                    <div className="pt-6 border-t border-[var(--border-base)]">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">Parameters</h3>
                            <button
                                onClick={() => {
                                    const newParam: any = {
                                        id: `temp_${Date.now()}`,
                                        parameter_name: '',
                                        parameter_type: 'text',
                                        default_value: '',
                                        source: '',
                                        value_field: '',
                                        label_field: ''
                                    };
                                    setParameters([...parameters, newParam]);
                                }}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--bg-app)] border border-[var(--border-base)] text-xs font-bold hover:bg-[var(--bg-hover)] transition-all"
                            >
                                <Icon name="plus" size={14} />
                                Add Parameter
                            </button>
                        </div>

                        <div className="space-y-4">
                            {parameters.map((param, index) => (
                                <div key={param.id} className="p-4 rounded-xl border border-[var(--border-base)] bg-[var(--bg-app)] space-y-4 relative group">
                                    <button
                                        onClick={() => {
                                            const newParams = [...parameters];
                                            newParams.splice(index, 1);
                                            setParameters(newParams);
                                        }}
                                        className="absolute top-4 right-4 text-[var(--text-muted)] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                    >
                                        <Icon name="delete" size={16} />
                                    </button>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Parameter Name</label>
                                            <input
                                                type="text"
                                                value={param.parameter_name}
                                                onChange={(e) => {
                                                    const newParams = [...parameters];
                                                    newParams[index].parameter_name = e.target.value;
                                                    setParameters(newParams);
                                                }}
                                                className="w-full px-3 py-2 rounded-lg bg-[var(--bg-app)] border border-[var(--border-base)] text-xs focus:border-brand"
                                                placeholder="e.g. user_id"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Type</label>
                                            <select
                                                value={param.parameter_type}
                                                onChange={(e) => {
                                                    const newParams = [...parameters];
                                                    newParams[index].parameter_type = e.target.value as any;
                                                    setParameters(newParams);
                                                }}
                                                className="w-full px-3 py-2 rounded-lg bg-[var(--bg-app)] border border-[var(--border-base)] text-xs focus:border-brand"
                                            >
                                                <option value="text">Text</option>
                                                <option value="number">Number</option>
                                                <option value="date">Date</option>
                                                <option value="date_range">Date Range</option>
                                                <option value="select">Select (Dropdown)</option>
                                            </select>
                                        </div>
                                    </div>

                                    {param.parameter_type === 'select' && (
                                        <div className="grid grid-cols-3 gap-4">
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Source (@table or SQL)</label>
                                                <input
                                                    type="text"
                                                    value={param.source}
                                                    onChange={(e) => {
                                                        const newParams = [...parameters];
                                                        newParams[index].source = e.target.value;
                                                        setParameters(newParams);
                                                    }}
                                                    className="w-full px-3 py-2 rounded-lg bg-[var(--bg-app)] border border-[var(--border-base)] text-xs focus:border-brand"
                                                    placeholder="@users->id,name"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Value Field</label>
                                                <input
                                                    type="text"
                                                    value={param.value_field}
                                                    onChange={(e) => {
                                                        const newParams = [...parameters];
                                                        newParams[index].value_field = e.target.value;
                                                        setParameters(newParams);
                                                    }}
                                                    className="w-full px-3 py-2 rounded-lg bg-[var(--bg-app)] border border-[var(--border-base)] text-xs focus:border-brand"
                                                    placeholder="id"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Label Field</label>
                                                <input
                                                    type="text"
                                                    value={param.label_field}
                                                    onChange={(e) => {
                                                        const newParams = [...parameters];
                                                        newParams[index].label_field = e.target.value;
                                                        setParameters(newParams);
                                                    }}
                                                    className="w-full px-3 py-2 rounded-lg bg-[var(--bg-app)] border border-[var(--border-base)] text-xs focus:border-brand"
                                                    placeholder="name"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Default Value</label>
                                        <input
                                            type="text"
                                            value={param.default_value}
                                            onChange={(e) => {
                                                const newParams = [...parameters];
                                                newParams[index].default_value = e.target.value;
                                                setParameters(newParams);
                                            }}
                                            className="w-full px-3 py-2 rounded-lg bg-[var(--bg-app)] border border-[var(--border-base)] text-xs focus:border-brand"
                                            placeholder="Optional default value..."
                                        />
                                    </div>
                                </div>
                            ))}

                            {parameters.length === 0 && (
                                <div className="py-12 flex flex-col items-center justify-center border-2 border-dashed border-[var(--border-base)] rounded-2xl opacity-40">
                                    <Icon name="settings" size={32} className="mb-2 text-[var(--text-muted)]" />
                                    <p className="text-xs font-medium">No parameters defined for this report.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'code' && (
                <div className="flex-1 flex flex-col gap-4 overflow-hidden pt-4">
                    <div className="flex justify-between items-center px-1">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">Python Engine</h3>
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
                    <div className="flex-1 rounded-xl border border-[var(--border-base)] bg-white overflow-hidden shadow-inner relative">
                        {previewHtml ? (
                            <iframe
                                title="Report Preview"
                                srcDoc={previewHtml}
                                className="w-full h-full border-none"
                            />
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
