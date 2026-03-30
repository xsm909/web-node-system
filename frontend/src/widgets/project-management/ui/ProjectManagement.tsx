import React, { useState, useMemo, useRef, useEffect, useLayoutEffect } from 'react';
import { createColumnHelper } from '@tanstack/react-table';
import { useProjects, useCreateProject, useUpdateProject, useDeleteProject } from '../../../entities/project/api';
import type { Project } from '../../../entities/project/model/types';
import { createPortal } from 'react-dom';
import { AppTable } from '../../../shared/ui/app-table';
import { AppTableStandardCell } from '../../../shared/ui/app-table/components/AppTableStandardCell';
import { AppRoundButton } from '../../../shared/ui/app-round-button/AppRoundButton';
import { AppHeader } from '../../app-header';
import { AppFormView } from '../../../shared/ui/app-form-view';
import { AppInput } from '../../../shared/ui/app-input';
import { AppCategoryInput } from '../../../shared/ui/app-category-input/AppCategoryInput';
import { Icon } from '../../../shared/ui/icon';
import { ConfirmModal } from '../../../shared/ui/confirm-modal';
import { getUniqueCategoryPaths } from '../../../shared/lib/categoryUtils';
import { useProjectStore } from '../../../features/projects/store';

const hslToHex = (h: number, s: number, l: number) => {
    l /= 100;
    const a = s * Math.min(l, 1 - l) / 100;
    const f = (n: number) => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
};

const generateDarkPalette = () => {
    const colors: string[] = [];
    const hues = 16;
    const levels = 10;
    
    for (let l = 0; l < levels; l++) {
        const lightness = 15 + (l * 3); // 15% to 42% lightness
        for (let h = 0; h < hues; h++) {
            const hue = h * (360 / hues);
            colors.push(hslToHex(hue, 70, lightness));
        }
    }
    return colors;
};

const PRESET_COLORS = generateDarkPalette();
 
const columnHelper = createColumnHelper<Project>();

interface ProjectManagementProps {
    ownerId: string;
    onHeaderActionsChange?: (actions: React.ReactNode) => void;
    initialEditId?: string | null;
}

export const ProjectManagement: React.FC<ProjectManagementProps> = ({ ownerId, onHeaderActionsChange, initialEditId }) => {
    const { data: projects = [], isLoading } = useProjects(ownerId);
    
    // Deep link support
    useEffect(() => {
        if (initialEditId && projects.length > 0) {
            const project = projects.find(p => p.id === initialEditId);
            if (project) {
                handleEdit(project);
            }
        }
    }, [initialEditId, projects]);
    const createMutation = useCreateProject();
    const updateMutation = useUpdateProject();
    const deleteMutation = useDeleteProject();

    const { activateProject, activeProject: currentActiveProject } = useProjectStore();
    // ...

    const [selectedProject, setSelectedProject] = useState<Project | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [idToDelete, setIdToDelete] = useState<string | null>(null);

    // Form State
    const [key, setKey] = useState('');
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState('general');
    const [themeColor, setThemeColor] = useState('#3b82f6');
    const [initialFormState, setInitialFormState] = useState({ key: '', name: '', description: '', category: 'general', themeColor: '#3b82f6' });
    const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
    const colorPickerTriggerRef = useRef<HTMLDivElement>(null);
    const colorPickerDropdownRef = useRef<HTMLDivElement>(null);
    const [pickerCoords, setPickerCoords] = useState({ top: 0, left: 0 });

    const allCategoryPaths = useMemo(() => getUniqueCategoryPaths(projects), [projects]);

    const handleEdit = (project: Project) => {
        setSelectedProject(project);
        const data = {
            key: project.key,
            name: project.name,
            description: project.description || '',
            category: project.category || 'general',
            themeColor: project.theme_color || '#3b82f6',
        };
        setKey(data.key);
        setName(data.name);
        setDescription(data.description);
        setCategory(data.category);
        setThemeColor(data.themeColor);
        setInitialFormState(data);
        setIsEditing(true);
    };

    const handleCreateNew = () => {
        setSelectedProject(null);
        const data = {
            key: '',
            name: '',
            description: '',
            category: 'general',
            themeColor: '#3b82f6',
        };
        setKey(data.key);
        setName(data.name);
        setDescription(data.description);
        setCategory(data.category);
        setThemeColor(data.themeColor);
        setInitialFormState(data);
        setIsEditing(true);
    };

    const updatePickerCoords = () => {
        if (colorPickerTriggerRef.current) {
            const rect = colorPickerTriggerRef.current.getBoundingClientRect();
            setPickerCoords({ top: rect.top + rect.height + 4, left: rect.left });
        }
    };

    useLayoutEffect(() => {
        if (isColorPickerOpen) {
            updatePickerCoords();
            window.addEventListener('resize', updatePickerCoords);
            window.addEventListener('scroll', updatePickerCoords, true);
        }
        return () => {
            window.removeEventListener('resize', updatePickerCoords);
            window.removeEventListener('scroll', updatePickerCoords, true);
        };
    }, [isColorPickerOpen]);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            const isInsideTrigger = colorPickerTriggerRef.current?.contains(e.target as Node);
            const isInsideDropdown = colorPickerDropdownRef.current?.contains(e.target as Node);
            
            if (isColorPickerOpen && !isInsideTrigger && !isInsideDropdown) {
                setIsColorPickerOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [isColorPickerOpen]);

    const handleThemeColorChange = (newColor: string) => {
        let finalColor = newColor;
        
        // Only enforce brightness on valid hex colors
        if (/^#[0-9A-Fa-f]{6}$/.test(newColor)) {
            const r = parseInt(newColor.slice(1, 3), 16);
            const g = parseInt(newColor.slice(3, 5), 16);
            const b = parseInt(newColor.slice(5, 7), 16);
            const brightness = (r * 299 + g * 587 + b * 114) / 1000;

            if (brightness > 120) { // Keep brightness below ~47% (120/255)
                const factor = 110 / brightness; // Aim a bit lower for safety
                const dr = Math.floor(r * factor);
                const dg = Math.floor(g * factor);
                const db = Math.floor(b * factor);
                const toHex = (n: number) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0');
                finalColor = `#${toHex(dr)}${toHex(dg)}${toHex(db)}`;
            }
        }
        
        setThemeColor(finalColor);
    };

    const handleSave = () => {
        const data = {
            key,
            name,
            description: description.trim() || null,
            category: category.trim() || 'general',
            theme_color: themeColor,
            owner_id: ownerId,
        };

        if (selectedProject) {
            updateMutation.mutate({ id: selectedProject.id, data }, {
                onSuccess: (saved) => {
                    setInitialFormState({
                        key: saved.key,
                        name: saved.name,
                        description: saved.description || '',
                        category: saved.category || 'general',
                        themeColor: saved.theme_color || '#3b82f6',
                    });
                }
            });
        } else {
            createMutation.mutate(data as any, {
                onSuccess: (saved) => {
                    setSelectedProject(saved);
                    setInitialFormState({
                        key: saved.key,
                        name: saved.name,
                        description: saved.description || '',
                        category: saved.category || 'general',
                        themeColor: saved.theme_color || '#3b82f6',
                    });
                }
            });
        }
    };

    const isDirty = key !== initialFormState.key ||
                    name !== initialFormState.name ||
                    description !== initialFormState.description ||
                    category !== initialFormState.category ||
                    themeColor !== initialFormState.themeColor;

    const filteredProjects: Project[] = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return projects;
        return projects.filter(p =>
            p.name.toLowerCase().includes(q) ||
            p.key.toLowerCase().includes(q) ||
            p.category.toLowerCase().includes(q)
        );
    }, [projects, searchQuery]);

    const columns = useMemo(() => [
        columnHelper.accessor('name', {
            header: 'Project Name',
            cell: info => {
                const project = info.row.original;
                const isActive = currentActiveProject?.id === project.id;
                return (
                    <div className="flex items-center gap-2 group/row">
                        <AppRoundButton
                            icon={isActive ? "verified" : "play"}
                            onClick={(e) => {
                                e.stopPropagation();
                                activateProject(project);
                            }}
                            size="small"
                            variant="brand"
                            title={isActive ? "Project Active" : "Activate Project"}
                            className={isActive ? 'shadow-brand/40' : 'opacity-0 group-hover/row:opacity-100'}
                        />
                        <AppTableStandardCell
                            icon="project"
                            label={project.name}
                            subtitle={project.key}
                            isLocked={project.is_locked}
                        />
                    </div>
                );
            }
        }),
        columnHelper.accessor('category', {
            header: 'Category',
            cell: info => (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-600 border border-slate-500/20 uppercase tracking-widest">
                    {info.getValue()}
                </span>
            )
        }),
        columnHelper.display({
            id: 'actions',
            header: () => <div className="text-right">Actions</div>,
            cell: info => {
                const project = info.row.original as Project;
                if (project.is_locked) return null;
                return (
                    <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                            onClick={(e) => { e.stopPropagation(); setIdToDelete(project.id); }}
                            className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 transition-colors text-red-400"
                            title="Delete"
                        >
                            <Icon name="delete" size={16} />
                        </button>
                    </div>
                );
            }
        })
    ], [currentActiveProject]);

    React.useEffect(() => {
        onHeaderActionsChange?.(null);
    }, [onHeaderActionsChange]);

    if (isEditing) {
        return (
            <AppFormView
                title={selectedProject ? selectedProject.name : (name ? `${name} (New)` : 'New Project')}
                parentTitle="Projects"
                icon="project"
                isDirty={isDirty}
                isSaving={updateMutation.isPending || createMutation.isPending}
                onSave={handleSave}
                onCancel={() => setIsEditing(false)}
                saveLabel={selectedProject ? "Save Project" : "Create Project"}
                entityId={selectedProject?.id}
                entityType="projects"
                isLocked={selectedProject?.is_locked}
                onLockToggle={(locked) => {
                    if (selectedProject) {
                        setSelectedProject({ ...selectedProject, is_locked: locked });
                    }
                }}
            >
                <div className="flex flex-col gap-6 w-full animate-in fade-in slide-in-from-bottom-4 duration-500 px-2 pt-1 pb-2 max-w-5xl mx-auto">
                    <div className="grid grid-cols-2 gap-8">
                        <AppInput
                            label="Project Key"
                            placeholder="PROJECT-KEY"
                            value={key}
                            onChange={(val) => setKey(val.toUpperCase().replace(/\s+/g, '-'))}
                            disabled={!!selectedProject && (selectedProject.is_locked || false)}
                            showCopy={!!selectedProject}
                        />
                        <AppInput
                            label="Project Name"
                            placeholder="My Awesome Project"
                            value={name}
                            onChange={setName}
                            disabled={selectedProject?.is_locked}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-8">
                        <AppCategoryInput
                            label="Category"
                            placeholder="e.g., Development|Web"
                            value={category}
                            onChange={setCategory}
                            allPaths={allCategoryPaths}
                            disabled={selectedProject?.is_locked}
                        />
                        <div className="relative" ref={colorPickerTriggerRef}>
                            <AppInput
                                label="Theme Color"
                                value={themeColor}
                                onChange={handleThemeColorChange}
                                disabled={selectedProject?.is_locked}
                                leftActions={[
                                    {
                                        onClick: () => {
                                            if (!isColorPickerOpen) updatePickerCoords();
                                            setIsColorPickerOpen(!isColorPickerOpen);
                                        },
                                        disabled: selectedProject?.is_locked,
                                        title: "Pick Color",
                                        render: () => (
                                            <div 
                                                className="w-5 h-5 rounded-md border border-[var(--border-base)] shadow-sm transition-transform active:scale-90"
                                                style={{ backgroundColor: themeColor }}
                                            />
                                        )
                                    }
                                ]}
                            />
 
                            {isColorPickerOpen && !selectedProject?.is_locked && createPortal(
                                <div 
                                    ref={colorPickerDropdownRef}
                                    className="fixed z-[9999] p-2 bg-[var(--bg-app)] border border-[var(--border-base)] rounded-xl shadow-2xl animate-in fade-in duration-200 ease-in-out"
                                    style={{ top: pickerCoords.top, left: pickerCoords.left }}
                                >
                                    <div 
                                        className="grid gap-1"
                                        style={{ gridTemplateColumns: 'repeat(16, minmax(0, 1fr))' }}
                                    >
                                        {PRESET_COLORS.map(color => (
                                            <button
                                                key={color}
                                                type="button"
                                                onClick={() => {
                                                    handleThemeColorChange(color);
                                                    setIsColorPickerOpen(false);
                                                }}
                                                className={`w-3.5 h-3.5 rounded-sm border border-white/5 transition-all hover:scale-125 hover:z-10 hover:shadow-lg active:scale-90 ${themeColor === color ? 'ring-1 ring-brand ring-offset-1 ring-offset-[var(--bg-app)]' : ''}`}
                                                style={{ backgroundColor: color }}
                                                title={color}
                                            />
                                        ))}
                                    </div>
                                </div>,
                                document.body
                            )}
                        </div>
                    </div>

                    <AppInput
                        label="Description"
                        placeholder="Project description..."
                        value={description}
                        onChange={setDescription}
                        disabled={selectedProject?.is_locked}
                        multiline
                    />
                </div>
            </AppFormView>
        );
    }

    return (
        <div className="flex flex-col h-full bg-[var(--bg-app)] overflow-hidden">
            <AppHeader
                onToggleSidebar={() => {}}
                leftContent={
                    <div className="flex items-center gap-3 px-2 lg:px-0">
                        <h1 className="text-lg font-semibold tracking-tight text-[var(--text-main)] opacity-90">
                            Projects
                        </h1>
                    </div>
                }
                rightContent={
                    <AppRoundButton
                        onClick={handleCreateNew}
                        icon="add"
                        variant="brand"
                        title="New Project"
                    />
                }
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                searchPlaceholder="Search projects..."
            />

            <AppTable
                data={filteredProjects}
                columns={columns}
                isLoading={isLoading}
                onRowClick={handleEdit}
                isSearching={searchQuery.trim().length > 0}
                config={{
                    categoryExtractor: p => p.category,
                    emptyMessage: 'No projects found for this user.',
                    indentColumnId: 'name'
                }}
            />

            <ConfirmModal
                isOpen={!!idToDelete}
                title="Delete Project"
                description="Are you sure you want to delete this project? This action cannot be undone."
                confirmLabel="Delete"
                isLoading={deleteMutation.isPending}
                onConfirm={() => {
                    if (idToDelete) {
                        deleteMutation.mutate(idToDelete, {
                            onSuccess: () => setIdToDelete(null)
                        });
                    }
                }}
                onCancel={() => setIdToDelete(null)}
            />
        </div>
    );
};
