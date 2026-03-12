import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Icon } from '../../../shared/ui/icon';
import { useAuthStore } from '../../../features/auth/store';
import { useEntityMetadata, useUnassignMetadata, useCreateRecord, useAssignMetadata, useDeleteRecord } from '../../../entities/record/api';
import { useSchemas } from '../../../entities/schema/api';
import type { Schema } from '../../../entities/schema/api';
import { ClientMetadataEditor, type ClientMetadataEditorRef } from './ClientMetadataEditor';
import { ComboBox } from '../../../shared/ui/combo-box/ComboBox';
import { buildCategoryTree } from '../../../shared/lib/categoryUtils';
import type { CategoryTreeNode } from '../../../shared/lib/categoryUtils';
import type { SelectionGroup } from '../../../shared/ui/selection-list';
import { ConfirmModal } from '../../../shared/ui/confirm-modal';
import { SlidePanel } from '../../../shared/ui/slide-panel';
import { AppHeader } from '../../app-header';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useReorderRecords } from '../../../entities/record/api';

interface ClientMetadataManagementProps {
    activeClientId?: string | null;
    onToggleSidebar?: () => void;
    isSidebarOpen?: boolean;
    hideHeader?: boolean;
}

export const ClientMetadataManagement: React.FC<ClientMetadataManagementProps> = ({
    activeClientId,
    onToggleSidebar,
    isSidebarOpen,
    hideHeader = false
}) => {
    const { user } = useAuthStore();
    const { data: schemas = [], isLoading: isSchemasLoading } = useSchemas();
    const isAdmin = user?.role === 'admin';

    const [view, setView] = useState<'list' | 'edit'>('list');
    const [selectedAssignment, setSelectedAssignment] = useState<any | null>(null);
    const [assignmentToDelete, setAssignmentToDelete] = useState<any | null>(null);
    const [nestingParentId, setNestingParentId] = useState<string | null>(null);
    const [openSubMenuId, setOpenSubMenuId] = useState<string | null>(null);

    const editorRef = useRef<ClientMetadataEditorRef>(null);

    const unassignMutation = useUnassignMetadata();
    const deleteRecordMutation = useDeleteRecord();
    const createRecordMutation = useCreateRecord();
    const assignMetadataMutation = useAssignMetadata();
    const reorderMutation = useReorderRecords();

    // Fetch assignments for this specific client
    const { data: assignments = [], isLoading: isAssignmentsLoading, refetch } = useEntityMetadata('client', activeClientId || undefined);

    const isLoading = isSchemasLoading || isAssignmentsLoading;

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;

        if (!over || active.id === over.id) return;

        // Helper to find the specific list containing active and over IDs
        const findAndReorder = (list: any[]): any[] | null => {
            const activeIndex = list.findIndex((item) => (item.id || item.record?.id) === active.id);
            const overIndex = list.findIndex((item) => (item.id || item.record?.id) === over.id);

            if (activeIndex !== -1 && overIndex !== -1) {
                return arrayMove(list, activeIndex, overIndex);
            }

            for (const item of list) {
                if (item.record?.children) {
                    const result = findAndReorder(item.record.children);
                    if (result) return result; // We found the list and reordered it (logic-wise, we just need the new items for API)
                }
            }
            return null;
        };

        const reorderedList = findAndReorder(enrichedAssignments);
        
        if (reorderedList) {
            // Prepare reorder data for API
            const reorderData = reorderedList.map((item, index) => ({
                id: item.record?.id || item.id,
                order: index + 1
            }));

            try {
                await reorderMutation.mutateAsync(reorderData);
                await refetch();
            } catch (e) {
                console.error("Failed to reorder:", e);
            }
        }
    };

    useEffect(() => {
        console.log("[ClientMetadataManagement] activeClientId:", activeClientId);
        if (assignments.length > 0) {
            console.log("[ClientMetadataManagement] Raw assignments from API:", assignments);
        }
    }, [assignments, activeClientId]);

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
            // Determine if this is a MetaAssignment (has record field) or a direct Record
            const record = item.record || (item.schema_id ? item : null);

            if (!record) return item;

            const schema = schemas.find(s => s.id === record.schema_id);
            const children = record.children ? enrichWithSchemas(record.children) : [];

            const enrichedRecord = {
                ...record,
                schema: schema || record.schema,
                children
            };

            // Return consistently wrapped structure: everything must have a .record for the UI
            return {
                ...item,
                record: enrichedRecord
            };
        });
    };

    const enrichedAssignments = useMemo(() => enrichWithSchemas(assignments), [assignments, schemas]);

    const handleRowClick = (item: any) => {
        if (!item.record?.schema) {
            console.warn("Cannot edit record without schema", item);
            return;
        }
        setSelectedAssignment(item);
        setView('edit');
    };

    const handleBack = () => {
        setView('list');
        setSelectedAssignment(null);
        refetch();
    };

    const handleSchemaSelect = async (schemaItem: any) => {
        if (!activeClientId) return;

        try {
            const newRecord = await createRecordMutation.mutateAsync({
                schema_id: schemaItem.id,
                parent_id: nestingParentId || undefined,
                data: {}, // Initialize with empty data as requested
            });

            // If it's a root record, we need to assign it to the entity
            if (!nestingParentId) {
                await assignMetadataMutation.mutateAsync({
                    record_id: newRecord.id,
                    entity_type: 'client',
                    entity_id: activeClientId,
                    owner_id: activeClientId
                });
            }

            // Refresh list
            await refetch();

            // Open edit modal (now via SlidePanel)
            setSelectedAssignment({
                id: 'new',
                record: {
                    ...newRecord,
                    schema: schemas.find(s => s.id === newRecord.schema_id)
                }
            });
            setView('edit');
            setNestingParentId(null);
        } catch (e) {
            console.error("Failed to create record:", e);
        }
    };

    if (isLoading && assignments.length === 0) {
        return (
            <div className="flex justify-center items-center h-64 bg-surface-800 rounded-3xl border border-[var(--border-base)] shadow-2xl">
                <div className="w-8 h-8 rounded-full border-2 border-[var(--border-base)] border-t-brand animate-spin" />
            </div>
        );
    }

    const content = (
        <>
            <div className="space-y-6">
                {!hideHeader && (
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-bold text-[var(--text-main)] tracking-tight">Client Metadata</h2>
                            <p className="text-[10px] text-[var(--text-muted)] font-black uppercase tracking-widest opacity-60">
                                Manage semantic datasets attached to this client.
                            </p>
                        </div>
                    </div>
                )}

                {isAdmin && activeClientId && (
                    <div className="flex justify-start">
                        <div onClick={(e) => { e.stopPropagation(); setNestingParentId(null); }}>
                            <ComboBox
                                data={comboData}
                                onSelect={handleSchemaSelect}
                                placeholder="Assign Schema"
                                icon="add"
                                variant="brand"
                                triggerClassName="px-6 py-3 rounded-2xl !text-[10px] !font-black !uppercase !tracking-widest shadow-xl shadow-brand/20"
                            />
                        </div>
                    </div>
                )}

                <div className="bg-surface-800 rounded-3xl border border-[var(--border-base)] overflow-hidden shadow-2xl ring-1 ring-black/5 dark:ring-white/5">
                    <div className="overflow-x-auto">
                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handleDragEnd}
                        >
                            <table className="w-full text-left border-collapse min-w-[700px]">
                            <thead>
                                <tr className="border-b border-[var(--border-base)] bg-[var(--border-muted)]/30">
                                    <th className="px-6 py-4 text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider opacity-60 w-24">
                                        Sub
                                    </th>
                                    <th className="px-6 py-4 text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider opacity-60">
                                        Schema
                                    </th>
                                    <th className="px-6 py-4 text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider opacity-60">
                                        Record Data
                                    </th>
                                    <th className="px-6 py-4 text-right text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider opacity-60">
                                        Action
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border-base)]">
                                {(() => {
                                    const SortableRow = ({ item, depth, onRowClick, onDelete, isAdmin }: any) => {
                                        const {
                                            attributes,
                                            listeners,
                                            setNodeRef,
                                            transform,
                                            transition,
                                            isDragging
                                        } = useSortable({ id: item.id || item.record?.id });

                                        const style = {
                                            transform: CSS.Transform.toString(transform),
                                            transition,
                                            zIndex: isDragging ? 10 : 0,
                                            position: 'relative' as const,
                                        };

                                        return (
                                            <tr
                                                ref={setNodeRef}
                                                style={style}
                                                className={`hover:bg-[var(--border-muted)]/5 group cursor-pointer ${isDragging ? 'bg-[var(--border-muted)]/20' : ''}`}
                                                onClick={() => onRowClick(item)}
                                            >
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2">
                                                        {isAdmin && (
                                                            <div
                                                                {...attributes}
                                                                {...listeners}
                                                                className="cursor-grab active:cursor-grabbing p-1 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity"
                                                                onClick={(e) => e.stopPropagation()}
                                                            >
                                                                <Icon name="drag_indicator" size={16} />
                                                            </div>
                                                        )}
                                                        {isAdmin && (
                                                            <div
                                                                className={`transition-opacity duration-200 ${openSubMenuId === item.record?.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                                                                onClick={(e) => { e.stopPropagation(); setNestingParentId(item.record?.id); }}
                                                            >
                                                                <ComboBox
                                                                    data={comboData}
                                                                    onSelect={handleSchemaSelect}
                                                                    onOpenChange={(open) => setOpenSubMenuId(open ? item.record?.id : null)}
                                                                    placeholder=""
                                                                    icon="add"
                                                                    triggerClassName="!p-1.5 !rounded-lg !bg-brand/10 !text-brand hover:!brightness-125 !text-[10px] !font-bold !uppercase"
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                 <td className="px-6 py-4" style={{ paddingLeft: `${1.5 + depth * 2}rem` }}>
                                                     <div className="flex items-center gap-3">
                                                         {depth > 0 && (
                                                             <div className="w-4 h-px bg-gray-600 opacity-40 shrink-0" />
                                                         )}
                                                         <span className={`px-2 py-0.5 rounded-full bg-surface-700 border border-[var(--border-base)] text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] flex items-center gap-2 ${item.record?.lock ? 'ring-1 ring-red-500/20 text-red-400/80' : ''}`}>
                                                             {depth > 0 && <Icon name="arrow_split" size={12} />}
                                                             {item.record?.schema?.key || 'Unknown'}
                                                             {item.record?.lock && <Icon name="lock" size={10} />}
                                                         </span>
                                                     </div>
                                                 </td>
                                                 <td className="px-6 py-4">
                                                     <div className="max-w-xs truncate text-sm text-[var(--text-main)] opacity-80 font-mono">
                                                         {JSON.stringify(item.record?.data || {})}
                                                     </div>
                                                 </td>
                                                 <td className="px-6 py-4 text-right">
                                                     <div className="flex justify-end gap-2 items-center">
                                                         {item.record?.lock && (
                                                             <div className="p-1.5 text-red-500/40" title="Locked">
                                                                 <Icon name="lock" size={14} />
                                                             </div>
                                                         )}
                                                         {isAdmin && !item.record?.lock && (
                                                             <button
                                                                 onClick={(e) => {
                                                                     e.stopPropagation();
                                                                     onDelete(item);
                                                                 }}
                                                                 className="p-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                                                                 title="Delete"
                                                             >
                                                                 <Icon name="delete" size={14} />
                                                             </button>
                                                         )}
                                                     </div>
                                                 </td>
                                             </tr>
                                        );
                                    };

                                    const renderRows = (data: any[], depth = 0) => {
                                        return (
                                            <SortableContext
                                                items={data.map(item => item.id || item.record?.id)}
                                                strategy={verticalListSortingStrategy}
                                            >
                                                {data.map((item) => (
                                                    <React.Fragment key={item.id || item.record?.id}>
                                                        <SortableRow
                                                            item={item}
                                                            depth={depth}
                                                            onRowClick={handleRowClick}
                                                            onDelete={setAssignmentToDelete}
                                                            isAdmin={isAdmin}
                                                        />
                                                        {item.record?.children && item.record.children.length > 0 && (
                                                            <tr key={`${(item.id || item.record?.id)}-children`}>
                                                                <td colSpan={4} className="p-0">
                                                                    <table className="w-full border-collapse">
                                                                        <tbody className="divide-y divide-[var(--border-base)]">
                                                                            {renderRows(item.record.children, depth + 1)}
                                                                        </tbody>
                                                                    </table>
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </React.Fragment>
                                                ))}
                                            </SortableContext>
                                        );
                                    };
                                    return renderRows(enrichedAssignments);
                                })()}
                            </tbody>
                        </table>
                        </DndContext>
                    </div>
                    {assignments.length === 0 && !isLoading && (
                        <div className="p-16 text-center text-[var(--text-muted)] text-sm opacity-40 font-medium italic">
                            No Schemas assigned to this client yet.
                        </div>
                    )}
                </div>

                <ConfirmModal
                    isOpen={!!assignmentToDelete}
                    title="Remove Schema"
                    description={`Are you sure you want to remove the '${assignmentToDelete?.record?.schema?.key}' schema from this client?`}
                    confirmLabel="Remove"
                    isLoading={unassignMutation.isPending}
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
            </div>

            <SlidePanel
                isOpen={view === 'edit' && !!selectedAssignment}
                onClose={handleBack}
                title={selectedAssignment?.record?.schema?.key || 'Metadata'}
                subtitle="Configure and save detailed metadata for this record."
                footer={
                    <div className="flex justify-end">
                        <button
                            onClick={() => editorRef.current?.handleSave()}
                            className="flex items-center gap-2 px-8 py-3 rounded-2xl bg-brand text-white text-[10px] font-black uppercase tracking-widest shadow-xl shadow-brand/20 hover:brightness-110 active:scale-95 transition-all"
                        >
                            <Icon name="save" size={16} />
                            Save Changes
                        </button>
                    </div>
                }
            >
                {selectedAssignment && (
                    <ClientMetadataEditor
                        ref={editorRef}
                        assignment={selectedAssignment}
                        assignments={assignments}
                        activeClientId={activeClientId || undefined}
                        onSaveSuccess={handleBack}
                    />
                )}
            </SlidePanel>
        </>
    );

    if (hideHeader) return content;

    return (
        <div className="flex flex-col h-full bg-[var(--bg-app)] overflow-hidden">
            <AppHeader
                onToggleSidebar={onToggleSidebar || (() => { })}
                isSidebarOpen={isSidebarOpen}
                leftContent={
                    <h1 className="text-lg lg:text-xl font-semibold tracking-tight text-[var(--text-main)] opacity-90 truncate px-2 lg:px-0">
                        Client Metadata
                    </h1>
                }
            />
            <div className="flex-1 p-8 overflow-y-auto">
                {content}
            </div>
        </div>
    );
};
