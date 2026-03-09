import React, { useState } from 'react';
import { useSchemas, useCreateSchema, useUpdateSchema, useDeleteSchema } from '../../../entities/schema/api';
import type { Schema } from '../../../entities/schema/api';
import { SchemaEditor } from '../../../features/schema-editor/SchemaEditor';
import { Icon } from '../../../shared/ui/icon';

export const AdminSchemaManagement: React.FC = () => {
    const { data: schemas, isLoading } = useSchemas();
    const createMutation = useCreateSchema();
    const updateMutation = useUpdateSchema();
    const deleteMutation = useDeleteSchema();

    const [selectedSchema, setSelectedSchema] = useState<Schema | null>(null);
    const [isEditing, setIsEditing] = useState(false);

    // Form State
    const [key, setKey] = useState('');
    const [content, setContent] = useState('{\n  "type": "object",\n  "properties": {}\n}');
    const [isSystem, setIsSystem] = useState(false);

    const handleEdit = (schema: Schema) => {
        setSelectedSchema(schema);
        setKey(schema.key);
        setContent(JSON.stringify(schema.content, null, 2));
        setIsSystem(schema.is_system);
        setIsEditing(true);
    };

    const handleCreateNew = () => {
        setSelectedSchema(null);
        setKey('');
        setContent('{\n  "type": "object",\n  "properties": {}\n}');
        setIsSystem(false);
        setIsEditing(true);
    };

    const handleSave = () => {
        try {
            const parsedContent = JSON.parse(content);

            if (selectedSchema) {
                updateMutation.mutate({
                    id: selectedSchema.id,
                    data: { key, content: parsedContent, is_system: isSystem }
                }, {
                    onSuccess: () => setIsEditing(false)
                });
            } else {
                createMutation.mutate({
                    key,
                    content: parsedContent,
                    is_system: isSystem
                }, {
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
        if (confirm("Are you sure you want to delete this schema?")) {
            deleteMutation.mutate(id);
        }
    };

    if (isLoading) return <div className="p-8 text-gray-400">Loading schemas...</div>;

    if (isEditing) {
        return (
            <div className="flex flex-col h-[calc(100vh-12rem)] border border-gray-700 rounded-2xl overflow-hidden bg-surface-800 shadow-xl shadow-black/20">
                <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-surface-900">
                    <div className="flex gap-4 items-center flex-1 pr-8">
                        <input
                            type="text"
                            placeholder="Schema Key (e.g., user-profile)"
                            value={key}
                            onChange={e => setKey(e.target.value)}
                            className="flex-1 bg-surface-950 border border-gray-700 rounded-lg px-4 py-2 text-sm text-[var(--text-main)] outline-none focus:border-brand"
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
                <h2 className="text-xl font-bold tracking-tight">Schema Registry</h2>
                <button
                    onClick={handleCreateNew}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand hover:brightness-110 text-white text-sm font-bold shadow-lg shadow-brand/20 transition-transform active:scale-95"
                >
                    <Icon name="add" size={18} />
                    New Schema
                </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {schemas?.map(schema => (
                    <div key={schema.id} className="p-5 rounded-2xl bg-surface-800 border border-gray-700/50 flex flex-col gap-4 group hover:border-brand/30 transition-colors shadow-lg shadow-black/10">
                        <div className="flex justify-between items-start">
                            <h3 className="font-semibold text-lg text-gray-100 flex items-center gap-2">
                                <Icon name="data_object" className="text-brand" size={20} />
                                {schema.key}
                            </h3>
                            {schema.is_system && (
                                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                    System
                                </span>
                            )}
                        </div>
                        <div className="text-xs text-gray-400 font-mono bg-surface-900 p-2 rounded-lg border border-gray-800 truncate">
                            {JSON.stringify(schema.content).slice(0, 50)}...
                        </div>
                        <div className="pt-2 flex justify-between items-center border-t border-gray-700/50 mt-auto">
                            <span className="text-xs text-gray-500">
                                Updated: {new Date(schema.updated_at).toLocaleDateString()}
                            </span>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleEdit(schema)}
                                    className="p-2 rounded-lg bg-surface-700 hover:bg-surface-600 transition-colors text-gray-300 hover:text-white"
                                    title="Edit"
                                >
                                    <Icon name="edit" size={16} />
                                </button>
                                {!schema.is_system && (
                                    <button
                                        onClick={() => handleDelete(schema.id, schema.is_system)}
                                        className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 transition-colors text-red-400"
                                        title="Delete"
                                    >
                                        <Icon name="delete" size={16} />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
                {schemas?.length === 0 && (
                    <div className="col-span-full py-12 text-center text-gray-400 bg-surface-800 rounded-2xl border border-gray-700 border-dashed">
                        No schemas found. Create your first schema to get started.
                    </div>
                )}
            </div>
        </div>
    );
};
