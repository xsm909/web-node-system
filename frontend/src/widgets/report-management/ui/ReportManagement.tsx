import { useState, useEffect, useRef } from 'react';
import { apiClient } from '../../../shared/api/client';
import type { Report, ReportStyle } from '../../../entities/report/model/types';
import { useAuthStore } from '../../../features/auth/store';
import { AppHeader } from '../../app-header';
import { Icon } from '../../../shared/ui/icon';

import { ReportList } from './ReportList';
import { ReportEditor } from './ReportEditor';
import { ReportViewer, type ReportViewerRef } from './ReportViewer';

interface ReportManagementProps {
    onToggleSidebar?: () => void;
    isSidebarOpen?: boolean;
}

export function ReportManagement({ onToggleSidebar, isSidebarOpen }: ReportManagementProps) {
    const { user } = useAuthStore();
    const isAdmin = user?.role === 'admin';

    type ViewState = 'list' | 'edit' | 'view';
    const [view, setView] = useState<ViewState>('list');
    const [reports, setReports] = useState<Report[]>([]);
    const [styles, setStyles] = useState<ReportStyle[]>([]);
    const [selectedReport, setSelectedReport] = useState<Report | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    const reportViewerRef = useRef<ReportViewerRef>(null);

    useEffect(() => {
        const fetchReports = async () => {
            setIsLoading(true);
            try {
                const res = await apiClient.get<Report[]>('/reports');
                setReports(res.data);

                if (isAdmin) {
                    const stylesRes = await apiClient.get<ReportStyle[]>('/reports/styles');
                    setStyles(stylesRes.data);
                }
            } catch (err) {
                console.error("Failed to load reports", err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchReports();
    }, [refreshTrigger, isAdmin]);

    const handleCreate = () => {
        setSelectedReport(null);
        setView('edit');
    };

    const handleEdit = (report: Report) => {
        setSelectedReport(report);
        setView('edit');
    };

    const handleView = (report: Report) => {
        setSelectedReport(report);
        setView('view');
    };

    const [isGenerated, setIsGenerated] = useState(false);
    const [currentParams, setCurrentParams] = useState<Record<string, any>>({});

    const handleBack = () => {
        setView('list');
        setSelectedReport(null);
        setIsGenerated(false);
        setRefreshTrigger(prev => prev + 1);
    };

    const handleDownloadPdf = async () => {
        if (!selectedReport) return;
        try {
            const res = await apiClient.post(`/reports/${selectedReport.id}/pdf`, {
                parameters: currentParams
            }, {
                responseType: 'blob'
            });

            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `report_${selectedReport.name.replace(/\s+/g, '_')}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            console.error("Failed to download PDF", err);
            alert("Error downloading PDF");
        }
    };

    if (isLoading) {
        return <div className="p-8 text-center text-[var(--text-muted)]">Loading reports...</div>;
    }

    return (
        <div className="flex flex-col h-full bg-[var(--bg-app)] overflow-hidden relative">
            <AppHeader
                onToggleSidebar={onToggleSidebar || (() => { })}
                isSidebarOpen={isSidebarOpen}
                leftContent={
                    <div className="flex items-center gap-3">
                        {view !== 'list' && (
                            <button
                                onClick={handleBack}
                                className="p-2 -ml-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--border-muted)] transition-colors"
                            >
                                <Icon name="back" size={24} />
                            </button>
                        )}
                        <h1 className="text-lg lg:text-xl font-semibold tracking-tight text-[var(--text-main)] opacity-90">
                            {view === 'list' ? 'Reports Management' : (
                                <span><span className="opacity-50 font-normal">Reports / </span>{selectedReport?.name || 'New Report'}</span>
                            )}
                        </h1>
                    </div>
                }
                rightContent={
                    view === 'view' && (
                        <div className="flex items-center gap-3">
                            {isGenerated && (
                                <button
                                    onClick={handleDownloadPdf}
                                    className="flex items-center gap-2 px-6 py-2 bg-[var(--bg-surface)] text-[var(--text-main)] border border-[var(--border-base)] rounded-xl shadow-sm hover:bg-[var(--bg-app)] active:scale-95 transition-all font-bold text-sm"
                                >
                                    <Icon name="docs" size={18} />
                                    Save PDF
                                </button>
                            )}
                            <button
                                onClick={() => reportViewerRef.current?.handleGenerate()}
                                disabled={isGenerating}
                                className="flex items-center gap-2 px-6 py-2 bg-brand text-white rounded-xl shadow-lg shadow-brand/20 hover:brightness-110 active:scale-95 transition-all font-bold text-sm disabled:opacity-50 disabled:pointer-events-none"
                            >
                                <Icon name="bolt" size={18} />
                                {isGenerating ? 'Generating...' : 'Generate'}
                            </button>
                        </div>
                    )
                }
            />

            <div className="flex-1 overflow-hidden">
                {view === 'list' && (
                    <div className="max-w-7xl mx-auto p-4 lg:p-8 space-y-8 h-full overflow-y-auto custom-scrollbar">
                        <ReportList
                            reports={reports}
                            isAdmin={isAdmin}
                            onCreate={handleCreate}
                            onEdit={handleEdit}
                            onView={handleView}
                        />
                    </div>
                )}

                {view === 'edit' && isAdmin && (
                    <ReportEditor
                        report={selectedReport}
                        styles={styles}
                        onBack={handleBack}
                    />
                )}

                {view === 'view' && (
                    <ReportViewer
                        ref={reportViewerRef}
                        report={selectedReport!}
                        onLoadingChange={setIsGenerating}
                        onGenerated={(generated: boolean, params: Record<string, any>) => {
                            setIsGenerated(generated);
                            setCurrentParams(params);
                        }}
                    />
                )}
            </div>
        </div>
    );
}
