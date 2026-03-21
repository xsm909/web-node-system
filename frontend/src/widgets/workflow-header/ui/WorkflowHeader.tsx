import React, { useMemo } from 'react';
import { type SelectionGroup } from '../../../shared/ui/selection-list';
import { ComboBox } from '../../../shared/ui/combo-box';
import { Icon } from '../../../shared/ui/icon';
import { AppHeader } from '../../app-header';
import { useClientStore } from '../../../features/workflow-management/model/clientStore';

interface WorkflowHeaderProps {
    isRunning: boolean;
    isSidebarOpen: boolean;
    onRun: () => void;
    onToggleSidebar: () => void;
    canAction: boolean;
    showClientSelector?: boolean;
    onOpenParameters?: () => void;
}

export const WorkflowHeader: React.FC<WorkflowHeaderProps> = ({
    isRunning,
    isSidebarOpen,
    onRun,
    onToggleSidebar,
    canAction,
    showClientSelector,
    onOpenParameters,
}) => {
    const { activeClientId, assignedUsers, setActiveClientId } = useClientStore();

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
    return (
        <AppHeader
            onToggleSidebar={onToggleSidebar}
            isSidebarOpen={isSidebarOpen}
            leftContent={
                <div className="flex items-center gap-1.5 min-w-0">
                    {showClientSelector && (
                        <>
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
                    <button
                        className="h-10 px-4 rounded-xl border border-[var(--border-base)] bg-[var(--bg-app)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-alt)] transition-all active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed group"
                        onClick={onOpenParameters}
                        disabled={!canAction}
                        title="Workflow Parameters"
                    >
                        <Icon name="tune" size={18} className="group-active:scale-95 transition-transform" />
                    </button>

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
