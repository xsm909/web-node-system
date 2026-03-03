import React, { useMemo } from 'react';
import type { Workflow } from '../../../entities/workflow/model/types';
import type { AssignedUser } from '../../../entities/user/model/types';
import { type SelectionGroup, type SelectionItem, type SelectionAction } from '../../../shared/ui/selection-list';
import { ComboBox } from '../../../shared/ui/combo-box';
import { Icon } from '../../../shared/ui/icon';
import { AppHeader } from '../../app-header';
import { useClientStore } from '../../../features/workflow-management/model/clientStore';
import { useAuthStore } from '../../../features/auth/store';

interface WorkflowHeaderProps {
    title: string;
    activeWorkflowId?: string;
    users: AssignedUser[];
    workflowsByOwner: Record<string, Workflow[]>;
    isRunning: boolean;
    isSidebarOpen: boolean;
    onSelect: (wf: Workflow) => void;
    onDelete: (wf: Workflow) => void;
    onRename: (wf: Workflow) => void;
    onCreate: (name: string, ownerId: string) => Promise<void>;
    onSave: () => void;
    onRun: () => void;
    onToggleSidebar: () => void;
    canAction: boolean;
    isCreating?: boolean;
    onOpenEditModal: () => void;
    showClientSelector?: boolean;
    canSave?: boolean;
}

export const WorkflowHeader: React.FC<WorkflowHeaderProps> = ({
    title,
    activeWorkflowId,
    users,
    workflowsByOwner,
    isRunning,
    isSidebarOpen,
    onSelect,
    onDelete,
    onRename,
    onCreate,
    onSave,
    onRun,
    onToggleSidebar,
    canAction,
    onOpenEditModal,
    showClientSelector,
    canSave = false,
}) => {
    const { activeClientId, assignedUsers, setActiveClientId } = useClientStore();
    const { user: currentUser } = useAuthStore();
    const isAdmin = currentUser?.role === 'admin';

    const selectionData = useMemo(() => {
        const data: Record<string, SelectionGroup> = {};

        // Helper to transform workflows
        const transformWorkflows = (ownerId: string, workflows: Workflow[]): SelectionItem[] =>
            workflows.map(wf => ({
                id: wf.id,
                name: wf.name,
                description: `ID: ${wf.id}`,
                parentId: ownerId
            }));

        // Common workflows - Always show for admins/managers
        // For non-admins: no add on group, no rename/delete on items
        data['Common Workflows'] = {
            id: 'common',
            name: 'Common Workflows',
            selectable: false,
            icon: 'group',
            items: transformWorkflows('common', workflowsByOwner['common'] || []),
            children: {},
            groupActions: isAdmin ? ['add'] : [],
            itemActions: isAdmin ? ['rename', 'delete'] : []
        };

        // Client workflows - ONLY if activeClientId is set
        if (activeClientId) {
            const normalizedClientId = activeClientId.toLowerCase();
            const activeUser = users.find(u => u.id.toLowerCase() === normalizedClientId);
            if (activeUser) {
                data['Clients workflow'] = {
                    id: normalizedClientId,
                    name: 'Clients workflow',
                    selectable: false,
                    icon: 'folder',
                    items: transformWorkflows(normalizedClientId, workflowsByOwner[normalizedClientId] || []),
                    children: {}
                };
            }
        }

        // Personal workflows - ALWAYS visible
        data['My Workflows'] = {
            id: 'personal',
            name: 'My Workflows',
            selectable: false,
            icon: 'folder_shared',
            items: transformWorkflows('personal', workflowsByOwner['personal'] || []),
            children: {}
        };

        return data;
    }, [workflowsByOwner, users, activeClientId, isAdmin]);

    const activeClient = useMemo(() =>
        assignedUsers.find(u => u.id === activeClientId),
        [assignedUsers, activeClientId]
    );

    const clientSelectionData = useMemo(() => {
        const data: Record<string, SelectionGroup> = {};
        assignedUsers.forEach(u => {
            data[u.username] = {
                id: u.id,
                name: u.username,
                selectable: true,
                icon: 'person',
                items: [],
                children: {}
            };
        });
        return data;
    }, [assignedUsers]);

    const handleSelect = (item: SelectionItem) => {
        // Find the actual workflow object
        const ownerId = (item.parentId || 'personal').toLowerCase();
        const wf = workflowsByOwner[ownerId]?.find(w => w.id === item.id);
        if (wf) {
            onSelect(wf);
        }
    };

    const handleAction = (action: SelectionAction, target: SelectionItem | SelectionGroup) => {
        if (action === 'add') {
            const ownerId = target.id;
            // Safety guard: only admins can create common workflows
            if (ownerId === 'common' && !isAdmin) return;
            onCreate('', ownerId);
        } else if (action === 'delete') {
            const wfId = (target as SelectionItem).id;
            const ownerId = (target as SelectionItem).parentId || 'personal';
            // Only admins can delete common workflows
            if (ownerId === 'common' && !isAdmin) return;
            const workflow = workflowsByOwner[ownerId]?.find(w => w.id === wfId);
            if (workflow) onDelete(workflow);
        } else if (action === 'rename') {
            const wfId = (target as SelectionItem).id;
            const ownerId = (target as SelectionItem).parentId || 'personal';
            // Only admins can rename common workflows
            if (ownerId === 'common' && !isAdmin) return;
            const workflow = workflowsByOwner[ownerId]?.find(w => w.id === wfId);
            if (workflow) onRename(workflow);
        }
    };
    return (
        <AppHeader
            onToggleSidebar={onToggleSidebar}
            isSidebarOpen={isSidebarOpen}
            leftContent={
                <div className="flex items-center gap-1.5 min-w-0">
                    <ComboBox
                        value={activeWorkflowId}
                        label={title}
                        placeholder="Select a workflow"
                        data={selectionData}
                        onSelect={handleSelect}
                        onAction={handleAction}
                        searchPlaceholder="Search workflows..."
                        config={{
                            allowDelete: true,
                            allowRename: true,
                            groupActions: ['add'],
                        }}
                    />
                    {showClientSelector && (
                        <>
                            <div className="w-px h-6 bg-[var(--border-base)] mx-1" />
                            <ComboBox
                                value={activeClientId || 'all'}
                                label={activeClient?.username || 'No client selected'}
                                icon={activeClient ? 'person' : 'group'}
                                data={clientSelectionData}
                                onSelect={(item) => setActiveClientId(item.id === 'all' ? null : item.id)}
                                searchPlaceholder="Find client..."
                            />
                        </>
                    )}
                </div>
            }
            rightContent={
                <>
                    {activeWorkflowId && (
                        <button
                            className="p-2.5 rounded-xl border border-[var(--border-base)] bg-[var(--bg-app)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--border-muted)] hover:border-[var(--border-base)] transition-all disabled:opacity-20 disabled:cursor-not-allowed group"
                            onClick={onOpenEditModal}
                        >
                            <Icon name="data_object" size={18} className="group-active:scale-95 transition-transform" />
                        </button>
                    )}

                    {canSave && (
                        <>
                            <div className="w-px h-6 bg-[var(--border-base)] mx-1" />
                            <button
                                className="p-2.5 rounded-xl border border-[var(--border-base)] bg-[var(--bg-app)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--border-muted)] hover:border-[var(--border-base)] transition-all disabled:opacity-20 disabled:cursor-not-allowed group"
                                onClick={onSave}
                                disabled={!canAction}
                                title="Save Workflow"
                            >
                                <Icon name="save" size={18} className="group-active:scale-95 transition-transform" />
                            </button>
                        </>
                    )}
                    <button
                        className={`h-10 px-6 rounded-xl flex items-center gap-2 font-bold text-xs transition-all active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed
                            ${isRunning
                                ? 'bg-brand/10 text-brand ring-1 ring-inset ring-brand/30 cursor-default'
                                : 'bg-brand hover:brightness-110 text-white shadow-lg shadow-brand/20'
                            }`}
                        onClick={onRun}
                        disabled={!canAction || isRunning}
                    >
                        {isRunning ? (
                            <>
                                <Icon name="bolt" size={14} className="animate-pulse" />
                                <span>Running...</span>
                            </>
                        ) : (
                            <>
                                <Icon name="play" size={12} />
                                <span>Run</span>
                            </>
                        )}
                    </button>
                </>
            }
        />
    );
};
