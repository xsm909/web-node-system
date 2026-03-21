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
import type { AITask } from '../../../entities/ai-task/model/types';
import { ManagementTable } from '../../../shared/ui/management-table';
import { ConfirmModal } from '../../../shared/ui/confirm-modal';
import { AITaskEditModal } from './AITaskEditModal';

const columnHelper = createColumnHelper<AITask>();

interface AITaskManagementProps {
    activeClientId?: string | null;
    onToggleSidebar?: () => void;
    isSidebarOpen?: boolean;
}

export const AITaskManagement: React.FC<AITaskManagementProps> = ({ activeClientId, onToggleSidebar, isSidebarOpen }) => {
    const queryClient = useQueryClient();
    const { user } = useAuthStore();
    const isAdmin = user?.role === 'admin';

    const [selectedTask, setSelectedTask] = useState<AITask | null>(null);
    const [taskToDelete, setTaskToDelete] = useState<AITask | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const categoryFilter = isAdmin ? ['AI_Task', 'AI_question'] : 'AI_question';


    // Fetch all data types to map data_type_id to names for the table and pass to children
    const { data: dataTypes = [], isLoading: isDataTypesLoading } = useQuery({
        queryKey: ['data-types', 'all'],
        queryFn: async () => {
            const response = await apiClient.get<any[]>('/data-types/');
            return response.data;
        },
    });

    const { data: allTasks = [], isLoading, refetch } = useQuery({
        queryKey: ['ai-tasks'],
        queryFn: async () => {
            const response = await apiClient.get<AITask[]>('/ai-tasks/');
            return response.data;
        },
    });

    const tasks = useMemo(() => {
        if (isAdmin) {
            if (!activeClientId) return allTasks.filter(t => t.owner_id === 'AI_Task');
            return allTasks;
        }
        if (!activeClientId) return []; // If manager but no client selected, show nothing as per user request ("only tasks of current client")
        return allTasks.filter(t => t.owner_id === activeClientId);
    }, [allTasks, isAdmin, activeClientId]);

    const deleteMutation = useMutation({
        mutationFn: async (taskId: string) => {
            await apiClient.delete(`/ai-tasks/${taskId}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['ai-tasks'] });
        },
    });

    const columns = useMemo(() => {
        const cols = [];

        cols.push(
            columnHelper.accessor('data_type_id', {
                header: 'Category',
                cell: info => {
                    const dtId = info.getValue() as number;
                    const dt = dataTypes.find((d: any) => d.id === dtId);
                    const label = dt ? (dt.config?.Caption || dt.config?.caption || dt.type) : dtId;
                    return (
                        <span className="px-2 py-0.5 rounded-full bg-surface-700 border border-[var(--border-base)] text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] flex items-center gap-1.5">
                            {label}
                            {info.row.original.is_locked && (
                                <Icon name="lock" size={10} className="text-amber-500/60" />
                            )}
                        </span>
                    );
                },
            })
        );

        if (isAdmin) {
            cols.push(
                columnHelper.accessor('ai_model', {
                    header: 'Model',
                    cell: info => (
                        <span className="px-2 py-0.5 rounded-full bg-brand/10 border border-brand/20 text-[10px] font-bold uppercase tracking-widest text-brand">
                            {info.getValue()}
                        </span>
                    ),
                })
            );
        }

        if (isAdmin) {
            cols.push(
                columnHelper.accessor('description', {
                    header: 'Description',
                    cell: info => (
                        <div className="max-w-[200px] truncate text-sm text-[var(--text-main)]" title={info.getValue() || ''}>
                            {info.getValue() || <span className="text-[var(--text-muted)] italic opacity-40">No description</span>}
                        </div>
                    ),
                })
            );
        }

        if (!isAdmin) {
            cols.push(
                columnHelper.accessor('task', {
                    header: 'Task Content',
                    cell: info => {
                        const taskObj = info.getValue() as any;
                        let content = 'No content';

                        if (taskObj) {
                            if (taskObj.values && Array.isArray(taskObj.values)) {
                                content = taskObj.values.join(', ');
                            } else if (taskObj.value) {
                                content = taskObj.value;
                            } else if (taskObj.Task) {
                                content = taskObj.Task;
                            } else {
                                content = JSON.stringify(taskObj);
                            }
                        }

                        return (
                            <div className="max-w-xs truncate text-sm text-[var(--text-main)] opacity-80" title={content}>
                                {content}
                            </div>
                        );
                    },
                })
            );
        }

        cols.push(
            columnHelper.display({
                id: 'actions',
                header: '',
                cell: info => (
                    <div className="flex justify-end gap-2 pr-4">
                        {!info.row.original.is_locked && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setTaskToDelete(info.row.original);
                                }}
                                disabled={deleteMutation.isPending}
                                className="p-2 rounded-xl text-red-500/60 hover:text-red-500 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"
                            >
                                <Icon name="delete" size={18} />
                            </button>
                        )}
                    </div>
                ),
            })
        );

        return cols;
    }, [isAdmin, deleteMutation.isPending, dataTypes]);

    const table = useReactTable({
        data: tasks,
        columns,
        getCoreRowModel: getCoreRowModel(),
    });

    const handleRowClick = (task: AITask) => {
        setSelectedTask(task);
        setIsModalOpen(true);
    };

    return (
        <div className="flex flex-col h-full bg-[var(--bg-app)] overflow-hidden">
            <ManagementTable
                title="AI Tasks"
                description="Manage and edit automated AI routines"
                addButtonText="Create Task"
                onAdd={() => {
                    setSelectedTask(null);
                    setIsModalOpen(true);
                }}
                table={table}
                isLoading={isLoading || isDataTypesLoading}
                dataLength={tasks.length}
                onRowClick={handleRowClick}
                emptyMessage="No AI Tasks found for this view."
                onToggleSidebar={onToggleSidebar}
                isSidebarOpen={isSidebarOpen}
            />

            <AITaskEditModal
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    setSelectedTask(null);
                }}
                task={selectedTask}
                onSave={refetch}
                defaultOwnerId={activeClientId ?? (isAdmin ? 'AI_Task' : undefined)}
                categoryFilter={categoryFilter}
                dataTypes={dataTypes}
                isLocked={selectedTask?.is_locked}
            />

            <ConfirmModal
                isOpen={!!taskToDelete}
                title="Delete AI Task"
                description="Are you sure you want to delete this task? This action cannot be undone."
                confirmLabel="Delete"
                isLoading={deleteMutation.isPending}
                onConfirm={() => {
                    if (taskToDelete) {
                        deleteMutation.mutate(taskToDelete.id, {
                            onSuccess: () => setTaskToDelete(null)
                        });
                    }
                }}
                onCancel={() => setTaskToDelete(null)}
            />
        </div>
    );
};
