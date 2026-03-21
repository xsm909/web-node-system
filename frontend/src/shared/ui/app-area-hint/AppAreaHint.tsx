import React from 'react';
import { Icon } from '../icon';

export interface AppAreaHintProps {
    icon: string;
    title: string;
    description?: string;
    className?: string;
}

/**
 * Standardized component for empty states or placeholder areas.
 * Features a dashed border, centered icon and text.
 */
export const AppAreaHint: React.FC<AppAreaHintProps> = ({
    icon,
    title,
    description,
    className = ''
}) => {
    return (
        <div className={`py-12 flex flex-col items-center justify-center border-2 border-dashed border-[var(--border-base)] rounded-2xl opacity-40 ${className}`}>
            <Icon name={icon} size={32} className="mb-2 text-[var(--text-muted)]" />
            <h4 className="text-xs font-normal text-[var(--text-main)]">{title}</h4>
            {description && (
                <p className="mt-1 text-[10px] text-[var(--text-muted)] font-normal uppercase tracking-tighter">
                    {description}
                </p>
            )}
        </div>
    );
};
