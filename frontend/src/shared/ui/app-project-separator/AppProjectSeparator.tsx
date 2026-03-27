import React from 'react';
import { Icon } from '../icon/Icon';

interface AppProjectSeparatorProps {
    label?: string;
    className?: string;
    colSpan?: number;
}

export const AppProjectSeparator: React.FC<AppProjectSeparatorProps> = ({ 
    label = "Project Scope",
    className = "",
    colSpan = 4
}) => {
    return (
        <tr className={`bg-transparent pointer-events-none !border-0 !border-transparent ${className}`}>
            <td colSpan={colSpan} className="px-6 py-2 !border-0 !border-transparent">
                <div className="flex items-center gap-3">
                    <div className="h-px flex-1 bg-brand/30"></div>
                    <div className="flex items-center gap-2 shrink-0 pr-2">
                        <Icon name="project" size={14} className="text-brand opacity-60" />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-brand opacity-60 whitespace-nowrap">
                            {label}
                        </span>
                    </div>
                </div>
            </td>
        </tr>
    );
};
