import { useState, useEffect } from 'react';
import type { Report } from '../../../entities/report/model/types';
import { Icon } from '../../../shared/ui/icon';
import { ComboBox } from '../../../shared/ui/combo-box/ComboBox';
import { apiClient } from '../../../shared/api/client';

interface ReportViewerProps {
    report: Report;
    onBack: () => void;
}

export function ReportViewer({ report, onBack }: ReportViewerProps) {
    const [htmlData, setHtmlData] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [paramValues, setParamValues] = useState<Record<string, any>>({});
    // Store selected item locally for ComboBox to render label correctly
    const [selectedItems, setSelectedItems] = useState<Record<string, { value: string, label: string }>>({});
    const [options, setOptions] = useState<Record<string, { value: string, label: string }[]>>({});

    useEffect(() => {
        // Fetch options for parameters with @table sources
        const fetchOptions = async () => {
            try {
                const res = await apiClient.get(`/reports/${report.id}/options`);
                setOptions(res.data);
            } catch (err) {
                console.error("Failed to load generic parameter options", err);
            }
        };

        if (report.parameters && report.parameters.length > 0) {
            fetchOptions();

            // initialize param string values
            const initialParams: Record<string, any> = {};
            report.parameters.forEach(p => {
                initialParams[p.parameter_name] = '';
            });
            setParamValues(initialParams);
        }
    }, [report.id, report.parameters]);

    const handleParamChange = (name: string, value: string) => {
        setParamValues(prev => ({ ...prev, [name]: value }));
    };

    const handleGenerate = async () => {
        setIsLoading(true);
        setHtmlData(null);
        try {
            const res = await apiClient.post(`/reports/${report.id}/generate`, {
                parameters: paramValues
            });
            setHtmlData(res.data.html);
        } catch (err: any) {
            console.error("Failed to generate report", err);
            alert("Error generating report: " + (err.response?.data?.detail || err.message));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-[var(--bg-app)] overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-base)] shrink-0 bg-[var(--bg-surface)]">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onBack}
                        className="p-2 -ml-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--border-muted)] transition-colors"
                    >
                        <Icon name="chevron_left" size={24} />
                    </button>
                    <div>
                        <h2 className="text-lg font-bold leading-tight">{report.name}</h2>
                        <p className="text-xs text-[var(--text-muted)]">{report.description}</p>
                    </div>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Parameters Sidebar */}
                <div className="w-80 border-r border-[var(--border-base)] bg-[var(--bg-app)] flex flex-col z-10">
                    <div className="p-4 border-b border-[var(--border-base)]">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--text-muted)]">Configuration</h3>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-5">
                        {(!report.parameters || report.parameters.length === 0) ? (
                            <p className="text-sm text-[var(--text-muted)] italic">No parameters required</p>
                        ) : (
                            report.parameters.map(param => (
                                <div key={param.parameter_name} className="space-y-1.5">
                                    <label className="text-sm font-bold text-[var(--text-main)] capitalize">
                                        {param.parameter_name.replace(/_/g, ' ')}
                                    </label>

                                    {options[param.parameter_name] && options[param.parameter_name].length > 0 ? (
                                        <ComboBox
                                            value={paramValues[param.parameter_name]}
                                            label={selectedItems[param.parameter_name]?.label || 'Select...'}
                                            placeholder={param.parameter_name}
                                            data={{
                                                items: {
                                                    id: 'items',
                                                    name: 'Available Options',
                                                    items: options[param.parameter_name].map(opt => ({
                                                        id: opt.value,
                                                        name: opt.label
                                                    })),
                                                    children: {}
                                                }
                                            }}
                                            onSelect={(item) => {
                                                handleParamChange(param.parameter_name, item.id);
                                                setSelectedItems(prev => ({ ...prev, [param.parameter_name]: { value: item.id, label: item.name } }));
                                            }}
                                            variant="primary"
                                            className="w-full bg-[var(--bg-app)] border border-[var(--border-base)] rounded-xl"
                                        />
                                    ) : (
                                        <input
                                            type="text"
                                            value={paramValues[param.parameter_name] || ''}
                                            onChange={(e) => handleParamChange(param.parameter_name, e.target.value)}
                                            className="w-full px-3 py-2 rounded-lg bg-[var(--bg-app)] border border-[var(--border-base)] text-sm focus:outline-none focus:border-brand"
                                            placeholder={`Enter ${param.parameter_name}...`}
                                        />
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                    <div className="p-4 border-t border-[var(--border-base)] bg-[var(--bg-surface)]">
                        <button
                            onClick={handleGenerate}
                            disabled={isLoading}
                            className="w-full py-3 rounded-xl bg-brand text-white font-bold transition-all hover:brightness-110 active:scale-95 shadow-lg shadow-brand/20 disabled:opacity-50 disabled:pointer-events-none"
                        >
                            {isLoading ? 'Generating...' : 'Generate Report'}
                        </button>
                    </div>
                </div>

                {/* Report Output Area */}
                <div className="flex-1 bg-white relative overflow-auto p-8 rounded-tl-xl border-l border-t border-[var(--border-base)] mt-[-1px] ml-[-1px] shadow-sm">
                    {isLoading ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-brand bg-white/50 backdrop-blur-sm z-20">
                            <div className="w-8 h-8 rounded-full border-t-2 border-brand animate-spin mb-4" />
                            <p className="font-bold text-sm">Processing Data...</p>
                        </div>
                    ) : htmlData ? (
                        <div
                            className="report-output-wrap text-black w-full"
                            dangerouslySetInnerHTML={{ __html: htmlData }}
                        />
                    ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 bg-gray-50/50">
                            <Icon name="bar_chart" size={48} className="opacity-20 mb-4" />
                            <p className="text-sm font-medium">Configure parameters and generate the report</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
