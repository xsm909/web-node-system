import { useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
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
                <AppRoundButton
                    icon={isLocked ? "lock" : "unlock"}
                    onClick={handleToggle}
                    variant={isLocked ? 'danger' : 'outline'}
                    isLoading={isLoading}
                    isDisabled={disabled || (isDirty && !isLocked)}
                    title={
                        isLocked 
                            ? 'Unlock' 
                            : (isDirty ? 'Save changes before locking' : 'Lock')
                    }
                />
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
