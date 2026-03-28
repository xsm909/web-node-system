import { useState, useMemo } from 'react';
import { useSchemas, useCreateSchema, useUpdateSchema, useDeleteSchema } from '../../../entities/schema/api';
import type { Schema } from '../../../entities/schema/api';
import { SchemaEditor } from '../../../features/schema-editor/SchemaEditor';
import { Icon } from '../../../shared/ui/icon';
import { ConfirmModal } from '../../../shared/ui/confirm-modal';
import { AppTable } from '../../../shared/ui/app-table';
import { AppTableStandardCell } from '../../../shared/ui/app-table/components/AppTableStandardCell';
import { AppRoundButton } from '../../../shared/ui/app-round-button/AppRoundButton';
import { AppHeader } from '../../../widgets/app-header';
import { AppFormView } from '../../../shared/ui/app-form-view';
import { AppInput } from '../../../shared/ui/app-input';
import { AppCategoryInput } from '../../../shared/ui/app-category-input/AppCategoryInput';
import { getUniqueCategoryPaths } from '../../../shared/lib/categoryUtils';
import { createColumnHelper } from '@tanstack/react-table';


const columnHelper = createColumnHelper<Schema>();

interface SchemaManagementProps {
    onToggleSidebar?: () => void;
    isSidebarOpen?: boolean;
}

export const SchemaManagement = ({ onToggleSidebar, isSidebarOpen }: SchemaManagementProps) => {
    const { data: schemas = [], isLoading } = useSchemas();
    const createMutation = useCreateSchema();
    const updateMutation = useUpdateSchema();
    const deleteMutation = useDeleteSchema();

    const [selectedSchema, setSelectedSchema] = useState<Schema | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const [idToDelete, setIdToDelete] = useState<string | null>(null);

    // Form State
    const [key, setKey] = useState('');
    const [category, setCategory] = useState('');
    const [content, setContent] = useState('{\n  "type": "object",\n  "properties": {}\n}');
    const [isSystem, setIsSystem] = useState(false);
    const [localError, setLocalError] = useState<string | null>(null);
    const [initialFormState, setInitialFormState] = useState({ key: '', category: '', content: '', isSystem: false });

    const allCategoryPaths = useMemo(() => getUniqueCategoryPaths(schemas), [schemas]);

    const handleEdit = (schema: Schema) => {
        setSelectedSchema(schema);
        const data = {
            key: schema.key,
            category: schema.category || '',
            content: JSON.stringify(schema.content, null, 2),
            isSystem: schema.is_system,
        };
        setKey(data.key);
        setCategory(data.category);
        setContent(data.content);
        setIsSystem(data.isSystem);
        setInitialFormState(data);
        setLocalError(null);
        setIsEditing(true);
    };

    const handleCreateNew = () => {
        setSelectedSchema(null);
        const data = {
            key: '',
            category: '',
            content: '{\n  "type": "object",\n  "properties": {}\n}',
            isSystem: false,
        };
        setKey(data.key);
        setCategory(data.category);
        setContent(data.content);
        setIsSystem(data.isSystem);
        setInitialFormState(data);
        setLocalError(null);
        setIsEditing(true);
    };

    const handleDuplicate = (schema: Schema) => {
        setSelectedSchema(null);
        const data = {
            key: `${schema.key}-copy`,
            category: schema.category || '',
            content: JSON.stringify(schema.content, null, 2),
            isSystem: false,
        };
        setKey(data.key);
        setCategory(data.category);
        setContent(data.content);
        setIsSystem(data.isSystem);
        setInitialFormState(data);
        setLocalError(null);
        setIsEditing(true);
    };

    // Unified toggle handled by AppLockToggle

    const handleSave = () => {
        setLocalError(null);
        try {
            const parsedContent = JSON.parse(content);
            const data = {
                key,
                content: parsedContent,
                category: category.trim() || null,
                is_system: isSystem,
            };

            if (selectedSchema) {
                updateMutation.mutate({ id: selectedSchema.id, data }, {
                    onSuccess: (savedSchema) => {
                        setInitialFormState({
                            key: savedSchema.key,
                            category: savedSchema.category || '',
                            content: JSON.stringify(savedSchema.content, null, 2),
                            isSystem: savedSchema.is_system,
                        });
                    }
                });
            } else {
                createMutation.mutate(data, {
                    onSuccess: (savedSchema) => {
                        setSelectedSchema(savedSchema);
                        setInitialFormState({
                            key: savedSchema.key,
                            category: savedSchema.category || '',
                            content: JSON.stringify(savedSchema.content, null, 2),
                            isSystem: savedSchema.is_system,
                        });
                    }
                });
            }
        } catch (e: any) {
            setLocalError(`Invalid JSON format: ${e.message}`);
        }
    };

    const isDirty = key !== initialFormState.key ||
                    category !== initialFormState.category ||
                    content !== initialFormState.content ||
                    isSystem !== initialFormState.isSystem;

    const getErrorMessage = () => {
        if (localError) return localError;
        const err = updateMutation.error || createMutation.error;
        if (!err) return null;

        const detail = (err as any)?.response?.data?.detail;
        if (detail) {
            if (typeof detail === 'string') return detail;
            if (Array.isArray(detail)) return detail.map(d => d.msg || JSON.stringify(d)).join(', ');
            return JSON.stringify(detail);
        }
        return err.message;
    };

    const handleDelete = (id: string, is_system: boolean) => {
        if (is_system) {
            alert("Cannot delete system schemas.");
            return;
        }
        setIdToDelete(id);
    };

    const filteredSchemas = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return schemas;

        return schemas.filter(s => {
            const inKey = s.key.toLowerCase().includes(q);
            const inTitle = s.content?.title?.toLowerCase().includes(q);
            const inCategory = s.category?.toLowerCase().includes(q);
            const inTags = s.meta?.tags?.some((tag: string) => tag.toLowerCase().includes(q));
            return inKey || inTitle || inCategory || inTags;
        });
    }, [schemas, searchQuery]);

    const columns = useMemo(() => [
        columnHelper.accessor('key', {
            header: 'Name',
            cell: info => {
                const schema = info.row.original;
                return (
                    <AppTableStandardCell
                        icon="schema"
                        label={schema.content?.title || schema.key}
                        subtitle={schema.content?.description || (schema.is_system ? 'System Schema' : undefined)}
                        isLocked={schema.is_locked}
                    />
                );
            }
        }),
        columnHelper.display({
            id: 'tags',
            header: 'Tags',
            cell: info => {
                const schema = info.row.original;
                return (
                    <div className="flex flex-wrap gap-1">
                        {schema.meta?.tags?.map((tag: string) => (
                            <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-600 border border-slate-500/20 uppercase tracking-widest">
                                {tag}
                            </span>
                        ))}
                    </div>
                );
            }
        }),
        columnHelper.accessor('updated_at', {
            header: 'Updated',
            cell: info => (
                <span className="text-xs text-gray-500">
                    {new Date(info.getValue()).toLocaleString()}
                </span>
            )
        }),
        columnHelper.display({
            id: 'actions',
            header: () => <div className="text-right">Actions</div>,
            cell: info => {
                const schema = info.row.original;
                return (
                    <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                            onClick={(e) => { e.stopPropagation(); handleDuplicate(schema); }}
                            className="p-2 rounded-lg bg-surface-700 hover:bg-surface-600 transition-colors text-gray-400"
                            title="Duplicate"
                        >
                            <Icon name="content_copy" size={16} />
                        </button>
                        {!schema.is_system && !schema.is_locked && (
                            <button
                                onClick={(e) => { e.stopPropagation(); handleDelete(schema.id, schema.is_system); }}
                                className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 transition-colors text-red-400"
                                title="Delete"
                            >
                                <Icon name="delete" size={16} />
                            </button>
                        )}
                    </div>
                );
            }
        })
    ], []);

    if (isLoading) return <div className="p-8 text-gray-400">Loading schemas...</div>;

    if (isEditing) {
        return (
            <AppFormView
                title={selectedSchema ? selectedSchema.key : (key ? `${key} (New)` : 'New Schema')}
                parentTitle="Schema Registry"
                icon="schema"
                isDirty={isDirty}
                isSaving={updateMutation.isPending || createMutation.isPending}
                error={getErrorMessage() || undefined}
                onSave={handleSave}
                onCancel={() => setIsEditing(false)}
                saveLabel={selectedSchema ? "Save Schema" : "Create Schema"}
                entityId={selectedSchema?.id}
                entityType="schemas"
                isLocked={selectedSchema?.is_locked}
                onLockToggle={(locked) => {
                    if (selectedSchema) {
                        setSelectedSchema({ ...selectedSchema, is_locked: locked });
                    }
                }}
            >
                <div className="flex flex-col gap-6 w-full h-full animate-in fade-in slide-in-from-bottom-4 duration-500 px-2 pt-1 pb-2">
                    <div className="grid grid-cols-2 gap-8">
                        <AppInput
                            label="Schema Key"
                            placeholder="Schema Key (e.g., user-profile)"
                            value={key}
                            onChange={setKey}
                            disabled={!!selectedSchema || (selectedSchema as any)?.is_locked}
                            showCopy={!!selectedSchema || (selectedSchema as any)?.is_locked}
                        />
                        <AppCategoryInput
                            label="Category"
                            placeholder="e.g., Common|Info"
                            value={category}
                            onChange={setCategory}
                            allPaths={allCategoryPaths}
                            disabled={(selectedSchema as any)?.is_locked}
                        />
                    </div>

                    <div>
                        <label className={`flex items-center gap-3 text-sm font-bold text-[var(--text-main)] cursor-pointer w-max ${selectedSchema?.is_locked ? 'cursor-not-allowed' : 'hover:text-brand transition-colors'}`}>
                            <input
                                type="checkbox"
                                checked={isSystem}
                                onChange={e => setIsSystem(e.target.checked)}
                                disabled={(selectedSchema as any)?.is_locked}
                                className="rounded border-[var(--border-base)] text-brand focus:ring-brand w-5 h-5 transition-colors"
                            />
                            System Schema
                        </label>
                    </div>

                    <div className="flex-1 flex flex-col min-h-[500px] mt-4">
                        <label className="text-xs font-black text-[var(--text-main)] uppercase tracking-widest ml-1 mb-3">JSON Schema Content</label>
                        <SchemaEditor
                            initialValue={content}
                            onChange={setContent}
                            readOnly={(selectedSchema as any)?.is_locked}
                        />
                    </div>
                </div>
            </AppFormView>
        );
    }

    return (
        <div className="flex flex-col h-full bg-[var(--bg-app)] overflow-hidden">
            <AppHeader
                onToggleSidebar={onToggleSidebar || (() => { })}
                isSidebarOpen={isSidebarOpen}
                leftContent={
                    <div className="flex items-center gap-3 px-2 lg:px-0">
                        <Icon name="schema" size={24} className="text-brand" />
                        <h1 className="text-lg lg:text-xl font-semibold tracking-tight text-[var(--text-main)] opacity-90 truncate">
                            Schema Registry
                        </h1>
                    </div>
                }
                rightContent={
                    <AppRoundButton
                        onClick={handleCreateNew}
                        icon="add"
                        variant="brand"
                        title="New Schema"
                    />
                }
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                searchPlaceholder="Search by key, category or tags..."
            />

            <AppTable
                data={filteredSchemas}
                columns={columns}
                isSearching={searchQuery.trim().length > 0}
                onRowClick={handleEdit}
                config={{
                    categoryExtractor: s => s.category,
                    persistCategoryKey: 'schema_expanded_categories',
                    emptyMessage: 'No schemas matching your criteria.',
                    indentColumnId: 'key'
                }}
            />

            <ConfirmModal
                isOpen={!!idToDelete}
                title="Delete Schema"
                description="Are you sure you want to delete this schema? This action cannot be undone."
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

