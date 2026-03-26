import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import type { Report } from '../../../entities/report/model/types';
import { Icon } from '../../../shared/ui/icon';
import { ConfirmModal } from '../../../shared/ui/confirm-modal/ConfirmModal';
import { apiClient } from '../../../shared/api/client';
import { AppParametersView } from '../../../shared/ui/app-parameters-view/AppParametersView';
import { AppParameterSelectByTamplate } from '../../../shared/ui/app-parameter-select-by-tamplate';

interface ReportViewerProps {
    report?: Report; // Single report
    reports?: Report[]; // For grouped view
    onLoadingChange?: (loading: boolean) => void;
    onGenerated?: (isGenerated: boolean, params: Record<string, any>) => void;
}

export interface ReportViewerRef {
    handleGenerate: () => void;
    expandAll: () => void;
    collapseAll: () => void;
}

export const ReportViewer = forwardRef<ReportViewerRef, ReportViewerProps>(({ report, reports, onLoadingChange, onGenerated }, ref) => {
    const [htmlData, setHtmlData] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    useEffect(() => {
        onLoadingChange?.(isLoading);
    }, [isLoading, onLoadingChange]);
    const [paramValues, setParamValues] = useState<Record<string, any>>({});
    const [parameters, setParameters] = useState<any[]>([]);
    const [options, setOptions] = useState<Record<string, { value: string, label: string }[]>>({});
    const [isValidationModalOpen, setIsValidationModalOpen] = useState(false);
    const [isParamsExpanded, setIsParamsExpanded] = useState(true);
    const [validationReason, setValidationReason] = useState<string | null>(null);

    useImperativeHandle(ref, () => ({
        handleGenerate,
        expandAll: () => {
            const iframe = document.querySelector('iframe[title="Report Preview"]') as HTMLIFrameElement;
            if (iframe?.contentWindow) {
                iframe.contentWindow.postMessage('expandAll', '*');
            }
        },
        collapseAll: () => {
            const iframe = document.querySelector('iframe[title="Report Preview"]') as HTMLIFrameElement;
            if (iframe?.contentWindow) {
                iframe.contentWindow.postMessage('collapseAll', '*');
            }
        }
    }));

    useEffect(() => {
        const fetchOptions = async (reportId: string) => {
            try {
                const res = await apiClient.get(`/reports/${reportId}/options`);
                setOptions(prev => ({ ...prev, ...res.data }));
            } catch (err) {
                console.error("Failed to load options", err);
            }
        };

        const initialize = async () => {
            let params: any[] = [];
            if (reports && reports.length > 0) {
                try {
                    const res = await apiClient.post('/reports/grouped/parameters', {
                        report_ids: reports.map(r => r.id)
                    });
                    params = res.data;
                    setParameters(params);
                    // For options, we might need to fetch from all reports or just first one? 
                    // Let's fetch from the first one that has options for now, or all.
                    for (const r of reports) {
                        await fetchOptions(r.id);
                    }
                } catch (err) {
                    console.error("Failed to load grouped params", err);
                }
            } else if (report) {
                params = report.parameters || [];
                setParameters(params);
                await fetchOptions(report.id);
            }

            const initialParams: Record<string, any> = {};
            params.forEach(p => {
                if (p.parameter_type === 'date_range') {
                    const [s, e] = (p.default_value || '').split(',');
                    initialParams[`${p.parameter_name}_start`] = s || '';
                    initialParams[`${p.parameter_name}_end`] = e || s || '';
                } else {
                    initialParams[p.parameter_name] = p.default_value || '';
                }
            });
            setParamValues(initialParams);
        };

        initialize();
    }, [report?.id, reports]);

    const handleParamChange = (name: string, value: string) => {
        setParamValues(prev => ({ ...prev, [name]: value }));
    };

    const handleGenerate = async () => {
        setIsParamsExpanded(false);
        await new Promise(resolve => setTimeout(resolve, 300));

        setIsLoading(true);
        setHtmlData(null);
        setValidationReason(null);
        onGenerated?.(false, {});
        try {
            let res;
            if (reports && reports.length > 0) {
                res = await apiClient.post(`/reports/grouped/generate`, {
                    report_ids: reports.map(r => r.id),
                    parameters: paramValues
                });
            } else if (report) {
                res = await apiClient.post(`/reports/${report.id}/generate`, {
                    parameters: paramValues
                });
            } else return;

            if (res.data.validation_error) {
                setValidationReason(res.data.validation_error);
                setIsParamsExpanded(true);
            } else {
                setHtmlData(res.data.html);
                onGenerated?.(true, paramValues);
            }
        } catch (err: any) {
            console.error("Failed to generate report", err);
            const detail = err.response?.data?.detail;
            const msg = typeof detail === 'string' ? detail : (detail ? JSON.stringify(detail) : err.message);
            alert("Error generating report: " + msg);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-[var(--bg-app)] overflow-hidden">
            <div className="flex-1 relative overflow-hidden flex flex-col items-center">
                <AppParametersView
                    title="Report Parameters"
                    isExpanded={isParamsExpanded}
                    onToggle={() => setIsParamsExpanded(!isParamsExpanded)}
                    className={parameters.length === 0 ? 'hidden' : ''}
                >
                    {parameters.map(param => (
                        <div key={param.parameter_name} className="space-y-1.5 min-w-0">
                            <label className="text-sm font-bold text-[var(--text-main)] capitalize block truncate">
                                {param.parameter_name.replace(/_/g, ' ')}
                            </label>

                            <AppParameterSelectByTamplate
                                parameter={param}
                                value={paramValues[param.parameter_name]}
                                onChange={(val) => handleParamChange(param.parameter_name, val)}
                                startValue={paramValues[`${param.parameter_name}_start`]}
                                endValue={paramValues[`${param.parameter_name}_end`]}
                                onStartChange={(val) => handleParamChange(`${param.parameter_name}_start`, val)}
                                onEndChange={(val) => handleParamChange(`${param.parameter_name}_end`, val)}
                                options={options[param.parameter_name]}
                            />
                        </div>
                    ))}
                </AppParametersView>

                {/* Report Output Area */}
                <div className={`flex-1 w-full bg-[var(--bg-app)] relative overflow-hidden z-0 transition-all duration-300`}>
                    {isLoading ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-brand bg-[var(--bg-app)]/50 backdrop-blur-sm z-20">
                            <div className="w-8 h-8 rounded-full border-t-2 border-brand animate-spin mb-4" />
                            <p className="font-bold text-sm tracking-wide text-[var(--text-main)]">Generating Report...</p>
                        </div>
                    ) : validationReason ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-[var(--bg-app)] animate-in fade-in duration-300 z-10">
                             <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/20 p-8 rounded-[2rem] max-w-md shadow-2xl animate-in zoom-in duration-300">
                                 <div className="w-20 h-20 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
                                     <Icon name="warning" size={32} className="text-red-500" />
                                 </div>
                                 <h4 className="text-xl font-bold text-[var(--text-main)] mb-3">Generation Halted</h4>
                                 <p className="text-sm text-[var(--text-muted)] mb-8 leading-relaxed px-4">
                                     {validationReason}
                                 </p>
                                 <button 
                                     onClick={() => setIsParamsExpanded(true)}
                                     className="px-8 py-3 bg-[var(--text-main)] hover:bg-brand text-[var(--bg-app)] rounded-2xl text-sm font-bold transition-all transform active:scale-95 shadow-xl shadow-brand/10 inline-flex items-center gap-2"
                                 >
                                     <Icon name="edit" size={16} />
                                     Correct Parameters
                                 </button>
                             </div>
                        </div>
                    ) : htmlData ? (
                        <iframe
                            title="Report Preview"
                            srcDoc={htmlData}
                            className="w-full h-full border-none bg-white shadow-2xl"
                        />
                    ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-[var(--text-muted)] p-8 text-center">
                            <div className="relative mb-6">
                                <div className="absolute inset-0 bg-brand/10 blur-3xl rounded-full scale-150 animate-pulse" />
                                <div className="relative mb-6 opacity-10">
                                    <Icon name="docs" size={150} className="text-[var(--text-muted)]" />
                                </div>
                            </div>
                            <h4 className="text-lg font-bold text-[var(--text-main)] mb-2">Ready to Generate</h4>
                            <p className="max-w-xs text-sm opacity-60">Configure the parameters on the right and click generate to view your report.</p>
                        </div>
                    )}
                </div>
            </div>

            <ConfirmModal
                isOpen={isValidationModalOpen}
                title="Missing Parameters"
                description="Please fill in all required parameters before generating the report."
                confirmLabel="OK"
                showCancel={false}
                variant="warning"
                onConfirm={() => setIsValidationModalOpen(false)}
                onCancel={() => setIsValidationModalOpen(false)}
            />
        </div>
    );
});
