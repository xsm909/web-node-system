import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Icon } from '../../../shared/ui/icon';
import { useAuthStore } from '../../../features/auth/store';
import {
    useReactTable,
    getCoreRowModel,
    flexRender,
    createColumnHelper,
} from '@tanstack/react-table';
import { apiClient } from '../../../shared/api/client';
import type { ClientMetadata } from '../../../entities/client-metadata/model/types';
import { ClientMetadataEditModal } from './ClientMetadataEditModal';

const columnHelper = createColumnHelper<ClientMetadata>();

interface ClientMetadataManagementProps {
    activeClientId?: string | null;
}

export const ClientMetadataManagement: React.FC<ClientMetadataManagementProps> = ({ activeClientId }) => {
    const queryClient = useQueryClient();
    const { user } = useAuthStore();
    const isAdmin = user?.role === 'admin';

    const [selectedMetadata, setSelectedMetadata] = useState<ClientMetadata | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Fetch data types to map data_type_id to names
    const { data: dataTypes = [], isLoading: isDataTypesLoading } = useQuery({
        queryKey: ['data-types', 'client_metadata'],
        queryFn: async () => {
            const response = await apiClient.get<any[]>('/data-types/', { params: { category: 'client_metadata' } });
            return response.data;
        },
    });

    const { data: allMetadata = [], isLoading, refetch } = useQuery({
        queryKey: ['client-metadata'],
        queryFn: async () => {
            const response = await apiClient.get<ClientMetadata[]>('/client-metadata/');
            return response.data;
        },
    });

    const metadataList = useMemo(() => {
        if (isAdmin) return allMetadata;
        if (!activeClientId) return [];
        return allMetadata.filter(t => t.owner_id === activeClientId);
    }, [allMetadata, isAdmin, activeClientId]);

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            await apiClient.delete(`/client-metadata/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['client-metadata'] });
        },
    });

    const columns = useMemo(() => {
        const cols = [];

        if (isAdmin) {
            cols.push(
                columnHelper.accessor('owner_id', {
                    header: 'Owner',
                    cell: info => <span className="font-medium text-[var(--text-main)]">{info.getValue()}</span>,
                })
            );
        }

        cols.push(
            columnHelper.accessor('data_type_id', {
                header: 'Data Type',
                cell: info => {
                    const dtId = info.getValue() as number;
                    const dt = dataTypes.find((d: any) => d.id === dtId);
                    const label = dt ? (dt.config?.Caption || dt.config?.caption || dt.type) : dtId;
                    return (
                        <span className="px-2 py-0.5 rounded-full bg-surface-700 border border-[var(--border-base)] text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                            {label}
                        </span>
                    );
                },
            })
        );

        cols.push(
            columnHelper.accessor('meta_data', {
                header: 'Metadata Content',
                cell: info => {
                    const md = info.getValue() as any;
                    let content = 'No content';
                    if (md) {
                        if (md.values && Array.isArray(md.values)) {
                            content = `[${md.values.length} items] ` + md.values.join(', ');
                        } else if (md.value) {
                            content = md.value;
                        } else {
                            content = JSON.stringify(md);
                        }
                    }
                    return (
                        <div className="max-w-xs truncate text-sm text-[var(--text-main)] opacity-80" title={content}>
                            {content}
                        </div>
                    );
                },
            }),
            columnHelper.display({
                id: 'actions',
                header: '',
                cell: info => (
                    <div className="flex justify-end gap-2 pr-4">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                if (confirm('Are you sure you want to delete this metadata?')) {
                                    deleteMutation.mutate(info.row.original.id);
                                }
                            }}
                            disabled={deleteMutation.isPending}
                            className="p-2 rounded-xl text-red-500/60 hover:text-red-500 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"
                        >
                            <Icon name="delete" size={18} />
                        </button>
                    </div>
                ),
            })
        );

        return cols;
    }, [isAdmin, deleteMutation.isPending, dataTypes]);

    const table = useReactTable({
        data: metadataList,
        columns,
        getCoreRowModel: getCoreRowModel(),
    });

    const handleRowClick = (md: ClientMetadata) => {
        setSelectedMetadata(md);
        setIsModalOpen(true);
    };

    if ((isLoading || isDataTypesLoading) && metadataList.length === 0) {
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
                    <h2 className="text-xl font-bold text-[var(--text-main)] tracking-tight">Client Metadata</h2>
                    <p className="text-[10px] text-[var(--text-muted)] font-black uppercase tracking-widest opacity-60">
                        Manage and edit specialized metadata for clients
                    </p>
                </div>
                <button
                    onClick={() => {
                        setSelectedMetadata(null);
                        setIsModalOpen(true);
                    }}
                    className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-brand text-white text-[10px] font-black uppercase tracking-widest shadow-xl shadow-brand/20 hover:brightness-110 active:scale-95 transition-all"
                >
                    <Icon name="add" size={16} />
                    New Metadata
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
                                    onClick={() => handleRowClick(row.original)}
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
                {metadataList.length === 0 && (
                    <div className="p-16 text-center text-[var(--text-muted)] text-sm opacity-40 font-medium italic">
                        No Client Metadata found for this view.
                    </div>
                )}
            </div>

            <ClientMetadataEditModal
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    setSelectedMetadata(null);
                }}
                metadata={selectedMetadata}
                onSave={refetch}
                defaultOwnerId={activeClientId ?? undefined}
                dataTypes={dataTypes}
            />
        </div>
    );
};
