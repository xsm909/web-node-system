import { useMemo, useState } from 'react';
import {
    useReactTable,
    getCoreRowModel,
    flexRender,
} from '@tanstack/react-table';
import { AppTableHeader } from './components/AppTableHeader';
import { AppTableDataRow } from './components/AppTableDataRow';
import { AppTableCategoryRows, type TWithCategory } from './components/AppTableCategoryRows';
import { buildCategoryTree } from '../../lib/categoryUtils';
import { getCookie, setCookie } from '../../lib/cookieUtils';
import type { AppTableProps } from './types';

export function AppTable<TData>({
    data,
    columns,
    config,
    isLoading,
    onRowClick,
    searchQuery,
    onSearchChange,
    isSearching
}: AppTableProps<TData>) {
    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
    });

    const persistKey = config.persistCategoryKey || 'app_table_expanded_categories';

    // Persistence for expanded categories
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(() => {
        const saved = getCookie(persistKey);
        if (saved) return new Set(JSON.parse(saved));
        return new Set();
    });

    const toggleCategory = (path: string) => {
        setExpandedCategories(prev => {
            const next = new Set(prev);
            if (next.has(path)) next.delete(path);
            else next.add(path);
            setCookie(persistKey, JSON.stringify(Array.from(next)));
            return next;
        });
    };

    const treeData = useMemo(() => {
        if (isSearching || !config.categoryExtractor) return null;
        
        const rows = table.getRowModel().rows;
        const mapped: TWithCategory<TData>[] = rows.map(row => ({
            original: row.original,
            row,
            category: config.categoryExtractor!(row.original) || null
        }));

        return buildCategoryTree(mapped);
    }, [table.getRowModel().rows, isSearching, config.categoryExtractor]);

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <AppTableHeader
                config={config}
                searchQuery={searchQuery}
                onSearchChange={onSearchChange}
            />

            <div className="bg-surface-800 rounded-2xl border border-[var(--border-base)] overflow-hidden shadow-xl shadow-black/10">
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
                        {isLoading && data.length === 0 ? (
                            <tr>
                                <td colSpan={columns.length} className="px-6 py-12 text-center text-[var(--text-muted)]">
                                    <div className="flex justify-center flex-col items-center gap-4">
                                        <div className="w-8 h-8 rounded-full border-2 border-[var(--border-base)] border-t-brand animate-spin" />
                                        <span className="text-sm font-medium">Loading data...</span>
                                    </div>
                                </td>
                            </tr>
                        ) : data.length === 0 ? (
                            <tr>
                                <td colSpan={columns.length} className="px-6 py-12 text-center text-[var(--text-muted)] italic opacity-50">
                                    {config.emptyMessage || "No matches found."}
                                </td>
                            </tr>
                        ) : treeData ? (
                            <AppTableCategoryRows
                                name="Uncategorized"
                                node={treeData}
                                path=""
                                level={-1}
                                expandedCategories={expandedCategories}
                                onToggle={toggleCategory}
                                onRowClick={onRowClick}
                                config={config}
                                colSpan={columns.length}
                            />
                        ) : (
                            table.getRowModel().rows.map(row => (
                                <AppTableDataRow
                                    key={row.id}
                                    row={row}
                                    onClick={onRowClick}
                                    config={config}
                                />
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
