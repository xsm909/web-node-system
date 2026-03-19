import React from 'react';
import { Icon } from '../../../shared/ui/icon';
import type { SelectedField } from '../model/types';

interface SelectedFieldsTreeViewProps {
    fields: SelectedField[];
    onEditField: (field: SelectedField) => void;
    onRemoveField: (id: string) => void;
}

export const SelectedFieldsTreeView: React.FC<SelectedFieldsTreeViewProps> = ({
    fields,
    onEditField,
    onRemoveField
}) => {
    // Group fields by table alias
    const groupedFields = fields.reduce((acc, field) => {
        if (!acc[field.tableAlias]) acc[field.tableAlias] = [];
        acc[field.tableAlias].push(field);
        return acc;
    }, {} as Record<string, SelectedField[]>);


    return (
        <div className="flex flex-col h-full bg-[var(--bg-app)] border border-[var(--border-base)] rounded-2xl overflow-hidden shadow-sm">
            <div className="bg-[var(--bg-alt)] px-4 py-3 border-b border-[var(--border-base)] flex items-center justify-between font-bold">
                <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] flex items-center gap-2">
                    <Icon name="list" size={14} />
                    Selected Fields
                </h3>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-4">
                {Object.entries(groupedFields).map(([tableAlias, tableFields]) => (
                    <div key={tableAlias} className="space-y-1">
                        <div className="px-2 py-1 flex items-center gap-2 text-[var(--text-muted)] border-b border-[var(--border-base)]/30 mb-1">
                            <Icon name="table_rows" size={12} className="opacity-50" />
                            <span className="text-[10px] font-black uppercase tracking-widest">{tableAlias}</span>
                        </div>
                        <div className="space-y-0.5">
                            {tableFields.map(field => {
                                const isExpression = !!field.expression;
                                return (
                                    <div 
                                        key={field.id}
                                        className="group flex items-center gap-3 p-2 rounded-lg hover:bg-brand/5 border border-transparent hover:border-brand/10 transition-all cursor-pointer"
                                        onClick={() => onEditField(field)}
                                    >
                                        <div className={`p-1.5 rounded-md ${isExpression ? 'bg-amber-500/10 text-amber-500' : 'bg-brand/10 text-brand'}`}>
                                            <Icon name={isExpression ? 'functions' : 'view_column'} size={14} />
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
                                                {isExpression ? 'Custom Expression' : (field.columnName === '*' ? 'All Columns' : 'Table Column')}
                                            </span>
                                        </div>
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onRemoveField(field.id);
                                            }}
                                            className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-500 transition-all"
                                        >
                                            <Icon name="delete" size={14} />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}

                {fields.length === 0 && (
                    <div className="h-32 flex flex-col items-center justify-center opacity-40 border-2 border-dashed border-[var(--border-base)] rounded-xl m-2">
                        <Icon name="checklist" size={24} className="mb-2" />
                        <p className="text-[10px] font-bold uppercase tracking-widest text-center">No fields selected yet</p>
                    </div>
                )}
            </div>
        </div>
    );
};
