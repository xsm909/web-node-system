import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface Viewport {
    x: number;
    y: number;
    zoom: number;
}

interface ViewportState {
    viewports: Record<string, Viewport>;
    setViewport: (workflowId: string, viewport: Viewport) => void;
    getViewport: (workflowId: string) => Viewport | null;
    clearViewport: (workflowId: string) => void;
}

export const useViewportStore = create<ViewportState>()(
    persist(
        (set, get) => ({
            viewports: {},
            setViewport: (workflowId, viewport) => set((state) => ({
                viewports: {
                    ...state.viewports,
                    [workflowId]: viewport
                }
            })),
            getViewport: (workflowId) => get().viewports[workflowId] || null,
            clearViewport: (workflowId) => set((state) => {
                const { [workflowId]: _, ...rest } = state.viewports;
                return { viewports: rest };
            }),
        }),
        {
            name: 'workflow-viewports',
        }
    )
);
