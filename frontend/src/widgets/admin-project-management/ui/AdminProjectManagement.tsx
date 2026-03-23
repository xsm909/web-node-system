import React, { useState, useMemo } from 'react';
import { createColumnHelper } from '@tanstack/react-table';
import { useProjects, useCreateProject, useUpdateProject, useDeleteProject } from '../../../entities/project/api';
import type { Project } from '../../../entities/project/model/types';
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

const columnHelper = createColumnHelper<Project>();

interface AdminProjectManagementProps {
    ownerId: string;
    onHeaderActionsChange?: (actions: React.ReactNode) => void;
}

export const AdminProjectManagement: React.FC<AdminProjectManagementProps> = ({ ownerId, onHeaderActionsChange }) => {
    const { data: projects = [], isLoading } = useProjects(ownerId);
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
    ], []);

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
                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-normal text-[var(--text-main)] ml-1">Theme Color</label>
                            <div className="flex items-center gap-3">
                                <input
                                    type="color"
                                    value={themeColor}
                                    onChange={(e) => setThemeColor(e.target.value)}
                                    disabled={selectedProject?.is_locked}
                                    className="w-10 h-10 rounded-lg overflow-hidden border-2 border-[var(--border-base)] cursor-pointer bg-transparent"
                                />
                                <AppInput
                                    value={themeColor}
                                    onChange={setThemeColor}
                                    disabled={selectedProject?.is_locked}
                                    className="flex-1"
                                />
                            </div>
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
