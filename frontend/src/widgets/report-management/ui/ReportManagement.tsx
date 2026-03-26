import { useState, useEffect, useRef } from 'react';
import { apiClient } from '../../../shared/api/client';
import type { Report, ReportStyle } from '../../../entities/report/model/types';
import { useAuthStore } from '../../../features/auth/store';
import { AppHeader } from '../../app-header';
import { Icon } from '../../../shared/ui/icon/Icon';
import { ComboBox } from '../../../shared/ui/combo-box/ComboBox';
import { ConfirmModal } from '../../../shared/ui/confirm-modal/ConfirmModal';
import { AppCompactModalForm } from '../../../shared/ui/app-compact-modal-form/AppCompactModalForm';
import { AppFormView } from '../../../shared/ui/app-form-view/AppFormView';
import { AppTabs } from '../../../shared/ui/app-tabs/AppTabs';
import { AppRoundButton } from '../../../shared/ui/app-round-button/AppRoundButton';

import { ReportList } from './ReportList';
import { ReportEditor, type ReportEditorRef } from './ReportEditor';
import { ReportViewer, type ReportViewerRef } from './ReportViewer';
import { StyleList } from './StyleList';
import { StyleEditor, type StyleEditorRef } from './StyleEditor';
import { useHotkeys } from '../../../shared/lib/hotkeys/useHotkeys';
import { useProjectStore } from '../../../features/projects/store';

interface ReportManagementProps {
    onToggleSidebar?: () => void;
    isSidebarOpen?: boolean;
}

export function ReportManagement({ onToggleSidebar, isSidebarOpen }: ReportManagementProps) {
    const { user } = useAuthStore();
    const isAdmin = user?.role === 'admin';

    type ViewState = 'list' | 'edit' | 'view';
    const [view, setView] = useState<ViewState>('list');
    const [topTab, setTopTab] = useState<'reports' | 'styles'>('reports');
    const [activeTab, setActiveTab] = useState<'general' | 'code' | 'template' | 'preview'>('general');
    const [reports, setReports] = useState<Report[]>([]);
    const [styles, setStyles] = useState<ReportStyle[]>([]);
    const [selectedReport, setSelectedReport] = useState<Report | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const { activeProject, isProjectMode } = useProjectStore();
    const [creationProjectId, setCreationProjectId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const [idToDelete, setIdToDelete] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const reportViewerRef = useRef<ReportViewerRef>(null);
    const reportEditorRef = useRef<ReportEditorRef>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isCompiling, setIsCompiling] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isGeneratingTemplate, setIsGeneratingTemplate] = useState(false);
    const [showLayoutModal, setShowLayoutModal] = useState(false);
    const [reportEditorIsDirty, setReportEditorIsDirty] = useState(false);
    const styleEditorRef = useRef<StyleEditorRef>(null);
    const [styleEditorIsDirty, setStyleEditorIsDirty] = useState(false);

    const handleHeaderCompile = async () => {
        if (isCompiling || view !== 'edit') return;
        setIsCompiling(true);
        try {
            await reportEditorRef.current?.handleCompile();
        } finally {
            setIsCompiling(false);
        }
    };

    const handleHeaderGenerate = async () => {
        if (isGenerating || view !== 'edit') return;
        setIsGenerating(true);
        try {
            await reportEditorRef.current?.handleGenerate();
            setActiveTab('preview');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleHeaderGenerateTemplate = async () => {
        if (isGeneratingTemplate || view !== 'edit') return;
        setShowLayoutModal(true);
    };

    const handleSelectLayout = async (layout: 'table' | 'structural') => {
        setShowLayoutModal(false);
        setIsGeneratingTemplate(true);
        try {
            await reportEditorRef.current?.handleGenerateTemplate(layout);
        } finally {
            setIsGeneratingTemplate(false);
        }
    };

    // View shortcuts
    useHotkeys([
        { key: 'Escape', description: 'Go Back', handler: () => handleBack() }
    ], { 
        scopeName: 'Report Viewer', 
        enabled: view === 'view' 
    });

    // Editor shortcuts
    useHotkeys([
        { key: 'F4', description: 'Python Code', handler: () => setActiveTab('code') },
        { 
            key: 'F1', 
            description: 'SQL Query Builder', 
            enabled: activeTab === 'code',
            handler: () => reportEditorRef.current?.handleOpenQueryBuilder()
        },
        { 
            key: 'F5', 
            description: 'Compile', 
            enabled: activeTab === 'code',
            handler: () => handleHeaderCompile() 
        },
        { key: 'F9', description: 'Generate', handler: () => handleHeaderGenerate() }
    ], { 
        scopeName: 'Report Editor', 
        enabled: view === 'edit' && isAdmin && topTab === 'reports' 
    });

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
    }, [refreshTrigger, isAdmin, isProjectMode, activeProject?.id]);

    const handleCreate = () => {
        setSelectedReport(null);
        setCreationProjectId(activeProject?.id || null);
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

    const handleCreateStyle = () => {
        setSelectedStyle(null);
        setView('edit');
    };

    const handleEditStyle = (style: ReportStyle) => {
        setSelectedStyle(style);
        setView('edit');
    };

    const handleDelete = (report: Report) => {
        setIdToDelete(report.id);
    };

    const handleDuplicate = async (report: Report) => {
        try {
            await apiClient.post(`/reports/${report.id}/duplicate`);
            setRefreshTrigger(prev => prev + 1);
        } catch (err) {
            console.error("Failed to duplicate report", err);
            alert("Error duplicating report");
        }
    };

    const handleDeleteStyle = (style: ReportStyle) => {
        setIdToDelete(style.id);
    };

    const handleReorder = async (_item: Report, newOrder: Report[]) => {
        if (!isAdmin) return;
        try {
            await apiClient.put('/reports/reorder', {
                ids: newOrder.map(r => r.id)
            });
            // Update local state for immediate feedback
            setReports(prev => {
                const otherReports = prev.filter(r => !newOrder.find(nr => nr.id === r.id));
                return [...otherReports, ...newOrder];
            });
        } catch (err) {
            console.error("Failed to reorder reports", err);
            alert("Error reordering reports");
            setRefreshTrigger(prev => prev + 1); // Rollback
        }
    };

    const confirmDelete = async () => {
        if (!idToDelete) return;
        setIsDeleting(true);
        try {
            if (topTab === 'reports') {
                await apiClient.delete(`/reports/${idToDelete}`);
            } else {
                await apiClient.delete(`/reports/styles/${idToDelete}`);
            }
            setRefreshTrigger(prev => prev + 1);
        } catch (err) {
            console.error("Failed to delete", err);
            alert("Error deleting item");
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
        setCreationProjectId(null);
        setSelectedStyle(null);
        setIsGenerated(false);
        setActiveTab('general');
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

    const [selectedStyle, setSelectedStyle] = useState<ReportStyle | null>(null);

    if (isLoading) {
        return <div className="p-8 text-center text-[var(--text-muted)]">Loading reports...</div>;
    }

    // Render Logic
    return (
        <>
            {view === 'edit' && isAdmin && topTab === 'reports' && (
                <AppFormView
                    title={selectedReport?.name || 'New Report'}
                    parentTitle="Reports Management"
                    icon="article"
                    isDirty={reportEditorIsDirty}
                    isSaving={isSaving}
                    onSave={() => {
                        setIsSaving(true);
                        const saveParams = !selectedReport && creationProjectId ? { project_id: creationProjectId } : {};
                        reportEditorRef.current?.handleSave(saveParams)
                            .then((savedReport) => {
                                if (savedReport) {
                                    setSelectedReport(savedReport);
                                }
                            })
                            .finally(() => setIsSaving(false));
                    }}
                    onCancel={handleBack}
                    tabs={[
                        { id: 'general', label: 'General' },
                        { id: 'code', label: 'Code (Python)' },
                        { id: 'template', label: 'HTML Template' },
                        { id: 'preview', label: 'Preview' }
                    ]}
                    activeTab={activeTab}
                    onTabChange={(id) => setActiveTab(id as any)}
                    saveLabel="Save Report"
                    allowedShortcuts={['f1', 'f4', 'f5', 'f9']}
                    entityId={selectedReport?.id}
                    entityType="reports"
                    isLocked={selectedReport?.is_locked}
                    onLockToggle={(locked) => {
                        setSelectedReport(prev => prev ? { ...prev, is_locked: locked } : null);
                        setRefreshTrigger(prev => prev + 1);
                    }}
                    headerRightContent={
                        <div className="flex gap-2">
                            {activeTab === 'code' && (
                                <AppRoundButton
                                    icon={isCompiling ? "refresh" : "code"}
                                    onClick={handleHeaderCompile}
                                    isLoading={isCompiling}
                                    variant="outline"
                                    title="Compile (F5)"
                                    iconSize={18}
                                />
                            )}
                            {activeTab === 'template' && (
                                <AppRoundButton
                                    icon={isGeneratingTemplate ? "refresh" : "wizard"}
                                    onClick={handleHeaderGenerateTemplate}
                                    isLoading={isGeneratingTemplate}
                                    variant="outline"
                                    title="Generate Template"
                                    iconSize={18}
                                />
                            )}
                            <AppRoundButton
                                icon={isGenerating ? "refresh" : "play"}
                                onClick={handleHeaderGenerate}
                                isLoading={isGenerating}
                                variant="brand"
                                title="Generate (F9)"
                                iconSize={18}
                            />
                        </div>
                    }
                >
                    <ReportEditor
                        ref={reportEditorRef}
                        report={selectedReport}
                        reports={reports}
                        styles={styles}
                        activeTab={activeTab}
                        onTabChange={(id) => setActiveTab(id as any)}
                        onDirtyChange={setReportEditorIsDirty}
                        isLocked={selectedReport?.is_locked}
                    />
                </AppFormView>
            )}

            {view === 'edit' && isAdmin && topTab === 'styles' && (
                <AppFormView
                    title={selectedStyle?.name || 'New Style'}
                    parentTitle="Styles Management"
                    icon="palette"
                    isDirty={styleEditorIsDirty}
                    isSaving={isSaving}
                    onSave={() => {
                        setIsSaving(true);
                        styleEditorRef.current?.handleSave()
                            .then((savedStyle: ReportStyle | void) => {
                                if (savedStyle) {
                                    setSelectedStyle(savedStyle);
                                }
                            })
                            .finally(() => setIsSaving(false));
                    }}
                    onCancel={handleBack}
                    saveLabel="Save Style"
                    entityId={selectedStyle?.id}
                    entityType="report_styles"
                    isLocked={selectedStyle?.is_locked}
                    onLockToggle={(locked) => {
                        setSelectedStyle(prev => prev ? { ...prev, is_locked: locked } : null);
                        setRefreshTrigger(prev => prev + 1);
                    }}
                >
                    <StyleEditor
                        ref={styleEditorRef}
                        style={selectedStyle}
                        allStyles={styles}
                        onDirtyChange={setStyleEditorIsDirty}
                        isLocked={selectedStyle?.is_locked}
                    />
                </AppFormView>
            )}

            {(view === 'list' || view === 'view') && (
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
                                        title="Go back (Esc)"
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
                                    <AppRoundButton
                                        icon="add"
                                        onClick={topTab === 'reports' ? handleCreate : handleCreateStyle}
                                        variant="brand"
                                        title={topTab === 'reports' ? "Add Report" : "Add Style"}
                                    />
                                )}
                                {view === 'view' && (
                                    <div className="flex items-center gap-2">
                                        <AppRoundButton
                                            icon="expand_all"
                                            onClick={() => reportViewerRef.current?.expandAll()}
                                            variant="ghost"
                                            title="Expand All"
                                            iconSize={20}
                                        />
                                        <AppRoundButton
                                            icon="collapse_all"
                                            onClick={() => reportViewerRef.current?.collapseAll()}
                                            variant="ghost"
                                            title="Collapse All"
                                            iconSize={20}
                                        />
                                        <AppRoundButton
                                            icon={isGenerating ? "refresh" : "play"}
                                            onClick={() => reportViewerRef.current?.handleGenerate()}
                                            isLoading={isGenerating}
                                            variant="brand"
                                            title="Generate"
                                            iconSize={18}
                                        />
                                    </div>
                                )}
                                {view === 'view' && isGenerated && (
                                    <ComboBox
                                        label="Export"
                                        icon="article"
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
                                        align="right"
                                    />
                                )}
                            </div>
                        }
                        searchQuery={view === 'list' ? searchQuery : undefined}
                        onSearchChange={view === 'list' ? setSearchQuery : undefined}
                        searchPlaceholder="Search reports by name, description or category..."
                    />

                    <div className="flex-1 overflow-hidden flex flex-col">
                        {view === 'list' && isAdmin && (
                            <div className="px-8 border-b border-[var(--border-base)] bg-[var(--bg-app)]">
                                <AppTabs
                                    tabs={[
                                        { id: 'reports', label: 'Reports', icon: 'article' },
                                        { id: 'styles', label: 'Styles', icon: 'palette' },
                                    ]}
                                    activeTab={topTab}
                                    onTabChange={(id) => setTopTab(id as 'reports' | 'styles')}
                                    variant="underline"
                                />
                            </div>
                        )}

                        {view === 'list' && topTab === 'reports' && (
                            <ReportList
                                reports={reports}
                                isAdmin={isAdmin}
                                onEdit={handleEdit}
                                onView={handleView}
                                onDelete={handleDelete}
                                onDuplicate={handleDuplicate}
                                onReorder={handleReorder}
                                searchQuery={searchQuery}
                            />
                        )}

                        {view === 'list' && topTab === 'styles' && isAdmin && (
                            <StyleList
                                styles={styles}
                                isAdmin={isAdmin}
                                onEdit={handleEditStyle}
                                onDelete={handleDeleteStyle}
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
                </div>
            )}

            <ConfirmModal
                isOpen={!!idToDelete}
                title={topTab === 'reports' ? "Delete Report" : "Delete Style"}
                description={`Are you sure you want to delete this ${topTab === 'reports' ? 'report' : 'style'}? This action cannot be undone.`}
                confirmLabel="Delete"
                isLoading={isDeleting}
                onConfirm={confirmDelete}
                onCancel={() => setIdToDelete(null)}
            />

            <AppCompactModalForm
                isOpen={showLayoutModal}
                onClose={() => setShowLayoutModal(false)}
                onSubmit={() => { }} // No default submit, handled via buttons
                title="Generate Template"
                icon="play"
                width="max-w-sm"
                headerRightContent={null}
            >
                <div className="py-2">
                    <p className="text-[10px] text-[var(--text-muted)] leading-relaxed mb-6 opacity-70 font-medium uppercase tracking-widest">
                        Choose how you want to structure your report based on your data.
                    </p>

                    <div className="flex flex-col gap-2">
                        <button
                            onClick={() => handleSelectLayout('table')}
                            className="flex items-center gap-3 p-3 rounded-xl bg-[var(--bg-alt)] hover:bg-[var(--border-base)] border border-[var(--border-base)] transition-all group text-left"
                        >
                            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center border border-blue-500/20 group-hover:bg-blue-500/20 transition-colors">
                                <Icon name="play" size={16} className="text-blue-500" />
                            </div>
                            <div>
                                <div className="text-[11px] font-bold text-[var(--text-main)] transition-colors group-hover:text-brand-400">Table (Flat)</div>
                                <div className="text-[9px] text-[var(--text-muted)] mt-0.5">Best for simple lists and grids</div>
                            </div>
                        </button>

                        <button
                            onClick={() => handleSelectLayout('structural')}
                            className="flex items-center gap-3 p-3 rounded-xl bg-[var(--bg-alt)] hover:bg-[var(--border-base)] border border-[var(--border-base)] transition-all group text-left"
                        >
                            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center border border-amber-500/20 group-hover:bg-amber-500/20 transition-colors">
                                <Icon name="article" size={16} className="text-amber-500" />
                            </div>
                            <div>
                                <div className="text-[11px] font-bold text-[var(--text-main)] transition-colors group-hover:text-brand-400">Structural (Nested)</div>
                                <div className="text-[9px] text-[var(--text-muted)] mt-0.5">Best for complex hierarchy</div>
                            </div>
                        </button>
                    </div>
                </div>
            </AppCompactModalForm>
        </>
    );
}
