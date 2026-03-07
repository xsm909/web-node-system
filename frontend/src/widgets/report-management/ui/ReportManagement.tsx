import { useState, useEffect } from 'react';
import { apiClient } from '../../../shared/api/client';
import type { Report, ReportStyle } from '../../../entities/report/model/types';
import { useAuthStore } from '../../../features/auth/store';

import { ReportList } from './ReportList';
import { ReportEditor } from './ReportEditor';
import { ReportViewer } from './ReportViewer';

export function ReportManagement() {
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
        <div className="flex flex-col h-full overflow-hidden">
            {view === 'list' && (
                <ReportList
                    reports={reports}
                    isAdmin={isAdmin}
                    onCreate={handleCreate}
                    onEdit={handleEdit}
                    onView={handleView}
                />
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
                    onBack={handleBack}
                />
            )}
        </div>
    );
}
