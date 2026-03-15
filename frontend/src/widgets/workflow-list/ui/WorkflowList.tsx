import React, { useMemo } from 'react';
import type { Workflow } from '../../../entities/workflow/model/types';
import { useAuthStore } from '../../../features/auth/store';
import { AppTable } from '../../../shared/ui/app-table';
import { createColumnHelper } from '@tanstack/react-table';
import { Icon } from '../../../shared/ui/icon';
import { AppHeader } from '../../app-header';
import { ConfirmModal } from '../../../shared/ui/confirm-modal';

interface WorkflowListProps {
    workflows: Workflow[];
    isSidebarOpen: boolean;
    onToggleSidebar: () => void;
    onSelectWorkflow: (wf: Workflow) => void;
    onCreateWorkflow: (name: string) => void;
    onDeleteWorkflow: (wf: Workflow) => void;
    onRenameWorkflow: (wf: Workflow) => void;
    onDuplicateWorkflow: (wf: Workflow) => void;
}

const columnHelper = createColumnHelper<Workflow & { categoryLabel: string }>();

export const WorkflowList: React.FC<WorkflowListProps> = ({
    workflows,
    isSidebarOpen,
    onToggleSidebar,
    onSelectWorkflow,
    onCreateWorkflow,
    onDeleteWorkflow,
    onRenameWorkflow,
    onDuplicateWorkflow,
}) => {
    const { user: currentUser } = useAuthStore();
    const isAdmin = currentUser?.role === 'admin';

    const [searchQuery, setSearchQuery] = React.useState('');
    const [createModalOpen, setCreateModalOpen] = React.useState<boolean>(false);
    const [createInputValue, setCreateInputValue] = React.useState('');

    const flattenedWorkflows = useMemo((): Array<Workflow & { categoryLabel: string }> => {
        return workflows.map(wf => ({
            ...wf,
            categoryLabel: (wf.category || 'general').toUpperCase()
        }));
    }, [workflows]);

    const filteredWorkflows = useMemo(() => {
        const q = searchQuery.toLowerCase().trim();
        if (!q) return flattenedWorkflows;
        return flattenedWorkflows.filter(wf => wf.name.toLowerCase().includes(q));
    }, [flattenedWorkflows, searchQuery]);


    const columns = useMemo(() => [
        columnHelper.accessor('name', {
            header: 'Workflow Name',
            cell: info => (
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-surface-700 text-brand">
                        <Icon name="device_hub" size={18} />
                    </div>
                    <span className="font-semibold text-[var(--text-main)] group-hover:text-brand transition-colors">
                        {info.getValue()}
                    </span>
                </div>
            )
        }),
        columnHelper.accessor('id', {
            header: 'ID',
            cell: info => <span className="text-xs font-mono opacity-50">{info.getValue().substring(0, 8)}...</span>
        }),
        columnHelper.display({
            id: 'actions',
            header: () => <div className="text-right">Actions</div>,
            cell: info => {
                const wf = info.row.original;
                const isOwner = currentUser?.id && wf.owner_id === currentUser.id;
                const canEditDelete = isAdmin || isOwner;
                if (!canEditDelete) return null;

                return (
                    <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                            onClick={(e) => { e.stopPropagation(); onRenameWorkflow(wf); }}
                            className="p-2 rounded-lg bg-surface-700 hover:bg-surface-600 transition-colors text-gray-400 hover:text-brand"
                            title="Rename"
                        >
                            <Icon name="drive_file_rename_outline" size={16} />
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); onDuplicateWorkflow(wf); }}
                            className="p-2 rounded-lg bg-surface-700 hover:bg-surface-600 transition-colors text-gray-400 hover:text-brand"
                            title="Duplicate"
                        >
                            <Icon name="content_copy" size={16} />
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); onDeleteWorkflow(wf); }}
                            className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 transition-colors text-red-400"
                            title="Delete"
                        >
                            <Icon name="delete" size={16} />
                        </button>
                    </div>
                );
            }
        })
    ], [isAdmin, currentUser?.id, onRenameWorkflow, onDuplicateWorkflow, onDeleteWorkflow]);

    return (
        <div className="flex flex-col h-full bg-[var(--bg-app)] overflow-hidden">
            <AppHeader
                onToggleSidebar={onToggleSidebar}
                isSidebarOpen={isSidebarOpen}
                leftContent={
                    <h1 className="text-lg lg:text-xl font-semibold tracking-tight text-[var(--text-main)] opacity-90 truncate px-2 lg:px-0">
                        Workflows
                    </h1>
                }
                rightContent={
                    <button
                        className="flex items-center justify-center w-10 h-10 rounded-full bg-brand text-white hover:brightness-110 transition-all shadow-lg shadow-brand/20 active:scale-95 shrink-0"
                        onClick={() => {
                            setCreateModalOpen(true);
                            setCreateInputValue('');
                        }}
                        title="New Workflow"
                    >
                        <Icon name="add" size={20} />
                    </button>
                }
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                searchPlaceholder="Search workflows..."
            />

            <AppTable
                data={filteredWorkflows}
                columns={columns}
                config={{
                    categoryExtractor: wf => wf.categoryLabel,
                    persistCategoryKey: 'workflow_expanded_categories',
                    emptyMessage: 'No workflows found.',
                }}
                onRowClick={(wf) => onSelectWorkflow(wf)}
                isSearching={searchQuery.trim().length > 0}
            />

            <ConfirmModal
                isOpen={createModalOpen}
                title="New Workflow"
                description="Enter a name for the new workflow."
                confirmLabel="Create"
                variant="success"
                onConfirm={() => {
                    if (createInputValue.trim()) {
                        onCreateWorkflow(createInputValue);
                    }
                    setCreateModalOpen(false);
                }}
                onCancel={() => setCreateModalOpen(false)}
            >
                <input
                    autoFocus
                    className="w-full px-4 py-3 rounded-xl bg-[var(--bg-app)] border border-[var(--border-base)] text-sm text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-all font-medium"
                    placeholder="Workflow name"
                    value={createInputValue}
                    onChange={(e) => setCreateInputValue(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && createInputValue.trim()) {
                            onCreateWorkflow(createInputValue);
                            setCreateModalOpen(false);
                        }
                    }}
                />
            </ConfirmModal>
        </div>
    );
};
