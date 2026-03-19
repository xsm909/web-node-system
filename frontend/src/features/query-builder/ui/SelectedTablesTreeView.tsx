import React, { useState, useEffect } from 'react';
import { Icon } from '../../../shared/ui/icon';
import type { QueryTable, SelectedField, MultiQueryState } from '../model/types';

interface SelectedTablesTreeViewProps {
    tables: QueryTable[];
    selectedFields: SelectedField[];
    onAddField: (field: SelectedField) => void;
    onRemoveField: (id: string) => void;
    onRemoveTable: (alias: string) => void;
    getColumns: (tableName: string) => Promise<any[]>;
    queryState: MultiQueryState;
}

export const SelectedTablesTreeView: React.FC<SelectedTablesTreeViewProps> = ({
    tables,
    selectedFields,
    onAddField,
    onRemoveField,
    onRemoveTable,
    getColumns,
    queryState
}) => {
    return (
        <div className="flex flex-col h-full bg-[var(--bg-app)] border border-[var(--border-base)] rounded-2xl overflow-hidden shadow-sm">
            <div className="bg-[var(--bg-alt)] px-4 py-3 border-b border-[var(--border-base)] flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] flex items-center gap-2">
                    <Icon name="table_rows" size={14} />
                    Selected Tables
                </h3>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {tables.map(table => (
                    <TableTreeItem 
                        key={table.alias}
                        table={table}
                        selectedFields={selectedFields.filter(f => f.tableAlias === table.alias)}
                        onAddField={onAddField}
                        onRemoveField={onRemoveField}
                        onRemoveTable={onRemoveTable}
                        getColumns={getColumns}
                        queryState={queryState}
                    />
                ))}
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

const TableTreeItem = ({ table, selectedFields, onAddField, onRemoveField, onRemoveTable, getColumns, queryState }: any) => {
    const [isExpanded, setIsExpanded] = useState(true);
    const [columns, setColumns] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isExpanded && columns.length === 0) {
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
        }
    }, [isExpanded, table.tableName, getColumns, queryState.ctes, columns.length]);

    const isAllSelected = selectedFields.some((f: any) => f.columnName === '*');

    return (
        <div className="flex flex-col">
            <div className="group flex items-center gap-2 p-1.5 rounded-lg hover:bg-brand/5 transition-all">
                <button 
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="p-1 rounded hover:bg-brand/10 text-[var(--text-muted)] hover:text-brand transition-all"
                >
                    <Icon name={isExpanded ? 'expand_more' : 'chevron_right'} size={16} />
                </button>
                <div className="flex-1 flex items-center gap-2 cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
                    <Icon name="table_chart" size={14} className="text-brand" />
                    <span className="text-xs font-bold text-[var(--text-main)]">{table.tableName}</span>
                    {table.alias !== table.tableName && (
                        <span className="text-[9px] bg-brand/10 text-brand px-1 py-0.5 rounded uppercase tracking-tighter">AS {table.alias}</span>
                    )}
                </div>
                <button 
                    onClick={() => onRemoveTable(table.alias)}
                    className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-500 transition-all"
                >
                    <Icon name="delete" size={14} />
                </button>
            </div>

            {isExpanded && (
                <div className="ml-7 mt-0.5 space-y-0.5 border-l-2 border-brand/10 pl-2 mb-2 animate-in slide-in-from-left-2 duration-200">
                    <div 
                        className={`flex items-center gap-2 px-2 py-1 rounded-md cursor-pointer transition-all ${
                            isAllSelected ? 'bg-brand/5 text-brand' : 'hover:bg-brand/5'
                        }`}
                        onClick={() => {
                            if (isAllSelected) {
                                const field = selectedFields.find((f: any) => f.columnName === '*');
                                onRemoveField(field.id);
                            } else {
                                onAddField({
                                    id: `${table.alias}_all_${Date.now()}`,
                                    tableAlias: table.alias,
                                    columnName: '*'
                                });
                            }
                        }}
                    >
                        <div className={`w-3 h-3 rounded border flex items-center justify-center transition-all ${
                            isAllSelected ? 'bg-brand border-brand text-white' : 'border-[var(--border-base)]'
                        }`}>
                            {isAllSelected && <Icon name="check" size={8} />}
                        </div>
                        <span className="text-[11px] font-bold">All Columns (*)</span>
                    </div>

                    {loading ? (
                        <div className="px-2 py-1 text-[10px] text-[var(--text-muted)] italic">Loading columns...</div>
                    ) : (
                        columns.map(col => {
                            const isSelected = selectedFields.some((f: any) => f.columnName === col.name);
                            return (
                                <div 
                                    key={col.name}
                                    className={`flex items-center gap-2 px-2 py-1 rounded-md cursor-pointer transition-all ${
                                        isSelected ? 'bg-brand/5 text-brand font-medium' : 'hover:bg-brand/5 text-[var(--text-main)]'
                                    }`}
                                    onClick={() => {
                                        if (isSelected) {
                                            const field = selectedFields.find((f: any) => f.columnName === col.name);
                                            onRemoveField(field.id);
                                        } else {
                                            onAddField({
                                                id: `${table.alias}_${col.name}_${Date.now()}`,
                                                tableAlias: table.alias,
                                                columnName: col.name
                                            });
                                        }
                                    }}
                                >
                                    <div className={`w-3 h-3 rounded border flex items-center justify-center transition-all ${
                                        isSelected ? 'bg-brand border-brand text-white' : 'border-[var(--border-base)]'
                                    }`}>
                                        {isSelected && <Icon name="check" size={8} />}
                                    </div>
                                    <span className="text-[11px] truncate">{col.name}</span>
                                    <span className="ml-auto text-[8px] text-[var(--text-muted)] opacity-50 font-mono">{col.type}</span>
                                </div>
                            );
                        })
                    )}
                </div>
            )}
        </div>
    );
};
