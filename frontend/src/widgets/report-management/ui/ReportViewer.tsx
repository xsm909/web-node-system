import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import type { Report } from '../../../entities/report/model/types';
import { Icon } from '../../../shared/ui/icon';
import { ComboBox } from '../../../shared/ui/combo-box/ComboBox';
import { ConfirmModal } from '../../../shared/ui/confirm-modal/ConfirmModal';
import { apiClient } from '../../../shared/api/client';
import { AppParametersView } from '../../../shared/ui/app-parameters-view/AppParametersView';

interface ReportViewerProps {
    report: Report;
    onLoadingChange?: (loading: boolean) => void;
    onGenerated?: (isGenerated: boolean, params: Record<string, any>) => void;
}

export interface ReportViewerRef {
    handleGenerate: () => void;
}

export const ReportViewer = forwardRef<ReportViewerRef, ReportViewerProps>(({ report, onLoadingChange, onGenerated }, ref) => {
    const [htmlData, setHtmlData] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [paramValues, setParamValues] = useState<Record<string, any>>({});
    // Store selected item locally for ComboBox to render label correctly
    const [selectedItems, setSelectedItems] = useState<Record<string, { value: string, label: string }>>({});
    const [options, setOptions] = useState<Record<string, { value: string, label: string }[]>>({});
    const [isValidationModalOpen, setIsValidationModalOpen] = useState(false);
    const [isParamsExpanded, setIsParamsExpanded] = useState(true);

    useImperativeHandle(ref, () => ({
        handleGenerate
    }));

    useEffect(() => {
        onLoadingChange?.(isLoading);
    }, [isLoading, onLoadingChange]);

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
        if (report.parameters && report.parameters.length > 0) {
            const hasEmptyParam = report.parameters.some(p => !paramValues[p.parameter_name] || String(paramValues[p.parameter_name]).trim() === '');
            if (hasEmptyParam) {
                setIsValidationModalOpen(true);
                return;
            }
        }

        setIsParamsExpanded(false);
        // wait for collapse animation
        await new Promise(resolve => setTimeout(resolve, 300));

        setIsLoading(true);
        setHtmlData(null);
        onGenerated?.(false, {});
        try {
            const res = await apiClient.post(`/reports/${report.id}/generate`, {
                parameters: paramValues
            });
            setHtmlData(res.data.html);
            onGenerated?.(true, paramValues);
        } catch (err: any) {
            console.error("Failed to generate report", err);
            alert("Error generating report: " + (err.response?.data?.detail || err.message));
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
                    className={!report.parameters || report.parameters.length === 0 ? 'hidden' : ''}
                >
                    {report.parameters && report.parameters.map(param => (
                        <div key={param.parameter_name} className="space-y-1.5 min-w-0">
                            <label className="text-sm font-bold text-[var(--text-main)] capitalize block truncate">
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
                    ))}
                </AppParametersView>

                {/* Report Output Area */}
                <div className={`flex-1 w-full bg-[var(--bg-app)] relative overflow-hidden z-0 transition-all duration-300`}>
                    {isLoading ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-brand bg-[var(--bg-app)]/50 backdrop-blur-sm z-20">
                            <div className="w-8 h-8 rounded-full border-t-2 border-brand animate-spin mb-4" />
                            <p className="font-bold text-sm tracking-wide text-[var(--text-main)]">Generating Report...</p>
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
