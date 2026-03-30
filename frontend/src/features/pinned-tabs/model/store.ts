import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { arrayMove } from '@dnd-kit/sortable';

export const isMetadataEqual = (a: any, b: any) => {
    if (!a && !b) return true;
    if (!a || !b) return false;
    return (a.title === b.title || (a.title === undefined && b.title === undefined)) &&
           (a.icon === b.icon || (a.icon === undefined && b.icon === undefined)) &&
           (a.projectId === b.projectId || (a.projectId === undefined && b.projectId === undefined)) &&
           (a.isDirty === b.isDirty || (a.isDirty === undefined && b.isDirty === undefined));
};

export type PinnedTab = {
    id: string; // Composite ID: entityType:entityId
    entityType: string;
    entityId: string;
    title: string;
    icon?: string;
    projectId?: string | null;
    isDirty?: boolean;
    // Store the props/state needed to reconstruct the form view
    // or we can rely on the entityType/entityId to fetch data
};

interface PinnedTabsState {
    tabs: PinnedTab[];
    activeTabId: string | null;
    
    // Actions
    pin: (tab: Omit<PinnedTab, 'id'>) => void;
    unpin: (id: string) => void;
    focus: (id: string | null) => void;
    updateTab: (id: string, updates: Partial<PinnedTab>) => void;
    reorderTabs: (activeId: string, overId: string) => void;
}

export const usePinStore = create<PinnedTabsState>()(
    persist(
        (set) => ({
            tabs: [],
            activeTabId: null,

            pin: (tabData) => {
                const id = `${tabData.entityType}:${tabData.entityId}`;
                set((state) => {
                    if (state.tabs.find((t) => t.id === id)) {
                        return { activeTabId: id, tabs: state.tabs.map(t => t.id === id ? { ...t, ...tabData } : t) };
                    }
                    return {
                        tabs: [...state.tabs, { ...tabData, id }],
                        activeTabId: id,
                    };
                });
            },

            unpin: (id) => {
                set((state) => {
                    const newTabs = state.tabs.filter((t) => t.id !== id);
                    let newActiveId = state.activeTabId;
                    if (state.activeTabId === id) {
                        newActiveId = newTabs.length > 0 ? newTabs[newTabs.length - 1].id : null;
                    }
                    return {
                        tabs: newTabs,
                        activeTabId: newActiveId,
                    };
                });
            },

            focus: (id) => set({ activeTabId: id }),

            updateTab: (id, updates) => set((state) => {
                const tabIndex = state.tabs.findIndex(t => t.id === id);
                if (tabIndex === -1) return state;

                const tab = state.tabs[tabIndex];
                
                // Use strict metadata comparison to avoid infinite loops
                if (isMetadataEqual(tab, { ...tab, ...updates })) {
                    return state; 
                }

                const newTabs = [...state.tabs];
                newTabs[tabIndex] = { ...tab, ...updates };

                return {
                    tabs: newTabs
                };
            }),

            reorderTabs: (activeId, overId) => {
                set((state) => {
                    const oldIndex = state.tabs.findIndex((t) => t.id === activeId);
                    const newIndex = state.tabs.findIndex((t) => t.id === overId);
                    if (oldIndex !== -1 && newIndex !== -1) {
                        return {
                            tabs: arrayMove(state.tabs, oldIndex, newIndex),
                        };
                    }
                    return state;
                });
            },
        }),
        {
            name: 'pinned-tabs-storage',
        }
    )
);
