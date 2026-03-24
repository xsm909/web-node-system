import { useCallback, useEffect } from 'react';
import { WorkflowList } from '../../workflow-list';
import { useWorkflowEditor } from './WorkflowEditorProvider';
import { useNavigator } from '../../../shared/ui/navigator';
import { WorkflowEditorView } from './WorkflowEditorView';

export const WorkflowListTab = () => {
    const {
        workflows,
        activeWorkflow,
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

    const handleSelectWorkflow = useCallback((wf: any) => {
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

    useEffect(() => {
        if (activeWorkflow && !nav.canGoBack) {
            handleSelectWorkflow(activeWorkflow);
        }
    }, [nav.canGoBack, handleSelectWorkflow, activeWorkflow]);

    return (
        <WorkflowList
            workflows={workflows}
            isSidebarOpen={isSidebarOpen}
            onToggleSidebar={onToggleSidebar}
            onSelectWorkflow={handleSelectWorkflow}
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
