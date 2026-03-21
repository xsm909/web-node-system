import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import type { ObjectParameter as ReportParameter } from '../../../entities/report/model/types';
import {
    DndContext,
    closestCenter,
    PointerSensor,
    KeyboardSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
    DragOverlay,
    defaultDropAnimationSideEffects,
    useDraggable
} from '@dnd-kit/core';
import { Icon } from '../../../shared/ui/icon';
import { AppTabs } from '../../../shared/ui/app-tabs';
import { useDatabaseMetadata } from '../lib/useDatabaseMetadata';
import type { MultiQueryState, QueryState, SelectedField, JoinCondition, WhereCondition } from '../model/types';
import { generateSQL, generateBlockSQL } from '../lib/sqlGenerator';
import { parseSQL } from '../lib/sqlParser';
import { SelectedTablesTreeView } from './SelectedTablesTreeView';
import { SelectedFieldsTreeView } from './SelectedFieldsTreeView';
import { FieldExpressionModal } from './FieldExpressionModal';
import { AppCompactModalForm } from '../../../shared/ui/app-compact-modal-form/AppCompactModalForm';
import { apiClient } from '../../../shared/api/client';
import { AppContextMenu } from '../../../shared/ui/app-context-menu';
import { AppTabulatorTable } from '../../../shared/ui/app-tabulator-table/AppTabulatorTable';

// Note: copyToClipboard is now handled inside QueryBuilderModal component to manage local state feedback

// --- Internal Helper Components ---

interface ColumnSelectProps {
    tableAlias: string;
    value: string;
    onChange: (val: string) => void;
    getColumns: (tableName: string) => Promise<any[]>;
    queryState: MultiQueryState;
    state: QueryState;
    placeholder?: string;
}

const ColumnSelect: React.FC<ColumnSelectProps> = ({
    tableAlias,
    value,
    onChange,
    getColumns,
    queryState,
    state,
    placeholder = "Select column..."
}) => {
    const [columns, setColumns] = useState<any[]>([]);

    useEffect(() => {
        if (!state?.tables || !queryState?.ctes) return;

        const table = state.tables.find((t) => t.alias === tableAlias);
        if (!table) return;

        // Check if the tableName of this instance is a CTE alias
        const targetCte = queryState.ctes.find((c) => c.alias === table.tableName);

        if (targetCte) {
            const cteCols = targetCte.state.selectedFields.map((f) => ({
                name: f.alias || f.columnName || '',
                type: 'CTE'
            }));

            // Add recursive depth column if it exists
            if (targetCte.isRecursive && targetCte.recursiveConfig?.depthColumn) {
                cteCols.push({
                    name: targetCte.recursiveConfig.depthColumn,
                    type: 'CTE-Depth'
                });
            }

            setColumns(cteCols);
        } else {
            getColumns(table.tableName).then(setColumns);
        }
    }, [tableAlias, getColumns, queryState, state]);

    return (
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="flex-1 bg-[var(--bg-alt)] border border-[var(--border-base)] rounded-lg px-3 py-2 text-xs outline-none focus:border-brand"
        >
            <option value="">{placeholder}</option>
            {columns.map(col => (
                <option key={col.name} value={col.name}>{col.name}</option>
            ))}
        </select>
    );
};

interface DraggableTableSidebarItemProps {
    id: string;
    label: string;
    onAdd: () => void;
    isCte?: boolean;
    isRecursive?: boolean;
}

const DraggableTableSidebarItem: React.FC<DraggableTableSidebarItemProps> = ({ id, label, onAdd, isCte, isRecursive }) => {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: `source-table:${id}:${isCte}:${isRecursive || false}`,
    });

    return (
        <div
            ref={setNodeRef}
            {...attributes}
            {...listeners}
            className={`group flex items-center justify-between p-2 rounded-lg cursor-grab active:cursor-grabbing border border-transparent transition-all ${isDragging ? 'opacity-30' : 'hover:bg-brand/5 hover:border-brand/20'
                }`}
            onClick={() => {
                // If it's a drag start, dnd-kit might trigger click. 
                // However, we want to allow quick-add via click too.
                onAdd();
            }}
        >
            <div className="flex items-center gap-2">
                <Icon name={isCte ? (isRecursive ? 'table_recursive' : 'table_virtual') : 'table_chart'} size={14} className="text-brand/70" />
                <span className="text-xs font-medium text-[var(--text-main)]">{label}</span>
            </div>
            <Icon name="add" size={14} className="text-brand opacity-0 group-hover:opacity-100 transition-all" />
        </div>
    );
};

interface ViewProps {
    state: QueryState;
    setState: (updater: (prev: QueryState) => QueryState) => void;
    getColumns: (tableName: string) => Promise<any[]>;
    queryState: MultiQueryState;
    parameters?: ReportParameter[];
}

const JoinsView: React.FC<ViewProps> = ({ state, setState, getColumns, queryState }) => {
    const addJoin = () => {
        if (state.tables.length < 2) return;
        const newJoin: JoinCondition = {
            id: `join_${Date.now()}`,
            leftTableAlias: state.tables[0].alias,
            leftColumn: 'id',
            rightTableAlias: state.tables[1].alias,
            rightColumn: 'id',
            type: 'INNER'
        };
        setState((prev) => ({ ...prev, joins: [...prev.joins, newJoin] }));
    };

    return (
        <div className="space-y-6 max-w-5xl">
            <div className="flex items-center justify-between px-2">
                <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">Table Joins</h3>
                <button
                    onClick={addJoin}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-brand text-white text-xs font-bold hover:opacity-90 transition-all shadow-sm"
                >
                    <Icon name="plus" size={14} />
                    Add Join
                </button>
            </div>

            <div className="rounded-2xl border border-[var(--border-base)] bg-[var(--bg-app)] overflow-hidden divide-y divide-[var(--border-base)] shadow-sm">
                {state.joins.map((join, index) => (
                    <JoinItem
                        key={join.id}
                        join={join}
                        index={index}
                        state={state}
                        setState={setState}
                        getColumns={getColumns}
                        queryState={queryState}
                    />
                ))}

                {state.joins.length === 0 && (
                    <div className="py-12 flex flex-col items-center justify-center opacity-40">
                        <Icon name="device_hub" size={32} className="mb-2 text-[var(--text-muted)]" />
                        <p className="text-xs font-medium">No joins defined yet.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

interface JoinItemProps extends ViewProps {
    join: JoinCondition;
    index: number;
}

const JoinItem: React.FC<JoinItemProps> = ({ join, index, state, setState, getColumns, queryState }) => {
    const [isEditOpen, setIsEditOpen] = useState(false);

    const rightTable = state.tables.find(t => t.alias === join.rightTableAlias);
    const rightTableName = rightTable?.tableName || join.rightTableAlias;

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        const newJoins = [...state.joins];
        newJoins.splice(index, 1);
        setState((prev) => ({ ...prev, joins: newJoins }));
    };

    return (
        <>
            <div
                onClick={() => setIsEditOpen(true)}
                className="group flex items-center justify-between p-3 hover:bg-[var(--bg-alt)] transition-all cursor-pointer select-none"
            >
                <div className="flex items-center gap-2 font-mono text-[11px]">
                    <span className="text-brand/70 font-bold">{join.type} JOIN</span>
                    <span className="text-[var(--text-main)] font-bold">{rightTableName}</span>
                    <span className="text-brand/50">AS</span>
                    <span className="text-brand font-bold">{join.rightTableAlias}</span>
                    <span className="text-brand/50 font-bold">ON</span>
                    <span className="text-[var(--text-main)] font-bold">{join.leftTableAlias}</span>
                    <span className="text-[var(--text-muted)]">.</span>
                    <span className="text-brand font-bold">{join.leftColumn}</span>
                    <span className="text-brand/50 font-bold">=</span>
                    <span className="text-[var(--text-main)] font-bold">{join.rightTableAlias}</span>
                    <span className="text-[var(--text-muted)]">.</span>
                    <span className="text-brand font-bold">{join.rightColumn}</span>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleDelete}
                        className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                    >
                        <Icon name="delete" size={14} />
                    </button>
                    <Icon name="edit" size={14} className="text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-all" />
                </div>
            </div>

            <AppCompactModalForm
                isOpen={isEditOpen}
                onClose={() => setIsEditOpen(false)}
                onSubmit={() => setIsEditOpen(false)}
                title="Edit Join"
                icon="device_hub"
                width="max-w-2xl"
            >
                <div className="space-y-4">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Join Type</label>
                        <select
                            value={join.type}
                            onChange={(e) => {
                                const newJoins = [...state.joins];
                                newJoins[index].type = e.target.value as any;
                                setState((prev) => ({ ...prev, joins: newJoins }));
                            }}
                            className="w-full bg-[var(--bg-alt)] border border-[var(--border-base)] rounded-lg px-3 py-2 text-xs font-bold outline-none focus:border-brand"
                        >
                            <option value="INNER">INNER JOIN</option>
                            <option value="LEFT">LEFT JOIN</option>
                            <option value="RIGHT">RIGHT JOIN</option>
                            <option value="FULL">FULL JOIN</option>
                        </select>
                    </div>

                    <div className="space-y-1.5 p-4 rounded-xl border border-[var(--border-base)] bg-[var(--bg-alt)]/50">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] block mb-2">Join Condition (ON)</label>
                        <div className="flex flex-col gap-4">
                            <div className="flex items-center gap-2">
                                <div className="flex-1 flex flex-col gap-1.5">
                                    <span className="text-[10px] text-[var(--text-muted)] font-medium">Target Table (Joining)</span>
                                    <div className="flex items-center gap-2">
                                        <select
                                            value={join.rightTableAlias}
                                            onChange={(e) => {
                                                const newJoins = [...state.joins];
                                                newJoins[index].rightTableAlias = e.target.value;
                                                setState((prev) => ({ ...prev, joins: newJoins }));
                                            }}
                                            className="bg-[var(--bg-alt)] border border-[var(--border-base)] rounded-lg px-2 py-1.5 text-xs outline-none focus:border-brand min-w-[120px]"
                                        >
                                            {state.tables.map((t) => <option key={t.alias} value={t.alias}>{t.alias}</option>)}
                                        </select>
                                        <span className="text-[var(--text-muted)] font-bold">.</span>
                                        <ColumnSelect
                                            tableAlias={join.rightTableAlias}
                                            value={join.rightColumn}
                                            onChange={(val: string) => {
                                                const newJoins = [...state.joins];
                                                newJoins[index].rightColumn = val;
                                                setState((prev) => ({ ...prev, joins: newJoins }));
                                            }}
                                            getColumns={getColumns}
                                            queryState={queryState}
                                            state={state}
                                        />
                                    </div>
                                </div>

                                <span className="text-[var(--text-muted)] font-bold px-2 mt-5">=</span>

                                <div className="flex-1 flex flex-col gap-1.5">
                                    <span className="text-[10px] text-[var(--text-muted)] font-medium">Existing Table</span>
                                    <div className="flex items-center gap-2">
                                        <select
                                            value={join.leftTableAlias}
                                            onChange={(e) => {
                                                const newJoins = [...state.joins];
                                                newJoins[index].leftTableAlias = e.target.value;
                                                setState((prev) => ({ ...prev, joins: newJoins }));
                                            }}
                                            className="bg-[var(--bg-alt)] border border-[var(--border-base)] rounded-lg px-2 py-1.5 text-xs outline-none focus:border-brand min-w-[120px]"
                                        >
                                            {state.tables.map((t) => <option key={t.alias} value={t.alias}>{t.alias}</option>)}
                                        </select>
                                        <span className="text-[var(--text-muted)] font-bold">.</span>
                                        <ColumnSelect
                                            tableAlias={join.leftTableAlias}
                                            value={join.leftColumn}
                                            onChange={(val: string) => {
                                                const newJoins = [...state.joins];
                                                newJoins[index].leftColumn = val;
                                                setState((prev) => ({ ...prev, joins: newJoins }));
                                            }}
                                            getColumns={getColumns}
                                            queryState={queryState}
                                            state={state}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </AppCompactModalForm>
        </>
    );
};

const ConditionsView: React.FC<ViewProps> = ({ state, setState, getColumns, queryState, parameters = [] }) => {
    const addCondition = () => {
        if (state.tables.length === 0) return;
        const newCond: WhereCondition = {
            id: `where_${Date.now()}`,
            tableAlias: state.tables[0].alias,
            columnName: '',
            operator: '=',
            value: "''",
            valueType: 'literal',
            logic: 'AND'
        };
        setState((prev) => ({ ...prev, where: [...prev.where, newCond] }));
    };

    return (
        <div className="space-y-6 max-w-5xl">
            <div className="flex items-center justify-between px-2">
                <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">Filtering Conditions</h3>
                <button
                    onClick={addCondition}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-brand text-white text-xs font-bold hover:opacity-90 transition-all shadow-sm"
                >
                    <Icon name="plus" size={14} />
                    Add Condition
                </button>
            </div>

            <div className="space-y-4">
                {state.where.map((cond, index) => (
                    <div key={cond.id} className="p-4 rounded-2xl border border-[var(--border-base)] bg-[var(--bg-app)] flex items-center gap-3 group">
                        {index > 0 && (
                            <select
                                value={cond.logic}
                                onChange={(e) => {
                                    const newWheres = [...state.where];
                                    newWheres[index].logic = e.target.value as any;
                                    setState((prev) => ({ ...prev, where: newWheres }));
                                }}
                                className="bg-brand/10 text-brand border border-brand/20 rounded-lg px-2 py-1 text-[10px] font-bold outline-none"
                            >
                                <option value="AND">AND</option>
                                <option value="OR">OR</option>
                            </select>
                        )}

                        <select
                            value={cond.tableAlias}
                            onChange={(e) => {
                                const newWheres = [...state.where];
                                newWheres[index].tableAlias = e.target.value;
                                setState((prev) => ({ ...prev, where: newWheres }));
                            }}
                            className="bg-[var(--bg-alt)] border border-[var(--border-base)] rounded-lg px-2 py-2 text-xs outline-none focus:border-brand min-w-[120px]"
                        >
                            {state.tables.map((t) => <option key={t.alias} value={t.alias}>{t.alias}</option>)}
                        </select>

                        <ColumnSelect
                            tableAlias={cond.tableAlias}
                            value={cond.columnName}
                            onChange={(val: string) => {
                                const newWheres = [...state.where];
                                newWheres[index].columnName = val;
                                setState((prev) => ({ ...prev, where: newWheres }));
                            }}
                            getColumns={getColumns}
                            queryState={queryState}
                            state={state}
                        />

                        <select
                            value={cond.operator}
                            onChange={(e) => {
                                const newWheres = [...state.where];
                                newWheres[index].operator = e.target.value as any;
                                setState((prev) => ({ ...prev, where: newWheres }));
                            }}
                            className="bg-[var(--bg-alt)] border border-[var(--border-base)] rounded-lg px-2 py-2 text-xs font-bold outline-none focus:border-brand w-24"
                        >
                            <option value="=">=</option>
                            <option value="!=">!=</option>
                            <option value=">">&gt;</option>
                            <option value="<">&lt;</option>
                            <option value=">=">&gt;=</option>
                            <option value="<=">&lt;=</option>
                            <option value="LIKE">LIKE</option>
                            <option value="IN">IN</option>
                            <option value="IS NULL">IS NULL</option>
                            <option value="IS NOT NULL">IS NOT NULL</option>
                        </select>

                        <div className="flex-1 flex items-center gap-2">
                            {parameters.length > 0 && (
                                <button
                                    onClick={() => {
                                        const newWheres = [...state.where];
                                        newWheres[index].valueType = cond.valueType === 'parameter' ? 'literal' : 'parameter';
                                        newWheres[index].value = '';
                                        setState((prev) => ({ ...prev, where: newWheres }));
                                    }}
                                    className={`p-2 rounded-lg border transition-all ${cond.valueType === 'parameter' ? 'bg-brand/10 border-brand/30 text-brand' : 'bg-[var(--bg-alt)] border-[var(--border-base)] text-[var(--text-muted)] hover:text-brand'}`}
                                    title={cond.valueType === 'parameter' ? 'Switch to Literal' : 'Switch to Parameter'}
                                >
                                    <Icon name={cond.valueType === 'parameter' ? 'database' : 'settings'} size={14} />
                                </button>
                            )}

                            {cond.valueType === 'parameter' ? (
                                <select
                                    value={cond.value}
                                    onChange={(e) => {
                                        const newWheres = [...state.where];
                                        newWheres[index].value = e.target.value;
                                        setState((prev) => ({ ...prev, where: newWheres }));
                                    }}
                                    className="flex-1 bg-[var(--bg-alt)] border border-brand/30 rounded-lg px-3 py-2 text-xs font-bold text-brand outline-none"
                                >
                                    <option value="">Select parameter...</option>
                                    {parameters.map(p => (
                                        <option key={p.parameter_name} value={p.parameter_name}>{p.parameter_name}</option>
                                    ))}
                                </select>
                            ) : (
                                <input
                                    placeholder="value"
                                    value={cond.value}
                                    onChange={(e) => {
                                        const newWheres = [...state.where];
                                        newWheres[index].value = e.target.value;
                                        setState((prev) => ({ ...prev, where: newWheres }));
                                    }}
                                    disabled={cond.operator === 'IS NULL' || cond.operator === 'IS NOT NULL'}
                                    className={`flex-1 bg-[var(--bg-alt)] border border-[var(--border-base)] rounded-lg px-3 py-2 text-xs outline-none focus:border-brand ${(cond.operator === 'IS NULL' || cond.operator === 'IS NOT NULL') ? 'opacity-30' : ''
                                        }`}
                                />
                            )}
                        </div>

                        <button
                            onClick={() => {
                                const newWheres = [...state.where];
                                newWheres.splice(index, 1);
                                setState((prev) => ({ ...prev, where: newWheres }));
                            }}
                            className="text-[var(--text-muted)] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                        >
                            <Icon name="delete" size={16} />
                        </button>
                    </div>
                ))}

                {state.where.length === 0 && (
                    <div className="py-12 flex flex-col items-center justify-center border-2 border-dashed border-[var(--border-base)] rounded-2xl opacity-40">
                        <Icon name="filter_alt" size={32} className="mb-2 text-[var(--text-muted)]" />
                        <p className="text-xs font-medium">No conditions defined yet.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

const GroupingSortingView: React.FC<ViewProps> = ({ state, setState, getColumns, queryState }) => {
    const addGroupBy = () => {
        if (state.tables.length === 0) return;
        const newGroup = {
            id: `group_${Date.now()}`,
            tableAlias: state.tables[0].alias,
            columnName: ''
        };
        setState(prev => ({ ...prev, groupBy: [...(prev.groupBy || []), newGroup] }));
    };

    const addOrderBy = () => {
        if (state.tables.length === 0) return;
        const newOrder = {
            id: `order_${Date.now()}`,
            tableAlias: state.tables[0].alias,
            columnName: '',
            direction: 'ASC' as const
        };
        setState(prev => ({ ...prev, orderBy: [...(prev.orderBy || []), newOrder] }));
    };

    return (
        <div className="space-y-12 max-w-5xl">
            {/* Grouping Section */}
            <div className="space-y-6">
                <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center text-brand font-bold">
                            <Icon name="group_work" size={16} />
                        </div>
                        <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--text-main)]">Grouping (GROUP BY)</h3>
                    </div>
                    <button
                        onClick={addGroupBy}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-brand text-white text-xs font-bold hover:opacity-90 transition-all shadow-sm"
                    >
                        <Icon name="add" size={14} />
                        Add Group
                    </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(state.groupBy || []).map((group, index) => (
                        <div key={group.id} className="p-4 rounded-2xl border border-[var(--border-base)] bg-[var(--bg-app)] flex items-center gap-3 group">
                            <select
                                value={group.tableAlias}
                                onChange={(e) => {
                                    const newGroups = [...state.groupBy];
                                    newGroups[index].tableAlias = e.target.value;
                                    setState(prev => ({ ...prev, groupBy: newGroups }));
                                }}
                                className="bg-[var(--bg-alt)] border border-[var(--border-base)] rounded-lg px-2 py-2 text-xs outline-none focus:border-brand min-w-[100px]"
                            >
                                {state.tables.map((t) => <option key={t.alias} value={t.alias}>{t.alias}</option>)}
                            </select>
                            <ColumnSelect
                                tableAlias={group.tableAlias}
                                value={group.columnName}
                                onChange={(val: string) => {
                                    const newGroups = [...state.groupBy];
                                    newGroups[index].columnName = val;
                                    setState(prev => ({ ...prev, groupBy: newGroups }));
                                }}
                                getColumns={getColumns}
                                queryState={queryState}
                                state={state}
                            />
                            <button
                                onClick={() => {
                                    const newGroups = [...state.groupBy];
                                    newGroups.splice(index, 1);
                                    setState(prev => ({ ...prev, groupBy: newGroups }));
                                }}
                                className="text-[var(--text-muted)] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all ml-auto"
                            >
                                <Icon name="delete" size={16} />
                            </button>
                        </div>
                    ))}
                    {(state.groupBy || []).length === 0 && (
                        <div className="md:col-span-2 py-8 flex flex-col items-center justify-center border-2 border-dashed border-[var(--border-base)] rounded-2xl opacity-40">
                            <Icon name="group_work" size={24} className="mb-2 text-[var(--text-muted)]" />
                            <p className="text-[10px] font-medium uppercase tracking-tighter">No groupings defined</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Sorting Section */}
            <div className="space-y-6">
                <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center text-brand font-bold">
                            <Icon name="sort" size={16} />
                        </div>
                        <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--text-main)]">Sorting (ORDER BY)</h3>
                    </div>
                    <button
                        onClick={addOrderBy}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-brand text-white text-xs font-bold hover:opacity-90 transition-all shadow-sm"
                    >
                        <Icon name="add" size={14} />
                        Add Sort
                    </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(state.orderBy || []).map((order, index) => (
                        <div key={order.id} className="p-4 rounded-2xl border border-[var(--border-base)] bg-[var(--bg-app)] flex items-center gap-3 group">
                            <select
                                value={order.tableAlias}
                                onChange={(e) => {
                                    const newOrders = [...state.orderBy];
                                    newOrders[index].tableAlias = e.target.value;
                                    setState(prev => ({ ...prev, orderBy: newOrders }));
                                }}
                                className="bg-[var(--bg-alt)] border border-[var(--border-base)] rounded-lg px-2 py-2 text-xs outline-none focus:border-brand min-w-[100px]"
                            >
                                {state.tables.map((t) => <option key={t.alias} value={t.alias}>{t.alias}</option>)}
                            </select>
                            <ColumnSelect
                                tableAlias={order.tableAlias}
                                value={order.columnName}
                                onChange={(val: string) => {
                                    const newOrders = [...state.orderBy];
                                    newOrders[index].columnName = val;
                                    setState(prev => ({ ...prev, orderBy: newOrders }));
                                }}
                                getColumns={getColumns}
                                queryState={queryState}
                                state={state}
                                placeholder="Sort column..."
                            />
                            <select
                                value={order.direction}
                                onChange={(e) => {
                                    const newOrders = [...state.orderBy];
                                    newOrders[index].direction = e.target.value as 'ASC' | 'DESC';
                                    setState(prev => ({ ...prev, orderBy: newOrders }));
                                }}
                                className="bg-brand/5 text-brand border border-brand/20 rounded-lg px-2 py-2 text-[10px] font-bold outline-none focus:bg-brand focus:text-white transition-all w-20"
                            >
                                <option value="ASC">ASC</option>
                                <option value="DESC">DESC</option>
                            </select>
                            <button
                                onClick={() => {
                                    const newOrders = [...state.orderBy];
                                    newOrders.splice(index, 1);
                                    setState(prev => ({ ...prev, orderBy: newOrders }));
                                }}
                                className="text-[var(--text-muted)] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all ml-auto"
                            >
                                <Icon name="delete" size={16} />
                            </button>
                        </div>
                    ))}
                    {(state.orderBy || []).length === 0 && (
                        <div className="md:col-span-2 py-8 flex flex-col items-center justify-center border-2 border-dashed border-[var(--border-base)] rounded-2xl opacity-40">
                            <Icon name="sort" size={24} className="mb-2 text-[var(--text-muted)]" />
                            <p className="text-[10px] font-medium uppercase tracking-tighter">No sortings defined</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Limit Section */}
            <div className="space-y-6 pt-6 border-t border-[var(--border-base)]">
                <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center text-brand font-bold">
                            <Icon name="timer" size={16} />
                        </div>
                        <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--text-main)]">Result Limit (LIMIT)</h3>
                    </div>
                </div>
                <div className="flex items-center gap-6 p-6 rounded-2xl border border-[var(--border-base)] bg-[var(--bg-app)]">
                    <div className="flex items-center gap-3">
                        <input
                            type="checkbox"
                            id="use-limit"
                            checked={state.useLimit}
                            onChange={(e) => setState(prev => ({ ...prev, useLimit: e.target.checked }))}
                            className="w-4 h-4 rounded border-[var(--border-base)] text-brand focus:ring-brand"
                        />
                        <label htmlFor="use-limit" className="text-xs font-bold text-[var(--text-main)] cursor-pointer">
                            Enable Limit
                        </label>
                    </div>
                    
                    <div className={`flex items-center gap-3 transition-all ${state.useLimit ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Max Rows:</span>
                        <input
                            type="number"
                            value={state.limit || ''}
                            onChange={(e) => {
                                const val = parseInt(e.target.value, 10);
                                setState(prev => ({ ...prev, limit: isNaN(val) ? 0 : val }));
                            }}
                            className="w-32 bg-[var(--bg-alt)] border border-[var(--border-base)] rounded-lg px-3 py-2 text-xs font-bold outline-none focus:border-brand"
                            placeholder="e.g. 100"
                        />
                    </div>
                    
                    <div className="ml-auto flex items-center gap-2 text-[9px] text-[var(--text-muted)] italic">
                        <Icon name="info" size={12} />
                        <span>Preview is always limited to 1000 rows.</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

interface QueryBuilderModalProps {
    isOpen: boolean;
    onClose: () => void;
    onDone: (sql: string) => void;
    initialSql?: string;
    onError?: (error: string) => void;
    parameters?: ReportParameter[];
}

// --- Recursive CTE Helper Modal ---

interface RecursiveCteModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (config: any) => void;
    tables: string[];
    getColumns: (tableName: string) => Promise<any[]>;
    initialConfig?: any;
}

const RecursiveCteModal: React.FC<RecursiveCteModalProps> = ({ isOpen, onClose, onSubmit, tables, getColumns, initialConfig }) => {
    const [alias, setAlias] = useState('');
    const [anchorTable, setAnchorTable] = useState('');
    const [primaryKey, setPrimaryKey] = useState('id');
    const [parentKey, setParentKey] = useState('parent_id');
    const [depthColumn, setDepthColumn] = useState('level');
    const [availableColumns, setAvailableColumns] = useState<any[]>([]);

    useEffect(() => {
        if (isOpen) {
            setAlias(initialConfig?.alias || `tree${Math.floor(Math.random() * 100)}`);
            setAnchorTable(initialConfig?.anchorTable || '');
            setPrimaryKey(initialConfig?.primaryKey || 'id');
            setParentKey(initialConfig?.parentKey || 'parent_id');
            setDepthColumn(initialConfig?.depthColumn || 'level');
        }
    }, [isOpen, initialConfig]);

    useEffect(() => {
        if (anchorTable) {
            getColumns(anchorTable).then(setAvailableColumns);
        }
    }, [anchorTable, getColumns]);

    return (
        <AppCompactModalForm
            isOpen={isOpen}
            onClose={onClose}
            onSubmit={() => onSubmit({ alias, anchorTable, primaryKey, parentKey, depthColumn })}
            title="Recursive Query Builder"
            icon="table_recursive"
            width="max-w-xl"
        >
            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Block Alias</label>
                        <input
                            value={alias}
                            onChange={e => setAlias(e.target.value)}
                            placeholder="e.g. tree"
                            className="w-full bg-[var(--bg-alt)] border border-[var(--border-base)] rounded-lg px-3 py-2 text-xs outline-none focus:border-brand"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Base Table</label>
                        <select
                            value={anchorTable}
                            onChange={e => setAnchorTable(e.target.value)}
                            className="w-full bg-[var(--bg-alt)] border border-[var(--border-base)] rounded-lg px-3 py-2 text-xs outline-none focus:border-brand"
                        >
                            <option value="">Select table...</option>
                            {tables.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Primary Key (ID)</label>
                        <select
                            value={primaryKey}
                            onChange={e => setPrimaryKey(e.target.value)}
                            className="w-full bg-[var(--bg-alt)] border border-[var(--border-base)] rounded-lg px-3 py-2 text-xs outline-none focus:border-brand"
                        >
                            <option value="">Select PK...</option>
                            {availableColumns.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                        </select>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Parent Reference</label>
                        <select
                            value={parentKey}
                            onChange={e => setParentKey(e.target.value)}
                            className="w-full bg-[var(--bg-alt)] border border-[var(--border-base)] rounded-lg px-3 py-2 text-xs outline-none focus:border-brand"
                        >
                            <option value="">Select Parent Key...</option>
                            {availableColumns.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                        </select>
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Depth Column (Optional)</label>
                    <input
                        value={depthColumn}
                        onChange={e => setDepthColumn(e.target.value)}
                        placeholder="e.g. level (leave empty to skip)"
                        className="w-full bg-[var(--bg-alt)] border border-[var(--border-base)] rounded-lg px-3 py-2 text-xs outline-none focus:border-brand"
                    />
                </div>

                <div className="p-3 bg-blue-500/5 border border-blue-500/20 rounded-xl">
                    <p className="text-[10px] text-blue-500 font-medium leading-relaxed">
                        This helper will generate a recursive CTE that joins the table with itself to traverse hierarchical data.
                        The initial level will be where the parent reference is NULL.
                    </p>
                </div>
            </div>
        </AppCompactModalForm>
    );
};

// Note: Rename logic now handled directly via states to ensure OK button works

export const QueryBuilderModal: React.FC<QueryBuilderModalProps> = ({ isOpen, onClose, onDone, initialSql, onError, parameters = [] }) => {
    const { tables, getColumns, loading } = useDatabaseMetadata();

    const [fullState, setFullState] = useState<MultiQueryState>({
        ctes: [],
        mainQuery: {
            tables: [],
            selectedFields: [],
            joins: [],
            where: [],
            groupBy: [],
            orderBy: [],
            limit: 100,
            useLimit: false
        }
    });

    const [activeBlockId, setActiveBlockId] = useState('main');
    const [activeTab, setActiveTab] = useState<'tables' | 'joins' | 'conditions' | 'grouping_sorting'>('tables');
    const [previewSql, setPreviewSql] = useState('');
    const [activeDragItem, setActiveDragItem] = useState<any>(null);
    const [grabOffset, setGrabOffset] = useState({ x: 0, y: 0 });
    const [parameterValues, setParameterValues] = useState<Record<string, any>>({});
    const [editingField, setEditingField] = useState<SelectedField | null>(null);
    const [editingCTE, setEditingCTE] = useState<any>(null);
    const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
    const [isRecursiveModalOpen, setIsRecursiveModalOpen] = useState(false);
    const [dragDelta, setDragDelta] = useState({ x: 0, y: 0 });
    const [overId, setOverId] = useState<string | null>(null);
    const [isCopied, setIsCopied] = useState(false);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [cteToDelete, setCteToDelete] = useState<{ id: string, alias: string } | null>(null);
    const addButtonRef = useRef<HTMLButtonElement>(null);
    const [addAnchorRect, setAddAnchorRect] = useState<DOMRect | null>(null);
    const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
    const [cteToRename, setCteToRename] = useState<{ id: string, alias: string } | null>(null);
    const [renameValue, setRenameValue] = useState('');
    const lastParsedSqlRef = useRef<string | null>(null);
    const prevIsOpenRef = useRef(false);

    // DND Sensors
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


    // Execution state
    const [isExecuting, setIsExecuting] = useState(false);
    const [queryResults, setQueryResults] = useState<any[]>([]);
    const [executionError, setExecutionError] = useState<string | null>(null);
    const [isResultsOpen, setIsResultsOpen] = useState(false);

    const activeBlock = useMemo(() => {
        if (activeBlockId === 'main') {
            return { id: 'main', alias: 'Main Query', state: fullState.mainQuery };
        }
        return fullState.ctes.find(c => c.id === activeBlockId) || { id: 'main', alias: 'Main Query', state: fullState.mainQuery };
    }, [activeBlockId, fullState]);

    const activeState = activeBlock.state;

    const updateActiveState = (updater: (prev: QueryState) => QueryState) => {
        setFullState(prev => {
            if (activeBlockId === 'main') {
                return { ...prev, mainQuery: updater(prev.mainQuery) };
            }
            return {
                ...prev,
                ctes: prev.ctes.map(c => c.id === activeBlockId ? { ...c, state: updater(c.state) } : c)
            };
        });
    };

    const effectiveSql = useMemo(() => {
        if (activeBlockId === 'main') {
            return { sql: generateSQL(fullState), canRun: !!generateSQL(fullState).trim() };
        }

        const targetCte = fullState.ctes.find(c => c.id === activeBlockId);
        if (!targetCte) return { sql: '', canRun: false };

        if (targetCte.isRecursive) {
            return { sql: 'Main query only (Recursive CTE)', canRun: false };
        }

        const cteAliases = fullState.ctes.map(c => c.alias);
        const dependsOnOtherCte = targetCte.state.tables.some(t => cteAliases.includes(t.tableName));

        if (dependsOnOtherCte) {
            return { sql: 'Main query only (depends on other blocks)', canRun: false };
        }

        const sql = generateBlockSQL(targetCte.state, { isForPreview: true });
        return { sql, canRun: !!sql.trim() };
    }, [activeBlockId, fullState]);

    useEffect(() => {
        setPreviewSql(effectiveSql.sql);
    }, [effectiveSql]);

    useEffect(() => {
        const isOpening = isOpen && !prevIsOpenRef.current;
        prevIsOpenRef.current = isOpen;

        if (isOpening) {
            if (initialSql && initialSql.trim() !== "") {
                // Only re-parse if it's a different SQL than what we last parsed
                // or if we're explicitly opening it for the first time/re-opening.
                try {
                    const parsedState = parseSQL(initialSql);
                    if (parsedState.mainQuery.tables.length === 0 && initialSql.trim().length > 0) {
                        throw new Error("Could not identify tables in the provided SQL. Please ensure it follows a standard SELECT ... FROM ... format.");
                    }
                    setFullState(parsedState);
                    lastParsedSqlRef.current = initialSql;
                } catch (err: any) {
                    console.error("SQL Parse Error:", err);
                    onError?.(err.message || 'Unknown parsing error');
                    onClose(); 
                }
            } else {
                // Reset to blank when opening without initialSql (or empty)
                setFullState({
                    ctes: [],
                    mainQuery: { tables: [], selectedFields: [], joins: [], where: [], groupBy: [], orderBy: [] }
                });
                lastParsedSqlRef.current = null;
            }
        }
    }, [isOpen, initialSql, onError, onClose]);

    useEffect(() => {
        if (parameters && parameters.length > 0) {
            setParameterValues(prev => {
                const next = { ...prev };
                parameters.forEach(p => {
                    if (next[p.parameter_name] === undefined) {
                        next[p.parameter_name] = p.default_value === null ? '' : p.default_value;
                    }
                });
                return next;
            });
        }
    }, [parameters]);

    const handleExecuteQuery = useCallback(async () => {
        if (isExecuting || !effectiveSql.canRun) return;

        setIsExecuting(true);
        setExecutionError(null);
        setQueryResults([]);
        
        try {
            const res = await apiClient.post('/database-metadata/execute', { 
                sql: effectiveSql.sql,
                params: parameterValues 
            });
            setQueryResults(res.data);
            setIsResultsOpen(true);
        } catch (err: any) {
            console.error("Execution error:", err);
            const errorMsg = err.response?.data?.detail || err.message || 'Execution error';
            setExecutionError(errorMsg);
            setIsResultsOpen(true); // Open modal even on error to show the message
            onError?.(errorMsg);
        } finally {
            setIsExecuting(false);
        }
    }, [isExecuting, effectiveSql, apiClient, onError, parameterValues]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;

            // If any nested internal modal is open, ignore global shortcut
            if (isResultsOpen || isRecursiveModalOpen || isRenameModalOpen || !!editingField || !!editingCTE || isDeleteConfirmOpen) {
                return;
            }

            // Z-index check to handle nested modals: only the top-most one should catch the event
            const modals = Array.from(document.querySelectorAll('.fixed.inset-0.z-\\[2000\\], .fixed.inset-0.z-\\[1000\\], .fixed.inset-0.z-\\[3000\\], [role="dialog"]')) as HTMLElement[];
            if (modals.length > 0) {
                const highestZ = Math.max(...modals.map(m => parseInt(getComputedStyle(m).zIndex) || 0));
                // QueryBuilderModal is z-[1000]
                const ourZ = 1000;
                
                if (ourZ < highestZ) return;
            }

            // Intercept and stop propagation for all global application shortcuts
            // only those that QueryBuilderModal itself doesn't use (like F1, F2, F4, Ctrl+S)
            const isGlobalShortcut = 
                (/^F\d+$/.test(e.key) && e.key !== 'F5' && e.key !== 'F9') || 
                ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's');

            if (isGlobalShortcut) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }

            // ESC to close Query Builder
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                onClose();
                return;
            }

            // F5/F9 (Compile/Generate)
            if (e.key === 'F5' || e.key === 'F9' || (e.key === 'r' && (e.metaKey || e.ctrlKey))) {
                e.preventDefault();
                e.stopPropagation();
                handleExecuteQuery();
            }
        };

        window.addEventListener('keydown', handleKeyDown, true);
        return () => window.removeEventListener('keydown', handleKeyDown, true);
    }, [isOpen, handleExecuteQuery, onClose, isResultsOpen, isRecursiveModalOpen, isRenameModalOpen, editingField, editingCTE, isDeleteConfirmOpen]);

    const handleCopyResults = async () => {
        try {
            const text = JSON.stringify(queryResults, null, 2);
            await navigator.clipboard.writeText(text);
            setIsCopied(true);
            
            // Auto-close after 0.6s as requested
            setTimeout(() => {
                setIsResultsOpen(false);
                setIsCopied(false);
            }, 600);
        } catch (err) {
            console.error('Failed to copy!', err);
        }
    };

    const handleAddTable = (tableName: string, isCte = false, isRecursive = false) => {
        const existingCount = activeState.tables.filter((t: any) => t.tableName === tableName).length;
        const alias = existingCount === 0 ? tableName : `${tableName}_${existingCount + 1}`;

        updateActiveState(prev => ({
            ...prev,
            tables: [...prev.tables, { alias, tableName, isCte, isRecursive }]
        }));
    };

    const handleRemoveTableAlias = (alias: string) => {
        updateActiveState(prev => ({
            ...prev,
            tables: prev.tables.filter(t => t.alias !== alias),
            selectedFields: prev.selectedFields.filter(f => f.tableAlias !== alias),
            joins: prev.joins.filter(j => j.leftTableAlias !== alias && j.rightTableAlias !== alias),
            where: prev.where.filter(w => w.tableAlias !== alias),
            groupBy: prev.groupBy.filter(g => g.tableAlias !== alias),
            orderBy: prev.orderBy.filter(o => o.tableAlias !== alias)
        }));
    };



    const handleRemoveField = (id: string) => {
        updateActiveState(prev => ({
            ...prev,
            selectedFields: prev.selectedFields.filter(f => f.id !== id)
        }));
    };

    const handleMoveTable = (activeId: string, overId: string) => {
        updateActiveState(prev => {
            const oldIndex = prev.tables.findIndex(t => t.alias === activeId);
            const newIndex = prev.tables.findIndex(t => t.alias === overId);

            if (oldIndex !== -1 && newIndex !== -1) {
                return {
                    ...prev,
                    tables: arrayMove(prev.tables, oldIndex, newIndex)
                };
            }
            return prev;
        });
    };

    const handleMoveField = (activeId: string, overId: string) => {
        updateActiveState(prev => {
            const oldIndex = prev.selectedFields.findIndex(f => f.id === activeId);
            const newIndex = prev.selectedFields.findIndex(f => f.id === overId);

            if (oldIndex !== -1 && newIndex !== -1) {
                return {
                    ...prev,
                    selectedFields: arrayMove(prev.selectedFields, oldIndex, newIndex)
                };
            }
            return prev;
        });
    };

    const handleGlobalDragEnd = (event: DragEndEvent) => {
        const { active, over, delta } = event;
        setActiveDragItem(null);
        setDragDelta({ x: 0, y: 0 });

        const activeId = active.id as string;
        const overId = over?.id as string;

        // DND Debugging
        console.log('[DND] End:', { activeId, overId, delta, dragDelta });

        // Case 1: Dragging an existing field
        const isDraggingExistingField = activeState.selectedFields.some(f => f.id === activeId);
        if (isDraggingExistingField) {
            // Field removal: if dropped outside the fields area
            const isOverFieldsArea = overId && (
                overId === 'selected-fields-drop-zone' ||
                activeState.selectedFields.some(f => f.id === overId)
            );

            if (!isOverFieldsArea) {
                console.log('[DND] Removing field (dropped outside):', activeId);
                handleRemoveField(activeId);
                return;
            }

            // Field reordering
            if (overId && activeId !== overId && overId !== 'selected-fields-drop-zone') {
                console.log('[DND] Reordering field:', activeId, 'over', overId);
                handleMoveField(activeId, overId);
            }
            return;
        }

        // Case 2: Adding a field from a table
        if (activeId.startsWith('source-field:')) {
            if (!overId) return;

            const isOverFieldsArea = overId === 'selected-fields-drop-zone' ||
                activeState.selectedFields.some(f => f.id === overId);

            if (isOverFieldsArea) {
                const [, tableAlias, columnName, columnType] = activeId.split(':');
                const newField: SelectedField = {
                    id: `${tableAlias}_${columnName}_${Date.now()}`,
                    tableAlias,
                    columnName,
                    columnType
                };

                updateActiveState(prev => {
                    const overIndex = prev.selectedFields.findIndex(f => f.id === overId);
                    const newFields = [...prev.selectedFields];
                    if (overIndex !== -1) {
                        newFields.splice(overIndex, 0, newField);
                    } else {
                        newFields.push(newField);
                    }
                    return { ...prev, selectedFields: newFields };
                });
            }
            return;
        }

        // Case 3: Adding All Columns from an existing table
        if (activeState.tables.some(t => t.alias === activeId)) {
            const isOverFieldsArea = overId && (
                overId === 'selected-fields-drop-zone' ||
                activeState.selectedFields.some(f => f.id === overId)
            );

            if (isOverFieldsArea) {
                const table = activeState.tables.find(t => t.alias === activeId);
                if (table) {
                    handleAddAllTableColumns(table.alias, table.tableName);
                }
                return;
            }

            // Case 4: Table reordering or removal
            const isOverTablesArea = overId && (
                overId === 'selected-tables-drop-zone' ||
                activeState.tables.some(t => t.alias === overId)
            );

            if (!isOverTablesArea) {
                console.log('[DND] Removing table (dropped outside):', activeId);
                handleRemoveTableAlias(activeId);
                return;
            }

            if (overId && activeState.tables.some(t => t.alias === overId) && activeId !== overId) {
                handleMoveTable(activeId, overId);
            }
            return;
        }

        // Case 5: Adding a table from sidebar
        if (activeId.startsWith('source-table:')) {
            const parts = activeId.split(':');
            const tableName = parts[1];
            const isCte = parts[2] === 'true';
            const isRecursive = parts[3] === 'true';

            const isOverTablesArea = overId && (
                overId === 'selected-tables-drop-zone' ||
                activeState.tables.some(t => t.alias === overId)
            );

            const isOverFieldsArea = overId && (
                overId === 'selected-fields-drop-zone' ||
                activeState.selectedFields.some(f => f.id === overId)
            );

            if (isOverTablesArea) {
                const existingCount = activeState.tables.filter((t: any) => t.tableName === tableName).length;
                const alias = existingCount === 0 ? tableName : `${tableName}_${existingCount + 1}`;
                const newTable = { alias, tableName, isCte, isRecursive };

                updateActiveState(prev => {
                    const overIndex = prev.tables.findIndex(t => t.alias === overId);
                    const newTables = [...prev.tables];
                    if (overIndex !== -1) {
                        newTables.splice(overIndex, 0, newTable);
                    } else {
                        newTables.push(newTable);
                    }
                    return { ...prev, tables: newTables };
                });
            } else if (isOverFieldsArea) {
                // Add table to Selected Tables + expand all columns into Selected Fields individually
                const existingCount = activeState.tables.filter((t: any) => t.tableName === tableName).length;
                const alias = existingCount === 0 ? tableName : `${tableName}_${existingCount + 1}`;
                const newTable = { alias, tableName, isCte, isRecursive };

                // Resolve columns (CTE or DB table)
                const cte = fullState.ctes.find((c: any) => c.alias === tableName);
                if (cte) {
                    const columns: { name: string }[] = cte.state.selectedFields
                        .map((f: any) => ({ name: f.alias || f.columnName || '' }))
                        .filter((c: any) => c.name);
                    if (cte.isRecursive && cte.recursiveConfig?.depthColumn) {
                        columns.push({ name: cte.recursiveConfig.depthColumn });
                    }
                    // Apply immediately (sync)
                    updateActiveState(prev => {
                        const newFields: SelectedField[] = columns
                            .filter(col => !prev.selectedFields.some(f => f.tableAlias === alias && f.columnName === col.name))
                            .map(col => ({
                                id: `${alias}_${col.name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                                tableAlias: alias,
                                columnName: col.name,
                                columnType: (col as any).type
                            }));
                        return {
                            ...prev,
                            tables: [...prev.tables, newTable],
                            selectedFields: [...prev.selectedFields, ...newFields]
                        };
                    });
                } else {
                    // Async: fetch DB columns then update state
                    getColumns(tableName).then(cols => {
                        updateActiveState(prev => {
                            const newFields: SelectedField[] = cols
                                .filter(col => !prev.selectedFields.some(f => f.tableAlias === alias && f.columnName === col.name))
                                .map(col => ({
                                    id: `${alias}_${col.name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                                    tableAlias: alias,
                                    columnName: col.name,
                                    columnType: col.type
                                }));
                            return {
                                ...prev,
                                tables: [...prev.tables, newTable],
                                selectedFields: [...prev.selectedFields, ...newFields]
                            };
                        });
                    });
                }
            }
            return;
        }
    };

    const handleAddAllTableColumns = async (tableAlias: string, tableName: string) => {
        // For CTE (virtual) tables, derive columns from the CTE's selectedFields
        // instead of making an API call (the DB has no such table)
        const cte = fullState.ctes.find((c: any) => c.alias === tableName);
        let columns: { name: string }[];
        if (cte) {
            columns = cte.state.selectedFields.map((f: any) => ({
                name: f.alias || f.columnName || ''
            })).filter((c: any) => c.name);
            if (cte.isRecursive && cte.recursiveConfig?.depthColumn) {
                columns.push({ name: cte.recursiveConfig.depthColumn });
            }
        } else {
            columns = await getColumns(tableName);
        }
        updateActiveState(prev => {
            const existingFieldColumns = new Set(
                prev.selectedFields
                    .filter(f => f.tableAlias === tableAlias)
                    .map(f => f.columnName)
            );

            const newFields: SelectedField[] = columns
                .filter(col => !existingFieldColumns.has(col.name))
                .map(col => ({
                    id: `${tableAlias}_${col.name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    tableAlias,
                    columnName: col.name,
                    columnType: (col as any).type
                }));

            return {
                ...prev,
                selectedFields: [...prev.selectedFields, ...newFields]
            };
        });
    };

    const handleGlobalDragStart = (event: any) => {
        const { active, activatorEvent } = event;
        setActiveDragItem(active);
        setDragDelta({ x: 0, y: 0 });
        setOverId(null);

        // Calculate where on the element we grabbed it
        const rect = active.rect.current.initial;
        if (rect && activatorEvent) {
            setGrabOffset({
                x: (activatorEvent as MouseEvent).clientX - rect.left,
                y: (activatorEvent as MouseEvent).clientY - rect.top
            });
        }
    };

    const handleGlobalDragMove = (event: any) => {
        setDragDelta({
            x: event.delta.x,
            y: event.delta.y
        });
        setOverId(event.over?.id || null);
    };

    const handleAddCTE = (isRecursive = false, config?: any) => {
        const id = editingCTE ? editingCTE.id : `cte_${Date.now()}`;
        const alias = config?.alias || `tab${fullState.ctes.length + 1}`;

        let state: QueryState = editingCTE ? editingCTE.state : { tables: [], selectedFields: [], joins: [], where: [], groupBy: [], orderBy: [] };

        if (isRecursive && config && !editingCTE) {
            // Pre-fill state for NEW recursive CTE
            state = {
                tables: [{ alias: config.anchorTable, tableName: config.anchorTable }],
                selectedFields: [{
                    id: `all_${Date.now()}`,
                    tableAlias: config.anchorTable,
                    columnName: '*'
                }],
                joins: [],
                where: [{
                    id: `where_${Date.now()}`,
                    tableAlias: config.anchorTable,
                    columnName: config.parentKey,
                    operator: 'IS NULL',
                    value: 'NULL',
                    logic: 'AND'
                }],
                groupBy: [],
                orderBy: []
            };
        }

        setFullState(prev => {
            if (editingCTE) {
                return {
                    ...prev,
                    ctes: prev.ctes.map(c => c.id === id ? {
                        ...c,
                        alias,
                        isRecursive,
                        recursiveConfig: config
                    } : c)
                };
            }
            return {
                ...prev,
                ctes: [...prev.ctes, {
                    id,
                    alias,
                    state,
                    isRecursive,
                    recursiveConfig: isRecursive ? config : undefined
                }]
            };
        });

        if (!editingCTE) {
            setActiveBlockId(id);
        }

        setIsAddMenuOpen(false);
        setEditingCTE(null);
    };

    const handleRemoveCTE = (id: string, alias: string) => {
        setFullState(prev => {
            const newCtes = prev.ctes.filter(c => c.id !== id);
            // If we are removing the active CTE, switch back to main
            if (activeBlockId === id) {
                setActiveBlockId('main');
            }

            // Also need to remove this CTE as a virtual table from ANY other block
            const cleanupBlock = (s: QueryState): QueryState => ({
                ...s,
                tables: s.tables.filter(t => t.tableName !== alias),
                selectedFields: s.selectedFields.filter(f => f.tableAlias !== alias),
                joins: s.joins.filter(j => j.leftTableAlias !== alias && j.rightTableAlias !== alias),
                where: s.where.filter(w => w.tableAlias !== alias)
            });

            return {
                ctes: newCtes.map(c => ({ ...c, state: cleanupBlock(c.state) })),
                mainQuery: cleanupBlock(prev.mainQuery)
            };
        });
    };

    const confirmDeleteCTE = () => {
        if (cteToDelete) {
            handleRemoveCTE(cteToDelete.id, cteToDelete.alias);
            setIsDeleteConfirmOpen(false);
            setCteToDelete(null);
        }
    };

    const handleRenameCTE = (id: string, newAlias: string) => {
        const trimmedAlias = newAlias.trim();
        
        // Validation
        if (!trimmedAlias) {
            setIsRenameModalOpen(false);
            return;
        }

        const oldCte = fullState.ctes.find(c => c.id === id);
        if (!oldCte) return;

        const oldAlias = oldCte.alias;

        if (trimmedAlias === oldAlias) {
            setIsRenameModalOpen(false);
            return;
        }

        // Check if alias already exists in other CTEs
        const exists = fullState.ctes.some(c => c.id !== id && c.alias.toLowerCase() === trimmedAlias.toLowerCase());
        if (exists) {
            onError?.(`CTE alias "${trimmedAlias}" already exists.`);
            setIsRenameModalOpen(false);
            return;
        }

        // Valid identifier check
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(trimmedAlias)) {
            onError?.('Invalid alias name. Use only letters, numbers, and underscores, starting with a letter or underscore.');
            setIsRenameModalOpen(false);
            return;
        }

        setFullState(prev => {
            // 1. Update the CTE itself
            const updatedCtes = prev.ctes.map(c => 
                c.id === id ? { ...c, alias: trimmedAlias } : c
            );

            // 2. Helper to update references in a QueryState
            const updateRefs = (state: QueryState): QueryState => ({
                ...state,
                tables: state.tables.map(t => {
                    // Update if tableName matches (it's the source)
                    const isOldTarget = t.tableName === oldAlias;
                    if (isOldTarget) {
                        return { 
                            ...t, 
                            tableName: trimmedAlias, 
                            // Update alias only if it was matching the old tableName
                            alias: t.alias === oldAlias ? trimmedAlias : t.alias 
                        };
                    }
                    return t;
                }),
                selectedFields: state.selectedFields.map(f => 
                    f.tableAlias === oldAlias ? { ...f, tableAlias: trimmedAlias } : f
                ),
                joins: state.joins.map(j => ({
                    ...j,
                    leftTableAlias: j.leftTableAlias === oldAlias ? trimmedAlias : j.leftTableAlias,
                    rightTableAlias: j.rightTableAlias === oldAlias ? trimmedAlias : j.rightTableAlias
                })),
                where: state.where.map(w => 
                    w.tableAlias === oldAlias ? { ...w, tableAlias: trimmedAlias } : w
                )
            });

            // 3. Update all blocks (Regular + Recursive configs)
            return {
                ctes: updatedCtes.map(c => {
                    let nextCte = { ...c, state: updateRefs(c.state) };
                    // If this CTE is recursive and its anchor was the renamed CTE
                    if (nextCte.isRecursive && nextCte.recursiveConfig?.anchorTable === oldAlias) {
                        nextCte.recursiveConfig = { ...nextCte.recursiveConfig, anchorTable: trimmedAlias };
                    }
                    return nextCte;
                }),
                mainQuery: updateRefs(prev.mainQuery)
            };
        });
        
        setIsRenameModalOpen(false);
        setCteToRename(null);
    };

    const dragModifiers = useMemo(() => [
        (args: any) => {
            const { transform, active } = args;
            if (!active) return transform;

            // Use the initial rect of the source node for height only
            const h = active.rect.current.initial?.height ?? 0;
            
            // Center the overlay relative to its new fixed 200px width
            const targetHalfW = 100; // 200px / 2
            const targetHalfH = h / 2;

            return {
                ...transform,
                x: transform.x + grabOffset.x - targetHalfW + 200,
                y: transform.y + grabOffset.y - targetHalfH,
            };
        }
    ], [grabOffset, activeState.selectedFields]);

    if (!isOpen) return null;

    return (
        <AppCompactModalForm
            isOpen={isOpen}
            onClose={onClose}
            title="Query Builder"
            icon="database"
            fullHeight
            noPadding
            allowedShortcuts={['F5', 'F9']}
            width="w-[95vw] max-w-[1400px]"
            submitLabel="Ready"
            cancelLabel="Cancel"
            onSubmit={() => {
                const finalSql = generateSQL(fullState, { isForPreview: false });
                onDone(finalSql);
            }}
            className="flex flex-col"
            headerRightContent={
                <>
                    {isExecuting && (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-brand/10 text-brand text-[10px] font-bold animate-pulse">
                            <div className="w-3 h-3 border-2 border-brand/30 border-t-brand rounded-full animate-spin" />
                            Executing...
                        </div>
                    )}
                    <button
                        type="button"
                        onClick={handleExecuteQuery}
                        disabled={isExecuting || !effectiveSql.canRun}
                        className={`px-4 py-1.5 bg-[var(--bg-alt)] border border-[var(--border-base)] text-brand text-[10px] font-bold rounded-lg transition-all shadow-sm flex items-center gap-2 ${(!effectiveSql.canRun && !isExecuting) ? 'opacity-40 cursor-not-allowed grayscale' : 'hover:bg-brand/5'
                            }`}
                        title={!effectiveSql.canRun ? effectiveSql.sql : "Shortcut: F5 or F9"}
                    >
                        <Icon name="play_arrow" size={14} />
                        Run (F5)
                    </button>
                </>
            }
        >
            <div className="flex-1 flex overflow-hidden min-h-0">
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragStart={handleGlobalDragStart}
                    onDragMove={handleGlobalDragMove}
                    onDragEnd={handleGlobalDragEnd}
                >
                    <DragOverlay
                        modifiers={dragModifiers}
                        dropAnimation={{
                            sideEffects: defaultDropAnimationSideEffects({
                                styles: {
                                    active: {
                                        opacity: '0.4',
                                    },
                                },
                            }),
                        }}>
                        {activeDragItem ? (
                            (() => {
                                const id = activeDragItem.id.toString();
                                const isExistingField = activeState.selectedFields.some(f => f.id === id);
                                const isExistingTable = activeState.tables.some(t => t.alias === id);

                                const isOverFieldsArea = overId && (
                                    overId === 'selected-fields-drop-zone' ||
                                    activeState.selectedFields.some(f => f.id === overId)
                                );

                                const isOverTablesArea = overId && (
                                    overId === 'selected-tables-drop-zone' ||
                                    activeState.tables.some(t => t.alias === overId)
                                );

                                const isFieldOutside = isExistingField && !isOverFieldsArea;
                                const isTableOutside = isExistingTable && !isOverTablesArea && !isOverFieldsArea;

                                const isOutside = isFieldOutside || isTableOutside;
                                const isSourceTable = id.startsWith('source-table:');
                                const isTableType = isExistingTable || isSourceTable;

                                return (
                                    <div className={`group flex items-center gap-3 p-2 rounded-xl border-2 shadow-2xl w-[200px] pointer-events-none transition-all duration-200 ${isOutside
                                            ? 'border-red-500 bg-red-500/10 text-red-500 scale-95 opacity-90 backdrop-blur-sm'
                                            : 'border-brand/40 bg-[var(--bg-app)] text-[var(--text-main)] scale-100'
                                        }`}>
                                        <div className={`p-1 ${isOutside ? 'text-red-500' : 'text-brand'}`}>
                                            <Icon name={isOutside ? 'delete' : 'drag_indicator'} size={14} />
                                        </div>

                                        {(() => {
                                            if (isTableType) {
                                                const parts = id.split(':');
                                                const tableName = isSourceTable ? parts[1] : id;
                                                const isCte = isSourceTable ? parts[2] === 'true' : activeState.tables.find(t => t.alias === id)?.isCte;
                                                const isRecursive = isSourceTable ? parts[3] === 'true' : activeState.tables.find(t => t.alias === id)?.isRecursive;

                                                return (
                                                    <>
                                                        <div className={`p-1.5 rounded-lg ${isOutside
                                                                ? 'bg-red-500/20 text-red-500'
                                                                : 'bg-brand/10 text-brand'
                                                            }`}>
                                                            <Icon name={isOutside ? 'delete_forever' : (isCte ? (isRecursive ? 'table_recursive' : 'table_virtual') : 'table_chart')} size={14} />
                                                        </div>
                                                        <div className="flex-1 flex flex-col min-w-0">
                                                            <span className={`text-xs font-bold truncate ${isOutside ? 'text-red-600' : 'text-[var(--text-main)]'}`}>
                                                                {tableName}
                                                            </span>
                                                            <span className={`text-[10px] font-medium opacity-70 ${isOutside ? 'text-red-400' : 'text-[var(--text-muted)]'}`}>
                                                                {isOutside ? 'Release to remove' : (isCte ? 'Query Block' : 'Database Table')}
                                                            </span>
                                                        </div>
                                                    </>
                                                );
                                            }

                                            const field = activeState.selectedFields.find(f => f.id === id);
                                            const isExpression = !!field?.expression;
                                            return (
                                                <>
                                                    <div className={`p-1.5 rounded-lg ${isOutside
                                                            ? 'bg-red-500/20 text-red-500'
                                                            : (isExpression ? 'bg-amber-500/10 text-amber-500' : 'bg-brand/10 text-brand')
                                                        }`}>
                                                        <Icon name={isOutside ? 'delete_forever' : 'table_rows'} size={14} />
                                                    </div>
                                                    <div className="flex-1 flex flex-col min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className={`text-xs font-bold truncate ${isOutside ? 'text-red-600' : 'text-[var(--text-main)]'}`}>
                                                                {field?.expression || `${field?.tableAlias}.${field?.columnName}`}
                                                            </span>
                                                            {field?.alias && !isOutside && (
                                                                <span className="text-[10px] text-brand font-bold bg-brand/5 px-1.5 py-0.5 rounded">AS {field.alias}</span>
                                                            )}
                                                        </div>
                                                        <span className={`text-[10px] font-medium opacity-70 ${isOutside ? 'text-red-400' : 'text-[var(--text-muted)]'}`}>
                                                            {isOutside ? 'Release to remove' : (isExpression ? 'Custom Expression' : (field?.columnName === '*' ? 'All Columns' : `${field?.tableAlias} column`))}
                                                        </span>
                                                    </div>
                                                </>
                                            );
                                        })()}
                                    </div>
                                );
                            })()
                        ) : null}
                    </DragOverlay>

                    {/* Left Sidebar: Tables List */}
                <div className="w-64 border-r border-[var(--border-base)] flex flex-col bg-[var(--bg-alt)]">
                    <div className="p-4 border-b border-[var(--border-base)]">
                        <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-2">
                            <Icon name="table_chart" size={14} />
                            Available Tables
                        </h3>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        <div>
                            <div className="px-2 py-1 flex items-center justify-between">
                                <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-2">
                                    <Icon name="database" size={14} />
                                    Available Tables
                                </h3>
                            </div>
                            {loading ? (
                                <div className="p-4 text-xs text-[var(--text-muted)] italic">Loading...</div>
                            ) : (
                                <div className="space-y-1">
                                    {/* Temporary Tables (CTEs) */}
                                    {fullState.ctes.map(cte => (
                                        <DraggableTableSidebarItem
                                            key={cte.id}
                                            id={cte.alias}
                                            label={cte.alias}
                                            isCte={true}
                                            isRecursive={cte.isRecursive}
                                            onAdd={() => handleAddTable(cte.alias, true, cte.isRecursive)}
                                        />
                                    ))}

                                    {/* Database Tables */}
                                    {tables.map(table => (
                                        <DraggableTableSidebarItem
                                            key={table}
                                            id={table}
                                            label={table}
                                            onAdd={() => handleAddTable(table)}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Center Content */}
                <div className="flex-1 flex flex-col min-w-0 bg-[var(--bg-app)]">
                    {/* Block Toolbar */}
                    {/* Query Tabs Bar */}
                    <div className="px-6 border-b border-[var(--border-base)] bg-[var(--bg-app)] flex items-center gap-1 group/tabs overflow-x-auto no-scrollbar pt-4">
                        {/* Main Query Tab */}
                        <button
                            onClick={() => setActiveBlockId('main')}
                            className={`px-4 py-2 text-[11px] font-bold uppercase tracking-wider transition-all border-t-2 border-x border-b-0 rounded-t-xl -mb-[1px] flex items-center gap-2 whitespace-nowrap ${
                                activeBlockId === 'main'
                                    ? 'bg-[var(--bg-app)] border-[var(--border-base)] text-brand border-t-brand'
                                    : 'bg-[var(--bg-alt)] border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-app)]'
                            }`}
                        >
                            <Icon name="sql" size={14} />
                            Main Query
                        </button>

                        {/* CTE Tabs */}
                        {fullState.ctes.map(cte => (
                            <div key={cte.id} className="relative group">
                                <button
                                    onClick={() => setActiveBlockId(cte.id)}
                                    onDoubleClick={() => {
                                        setCteToRename({ id: cte.id, alias: cte.alias });
                                        setRenameValue(cte.alias);
                                        setIsRenameModalOpen(true);
                                    }}
                                    className={`px-4 py-2 text-[11px] font-bold uppercase tracking-wider transition-all border-t-2 border-x border-b-0 rounded-t-xl -mb-[1px] flex items-center gap-2 whitespace-nowrap pr-8 ${
                                        activeBlockId === cte.id
                                            ? 'bg-[var(--bg-app)] border-[var(--border-base)] text-brand border-t-brand'
                                            : 'bg-[var(--bg-alt)] border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-app)]'
                                    }`}
                                >
                                    <Icon name={cte.isRecursive ? 'table_recursive' : 'table_virtual'} size={14} />
                                    {cte.alias}
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setCteToDelete({ id: cte.id, alias: cte.alias });
                                        setIsDeleteConfirmOpen(true);
                                    }}
                                    className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md transition-all hover:bg-red-500/10 hover:text-red-500 ${
                                        activeBlockId === cte.id ? 'text-[var(--text-muted)]' : 'text-transparent group-hover:text-[var(--text-muted)]'
                                    }`}
                                >
                                    <Icon name="close" size={12} />
                                </button>
                            </div>
                        ))}

                        {/* Add Button */}
                        <div className="relative ml-2 pb-px flex-shrink-0">
                            <button
                                ref={addButtonRef}
                                onClick={() => {
                                    setAddAnchorRect(addButtonRef.current?.getBoundingClientRect() || null);
                                    setIsAddMenuOpen(!isAddMenuOpen);
                                }}
                                className={`p-2 rounded-xl transition-all ${isAddMenuOpen ? 'bg-brand text-white' : 'hover:bg-brand/10 text-brand'}`}
                                title="Add new query block"
                            >
                                <Icon name="add" size={16} />
                            </button>

                            <AppContextMenu
                                isOpen={isAddMenuOpen}
                                onClose={() => setIsAddMenuOpen(false)}
                                anchorRect={addAnchorRect}
                            >
                                <div className="p-2 space-y-1">
                                    <button
                                        onClick={() => {
                                            setIsAddMenuOpen(false);
                                            handleAddCTE(false);
                                        }}
                                        className="w-full flex items-center gap-3 px-4 py-2.5 text-[11px] font-semibold text-[var(--text-main)] hover:bg-brand/10 rounded-xl transition-all outline-none"
                                    >
                                        <div className="w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center text-brand">
                                            <Icon name="table_virtual" size={16} />
                                        </div>
                                        <div className="text-left">
                                            <div className="leading-tight">Regular Block</div>
                                            <div className="text-[9px] text-[var(--text-muted)] font-normal">Standard SQL query</div>
                                        </div>
                                    </button>
                                    <button
                                        onClick={() => {
                                            setIsAddMenuOpen(false);
                                            setEditingCTE(null);
                                            setIsRecursiveModalOpen(true);
                                        }}
                                        className="w-full flex items-center gap-3 px-4 py-2.5 text-[11px] font-semibold text-[var(--text-main)] hover:bg-brand/10 rounded-xl transition-all outline-none"
                                    >
                                        <div className="w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center text-brand">
                                            <Icon name="table_recursive" size={16} />
                                        </div>
                                        <div className="text-left">
                                            <div className="leading-tight">Recursive Block</div>
                                            <div className="text-[9px] text-[var(--text-muted)] font-normal">Hierarchical query</div>
                                        </div>
                                    </button>
                                </div>
                            </AppContextMenu>
                        </div>
                    </div>

                    {/* Main Content Area */}
                    <div className="flex-1 flex flex-col overflow-hidden">
                        <div className="px-6 border-b border-[var(--border-base)]">
                            <AppTabs
                                tabs={[
                                    { id: 'tables', label: 'Selected Tables' },
                                    { id: 'joins', label: 'Joins' },
                                    { id: 'conditions', label: 'Conditions' },
                                    { id: 'grouping_sorting', label: 'Grouping & Sorting' }
                                ]}
                                activeTab={activeTab}
                                onTabChange={(tabId: string) => setActiveTab(tabId as any)}
                            />
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 bg-[var(--bg-app)]">
                            {activeTab === 'tables' && (
                                    <div className="h-full flex gap-6 overflow-hidden relative">
                                        <div className="flex-1 flex flex-col min-w-0">
                                            <SelectedTablesTreeView
                                                tables={activeState.tables}
                                                selectedFields={activeState.selectedFields}
                                                onRemoveTable={handleRemoveTableAlias}
                                                onMoveTable={handleMoveTable}
                                                getColumns={getColumns}
                                                queryState={fullState}
                                            />
                                        </div>
                                        <div className="flex-1 flex flex-col min-w-0">
                                            <SelectedFieldsTreeView
                                                fields={activeState.selectedFields}
                                                onEditField={setEditingField}
                                            />
                                        </div>

                                        {activeState.tables.length === 0 && (
                                            <div className="absolute inset-0 flex flex-col items-center justify-center border-2 border-dashed border-[var(--border-base)] rounded-2xl opacity-40 bg-[var(--bg-app)]/50 pointer-events-none z-10">
                                                <Icon name="table_chart" size={48} className="mb-4 text-[var(--text-muted)]" />
                                                <p className="text-sm font-medium">Add a database table or a query block from the sidebar.</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                                {activeTab === 'joins' && (
                                    <JoinsView
                                        state={activeState}
                                        setState={updateActiveState}
                                        getColumns={getColumns}
                                        queryState={fullState}
                                    />
                                )}
                                {activeTab === 'conditions' && (
                                    <div className="h-full flex flex-col gap-6 overflow-hidden">
                                        <ConditionsView
                                            state={activeState}
                                            setState={updateActiveState}
                                            getColumns={getColumns}
                                            queryState={fullState}
                                            parameters={parameters}
                                        />

                                        {parameters && parameters.length > 0 && (
                                            <div className="shrink-0 p-6 border-t border-[var(--border-base)] bg-[var(--bg-alt)]/30 rounded-t-3xl backdrop-blur-sm">
                                                <div className="flex items-center gap-3 mb-4">
                                                    <div className="w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center text-brand">
                                                        <Icon name="tune" size={16} />
                                                    </div>
                                                    <div>
                                                        <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--text-main)]">Execution Parameters</h3>
                                                        <p className="text-[9px] text-[var(--text-muted)] font-medium">Provide test values for query preview</p>
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                                    {parameters.map(p => (
                                                        <div key={p.parameter_name} className="space-y-1.5">
                                                            <label className="text-[10px] font-black uppercase tracking-tighter text-[var(--text-muted)] ml-1">
                                                                {p.parameter_name}
                                                            </label>
                                                            <input
                                                                value={parameterValues[p.parameter_name] || ''}
                                                                onChange={e => setParameterValues(prev => ({ ...prev, [p.parameter_name]: e.target.value }))}
                                                                placeholder={p.parameter_type}
                                                                className="w-full bg-[var(--bg-app)] border border-[var(--border-base)] rounded-xl px-3 py-2 text-xs font-medium outline-none focus:border-brand focus:ring-4 focus:ring-brand/5 transition-all"
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                                {activeTab === 'grouping_sorting' && (
                                    <GroupingSortingView
                                        state={activeState}
                                        setState={updateActiveState}
                                        getColumns={getColumns}
                                        queryState={fullState}
                                    />
                                )}
                            </div>

                            {/* SQL Preview Bottom Bar */}
                            <div className="h-32 border-t border-[var(--border-base)] bg-[var(--bg-alt)] flex flex-col">
                                <div className="px-4 py-2 border-b border-[var(--border-base)] bg-[var(--bg-app)] flex items-center justify-between">
                                    <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">SQL Preview</h3>
                                    {!effectiveSql.canRun && activeBlockId !== 'main' && (
                                        <span className="text-[9px] font-bold text-amber-500 uppercase tracking-tight bg-amber-500/10 px-2 py-0.5 rounded-md">
                                            Standalone execution restricted
                                        </span>
                                    )}
                                </div>
                                <div className="flex-1 p-4 font-mono text-xs overflow-y-auto selection:bg-brand/20">
                                    {effectiveSql.canRun ? (
                                        <pre className="text-brand">{previewSql || '-- Generated SQL will appear here'}</pre>
                                    ) : (
                                        <div className="h-full flex flex-col items-center justify-center text-[var(--text-muted)] opacity-60 italic">
                                            <Icon name="info" size={16} className="mb-1" />
                                            <p>{previewSql}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </DndContext>
            </div>

            <AppCompactModalForm
                isOpen={isResultsOpen}
                onClose={() => setIsResultsOpen(false)}
                onSubmit={executionError ? () => setIsResultsOpen(false) : handleCopyResults}
                title={executionError ? "Query Execution Error" : "Query Results"}
                icon={executionError ? "warning" : "table_chart"}
                width="max-w-7xl"
                submitLabel={executionError ? "Close" : (isCopied ? 'Copied' : 'Copy Result')}
                cancelLabel={executionError ? undefined : "Close"}
                className={executionError ? "border-red-500/50" : ""}
            >
                <div className="h-[60vh] flex flex-col">
                    {executionError ? (
                        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-red-500/5 rounded-2xl border border-red-500/10">
                            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 mb-6 animate-pulse">
                                <Icon name="error_outline" size={40} />
                            </div>
                            <h3 className="text-lg font-bold text-red-600 mb-2">Something went wrong</h3>
                            <div className="max-w-2xl bg-white border border-red-200 rounded-xl p-6 shadow-sm overflow-auto max-h-[40vh]">
                                <pre className="text-sm text-red-700 font-mono text-left whitespace-pre-wrap leading-relaxed">
                                    {executionError}
                                </pre>
                            </div>
                            <p className="mt-6 text-xs text-[var(--text-muted)] italic">
                                Please check your SQL syntax or parameter values.
                            </p>
                        </div>
                    ) : queryResults.length > 0 ? (
                        <div className="flex-1 h-full min-h-0">
                            <AppTabulatorTable
                                data={queryResults}
                                maxWidth={600}
                            />
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center opacity-40">
                            <Icon name="search_off" size={48} className="mb-4 text-[var(--text-muted)]" />
                            <p className="text-sm font-medium">No results found.</p>
                        </div>
                    )}
                </div>
            </AppCompactModalForm>

            <FieldExpressionModal
                isOpen={!!editingField}
                onClose={() => setEditingField(null)}
                field={editingField}
                onSave={(id, updates) => {
                    updateActiveState(prev => ({
                        ...prev,
                        selectedFields: prev.selectedFields.map(f => f.id === id ? { ...f, ...updates } : f)
                    }));
                }}
            />

            <RecursiveCteModal
                isOpen={isRecursiveModalOpen}
                onClose={() => {
                    setIsRecursiveModalOpen(false);
                    setEditingCTE(null);
                }}
                onSubmit={(config) => handleAddCTE(true, config)}
                tables={tables}
                getColumns={getColumns}
                initialConfig={editingCTE?.recursiveConfig ? { ...editingCTE.recursiveConfig, alias: editingCTE.alias } : undefined}
            />

            <AppCompactModalForm
                isOpen={isDeleteConfirmOpen}
                onClose={() => setIsDeleteConfirmOpen(false)}
                onSubmit={confirmDeleteCTE}
                title="Delete Query Block"
                icon="delete"
                submitLabel="Delete"
                cancelLabel="Keep"
                className="!text-red-500"
            >
                <div className="p-2">
                    <p className="text-xs text-[var(--text-main)] mb-1">Are you sure you want to delete query block <span className="font-bold text-brand">{cteToDelete?.alias}</span>?</p>
                    <p className="text-[10px] text-[var(--text-muted)] italic">This action cannot be undone and will remove all tables and joins within this block.</p>
                </div>
            </AppCompactModalForm>

            <AppCompactModalForm
                isOpen={isRenameModalOpen}
                onClose={() => {
                    setIsRenameModalOpen(false);
                    setCteToRename(null);
                }}
                onSubmit={() => {
                    if (cteToRename) handleRenameCTE(cteToRename.id, renameValue);
                }}
                title="Rename Query Block"
                icon="edit"
                submitLabel="OK"
                cancelLabel="Cancel"
            >
                {cteToRename && (
                    <div className="p-2 space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">New Name</label>
                            <input
                                autoFocus
                                value={renameValue}
                                onChange={e => setRenameValue(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                        e.stopPropagation();
                                        handleRenameCTE(cteToRename.id, renameValue);
                                    }
                                    if (e.key === 'Escape') {
                                        e.stopPropagation();
                                        setIsRenameModalOpen(false);
                                        setCteToRename(null);
                                    }
                                }}
                                placeholder="e.g. MyBlock"
                                className="w-full bg-[var(--bg-alt)] border border-[var(--border-base)] rounded-lg px-3 py-2 text-xs outline-none focus:border-brand"
                            />
                        </div>
                    </div>
                )}
            </AppCompactModalForm>
        </AppCompactModalForm>
    );
};
