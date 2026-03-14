import { useState, useEffect, useRef } from 'react';
import { apiClient } from '../../../shared/api/client';
import type { Report, ReportStyle } from '../../../entities/report/model/types';
import { useAuthStore } from '../../../features/auth/store';
import { AppHeader } from '../../app-header';
import { Icon } from '../../../shared/ui/icon';
import { ComboBox } from '../../../shared/ui/combo-box/ComboBox';
import { ConfirmModal } from '../../../shared/ui/confirm-modal';
import { AppFormView } from '../../../shared/ui/app-form-view';

import { ReportList } from './ReportList';
import { ReportEditor, type ReportEditorRef } from './ReportEditor';
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
    const [activeTab, setActiveTab] = useState<'details' | 'builder'>('details');
    const [reports, setReports] = useState<Report[]>([]);
    const [styles, setStyles] = useState<ReportStyle[]>([]);
    const [selectedReport, setSelectedReport] = useState<Report | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [searchQuery, setSearchQuery] = useState('');

    const [idToDelete, setIdToDelete] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const reportViewerRef = useRef<ReportViewerRef>(null);
    const reportEditorRef = useRef<ReportEditorRef>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [reportEditorIsDirty, setReportEditorIsDirty] = useState(false);

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

    const handleDelete = (report: Report) => {
        setIdToDelete(report.id);
    };

    const confirmDelete = async () => {
        if (!idToDelete) return;
        setIsDeleting(true);
        try {
            await apiClient.delete(`/reports/${idToDelete}`);
            setRefreshTrigger(prev => prev + 1);
        } catch (err) {
            console.error("Failed to delete report", err);
            alert("Error deleting report");
        } finally {
            setIsDeleting(false);
            setIdToDelete(null);
        }
    };

    const [isGenerated, setIsGenerated] = useState(false);
    const [currentParams, setCurrentParams] = useState<Record<string, any>>({});

    const handleBack = () => {
        setView('list');
        setSelectedReport(null);
        setIsGenerated(false);
        setActiveTab('details');
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

    const handleDownloadCsv = async () => {
        if (!selectedReport) return;
        try {
            const res = await apiClient.post(`/reports/${selectedReport.id}/csv`, {
                parameters: currentParams
            }, {
                responseType: 'blob'
            });

            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `report_${selectedReport.name.replace(/\s+/g, '_')}.csv`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            console.error("Failed to download CSV", err);
            alert("Error downloading CSV");
        }
    };

    const handleDownloadHtml = async () => {
        if (!selectedReport) return;
        try {
            const res = await apiClient.post(`/reports/${selectedReport.id}/html-file`, {
                parameters: currentParams
            }, {
                responseType: 'blob'
            });

            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `report_${selectedReport.name.replace(/\s+/g, '_')}.html`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            console.error("Failed to download HTML", err);
            alert("Error downloading HTML");
        }
    };

    if (isLoading) {
        return <div className="p-8 text-center text-[var(--text-muted)]">Loading reports...</div>;
    }

    if (view === 'edit' && isAdmin) {
        return (
            <AppFormView
                title={selectedReport?.name || 'New Report'}
                parentTitle="Reports Management"
                icon="description"
                isDirty={reportEditorIsDirty}
                isSaving={isSaving}
                onSave={() => {
                    setIsSaving(true);
                    reportEditorRef.current?.handleSave().finally(() => setIsSaving(false));
                }}
                onCancel={handleBack}
                tabs={[
                    { id: 'details', label: 'Details' },
                    { id: 'builder', label: 'Builder' }
                ]}
                activeTab={activeTab}
                onTabChange={(id) => setActiveTab(id as 'details' | 'builder')}
                saveLabel="Save Report"
            >
                <ReportEditor
                    ref={reportEditorRef}
                    report={selectedReport}
                    styles={styles}
                    onBack={handleBack}
                    activeTab={activeTab}
                    onDirtyChange={setReportEditorIsDirty}
                />
            </AppFormView>
        );
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
                    <div className="flex items-center gap-3">
                        {view === 'list' && isAdmin && (
                            <button
                                onClick={handleCreate}
                                className="flex items-center justify-center w-10 h-10 rounded-full bg-brand text-white hover:brightness-110 transition-all shadow-lg shadow-brand/20 active:scale-95 shrink-0"
                                title="Add Report"
                            >
                                <Icon name="add" size={20} />
                            </button>
                        )}
                        {view === 'view' && (
                            <button
                                onClick={() => reportViewerRef.current?.handleGenerate()}
                                className="flex items-center gap-2 px-6 py-2 rounded-xl bg-brand text-white font-bold text-sm hover:brightness-110 transition-all shadow-lg shadow-brand/20 active:scale-95 whitespace-nowrap"
                            >
                                <Icon name="play" size={16} className="-ml-1" />
                                Generate Report
                            </button>
                        )}
                        {view === 'view' && isGenerated && (
                            <ComboBox
                                label="Export"
                                icon="docs"
                                iconSize={18}
                                data={{
                                    items: {
                                        id: 'formats',
                                        name: 'Export Format',
                                        items: [
                                            { id: 'pdf', name: 'Save as PDF' },
                                            { id: 'csv', name: 'Save as CSV' },
                                            { id: 'html', name: 'Save as HTML' }
                                        ],
                                        children: {}
                                    }
                                }}
                                onSelect={(item) => {
                                    if (item.id === 'pdf') handleDownloadPdf();
                                    else if (item.id === 'csv') handleDownloadCsv();
                                    else if (item.id === 'html') handleDownloadHtml();
                                }}
                                variant="brand"
                                triggerClassName="px-6 py-2 shadow-lg shadow-brand/20"
                                labelClassName="font-bold text-sm"
                            />
                        )}
                    </div>
                }
                searchQuery={view === 'list' ? searchQuery : undefined}
                onSearchChange={view === 'list' ? setSearchQuery : undefined}
                searchPlaceholder="Search reports by name, description or category..."
            />

            <div className="flex-1 overflow-hidden">
                {view === 'list' && (
                    <ReportList
                        reports={reports}
                        isAdmin={isAdmin}
                        onEdit={handleEdit}
                        onView={handleView}
                        onDelete={handleDelete}
                        searchQuery={searchQuery}
                    />
                )}

                {view === 'view' && (
                    <ReportViewer
                        ref={reportViewerRef}
                        report={selectedReport!}
                        onLoadingChange={() => { }}
                        onGenerated={(generated: boolean, params: Record<string, any>) => {
                            setIsGenerated(generated);
                            setCurrentParams(params);
                        }}
                    />
                )}
            </div>

            <ConfirmModal
                isOpen={!!idToDelete}
                title="Delete Report"
                description="Are you sure you want to delete this report? This action cannot be undone."
                confirmLabel="Delete"
                isLoading={isDeleting}
                onConfirm={confirmDelete}
                onCancel={() => setIdToDelete(null)}
            />
        </div>
    );
}
