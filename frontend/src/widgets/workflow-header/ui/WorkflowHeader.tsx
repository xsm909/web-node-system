import React, { useMemo } from 'react';
import { type SelectionGroup } from '../../../shared/ui/selection-list';
import { ComboBox } from '../../../shared/ui/combo-box';
import { AppHeader } from '../../app-header';
import { WorkflowActions } from '../../../features/workflow-operations/ui/WorkflowActions';
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
                    <WorkflowActions
                        isRunning={isRunning}
                        onRun={onRun}
                        onOpenParameters={onOpenParameters}
                        isDisabled={!canAction}
                    />
                </>
            }
        />
    );
};
