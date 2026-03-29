import { Navigator } from '../../shared/ui/navigator';
import { WorkflowEditorProvider } from './ui/WorkflowEditorProvider';
import { WorkflowListTab } from './ui/WorkflowListTab';
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
}

export function WorkflowManagement({ 
    activeWorkflowId, 
    onToggleSidebar, 
    isSidebarOpen, 
    onEditNode,
    projectId,
    refreshTrigger,
    isHotkeysEnabled
}: WorkflowManagementProps) {

    return (
        <WorkflowEditorProvider
            onToggleSidebar={onToggleSidebar}
            isSidebarOpen={isSidebarOpen}
            onEditNode={onEditNode}
            refreshTrigger={refreshTrigger}
            activeWorkflowId={activeWorkflowId}
            projectId={projectId}
            isHotkeysEnabled={isHotkeysEnabled}
        >
            <div className="flex-1 flex flex-col min-w-0 relative h-full">
                <Navigator
                    initialScene={<WorkflowListTab />}
                />
                
                <WorkflowModals />
            </div>
        </WorkflowEditorProvider>
    );
}
