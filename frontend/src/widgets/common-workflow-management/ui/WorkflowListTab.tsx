import { useCallback } from 'react';
import { WorkflowList } from '../../workflow-list';
import { useWorkflowEditor } from './WorkflowEditorProvider';
import { useNavigator } from '../../../shared/ui/navigator';
import { WorkflowEditorView } from './WorkflowEditorView';
import { usePinnedNavigation } from '../../../features/pinned-tabs/lib/usePinnedCheck';

export const WorkflowListTab = () => {
    const {
        workflows,
        handleCreateWorkflow,
        handleDuplicateWorkflow,
        setActiveWorkflow,
        setWorkflowToDelete,
        setWorkflowToRename,
        setRenameInputValue,
        setRenameCategoryValue,
        onToggleSidebar,
        isSidebarOpen,
        loadWorkflow,
        activeProjectId
    } = useWorkflowEditor();
    
    const nav = useNavigator();
    const { openOrFocus } = usePinnedNavigation();

    const handleSelectWorkflow = useCallback((wf: any) => {
        if (!wf?.id) return;
        loadWorkflow(wf);
        nav.push(
            <WorkflowEditorView
                onBack={() => {
                    setActiveWorkflow(null);
                    nav.pop();
                }}
            />
        );
    }, [loadWorkflow, nav, setActiveWorkflow]);

    return (
        <WorkflowList
            workflows={workflows}
            isSidebarOpen={isSidebarOpen}
            onToggleSidebar={onToggleSidebar}
            onSelectWorkflow={(wf) => {
                if (!wf?.id) return;
                openOrFocus('workflows', wf.id, () => handleSelectWorkflow(wf));
            }}
            onCreateWorkflow={(name, category) => {
                handleCreateWorkflow(name, category, activeProjectId).then((newWf: any) => {
                    if (newWf) handleSelectWorkflow(newWf);
                });
            }}
            onDeleteWorkflow={setWorkflowToDelete}
            onRenameWorkflow={(wf) => {
                setWorkflowToRename(wf);
                setRenameInputValue(wf.name);
                setRenameCategoryValue(wf.category || 'personal');
            }}
            onDuplicateWorkflow={(wf: any) => handleDuplicateWorkflow(wf.id)}
        />
    );
};
