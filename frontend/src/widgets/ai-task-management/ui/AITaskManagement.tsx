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
import type { AITask } from '../../../entities/ai-task/model/types';
import { AITaskEditModal } from './AITaskEditModal';

const columnHelper = createColumnHelper<AITask>();

interface AITaskManagementProps {
    activeClientId?: string | null;
}

export const AITaskManagement: React.FC<AITaskManagementProps> = ({ activeClientId }) => {
    const queryClient = useQueryClient();
    const { user } = useAuthStore();
    const isAdmin = user?.role === 'admin';

    const [selectedTask, setSelectedTask] = useState<AITask | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const { data: allTasks = [], isLoading, refetch } = useQuery({
        queryKey: ['ai-tasks'],
        queryFn: async () => {
            const response = await apiClient.get<AITask[]>('/ai-tasks/');
            return response.data;
        },
    });

    const tasks = useMemo(() => {
        if (isAdmin) return allTasks;
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

        if (isAdmin) {
            cols.push(
                columnHelper.accessor('owner_id', {
                    header: 'Owner',
                    cell: info => <span className="font-medium text-[var(--text-main)]">{info.getValue()}</span>,
                })
            );
        }

        cols.push(
            columnHelper.accessor('category', {
                header: 'Category',
                cell: info => (
                    <span className="px-2 py-0.5 rounded-full bg-surface-700 border border-[var(--border-base)] text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                        {info.getValue()}
                    </span>
                ),
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

        cols.push(
            columnHelper.accessor('task', {
                header: 'Task Content',
                cell: info => {
                    const taskObj = info.getValue();
                    const content = taskObj?.Task || 'No content';
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
                                if (confirm('Are you sure you want to delete this task?')) {
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
    }, [isAdmin, deleteMutation.isPending]);

    const table = useReactTable({
        data: tasks,
        columns,
        getCoreRowModel: getCoreRowModel(),
    });

    const handleRowClick = (task: AITask) => {
        setSelectedTask(task);
        setIsModalOpen(true);
    };

    if (isLoading && tasks.length === 0) {
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
                    <h2 className="text-xl font-bold text-[var(--text-main)] tracking-tight">AI Tasks</h2>
                    <p className="text-[10px] text-[var(--text-muted)] font-black uppercase tracking-widest opacity-60">
                        Manage and edit automated AI routines
                    </p>
                </div>
                <button
                    onClick={() => {
                        setSelectedTask(null);
                        setIsModalOpen(true);
                    }}
                    className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-brand text-white text-[10px] font-black uppercase tracking-widest shadow-xl shadow-brand/20 hover:brightness-110 active:scale-95 transition-all"
                >
                    <Icon name="add" size={16} />
                    Create Task
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
                {tasks.length === 0 && (
                    <div className="p-16 text-center text-[var(--text-muted)] text-sm opacity-40 font-medium italic">
                        No AI Tasks found for this view.
                    </div>
                )}
            </div>

            <AITaskEditModal
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    setSelectedTask(null);
                }}
                task={selectedTask}
                onSave={refetch}
                defaultOwnerId={activeClientId ?? undefined}
            />
        </div>
    );
};
