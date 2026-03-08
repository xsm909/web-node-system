import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import type { Report } from '../../../entities/report/model/types';
import { Icon } from '../../../shared/ui/icon';
import { ComboBox } from '../../../shared/ui/combo-box/ComboBox';
import { ConfirmModal } from '../../../shared/ui/confirm-modal/ConfirmModal';
import { apiClient } from '../../../shared/api/client';

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
                {/* Parameters Top Overlay (Left-Aligned with Offset) */}
                <div
                    className={`absolute top-0 left-0 w-full z-20 flex flex-col items-start transition-all duration-300 pl-[50px] ${!report.parameters || report.parameters.length === 0 ? 'hidden' : ''}`}
                >
                    <div
                        className={`w-[350px] bg-[var(--bg-surface)] border-x border-b border-[var(--border-base)] shadow-[0_10px_30px_-10px_rgba(0,0,0,0.1)] rounded-br-2xl rounded-bl-none overflow-visible transition-all duration-300 flex flex-col ${isParamsExpanded ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'}`}
                        style={{ maxHeight: isParamsExpanded ? '80vh' : '0px' }}
                    >
                        <div className="p-4 flex flex-col max-h-[80vh] relative">
                            <div className="flex items-center justify-between mb-3 px-2">
                                <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--text-muted)]">Parameters</h3>
                            </div>
                            <div className="flex-1 overflow-y-auto px-2 pb-4 flex flex-col space-y-5 custom-scrollbar">
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
                            </div>

                            {/* Hide Notch (visible when expanded) */}
                            <button
                                onClick={() => setIsParamsExpanded(false)}
                                className={`absolute bottom-0 left-[-1px] translate-y-full bg-[var(--bg-surface)] border border-t-0 border-[var(--border-base)] shadow-md rounded-b-xl px-6 py-1.5 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors hover:bg-[var(--bg-app)] cursor-pointer z-30 ${isParamsExpanded ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                            >
                                <span className="text-xs font-bold mr-1.5 uppercase tracking-wider">Hide</span>
                                <Icon name="up" size={16} />
                            </button>
                        </div>
                    </div>

                    {/* Left-Aligned Parameters Notch (visible when collapsed) */}
                    <button
                        onClick={() => setIsParamsExpanded(!isParamsExpanded)}
                        className={`bg-[var(--bg-surface)]/80 backdrop-blur-md border border-t-0 border-[var(--border-base)] shadow-md rounded-b-xl px-6 py-1.5 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors hover:bg-[var(--bg-app)] cursor-pointer mt-[-1px] ml-[-1px] ${isParamsExpanded ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
                    >
                        <span className="text-xs font-bold mr-1.5 uppercase tracking-wider">Parameters</span>
                        <Icon name="down" size={16} />
                    </button>
                </div>

                {/* Report Output Area */}
                <div className={`flex-1 w-full bg-[#f8f9fa] relative overflow-hidden z-0 transition-all duration-300`}>
                    {isLoading ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-brand bg-white/50 backdrop-blur-sm z-20">
                            <div className="w-8 h-8 rounded-full border-t-2 border-brand animate-spin mb-4" />
                            <p className="font-bold text-sm">Processing Data...</p>
                        </div>
                    ) : htmlData ? (
                        <iframe
                            title="Report Preview"
                            srcDoc={htmlData}
                            className="w-full h-full border-none bg-white shadow-inner"
                        />
                    ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 bg-gray-50/50">
                            <Icon name="bar_chart" size={48} className="opacity-20 mb-4" />
                            <p className="text-sm font-medium">Configure parameters and generate the report</p>
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
