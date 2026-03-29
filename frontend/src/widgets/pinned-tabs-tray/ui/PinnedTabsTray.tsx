import React from 'react';
import { usePinStore, type PinnedTab } from '../../../features/pinned-tabs/model/store';
import { Icon } from '../../../shared/ui/icon';
import { useProjects } from '../../../entities/project/api';
import { UI_CONSTANTS } from '../../../shared/ui/constants';

export const PinnedTabsTray: React.FC = () => {
    const { tabs, activeTabId, focus, unpin } = usePinStore();
    const { data: projects = [] } = useProjects();

    if (tabs.length === 0) return null;

    return (
        <aside className="w-[42px] border-l border-[var(--border-base)] bg-[var(--bg-app)] flex flex-col z-40 shrink-0 select-none">
            <div className="flex-1 flex flex-col py-4 gap-2 overflow-y-auto custom-scrollbar overflow-x-hidden">
                {tabs.map((tab) => {
                    const project = tab.projectId ? projects.find(p => p.id === tab.projectId) : null;
                    return (
                        <PinnedTabItem 
                            key={tab.id}
                            tab={tab}
                            projectColor={project?.theme_color || UI_CONSTANTS.BRAND}
                            isActive={activeTabId === tab.id}
                            onFocus={() => focus(tab.id === activeTabId ? null : tab.id)}
                            onClose={(e) => {
                                e.stopPropagation();
                                unpin(tab.id);
                            }}
                        />
                    );
                })}
            </div>
        </aside>
    );
};

interface PinnedTabItemProps {
    tab: PinnedTab;
    projectColor: string | null;
    isActive: boolean;
    onFocus: () => void;
    onClose: (e: React.MouseEvent) => void;
}

const PinnedTabItem: React.FC<PinnedTabItemProps> = ({ tab, projectColor, isActive, onFocus, onClose }) => {
    const brandColor = projectColor || UI_CONSTANTS.BRAND;
    
    // Determine active background: project color at low opacity or neutral slate
    const activeBg = tab.projectId 
        ? `${brandColor}14` // 8% opacity (approx 14 in hex)
        : 'var(--border-muted)';

    return (
        <div 
            className={`
                group relative flex flex-col items-center justify-center w-full h-40 cursor-pointer transition-all duration-200
                ${isActive 
                    ? 'border-l-2' 
                    : 'text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-main)]'}
            `}
            style={{ 
                backgroundColor: isActive ? activeBg : undefined,
                borderColor: isActive ? brandColor : 'transparent',
                color: isActive ? brandColor : undefined
            }}
            onClick={onFocus}
            title={tab.title}
        >
            <div className="flex flex-col items-center gap-6 h-full py-4 relative">
                <Icon 
                    name={tab.icon || 'article'} 
                    size={15} 
                    className="shrink-0" 
                    style={{ color: isActive ? brandColor : undefined }}
                />
                
                <div className="flex-1 flex items-center justify-center overflow-visible w-full">
                    <span 
                        className="rotate-90 whitespace-nowrap text-[10px] uppercase tracking-widest font-black text-center origin-center block"
                        style={{ color: isActive ? brandColor : undefined }}
                    >
                        {tab.title}
                    </span>
                </div>
                
                {tab.isDirty && (
                    <div 
                        className="w-1.5 h-1.5 rounded-full shrink-0 shadow-sm"
                        style={{ backgroundColor: brandColor }}
                    />
                )}
            </div>

            <button
                onClick={onClose}
                className="absolute top-1 right-1 p-0.5 rounded-md opacity-0 group-hover:opacity-100 hover:bg-slate-500/10 text-[var(--text-muted)] hover:text-red-500 transition-opacity z-10"
                title="Close tab"
            >
                <Icon name="close" size={10} />
            </button>
        </div>
    );
};
