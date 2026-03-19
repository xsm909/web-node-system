import React, { useState, useEffect } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import {
    SortableContext,
    verticalListSortingStrategy,
    useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Icon } from '../../../shared/ui/icon';
import type { QueryTable, SelectedField, MultiQueryState } from '../model/types';

interface SelectedTablesTreeViewProps {
    tables: QueryTable[];
    selectedFields: SelectedField[];
    onRemoveTable: (alias: string) => void;
    onMoveTable: (activeId: string, overId: string) => void;
    getColumns: (tableName: string) => Promise<any[]>;
    queryState: MultiQueryState;
}

export const SelectedTablesTreeView: React.FC<SelectedTablesTreeViewProps> = ({
    tables,
    selectedFields,
    onRemoveTable,
    getColumns,
    queryState
}) => {
    const { setNodeRef, isOver } = useDroppable({
        id: 'selected-tables-drop-zone',
    });

    return (
        <div 
            ref={setNodeRef}
            className={`flex flex-col h-full bg-[var(--bg-app)] border-2 rounded-2xl overflow-hidden shadow-sm transition-all duration-200 ${
                isOver ? 'border-brand ring-4 ring-brand/10 bg-brand/[0.02]' : 'border-[var(--border-base)]'
            }`}
        >
            <div className="bg-[var(--bg-alt)] px-4 py-3 border-b border-[var(--border-base)] flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] flex items-center gap-2">
                    <Icon name="table_rows" size={14} />
                    Selected Tables
                </h3>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                <SortableContext
                    items={tables.map(t => t.alias)}
                    strategy={verticalListSortingStrategy}
                >
                    {tables.map(table => (
                        <TableTreeItem 
                            key={table.alias}
                            table={table}
                            selectedFields={selectedFields.filter(f => f.tableAlias === table.alias)}
                            onRemoveTable={onRemoveTable}
                            getColumns={getColumns}
                            queryState={queryState}
                        />
                    ))}
                </SortableContext>
                
                {tables.length === 0 && (
                    <div className="h-32 flex flex-col items-center justify-center opacity-40 border-2 border-dashed border-[var(--border-base)] rounded-xl m-2">
                        <Icon name="add_to_photos" size={24} className="mb-2" />
                        <p className="text-[10px] font-bold uppercase tracking-widest text-center">Add tables from the sidebar</p>
                    </div>
                )}
            </div>
        </div>
    );
};

const TableTreeItem = ({ table, selectedFields, onRemoveTable, getColumns, queryState }: any) => {
    const [isExpanded, setIsExpanded] = useState(true);
    const [columns, setColumns] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: table.alias });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : undefined,
        position: 'relative' as const,
        opacity: isDragging ? 0.3 : 1,
    };

    useEffect(() => {
        if (!isExpanded) return;

        setLoading(true);
        const cte = queryState.ctes.find((c: any) => c.alias === table.tableName);
        if (cte) {
            const cteCols = cte.state.selectedFields.map((f: any) => ({
                name: f.alias || f.columnName || '',
                type: 'CTE'
            }));
            
            if (cte.isRecursive && cte.recursiveConfig?.depthColumn) {
                cteCols.push({
                    name: cte.recursiveConfig.depthColumn,
                    type: 'CTE-Depth'
                });
            }
            
            setColumns(cteCols);
            setLoading(false);
        } else {
            getColumns(table.tableName).then((cols: any) => {
                setColumns(cols);
                setLoading(false);
            });
        }
    }, [isExpanded, table.tableName, getColumns, queryState.ctes]);

    const isAllSelected = selectedFields.some((f: any) => f.columnName === '*');

    return (
        <div 
            ref={setNodeRef} 
            style={style} 
            {...attributes}
            {...listeners}
            className="group flex flex-col"
        >
            <div className="flex items-center gap-1 p-1 rounded-lg hover:bg-brand/5 border border-transparent hover:border-brand/10 transition-all cursor-grab active:cursor-grabbing">
                <div className="p-1 text-[var(--text-muted)] group-hover:text-brand transition-all">
                    <Icon name="drag_indicator" size={14} />
                </div>
                
                <button 
                    onClick={(e) => {
                        e.stopPropagation();
                        setIsExpanded(!isExpanded);
                    }}
                    className="p-1 rounded hover:bg-brand/10 text-[var(--text-muted)] hover:text-brand transition-all"
                >
                    <Icon name={isExpanded ? 'expand_more' : 'chevron_right'} size={16} />
                </button>
                <div className="flex-1 flex items-center gap-2 cursor-pointer" onClick={(e) => {
                    e.stopPropagation();
                    setIsExpanded(!isExpanded);
                }}>
                    <Icon name="table_chart" size={14} className="text-brand" />
                    <span className="text-xs font-bold text-[var(--text-main)]">{table.tableName}</span>
                    {table.alias !== table.tableName && (
                        <span className="text-[9px] bg-brand/10 text-brand px-1 py-0.5 rounded uppercase tracking-tighter">AS {table.alias}</span>
                    )}
                </div>
                <button 
                    onClick={(e) => {
                        e.stopPropagation();
                        onRemoveTable(table.alias);
                    }}
                    className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-500 transition-all"
                >
                    <Icon name="delete" size={14} />
                </button>
            </div>

            {isExpanded && (
                <div className="ml-10 mt-0.5 space-y-0.5 border-l-2 border-brand/10 pl-2 mb-2 animate-in slide-in-from-left-2 duration-200">
                    <DraggableColumn 
                        col={{ name: '*', type: 'ALL' }}
                        tableAlias={table.alias}
                        isSelected={isAllSelected}
                        label="All Columns (*)"
                    />

                    {loading ? (
                        <div className="px-2 py-1 text-[10px] text-[var(--text-muted)] italic">Loading columns...</div>
                    ) : (
                        columns.map(col => (
                            <DraggableColumn 
                                key={col.name}
                                col={col}
                                tableAlias={table.alias}
                                isSelected={selectedFields.some((f: any) => f.columnName === col.name)}
                            />
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

const DraggableColumn = ({ col, tableAlias, isSelected, label }: any) => {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: `source-field:${tableAlias}:${col.name}`,
    });

    return (
        <div 
            ref={setNodeRef}
            {...attributes}
            {...listeners}
            className={`flex items-center gap-2 px-2 py-1 rounded-md cursor-grab active:cursor-grabbing transition-all ${
                isSelected ? 'bg-brand/5 text-brand font-medium' : 'hover:bg-brand/5 text-[var(--text-main)]'
            } ${isDragging ? 'opacity-30 pointer-events-none' : ''}`}
        >
            <div className={`w-3 h-3 rounded border flex items-center justify-center transition-all ${
                isSelected ? 'bg-brand border-brand text-white' : 'border-[var(--border-base)]'
            }`}>
                {isSelected && <Icon name="check" size={8} />}
            </div>
            <span className={`text-[11px] truncate ${label ? 'font-bold' : ''}`}>{label || col.name}</span>
            {!label && <span className="ml-auto text-[8px] text-[var(--text-muted)] opacity-50 font-mono">{col.type}</span>}
        </div>
    );
};


