import { useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { Icon } from '../icon/Icon';
import { apiClient } from '../../api/client';
import { AppRoundButton } from '../app-round-button/AppRoundButton';

interface AppLockToggleProps {
    entityId?: string;
    entityType?: string;
    initialLocked?: boolean;
    onToggle?: (isLocked: boolean) => void;
    onSave?: () => void | Promise<void>;
    isSaving?: boolean;
    isDirty?: boolean;
    saveLabel?: string;
    size?: number;
    className?: string;
    disabled?: boolean;
}

export const AppLockToggle: React.FC<AppLockToggleProps> = ({
    entityId,
    entityType,
    initialLocked = false,
    onToggle,
    onSave,
    isSaving = false,
    isDirty = false,
    saveLabel = 'Save Changes',
    size = 20,
    className = '',
    disabled = false
}) => {
    const [isLocked, setIsLocked] = useState(initialLocked);
    const [isLoading, setIsLoading] = useState(false);
    const queryClient = useQueryClient();

    React.useEffect(() => {
        setIsLocked(initialLocked);
    }, [initialLocked]);

    const handleToggle = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isLoading || disabled || !entityId || !entityType) return;

        setIsLoading(true);
        try {
            const { data } = await apiClient.post('/locks/toggle', {
                entity_id: entityId,
                entity_type: entityType,
                locked: !isLocked
            });
            setIsLocked(data);
            
            // Invalidate React Query caches based on entityType
            const queryKeyMap: Record<string, string> = {
                'agent_hints': 'agent-hints',
                'schemas': 'schemas',
                'records': 'records',
                'node_types': 'node-types',
                'reports': 'reports',
                'report_styles': 'report-styles',
                'credentials': 'credentials',
                'workflows': 'workflows'
            };

            const mappedKey = entityType ? queryKeyMap[entityType] : undefined;
            if (mappedKey) {
                queryClient.invalidateQueries({ queryKey: [mappedKey] });
            }

            if (onToggle) onToggle(data);
        } catch (error) {
            console.error('Failed to toggle lock:', error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className={`flex items-center gap-2 ${className}`}>
            {entityId && entityType && (
                <button
                    type="button"
                    onClick={handleToggle}
                    className={`
                        p-1 rounded-md transition-colors duration-200
                        ${isLoading ? 'opacity-50 cursor-wait' : 'cursor-pointer'}
                        ${isLocked 
                            ? 'text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-900/20' 
                            : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:text-slate-500 dark:hover:text-slate-300 dark:hover:bg-slate-800'}
                    `}
                    title={
                        isLocked 
                            ? 'Unlock' 
                            : (isDirty ? 'Save changes before locking' : 'Lock')
                    }
                    disabled={isLoading || disabled || (isDirty && !isLocked)}
                >
                    <Icon 
                        name={isLocked ? 'lock' : 'unlock'} 
                        size={size} 
                        className={`
                            ${isLoading ? 'animate-pulse' : ''}
                            ${(isDirty && !isLocked) ? 'opacity-30' : ''}
                        `}
                    />
                </button>
            )}

            {onSave && (
                <AppRoundButton
                    icon="save"
                    onClick={onSave}
                    isLoading={isSaving}
                    isDisabled={isLocked || disabled || isLoading}
                    variant="brand"
                    title={isLocked ? 'Locked' : saveLabel}
                    className={isDirty ? 'ring-2 ring-brand ring-offset-2 ring-offset-[var(--bg-app)]' : ''}
                />
            )}
        </div>
    );
};
