import { useState, forwardRef, useImperativeHandle, useMemo, useRef, useEffect } from "react";
import type { Report, ObjectParameter as ReportParameter, ReportStyle, ReportType } from "../../../entities/report/model/types";
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
import { AppInput, AppFormFieldRect } from "../../../shared/ui/app-input";
import { UI_CONSTANTS } from "../../../shared/ui/constants";
import { AppCategoryInput } from "../../../shared/ui/app-category-input/AppCategoryInput";
import { getUniqueCategoryPaths } from "../../../shared/lib/categoryUtils";
import { AppConsole, AppConsoleLogLine } from "../../../shared/ui/app-console";
import { QueryBuilderModal } from "../../../features/query-builder/ui/QueryBuilderModal";
import { SYSTEM_PARAMETERS } from "../../../entities/report/model/constants";
import { AppParameterListEditor } from "../../../shared/ui/app-parameter-list-editor";
import { ParameterPresetSelector, SaveParameterPresetButton } from "../../../features/parameter-presets";


interface ReportEditorProps {
    report?: Report | null;
    reports?: Report[];
    styles: ReportStyle[];
    activeTab: 'general' | 'code' | 'template' | 'preview';
    onTabChange?: (tab: 'general' | 'code' | 'template' | 'preview') => void;
    onDirtyChange?: (dirty: boolean) => void;
    isLocked?: boolean;
}

export interface ReportEditorRef {
    handleSave: (params?: { project_id?: string | null }) => Promise<Report | void>;
    handleCompile: () => Promise<void>;
    handleGenerate: () => Promise<void>;
    handleOpenQueryBuilder: () => void;
    isSaving: boolean;
    isCompiling: boolean;
    isGenerating: boolean;
}

export const ReportEditor = forwardRef<ReportEditorRef, ReportEditorProps>(({ report, reports = [], styles, activeTab, onTabChange, onDirtyChange, isLocked }, ref) => {
    const { theme } = useThemeStore();
    const [isSaving, setIsSaving] = useState(false);
    const [isCompiling, setIsCompiling] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);

    const allCategoryPaths = useMemo(() => getUniqueCategoryPaths(reports), [reports]);

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
                            { label: 'system_project_id', type: 'variable', detail: 'Current project ID (System Parameter)' },
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

    const [isQueryBuilderOpen, setIsQueryBuilderOpen] = useState(false);
    const [initialSql, setInitialSql] = useState<string | undefined>(undefined);
    const [queryRange, setQueryRange] = useState({ from: 0, to: 0 });
    const [editorRef, setEditorRef] = useState<any>(null);

    const handleOpenQueryBuilder = () => {
        if (!editorRef) return;
        const view = editorRef;
        const pos = view.state.selection.main.head;
        const doc = view.state.doc.toString();
        
        // Search for triple quotes first, then regular quotes
        const tripleQuoteRegex = /([\w\d_]+\s*=\s*)?("""[\s\S]*?"""|'''[\s\S]*?''')/g;
        const singleQuoteRegex = /([\w\d_]+\s*=\s*)?("[^"\\]*(?:\\.[^"\\]*)*"|'[^'\\]*(?:\\.[^'\\]*)*')/g;
        
        let match;
        let foundMatch = null;

        while ((match = tripleQuoteRegex.exec(doc)) !== null) {
            const start = match.index;
            const end = start + match[0].length;
            if (pos >= start && pos <= end) {
                foundMatch = match;
                break;
            }
        }

        if (!foundMatch) {
            singleQuoteRegex.lastIndex = 0;
            while ((match = singleQuoteRegex.exec(doc)) !== null) {
                const start = match.index;
                const end = start + match[0].length;
                if (pos >= start && pos <= end) {
                    foundMatch = match;
                    break;
                }
            }
        }

        if (foundMatch) {
            const assignmentPart = foundMatch[1] || "";
            const stringPart = foundMatch[2];
            
            let content = "";
            let quoteLength = 0;
            if (stringPart.startsWith('"""') || stringPart.startsWith("'''")) {
                content = stringPart.slice(3, -3);
                quoteLength = 3;
            } else {
                content = stringPart.slice(1, -1);
                quoteLength = 1;
            }

            const stringStartPos = foundMatch.index + assignmentPart.length;
            
            setQueryRange({
                from: stringStartPos + quoteLength,
                to: stringStartPos + stringPart.length - quoteLength
            });
            
            const trimmedContent = content.trim();
            setInitialSql(trimmedContent);
            setIsQueryBuilderOpen(true);
        } else {
            handleQueryBuilderError("select query: Please place cursor inside a SQL query string.");
        }
    };

    const handleQueryBuilderError = (error: string) => {
        const errorMsg = `[SQL PARSE ERROR] ${error}`;
        setConsoleOutput(errorMsg); // Clear and show only the fresh error
        setActiveOutputTab('console');
        console.error(errorMsg);
    };

    const combinedPythonExtensions = useMemo(() => [
        ...pythonExtensions,
    ], [pythonExtensions]);
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
    const [paramOptions, setParamOptions] = useState<Record<string, { value: string, label: string }[]>>({});

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

    const fetchParamOptions = async () => {
        if (report?.id) {
            try {
                const res = await apiClient.get(`/reports/${report.id}/options`);
                setParamOptions(res.data);
            } catch (err) {
                console.error("Failed to load parameter options", err);
            }
        }
    };

    // Fetch options on mount/report change
    useEffect(() => {
        fetchParamOptions();
    }, [report?.id]);

    const lastFetchedSourcesRef = useRef<Record<string, string>>({});

    // Dynamically fetch options for parameters that have a source but no options yet (e.g. newly added/modified)
    useEffect(() => {
        const timer = setTimeout(() => {
            const fetchNewOptions = async () => {
                for (const param of parameters) {
                    if (param.parameter_type === 'select' && param.source) {
                        const lastSource = lastFetchedSourcesRef.current[param.parameter_name];
                        if (param.source !== lastSource) {
                            try {
                                console.log(`Testing source for [${param.parameter_name}]: ${param.source}`);
                                const res = await apiClient.post('/reports/test-source', {
                                    source: param.source,
                                    value_field: param.value_field,
                                    label_field: param.label_field
                                });
                                
                                console.log(`Result for [${param.parameter_name}]:`, res.data);
                                lastFetchedSourcesRef.current[param.parameter_name] = param.source;

                                if (res.data.error) {
                                    setParamOptions(prev => ({ 
                                        ...prev, 
                                        [param.parameter_name]: [{ value: 'error', label: res.data.error }] 
                                    }));
                                } else {
                                    setParamOptions(prev => ({ 
                                        ...prev, 
                                        [param.parameter_name]: res.data.options || [] 
                                    }));
                                }
                            } catch (err) {
                                console.error(`Failed to test source for [${param.parameter_name}]:`, err);
                                setParamOptions(prev => ({ 
                                    ...prev, 
                                    [param.parameter_name]: [{ value: 'error', label: 'Error source' }] 
                                }));
                            }
                        }
                    }
                }
            };
            fetchNewOptions();
        }, 600); // 600ms debounce

        return () => clearTimeout(timer);
    }, [parameters]);

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
        handleOpenQueryBuilder,
        isSaving,
        isCompiling,
        isGenerating
    }));

    const handleSave = async (params?: { project_id?: string | null }) => {
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
            }),
            project_id: params?.project_id || report?.project_id
        };

        try {
            let savedReport: Report;
            if (report?.id) {
                const { data } = await apiClient.put(`/reports/${report.id}`, payload);
                savedReport = data;
            } else {
                const { data } = await apiClient.post('/reports', payload);
                savedReport = data;
            }
            
            // Update initial baseline to reset dirty state
            initialRef.current = {
                name: savedReport.name || '',
                type: savedReport.type || 'global',
                description: savedReport.description || '',
                code: savedReport.code || '',
                template: savedReport.template || '',
                styleId: savedReport.style_id || '',
                category: savedReport.category || '',
                parameters: JSON.stringify(savedReport.parameters || []),
            };
            onDirtyChange?.(false);
            
            // Re-fetch options to populate dropdowns for new parameters or updated sources
            fetchParamOptions();

            // Return saved report so parent can update its state
            return savedReport;
        } catch (error) {
            console.error("Failed to save report", error);
            alert("Failed to save report.");
            throw error;
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
        setConsoleOutput(''); // Clear console before starting
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
        setConsoleOutput(''); // Clear console before starting
        try {
            await apiClient.put(`/reports/${report.id}`, { code, template });
            
            // Collect parameters from test values state
            const paramValues: Record<string, any> = {};
            parameters.forEach(p => {
                paramValues[p.parameter_name] = p.default_value ?? '';
            });

            const res = await apiClient.post(`/reports/${report.id}/generate`, { parameters: paramValues });
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
                <div className="max-w-5xl mx-auto w-full space-y-6 pt-2">
                    <div className="grid grid-cols-2 gap-6">
                        <AppInput
                            label="Report Name"
                            required
                            value={name}
                            onChange={setName}
                            placeholder="e.g. Monthly Sales"
                            disabled={isLocked}
                        />
                        <AppCategoryInput
                            label="Category"
                            value={category}
                            onChange={setCategory}
                            placeholder="e.g. Finance|Reports"
                            allPaths={allCategoryPaths}
                            disabled={isLocked}
                        />
                    </div>

                    <AppInput
                        label="Description"
                        multiline
                        rows={3}
                        value={description}
                        onChange={setDescription}
                        placeholder="Describe what this report does..."
                        disabled={isLocked}
                    />
                    
                    <div className="space-y-1.5">
                        <label className="text-sm font-normal text-[var(--text-main)]">Report Type</label>
                        <AppFormFieldRect disabled={isLocked} className={UI_CONSTANTS.FORM_CONTROL_HEIGHT}>
                            <select
                                value={type}
                                onChange={(e) => setType(e.target.value as ReportType)}
                                className="w-full bg-transparent outline-none disabled:opacity-50 h-full font-normal cursor-pointer"
                                disabled={isLocked}
                            >
                                <option value="global">Global</option>
                                <option value="client">Client-Specific</option>
                            </select>
                        </AppFormFieldRect>
                    </div>


                    {/* Parameter Management */}
                    <div className="pt-6 border-t border-[var(--border-base)]">
                        <AppParameterListEditor
                             parameters={parameters}
                             onChange={setParameters}
                             options={paramOptions}
                             isLocked={isLocked}
                             renderHeaderActions={() => (
                                 <ParameterPresetSelector 
                                     onLoad={(param) => setParameters([...parameters, param])} 
                                 />
                             )}
                             renderParameterActions={(param) => (
                                 param.parameter_type === 'select' && (
                                     <SaveParameterPresetButton parameter={param} />
                                 )
                             )}
                        />
                    </div>
                </div>
            )}

            {activeTab === 'code' && (
                <div className="flex-1 flex flex-col gap-4 overflow-hidden pt-2">
                    <div className="flex justify-between items-center px-1">
                        <h3 className="text-xs font-normal uppercase tracking-widest text-[var(--text-muted)]">Python Engine</h3>
                    </div>
                    
                    <div className="flex-1 min-h-0 rounded-xl border border-[var(--border-base)] overflow-hidden shadow-sm focus-within:border-brand transition-all">
                        <CodeMirror
                            value={code}
                            height="100%"
                            theme={editorTheme}
                            extensions={combinedPythonExtensions}
                            onChange={(value) => setCode(value)}
                            onCreateEditor={(view) => {
                                setEditorRef(view);
                            }}
                            className="h-full text-sm font-mono"
                            readOnly={isLocked}
                        />
                    </div>

                    <QueryBuilderModal
                        isOpen={isQueryBuilderOpen}
                        initialSql={initialSql}
                        onClose={() => setIsQueryBuilderOpen(false)}
                        onError={handleQueryBuilderError}
                        onDone={(newSql) => {
                            if (editorRef && queryRange) {
                                // Indent the new SQL if it's multi-line and we're inside triple quotes
                                const formattedSql = (initialSql?.includes('\n') || newSql.includes('\n')) 
                                    ? `\n      ${newSql.trim().replace(/\n/g, '\n      ')}\n    `
                                    : newSql;

                                editorRef.dispatch({
                                    changes: {
                                        from: queryRange.from,
                                        to: queryRange.to,
                                        insert: formattedSql
                                    },
                                    selection: { anchor: queryRange.from + formattedSql.length }
                                });
                            }
                            setIsQueryBuilderOpen(false);
                        }}
                        parameters={[...parameters, ...SYSTEM_PARAMETERS]}
                    />

                    <AppConsole
                        tabs={[
                            { id: 'console', label: 'Console' },
                            { id: 'schema', label: 'Data Schema' }
                        ]}
                        activeTab={activeOutputTab}
                        onTabChange={(id) => setActiveOutputTab(id as any)}
                        className="h-48"
                    >
                        <div className="p-4 font-mono text-xs whitespace-pre-wrap selection:bg-brand/20 h-full">
                            {activeOutputTab === 'console' ? (
                                consoleOutput ? (
                                    consoleOutput.split('\n').map((line, i) => (
                                        <AppConsoleLogLine
                                            key={i}
                                            log={{
                                                timestamp: new Date().toISOString(),
                                                message: line,
                                                level: (line.startsWith('[VALIDATION FAILED]') || line.startsWith('[SQL PARSE ERROR]')) ? 'error' : 'info'
                                            }}
                                        />
                                    ))
                                ) : (
                                    <span className="opacity-30 italic">No output yet. Click Compile to run.</span>
                                )
                            ) : (
                                JSON.stringify(schemaJson, null, 2) || <span className="opacity-30 italic">No schema generated.</span>
                            )}
                        </div>
                    </AppConsole>
                </div>
            )}

            {activeTab === 'template' && (
                <div className="flex-1 flex flex-col gap-4 overflow-hidden pt-2">
                    <div className="flex justify-between items-center px-1">
                        <h3 className="text-xs font-normal uppercase tracking-widest text-[var(--text-muted)]">Jinja2 HTML Template</h3>
                        <div className="w-64">
                            <AppFormFieldRect className={UI_CONSTANTS.FORM_CONTROL_HEIGHT}>
                                <select
                                    value={styleId}
                                    onChange={(e) => setStyleId(e.target.value)}
                                    className="w-full bg-transparent outline-none disabled:opacity-50 h-full font-normal cursor-pointer"
                                >
                                    <option value="">Default Style</option>
                                    {styles.map(s => (
                                        <option key={s.id} value={s.id}>{s.name} {s.is_default ? '(Default)' : ''}</option>
                                    ))}
                                </select>
                            </AppFormFieldRect>
                        </div>
                    </div>
                    <div className="flex-1 min-h-0 rounded-xl border border-[var(--border-base)] overflow-hidden shadow-sm focus-within:border-brand transition-all">
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
                <div className="flex-1 flex flex-col pt-2 overflow-hidden gap-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">Live Preview</h3>
                        <button
                            onClick={handleGenerate}
                            disabled={isGenerating}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-brand text-white text-[10px] font-bold hover:brightness-110 transition-all disabled:opacity-50 shadow-sm"
                        >
                            <Icon name={isGenerating ? "refresh" : "play"} size={12} className={isGenerating ? "animate-spin" : ""} />
                            {isGenerating ? "Generating..." : "Generate Preview"}
                        </button>
                    </div>

                    <div className="flex-1 rounded-xl border border-[var(--border-base)] bg-white overflow-hidden shadow-inner relative">
                        {previewHtml ? (
                            <iframe
                                title="Report Preview"
                                srcDoc={previewHtml}
                                className="w-full h-full border-none"
                            />
                        ) : (
                            <div className="h-full flex items-center justify-center text-[var(--text-muted)] italic text-sm">
                                {isGenerating ? (
                                    <div className="flex flex-col items-center gap-2">
                                        <Icon name="refresh" size={24} className="animate-spin text-brand" />
                                        <span>Generating preview...</span>
                                    </div>
                                ) : "No preview yet. Click Generate to see results."}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
});
