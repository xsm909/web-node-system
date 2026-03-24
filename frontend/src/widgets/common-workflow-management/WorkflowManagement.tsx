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
}

export function WorkflowManagement({
    onToggleSidebar,
    isSidebarOpen,
    onEditNode,
    refreshTrigger
}: WorkflowManagementProps) {
    return (
        <WorkflowEditorProvider
            onToggleSidebar={onToggleSidebar}
            isSidebarOpen={isSidebarOpen}
            onEditNode={onEditNode}
            refreshTrigger={refreshTrigger}
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
