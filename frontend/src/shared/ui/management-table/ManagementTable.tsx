import React from 'react';
import { flexRender, type Table } from '@tanstack/react-table';
import { Icon } from '../icon';

interface ManagementTableProps<TData> {
    title: React.ReactNode;
    description: React.ReactNode;
    addButtonText: React.ReactNode;
    onAdd: () => void;
    table: Table<TData>;
    isLoading: boolean;
    dataLength: number;
    onRowClick: (row: TData) => void;
    emptyMessage?: string;
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
}: ManagementTableProps<TData>) {
    if (isLoading && dataLength === 0) {
        return (
            <div className="flex justify-center items-center h-64 bg-surface-800 rounded-3xl border border-[var(--border-base)] shadow-2xl">
                <div className="w-8 h-8 rounded-full border-2 border-[var(--border-base)] border-t-brand animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-[var(--text-main)] tracking-tight">{title}</h2>
                    <p className="text-[10px] text-[var(--text-muted)] font-black uppercase tracking-widest opacity-60">
                        {description}
                    </p>
                </div>
                <button
                    onClick={onAdd}
                    className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-brand text-white text-[10px] font-black uppercase tracking-widest shadow-xl shadow-brand/20 hover:brightness-110 active:scale-95 transition-all"
                >
                    <Icon name="add" size={16} />
                    {addButtonText}
                </button>
            </div>

            <div className="bg-surface-800 rounded-3xl border border-[var(--border-base)] overflow-hidden shadow-2xl ring-1 ring-black/5 dark:ring-white/5">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            {table.getHeaderGroups().map(headerGroup => (
                                <tr key={headerGroup.id} className="border-b border-[var(--border-base)] bg-[var(--border-muted)]/30">
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
                            {table.getRowModel().rows.map(row => (
                                <tr
                                    key={row.id}
                                    className="hover:bg-[var(--border-muted)]/50 transition-colors group cursor-pointer"
                                    onClick={() => onRowClick(row.original)}
                                >
                                    {row.getVisibleCells().map(cell => (
                                        <td key={cell.id} className="px-6 py-4">
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {dataLength === 0 && (
                    <div className="p-16 text-center text-[var(--text-muted)] text-sm opacity-40 font-medium italic">
                        {emptyMessage}
                    </div>
                )}
            </div>
        </div>
    );
}
