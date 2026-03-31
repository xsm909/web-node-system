import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import type { ObjectParameter as ReportParameter } from '../../../entities/report/model/types';
import {
    DndContext,
    rectIntersection,
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
import { AppFormFieldRect } from '../../../shared/ui/app-input';
import { UI_CONSTANTS } from '../../../shared/ui/constants';
import { AppTabs } from '../../../shared/ui/app-tabs';
import { AppAreaHint } from '../../../shared/ui/app-area-hint';
import { useDatabaseMetadata } from '../lib/useDatabaseMetadata';
import type { MultiQueryState, QueryState, SelectedField, JoinCondition, WhereCondition } from '../model/types';
import { generateSQL, generateBlockSQL, generateJsonSQL } from '../lib/sqlGenerator';
import { parseSQL } from '../lib/sqlParser';
import { SelectedTablesTreeView } from './SelectedTablesTreeView';
import { SelectedFieldsTreeView } from './SelectedFieldsTreeView';
import { JsonBuilderView } from './JsonBuilderView';
import { FieldExpressionModal } from './FieldExpressionModal';
import { AppCompactModalForm } from '../../../shared/ui/app-compact-modal-form/AppCompactModalForm';
import { apiClient } from '../../../shared/api/client';
import { AppContextMenu } from '../../../shared/ui/app-context-menu';
import { AppTabulatorTable } from '../../../shared/ui/app-tabulator-table/AppTabulatorTable';
import { AppJsonView } from '../../../shared/ui/app-json-view/AppJsonView';
import { useHotkeys } from '../../../shared/lib/hotkeys/useHotkeys';
import { HOTKEY_LEVEL } from '../../../shared/lib/hotkeys/HotkeysContext';
import { usePresets, type Preset } from '../../../entities/preset';
import { ComboBox } from '../../../shared/ui/combo-box/ComboBox';
import { AppFormButton } from '../../../shared/ui/app-form-button/AppFormButton';
import { useProjectStore } from '../../../features/projects/store';

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
        <AppFormFieldRect className={`!px-2 !py-0 ${UI_CONSTANTS.FORM_CONTROL_HEIGHT} min-w-[100px]`}>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full bg-transparent outline-none h-full text-xs font-normal cursor-pointer"
            >
                <option value="">{placeholder}</option>
                {columns.map(col => (
                    <option key={col.name} value={col.name}>{col.name}</option>
                ))}
            </select>
        </AppFormFieldRect>
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
                <span className="text-xs font-normal text-[var(--text-main)]">{label}</span>
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
        <div className="space-y-6">
            <div className="flex items-center justify-between px-2">
                <h3 className="text-xs font-normal uppercase tracking-widest text-[var(--text-muted)]">Table Joins</h3>
                <button
                    onClick={addJoin}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-brand text-white text-xs font-normal hover:opacity-90 transition-all shadow-sm"
                >
                    <Icon name="plus" size={14} />
                    Add Join
                </button>
            </div>

            {state.joins.length > 0 ? (
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
                </div>
            ) : (
                <AppAreaHint
                    icon="device_hub"
                    title="No joins defined yet"
                    description="Connect tables to combine data"
                    className="py-12"
                />
            )}
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
                <div className="flex items-center gap-2 font-mono text-[10px]">
                    <span className="text-brand/70 font-normal">{join.type} JOIN</span>
                    <span className="text-[var(--text-main)] font-normal">{rightTableName}</span>
                    <span className="text-brand/50">AS</span>
                    <span className="text-brand font-normal">{join.rightTableAlias}</span>
                    <span className="text-brand/50 font-normal">ON</span>
                    <span className="text-[var(--text-main)] font-normal">{join.leftTableAlias}</span>
                    <span className="text-[var(--text-muted)]">.</span>
                    <span className="text-brand font-normal">{join.leftColumn}</span>
                    <span className="text-brand/50 font-normal">=</span>
                    <span className="text-[var(--text-main)] font-normal">{join.rightTableAlias}</span>
                    <span className="text-[var(--text-muted)]">.</span>
                    <span className="text-brand font-normal">{join.rightColumn}</span>
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
                width="max-w-4xl"
            >
                <div className="space-y-4">
                        <div className="grid grid-cols-[85px_1fr_auto_1.2fr_auto_1fr_auto_1.2fr] gap-1 items-center group">
                            <AppFormFieldRect className={`!px-2 !py-0 ${UI_CONSTANTS.FORM_CONTROL_HEIGHT}`}>
                                <select
                                    value={join.type}
                                    onChange={(e) => {
                                        const newJoins = [...state.joins];
                                        newJoins[index].type = e.target.value as any;
                                        setState((prev) => ({ ...prev, joins: newJoins }));
                                    }}
                                    className="w-full bg-transparent outline-none h-full text-xs font-normal cursor-pointer"
                                >
                                    <option value="INNER JOIN">INNER</option>
                                    <option value="LEFT JOIN">LEFT</option>
                                    <option value="RIGHT JOIN">RIGHT</option>
                                    <option value="FULL JOIN">FULL</option>
                                </select>
                            </AppFormFieldRect>

                            <AppFormFieldRect className={`!px-2 !py-0 ${UI_CONSTANTS.FORM_CONTROL_HEIGHT} min-w-0`}>
                                <select
                                    value={join.rightTableAlias}
                                    onChange={(e) => {
                                        const newJoins = [...state.joins];
                                        newJoins[index].rightTableAlias = e.target.value;
                                        setState((prev) => ({ ...prev, joins: newJoins }));
                                    }}
                                    className="w-full bg-transparent outline-none h-full text-xs font-normal cursor-pointer"
                                >
                                    {state.tables.map((t) => <option key={t.alias} value={t.alias}>{t.alias}</option>)}
                                </select>
                            </AppFormFieldRect>

                            <span className="text-[10px] text-[var(--text-muted)] font-normal opacity-40 px-0.5">.</span>

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

                            <span className="text-brand font-normal text-sm px-1 opacity-30">=</span>

                            <AppFormFieldRect className={`!px-2 !py-0 ${UI_CONSTANTS.FORM_CONTROL_HEIGHT} min-w-0`}>
                                <select
                                    value={join.leftTableAlias}
                                    onChange={(e) => {
                                        const newJoins = [...state.joins];
                                        newJoins[index].leftTableAlias = e.target.value;
                                        setState((prev) => ({ ...prev, joins: newJoins }));
                                    }}
                                    className="w-full bg-transparent outline-none h-full text-xs font-normal cursor-pointer"
                                >
                                    {state.tables.map((t) => <option key={t.alias} value={t.alias}>{t.alias}</option>)}
                                </select>
                            </AppFormFieldRect>

                            <span className="text-[10px] text-[var(--text-muted)] font-normal opacity-40 px-0.5">.</span>

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
        <div className="space-y-6">
            <div className="flex items-center justify-between px-2">
                <h3 className="text-xs font-normal uppercase tracking-widest text-[var(--text-muted)]">Filtering Conditions</h3>
                <button
                    onClick={addCondition}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-brand text-white text-xs font-normal hover:opacity-90 transition-all shadow-sm"
                >
                    <Icon name="plus" size={14} />
                    Add Condition
                </button>
            </div>

            <div className="space-y-4">
                {state.where.map((cond, index) => (
                    <div key={cond.id} className="p-4 rounded-2xl border border-[var(--border-base)] bg-[var(--bg-app)] grid grid-cols-[50px_1fr_1.2fr_85px_2fr_auto_auto] gap-2 items-center group">
                        <div className="flex justify-center min-w-0">
                            {index > 0 ? (
                                <AppFormFieldRect className={`!px-1 !py-0 ${UI_CONSTANTS.FORM_CONTROL_HEIGHT} !bg-brand/10 !border-brand/20 w-full min-w-0 overflow-hidden`}>
                                    <select
                                        value={cond.logic}
                                        onChange={(e) => {
                                            const newWheres = [...state.where];
                                            newWheres[index].logic = e.target.value as any;
                                            setState((prev) => ({ ...prev, where: newWheres }));
                                        }}
                                        className="w-full bg-transparent text-brand outline-none h-full text-[10px] font-normal cursor-pointer text-center"
                                    >
                                        <option value="AND">AND</option>
                                        <option value="OR">OR</option>
                                    </select>
                                </AppFormFieldRect>
                            ) : (
                                <span className="text-[9px] font-normal uppercase text-[var(--text-muted)] opacity-50 select-none">WHERE</span>
                            )}
                        </div>

                        <AppFormFieldRect className="!px-2 !py-0 h-8 min-w-0">
                            <select
                                value={cond.tableAlias}
                                onChange={(e) => {
                                    const newWheres = [...state.where];
                                    newWheres[index].tableAlias = e.target.value;
                                    setState((prev) => ({ ...prev, where: newWheres }));
                                }}
                                className="w-full bg-transparent outline-none h-full text-xs font-normal cursor-pointer"
                            >
                                {state.tables.map((t) => <option key={t.alias} value={t.alias}>{t.alias}</option>)}
                            </select>
                        </AppFormFieldRect>

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

                        <AppFormFieldRect className={`!px-1 !py-0 ${UI_CONSTANTS.FORM_CONTROL_HEIGHT} min-w-0 overflow-hidden`}>
                            <select
                                value={cond.operator}
                                onChange={(e) => {
                                    const newWheres = [...state.where];
                                    newWheres[index].operator = e.target.value as any;
                                    setState((prev) => ({ ...prev, where: newWheres }));
                                }}
                                className="w-full bg-transparent outline-none h-full text-xs font-normal cursor-pointer text-center"
                            >
                                <option value="=">=</option>
                                <option value="!=">!=</option>
                                <option value=">">&gt;</option>
                                <option value="<">&lt;</option>
                                <option value=">=">&gt;=</option>
                                <option value="<=">&lt;=</option>
                                <option value="LIKE">LIKE</option>
                                <option value="IN">IN</option>
                                <option value="IS NULL">NULL</option>
                                <option value="IS NOT NULL">NOT NULL</option>
                            </select>
                        </AppFormFieldRect>

                        <div className="flex items-center gap-2 min-w-0">
                            {cond.valueType === 'parameter' ? (
                                <AppFormFieldRect className={`flex-1 !px-2 !py-0 ${UI_CONSTANTS.FORM_CONTROL_HEIGHT} !border-brand/30`}>
                                    <select
                                        value={cond.value}
                                        onChange={(e) => {
                                            const newWheres = [...state.where];
                                            newWheres[index].value = e.target.value;
                                            setState((prev) => ({ ...prev, where: newWheres }));
                                        }}
                                        className="w-full bg-transparent outline-none h-full text-xs font-normal text-brand cursor-pointer"
                                    >
                                        <option value="">Param...</option>
                                        {parameters.map(p => (
                                            <option key={p.parameter_name} value={p.parameter_name}>
                                                {p.parameter_name.toUpperCase()}
                                            </option>
                                        ))}
                                    </select>
                                </AppFormFieldRect>
                            ) : (
                                <AppFormFieldRect className={`flex-1 !px-2 !py-0 ${UI_CONSTANTS.FORM_CONTROL_HEIGHT} ${(cond.operator === 'IS NULL' || cond.operator === 'IS NOT NULL') ? 'opacity-30' : ''}`}>
                                    <input
                                        placeholder="value"
                                        value={cond.value}
                                        onChange={(e) => {
                                            const newWheres = [...state.where];
                                            newWheres[index].value = e.target.value;
                                            setState((prev) => ({ ...prev, where: newWheres }));
                                        }}
                                        disabled={cond.operator === 'IS NULL' || cond.operator === 'IS NOT NULL'}
                                        className="w-full bg-transparent outline-none h-full text-xs"
                                    />
                                </AppFormFieldRect>
                            )}
                        </div>

                        {parameters.length > 0 && (
                            <button
                                onClick={() => {
                                    const newWheres = [...state.where];
                                    newWheres[index].valueType = cond.valueType === 'parameter' ? 'literal' : 'parameter';
                                    newWheres[index].value = '';
                                    setState((prev) => ({ ...prev, where: newWheres }));
                                }}
                                className={`p-1.5 rounded-lg border transition-all ${cond.valueType === 'parameter' ? 'bg-brand/10 border-brand/30 text-brand' : 'bg-[var(--bg-alt)] border-[var(--border-base)] text-[var(--text-muted)] hover:text-brand'}`}
                                title={cond.valueType === 'parameter' ? 'Switch to Literal' : 'Switch to Parameter'}
                            >
                                <Icon name={cond.valueType === 'parameter' ? 'database' : 'settings'} size={12} />
                            </button>
                        )}

                        <button
                            onClick={() => {
                                const newWheres = [...state.where];
                                newWheres.splice(index, 1);
                                setState((prev) => ({ ...prev, where: newWheres }));
                            }}
                            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-red-500 opacity-20 group-hover:opacity-100 transition-all flex items-center justify-center"
                        >
                            <Icon name="delete" size={14} />
                        </button>
                    </div>
                ))}

                {state.where.length === 0 && (
                    <AppAreaHint
                        icon="filter_alt"
                        title="No conditions defined yet"
                        description="Add filters to narrow down results"
                        className="py-12"
                    />
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
        <div className="space-y-12">
            {/* Grouping Section */}
            <div className="space-y-6">
                <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center text-brand font-normal">
                            <Icon name="group_work" size={16} />
                        </div>
                        <h3 className="text-xs font-normal uppercase tracking-widest text-[var(--text-main)]">Grouping (GROUP BY)</h3>
                    </div>
                    <button
                        onClick={addGroupBy}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-brand text-white text-xs font-normal hover:opacity-90 transition-all shadow-sm"
                    >
                        <Icon name="add" size={14} />
                        Add Group
                    </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(state.groupBy || []).map((group, index) => (
                        <div key={group.id} className="p-4 rounded-2xl border border-[var(--border-base)] bg-[var(--bg-app)] flex items-center gap-3 group">
                            <AppFormFieldRect className={`!px-2 !py-0 ${UI_CONSTANTS.FORM_CONTROL_HEIGHT} min-w-[100px]`}>
                                <select
                                    value={group.tableAlias}
                                    onChange={(e) => {
                                        const newGroups = [...state.groupBy];
                                        newGroups[index].tableAlias = e.target.value;
                                        setState(prev => ({ ...prev, groupBy: newGroups }));
                                    }}
                                    className="w-full bg-transparent outline-none h-full text-xs font-normal cursor-pointer"
                                >
                                    {state.tables.map((t) => <option key={t.alias} value={t.alias}>{t.alias}</option>)}
                                </select>
                            </AppFormFieldRect>
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
                        <AppAreaHint
                            icon="group_work"
                            title="No groupings defined"
                            description="Use to aggregate rows"
                            className="md:col-span-2 py-8"
                        />
                    )}
                </div>
            </div>

            {/* Sorting Section */}
            <div className="space-y-6">
                <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center text-brand font-normal">
                            <Icon name="sort" size={16} />
                        </div>
                        <h3 className="text-xs font-normal uppercase tracking-widest text-[var(--text-main)]">Sorting (ORDER BY)</h3>
                    </div>
                    <button
                        onClick={addOrderBy}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-brand text-white text-xs font-normal hover:opacity-90 transition-all shadow-sm"
                    >
                        <Icon name="add" size={14} />
                        Add Sort
                    </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(state.orderBy || []).map((order, index) => (
                        <div key={order.id} className="p-4 rounded-2xl border border-[var(--border-base)] bg-[var(--bg-app)] flex items-center gap-3 group">
                            <AppFormFieldRect className={`!px-2 !py-0 ${UI_CONSTANTS.FORM_CONTROL_HEIGHT} min-w-[100px]`}>
                                <select
                                    value={order.tableAlias}
                                    onChange={(e) => {
                                        const newOrders = [...state.orderBy];
                                        newOrders[index].tableAlias = e.target.value;
                                        setState(prev => ({ ...prev, orderBy: newOrders }));
                                    }}
                                    className="w-full bg-transparent outline-none h-full text-xs font-normal cursor-pointer"
                                >
                                    {state.tables.map((t) => <option key={t.alias} value={t.alias}>{t.alias}</option>)}
                                </select>
                            </AppFormFieldRect>
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
                            <AppFormFieldRect className={`!px-2 !py-0 ${UI_CONSTANTS.FORM_CONTROL_HEIGHT} w-20 !bg-brand/5 !border-brand/20`}>
                                <select
                                    value={order.direction}
                                    onChange={(e) => {
                                        const newOrders = [...state.orderBy];
                                        newOrders[index].direction = e.target.value as 'ASC' | 'DESC';
                                        setState(prev => ({ ...prev, orderBy: newOrders }));
                                    }}
                                    className="w-full bg-transparent text-brand outline-none h-full text-[10px] font-normal cursor-pointer"
                                >
                                    <option value="ASC">ASC</option>
                                    <option value="DESC">DESC</option>
                                </select>
                            </AppFormFieldRect>
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
                        <AppAreaHint
                            icon="sort"
                            title="No sortings defined"
                            description="Order results by columns"
                            className="md:col-span-2 py-8"
                        />
                    )}
                </div>
            </div>

            {/* Limit Section */}
            <div className="space-y-6 pt-6 border-t border-[var(--border-base)]">
                <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center text-brand font-normal">
                            <Icon name="timer" size={16} />
                        </div>
                        <h3 className="text-xs font-normal uppercase tracking-widest text-[var(--text-main)]">Result Limit (LIMIT)</h3>
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
                        <label htmlFor="use-limit" className="text-xs font-normal text-[var(--text-main)] cursor-pointer">
                            Enable Limit
                        </label>
                    </div>
                    
                    <div className={`flex items-center gap-3 transition-all ${state.useLimit ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                        <AppFormFieldRect className={`w-32 !px-3 !py-0 ${UI_CONSTANTS.FORM_CONTROL_HEIGHT} ${!state.useLimit ? 'opacity-40' : ''}`}>
                            <input
                                type="number"
                                value={state.limit || ''}
                                onChange={(e) => {
                                    const val = parseInt(e.target.value, 10);
                                    setState(prev => ({ ...prev, limit: isNaN(val) ? 0 : val }));
                                }}
                                className="w-full bg-transparent outline-none h-full text-xs font-normal"
                                placeholder="e.g. 100"
                                disabled={!state.useLimit}
                            />
                        </AppFormFieldRect>
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
                        <label className="text-[10px] font-normal uppercase tracking-wider text-[var(--text-muted)]">Block Alias</label>
                        <AppFormFieldRect>
                            <input
                                value={alias}
                                onChange={e => setAlias(e.target.value)}
                                placeholder="e.g. tree"
                                className="w-full bg-transparent outline-none h-full text-xs"
                            />
                        </AppFormFieldRect>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-normal uppercase tracking-wider text-[var(--text-muted)]">Base Table</label>
                        <AppFormFieldRect>
                            <select
                                value={anchorTable}
                                onChange={e => setAnchorTable(e.target.value)}
                                className="w-full bg-transparent outline-none h-full text-xs cursor-pointer"
                            >
                                <option value="">Select table...</option>
                                {tables.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </AppFormFieldRect>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-normal uppercase tracking-wider text-[var(--text-muted)]">Primary Key (ID)</label>
                        <AppFormFieldRect>
                            <select
                                value={primaryKey}
                                onChange={e => setPrimaryKey(e.target.value)}
                                className="w-full bg-transparent outline-none h-full text-xs cursor-pointer"
                            >
                                <option value="">Select PK...</option>
                                {availableColumns.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                            </select>
                        </AppFormFieldRect>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-normal uppercase tracking-wider text-[var(--text-muted)]">Parent Reference</label>
                        <AppFormFieldRect>
                            <select
                                value={parentKey}
                                onChange={e => setParentKey(e.target.value)}
                                className="w-full bg-transparent outline-none h-full text-xs cursor-pointer"
                            >
                                <option value="">Select Parent Key...</option>
                                {availableColumns.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                            </select>
                        </AppFormFieldRect>
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label className="text-[10px] font-normal uppercase tracking-wider text-[var(--text-muted)]">Depth Column (Optional)</label>
                    <AppFormFieldRect>
                        <input
                            value={depthColumn}
                            onChange={e => setDepthColumn(e.target.value)}
                            placeholder="e.g. level (leave empty to skip)"
                            className="w-full bg-transparent outline-none h-full text-xs"
                        />
                    </AppFormFieldRect>
                </div>

                <div className="p-3 bg-blue-500/5 border border-blue-500/20 rounded-xl">
                    <p className="text-[10px] text-blue-500 font-normal leading-relaxed">
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
    const { tables, essentialTables, loading, getColumns } = useDatabaseMetadata();
    const { activeProject } = useProjectStore();

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
    const [activeTab, setActiveTab] = useState<'tables' | 'joins' | 'conditions' | 'grouping_sorting' | 'json_builder'>('tables');
    const [previewSql, setPreviewSql] = useState('');
    const [activeDragItem, setActiveDragItem] = useState<any>(null);
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
    const [isDraggingInProgress, setIsDraggingInProgress] = useState(false);
    const [isSavePresetModalOpen, setIsSavePresetModalOpen] = useState(false);
    const [presetName, setPresetName] = useState('');
    const { presets, fetchPresets, savePreset, renamePreset, deletePreset } = usePresets('query');
    const [editingPreset, setEditingPreset] = useState<Preset | null>(null);
    const [deletingPreset, setDeletingPreset] = useState<Preset | null>(null);
    const [newPresetName, setNewPresetName] = useState('');
    const lastParsedSqlRef = useRef<string | null>(null);
    const prevIsOpenRef = useRef(false);
    const [isEssentialOnly, setIsEssentialOnly] = useState(true);

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
            const sqlToRun = (fullState.jsonTree && fullState.jsonTree.length > 0) 
                ? generateJsonSQL(fullState) 
                : generateSQL(fullState);
            return { sql: sqlToRun, canRun: !!sqlToRun.trim() };
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
        // If we switch to a subquery/CTE while on the JSON Builder tab, 
        // redirect to the 'tables' tab since JSON Builder is only for the main query.
        if (activeBlockId !== 'main' && activeTab === 'json_builder') {
            setActiveTab('tables');
        }
    }, [activeBlockId, activeTab]);

    useEffect(() => {
        const isOpening = isOpen && !prevIsOpenRef.current;
        prevIsOpenRef.current = isOpen;

        if (isOpening) {
            setActiveBlockId('main');
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
                    const name = p.parameter_name;
                    if (name === 'system_project_id') {
                        next[name] = activeProject?.id || '';
                    } else {
                        const val = (p as any).default_value ?? (p as any).defaultValue ?? (p as any).value ?? (p as any).default;
                        if (val !== undefined && val !== null && val !== '') {
                            next[name] = val;
                        } else if (next[name] === undefined) {
                            next[name] = '';
                        }
                    }
                });
                return next;
            });
        }
    }, [parameters, activeProject?.id, isOpen]);
    
    useEffect(() => {
        if (isOpen) {
            fetchPresets();
        }
    }, [isOpen, fetchPresets]);

    const handleSavePreset = async () => {
        if (!presetName.trim()) return;
        try {
            await savePreset(presetName, fullState);
            setIsSavePresetModalOpen(false);
            setPresetName('');
        } catch (err) {
            console.error('Failed to save preset:', err);
        }
    };

    const handleLoadPreset = (preset: Preset) => {
        setFullState(preset.preset_data);
        setActiveBlockId('main');
    };

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

    const isModalLayerActive = isRecursiveModalOpen || isRenameModalOpen || !!editingField || !!editingCTE || isDeleteConfirmOpen;

    useHotkeys([
        { key: 'F5', description: 'Execute Query', preventDefault: true, handler: () => handleExecuteQuery() },
        { key: 'cmd+r', description: 'Execute Query', preventDefault: true, handler: () => handleExecuteQuery() },
        { key: 'ctrl+r', description: 'Execute Query', preventDefault: true, handler: () => handleExecuteQuery() }
    ], { 
        scopeName: 'Query Builder', 
        enabled: isOpen && !isModalLayerActive,
        level: HOTKEY_LEVEL.MODAL
    });

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
        // Set flag to true to prevent click event from triggering onAdd
        setIsDraggingInProgress(true);
        setTimeout(() => setIsDraggingInProgress(false), 50);

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
        const { active } = event;
        setActiveDragItem(active);
        setDragDelta({ x: 0, y: 0 });
        setOverId(null);
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
            return transform;
        }
    ], []);

    const isDirty = useMemo(() => {
        if (!isOpen) return false;
        try {
            // Compare structural state via JSON.stringify to be independent of formatting
            const initialParsedState = parseSQL(initialSql || '');
            
            // Helper to remove any volatile properties and focus on business logic
            const cleanQuery = (q: any) => ({
                tables: (q.tables || []).map((t: any) => ({ alias: t.alias, name: t.name })),
                selectedFields: (q.selectedFields || []).map((f: any) => ({ tableAlias: f.tableAlias, columnName: f.columnName, alias: f.alias, aggregate: f.aggregate })),
                joins: (q.joins || []).map((j: any) => ({ leftTableAlias: j.leftTableAlias, leftColumn: j.leftColumn, rightTableAlias: j.rightTableAlias, rightColumn: j.rightColumn, type: j.type })),
                where: (q.where || []).map((w: any) => ({ tableAlias: w.tableAlias, columnName: w.columnName, operator: w.operator, value: w.value, logic: w.logic })),
                groupBy: (q.groupBy || []).map((g: any) => ({ tableAlias: g.tableAlias, columnName: g.columnName })),
                orderBy: (q.orderBy || []).map((o: any) => ({ tableAlias: o.tableAlias, columnName: o.columnName, direction: o.direction })),
                limit: q.limit,
                useLimit: q.useLimit
            });

            const cleanMulti = (state: any) => ({
                mainQuery: cleanQuery(state.mainQuery),
                ctes: (state.ctes || []).map((c: any) => ({
                    alias: c.alias,
                    isRecursive: c.isRecursive,
                    state: cleanQuery(c.state)
                }))
            });

            const current = JSON.stringify(cleanMulti(fullState));
            const original = JSON.stringify(cleanMulti(initialParsedState));
            
            return current !== original;
        } catch (e) {
            return false;
        }
    }, [fullState, initialSql, isOpen]);

    if (!isOpen) return null;

    const handleFinalSubmit = () => {
        if (activeBlockId !== 'main' && !effectiveSql.canRun) {
            return; // Can't submit from un-runnable CTE
        }
        const finalSql = (fullState.jsonTree && fullState.jsonTree.length > 0)
            ? generateJsonSQL(fullState)
            : generateSQL(fullState);
        onDone(finalSql);
    };

    return (
        <>
            <AppCompactModalForm
            isOpen={isOpen}
            onClose={onClose}
            title="Query Builder"
            icon="database"
            fullHeight
            noPadding
            width="w-[95vw] max-w-[1400px]"
            submitLabel="Ready"
            allowedShortcuts={['f5', 'cmd+r', 'ctrl+r']}
            isDirty={isDirty}
            onConfirmSave={handleFinalSubmit}
            onDiscard={onClose}
            onSubmit={handleFinalSubmit}
            className="flex flex-col"
            headerRightContent={
                <>
                    {isExecuting && (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-brand/10 text-brand text-[10px] font-normal animate-pulse">
                            <div className="w-3 h-3 border-2 border-brand/30 border-t-brand rounded-full animate-spin" />
                            Executing...
                        </div>
                    )}
                    <AppFormButton
                        onClick={handleExecuteQuery}
                        isDisabled={isExecuting || !effectiveSql.canRun}
                        isDefault={false}
                        icon="play_arrow"
                        label="Run (F5 / Cmd+R)"
                        title={!effectiveSql.canRun ? effectiveSql.sql : "Shortcut: F5, Cmd+R or Ctrl+R"}
                        className="!text-[10px] !text-brand"
                    />
                    <div className="w-px h-4 bg-[var(--border-base)] mx-1" />
                    <AppFormButton
                        onClick={() => {
                            setPresetName('');
                            setIsSavePresetModalOpen(true);
                        }}
                        icon="bookmark_add"
                        withFrame={false}
                        title="Save as Preset"
                        iconSize={18}
                    />
                    <ComboBox
                        icon="bookmark"
                        placeholder=""
                        title="Load Preset"
                        variant="ghost"
                        size="small"
                        hideChevron
                        align="right"
                        config={{
                            allowRename: true,
                            allowDelete: true
                        }}
                        items={presets.map(p => ({
                            id: p.id,
                            label: p.name,
                            name: p.name,
                            icon: 'article'
                        }))}
                        onSelect={(item) => {
                            const preset = presets.find(p => p.id === item.id);
                            if (preset) handleLoadPreset(preset);
                        }}
                        onAction={(action, item) => {
                            const preset = presets.find(p => p.id === item.id);
                            if (!preset) return;
                            if (action === 'rename') {
                                setEditingPreset(preset);
                                setNewPresetName(preset.name);
                            } else if (action === 'delete') {
                                setDeletingPreset(preset);
                            }
                        }}
                    />
                </>
            }
        >
            <div className="flex-1 flex overflow-hidden min-h-0">
                <DndContext
                    sensors={sensors}
                    collisionDetection={rectIntersection}
                    onDragStart={handleGlobalDragStart}
                    onDragMove={handleGlobalDragMove}
                    onDragEnd={handleGlobalDragEnd}
                >
                    {createPortal(
                        <DragOverlay
                            modifiers={dragModifiers}
                            style={{ zIndex: 9999 }}
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
                                                                <span className={`text-xs font-normal truncate ${isOutside ? 'text-red-600' : 'text-[var(--text-main)]'}`}>
                                                                    {tableName}
                                                                </span>
                                                                <span className={`text-[10px] font-normal opacity-70 ${isOutside ? 'text-red-400' : 'text-[var(--text-muted)]'}`}>
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
                                                                <span className={`text-xs font-normal truncate ${isOutside ? 'text-red-600' : 'text-[var(--text-main)]'}`}>
                                                                    {field?.expression || `${field?.tableAlias}.${field?.columnName}`}
                                                                </span>
                                                                {field?.alias && !isOutside && (
                                                                    <span className="text-[10px] text-brand font-normal bg-brand/5 px-1.5 py-0.5 rounded">AS {field.alias}</span>
                                                                )}
                                                            </div>
                                                            <span className={`text-[10px] font-normal opacity-70 ${isOutside ? 'text-red-400' : 'text-[var(--text-muted)]'}`}>
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
                        </DragOverlay>,
                        document.body
                    )}

                    {/* Left Sidebar: Tables List */}
                <div className="w-64 border-r border-[var(--border-base)] flex flex-col bg-[var(--bg-alt)]">
                    <div className="flex-1 overflow-y-auto">
                        {/* Header: Sticky inside scrollable area for blur effect */}
                        <div className="px-4 py-3 flex items-center justify-between sticky top-0 z-10 bg-[var(--bg-alt)]/80 backdrop-blur-md border-b border-[var(--border-base)]/30 shadow-sm shadow-black/5">
                            <h3 className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-main)] flex items-center gap-2">
                                <Icon name="database" size={14} className="text-brand" />
                                Available Tables
                            </h3>
                            <AppFormButton 
                                withFrame={false}
                                toggled={!isEssentialOnly}
                                icon={isEssentialOnly ? 'visibility_off' : 'visibility'}
                                title={isEssentialOnly ? "Show All Tables" : "Show Essential Only"}
                                onClick={() => setIsEssentialOnly(!isEssentialOnly)}
                                className="!p-1"
                            />
                        </div>

                        <div className="p-2 space-y-1">
                            {loading ? (
                                <div className="p-4 text-xs text-[var(--text-muted)] italic">Loading...</div>
                            ) : (
                                <>
                                    {/* Temporary Tables (CTEs) - Nested and Recursive */}
                                    {fullState.ctes.map(cte => (
                                        <DraggableTableSidebarItem
                                            key={cte.id}
                                            id={cte.alias}
                                            label={cte.alias}
                                            isCte={true}
                                            isRecursive={cte.isRecursive}
                                            onAdd={() => {
                                                if (!isDraggingInProgress) {
                                                    handleAddTable(cte.alias, true, cte.isRecursive);
                                                }
                                            }}
                                        />
                                    ))}

                                    {/* Separator between Virtual Tables and Database Tables */}
                                    {fullState.ctes.length > 0 && tables.length > 0 && (
                                        <div className="h-px bg-[var(--border-base)] my-2 mx-2 opacity-50" />
                                    )}

                                    {/* Database Tables */}
                                    {tables
                                        .filter(t => !isEssentialOnly || essentialTables.includes(t))
                                        .map(tableName => (
                                        <DraggableTableSidebarItem
                                            key={tableName}
                                            id={tableName}
                                            label={tableName}
                                            onAdd={() => {
                                                if (!isDraggingInProgress) {
                                                    handleAddTable(tableName, false);
                                                }
                                            }}
                                        />
                                    ))}
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Center Content */}
                <div className="flex-1 flex flex-col min-w-0 bg-[var(--bg-app)]">
                    {/* Block Toolbar */}
                    {/* Query Tabs Bar */}
                    <div className="relative flex-shrink-0">
                        <div className="absolute bottom-0 left-0 right-0 h-px bg-[var(--border-base)]" />
                        <div className="px-6 h-[48px] bg-[var(--bg-app)] flex items-end gap-1 group/tabs overflow-x-auto no-scrollbar">
                            {/* Main Query Tab */}
                            <button
                                onClick={() => setActiveBlockId('main')}
                                className={`px-4 py-1.5 text-sm font-normal transition-all border-t border-x border-b-0 rounded-t-lg flex items-center gap-2 whitespace-nowrap relative z-20 ${
                                    activeBlockId === 'main'
                                        ? 'text-brand bg-[var(--bg-app)] border-[var(--border-base)] shadow-[0_-2px_6px_rgba(0,0,0,0.02)]'
                                        : 'text-[var(--text-muted)] border-transparent hover:text-[var(--text-main)] hover:bg-[var(--border-muted)]/40 hover:border-[var(--border-muted)]/40'
                                }`}
                            >
                                <Icon name="sql" size={16} />
                                <span>Main Query</span>
                                {activeBlockId === 'main' && <div className="absolute inset-0 bg-brand/[0.03] rounded-t-lg -z-10" />}
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
                                        className={`px-4 py-1.5 text-sm font-normal transition-all border-t border-x border-b-0 rounded-t-lg flex items-center gap-2 whitespace-nowrap pr-10 relative z-20 ${
                                            activeBlockId === cte.id
                                                ? 'text-brand bg-[var(--bg-app)] border-[var(--border-base)] shadow-[0_-2px_6px_rgba(0,0,0,0.02)]'
                                                : 'text-[var(--text-muted)] border-transparent hover:text-[var(--text-main)] hover:bg-[var(--border-muted)]/40 hover:border-[var(--border-muted)]/40'
                                        }`}
                                    >
                                        <Icon name={cte.isRecursive ? 'table_recursive' : 'table_virtual'} size={16} />
                                        <span>{cte.alias}</span>
                                        {activeBlockId === cte.id && <div className="absolute inset-0 bg-brand/[0.03] rounded-t-lg -z-10" />}
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
                                        <Icon name="close" size={14} />
                                    </button>
                                </div>
                            ))}

                            {/* Add Button */}
                            <div className="relative ml-2 pb-px flex-shrink-0">
                                <AppFormButton
                                    ref={addButtonRef}
                                    onClick={() => {
                                        setAddAnchorRect(addButtonRef.current?.getBoundingClientRect() || null);
                                        setIsAddMenuOpen(!isAddMenuOpen);
                                    }}
                                    icon="add"
                                    withFrame={false}
                                    title="Add new query block"
                                    className={isAddMenuOpen ? '!bg-brand !text-white' : ''}
                                />

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
                                            className="w-full flex items-center gap-3 px-4 py-2.5 text-[11px] font-normal text-[var(--text-main)] hover:bg-brand/10 rounded-xl transition-all outline-none"
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
                                            className="w-full flex items-center gap-3 px-4 py-2.5 text-[11px] font-normal text-[var(--text-main)] hover:bg-brand/10 rounded-xl transition-all outline-none"
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
                </div>

                {/* Main Content Area */}
                <div className="flex-1 flex flex-col overflow-hidden">
                        <div className="relative flex-shrink-0">
                            <div className="absolute bottom-0 left-0 right-0 h-px bg-[var(--border-base)]" />
                            <div className="px-6 h-[40px] flex items-end">
                                <AppTabs
                                    className="z-20"
                                    tabs={[
                                        { id: 'tables', label: 'Selected Tables' },
                                        { id: 'joins', label: 'Joins' },
                                        { id: 'conditions', label: 'Conditions' },
                                        { id: 'grouping_sorting', label: 'Grouping & Sorting' },
                                        ...(activeBlockId === 'main' ? [{ 
                                            id: 'json_builder', 
                                            label: fullState.jsonTree && fullState.jsonTree.length > 0 ? 'JSON Builder (Active)' : 'JSON Builder',
                                            icon: fullState.jsonTree && fullState.jsonTree.length > 0 ? 'data_object' : undefined
                                        }] : [])
                                    ]}
                                    activeTab={activeTab}
                                    onTabChange={(tabId: string) => setActiveTab(tabId as any)}
                                />
                            </div>
                        </div>

                        <div className="flex-1 flex flex-col overflow-hidden bg-[var(--bg-app)]">
                            {activeTab === 'tables' && (
                                    <div className="flex-1 flex gap-4 overflow-hidden relative p-4 pt-5">
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
                                                onRemoveAllFields={() => {
                                                    updateActiveState(prev => ({ ...prev, selectedFields: [] }));
                                                }}
                                            />
                                        </div>

                                        {/* Main empty state removed as per user request */}
                                    </div>
                                )}
                                {activeTab === 'joins' && (
                                    <div className="flex-1 overflow-y-auto p-6">
                                        <JoinsView
                                            state={activeState}
                                            setState={updateActiveState}
                                            getColumns={getColumns}
                                            queryState={fullState}
                                        />
                                    </div>
                                )}
                                {activeTab === 'conditions' && (
                                    <div className="flex-1 flex flex-col overflow-hidden">
                                        <div className="flex-1 overflow-y-auto p-6">
                                            <ConditionsView
                                                state={activeState}
                                                setState={updateActiveState}
                                                getColumns={getColumns}
                                                queryState={fullState}
                                                parameters={parameters}
                                            />
                                        </div>

                                         {parameters && parameters.length > 0 && (
                                            <div className="shrink-0 p-6 border-t border-[var(--border-base)] bg-[var(--bg-alt)]/30 backdrop-blur-sm">
                                                <div className="flex items-center gap-3 mb-4">
                                                    <div className="w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center text-brand">
                                                        <Icon name="parameters" size={16} />
                                                    </div>
                                                    <div>
                                                        <h3 className="text-xs font-normal uppercase tracking-widest text-[var(--text-main)]">Execution Parameters</h3>
                                                        <p className="text-[9px] text-[var(--text-muted)] font-normal">Provide test values for query preview</p>
                                                    </div>
                                                </div>
                                                <div className="space-y-1 mt-2">
                                                    {[...parameters].sort((a, b) => a.parameter_name.localeCompare(b.parameter_name)).map(p => (
                                                        <div key={p.parameter_name} className="flex items-center gap-2 px-2 py-0.5 hover:bg-brand/5 rounded transition-colors group">
                                                            <div className="flex items-center gap-2 min-w-0 flex-1">
                                                                <span className="text-[10px] font-bold uppercase tracking-tight text-[var(--text-main)] shrink-0">
                                                                    {p.parameter_name.toUpperCase()}
                                                                </span>
                                                                <span className="text-[10px] text-[var(--text-muted)] shrink-0">—</span>
                                                                <span className="text-[11px] font-medium text-[var(--text-main)] truncate">
                                                                    {(() => {
                                                                        // Prioritize the live resolved state (parameterValues) first —
                                                                        // it holds the project ID for system params and the initialized defaults.
                                                                        const liveVal = parameterValues[p.parameter_name];
                                                                        const defVal = (p as any).default_value ?? (p as any).defaultValue ?? (p as any).value ?? (p as any).default;
                                                                        const val = (liveVal !== undefined && liveVal !== null && liveVal !== '')
                                                                            ? liveVal
                                                                            : defVal;
                                                                        if (val === 0 || val === false) return val.toString();
                                                                        return val || <span className="text-[var(--text-muted)] italic opacity-30">(not set)</span>;
                                                                    })()}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                                {activeTab === 'grouping_sorting' && (
                                    <div className="flex-1 overflow-y-auto p-6">
                                        <GroupingSortingView
                                            state={activeState}
                                            setState={updateActiveState}
                                            getColumns={getColumns}
                                            queryState={fullState}
                                        />
                                    </div>
                                )}
                                {activeTab === 'json_builder' && (
                                    <div className="flex-1 overflow-hidden min-h-0 bg-[var(--bg-app)]">
                                        <JsonBuilderView 
                                            jsonTree={fullState.jsonTree || []}
                                            onChange={(tree) => setFullState(prev => ({ ...prev, jsonTree: tree }))}
                                            queryState={fullState}
                                            availableFields={fullState.mainQuery.selectedFields.map(f => f.alias || f.columnName || '')}
                                        />
                                    </div>
                                )}
                            </div>

                            {/* SQL Preview Bottom Bar */}
                            <div className="h-32 border-t border-[var(--border-base)] bg-[var(--bg-alt)] flex flex-col">
                                <div className="px-4 py-2 border-b border-[var(--border-base)] bg-[var(--bg-app)] flex items-center justify-between">
                                    <h3 className="text-[10px] font-normal uppercase tracking-wider text-[var(--text-muted)]">SQL Preview</h3>
                                    {!effectiveSql.canRun && activeBlockId !== 'main' && (
                                        <span className="text-[9px] font-normal text-amber-500 uppercase tracking-tight bg-amber-500/10 px-2 py-0.5 rounded-md">
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
        </AppCompactModalForm>

        <AppCompactModalForm
                isOpen={isResultsOpen}
                onClose={() => setIsResultsOpen(false)}
                onSubmit={executionError ? () => setIsResultsOpen(false) : handleCopyResults}
                title={executionError ? "Query Execution Error" : "Query Results"}
                icon={executionError ? "warning" : "table_chart"}
                width="max-w-7xl"
                submitLabel={executionError ? "Close" : (isCopied ? 'Copied' : 'Copy Result')}
                cancelLabel={executionError ? undefined : "Close"}
                allowedShortcuts={['f5', 'cmd+r', 'ctrl+r']}
                className={executionError ? "border-red-500/50" : ""}
            >
                <div className="h-[60vh] flex flex-col">
                    {executionError ? (
                        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-red-500/5 rounded-2xl border border-red-500/10">
                            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 mb-6 animate-pulse">
                                <Icon name="error_outline" size={40} />
                            </div>
                            <h3 className="text-lg font-normal text-red-600 mb-2">Something went wrong</h3>
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
                            {activeBlockId === 'main' && fullState.jsonTree && fullState.jsonTree.length > 0 ? (
                                <AppJsonView data={queryResults} />
                            ) : (
                                <AppTabulatorTable
                                    data={queryResults}
                                    maxWidth={600}
                                />
                            )}
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center opacity-40">
                            <Icon name="search_off" size={48} className="mb-4 text-[var(--text-muted)]" />
                            <p className="text-sm font-normal">No results found.</p>
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
                    <p className="text-xs text-[var(--text-main)] mb-1">Are you sure you want to delete query block <span className="font-normal text-brand">{cteToDelete?.alias}</span>?</p>
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
                            <label className="text-[10px] font-normal uppercase tracking-wider text-[var(--text-muted)]">New Name</label>
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

            <AppCompactModalForm
                isOpen={isSavePresetModalOpen}
                onClose={() => setIsSavePresetModalOpen(false)}
                onSubmit={handleSavePreset}
                title="Save Preset"
                icon="bookmark_add"
                width="max-w-md"
            >
                <div className="space-y-4">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-normal uppercase tracking-wider text-[var(--text-muted)]">Preset Name</label>
                        <AppFormFieldRect>
                            <input
                                autoFocus
                                value={presetName}
                                onChange={e => setPresetName(e.target.value)}
                                placeholder="Enter preset name..."
                                className="w-full bg-transparent outline-none h-full text-xs"
                                onKeyDown={e => {
                                    if (e.key === 'Enter') handleSavePreset();
                                }}
                            />
                        </AppFormFieldRect>
                    </div>
                </div>
            </AppCompactModalForm>
            <AppCompactModalForm
                isOpen={!!editingPreset}
                onClose={() => setEditingPreset(null)}
                onSubmit={async () => {
                    if (editingPreset && newPresetName.trim()) {
                        await renamePreset(editingPreset.id, newPresetName.trim());
                        setEditingPreset(null);
                    }
                }}
                title="Rename Preset"
                icon="drive_file_rename_outline"
                submitLabel="Save"
            >
                <div className="space-y-4 py-2">
                    <p className="text-xs text-[var(--text-muted)]">Enter a new name for the preset:</p>
                    <AppFormFieldRect>
                        <input
                            autoFocus
                            value={newPresetName}
                            onChange={(e) => setNewPresetName(e.target.value)}
                            className="w-full bg-transparent outline-none h-full text-xs"
                            placeholder="Preset name"
                        />
                    </AppFormFieldRect>
                </div>
            </AppCompactModalForm>

            <AppCompactModalForm
                isOpen={!!deletingPreset}
                onClose={() => setDeletingPreset(null)}
                onSubmit={async () => {
                    if (deletingPreset) {
                        await deletePreset(deletingPreset.id);
                        setDeletingPreset(null);
                    }
                }}
                title="Delete Preset"
                icon="delete"
                submitLabel="Delete"
                cancelLabel="Cancel"
            >
                <div className="py-2">
                    <p className="text-xs text-[var(--text-muted)]">
                        Are you sure you want to delete preset <strong className="text-[var(--text-main)]">"{deletingPreset?.name}"</strong>?
                    </p>
                    <p className="text-[10px] text-red-500 mt-2">This action cannot be undone.</p>
                </div>
            </AppCompactModalForm>
        </>
    );
};

