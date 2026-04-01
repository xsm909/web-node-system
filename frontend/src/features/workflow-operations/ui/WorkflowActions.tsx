import React from 'react';

import { AppRoundButton } from '../../../shared/ui/app-round-button/AppRoundButton';

interface WorkflowActionsProps {
    isRunning: boolean;
    onRun: () => void;
    onOpenParameters?: () => void;
    isDisabled?: boolean;
}

export const WorkflowActions: React.FC<WorkflowActionsProps> = ({
    isRunning,
    onRun,
    onOpenParameters,
    isDisabled = false,
}) => {
    return (
        <div className="flex items-center gap-2">
            {onOpenParameters && (
                <AppRoundButton
                    icon="parameters"
                    variant="brand"
                    onClick={onOpenParameters}
                    isDisabled={isDisabled}
                    title="Workflow Parameters"
                />
            )}

            <AppRoundButton
                icon="play"
                variant="brand"
                onClick={onRun}
                isLoading={isRunning}
                isDisabled={isDisabled}
                title="Run Workflow"
            />
        </div>
    );
};
