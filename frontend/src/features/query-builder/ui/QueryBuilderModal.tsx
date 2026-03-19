import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { arrayMove } from '@dnd-kit/sortable';
import { Icon } from '../../../shared/ui/icon';
import { AppHeader } from '../../../widgets/app-header';
import { AppTabs } from '../../../shared/ui/app-tabs';
import { useDatabaseMetadata } from '../lib/useDatabaseMetadata';
import type { MultiQueryState, QueryState, SelectedField, JoinCondition, WhereCondition } from '../model/types';
import { generateSQL, generateBlockSQL } from '../lib/sqlGenerator';
import { parseSQL } from '../lib/sqlParser';
import { SelectedTablesTreeView } from './SelectedTablesTreeView';
import { SelectedFieldsTreeView } from './SelectedFieldsTreeView';
import { FieldExpressionModal } from './FieldExpressionModal';
import { AppCompactModalForm } from '../../../shared/ui/app-compact-modal-form/AppCompactModalForm';
import { AppTable } from '../../../shared/ui/app-table/AppTable';
import { apiClient } from '../../../shared/api/client';

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

interface ViewProps {
    state: QueryState;
    setState: (updater: (prev: QueryState) => QueryState) => void;
    getColumns: (tableName: string) => Promise<any[]>;
    queryState: MultiQueryState;
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

const ConditionsView: React.FC<ViewProps> = ({ state, setState, getColumns, queryState }) => {
    const addCondition = () => {
        if (state.tables.length === 0) return;
        const newCond: WhereCondition = {
            id: `where_${Date.now()}`,
            tableAlias: state.tables[0].alias,
            columnName: '',
            operator: '=',
            value: "''",
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

                        <input 
                            placeholder="value"
                            value={cond.value}
                            onChange={(e) => {
                                const newWheres = [...state.where];
                                newWheres[index].value = e.target.value;
                                setState((prev) => ({ ...prev, where: newWheres }));
                            }}
                            disabled={cond.operator === 'IS NULL' || cond.operator === 'IS NOT NULL'}
                            className={`flex-1 bg-[var(--bg-alt)] border border-[var(--border-base)] rounded-lg px-3 py-2 text-xs outline-none focus:border-brand ${
                                (cond.operator === 'IS NULL' || cond.operator === 'IS NOT NULL') ? 'opacity-30' : ''
                            }`}
                        />

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

interface QueryBuilderModalProps {
    isOpen: boolean;
    onClose: () => void;
    onDone: (sql: string) => void;
    initialSql?: string;
    onError?: (error: string) => void;
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
            icon="account_tree"
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

export const QueryBuilderModal: React.FC<QueryBuilderModalProps> = ({ isOpen, onClose, onDone, initialSql, onError }) => {
    const { tables, getColumns, loading } = useDatabaseMetadata();
    
    const [fullState, setFullState] = useState<MultiQueryState>({
        ctes: [],
        mainQuery: {
            tables: [],
            selectedFields: [],
            joins: [],
            where: []
        }
    });

    const [activeBlockId, setActiveBlockId] = useState('main');
    const [activeTab, setActiveTab] = useState('tables');
    const [previewSql, setPreviewSql] = useState('');
    const [editingField, setEditingField] = useState<SelectedField | null>(null);
    const [editingCTE, setEditingCTE] = useState<any>(null);
    const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
    const [isRecursiveModalOpen, setIsRecursiveModalOpen] = useState(false);
    
    // Execution state
    const [isExecuting, setIsExecuting] = useState(false);
    const [queryResults, setQueryResults] = useState<any[]>([]);
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
            const sql = generateSQL(fullState);
            return { sql, canRun: !!sql.trim() };
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

        const sql = generateBlockSQL(targetCte.state);
        return { sql, canRun: !!sql.trim() };
    }, [activeBlockId, fullState]);

    useEffect(() => {
        setPreviewSql(effectiveSql.sql);
    }, [effectiveSql]);

    useEffect(() => {
        if (isOpen && initialSql && initialSql.trim() !== "") {
            try {
                const parsedState = parseSQL(initialSql);
                if (parsedState.mainQuery.tables.length === 0 && initialSql.trim().length > 0) {
                    throw new Error("Could not identify tables in the provided SQL. Please ensure it follows a standard SELECT ... FROM ... format.");
                }
                setFullState(parsedState);
            } catch (err: any) {
                console.error("SQL Parse Error:", err);
                onError?.(err.message || 'Unknown parsing error');
                onClose(); // Close modal if parsing fails
            }
        } else if (isOpen) {
             // Reset to blank when opening without initialSql (or empty)
             setFullState({
                ctes: [],
                mainQuery: { tables: [], selectedFields: [], joins: [], where: [] }
            });
        }
    }, [isOpen, initialSql, onError]);
    
    const handleExecuteQuery = useCallback(async () => {
        if (isExecuting || !effectiveSql.canRun) return;
        
        console.log("Executing SQL:", effectiveSql.sql);
        setIsExecuting(true);
        try {
            const res = await apiClient.post('/database-metadata/execute', { sql: effectiveSql.sql });
            setQueryResults(res.data);
            setIsResultsOpen(true);
        } catch (err: any) {
            console.error("Execution error:", err);
            onError?.(err.response?.data?.detail || err.message || 'Execution error');
        } finally {
            setIsExecuting(false);
        }
    }, [isExecuting, effectiveSql, apiClient, onError]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;
            
            if (e.key === 'F5' || e.key === 'F9') {
                e.preventDefault();
                e.stopPropagation();
                handleExecuteQuery();
            }
        };

        window.addEventListener('keydown', handleKeyDown, true);
        return () => window.removeEventListener('keydown', handleKeyDown, true);
    }, [isOpen, handleExecuteQuery]);

    const handleAddTable = (tableName: string, isCte = false) => {
        const existingCount = activeState.tables.filter((t: any) => t.tableName === tableName).length;
        const alias = existingCount === 0 ? tableName : `${tableName}_${existingCount + 1}`;
        
        updateActiveState(prev => ({
            ...prev,
            tables: [...prev.tables, { alias, tableName, isCte }]
        }));
    };

    const handleRemoveTableAlias = (alias: string) => {
        updateActiveState(prev => ({
            ...prev,
            tables: prev.tables.filter(t => t.alias !== alias),
            selectedFields: prev.selectedFields.filter(f => f.tableAlias !== alias),
            joins: prev.joins.filter(j => j.leftTableAlias !== alias && j.rightTableAlias !== alias),
            where: prev.where.filter(w => w.tableAlias !== alias)
        }));
    };

    const handleAddField = (field: SelectedField) => {
        updateActiveState(prev => ({
            ...prev,
            selectedFields: [...prev.selectedFields, field]
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

    const handleAddCTE = (isRecursive = false, config?: any) => {
        const id = editingCTE ? editingCTE.id : `cte_${Date.now()}`;
        const alias = config?.alias || `tab${fullState.ctes.length + 1}`;
        
        let state: QueryState = editingCTE ? editingCTE.state : { tables: [], selectedFields: [], joins: [], where: [] };
        
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
                }]
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

    if (!isOpen) return null;

    return (
        <>
            <div className="fixed inset-0 z-[1000] bg-[var(--bg-app)] flex flex-col animate-in fade-in duration-200">
                <div className="shrink-0 flex flex-col">
                    <AppHeader
                        onBack={onClose}
                        onToggleSidebar={() => {}}
                        leftContent={
                            <h2 className="text-sm font-bold uppercase tracking-widest text-[var(--text-main)]">Query Builder</h2>
                        }
                        rightContent={
                            <div className="flex items-center gap-3">
                                {isExecuting && (
                                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-brand/10 text-brand text-[10px] font-bold animate-pulse">
                                        <div className="w-3 h-3 border-2 border-brand/30 border-t-brand rounded-full animate-spin" />
                                        Executing...
                                    </div>
                                )}
                                <button 
                                    onClick={handleExecuteQuery}
                                    disabled={isExecuting || !effectiveSql.canRun}
                                    className={`px-4 py-2 bg-[var(--bg-alt)] border border-[var(--border-base)] text-brand text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-2 ${
                                        (!effectiveSql.canRun && !isExecuting) ? 'opacity-40 cursor-not-allowed grayscale' : 'hover:bg-brand/5'
                                    }`}
                                    title={!effectiveSql.canRun ? effectiveSql.sql : "Shortcut: F5 or F9"}
                                >
                                    <Icon name="play_arrow" size={14} />
                                    Run (F5)
                                </button>
                                <button 
                                    onClick={() => onDone(previewSql)}
                                    className="px-4 py-2 bg-brand text-white text-xs font-bold rounded-xl hover:opacity-90 transition-all shadow-sm"
                                >
                                    Ready
                                </button>
                            </div>
                        }
                    />
                </div>

                <div className="flex-1 flex overflow-hidden">
                    {/* Left Sidebar: Tables List */}
                    <div className="w-64 border-r border-[var(--border-base)] flex flex-col bg-[var(--bg-alt)]">
                        <div className="p-4 border-b border-[var(--border-base)]">
                            <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-2">
                                <Icon name="table_chart" size={14} />
                                Available Tables
                            </h3>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-1">
                            <div className="mb-4">
                                <div className="px-2 py-1 flex items-center justify-between relative">
                                    <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Query Blocks</h3>
                                    <button 
                                        onClick={() => setIsAddMenuOpen(!isAddMenuOpen)} 
                                        className={`p-1 rounded-md transition-all ${isAddMenuOpen ? 'bg-brand text-white' : 'hover:bg-brand/10 text-brand'}`}
                                    >
                                        <Icon name="add" size={14} />
                                    </button>
                                    
                                    {isAddMenuOpen && (
                                        <div className="absolute top-full right-0 mt-1 z-50 w-48 bg-[var(--bg-app)] border border-[var(--border-base)] rounded-xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-100">
                                            <button 
                                                onClick={() => handleAddCTE(false)}
                                                className="w-full flex items-center gap-2 px-3 py-2 text-[11px] font-medium text-[var(--text-main)] hover:bg-brand/5 transition-all outline-none"
                                            >
                                                <Icon name="select_window" size={14} className="text-brand" />
                                                Regular Query
                                            </button>
                                            <button 
                                                onClick={() => {
                                                    setIsAddMenuOpen(false);
                                                    setEditingCTE(null);
                                                    setIsRecursiveModalOpen(true);
                                                }}
                                                className="w-full flex items-center gap-2 px-3 py-2 text-[11px] font-medium text-[var(--text-main)] border-t border-[var(--border-base)] hover:bg-brand/5 transition-all outline-none"
                                            >
                                                <Icon name="account_tree" size={14} className="text-brand" />
                                                Recursive Query
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <div 
                                    className={`flex items-center justify-between p-2 rounded-lg cursor-pointer border transition-all ${
                                        activeBlockId === 'main' 
                                        ? 'bg-brand/10 border-brand/20 text-brand' 
                                        : 'hover:bg-brand/5 border-transparent text-[var(--text-muted)]'
                                    }`}
                                    onClick={() => setActiveBlockId('main')}
                                >
                                    <span className="text-xs font-bold">Main Query</span>
                                    <Icon name="chevron_right" size={14} />
                                </div>
                                {fullState.ctes.map(cte => (
                                    <div key={cte.id} className="group flex items-center gap-2">
                                        <div 
                                            className={`flex-1 flex items-center justify-between p-2 rounded-lg cursor-pointer border transition-all ${
                                                activeBlockId === cte.id 
                                                ? 'bg-brand/10 border-brand/20 text-brand' 
                                                : 'hover:bg-brand/5 border-transparent text-[var(--text-muted)]'
                                            }`}
                                            onClick={() => setActiveBlockId(cte.id)}
                                        >
                                            <span className="text-xs font-medium">{cte.alias}</span>
                                            {cte.isRecursive && (
                                                <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setEditingCTE(cte);
                                                        setIsRecursiveModalOpen(true);
                                                    }}
                                                    className="p-1 rounded hover:bg-brand/10 text-brand"
                                                >
                                                    <Icon name="settings" size={12} />
                                                </button>
                                            )}
                                            <Icon name="chevron_right" size={14} />
                                        </div>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                            <button 
                                                className="p-1.5 rounded-lg bg-brand/10 text-brand hover:bg-brand/20 transition-all"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleAddTable(cte.alias, true);
                                                }}
                                                title="Use as virtual table"
                                            >
                                                <Icon name="library_add" size={14} />
                                            </button>
                                            <button 
                                                className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-500 transition-all"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleRemoveCTE(cte.id, cte.alias);
                                                }}
                                                title="Delete block"
                                            >
                                                <Icon name="delete" size={14} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div>
                                <div className="px-2 py-1 flex items-center justify-between">
                                    <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Database</h3>
                                </div>
                                {loading ? (
                                    <div className="p-4 text-xs text-[var(--text-muted)] italic">Loading...</div>
                                ) : (
                                    tables.map(table => (
                                        <div 
                                            key={table}
                                            className="group flex items-center justify-between p-2 rounded-lg hover:bg-brand/5 cursor-pointer border border-transparent hover:border-brand/20 transition-all"
                                            onClick={() => handleAddTable(table)}
                                        >
                                            <span className="text-xs font-medium text-[var(--text-main)]">{table}</span>
                                            <Icon name="plus" size={14} className="text-brand opacity-0 group-hover:opacity-100 transition-all" />
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Main Content Area */}
                    <div className="flex-1 flex flex-col overflow-hidden">
                        <div className="px-6 border-b border-[var(--border-base)]">
                            <AppTabs 
                                tabs={[
                                    { id: 'tables', label: 'Tables & Selection' },
                                    { id: 'joins', label: 'Joins' },
                                    { id: 'conditions', label: 'Conditions' }
                                ]}
                                activeTab={activeTab}
                                onTabChange={setActiveTab}
                            />
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 bg-[var(--bg-app)]">
                            {activeTab === 'tables' && (
                                <div className="h-full flex gap-6 overflow-hidden">
                                    <div className="flex-1 flex flex-col min-w-0">
                                        <SelectedTablesTreeView 
                                            tables={activeState.tables}
                                            selectedFields={activeState.selectedFields}
                                            onAddField={handleAddField}
                                            onRemoveField={handleRemoveField}
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
                                            onRemoveField={handleRemoveField}
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
                                <ConditionsView 
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
            </div>

            <AppCompactModalForm
                isOpen={isResultsOpen}
                onClose={() => setIsResultsOpen(false)}
                onSubmit={() => setIsResultsOpen(false)}
                title="Query Results"
                icon="table_chart"
                width="max-w-7xl"
            >
                <div className="h-[60vh] flex flex-col">
                    {queryResults.length > 0 ? (
                        <AppTable 
                            data={queryResults}
                            columns={Object.keys(queryResults[0]).map(key => ({
                                header: key,
                                accessorKey: key,
                                cell: (info: any) => {
                                    const val = info.getValue();
                                    if (typeof val === 'object' && val !== null) {
                                        return JSON.stringify(val);
                                    }
                                    return String(val ?? '');
                                }
                            }))}
                            config={{
                                emptyMessage: "Query returned no results.",
                                layout: 'compact'
                            }}
                        />
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
        </>
    );
};
