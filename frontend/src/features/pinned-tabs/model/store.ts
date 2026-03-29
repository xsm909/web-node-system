import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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

            updateTab: (id, updates) => set((state) => ({
                tabs: state.tabs.map((t) => t.id === id ? { ...t, ...updates } : t)
            })),
        }),
        {
            name: 'pinned-tabs-storage',
        }
    )
);
