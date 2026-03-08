import { useState } from 'react';
import type { Report, ReportParameter, ReportStyle, ReportType } from '../../../entities/report/model/types';
import { Icon } from '../../../shared/ui/icon';
import { apiClient } from '../../../shared/api/client';
import { ConfirmModal } from '../../../shared/ui/confirm-modal/ConfirmModal';
import { ComboBox } from '../../../shared/ui/combo-box/ComboBox';
import type { SelectionGroup } from '../../../shared/ui/selection-list/SelectionList';

interface ReportEditorProps {
    report?: Report | null;
    styles: ReportStyle[];
    onBack: () => void;
}

export function ReportEditor({ report, styles, onBack }: ReportEditorProps) {
    const [activeTab, setActiveTab] = useState<'details' | 'builder'>('details');
    const [isSaving, setIsSaving] = useState(false);

    // Form State
    const [name, setName] = useState(report?.name || '');
    const [type, setType] = useState<ReportType>(report?.type || 'global');
    const [description, setDescription] = useState(report?.description || '');
    const [query, setQuery] = useState(report?.query || '');
    const [template, setTemplate] = useState(report?.template || '');
    const [styleId, setStyleId] = useState(report?.style_id || '');
    const [parameters, setParameters] = useState<ReportParameter[]>(report?.parameters || []);
    const meta = report?.meta || {};

    // Auto-generate Template State
    const [isAutoGenerateModalOpen, setIsAutoGenerateModalOpen] = useState(false);
    const [isGeneratingTemplate, setIsGeneratingTemplate] = useState(false);
    const [additionalInfo, setAdditionalInfo] = useState(report?.meta?.template_prompt || '');

    // Auto-generate SQL State
    const [isSqlAutoGenerateModalOpen, setIsSqlAutoGenerateModalOpen] = useState(false);
    const [isGeneratingSql, setIsGeneratingSql] = useState(false);
    const [sqlPrompt, setSqlPrompt] = useState('');
    const [selectedModel, setSelectedModel] = useState('gpt-4o');
    const [sqlGenMode, setSqlGenMode] = useState<'generate' | 'modify'>('generate');

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
            meta: {
                ...meta,
                template_prompt: additionalInfo
            },
            parameters: parameters.map(({ id, ...rest }) => rest) // strip local id
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

    const handleAutoGenerateTemplate = async () => {
        if (!query) {
            alert("Please enter a SQL query first.");
            setIsAutoGenerateModalOpen(false);
            return;
        }

        setIsGeneratingTemplate(true);
        setIsAutoGenerateModalOpen(false);

        try {
            const response = await apiClient.post('/reports/generate-template', {
                query,
                additional_info: additionalInfo
            });
            if (response.data && response.data.template) {
                setTemplate(response.data.template);
            }
        } catch (error) {
            console.error("Failed to generate template", error);
            alert("Error generating template. Check console for details.");
        } finally {
            setIsGeneratingTemplate(false);
        }
    };

    const handleAutoGenerateSql = async () => {
        if (!sqlPrompt) {
            alert("Please enter a prompt for the AI.");
            return;
        }

        setIsGeneratingSql(true);
        setIsSqlAutoGenerateModalOpen(false);

        try {
            const prompt = sqlGenMode === 'modify'
                ? `EXISTING QUERY: ${query}\n\nUSER MODIFICATION REQUEST: ${sqlPrompt}`
                : sqlPrompt;

            const response = await apiClient.post('/reports/generate-sql', {
                prompt,
                model: selectedModel
            });
            if (response.data && response.data.query) {
                setQuery(response.data.query);
            }
        } catch (error) {
            console.error("Failed to generate SQL", error);
            alert("Error generating SQL. Check console for details.");
        } finally {
            setIsGeneratingSql(false);
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

    const sqlMenuData: Record<string, SelectionGroup> = {
        items: {
            id: 'sql_menu',
            name: 'AI Actions',
            items: [
                { id: 'modify', name: 'Modify Query', icon: 'edit' },
                { id: 're-generate', name: 'RE-Generate', icon: 'refresh' },
            ],
            children: {},
            selectable: false
        }
    };

    return (
        <div className="flex flex-col h-full bg-[var(--bg-app)]">
            <div className="flex justify-end p-4 border-b border-[var(--border-base)] shrink-0 bg-[var(--bg-surface)]">
                <div className="flex items-center gap-4">
                    <div className="flex gap-1 bg-[var(--border-muted)] p-1 rounded-xl">
                        <button
                            onClick={() => setActiveTab('details')}
                            className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'details' ? 'bg-[var(--bg-app)] text-[var(--text-main)] shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}
                        >
                            Details
                        </button>
                        <button
                            onClick={() => setActiveTab('builder')}
                            className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'builder' ? 'bg-[var(--bg-app)] text-[var(--text-main)] shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}
                        >
                            Builder
                        </button>
                    </div>

                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex items-center gap-2 px-4 py-2 bg-brand text-white rounded-xl shadow-lg shadow-brand/20 hover:brightness-110 active:scale-95 transition-all font-bold text-sm disabled:opacity-50 disabled:pointer-events-none"
                    >
                        <Icon name="save" size={18} />
                        {isSaving ? 'Saving...' : 'Save Report'}
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
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
                                    {!query ? (
                                        <button
                                            onClick={() => {
                                                setSqlGenMode('generate');
                                                setIsSqlAutoGenerateModalOpen(true);
                                            }}
                                            disabled={isGeneratingSql}
                                            className="flex items-center gap-2 px-3 py-1.5 bg-brand text-white rounded-lg shadow-md shadow-brand/10 hover:brightness-110 active:scale-95 transition-all font-bold text-[10px] uppercase tracking-wider disabled:opacity-50 disabled:pointer-events-none"
                                        >
                                            <Icon name="bolt" size={12} />
                                            {isGeneratingSql ? 'Generating...' : 'AI Auto-generate'}
                                        </button>
                                    ) : (
                                        <ComboBox
                                            data={sqlMenuData}
                                            onSelect={(item) => {
                                                if (item.id === 'modify') {
                                                    setSqlGenMode('modify');
                                                } else {
                                                    setSqlGenMode('generate');
                                                }
                                                setIsSqlAutoGenerateModalOpen(true);
                                            }}
                                            label="AI"
                                            icon="bolt"
                                            variant="brand"
                                            className="!py-0"
                                        />
                                    )}
                                </div>
                            </div>
                            <textarea
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                rows={8}
                                className="w-full p-4 rounded-xl bg-[#1e1e1e] text-[#d4d4d4] font-mono text-sm border border-[var(--border-base)] focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-all"
                                placeholder="SELECT * FROM users WHERE active = true"
                                spellCheck={false}
                            />
                            <p className="text-xs text-[var(--text-muted)] mt-1">
                                Use <code className="bg-[var(--border-muted)] px-1 rounded text-brand">:ParamName</code> for mapped parameters.
                            </p>
                        </div>

                        {/* Template Editor */}
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-4">
                                    <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--text-muted)]">Jinja2 Template *</h3>
                                    <button
                                        onClick={() => setIsAutoGenerateModalOpen(true)}
                                        disabled={isGeneratingTemplate}
                                        className="flex items-center gap-2 px-3 py-1.5 bg-brand text-white rounded-lg shadow-md shadow-brand/10 hover:brightness-110 active:scale-95 transition-all font-bold text-[10px] uppercase tracking-wider disabled:opacity-50 disabled:pointer-events-none"
                                    >
                                        <Icon name="bolt" size={12} />
                                        {isGeneratingTemplate ? 'Generating...' : 'AI Auto-generate'}
                                    </button>
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
                            <textarea
                                value={template}
                                onChange={(e) => setTemplate(e.target.value)}
                                rows={12}
                                className="w-full p-4 rounded-xl bg-[#1e1e1e] text-[#d4d4d4] font-mono text-sm border border-[var(--border-base)] focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-all"
                                placeholder="<table>\n  {% for row in data %}\n    <tr><td>{{ row.id }}</td></tr>\n  {% endfor %}\n</table>"
                                spellCheck={false}
                            />
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

            <ConfirmModal
                isOpen={isAutoGenerateModalOpen}
                title="Auto-generate Template"
                description="Are you sure? If you continue, the current template will be replaced with one generated based on the SQL query."
                confirmLabel="Generate"
                cancelLabel="Cancel"
                variant="warning"
                onConfirm={handleAutoGenerateTemplate}
                onCancel={() => {
                    setIsAutoGenerateModalOpen(false);
                }}
            >
                <div className="mt-6 space-y-2">
                    <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                        Additional Information (Optional)
                    </label>
                    <textarea
                        value={additionalInfo}
                        onChange={(e) => setAdditionalInfo(e.target.value)}
                        placeholder="e.g. style requirements, custom headers, footers, etc. Leave empty for a strict minimal report."
                        className="w-full px-4 py-3 rounded-2xl bg-[var(--bg-app)] border border-[var(--border-base)] text-sm focus:outline-none focus:border-brand transition-all resize-none h-32"
                    />
                </div>
            </ConfirmModal>

            <ConfirmModal
                isOpen={isSqlAutoGenerateModalOpen}
                title={sqlGenMode === 'modify' ? "Modify SQL Query" : "Auto-generate SQL Query"}
                description={sqlGenMode === 'modify'
                    ? "Describe how you want to modify the existing query. The AI will update it based on your instructions."
                    : "Describe what data you want to fetch. The AI will generate a SQL query based on your description and schema hints."
                }
                confirmLabel={sqlGenMode === 'modify' ? "Modify" : "Generate"}
                cancelLabel="Cancel"
                variant="warning"
                onConfirm={handleAutoGenerateSql}
                onCancel={() => {
                    setIsSqlAutoGenerateModalOpen(false);
                }}
            >
                <div className="mt-6 space-y-4">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                            {sqlGenMode === 'modify' ? "Modification Prompt" : "AI Prompt"} (e.g. "get session data with hierarchy")
                        </label>
                        <textarea
                            value={sqlPrompt}
                            onChange={(e) => setSqlPrompt(e.target.value)}
                            placeholder={sqlGenMode === 'modify' ? "e.g. 'remove column X', 'add filter by Y'..." : "Describe your requirements..."}
                            className="w-full px-4 py-3 rounded-2xl bg-[var(--bg-app)] border border-[var(--border-base)] text-sm focus:outline-none focus:border-brand transition-all resize-none h-32"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                            AI Model
                        </label>
                        <ComboBox
                            value={selectedModel}
                            label={selectedModel}
                            placeholder="Select AI Model..."
                            data={modelData}
                            onSelect={(item) => setSelectedModel(item.id)}
                            className="w-full"
                            icon="smart_toy"
                        />
                    </div>
                </div>
            </ConfirmModal>
        </div>
    );
}
