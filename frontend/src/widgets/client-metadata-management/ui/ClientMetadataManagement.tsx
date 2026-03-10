import React, { useState, useMemo } from 'react';
import { Icon } from '../../../shared/ui/icon';
import { useAuthStore } from '../../../features/auth/store';
import {
    useReactTable,
    getCoreRowModel,
    createColumnHelper,
} from '@tanstack/react-table';
import { useEntityMetadata, useUnassignMetadata } from '../../../entities/record/api';
import { ClientMetadataEditModal } from './ClientMetadataEditModal';
import { AssignSchemaModal } from './AssignSchemaModal';
import { ManagementTable } from '../../../shared/ui/management-table';
import { ConfirmModal } from '../../../shared/ui/confirm-modal';

const columnHelper = createColumnHelper<any>();

interface ClientMetadataManagementProps {
    activeClientId?: string | null;
}

export const ClientMetadataManagement: React.FC<ClientMetadataManagementProps> = ({ activeClientId }) => {
    const { user } = useAuthStore();
    const isAdmin = user?.role === 'admin';

    const [selectedAssignment, setSelectedAssignment] = useState<any | null>(null);
    const [assignmentToDelete, setAssignmentToDelete] = useState<any | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);

    const unassignMutation = useUnassignMetadata();

    // Fetch assignments for this specific client
    const { data: assignments = [], isLoading } = useEntityMetadata('client', activeClientId || undefined);

    const columns = useMemo(() => {
        const cols = [];

        cols.push(
            columnHelper.accessor((row: any) => row.record?.schema?.key || 'Unknown', {
                id: 'schema_key',
                header: 'Schema',
                cell: info => {
                    return (
                        <span className="px-2 py-0.5 rounded-full bg-surface-700 border border-[var(--border-base)] text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                            {info.getValue()}
                        </span>
                    );
                },
            })
        );

        cols.push(
            columnHelper.accessor((row: any) => row.record?.data, {
                id: 'data',
                header: 'Record Data',
                cell: info => {
                    const data = info.getValue();
                    let content = 'No content';
                    if (data) {
                        content = JSON.stringify(data);
                    }

                    const displayContent = content.length > 100 ? content.slice(0, 100) + '...' : content;

                    return (
                        <div className="max-w-xs truncate text-sm text-[var(--text-main)] opacity-80 font-mono" title={content}>
                            {displayContent}
                        </div>
                    );
                },
            })
        );

        if (isAdmin) {
            cols.push(
                columnHelper.display({
                    id: 'actions',
                    header: '',
                    cell: info => (
                        <div className="flex justify-end gap-2 pr-4">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setAssignmentToDelete(info.row.original);
                                }}
                                disabled={unassignMutation.isPending}
                                className="p-2 rounded-xl text-red-500/60 hover:text-red-500 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100 disabled:opacity-50"
                            >
                                <Icon name="delete" size={18} />
                            </button>
                        </div>
                    ),
                })
            );
        }

        return cols;
    }, [isAdmin, unassignMutation]);

    const table = useReactTable({
        data: assignments,
        columns,
        getCoreRowModel: getCoreRowModel(),
    });

    const handleRowClick = (assignment: any) => {
        if (!assignment.record?.schema) return; // Cannot edit without schema
        setSelectedAssignment(assignment);
        setIsEditModalOpen(true);
    };

    return (
        <div className="space-y-6">
            <ManagementTable
                title="Client Metadata"
                description="Manage semantic datasets attached to this client."
                addButtonText={isAdmin && activeClientId ? "Assign Schema" : undefined}
                onAdd={() => {
                    if (isAdmin && activeClientId) {
                        setIsAssignModalOpen(true);
                    }
                }}
                table={table}
                isLoading={isLoading}
                dataLength={assignments.length}
                onRowClick={handleRowClick}
                emptyMessage="No Schemas assigned to this client yet."
            />

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

            {activeClientId && isAdmin && (
                <AssignSchemaModal
                    isOpen={isAssignModalOpen}
                    onClose={() => setIsAssignModalOpen(false)}
                    activeClientId={activeClientId}
                />
            )}

            <ConfirmModal
                isOpen={!!assignmentToDelete}
                title="Remove Schema"
                description={`Are you sure you want to remove the '${assignmentToDelete?.record?.schema?.key}' schema from this client?`}
                confirmLabel="Remove"
                isLoading={unassignMutation.isPending}
                onConfirm={() => {
                    if (assignmentToDelete) {
                        unassignMutation.mutate(
                            { assignmentId: assignmentToDelete.id },
                            {
                                onSuccess: () => {
                                    setAssignmentToDelete(null);
                                }
                            }
                        );
                    }
                }}
                onCancel={() => setAssignmentToDelete(null)}
            />
        </div>
    );
};
