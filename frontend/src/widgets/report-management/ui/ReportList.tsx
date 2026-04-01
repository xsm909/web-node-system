import { useMemo } from 'react';
import {
    createColumnHelper,
} from '@tanstack/react-table';
import type { Report } from '../../../entities/report/model/types';
import { Icon } from '../../../shared/ui/icon';
import { AppTable } from '../../../shared/ui/app-table';
import { AppTableStandardCell } from '../../../shared/ui/app-table/components/AppTableStandardCell';

const columnHelper = createColumnHelper<Report>();

interface ReportListProps {
    reports: Report[];
    isAdmin: boolean;
    onEdit: (report: Report) => void;
    onView: (report: Report) => void;
    onDelete: (report: Report) => void;
    onDuplicate: (report: Report) => void;
    onReorder: (report: Report, newOrder: Report[]) => void;
    onGroupView: (reports: Report[]) => void;
    searchQuery: string;
}

export function ReportList({ reports, isAdmin, onEdit, onView, onDelete, onDuplicate, onReorder, onGroupView, searchQuery }: ReportListProps) {

    const columns = useMemo(() => [
        columnHelper.accessor('name', {
            id: 'name',
            header: 'Name',
            cell: info => {
                const report = info.row.original;
                return (
                    <AppTableStandardCell
                        icon="article"
                        label={report.name}
                        subtitle={report.description}
                        isLocked={report.is_locked}
                    />
                );
            },
        }),
        columnHelper.accessor('type', {
            header: 'Type',
            cell: info => (
                <span className="text-[10px] uppercase tracking-wider text-slate-600 bg-slate-500/10 px-2 py-0.5 rounded-full ring-1 ring-inset ring-slate-500/20 font-medium">
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
                            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-500/10 transition-colors"
                            title="Open Report"
                        >
                            <Icon name="play_arrow" size={16} />
                        </button>
                        {isAdmin && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onDuplicate(report); }}
                                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-500/10 transition-colors"
                                title="Duplicate Report"
                            >
                                <Icon name="content_copy" size={16} />
                            </button>
                        )}
                        {isAdmin && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onDelete(report); }}
                                className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                                title="Delete Report"
                            >
                                <Icon name="delete" size={16} />
                            </button>
                        )}
                    </div>
                );
            },
        }),
    ], [isAdmin, onView, onDelete, onDuplicate]);

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
            onRowClick={isAdmin ? onEdit : onView}
            config={{
                categoryExtractor: r => r.category,
                indentColumnId: 'name',
                persistCategoryKey: 'report_expanded_categories',
                emptyMessage: 'No reports found.',
                onReorder: isAdmin ? onReorder : undefined,
                categoryActions: (_path, items) => [
                    {
                        icon: 'play_arrow',
                        label: 'Generate',
                        onClick: () => onGroupView(items),
                        variant: 'primary'
                    }
                ]
            }}
        />
    );
}

