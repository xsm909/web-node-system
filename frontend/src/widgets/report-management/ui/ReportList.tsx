import React, { useMemo, useState } from 'react';
import {
    useReactTable,
    getCoreRowModel,
    flexRender,
    createColumnHelper,
} from '@tanstack/react-table';
import type { Report } from '../../../entities/report/model/types';
import { Icon } from '../../../shared/ui/icon';
import { buildCategoryTree, type CategoryTreeNode } from '../../../shared/lib/categoryUtils';
import { getCookie, setCookie } from '../../../shared/lib/cookieUtils';

const columnHelper = createColumnHelper<Report>();

interface ReportListProps {
    reports: Report[];
    isAdmin: boolean;
    onCreate: () => void;
    onEdit: (report: Report) => void;
    onView: (report: Report) => void;
    onDelete: (report: Report) => void;
}

export function ReportList({ reports, isAdmin, onCreate, onEdit, onView, onDelete }: ReportListProps) {
    const [searchQuery, setSearchQuery] = useState('');

    // Persistence for expanded categories
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(() => {
        const saved = getCookie('report_expanded_categories');
        if (saved) return new Set(JSON.parse(saved));
        return new Set();
    });

    const toggleCategory = (path: string) => {
        setExpandedCategories(prev => {
            const next = new Set(prev);
            if (next.has(path)) next.delete(path);
            else next.add(path);
            setCookie('report_expanded_categories', JSON.stringify(Array.from(next)));
            return next;
        });
    };

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
                            <span className="font-bold text-[var(--text-main)] truncate">{report.name}</span>
                            <span className="text-[10px] text-[var(--text-muted)] opacity-60 truncate">{report.description || 'No description'}</span>
                        </div>
                    </div>
                );
            },
        }),
        columnHelper.accessor('type', {
            header: 'Type',
            cell: info => (
                <span className="text-[10px] uppercase font-black tracking-wider text-[var(--text-muted)] px-2 py-0.5 rounded-full bg-[var(--border-muted)]">
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

    const reportTree = useMemo(() => {
        if (searchQuery.trim()) return null;
        return buildCategoryTree(reports);
    }, [reports, searchQuery]);

    const table = useReactTable({
        data: filteredReports,
        columns,
        getCoreRowModel: getCoreRowModel(),
    });

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-[var(--text-main)] tracking-tight">Reports</h2>
                    <p className="text-sm text-[var(--text-muted)] mt-1">
                        {isAdmin ? 'Manage and create custom reports' : 'View available reports'}
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="relative w-64">
                        <Icon name="search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40 text-[var(--text-main)]" />
                        <input
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Search reports..."
                            className="w-full bg-[var(--bg-app)] border border-[var(--border-base)] rounded-xl pl-9 pr-4 py-2 text-sm text-[var(--text-main)] outline-none focus:border-brand transition-all"
                        />
                    </div>
                    {isAdmin && (
                        <button
                            onClick={onCreate}
                            className="flex items-center gap-2 px-4 py-2 bg-brand text-white rounded-xl shadow-lg shadow-brand/20 hover:brightness-110 active:scale-95 transition-all font-bold text-sm"
                        >
                            <Icon name="add" size={18} />
                            Add Report
                        </button>
                    )}
                </div>
            </div>

            <div className="bg-surface-800 rounded-3xl border border-[var(--border-base)] overflow-hidden shadow-2xl">
                <table className="w-full text-left border-collapse">
                    <thead>
                        {table.getHeaderGroups().map(headerGroup => (
                            <tr key={headerGroup.id} className="border-b border-[var(--border-base)] bg-[var(--border-muted)]/30">
                                {headerGroup.headers.map(header => (
                                    <th key={header.id} className="px-6 py-4 text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider opacity-60">
                                        {flexRender(header.column.columnDef.header, header.getContext())}
                                    </th>
                                ))}
                            </tr>
                        ))}
                    </thead>
                    <tbody className="divide-y divide-[var(--border-base)]">
                        {searchQuery.trim() ? (
                            table.getRowModel().rows.map(row => (
                                <ReportListItem key={row.original.id} row={row} onClick={() => onView(row.original)} />
                            ))
                        ) : (
                            reportTree && (
                                <CategoryRows
                                    name="Uncategorized"
                                    node={reportTree}
                                    path=""
                                    level={-1}
                                    expandedCategories={expandedCategories}
                                    onToggle={toggleCategory}
                                    onView={onView}
                                    onEdit={onEdit}
                                    onDelete={onDelete}
                                    isAdmin={isAdmin}
                                />
                            )
                        )}
                        {filteredReports.length === 0 && (
                            <tr>
                                <td colSpan={3} className="px-6 py-12 text-center text-[var(--text-muted)] opacity-50 italic">
                                    No reports found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

const ReportListItem = ({ row, onClick, level = 0 }: { row: any, onClick: () => void, level?: number }) => (
    <tr
        onClick={onClick}
        className="group hover:bg-[var(--border-muted)]/50 transition-colors cursor-pointer"
    >
        {row.getVisibleCells().map((cell: any, index: number) => (
            <td
                key={cell.id}
                className="px-6 py-4"
                style={index === 0 ? { paddingLeft: `${1.5 + level * 1.5}rem` } : {}}
            >
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
            </td>
        ))}
    </tr>
);

interface CategoryRowsProps {
    name: string;
    node: CategoryTreeNode<Report>;
    path: string;
    level: number;
    expandedCategories: Set<string>;
    onToggle: (path: string) => void;
    onView: (report: Report) => void;
    onEdit: (report: Report) => void;
    onDelete: (report: Report) => void;
    isAdmin: boolean;
}

const CategoryRows: React.FC<CategoryRowsProps> = ({
    name,
    node,
    path,
    level,
    expandedCategories,
    onToggle,
    onView,
    onEdit,
    onDelete,
    isAdmin
}) => {
    const isRoot = name === "Uncategorized";
    const isExpanded = name === "Uncategorized" || expandedCategories.has(path);

    if (isRoot) {
        return (
            <>
                {Object.entries(node.children).map(([childKey, childNode]) => (
                    <CategoryRows
                        key={childKey}
                        name={childNode.name}
                        node={childNode}
                        path={childKey}
                        level={0}
                        expandedCategories={expandedCategories}
                        onToggle={onToggle}
                        onView={onView}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        isAdmin={isAdmin}
                    />
                ))}
                {node.nodes.length > 0 && (
                    <tr className="bg-[var(--border-muted)]/10">
                        <td colSpan={3} className="px-6 py-1.5 opacity-40">
                            <div className="flex items-center gap-2">
                                <Icon name="folder_open" size={14} />
                                <span className="text-[10px] font-bold uppercase tracking-widest">Uncategorized</span>
                            </div>
                        </td>
                    </tr>
                )}
                {node.nodes.map(report => (
                    <ReportListItemRow
                        key={report.id}
                        report={report}
                        onView={onView}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        isAdmin={isAdmin}
                        level={0}
                    />
                ))}
            </>
        );
    }

    return (
        <>
            <tr
                className="bg-[var(--border-muted)]/20 hover:bg-[var(--border-muted)]/40 cursor-pointer transition-colors border-l-2 border-brand/30"
                onClick={() => onToggle(path)}
            >
                <td colSpan={3} className="px-6 py-2" style={{ paddingLeft: `${1.5 + level * 1.5}rem` }}>
                    <div className="flex items-center gap-2">
                        <Icon
                            name={isExpanded ? 'keyboard_arrow_down' : 'keyboard_arrow_right'}
                            size={18}
                            className="text-gray-500 opacity-60"
                        />
                        <Icon name="folder" size={16} className="text-brand/70" />
                        <span className="text-xs font-bold text-[var(--text-main)] opacity-70 uppercase tracking-wider">{node.name}</span>
                    </div>
                </td>
            </tr>
            {isExpanded && (
                <>
                    {Object.entries(node.children).map(([childKey, childNode]) => (
                        <CategoryRows
                            key={childKey}
                            name={childNode.name}
                            node={childNode}
                            path={`${path}|${childKey}`}
                            level={level + 1}
                            expandedCategories={expandedCategories}
                            onToggle={onToggle}
                            onView={onView}
                            onEdit={onEdit}
                            onDelete={onDelete}
                            isAdmin={isAdmin}
                        />
                    ))}
                    {node.nodes.map(report => (
                        <ReportListItemRow
                            key={report.id}
                            report={report}
                            onView={onView}
                            onEdit={onEdit}
                            onDelete={onDelete}
                            isAdmin={isAdmin}
                            level={level + 1}
                        />
                    ))}
                </>
            )}
        </>
    );
};

const ReportListItemRow = ({ 
    report, 
    onView, 
    onEdit, 
    onDelete, 
    isAdmin, 
    level 
}: { 
    report: Report, 
    onView: (report: Report) => void, 
    onEdit: (report: Report) => void, 
    onDelete: (report: Report) => void, 
    isAdmin: boolean, 
    level: number 
}) => {
    return (
        <tr
            onClick={() => onView(report)}
            className="group hover:bg-[var(--border-muted)]/50 transition-colors cursor-pointer"
        >
            <td className="px-6 py-4" style={{ paddingLeft: `${1.5 + level * 1.5}rem` }}>
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center text-brand">
                        <Icon name="bar_chart" size={16} />
                    </div>
                    <div className="flex flex-col min-w-0">
                        <span className="font-bold text-[var(--text-main)] truncate">{report.name}</span>
                        <span className="text-[10px] text-[var(--text-muted)] opacity-60 truncate">{report.description || 'No description'}</span>
                    </div>
                </div>
            </td>
            <td className="px-6 py-4">
                <span className="text-[10px] uppercase font-black tracking-wider text-[var(--text-muted)] px-2 py-0.5 rounded-full bg-[var(--border-muted)]">
                    {report.type}
                </span>
            </td>
            <td className="px-6 py-4 text-right">
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
            </td>
        </tr>
    );
};
