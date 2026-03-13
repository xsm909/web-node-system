import { useState, useMemo } from 'react';
import { useSchemas, useCreateSchema, useUpdateSchema, useDeleteSchema } from '../../../entities/schema/api';
import type { Schema } from '../../../entities/schema/api';
import { SchemaEditor } from '../../../features/schema-editor/SchemaEditor';
import { Icon } from '../../../shared/ui/icon';
import { ConfirmModal } from '../../../shared/ui/confirm-modal';
import { AppTable } from '../../../shared/ui/app-table';
import { createColumnHelper } from '@tanstack/react-table';

const columnHelper = createColumnHelper<Schema>();

export const AdminSchemaManagement = () => {
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
    const [lock, setLock] = useState(false);

    const handleEdit = (schema: Schema) => {
        setSelectedSchema(schema);
        setKey(schema.key);
        setCategory(schema.category || '');
        setContent(JSON.stringify(schema.content, null, 2));
        setIsSystem(schema.is_system);
        setLock(schema.lock);
        setIsEditing(true);
    };

    const handleCreateNew = () => {
        setSelectedSchema(null);
        setKey('');
        setCategory('');
        setContent('{\n  "type": "object",\n  "properties": {}\n}');
        setIsSystem(false);
        setLock(false);
        setIsEditing(true);
    };

    const handleDuplicate = (schema: Schema) => {
        setSelectedSchema(null);
        setKey(`${schema.key}-copy`);
        setCategory(schema.category || '');
        setContent(JSON.stringify(schema.content, null, 2));
        setIsSystem(false);
        setLock(false);
        setIsEditing(true);
    };

    const handleToggleLock = () => {
        if (!selectedSchema) return;
        const newLockState = !lock;
        setLock(newLockState);
        updateMutation.mutate({ 
            id: selectedSchema.id, 
            data: { lock: newLockState } 
        });
    };

    const handleSave = () => {
        try {
            const parsedContent = JSON.parse(content);
            const data = {
                key,
                content: parsedContent,
                category: category.trim() || null,
                is_system: isSystem,
                lock: lock
            };

            if (selectedSchema) {
                updateMutation.mutate({ id: selectedSchema.id, data }, {
                    onSuccess: () => setIsEditing(false)
                });
            } else {
                createMutation.mutate(data, {
                    onSuccess: () => setIsEditing(false)
                });
            }
        } catch (e) {
            alert("Invalid JSON format in schema content.");
        }
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
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-surface-700 text-brand group-hover:bg-brand group-hover:text-white transition-colors">
                            <Icon name="data_object" size={18} />
                        </div>
                        <div className="flex flex-col min-w-0">
                            <span className="text-sm font-bold text-[var(--text-main)] group-hover:text-brand transition-colors truncate">
                                {schema.content?.title || schema.key}
                            </span>
                            <div className="flex items-center gap-2 mt-0.5">
                                {schema.is_system && (
                                    <span className="text-[9px] font-black text-blue-400 uppercase tracking-tighter opacity-60">System Schema</span>
                                )}
                                {schema.lock && (
                                    <span className="flex items-center gap-1 text-[9px] font-black text-red-400 uppercase tracking-tighter opacity-80">
                                        <Icon name="lock" size={10} />
                                        Locked
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
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
                            <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-brand/10 text-brand border border-brand/20 font-bold uppercase tracking-widest">
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
                    <div className="flex gap-1 justify-end">
                        <button
                            onClick={(e) => { e.stopPropagation(); handleDuplicate(schema); }}
                            className="p-2 rounded-lg bg-surface-700 hover:bg-surface-600 transition-colors text-gray-400 opacity-0 group-hover:opacity-100"
                            title="Duplicate"
                        >
                            <Icon name="content_copy" size={16} />
                        </button>
                        {!schema.is_system && !schema.lock && (
                            <button
                                onClick={(e) => { e.stopPropagation(); handleDelete(schema.id, schema.is_system); }}
                                className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 transition-colors text-red-400 opacity-0 group-hover:opacity-100"
                                title="Delete"
                            >
                                <Icon name="delete" size={16} />
                            </button>
                        )}
                        {schema.lock && (
                            <div className="p-2 text-red-400/40" title="Locked">
                                <Icon name="lock" size={16} />
                            </div>
                        )}
                    </div>
                );
            }
        })
    ], []);

    if (isLoading) return <div className="p-8 text-gray-400">Loading schemas...</div>;

    if (isEditing) {
        return (
            <div className="flex flex-col h-[calc(100vh-12rem)] border border-gray-700 rounded-2xl overflow-hidden bg-surface-800 shadow-xl shadow-black/20 animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-surface-900">
                    <div className="flex gap-4 items-center flex-1 pr-8">
                        <input
                            type="text"
                            placeholder="Schema Key (e.g., user-profile)"
                            value={key}
                            onChange={e => setKey(e.target.value)}
                            disabled={!!selectedSchema || lock}
                            className={`w-1/4 bg-surface-950 border border-gray-700 rounded-lg px-4 py-2 text-sm text-[var(--text-main)] outline-none focus:border-brand ${(selectedSchema || lock) ? 'opacity-50 cursor-not-allowed' : ''}`}
                        />
                        <input
                            type="text"
                            placeholder="Category (e.g., Common|Info)"
                            value={category}
                            onChange={e => setCategory(e.target.value)}
                            disabled={lock}
                            className={`w-1/4 bg-surface-950 border border-gray-700 rounded-lg px-4 py-2 text-sm text-[var(--text-main)] outline-none focus:border-brand ${lock ? 'opacity-50 cursor-not-allowed' : ''}`}
                        />
                        <label className={`flex items-center gap-2 text-sm text-gray-300 ${lock ? 'opacity-50 cursor-not-allowed' : ''}`}>
                            <input
                                type="checkbox"
                                checked={isSystem}
                                onChange={e => setIsSystem(e.target.checked)}
                                disabled={lock}
                                className="rounded border-gray-700 text-brand focus:ring-brand"
                            />
                            System Schema
                        </label>
                        {selectedSchema && (
                            <button
                                onClick={handleToggleLock}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                                    lock 
                                    ? 'bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20' 
                                    : 'bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20'
                                }`}
                            >
                                <Icon name={lock ? 'lock' : 'unlock'} size={14} />
                                {lock ? 'Unlock to Edit' : 'Lock Schema'}
                            </button>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setIsEditing(false)}
                            className="px-4 py-2 rounded-xl bg-surface-700 hover:bg-surface-600 transition-colors text-sm font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={updateMutation.isPending || createMutation.isPending || lock}
                            className={`px-4 py-2 rounded-xl bg-brand hover:brightness-110 transition-colors text-white text-sm font-bold flex items-center gap-2 ${lock ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            <Icon name="save" size={16} />
                            Save Schema
                        </button>
                    </div>
                </div>
                <div className="flex-1 p-4 bg-surface-950 min-h-0">
                    <SchemaEditor
                        initialValue={content}
                        onChange={setContent}
                        readOnly={lock}
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <AppTable
                data={filteredSchemas}
                columns={columns}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                isSearching={searchQuery.trim().length > 0}
                onRowClick={handleEdit}
                config={{
                    title: 'Schema Registry',
                    searchPlaceholder: 'Search by key, category or tags...',
                    primaryAction: {
                        icon: 'add',
                        label: 'New Schema',
                        onClick: handleCreateNew
                    },
                    categoryExtractor: s => s.category,
                    persistCategoryKey: 'schema_expanded_categories',
                    emptyMessage: 'No schemas matching your criteria.'
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

