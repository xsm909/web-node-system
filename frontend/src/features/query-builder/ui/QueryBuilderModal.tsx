import React, { useState, useEffect, useMemo } from 'react';
import { Icon } from '../../../shared/ui/icon';
import { AppHeader } from '../../../widgets/app-header';
import { AppTabs } from '../../../shared/ui/app-tabs';
import { useDatabaseMetadata } from '../lib/useDatabaseMetadata';
import type { MultiQueryState, QueryState, SelectedField, JoinCondition, WhereCondition } from '../model/types';
import { generateSQL } from '../lib/sqlGenerator';

interface QueryBuilderModalProps {
    isOpen: boolean;
    onClose: () => void;
    onDone: (sql: string) => void;
}

export const QueryBuilderModal: React.FC<QueryBuilderModalProps> = ({ isOpen, onClose, onDone }) => {
    const { tables, getColumns, getForeignKeys, loading } = useDatabaseMetadata();
    
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

    useEffect(() => {
        setPreviewSql(generateSQL(fullState));
    }, [fullState]);

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

    const handleAddCTE = () => {
        const id = `cte_${Date.now()}`;
        const alias = `tab${fullState.ctes.length + 1}`;
        setFullState(prev => ({
            ...prev,
            ctes: [...prev.ctes, { 
                id, 
                alias, 
                state: { tables: [], selectedFields: [], joins: [], where: [] } 
            }]
        }));
        setActiveBlockId(id);
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
                            <div className="px-2 py-1 flex items-center justify-between">
                                <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Query Blocks</h3>
                                <button onClick={handleAddCTE} className="p-1 hover:bg-brand/10 rounded-md text-brand transition-all">
                                    <Icon name="add" size={14} />
                                </button>
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
                            <div className="space-y-6 max-w-5xl">
                                {activeState.tables.map(table => (
                                    <TableSelectionView 
                                        key={table.alias} 
                                        tableName={table.tableName} 
                                        tableAlias={table.alias}
                                        onRemove={() => handleRemoveTableAlias(table.alias)}
                                        getColumns={getColumns}
                                        onAddField={handleAddField}
                                        onRemoveField={handleRemoveField}
                                        selectedFields={activeState.selectedFields.filter(f => f.tableAlias === table.alias)}
                                        queryState={fullState}
                                    />
                                ))}
                                {activeState.tables.length === 0 && (
                                    <div className="h-64 flex flex-col items-center justify-center border-2 border-dashed border-[var(--border-base)] rounded-2xl opacity-40">
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
                        <div className="px-4 py-2 border-b border-[var(--border-base)] bg-[var(--bg-app)]">
                            <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">SQL Preview</h3>
                        </div>
                        <div className="flex-1 p-4 font-mono text-xs overflow-y-auto selection:bg-brand/20">
                            <pre className="text-brand">{previewSql || '-- Generated SQL will appear here'}</pre>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- Internal Helper Components ---

const ColumnSelect = ({ tableAlias, value, onChange, getColumns, queryState, state, placeholder = "Select column..." }: any) => {
    const [columns, setColumns] = useState<any[]>([]);
    
    useEffect(() => {
        if (!state?.tables || !queryState?.ctes) return;

        const table = state.tables.find((t: any) => t.alias === tableAlias);
        if (!table) return;

        // Check if the tableName of this instance is a CTE alias
        const targetCte = queryState.ctes.find((c: any) => c.alias === table.tableName);
        
        if (targetCte) {
            setColumns(targetCte.state.selectedFields.map((f: any) => ({
                name: f.alias || f.columnName,
                type: 'CTE'
            })));
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

const TableSelectionView = ({ tableName, tableAlias, onRemove, getColumns, onAddField, onRemoveField, selectedFields, queryState }: any) => {
    const [columns, setColumns] = useState<any[]>([]);
    
    useEffect(() => {
        const cte = queryState.ctes.find((c: any) => c.alias === tableName);
        if (cte) {
            // Virtual table from CTE: its columns are its selected fields
            setColumns(cte.state.selectedFields.map((f: any) => ({
                name: f.alias || f.columnName,
                type: 'CTE'
            })));
        } else {
            getColumns(tableName).then(setColumns);
        }
    }, [tableName, getColumns, queryState.ctes]);

    return (
        <div className="bg-[var(--bg-app)] border border-[var(--border-base)] rounded-2xl overflow-hidden shadow-sm hover:border-brand/30 transition-all">
            <div className="bg-[var(--bg-alt)] px-6 py-4 flex items-center justify-between border-b border-[var(--border-base)]">
                <div className="flex flex-col">
                    <h3 className="text-sm font-bold text-[var(--text-main)] flex items-center gap-2">
                        {tableName}
                        {tableAlias !== tableName && (
                            <span className="text-[10px] bg-brand/10 text-brand px-1.5 py-0.5 rounded uppercase tracking-wider">AS {tableAlias}</span>
                        )}
                    </h3>
                </div>
                <button onClick={onRemove} className="text-[var(--text-muted)] hover:text-red-500 transition-colors">
                    <Icon name="delete" size={16} />
                </button>
            </div>
            <div className="p-4 grid grid-cols-3 gap-4">
                {columns.map(col => {
                    const isSelected = selectedFields.some((f: any) => f.columnName === col.name);
                    return (
                        <div 
                            key={col.name}
                            className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer group ${
                                isSelected 
                                ? 'bg-brand/5 border-brand/20 shadow-sm' 
                                : 'bg-[var(--bg-app)] border-[var(--border-base)] hover:border-brand/20'
                            }`}
                            onClick={() => {
                                if (isSelected) {
                                    const field = selectedFields.find((f: any) => f.columnName === col.name);
                                    onRemoveField(field.id);
                                } else {
                                    onAddField({
                                        id: `${tableAlias}_${col.name}_${Date.now()}`,
                                        tableAlias,
                                        columnName: col.name
                                    });
                                }
                            }}
                        >
                            <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${
                                isSelected ? 'bg-brand border-brand text-white' : 'border-[var(--border-base)] group-hover:border-brand/50'
                            }`}>
                                {isSelected && <Icon name="check" size={10} />}
                            </div>
                            <div className="flex flex-col">
                                <span className="text-xs font-bold text-[var(--text-main)]">{col.name}</span>
                                <span className="text-[10px] text-[var(--text-muted)] uppercase">{col.type}</span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const JoinsView = ({ state, setState, getColumns, queryState }: any) => {
    // Basic implementation for adding joins
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
        setState((prev: any) => ({ ...prev, joins: [...prev.joins, newJoin] }));
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
            
            <div className="space-y-4">
                {state.joins.map((join: JoinCondition, index: number) => (
                    <div key={join.id} className="p-4 rounded-2xl border border-[var(--border-base)] bg-[var(--bg-app)] flex flex-col gap-4 group">
                        <div className="flex items-center gap-4">
                            <select 
                                value={join.type}
                                onChange={(e) => {
                                    const newJoins = [...state.joins];
                                    newJoins[index].type = e.target.value as any;
                                    setState((prev: any) => ({ ...prev, joins: newJoins }));
                                }}
                                className="bg-[var(--bg-alt)] border border-[var(--border-base)] rounded-lg px-3 py-1.5 text-xs font-bold outline-none focus:border-brand"
                            >
                                <option value="INNER">INNER JOIN</option>
                                <option value="LEFT">LEFT JOIN</option>
                                <option value="RIGHT">RIGHT JOIN</option>
                                <option value="FULL">FULL JOIN</option>
                            </select>

                            <select 
                                value={join.rightTableAlias}
                                onChange={(e) => {
                                    const newJoins = [...state.joins];
                                    newJoins[index].rightTableAlias = e.target.value;
                                    setState((prev: any) => ({ ...prev, joins: newJoins }));
                                }}
                                className="flex-1 bg-[var(--bg-alt)] border border-[var(--border-base)] rounded-lg px-3 py-2 text-xs outline-none focus:border-brand"
                            >
                                {state.tables.map((t: any) => <option key={t.alias} value={t.alias}>{t.alias}</option>)}
                            </select>

                            <button 
                                onClick={() => {
                                    const newJoins = [...state.joins];
                                    newJoins.splice(index, 1);
                                    setState((prev: any) => ({ ...prev, joins: newJoins }));
                                }}
                                className="text-[var(--text-muted)] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all ml-auto"
                            >
                                <Icon name="delete" size={16} />
                            </button>
                        </div>

                        <div className="flex items-center gap-2 pl-4 border-l-2 border-brand/20">
                            <span className="text-[var(--text-muted)] font-bold text-[10px] uppercase min-w-[30px]">ON</span>
                            
                            <select 
                                value={join.leftTableAlias}
                                onChange={(e) => {
                                    const newJoins = [...state.joins];
                                    newJoins[index].leftTableAlias = e.target.value;
                                    setState((prev: any) => ({ ...prev, joins: newJoins }));
                                }}
                                className="bg-[var(--bg-alt)] border border-[var(--border-base)] rounded-lg px-2 py-1.5 text-xs outline-none focus:border-brand min-w-[120px]"
                            >
                                {state.tables.map((t: any) => <option key={t.alias} value={t.alias}>{t.alias}</option>)}
                            </select>
                            <span className="text-[var(--text-muted)] font-bold">.</span>
                            <ColumnSelect 
                                tableAlias={join.leftTableAlias}
                                value={join.leftColumn}
                                onChange={(val: string) => {
                                    const newJoins = [...state.joins];
                                    newJoins[index].leftColumn = val;
                                    setState((prev: any) => ({ ...prev, joins: newJoins }));
                                }}
                                getColumns={getColumns}
                                queryState={queryState}
                                state={state}
                            />
                            
                            <span className="text-[var(--text-muted)] font-bold px-2">=</span>
                            
                            <select 
                                value={join.rightTableAlias}
                                onChange={(e) => {
                                    const newJoins = [...state.joins];
                                    newJoins[index].rightTableAlias = e.target.value;
                                    setState((prev: any) => ({ ...prev, joins: newJoins }));
                                }}
                                className="bg-[var(--bg-alt)] border border-[var(--border-base)] rounded-lg px-2 py-1.5 text-xs outline-none focus:border-brand min-w-[120px]"
                            >
                                {state.tables.map((t: any) => <option key={t.alias} value={t.alias}>{t.alias}</option>)}
                            </select>
                            <span className="text-[var(--text-muted)] font-bold">.</span>
                            <ColumnSelect 
                                tableAlias={join.rightTableAlias}
                                value={join.rightColumn}
                                onChange={(val: string) => {
                                    const newJoins = [...state.joins];
                                    newJoins[index].rightColumn = val;
                                    setState((prev: any) => ({ ...prev, joins: newJoins }));
                                }}
                                getColumns={getColumns}
                                queryState={queryState}
                                state={state}
                            />
                        </div>
                    </div>
                ))}

                {state.joins.length === 0 && (
                    <div className="py-12 flex flex-col items-center justify-center border-2 border-dashed border-[var(--border-base)] rounded-2xl opacity-40">
                         <Icon name="device_hub" size={32} className="mb-2 text-[var(--text-muted)]" />
                         <p className="text-xs font-medium">No joins defined yet.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

const ConditionsView = ({ state, setState, getColumns, queryState }: any) => {
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
        setState((prev: any) => ({ ...prev, where: [...prev.where, newCond] }));
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
                {state.where.map((cond: WhereCondition, index: number) => (
                    <div key={cond.id} className="p-4 rounded-2xl border border-[var(--border-base)] bg-[var(--bg-app)] flex items-center gap-3 group">
                        {index > 0 && (
                             <select 
                                value={cond.logic}
                                onChange={(e) => {
                                    const newWheres = [...state.where];
                                    newWheres[index].logic = e.target.value as any;
                                    setState((prev: any) => ({ ...prev, where: newWheres }));
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
                                setState((prev: any) => ({ ...prev, where: newWheres }));
                            }}
                            className="bg-[var(--bg-alt)] border border-[var(--border-base)] rounded-lg px-2 py-2 text-xs outline-none focus:border-brand min-w-[120px]"
                        >
                            {state.tables.map((t: any) => <option key={t.alias} value={t.alias}>{t.alias}</option>)}
                        </select>

                        <ColumnSelect 
                            tableAlias={cond.tableAlias}
                            value={cond.columnName}
                            onChange={(val: string) => {
                                const newWheres = [...state.where];
                                newWheres[index].columnName = val;
                                setState((prev: any) => ({ ...prev, where: newWheres }));
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
                                setState((prev: any) => ({ ...prev, where: newWheres }));
                            }}
                            className="bg-[var(--bg-alt)] border border-[var(--border-base)] rounded-lg px-2 py-2 text-xs font-bold outline-none focus:border-brand w-20"
                        >
                             <option value="=">=</option>
                             <option value="!=">!=</option>
                             <option value=">">&gt;</option>
                             <option value="<">&lt;</option>
                             <option value=">=">&gt;=</option>
                             <option value="<=">&lt;=</option>
                             <option value="LIKE">LIKE</option>
                             <option value="IN">IN</option>
                        </select>

                        <input 
                            placeholder="value"
                            value={cond.value}
                            onChange={(e) => {
                                const newWheres = [...state.where];
                                newWheres[index].value = e.target.value;
                                setState((prev: any) => ({ ...prev, where: newWheres }));
                            }}
                            className="flex-1 bg-[var(--bg-alt)] border border-[var(--border-base)] rounded-lg px-3 py-2 text-xs outline-none focus:border-brand"
                        />

                        <button 
                            onClick={() => {
                                const newWheres = [...state.where];
                                newWheres.splice(index, 1);
                                setState((prev: any) => ({ ...prev, where: newWheres }));
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
