import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Project } from '../../entities/project/model/types';
import { UI_CONSTANTS } from '../../shared/ui/constants';

interface ProjectState {
    activeProject: Project | null;
    isProjectMode: boolean;
    activateProject: (project: Project) => void;
    exitProject: () => void;
}

const DEFAULT_BRAND_COLOR = UI_CONSTANTS.BRAND;
const DEFAULT_BRAND_HOVER_COLOR = UI_CONSTANTS.BRAND_HOVER;

// Helper to update CSS variables
const updateThemeColors = (color: string | null) => {
    if (color) {
        document.documentElement.style.setProperty('--brand', color);
        // Generate a slightly darker hover color or just use the same for simplicity
        // For now, let's just use the same since we don't have a color utility here
        document.documentElement.style.setProperty('--brand-hover', color);
    } else {
        document.documentElement.style.setProperty('--brand', DEFAULT_BRAND_COLOR);
        document.documentElement.style.setProperty('--brand-hover', DEFAULT_BRAND_HOVER_COLOR);
    }
};

export const useProjectStore = create<ProjectState>()(
    persist(
        (set) => ({
            activeProject: null,
            isProjectMode: false,

            activateProject: (project) => {
                set({ activeProject: project, isProjectMode: true });
                updateThemeColors(project.theme_color);
            },

            exitProject: () => {
                set({ activeProject: null, isProjectMode: false });
                updateThemeColors(null);
            },
        }),
        {
            name: 'project-storage',
            onRehydrateStorage: () => (state) => {
                if (state?.isProjectMode && state.activeProject) {
                    updateThemeColors(state.activeProject.theme_color);
                }
            },
        }
    )
);
