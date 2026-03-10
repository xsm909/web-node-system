import React, { useState, useMemo } from 'react';
import { useEntityMetadata, useUnassignMetadata, useCreateRecord, useAssignMetadata, useDeleteRecord } from '../../../entities/record/api';
import { useSchemas } from '../../../entities/schema/api';
import type { Schema } from '../../../entities/schema/api';
import { useAuthStore } from '../../../features/auth/store';
import { Icon } from '../../../shared/ui/icon';
import { ClientMetadataEditModal } from './ClientMetadataEditModal';
import { ComboBox } from '../../../shared/ui/combo-box/ComboBox';
import { buildCategoryTree } from '../../../shared/lib/categoryUtils';
import type { CategoryTreeNode } from '../../../shared/lib/categoryUtils';
import type { SelectionGroup } from '../../../shared/ui/selection-list';
import { ConfirmModal } from '../../../shared/ui/confirm-modal';



// Small utility: render a brief human-readable preview of record data
function DataPreview({ data }: { data: any }) {
    if (!data || typeof data !== 'object') {
        return <span className="text-[var(--text-muted)] italic opacity-50 text-xs">Empty</span>;
    }

    const entries = Object.entries(data).slice(0, 3);
    if (entries.length === 0) {
        return <span className="text-[var(--text-muted)] italic opacity-50 text-xs">No data</span>;
    }

    return (
        <div className="flex flex-wrap gap-1.5">
            {entries.map(([key, value]) => (
                <span
                    key={key}
                    className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-surface-700 border border-[var(--border-base)] text-[var(--text-muted)]"
                >
                    <span className="opacity-60">{key}:</span>
                    <span className="font-mono text-[var(--text-main)] opacity-80 truncate max-w-[80px]">
                        {typeof value === 'object' ? JSON.stringify(value) : String(value ?? '')}
                    </span>
                </span>
            ))}
            {Object.keys(data).length > 3 && (
                <span className="text-[10px] text-[var(--text-muted)] opacity-50 italic self-center">
                    +{Object.keys(data).length - 3} more
                </span>
            )}
        </div>
    );
}

export const ClientMetadataSection: React.FC = () => {
    const { user } = useAuthStore();
    const entityId = user?.id;

    const [selectedAssignment, setSelectedAssignment] = useState<any | null>(null);
    const [assignmentToDelete, setAssignmentToDelete] = useState<any | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [nestingParentId, setNestingParentId] = useState<string | null>(null);

    const { data: assignments = [], isLoading, refetch } = useEntityMetadata('client', entityId);
    const unassignMutation = useUnassignMetadata();
    const deleteRecordMutation = useDeleteRecord();
    const createRecordMutation = useCreateRecord();
    const assignMetadataMutation = useAssignMetadata();
    const { data: schemas = [] } = useSchemas();

    const comboData = useMemo(() => {
        if (!schemas.length) return {};

        const tree = buildCategoryTree(schemas);

        const mapNode = (node: CategoryTreeNode<Schema>): Record<string, SelectionGroup> => {
            const groups: Record<string, SelectionGroup> = {};

            Object.entries(node.children).forEach(([key, childNode]) => {
                groups[childNode.name] = {
                    id: key,
                    name: childNode.name,
                    items: childNode.nodes.map(s => ({
                        id: s.id,
                        name: s.content?.title || s.key,
                        description: s.key,
                        icon: 'data_object'
                    })),
                    children: mapNode(childNode)
                };
            });

            return groups;
        };

        const result = mapNode(tree);

        if (tree.nodes.length > 0) {
            const hasOtherCategories = Object.keys(tree.children).length > 0;
            const rootGroupName = hasOtherCategories ? 'General' : '';
            result[rootGroupName] = {
                id: 'root',
                name: rootGroupName,
                items: tree.nodes.map(s => ({
                    id: s.id,
                    name: s.content?.title || s.key,
                    description: s.key,
                    icon: 'data_object'
                })),
                children: {}
            };
        }

        return result;
    }, [schemas]);

    const enrichWithSchemas = (items: any[]): any[] => {
        return items.map(item => {
            const record = item.record || item;
            const schema = schemas.find(s => s.id === record.schema_id);
            const children = record.children ? enrichWithSchemas(record.children) : [];

            return {
                ...item,
                record: {
                    ...record,
                    schema: schema || record.schema,
                    children
                }
            };
        });
    };

    const enrichedAssignments = useMemo(() => enrichWithSchemas(assignments), [assignments, schemas]);





    const handleRowClick = (item: any) => {
        if (!item.record?.schema) return;
        setSelectedAssignment(item);
        setIsEditModalOpen(true);
    };

    const handleSchemaSelect = async (schemaItem: any) => {
        if (!entityId) return;

        try {
            const newRecord = await createRecordMutation.mutateAsync({
                schema_id: schemaItem.id,
                parent_id: nestingParentId || undefined,
                data: {},
            });

            if (!nestingParentId) {
                await assignMetadataMutation.mutateAsync({
                    record_id: newRecord.id,
                    entity_type: 'client',
                    entity_id: entityId,
                    owner_id: entityId
                });
            }

            refetch();

            setSelectedAssignment({
                id: 'new',
                record: {
                    ...newRecord,
                    schema: schemas.find(s => s.id === newRecord.schema_id)
                }
            });
            setIsEditModalOpen(true);
            setNestingParentId(null);
        } catch (e) {
            console.error("Failed to create record:", e);
        }
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-40 bg-surface-800 rounded-2xl border border-gray-700/50">
                <div className="w-8 h-8 rounded-full border-2 border-gray-700 border-t-brand animate-spin" />
            </div>
        );
    }

    return (
        <>
            <div className="bg-surface-800 rounded-2xl border border-gray-700/50 overflow-hidden shadow-xl shadow-black/10">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[700px]">
                        <thead>
                            <tr className="border-b border-gray-700 bg-surface-900/50">
                                <th className="px-6 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider w-[30%]">
                                    Schema
                                </th>
                                <th className="px-6 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                                    Data Preview
                                </th>
                                <th className="px-6 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider w-40">
                                    Updated
                                </th>
                                <th className="px-6 py-4 text-right w-44" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700/50">
                            {(() => {
                                const renderRows = (data: any[], depth = 0) => {
                                    return data.map((item) => (
                                        <React.Fragment key={item.id || item.record?.id}>
                                            <tr
                                                onClick={() => handleRowClick(item)}
                                                className="group hover:bg-brand/5 transition-colors cursor-pointer"
                                            >
                                                <td className="px-6 py-4" style={{ paddingLeft: `${1.5 + depth * 2}rem` }}>
                                                    <div className="flex items-center gap-3">
                                                        {depth > 0 && (
                                                            <div className="w-4 h-px bg-gray-600 opacity-40 shrink-0" />
                                                        )}
                                                        <div className="p-2 rounded-lg bg-surface-700 text-brand group-hover:bg-brand group-hover:text-white transition-colors shrink-0">
                                                            <Icon name={depth > 0 ? "arrow_split" : "data_object"} size={16} />
                                                        </div>
                                                        <div className="flex flex-col min-w-0">
                                                            <span className="text-sm font-bold text-[var(--text-main)] group-hover:text-brand transition-colors truncate">
                                                                {item.record?.schema?.content?.title || item.record?.schema?.key || 'Unknown'}
                                                            </span>
                                                            {item.record?.schema?.is_system && (
                                                                <span className="text-[9px] font-black text-blue-400 uppercase tracking-tighter opacity-60">
                                                                    System
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <DataPreview data={item.record?.data} />
                                                </td>
                                                <td className="px-6 py-4">
                                                    {item.record?.updated_at ? (
                                                        <span className="text-xs text-gray-500">
                                                            {new Date(item.record?.updated_at).toLocaleDateString()}
                                                        </span>
                                                    ) : <span className="text-xs text-gray-600">—</span>}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex justify-end items-center gap-2">
                                                        <div onClick={(e) => { e.stopPropagation(); setNestingParentId(item.record?.id); }}>
                                                            <ComboBox
                                                                data={comboData}
                                                                onSelect={handleSchemaSelect}
                                                                placeholder="Sub"
                                                                icon="add"
                                                                triggerClassName="!p-1.5 !rounded-lg !bg-brand/10 !text-brand hover:!bg-brand hover:!text-white !text-[10px] !font-bold !uppercase"
                                                            />
                                                        </div>

                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setAssignmentToDelete(item);
                                                            }}
                                                            className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-all"
                                                            title="Delete"
                                                        >
                                                            <Icon name="delete" size={14} />
                                                        </button>

                                                        <div className="p-1.5 text-brand group-hover:translate-x-0.5 transition-transform" title="Edit">
                                                            <Icon name="chevron_right" size={14} />
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                            {item.record?.children && item.record.children.length > 0 &&
                                                renderRows(item.record.children, depth + 1)
                                            }
                                        </React.Fragment>
                                    ));
                                };
                                return renderRows(enrichedAssignments);
                            })()}
                            {assignments.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-6 py-16 text-center text-gray-500 italic text-sm">
                                        No metadata schemas assigned to your account yet.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {selectedAssignment && (
                <ClientMetadataEditModal
                    isOpen={isEditModalOpen}
                    onClose={() => {
                        setIsEditModalOpen(false);
                        setSelectedAssignment(null);
                    }}
                    assignment={selectedAssignment}
                />
            )}

            <ConfirmModal
                isOpen={!!assignmentToDelete}
                title="Remove Schema"
                description={`Are you sure you want to remove the metadata from your profile? All sub-elements will also be deleted.`}
                confirmLabel="Remove"
                isLoading={unassignMutation.isPending || deleteRecordMutation.isPending}
                onConfirm={() => {
                    if (assignmentToDelete) {
                        const isRootAssignment = !!assignmentToDelete.entity_id;

                        if (isRootAssignment) {
                            unassignMutation.mutate(
                                { assignmentId: assignmentToDelete.id },
                                {
                                    onSuccess: () => {
                                        setAssignmentToDelete(null);
                                        refetch();
                                    }
                                }
                            );
                        } else {
                            deleteRecordMutation.mutate(
                                assignmentToDelete.id,
                                {
                                    onSuccess: () => {
                                        setAssignmentToDelete(null);
                                        refetch();
                                    }
                                }
                            );
                        }
                    }
                }}
                onCancel={() => setAssignmentToDelete(null)}
            />
        </>
    );
};
