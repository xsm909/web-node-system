import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Icon } from '../../../shared/ui/icon';
import { useAuthStore } from '../../../features/auth/store';
import { createColumnHelper } from '@tanstack/react-table';
import { apiClient } from '../../../shared/api/client';
import type { AITask } from '../../../entities/ai-task/model/types';
import { AppHeader } from '../../app-header';
import { AppTable } from '../../../shared/ui/app-table';
import { AppTableStandardCell } from '../../../shared/ui/app-table/components/AppTableStandardCell';
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

        // Primary Column (Description for Admin, Task Content for Manager)
        cols.push(
            columnHelper.display({
                id: 'primary',
                header: isAdmin ? 'Description' : 'Task Content',
                cell: info => {
                    const task = info.row.original;
                    let label = '';
                    let subtitle = undefined;

                    if (isAdmin) {
                        label = task.description || 'No description';
                        // Maybe show model as subtitle for admin
                        subtitle = task.ai_model;
                    } else {
                        const taskObj = task.task as any;
                        if (taskObj) {
                            if (taskObj.values && Array.isArray(taskObj.values)) {
                                label = taskObj.values.join(', ');
                            } else if (taskObj.value) {
                                label = taskObj.value;
                            } else if (taskObj.Task) {
                                label = taskObj.Task;
                            } else {
                                label = JSON.stringify(taskObj);
                            }
                        } else {
                            label = 'No content';
                        }
                    }

                    return (
                        <AppTableStandardCell
                            icon="psychology"
                            label={label}
                            subtitle={subtitle}
                            isLocked={task.is_locked}
                        />
                    );
                }
            })
        );

        // Metadata: Category
        cols.push(
            columnHelper.accessor('data_type_id', {
                header: 'Category',
                cell: (info: any) => {
                    const dtId = info.getValue() as number;
                    const dt = dataTypes.find((d: any) => d.id === dtId);
                    const label = dt ? (dt.config?.Caption || dt.config?.caption || dt.type) : dtId;
                    return (
                        <span className="px-2 py-0.5 rounded-full bg-surface-700 border border-[var(--border-base)] text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] flex items-center gap-1.5">
                            {label}
                        </span>
                    );
                },
            })
        );

        // Actions
        cols.push(
            columnHelper.display({
                id: 'actions',
                header: '',
                cell: (info: any) => (
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

    const handleRowClick = (task: AITask) => {
        setSelectedTask(task);
        setIsModalOpen(true);
    };

    return (
        <div className="flex flex-col h-full bg-[var(--bg-app)] overflow-hidden">
            <AppHeader
                onToggleSidebar={onToggleSidebar || (() => { })}
                isSidebarOpen={isSidebarOpen}
                leftContent={
                    <div className="flex flex-col">
                        <h1 className="text-lg lg:text-xl font-semibold tracking-tight text-[var(--text-main)] opacity-90 truncate px-2 lg:px-0">
                            AI Tasks
                        </h1>
                    </div>
                }
                rightContent={
                    <button
                        onClick={() => {
                            setSelectedTask(null);
                            setIsModalOpen(true);
                        }}
                        className="flex items-center justify-center w-10 h-10 rounded-full bg-brand text-white hover:brightness-110 transition-all shadow-lg shadow-brand/20 active:scale-95 shrink-0"
                        title="Create Task"
                    >
                        <Icon name="add" size={20} />
                    </button>
                }
                searchQuery={""} // Placeholder if we want search later
                onSearchChange={() => {}}
                searchPlaceholder="Manage and edit automated AI routines"
            />

            <AppTable
                data={tasks}
                columns={columns}
                isLoading={isLoading || isDataTypesLoading}
                onRowClick={handleRowClick}
                config={{
                    emptyMessage: 'No AI Tasks found for this view.'
                }}
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
