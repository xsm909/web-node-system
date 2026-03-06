import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Icon } from '../../../shared/ui/icon';
import { useAuthStore } from '../../../features/auth/store';
import {
    useReactTable,
    getCoreRowModel,
    createColumnHelper,
} from '@tanstack/react-table';
import { apiClient } from '../../../shared/api/client';
import type { ClientMetadata } from '../../../entities/client-metadata/model/types';
import { ClientMetadataEditModal } from './ClientMetadataEditModal';

const columnHelper = createColumnHelper<ClientMetadata>();

interface ClientMetadataManagementProps {
    activeClientId?: string | null;
}

import { ManagementTable } from '../../../shared/ui/management-table';

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
                            content = md.values.join(', ');
                        } else if (md.value) {
                            content = md.value;
                        } else {
                            content = JSON.stringify(md);
                        }
                    }

                    const displayContent = content.length > 100 ? content.slice(0, 100) + '...' : content;

                    return (
                        <div className="max-w-xs truncate text-sm text-[var(--text-main)] opacity-80" title={content}>
                            {displayContent}
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

    return (
        <div className="space-y-6">
            <ManagementTable
                title="Client Metadata"
                description="Manage and edit specialized metadata for clients"
                addButtonText="New Metadata"
                onAdd={() => {
                    setSelectedMetadata(null);
                    setIsModalOpen(true);
                }}
                table={table}
                isLoading={isLoading || isDataTypesLoading}
                dataLength={metadataList.length}
                onRowClick={handleRowClick}
                emptyMessage="No Client Metadata found for this view."
            />

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
