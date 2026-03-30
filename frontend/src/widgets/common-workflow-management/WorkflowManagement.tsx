import React from 'react';
import { Navigator } from '../../shared/ui/navigator';
import { WorkflowEditorProvider } from './ui/WorkflowEditorProvider';
import { WorkflowListTab } from './ui/WorkflowListTab';
import { WorkflowEditorView } from './ui/WorkflowEditorView';
import { WorkflowModals } from './ui/WorkflowModals';
import type { NodeType } from '../../entities/node-type/model/types';

interface WorkflowManagementProps {
    onToggleSidebar: () => void;
    isSidebarOpen?: boolean;
    onEditNode?: (node: NodeType) => void;
    refreshTrigger?: number;
    activeWorkflowId?: string;
    projectId?: string | null;
    isHotkeysEnabled?: boolean;
    isPinned?: boolean;
}

export function WorkflowManagement({ 
    activeWorkflowId, 
    onToggleSidebar, 
    isSidebarOpen, 
    onEditNode,
    projectId,
    refreshTrigger,
    isHotkeysEnabled,
    isPinned = false
}: WorkflowManagementProps) {

    const initialScene = React.useMemo(() => {
        if (activeWorkflowId) {
            return <WorkflowEditorView isInitialScene onBack={() => { }} />;
        }
        return <WorkflowListTab />;
    }, [activeWorkflowId, onEditNode, refreshTrigger, onToggleSidebar, isSidebarOpen]);

    return (
        <WorkflowEditorProvider
            onToggleSidebar={onToggleSidebar}
            isSidebarOpen={isSidebarOpen}
            onEditNode={onEditNode}
            refreshTrigger={refreshTrigger}
            activeWorkflowId={activeWorkflowId}
            projectId={projectId}
            isHotkeysEnabled={isHotkeysEnabled}
            isPinned={isPinned}
        >
            <div className="flex-1 flex flex-col min-w-0 relative h-full">
                <Navigator
                    initialScene={initialScene}
                />
                
                <WorkflowModals />
            </div>
        </WorkflowEditorProvider>
    );
}
