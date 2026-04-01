import React from 'react';
import { Icon } from '../icon';
import { useProjectStore } from '../../../features/projects/store';
import { useProjects } from '../../../entities/project/api';

interface AppSectionTitleProps {
    icon?: string;
    title: string;
    parentTitle?: string;
    projectId?: string | null;
    isLocked?: boolean;
    className?: string;
}

export const AppSectionTitle: React.FC<AppSectionTitleProps> = ({ 
    icon, 
    title, 
    parentTitle, 
    projectId,
    isLocked,
    className = "" 
}) => {
    const { activeProject, isProjectMode } = useProjectStore();
    const { data: projects = [] } = useProjects();
    
    const effectiveProjectId = projectId !== undefined ? projectId : (isProjectMode ? activeProject?.id : null);
    const project = effectiveProjectId ? (projects.find(p => p.id === effectiveProjectId) || (effectiveProjectId === activeProject?.id ? activeProject : null)) : null;

    return (
        <div className={`flex items-center gap-2 lg:gap-3 px-2 lg:px-0 h-full min-w-0 ${className}`}>
            {icon && (
                <Icon 
                    name={icon} 
                    size={20} 
                    className="text-brand/70 shrink-0" 
                />
            )}
            
            <h1 className="text-[17px] font-light tracking-tight text-[var(--text-main)] opacity-90 truncate leading-none flex items-center gap-1 min-w-0">
                {parentTitle ? (
                    <>
                        <span className="opacity-40 font-normal shrink-0">
                            {parentTitle}
                        </span>
                        <span className="opacity-20 font-thin mx-1 shrink-0">/</span>
                        {project && (
                            <>
                                <span className="shrink-0 opacity-60">
                                    {project.name}
                                </span>
                                <span className="opacity-20 font-thin mx-1 shrink-0">/</span>
                            </>
                        )}
                        <span className="truncate">{title}</span>
                    </>
                ) : (
                    <>
                        <span className="truncate">{title}</span>
                        {project && (
                            <>
                                <span className="opacity-20 font-thin mx-1 shrink-0">/</span>
                                <span className="shrink-0 opacity-60">
                                    {project.name}
                                </span>
                            </>
                        )}
                    </>
                )}
                {isLocked && (
                    <Icon name="lock" size={14} className="text-amber-500/60 ml-0.5 shrink-0" />
                )}
            </h1>
        </div>
    );
};
