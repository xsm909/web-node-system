import { useMemo } from 'react';
import { ConfirmModal } from '../../../shared/ui/confirm-modal';
import { AppCompactModalForm } from '../../../shared/ui/app-compact-modal-form/AppCompactModalForm';
import { AppInput } from '../../../shared/ui/app-input';
import { AppCategoryInput } from '../../../shared/ui/app-category-input/AppCategoryInput';
import { getUniqueCategoryPaths } from '../../../shared/lib/categoryUtils';
import { useWorkflowEditor } from './WorkflowEditorProvider';

export const WorkflowModals = () => {
    const {
        workflowToDelete,
        confirmDeleteWorkflow,
        setWorkflowToDelete,
        workflowToRename,
        workflowError,
        handleRenameWorkflow,
        renameInputValue,
        setRenameInputValue,
        renameCategoryValue,
        setRenameCategoryValue,
        setWorkflowToRename,
        setWorkflowError,
        workflows
    } = useWorkflowEditor();

    const allCategoryPaths = useMemo(() => getUniqueCategoryPaths(workflows), [workflows]);

    return (
        <>
            <ConfirmModal
                isOpen={!!workflowToDelete}
                title="Delete Workflow"
                description={`Are you sure you want to delete "${workflowToDelete?.name}"? This action cannot be undone.`}
                confirmLabel="Delete"
                onConfirm={confirmDeleteWorkflow}
                onCancel={() => setWorkflowToDelete(null)}
            />

            <AppCompactModalForm
                isOpen={!!workflowToRename}
                title="Rename Workflow"
                submitLabel="Update"
                onClose={() => {
                    setWorkflowToRename(null);
                    setWorkflowError(null);
                }}
                error={workflowError || undefined}
                onSubmit={() => {
                    if (workflowToRename) {
                        handleRenameWorkflow(workflowToRename.id, renameInputValue, renameCategoryValue);
                    }
                    setWorkflowToRename(null);
                }}
            >
                <div className="flex flex-col gap-4">
                    <p className="text-sm text-[var(--text-muted)] mt-1 mb-2">
                        Update properties for <span className="font-bold text-[var(--text-main)] italic">"{workflowToRename?.name}"</span>.
                    </p>
                    <AppInput
                        label="Name"
                        autoFocus
                        placeholder="Workflow name"
                        value={renameInputValue}
                        onChange={setRenameInputValue}
                    />
                    <AppCategoryInput
                        label="Category"
                        placeholder="e.g. personal, common, analysis"
                        value={renameCategoryValue}
                        onChange={setRenameCategoryValue}
                        allPaths={allCategoryPaths}
                    />
                </div>
            </AppCompactModalForm>
        </>
    );
};
