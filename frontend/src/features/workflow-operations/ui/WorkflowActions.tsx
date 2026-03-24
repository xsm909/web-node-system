import React from 'react';
import { Icon } from '../../../shared/ui/icon';
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

            <button
                className={`h-10 px-6 rounded-xl flex items-center gap-2 font-bold text-xs transition-all active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed
                    ${isRunning
                        ? 'bg-brand/10 text-brand ring-1 ring-inset ring-brand/30 cursor-default'
                        : 'bg-brand hover:brightness-110 text-white shadow-lg shadow-brand/20'
                    }`}
                onClick={onRun}
                disabled={isDisabled || isRunning}
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
        </div>
    );
};
