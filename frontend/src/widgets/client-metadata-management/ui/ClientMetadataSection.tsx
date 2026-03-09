import React, { useState, useMemo } from 'react';
import {
    useReactTable,
    getCoreRowModel,
    createColumnHelper,
    flexRender,
} from '@tanstack/react-table';
import { useEntityMetadata } from '../../../entities/record/api';
import { useAuthStore } from '../../../features/auth/store';
import { Icon } from '../../../shared/ui/icon';
import { ClientMetadataEditModal } from './ClientMetadataEditModal';

const columnHelper = createColumnHelper<any>();

// Small utility: render a brief human-readable preview of record data
function DataPreview({ data }: { data: any }) {
    if (!data || typeof data !== 'object') {
        return <span className="text-[var(--text-muted)] italic opacity-50 text-xs">Empty</span>;
    }

    const entries = Object.entries(data).slice(0, 3);
    if (entries.length === 0) {
        return <span className="text-[var(--text-muted)] italic opacity-50 text-xs">No data</span>;
    }

    return (
        <div className="flex flex-wrap gap-1.5">
            {entries.map(([key, value]) => (
                <span
                    key={key}
                    className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-surface-700 border border-[var(--border-base)] text-[var(--text-muted)]"
                >
                    <span className="opacity-60">{key}:</span>
                    <span className="font-mono text-[var(--text-main)] opacity-80 truncate max-w-[80px]">
                        {typeof value === 'object' ? JSON.stringify(value) : String(value ?? '')}
                    </span>
                </span>
            ))}
            {Object.keys(data).length > 3 && (
                <span className="text-[10px] text-[var(--text-muted)] opacity-50 italic self-center">
                    +{Object.keys(data).length - 3} more
                </span>
            )}
        </div>
    );
}

export const ClientMetadataSection: React.FC = () => {
    const { user } = useAuthStore();
    const entityId = user?.id;

    const [selectedAssignment, setSelectedAssignment] = useState<any | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    const { data: assignments = [], isLoading } = useEntityMetadata('client', entityId);

    const columns = useMemo(() => [
        columnHelper.accessor((row: any) => row.record?.schema, {
            id: 'schema',
            header: 'Schema',
            cell: (info) => {
                const schema = info.getValue();
                const title = schema?.content?.title || schema?.key || 'Unknown';
                const isSystem = schema?.is_system;
                return (
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-surface-700 text-brand group-hover:bg-brand group-hover:text-white transition-colors shrink-0">
                            <Icon name="data_object" size={16} />
                        </div>
                        <div className="flex flex-col min-w-0">
                            <span className="text-sm font-bold text-[var(--text-main)] group-hover:text-brand transition-colors truncate">
                                {title}
                            </span>
                            {isSystem && (
                                <span className="text-[9px] font-black text-blue-400 uppercase tracking-tighter opacity-60">
                                    System
                                </span>
                            )}
                        </div>
                    </div>
                );
            },
        }),
        columnHelper.accessor((row: any) => row.record?.data, {
            id: 'preview',
            header: 'Data Preview',
            cell: (info) => <DataPreview data={info.getValue()} />,
        }),
        columnHelper.accessor((row: any) => row.record?.updated_at, {
            id: 'updated',
            header: 'Updated',
            cell: (info) => {
                const val = info.getValue();
                if (!val) return <span className="text-xs text-gray-600">—</span>;
                return (
                    <span className="text-xs text-gray-500">
                        {new Date(val).toLocaleString()}
                    </span>
                );
            },
        }),
        columnHelper.display({
            id: 'action',
            header: '',
            cell: () => (
                <div className="flex justify-end pr-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-[10px] font-bold text-brand uppercase tracking-widest flex items-center gap-1">
                        Edit <Icon name="arrow_forward" size={12} />
                    </span>
                </div>
            ),
        }),
    ], []);

    const table = useReactTable({
        data: assignments,
        columns,
        getCoreRowModel: getCoreRowModel(),
    });

    const handleRowClick = (assignment: any) => {
        if (!assignment.record?.schema) return;
        setSelectedAssignment(assignment);
        setIsEditModalOpen(true);
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-40 bg-surface-800 rounded-2xl border border-gray-700/50">
                <div className="w-8 h-8 rounded-full border-2 border-gray-700 border-t-brand animate-spin" />
            </div>
        );
    }

    return (
        <>
            <div className="bg-surface-800 rounded-2xl border border-gray-700/50 overflow-hidden shadow-xl shadow-black/10">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-gray-700 bg-surface-900/50">
                            <th className="px-6 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                                Schema
                            </th>
                            <th className="px-6 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                                Data Preview
                            </th>
                            <th className="px-6 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                                Updated
                            </th>
                            <th className="px-6 py-4" />
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700/50">
                        {table.getRowModel().rows.map((row) => (
                            <tr
                                key={row.id}
                                onClick={() => handleRowClick(row.original)}
                                className="group hover:bg-brand/5 transition-colors cursor-pointer"
                            >
                                {row.getVisibleCells().map((cell) => (
                                    <td key={cell.id} className="px-6 py-4">
                                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                    </td>
                                ))}
                            </tr>
                        ))}
                        {assignments.length === 0 && (
                            <tr>
                                <td colSpan={4} className="px-6 py-16 text-center text-gray-500 italic text-sm">
                                    No metadata schemas assigned to your account yet.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {selectedAssignment && (
                <ClientMetadataEditModal
                    isOpen={isEditModalOpen}
                    onClose={() => {
                        setIsEditModalOpen(false);
                        setSelectedAssignment(null);
                    }}
                    assignment={selectedAssignment}
                />
            )}
        </>
    );
};
