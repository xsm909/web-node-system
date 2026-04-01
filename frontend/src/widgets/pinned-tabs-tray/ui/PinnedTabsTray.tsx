import React, { useState, useMemo } from 'react';
import {
    DndContext,
    closestCenter,
    PointerSensor,
    MouseSensor,
    TouchSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
    type DragStartEvent,
    DragOverlay
} from '@dnd-kit/core';
import {
    SortableContext,
    verticalListSortingStrategy,
    useSortable
} from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
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

    const [activeId, setActiveId] = useState<string | null>(null);

    const sensors = useSensors(
        useSensor(MouseSensor, {
            activationConstraint: {
                distance: 3,
            },
        }),
        useSensor(TouchSensor, {
            activationConstraint: {
                distance: 5,
            },
        }),
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 3,
            },
        })
    );

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            reorderTabs(active.id as string, over.id as string);
        }
        setActiveId(null);
    };

    const handleDragCancel = () => {
        setActiveId(null);
    };

    const targetTab = useMemo(() =>
        tabs.find(t => t.id === pendingUnpin)
        , [tabs, pendingUnpin]);

    if (tabs.length === 0) return null;

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
            modifiers={[restrictToVerticalAxis]}
        >
            <aside className="w-[36px] border-l border-[var(--border-base)] bg-[var(--bg-app)]/80 flex flex-col z-40 shrink-0 select-none overflow-hidden backdrop-blur-xl">
                <div className="flex-1 flex flex-col pt-0 pb-8 overflow-y-auto no-scrollbar overflow-x-hidden content-start">
                    <SortableContext
                        items={tabs.map(t => t.id)}
                        strategy={verticalListSortingStrategy}
                    >
                        {tabs.map((tab) => {
                            const project = tab.projectId ? projects.find(p => p.id === tab.projectId) : null;
                            return (
                                <SortablePinnedTabItem
                                    key={tab.id}
                                    tab={tab}
                                    projectColor={project?.theme_color || UI_CONSTANTS.BRAND}
                                    isActive={activeTabId === tab.id}
                                    isGhost={activeId === tab.id}
                                    onFocus={() => focus(tab.id)}
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

                {pendingUnpin && targetTab && (
                    <AppCompactModalForm
                        isOpen={!!pendingUnpin}
                        title="Unsaved Changes"
                        onSubmit={async () => {
                            const blocker = getBlockers[pendingUnpin!];
                            if (blocker) {
                                setIsSaving(true);
                                try {
                                    await blocker.onSave();
                                    unpin(pendingUnpin!);
                                    setPendingUnpin(null);
                                } catch (err) {
                                    console.error('Failed to save pinned tab:', err);
                                } finally {
                                    setIsSaving(false);
                                }
                            } else {
                                focus(pendingUnpin!);
                                setPendingUnpin(null);
                            }
                        }}
                        onClose={() => setPendingUnpin(null)}
                        onDiscard={() => {
                            unpin(pendingUnpin!);
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

            <DragOverlay
                modifiers={[restrictToVerticalAxis]}
                dropAnimation={null}
                style={{ opacity: 1 }}
            >
                {activeId ? (
                    <PinnedTabItem
                        tab={tabs.find(t => t.id === activeId)!}
                        projectColor={tabs.find(t => t.id === activeId)?.projectId
                            ? projects.find(p => p.id === tabs.find(t => t.id === activeId)!.projectId)?.theme_color || UI_CONSTANTS.BRAND
                            : UI_CONSTANTS.BRAND
                        }
                        isActive={activeTabId === activeId}
                        isOverlay
                    />
                ) : null}
            </DragOverlay>
        </DndContext>
    );
};

interface PinnedTabItemProps {
    tab: PinnedTab;
    projectColor: string | null;
    isActive: boolean;
    isOverlay?: boolean;
    isGhost?: boolean;
    onFocus?: () => void;
    onClose?: (e: React.MouseEvent) => void;
}

const SortablePinnedTabItem: React.FC<PinnedTabItemProps> = (props) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: props.tab.id });

    const style = {
        transform: isDragging ? undefined : CSS.Translate.toString(transform),
        transition,
        maxHeight: 'max-content',
        zIndex: isDragging ? 100 : undefined,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className="flex-1 w-full flex flex-col min-h-[38px]"
        >
            <PinnedTabItem {...props} isGhost={isDragging} />
        </div>
    );
};

const PinnedTabItem: React.FC<PinnedTabItemProps> = ({
    tab,
    projectColor,
    isActive,
    isOverlay,
    isGhost,
    onFocus,
    onClose
}) => {
    const brandColor = projectColor || UI_CONSTANTS.BRAND;

    const style = {
        borderColor: isOverlay ? brandColor : (tab.projectId ? `${brandColor}26` : 'var(--border-muted)'),
        borderTopWidth: isOverlay ? '1px' : '0px',
        borderBottomWidth: '1px',
        borderStyle: 'solid' as const,
        color: isActive ? brandColor : undefined,
        opacity: isOverlay ? 1 : (isGhost ? 0.3 : 1), // 30% ghost, 100% overlay
        maxHeight: 'max-content',
        height: '100%',
    };

    return (
        <div
            style={style}
            className={`
                group relative flex flex-col items-center justify-start w-full h-full cursor-pointer
                ${isOverlay ? 'z-[9999] min-h-[38px] text-white !opacity-100' : ''}
                ${isActive && !isOverlay
                    ? 'z-10'
                    : !isOverlay ? 'text-[var(--text-muted)] hover:text-[var(--text-main)]' : ''}
            `}
            onClick={onFocus}
            title={tab.title}
        >
            <div
                className={`absolute inset-0 pointer-events-none transition-all duration-300 ${isOverlay ? 'backdrop-blur-[2px]' : ''}`}
                style={{
                    backgroundColor: isOverlay
                        ? (tab.projectId ? `${brandColor}26` : 'var(--bg-hover)') // 15% project tint for overlay
                        : tab.projectId
                            ? `${brandColor}${isActive ? '1A' : '0F'}`
                            : isActive ? 'var(--bg-hover)' : 'transparent'
                }}
            />

            {/* Visual Wrapper: Handles all float/scale/shadow effects without affecting layout footprint */}
            <div className={`
                absolute inset-0 transition-all duration-200 pointer-events-none
                ${isOverlay
                    ? 'shadow-xl scale-[1.03] border border-white/10 rounded-sm !opacity-100'
                    : 'bg-transparent'}
            `} />

            {/* Active Indicator Bar */}
            {isActive && !isOverlay && (
                <div
                    className="absolute inset-y-0 left-0 w-[3px] shadow-[2px_0_10px_rgba(var(--brand-rgb),0.3)] z-30 animate-in fade-in slide-in-from-left-1 duration-300"
                    style={{ backgroundColor: brandColor }}
                />
            )}

            {/* Hover State Adjuster (adds to existing bg if project tab) */}
            {!isOverlay && !isActive && (
                <div
                    className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    style={{
                        backgroundColor: tab.projectId ? `${brandColor}0B` : 'var(--bg-hover)' // Adds ~4% more color on hover to reach 10% total
                    }}
                />
            )}

            <div className="flex flex-col items-center gap-0.5 h-full w-full py-1.5 relative z-10 overflow-hidden pointer-events-none px-1">
                <Icon
                    name={tab.icon || 'article'}
                    size={13}
                    className={`shrink-0 mb-0.5 transition-transform duration-300 ${!isOverlay ? 'group-hover:scale-110' : ''}`}
                    style={{ color: isOverlay ? (tab.projectId ? brandColor : 'var(--text-main)') : (isActive ? brandColor : undefined), opacity: isOverlay ? 1 : undefined }}
                />

                <div className="flex-1 flex flex-col items-center justify-center overflow-hidden w-full relative">
                    <span
                        className={`whitespace-nowrap text-[9px] uppercase font-light text-center truncate max-h-full transition-opacity ${!isOverlay ? 'opacity-80' : '!opacity-100'}`}
                        style={{
                            color: isOverlay ? (tab.projectId ? brandColor : 'var(--text-main)') : (isActive ? brandColor : undefined),
                            writingMode: 'vertical-rl',
                        }}
                    >
                        {tab.title}
                    </span>
                </div>

                {/* Bottom area: Dirty Indicator & Close Button */}
                <div className="h-[18px] shrink-0 w-full flex items-center justify-center relative pointer-events-auto mt-auto">
                    {/* Dirty Dot (fades out on hover) */}
                    {tab.isDirty && (
                        <div
                            className="w-1.5 h-1.5 rounded-full shrink-0 shadow-sm animate-pulse transition-opacity duration-300 group-hover:opacity-0 absolute"
                            style={{ backgroundColor: brandColor }}
                        />
                    )}
                    {/* Close Button (fades in on hover) */}
                    {onClose && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onClose(e);
                            }}
                            className="p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-500 transition-all z-20 absolute scale-90 group-hover:scale-100"
                            title="Close tab"
                        >
                            <Icon name="close" size={9} />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
