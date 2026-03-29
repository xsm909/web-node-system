import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Project } from '../../entities/project/model/types';
import { UI_CONSTANTS } from '../../shared/ui/constants';

interface ProjectState {
    // Persistent selections (from sidebar/login)
    baseProject: Project | null;
    isBaseProjectMode: boolean;

    // Current effective state (used by UI/API)
    activeProject: Project | null;
    isProjectMode: boolean;

    // Actions
    activateProject: (project: Project) => void;
    exitProject: () => void;
    
    /**
     * Temporarily overrides the project context (e.g. from a pinned tab).
     * @param project - The project to override with. 
     *                  null for global mode. 
     *                  undefined to restore to base context.
     */
    setPinnedContext: (project: Project | null | undefined) => void;
}

const DEFAULT_BRAND_COLOR = UI_CONSTANTS.BRAND;

const updateThemeColors = (color: string | null) => {
    const brand = color || DEFAULT_BRAND_COLOR;
    document.documentElement.style.setProperty('--brand', brand);
    document.documentElement.style.setProperty('--brand-hover', brand); 
};

export const useProjectStore = create<ProjectState>()(
    persist(
        (set, get) => ({
            baseProject: null,
            isBaseProjectMode: false,
            activeProject: null,
            isProjectMode: false,

            activateProject: (project) => {
                set({ 
                    baseProject: project, 
                    isBaseProjectMode: true,
                    activeProject: project,
                    isProjectMode: true
                });
                updateThemeColors(project.theme_color);
            },
            
            exitProject: () => {
                set({ 
                    baseProject: null, 
                    isBaseProjectMode: false,
                    activeProject: null,
                    isProjectMode: false
                });
                updateThemeColors(null);
            },

            setPinnedContext: (project) => {
                if (project === undefined) {
                    // Restore to base context
                    const base = get().baseProject;
                    set({ 
                        activeProject: base, 
                        isProjectMode: !!base 
                    });
                    updateThemeColors(base?.theme_color || null);
                } else {
                    // Temporarily override with specific project or null (global)
                    set({ 
                        activeProject: project, 
                        isProjectMode: !!project 
                    });
                    updateThemeColors(project?.theme_color || null);
                }
            }
        }),
        {
            name: 'project-storage',
            partialize: (state) => ({
                baseProject: state.baseProject,
                isBaseProjectMode: state.isBaseProjectMode,
                // We DON'T persist activeProject/isProjectMode as they are transient overrides
            }),
            onRehydrateStorage: () => (state) => {
                if (state) {
                    // On load, the effective state is the base state
                    state.activeProject = state.baseProject;
                    state.isProjectMode = state.isBaseProjectMode;
                    updateThemeColors(state.baseProject?.theme_color || null);
                }
            },
        }
    )
);
