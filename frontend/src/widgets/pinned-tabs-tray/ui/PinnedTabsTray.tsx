import React from 'react';
import { 
    DndContext, 
    closestCenter,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent
} from '@dnd-kit/core';
import {
    SortableContext,
    verticalListSortingStrategy,
    useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { usePinStore, type PinnedTab } from '../../../features/pinned-tabs/model/store';
import { Icon } from '../../../shared/ui/icon';
import { useProjects } from '../../../entities/project/api';
import { UI_CONSTANTS } from '../../../shared/ui/constants';

export const PinnedTabsTray: React.FC = () => {
    const { tabs, activeTabId, focus, unpin, reorderTabs } = usePinStore();
    const { data: projects = [] } = useProjects();

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8, // Avoid accidental drags when clicking
            },
        })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            reorderTabs(active.id as string, over.id as string);
        }
    };

    if (tabs.length === 0) return null;

    return (
        <aside className="w-[42px] border-l border-[var(--border-base)] bg-[var(--bg-app)] flex flex-col z-40 shrink-0 select-none">
            <DndContext 
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
            >
                <div className="flex-1 flex flex-col py-4 gap-2 overflow-y-auto custom-scrollbar overflow-x-hidden">
                    <SortableContext 
                        items={tabs.map(t => t.id)} 
                        strategy={verticalListSortingStrategy}
                    >
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
                    </SortableContext>
                </div>
            </DndContext>
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
    
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: tab.id });

    const style = {
        transform: CSS.Translate.toString(transform),
        transition,
        backgroundColor: isActive ? (tab.projectId ? `${brandColor}14` : 'var(--border-muted)') : undefined,
        borderColor: isActive ? brandColor : 'transparent',
        color: isActive ? brandColor : undefined,
        zIndex: isDragging ? 50 : undefined,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div 
            ref={setNodeRef}
            style={style}
            className={`
                group relative flex flex-col items-center justify-start w-full h-40 cursor-pointer transition-all duration-200
                ${isActive 
                    ? 'border-l-2' 
                    : 'text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-main)]'}
                ${isDragging ? 'shadow-lg bg-[var(--bg-hover)]' : ''}
            `}
            onClick={onFocus}
            title={tab.title}
            {...attributes}
            {...listeners}
        >
            <div className="flex flex-col items-center gap-2 h-full py-3 relative overflow-hidden pointer-events-none">
                <Icon 
                    name={tab.icon || 'article'} 
                    size={15} 
                    className="shrink-0" 
                    style={{ color: isActive ? brandColor : undefined }}
                />
                
                <div className="flex-1 flex flex-col items-center justify-start overflow-hidden w-full">
                    <span 
                        className="whitespace-nowrap text-[10px] uppercase tracking-widest font-light text-center truncate max-h-full"
                        style={{ color: isActive ? brandColor : undefined, writingMode: 'vertical-rl' }}
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
                onClick={(e) => {
                    e.stopPropagation();
                    onClose(e);
                }}
                className="absolute top-1 right-1 p-0.5 rounded-md opacity-0 group-hover:opacity-100 hover:bg-slate-500/10 text-[var(--text-muted)] hover:text-red-500 transition-opacity z-10 pointer-events-auto"
                title="Close tab"
            >
                <Icon name="close" size={10} />
            </button>
        </div>
    );
};
