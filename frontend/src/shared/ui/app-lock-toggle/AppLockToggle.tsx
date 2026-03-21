import React, { useState } from 'react';
import { Icon } from '../icon/Icon';
import { apiClient } from '../../api/client';

interface AppLockToggleProps {
    entityId: string;
    entityType: string;
    initialLocked: boolean;
    onToggle?: (isLocked: boolean) => void;
    size?: number;
    className?: string;
    disabled?: boolean;
}

export const AppLockToggle: React.FC<AppLockToggleProps> = ({
    entityId,
    entityType,
    initialLocked,
    onToggle,
    size = 20,
    className = '',
    disabled = false
}) => {
    const [isLocked, setIsLocked] = useState(initialLocked);
    const [isLoading, setIsLoading] = useState(false);

    const handleToggle = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isLoading || disabled) return;

        setIsLoading(true);
        try {
            const { data } = await apiClient.post('/locks/toggle', {
                entity_id: entityId,
                entity_type: entityType,
                locked: !isLocked
            });
            setIsLocked(data);
            if (onToggle) onToggle(data);
        } catch (error) {
            console.error('Failed to toggle lock:', error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <button
            onClick={handleToggle}
            className={`
                p-1 rounded-md transition-colors duration-200
                ${isLoading ? 'opacity-50 cursor-wait' : 'cursor-pointer'}
                ${isLocked 
                    ? 'text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-900/20' 
                    : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:text-slate-500 dark:hover:text-slate-300 dark:hover:bg-slate-800'}
                ${className}
            `}
            title={isLocked ? 'Unlock' : 'Lock'}
            disabled={isLoading || disabled}
        >
            <Icon 
                name={isLocked ? 'lock' : 'unlock'} 
                size={size} 
                className={isLoading ? 'animate-pulse' : ''}
            />
        </button>
    );
};
