import { create } from 'zustand';

interface NavigationBlocker {
    id: string;
    isDirty: boolean;
    onSave: () => Promise<void>;
    onDiscard: () => void;
}

interface NavigationGuardStore {
    blockers: Record<string, NavigationBlocker>;
    registerBlocker: (blocker: NavigationBlocker) => void;
    unregisterBlocker: (id: string) => void;
    updateBlocker: (id: string, isDirty: boolean) => void;
    isAnyDirty: () => boolean;
    getDirtyBlocker: () => NavigationBlocker | null;
}

export const useNavigationGuardStore = create<NavigationGuardStore>((set, get) => ({
    blockers: {},
    registerBlocker: (blocker) => set((state) => ({
        blockers: { ...state.blockers, [blocker.id]: blocker }
    })),
    unregisterBlocker: (id) => set((state) => {
        const newBlockers = { ...state.blockers };
        delete newBlockers[id];
        return { blockers: newBlockers };
    }),
    updateBlocker: (id, isDirty) => set((state) => {
        if (!state.blockers[id]) return state;
        return {
            blockers: {
                ...state.blockers,
                [id]: { ...state.blockers[id], isDirty }
            }
        };
    }),
    isAnyDirty: () => {
        return Object.values(get().blockers).some(b => b.isDirty);
    },
    getDirtyBlocker: () => {
        return Object.values(get().blockers).find(b => b.isDirty) || null;
    }
}));
