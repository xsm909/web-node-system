import React from 'react';
import { Icon } from '../../../shared/ui/icon';
import { Header } from '../../../shared/ui/header';
import { AppInput } from '../../../shared/ui/app-input';
import { useProjectStore } from '../../../features/projects/store';
import { useProjects } from '../../../entities/project/api';
import { UI_CONSTANTS } from '../../../shared/ui/constants';

interface AppHeaderProps {
    onToggleSidebar: () => void;
    isSidebarOpen?: boolean;
    leftContent?: React.ReactNode;
    rightContent?: React.ReactNode;
    searchQuery?: string;
    onSearchChange?: (query: string) => void;
    searchPlaceholder?: string;
    onBack?: () => void;
    isDirty?: boolean;
    isPinned?: boolean;
    canPin?: boolean;
    onPinToggle?: () => void;
    projectId?: string | null;
}

const ProjectBadge: React.FC<{ projectId?: string | null }> = ({ projectId: propProjectId }) => {
    const { activeProject, isProjectMode } = useProjectStore();
    const { data: projects = [] } = useProjects();
    
    // Resolve which project to show: either from prop or from global store
    const effectiveProjectId = propProjectId !== undefined ? propProjectId : (isProjectMode ? activeProject?.id : null);
    
    if (!effectiveProjectId) return null;
    
    const project = projects.find(p => p.id === effectiveProjectId) || (effectiveProjectId === activeProject?.id ? activeProject : null);
    if (!project) return null;
    
    const brandColor = project.theme_color || UI_CONSTANTS.BRAND;
    
    return (
        <div 
            className="flex items-center gap-2 px-2.5 py-1 rounded-full border bg-white/5 backdrop-blur-sm shadow-sm transition-all animate-in fade-in slide-in-from-left-2"
            style={{ 
                borderColor: `${brandColor}40`,
                color: brandColor
            }}
        >
            <Icon name="project" size={12} />
            <span className="text-[10px] font-black uppercase tracking-widest truncate max-w-[120px]">
                {project.name}
            </span>
        </div>
    );
};

export const AppHeader: React.FC<AppHeaderProps> = ({
    onToggleSidebar,
    isSidebarOpen = false,
    leftContent,
    rightContent,
    searchQuery,
    onSearchChange,
    searchPlaceholder = "Search...",
    onBack,
    isDirty,
    isPinned = false,
    canPin = false,
    onPinToggle,
    projectId
}) => {
    const { isProjectMode } = useProjectStore();
    return (
        <Header
            leftContent={
                <>
                    <button
                        className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--border-muted)] lg:hidden transition-colors shrink-0"
                        onClick={onToggleSidebar}
                        aria-label="Toggle menu"
                    >
                        <Icon name={isSidebarOpen ? "close" : "menu"} size={22} className={!isSidebarOpen ? "text-brand" : ""} />
                    </button>
                    {onBack && (
                        <div className="flex items-center">
                            <button
                                className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--border-muted)] transition-colors shrink-0 mr-1 hidden lg:flex"
                                onClick={onBack}
                                aria-label="Go back"
                                title="Go back (Esc)"
                            >
                                <Icon name="arrow_back" size={22} />
                            </button>
                            {canPin && onPinToggle && (
                                <button
                                    className={`p-2 rounded-lg transition-colors shrink-0 mr-1 hidden lg:flex ${isPinned ? 'text-brand bg-brand/10' : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--border-muted)]'}`}
                                    onClick={onPinToggle}
                                    aria-label={isPinned ? "Unpin form" : "Pin form"}
                                    title={isPinned ? "Unpin (detach)" : "Pin (detach)"}
                                >
                                    <Icon name={isPinned ? "keep_off" : "keep"} size={20} />
                                </button>
                            )}
                        </div>
                    )}
                    <div className="relative flex items-center">
                        <ProjectBadge projectId={projectId} />
                        <div className={(isProjectMode || !!projectId) ? 'ml-3' : ''}>
                            {leftContent}
                        </div>
                        {isDirty && (
                            <div className="flex items-center ml-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse shadow-sm shadow-brand/50" title="Unsaved changes" />
                            </div>
                        )}
                    </div>
                </>
            }
            rightContent={
                <>
                    {onSearchChange && (
                        <AppInput
                            value={searchQuery || ''}
                            onChange={onSearchChange}
                            placeholder={searchPlaceholder}
                            icon="search"
                            showClear={!!onSearchChange}
                            className="flex-1 min-w-[200px] lg:w-[320px] ml-auto"
                        />
                    )}
                    {rightContent}
                </>
            }
        />
    );
};
