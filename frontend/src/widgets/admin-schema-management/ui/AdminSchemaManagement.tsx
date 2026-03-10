import React, { useState, useMemo } from 'react';
import { useSchemas, useCreateSchema, useUpdateSchema, useDeleteSchema } from '../../../entities/schema/api';
import type { Schema } from '../../../entities/schema/api';
import { SchemaEditor } from '../../../features/schema-editor/SchemaEditor';
import { Icon } from '../../../shared/ui/icon';
import { buildCategoryTree } from '../../../shared/lib/categoryUtils';
import type { CategoryTreeNode } from '../../../shared/lib/categoryUtils';
import { getCookie, setCookie } from '../../../shared/lib/cookieUtils';
import { ConfirmModal } from '../../../shared/ui/confirm-modal';

export const AdminSchemaManagement: React.FC = () => {
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

    // Persistence for expanded categories (collapsed by default)
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(() => {
        const saved = getCookie('schema_expanded_categories');
        if (saved) return new Set(JSON.parse(saved));
        return new Set(); // Empty means all collapsed by default
    });

    const toggleCategory = (path: string) => {
        setExpandedCategories(prev => {
            const next = new Set(prev);
            if (next.has(path)) next.delete(path);
            else next.add(path);
            setCookie('schema_expanded_categories', JSON.stringify(Array.from(next)));
            return next;
        });
    };

    const handleEdit = (schema: Schema) => {
        setSelectedSchema(schema);
        setKey(schema.key);
        setCategory(schema.category || '');
        setContent(JSON.stringify(schema.content, null, 2));
        setIsSystem(schema.is_system);
        setIsEditing(true);
    };

    const handleCreateNew = () => {
        setSelectedSchema(null);
        setKey('');
        setCategory('');
        setContent('{\n  "type": "object",\n  "properties": {}\n}');
        setIsSystem(false);
        setIsEditing(true);
    };

    const handleDuplicate = (schema: Schema) => {
        setSelectedSchema(null);
        setKey(`${schema.key}-copy`);
        setCategory(schema.category || '');
        setContent(JSON.stringify(schema.content, null, 2));
        setIsSystem(false);
        setIsEditing(true);
    };

    const handleSave = () => {
        try {
            const parsedContent = JSON.parse(content);
            const data = {
                key,
                content: parsedContent,
                category: category.trim() || null,
                is_system: isSystem
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

    const schemaTree = useMemo(() => {
        if (searchQuery.trim()) return null;
        return buildCategoryTree(schemas);
    }, [schemas, searchQuery]);

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
                            disabled={!!selectedSchema}
                            className={`w-1/3 bg-surface-950 border border-gray-700 rounded-lg px-4 py-2 text-sm text-[var(--text-main)] outline-none focus:border-brand ${selectedSchema ? 'opacity-50 cursor-not-allowed' : ''}`}
                        />
                        <input
                            type="text"
                            placeholder="Category (e.g., Common|Info)"
                            value={category}
                            onChange={e => setCategory(e.target.value)}
                            className="w-1/3 bg-surface-950 border border-gray-700 rounded-lg px-4 py-2 text-sm text-[var(--text-main)] outline-none focus:border-brand"
                        />
                        <label className="flex items-center gap-2 text-sm text-gray-300">
                            <input
                                type="checkbox"
                                checked={isSystem}
                                onChange={e => setIsSystem(e.target.checked)}
                                className="rounded border-gray-700 text-brand focus:ring-brand"
                            />
                            System Schema
                        </label>
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
                            disabled={updateMutation.isPending || createMutation.isPending}
                            className="px-4 py-2 rounded-xl bg-brand hover:brightness-110 transition-colors text-white text-sm font-bold flex items-center gap-2"
                        >
                            <Icon name="save" size={16} />
                            Save Schema
                        </button>
                    </div>
                </div>
                <div className="flex-1 p-4 bg-surface-950">
                    <SchemaEditor
                        initialValue={content}
                        onChange={setContent}
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-6 flex-1 pr-12">
                    <h2 className="text-xl font-bold tracking-tight whitespace-nowrap">Schema Registry</h2>
                    <div className="relative flex-1 max-w-lg">
                        <Icon name="search" size={14} className="absolute left-4 top-1/2 -translate-y-1/2 opacity-40 text-[var(--text-main)]" />
                        <input
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Search by key, category or tags..."
                            className="w-full bg-surface-800 border border-gray-700 rounded-2xl pl-10 pr-4 py-2.5 text-sm text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand/40 transition-all shadow-inner"
                        />
                    </div>
                </div>
                <button
                    onClick={handleCreateNew}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand hover:brightness-110 text-white text-sm font-bold shadow-lg shadow-brand/20 transition-transform active:scale-95"
                >
                    <Icon name="add" size={18} />
                    New Schema
                </button>
            </div>

            <div className="bg-surface-800 rounded-2xl border border-gray-700/50 overflow-hidden shadow-xl shadow-black/10">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-gray-700 bg-surface-900/50">
                            <th className="px-6 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Name</th>
                            <th className="px-6 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Tags</th>
                            <th className="px-6 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Updated</th>
                            <th className="px-6 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700/50">
                        {searchQuery.trim() ? (
                            filteredSchemas.map(schema => (
                                <SchemaRow key={schema.id} schema={schema} onEdit={handleEdit} onDelete={handleDelete} onDuplicate={handleDuplicate} />
                            ))
                        ) : (
                            schemaTree && (
                                <CategoryRows
                                    name="Root"
                                    node={schemaTree}
                                    path=""
                                    level={-1}
                                    expandedCategories={expandedCategories}
                                    onToggle={toggleCategory}
                                    onEdit={handleEdit}
                                    onDelete={handleDelete}
                                    onDuplicate={handleDuplicate}
                                />
                            )
                        )}
                        {filteredSchemas.length === 0 && (
                            <tr>
                                <td colSpan={4} className="px-6 py-12 text-center text-gray-500 italic">
                                    No schemas matching your criteria.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

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

interface SchemaRowProps {
    schema: Schema;
    onEdit: (schema: Schema) => void;
    onDelete: (id: string, is_system: boolean) => void;
    onDuplicate: (schema: Schema) => void;
    level?: number;
}

const SchemaRow: React.FC<SchemaRowProps> = ({ schema, onEdit, onDelete, onDuplicate, level = 0 }) => (
    <tr
        onClick={() => onEdit(schema)}
        className="group hover:bg-brand/5 transition-colors cursor-pointer"
    >
        <td className="px-6 py-4" style={{ paddingLeft: `${1.5 + level * 1.5}rem` }}>
            <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-surface-700 text-brand group-hover:bg-brand group-hover:text-white transition-colors">
                    <Icon name="data_object" size={18} />
                </div>
                <div className="flex flex-col min-w-0">
                    <span className="text-sm font-bold text-[var(--text-main)] group-hover:text-brand transition-colors truncate">
                        {schema.content?.title || schema.key}
                    </span>
                    {schema.is_system && (
                        <span className="text-[9px] font-black text-blue-400 uppercase tracking-tighter mt-0.5 opacity-60">System Schema</span>
                    )}
                </div>
            </div>
        </td>
        <td className="px-6 py-4">
            <div className="flex flex-wrap gap-1">
                {schema.meta?.tags?.map((tag: string) => (
                    <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-brand/10 text-brand border border-brand/20 font-bold uppercase tracking-widest">
                        {tag}
                    </span>
                ))}
            </div>
        </td>
        <td className="px-6 py-4">
            <span className="text-xs text-gray-500">
                {new Date(schema.updated_at).toLocaleString()}
            </span>
        </td>
        <td className="px-6 py-4 text-right">
            <div className="flex gap-1 justify-end">
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onDuplicate(schema);
                    }}
                    className="p-2 rounded-lg bg-surface-700 hover:bg-surface-600 transition-colors text-gray-400 opacity-0 group-hover:opacity-100"
                    title="Duplicate"
                >
                    <Icon name="content_copy" size={16} />
                </button>
                {!schema.is_system && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete(schema.id, schema.is_system);
                        }}
                        className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 transition-colors text-red-400 opacity-0 group-hover:opacity-100"
                        title="Delete"
                    >
                        <Icon name="delete" size={16} />
                    </button>
                )}
            </div>
        </td>
    </tr>
);

interface CategoryRowsProps {
    name: string;
    node: CategoryTreeNode<Schema>;
    path: string;
    level: number;
    expandedCategories: Set<string>;
    onToggle: (path: string) => void;
    onEdit: (schema: Schema) => void;
    onDelete: (id: string, is_system: boolean) => void;
    onDuplicate: (schema: Schema) => void;
}

/**
 * Recursively counts all nodes in a category tree node.
 */
function countTotalNodes<T>(node: CategoryTreeNode<T>): number {
    let count = node.nodes.length;
    for (const child of Object.values(node.children)) {
        count += countTotalNodes(child);
    }
    return count;
}

const CategoryRows: React.FC<CategoryRowsProps> = ({
    name,
    node,
    path,
    level,
    expandedCategories,
    onToggle,
    onEdit,
    onDelete,
    onDuplicate
}) => {
    const isRoot = name === "Root";
    const isExpanded = isRoot || expandedCategories.has(path);
    const totalCount = countTotalNodes(node);

    if (isRoot) {
        return (
            <>
                {Object.entries(node.children).map(([childKey, childNode]) => (
                    <CategoryRows
                        key={childKey}
                        name={childNode.name}
                        node={childNode}
                        path={childKey}
                        level={0}
                        expandedCategories={expandedCategories}
                        onToggle={onToggle}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        onDuplicate={onDuplicate}
                    />
                ))}
                {node.nodes.map(schema => (
                    <SchemaRow
                        key={schema.id}
                        schema={schema}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        onDuplicate={onDuplicate}
                        level={0}
                    />
                ))}
            </>
        );
    }

    return (
        <>
            <tr
                className="bg-surface-900/30 hover:bg-surface-700/50 cursor-pointer transition-colors border-l-2 border-brand/30"
                onClick={() => onToggle(path)}
            >
                <td colSpan={4} className="px-6 py-2" style={{ paddingLeft: `${1.5 + level * 1.5}rem` }}>
                    <div className="flex items-center gap-2">
                        <Icon
                            name={isExpanded ? 'down' : 'play'}
                            size={14}
                            className="text-gray-500 opacity-60"
                        />
                        <Icon name="folder_code" size={16} className="text-brand/70" />
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{node.name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-surface-700 text-gray-400 border border-gray-600/50 font-mono">
                            {totalCount}
                        </span>
                    </div>
                </td>
            </tr>
            {isExpanded && (
                <>
                    {Object.entries(node.children).map(([childKey, childNode]) => (
                        <CategoryRows
                            key={childKey}
                            name={childNode.name}
                            node={childNode}
                            path={`${path}|${childKey}`}
                            level={level + 1}
                            expandedCategories={expandedCategories}
                            onToggle={onToggle}
                            onEdit={onEdit}
                            onDelete={onDelete}
                            onDuplicate={onDuplicate}
                        />
                    ))}
                    {node.nodes.map(schema => (
                        <SchemaRow
                            key={schema.id}
                            schema={schema}
                            onEdit={onEdit}
                            onDelete={onDelete}
                            onDuplicate={onDuplicate}
                            level={level + 1}
                        />
                    ))}
                </>
            )}
        </>
    );
};
