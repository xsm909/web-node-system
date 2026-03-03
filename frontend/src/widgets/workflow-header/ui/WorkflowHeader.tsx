import React, { useState, useMemo, useRef } from 'react';
import type { Workflow } from '../../../entities/workflow/model/types';
import type { AssignedUser } from '../../../entities/user/model/types';
import { SelectionList, type SelectionGroup, type SelectionItem, type SelectionAction } from '../../../shared/ui/selection-list';
import { Icon } from '../../../shared/ui/icon';
import { AppHeader } from '../../app-header';
import { useClientStore } from '../../../features/workflow-management/model/clientStore';

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
}) => {
    const { activeClientId } = useClientStore();
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);

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

        // Personal workflows - ALWAYS visible
        data['My Workflows'] = {
            id: 'personal',
            name: 'My Workflows',
            items: transformWorkflows('personal', workflowsByOwner['personal'] || []),
            children: {}
        };

        // Client workflows - ONLY if activeClientId is set
        if (activeClientId) {
            const activeUser = users.find(u => u.id === activeClientId);
            if (activeUser) {
                data['Clients workflow'] = {
                    id: activeClientId,
                    name: 'Clients workflow',
                    items: transformWorkflows(activeClientId, workflowsByOwner[activeClientId] || []),
                    children: {}
                };
            }
        }

        return data;
    }, [workflowsByOwner, users, activeClientId]);

    const handleSelect = (item: SelectionItem) => {
        // Find the actual workflow object
        const ownerId = item.parentId || 'personal';
        const wf = workflowsByOwner[ownerId]?.find(w => w.id === item.id);
        if (wf) {
            onSelect(wf);
            setIsDropdownOpen(false);
        }
    };

    const handleAction = (action: SelectionAction, target: SelectionItem | SelectionGroup) => {
        setIsDropdownOpen(false);
        if (action === 'add') {
            const ownerId = target.id;
            onCreate('', ownerId);
        } else if (action === 'delete') {
            const wfId = (target as SelectionItem).id;
            const ownerId = (target as SelectionItem).parentId || 'personal';
            const workflow = workflowsByOwner[ownerId]?.find(w => w.id === wfId);
            if (workflow) onDelete(workflow);
        } else if (action === 'rename') {
            const wfId = (target as SelectionItem).id;
            const ownerId = (target as SelectionItem).parentId || 'personal';
            const workflow = workflowsByOwner[ownerId]?.find(w => w.id === wfId);
            if (workflow) onRename(workflow);
        }
    };

    return (
        <AppHeader
            onToggleSidebar={onToggleSidebar}
            isSidebarOpen={isSidebarOpen}
            leftContent={
                <div className="relative flex-1 max-w-xl">
                    <button
                        ref={triggerRef}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all max-w-full ${isDropdownOpen ? 'bg-[var(--border-base)] text-[var(--text-main)]' : 'text-[var(--text-muted)] hover:bg-[var(--border-muted)] hover:text-[var(--text-main)]'
                            }`}
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    >
                        <h1 className="text-sm font-semibold truncate tracking-tight">{title}</h1>
                        <Icon
                            name="chevron_down"
                            size={14}
                            className={`transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`}
                        />
                    </button>

                    {isDropdownOpen && (
                        <SelectionList
                            data={selectionData}
                            config={{
                                allowDelete: true,
                                allowRename: true,
                                groupActions: ['add']
                            }}
                            activeItemId={activeWorkflowId}
                            onSelect={handleSelect}
                            onAction={handleAction}
                            onClose={() => setIsDropdownOpen(false)}
                            searchPlaceholder="Find workflow..."
                            position={triggerRef.current ? {
                                x: triggerRef.current.getBoundingClientRect().left,
                                y: triggerRef.current.getBoundingClientRect().bottom + 8
                            } : undefined}
                        />
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

                    <div className="w-px h-6 bg-[var(--border-base)] mx-1" />
                    <button
                        className="p-2.5 rounded-xl border border-[var(--border-base)] bg-[var(--bg-app)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--border-muted)] hover:border-[var(--border-base)] transition-all disabled:opacity-20 disabled:cursor-not-allowed group"
                        onClick={onSave}
                        disabled={!canAction}
                        title="Save Workflow"
                    >
                        <Icon name="save" size={18} className="group-active:scale-95 transition-transform" />
                    </button>
                    <button
                        className={`
                            h-10 px-6 rounded-xl flex items-center gap-2 font-bold text-xs transition-all active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed
                            ${isRunning
                                ? 'bg-brand/10 text-brand ring-1 ring-inset ring-brand/30 cursor-default'
                                : 'bg-brand hover:brightness-110 text-white shadow-lg shadow-brand/20'
                            }
                        `}
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


