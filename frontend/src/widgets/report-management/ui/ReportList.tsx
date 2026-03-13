import { useMemo } from 'react';
import {
    createColumnHelper,
} from '@tanstack/react-table';
import type { Report } from '../../../entities/report/model/types';
import { Icon } from '../../../shared/ui/icon';
import { AppTable } from '../../../shared/ui/app-table';

const columnHelper = createColumnHelper<Report>();

interface ReportListProps {
    reports: Report[];
    isAdmin: boolean;
    onEdit: (report: Report) => void;
    onView: (report: Report) => void;
    onDelete: (report: Report) => void;
    searchQuery: string;
}

export function ReportList({ reports, isAdmin, onEdit, onView, onDelete, searchQuery }: ReportListProps) {

    const columns = useMemo(() => [
        columnHelper.accessor('name', {
            header: 'Name',
            cell: info => {
                const report = info.row.original;
                return (
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center text-brand">
                            <Icon name="bar_chart" size={16} />
                        </div>
                        <div className="flex flex-col min-w-0">
                            <span className="text-[var(--text-main)] truncate">{report.name}</span>
                            <span className="text-[10px] text-[var(--text-muted)] opacity-60 truncate">{report.description || 'No description'}</span>
                        </div>
                    </div>
                );
            },
        }),
        columnHelper.accessor('type', {
            header: 'Type',
            cell: info => (
                <span className="text-[10px] uppercase tracking-wider text-slate-600 bg-slate-500/10 px-2 py-0.5 rounded-full ring-1 ring-inset ring-slate-500/20">
                    {info.getValue()}
                </span>
            ),
        }),
        columnHelper.display({
            id: 'actions',
            header: () => <div className="text-right">Actions</div>,
            cell: info => {
                const report = info.row.original;
                return (
                    <div className="flex gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                            onClick={(e) => { e.stopPropagation(); onView(report); }}
                            className="p-2 rounded-lg bg-[var(--border-muted)] text-[var(--text-main)] hover:bg-[var(--border-base)] transition-colors"
                            title="Open Report"
                        >
                            <Icon name="play" size={16} />
                        </button>
                        {isAdmin && (
                            <>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onEdit(report); }}
                                    className="p-2 rounded-lg text-brand hover:bg-brand/10 transition-colors"
                                    title="Edit Report"
                                >
                                    <Icon name="edit" size={16} />
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onDelete(report); }}
                                    className="p-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                                    title="Delete Report"
                                >
                                    <Icon name="delete" size={16} />
                                </button>
                            </>
                        )}
                    </div>
                );
            },
        }),
    ], [isAdmin, onEdit, onView, onDelete]);

    const filteredReports = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return reports;
        return reports.filter(r =>
            r.name.toLowerCase().includes(q) ||
            (r.description || '').toLowerCase().includes(q) ||
            (r.category || '').toLowerCase().includes(q)
        );
    }, [reports, searchQuery]);

    return (
        <AppTable
            data={filteredReports}
            columns={columns}
            isSearching={searchQuery.trim().length > 0}
            onRowClick={onView}
            config={{
                categoryExtractor: r => r.category,
                persistCategoryKey: 'report_expanded_categories',
                emptyMessage: 'No reports found.'
            }}
        />
    );
}

