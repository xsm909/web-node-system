import { useState, useEffect } from 'react';
import { apiClient } from '../../../shared/api/client';
import type { Report, ReportStyle } from '../../../entities/report/model/types';
import { useAuthStore } from '../../../features/auth/store';
import { AppHeader } from '../../app-header';
import { Icon } from '../../../shared/ui/icon';

import { ReportList } from './ReportList';
import { ReportEditor } from './ReportEditor';
import { ReportViewer } from './ReportViewer';

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
    const [refreshTrigger, setRefreshTrigger] = useState(0);

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

    const handleBack = () => {
        setView('list');
        setSelectedReport(null);
        setRefreshTrigger(prev => prev + 1);
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
                        report={selectedReport!}
                    />
                )}
            </div>
        </div>
    );
}
