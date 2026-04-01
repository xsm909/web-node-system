import React from 'react';

import { AppRoundButton } from '../../../shared/ui/app-round-button/AppRoundButton';
import { WorkflowPresetPicker } from '../../workflow-presets/ui/WorkflowPresetPicker';
import type { Preset } from '../../../entities/preset';

interface WorkflowActionsProps {
    isRunning: boolean;
    onRun: () => void;
    onOpenParameters?: () => void;
    onSavePreset?: () => void;
    onApplyPreset?: (preset: Preset, useMouse: boolean) => void;
    isDisabled?: boolean;
}

export const WorkflowActions: React.FC<WorkflowActionsProps> = ({
    isRunning,
    onRun,
    onOpenParameters,
    onSavePreset,
    onApplyPreset,
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

            <div className="w-px h-4 bg-[var(--border-base)] mx-1 opacity-50" />

            <AppRoundButton
                icon="bookmark_add"
                variant="ghost"
                onClick={onSavePreset}
                isDisabled={isDisabled}
                title="Save Selection as Preset (F6)"
            />

            {onApplyPreset && (
                <WorkflowPresetPicker
                    mode="header"
                    onSelect={(preset) => onApplyPreset(preset, false)}
                />
            )}
        </div>
    );
};
