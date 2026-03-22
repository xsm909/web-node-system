import React, { type ReactNode } from 'react';
import { Icon } from '../../icon/Icon';

interface AppTableStandardCellProps {
    icon?: string;
    label: string;
    subtitle?: ReactNode;
    isLocked?: boolean;
    isMono?: boolean;
    className?: string;
    iconClassName?: string;
    iconDir?: 'icons' | 'node_icons';
}

export const AppTableStandardCell: React.FC<AppTableStandardCellProps> = ({
    icon,
    label,
    subtitle,
    isLocked,
    isMono = false,
    className = "",
    iconClassName = "",
    iconDir = 'icons'
}) => {
    return (
        <div className={`flex items-center gap-3 min-w-0 ${className}`}>
            {icon && (
                <div className={`flex-shrink-0 p-2 rounded-lg bg-surface-700 text-brand group-hover:bg-brand group-hover:text-white transition-colors ${iconClassName}`}>
                    <Icon name={icon} dir={iconDir} size={18} />
                </div>
            )}
            <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-2">
                    <span className={`
                        text-sm transition-colors truncate
                        ${isMono ? 'font-mono text-brand group-hover:brightness-110' : 'font-semibold text-[var(--text-main)] group-hover:text-brand'}
                    `}>
                        {label}
                    </span>
                    {isLocked && (
                        <Icon 
                            name="lock" 
                            size={14} 
                            className="text-amber-500 flex-shrink-0" 
                        />
                    )}
                </div>
                {subtitle && (
                    <div className="text-[10px] text-[var(--text-muted)] opacity-60 truncate">
                        {subtitle}
                    </div>
                )}
            </div>
        </div>
    );
};
