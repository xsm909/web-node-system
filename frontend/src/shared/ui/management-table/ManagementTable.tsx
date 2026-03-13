import React from 'react';
import { flexRender, type Table } from '@tanstack/react-table';
import { Icon } from '../icon';
import { AppHeader } from '../../../widgets/app-header';

interface ManagementTableProps<TData> {
    title: string;
    description?: string;
    addButtonText: React.ReactNode;
    onAdd: () => void;
    table: Table<TData>;
    isLoading: boolean;
    dataLength: number;
    onRowClick: (row: TData) => void;
    emptyMessage?: string;
    onToggleSidebar?: () => void;
    isSidebarOpen?: boolean;
    searchQuery?: string;
    onSearchChange?: (query: string) => void;
}

export function ManagementTable<TData>({
    title,
    description,
    addButtonText,
    onAdd,
    table,
    isLoading,
    dataLength,
    onRowClick,
    emptyMessage = 'No data found for this view.',
    onToggleSidebar,
    isSidebarOpen,
    searchQuery,
    onSearchChange
}: ManagementTableProps<TData>) {
    return (
        <div className="flex flex-col h-full bg-[var(--bg-app)] overflow-hidden">
            <AppHeader
                onToggleSidebar={onToggleSidebar || (() => {})}
                isSidebarOpen={isSidebarOpen}
                leftContent={
                    <div className="flex flex-col">
                        <h1 className="text-lg lg:text-xl font-semibold tracking-tight text-[var(--text-main)] opacity-90 truncate px-2 lg:px-0">
                            {title}
                        </h1>
                    </div>
                }
                rightContent={
                    <button
                        onClick={onAdd}
                        className="flex items-center justify-center w-10 h-10 rounded-full bg-brand text-white hover:brightness-110 transition-all shadow-lg shadow-brand/20 active:scale-95 shrink-0"
                        title={typeof addButtonText === 'string' ? addButtonText : 'Add'}
                    >
                        <Icon name="add" size={20} />
                    </button>
                }
                searchQuery={searchQuery}
                onSearchChange={onSearchChange}
                searchPlaceholder={description || `Search ${title}...`}
            />

            <div className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 z-10 bg-surface-800 shadow-sm border-b border-[var(--border-base)]">
                            {table.getHeaderGroups().map(headerGroup => (
                                <tr key={headerGroup.id} className="bg-[var(--border-muted)]/30">
                                    {headerGroup.headers.map(header => (
                                        <th key={header.id} className="px-6 py-4 text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider opacity-60">
                                            {header.isPlaceholder
                                                ? null
                                                : flexRender(header.column.columnDef.header, header.getContext())}
                                        </th>
                                    ))}
                                </tr>
                            ))}
                        </thead>
                        <tbody className="divide-y divide-[var(--border-base)]">
                            {isLoading && dataLength === 0 ? (
                                <tr>
                                    <td colSpan={100} className="px-6 py-12 text-center text-[var(--text-muted)]">
                                        <div className="flex justify-center flex-col items-center gap-4">
                                            <div className="w-8 h-8 rounded-full border-2 border-[var(--border-base)] border-t-brand animate-spin" />
                                            <span className="text-sm font-medium">Loading data...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : dataLength === 0 ? (
                                <tr>
                                    <td colSpan={100} className="px-6 py-12 text-center text-[var(--text-muted)] italic opacity-50">
                                        {emptyMessage}
                                    </td>
                                </tr>
                            ) : (
                                table.getRowModel().rows.map(row => (
                                    <tr
                                        key={row.id}
                                        className="hover:bg-[var(--border-muted)]/10 transition-colors group cursor-pointer"
                                        onClick={() => onRowClick(row.original)}
                                    >
                                        {row.getVisibleCells().map(cell => (
                                            <td key={cell.id} className="px-6 py-4">
                                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
