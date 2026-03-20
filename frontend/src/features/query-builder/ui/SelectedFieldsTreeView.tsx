import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import {
    SortableContext,
    verticalListSortingStrategy,
    useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Icon } from '../../../shared/ui/icon';
import type { SelectedField } from '../model/types';

interface SelectedFieldsTreeViewProps {
    fields: SelectedField[];
    onEditField: (field: SelectedField) => void;
}

export const SelectedFieldsTreeView: React.FC<SelectedFieldsTreeViewProps> = ({
    fields,
    onEditField
}) => {
    const { setNodeRef, isOver } = useDroppable({
        id: 'selected-fields-drop-zone',
    });

    return (
        <div 
            ref={setNodeRef}
            className={`flex flex-col h-full bg-[var(--bg-app)] border rounded-2xl overflow-hidden shadow-sm transition-all ${
                isOver ? 'border-brand ring-2 ring-brand/20 bg-brand/5' : 'border-[var(--border-base)]'
            }`}
        >
            <div className="bg-[var(--bg-alt)] px-4 py-3 border-b border-[var(--border-base)] flex items-center justify-between font-bold">
                <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] flex items-center gap-2">
                    <Icon name="table_chart" size={14} />
                    SELECTED FIELDS
                </h3>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
                <SortableContext 
                    items={fields.map(f => f.id)} 
                    strategy={verticalListSortingStrategy}
                >
                    {fields.map(field => (
                        <SortableFieldItem 
                            key={field.id}
                            field={field}
                            onEditField={onEditField}
                        />
                    ))}
                </SortableContext>

                {fields.length === 0 && (
                    <div className="h-32 flex flex-col items-center justify-center opacity-40 border-2 border-dashed border-[var(--border-base)] rounded-xl m-2 bg-[var(--bg-alt)]/20">
                        <Icon name="checklist" size={24} className="mb-2" />
                        <p className="text-[10px] font-bold uppercase tracking-widest text-center">Drag fields here or click in tables</p>
                    </div>
                )}
            </div>
        </div>
    );
};

const SortableFieldItem = ({ field, onEditField }: any) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: field.id });

    const isExpression = !!field.expression;

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : undefined,
        position: 'relative' as const,
        opacity: isDragging ? 0.3 : 1,
    };

    return (
        <div 
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className="group flex items-center gap-3 p-2 rounded-lg hover:bg-brand/5 border border-transparent hover:border-brand/10 transition-all cursor-grab active:cursor-grabbing bg-[var(--bg-app)] shadow-sm"
            onClick={() => onEditField(field)}
        >

            <div className={`p-1.5 rounded-md ${isExpression ? 'bg-amber-500/10 text-amber-500' : 'bg-brand/10 text-brand'}`}>
                <Icon name="table_rows" size={14} />
            </div>
            <div className="flex-1 flex flex-col min-w-0">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-[var(--text-main)] truncate">
                        {field.expression || `${field.tableAlias}.${field.columnName}`}
                    </span>
                    {field.alias && (
                        <span className="text-[10px] text-brand font-bold bg-brand/5 px-1.5 py-0.5 rounded">AS {field.alias}</span>
                    )}
                </div>
                <span className="text-[10px] text-[var(--text-muted)] opacity-60">
                    {isExpression ? 'Custom Expression' : (field.columnName === '*' ? 'All Columns' : `${field.tableAlias} column`)}
                </span>
            </div>
        </div>
    );
};

