import React, { useState, useMemo } from 'react';
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
import { AppCompactModalForm } from '../../../shared/ui/app-compact-modal-form/AppCompactModalForm';
import { useNavigationGuardStore } from '../../../shared/lib/navigation-guard/store';

export const PinnedTabsTray: React.FC = () => {
    const { tabs, activeTabId, focus, unpin, reorderTabs } = usePinStore();
    const { data: projects = [] } = useProjects();
    const [pendingUnpin, setPendingUnpin] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const getBlockers = useNavigationGuardStore(s => s.blockers);

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

    const targetTab = useMemo(() => 
        tabs.find(t => t.id === pendingUnpin)
    , [tabs, pendingUnpin]);

    if (tabs.length === 0) return null;

    return (
        <aside className="w-[45px] border-l border-[var(--border-base)] bg-[var(--bg-app)] flex flex-col z-40 shrink-0 select-none">
            <DndContext 
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
            >
                <div className="flex-1 flex flex-col py-2 gap-1 overflow-y-auto custom-scrollbar overflow-x-hidden content-start">
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
                                        if (tab.isDirty) {
                                            setPendingUnpin(tab.id);
                                        } else {
                                            unpin(tab.id);
                                        }
                                    }}
                                />
                            );
                        })}
                    </SortableContext>
                </div>
            </DndContext>

            {pendingUnpin && targetTab && (
                <AppCompactModalForm
                    isOpen={!!pendingUnpin}
                    title="Unsaved Changes"
                    onSubmit={async () => {
                        const blocker = getBlockers[pendingUnpin];
                        if (blocker) {
                            setIsSaving(true);
                            try {
                                await blocker.onSave();
                                unpin(pendingUnpin);
                                setPendingUnpin(null);
                            } catch (err) {
                                console.error('Failed to save pinned tab:', err);
                            } finally {
                                setIsSaving(false);
                            }
                        } else {
                            // Fallback if no blocker registered: just focus
                            focus(pendingUnpin);
                            setPendingUnpin(null);
                        }
                    }}
                    onClose={() => setPendingUnpin(null)}
                    onDiscard={() => {
                        unpin(pendingUnpin);
                        setPendingUnpin(null);
                    }}
                    submitLabel="Save and Close"
                    discardLabel="Discard and Close"
                    cancelLabel="Stay Here"
                    isSaving={isSaving}
                    width="max-w-md"
                    icon="warning"
                >
                    <div className="py-2">
                        <p className="text-xs text-[var(--text-muted)] opacity-80 leading-relaxed">
                            The tab <span className="text-[var(--text-main)] font-bold">"{targetTab.title}"</span> has unsaved changes. 
                            Would you like to save them before closing?
                        </p>
                    </div>
                </AppCompactModalForm>
            )}
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
        borderColor: isActive ? brandColor : 'transparent',
        color: isActive ? brandColor : undefined,
        zIndex: isDragging ? 50 : undefined,
        opacity: isDragging ? 0.5 : 1,
        minHeight: '100px',
        maxHeight: '300px',
        flex: '0 1 auto',
    };

    return (
        <div 
            ref={setNodeRef}
            style={style}
            className={`
                group relative flex flex-col items-center justify-start w-full cursor-pointer transition-all duration-200
                ${isActive 
                    ? 'border-l-2' 
                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}
                ${isDragging ? 'shadow-lg' : ''}
            `}
            onClick={onFocus}
            title={tab.title}
            {...attributes}
            {...listeners}
        >
            {/* Base Background */}
            <div 
                className="absolute inset-0 pointer-events-none transition-colors duration-200"
                style={{
                    backgroundColor: isDragging 
                        ? 'var(--bg-hover)' 
                        : isActive 
                            ? (tab.projectId ? `${brandColor}40` : 'var(--bg-hover)')
                            : (tab.projectId ? `${brandColor}26` : 'transparent')
                }}
            />
            {/* Hover Background */}
            {!isActive && !isDragging && (
                <div 
                    className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                    style={{
                        backgroundColor: tab.projectId ? `${brandColor}1A` : 'var(--bg-hover)'
                    }}
                />
            )}

            <div className="flex flex-col items-center gap-1 h-full w-full py-2 relative z-10 overflow-hidden pointer-events-none px-1">
                <Icon 
                    name={tab.icon || 'article'} 
                    size={16} 
                    className="shrink-0 mb-1" 
                    style={{ color: isActive ? brandColor : undefined }}
                />
                
                <div className="flex-1 flex flex-col items-center justify-center overflow-hidden w-full relative">
                    <span 
                        className="whitespace-nowrap text-[10px] uppercase tracking-normal font-medium text-center truncate max-h-full opacity-90 group-hover:opacity-100 transition-opacity"
                        style={{ 
                            color: isActive ? brandColor : undefined, 
                            writingMode: 'vertical-rl',
                            transform: 'rotate(180deg)' // Better readability for vertical text usually
                        }}
                    >
                        {tab.title}
                    </span>
                </div>
                
                <div className="h-4 flex items-center justify-center">
                    {tab.isDirty && (
                        <div 
                            className="w-1.5 h-1.5 rounded-full shrink-0 shadow-sm animate-pulse"
                            style={{ backgroundColor: brandColor }}
                        />
                    )}
                </div>
            </div>

            <button
                onClick={(e) => {
                    e.stopPropagation();
                    onClose(e);
                }}
                className="absolute top-1.5 right-1.5 p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-500 transition-all z-20 pointer-events-auto"
                title="Close tab"
            >
                <Icon name="close" size={10} />
            </button>
        </div>
    );
};
