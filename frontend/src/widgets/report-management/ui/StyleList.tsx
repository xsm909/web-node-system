import { useMemo } from 'react';
import {
    createColumnHelper,
} from '@tanstack/react-table';
import type { ReportStyle } from '../../../entities/report/model/types';
import { Icon } from '../../../shared/ui/icon';
import { AppTable } from '../../../shared/ui/app-table';

const columnHelper = createColumnHelper<ReportStyle>();

interface StyleListProps {
    styles: ReportStyle[];
    isAdmin: boolean;
    onEdit: (style: ReportStyle) => void;
    onDelete: (style: ReportStyle) => void;
    searchQuery: string;
}

export function StyleList({ styles, isAdmin, onEdit, onDelete, searchQuery }: StyleListProps) {

    const columns = useMemo(() => [
        columnHelper.accessor('name', {
            header: 'Name',
            cell: info => {
                const style = info.row.original;
                return (
                    <div className="flex items-center gap-2">
                        <span className="text-[var(--text-main)] font-medium group-hover:text-brand transition-colors">
                            {info.getValue()}
                        </span>
                    </div>
                );
            },
        }),
        columnHelper.accessor('category', {
            header: 'Category',
            cell: info => info.getValue() || <span className="text-[var(--text-muted)] italic">Uncategorized</span>,
        }),
        columnHelper.display({
            id: 'actions',
            header: () => <div className="text-right">Actions</div>,
            cell: info => {
                const style = info.row.original;
                return (
                    <div className="flex gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        {isAdmin && (
                            <>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onDelete(style); }}
                                    className="p-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                                    title="Delete Style"
                                >
                                    <Icon name="delete" size={16} />
                                </button>
                            </>
                        )}
                    </div>
                );
            },
        }),
    ], [onEdit, onDelete]);

    const filteredStyles = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return styles;
        return styles.filter(s =>
            s.name.toLowerCase().includes(q) ||
            (s.category || '').toLowerCase().includes(q)
        );
    }, [styles, searchQuery]);

    return (
        <AppTable
            data={filteredStyles}
            columns={columns}
            isSearching={searchQuery.trim().length > 0}
            onRowClick={onEdit}
            config={{
                categoryExtractor: s => s.category,
                persistCategoryKey: 'report_style_expanded_categories',
                emptyMessage: 'No styles found.'
            }}
        />
    );
}
