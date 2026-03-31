import React, { useState, useCallback, useRef } from 'react';
import type { JsonTreeNode, JsonNodeType } from '../model/types';
import { Icon } from '../../../shared/ui/icon';
import { generateJsonSQL } from '../lib/sqlGenerator';
import type { MultiQueryState } from '../model/types';
import { UI_CONSTANTS } from '../../../shared/ui/constants';

// ── Helpers ───────────────────────────────────────────────────────────────────

const makeId = (): string => `jn_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

const insertNode = (
    tree: JsonTreeNode[],
    newNode: JsonTreeNode,
    targetId: string | null,
    position: 'inside' | 'before' | 'after'
): JsonTreeNode[] => {
    if (!targetId) return [...tree, newNode];

    const tryInsert = (nodes: JsonTreeNode[]): { nodes: JsonTreeNode[]; inserted: boolean } => {
        for (let i = 0; i < nodes.length; i++) {
            if (nodes[i].id === targetId) {
                const copy = [...nodes];
                if (position === 'inside' && (copy[i].type === 'object' || copy[i].type === 'array')) {
                    copy[i] = { ...copy[i], children: [...(copy[i].children || []), newNode] };
                } else if (position === 'before') {
                    copy.splice(i, 0, newNode);
                } else {
                    copy.splice(i + 1, 0, newNode);
                }
                return { nodes: copy, inserted: true };
            }
            if (nodes[i].children) {
                const result = tryInsert(nodes[i].children!);
                if (result.inserted) {
                    return { nodes: [...nodes.slice(0, i), { ...nodes[i], children: result.nodes }, ...nodes.slice(i + 1)], inserted: true };
                }
            }
        }
        return { nodes, inserted: false };
    };

    const result = tryInsert(tree);
    return result.inserted ? result.nodes : [...tree, newNode];
};

const deleteNode = (tree: JsonTreeNode[], id: string): JsonTreeNode[] => {
    return tree
        .filter(n => n.id !== id)
        .map(n => n.children ? { ...n, children: deleteNode(n.children, id) } : n);
};

const updateNode = (tree: JsonTreeNode[], id: string, patch: Partial<JsonTreeNode>): JsonTreeNode[] => {
    return tree.map(n => {
        if (n.id === id) return { ...n, ...patch };
        if (n.children) return { ...n, children: updateNode(n.children, id, patch) };
        return n;
    });
};

// ── Sub-Components ────────────────────────────────────────────────────────────

interface TreeNodeItemProps {
    node: JsonTreeNode;
    depth: number;
    availableFields: string[];
    onDelete: (id: string) => void;
    onUpdate: (id: string, patch: Partial<JsonTreeNode>) => void;
    onAddChild: (parentId: string, type: JsonNodeType) => void;
    onDropField: (fieldRef: string, targetId: string, position: 'inside' | 'after') => void;
    draggedField: string | null;
}

const TreeNodeItem: React.FC<TreeNodeItemProps> = ({
    node, depth, availableFields, onDelete, onUpdate, onAddChild, onDropField, draggedField
}) => {
    const [isExpanded, setIsExpanded] = useState(true);
    const [editingKey, setEditingKey] = useState(false);
    const [keyValue, setKeyValue] = useState(node.key);
    const [isDragOver, setIsDragOver] = useState<'inside' | 'after' | null>(null);

    const isContainer = node.type === 'object' || node.type === 'array';

    const handleDragOver = (e: React.DragEvent) => {
        if (!draggedField) return;
        e.preventDefault();
        e.stopPropagation();
        if (isContainer) {
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            const relY = e.clientY - rect.top;
            setIsDragOver(relY < rect.height * 0.6 ? 'inside' : 'after');
        } else {
            setIsDragOver('after');
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!draggedField || !isDragOver) return;
        onDropField(draggedField, node.id, isDragOver);
        setIsDragOver(null);
    };

    const iconName = node.type === 'object' ? 'data_object' : node.type === 'array' ? 'data_array' : 'table_rows';
    const iconColor = node.type === 'object'
        ? 'text-violet-400'
        : node.type === 'array'
            ? 'text-amber-400'
            : 'text-brand';

    const bgClass = isDragOver === 'inside'
        ? 'ring-1 ring-brand bg-brand/5'
        : isDragOver === 'after'
            ? 'ring-1 ring-brand/40'
            : '';

    return (
        <div style={{ marginLeft: depth > 0 ? 16 : 0 }}>
            <div
                className={`group flex items-center gap-1.5 rounded-lg px-2 py-1.5 transition-all cursor-default ${bgClass} hover:bg-[var(--bg-alt)]`}
                onDragOver={handleDragOver}
                onDragLeave={() => setIsDragOver(null)}
                onDrop={handleDrop}
            >
                {/* Expand toggle */}
                {isContainer ? (
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="text-[var(--text-muted)] hover:text-[var(--text-main)] transition-all flex-shrink-0"
                    >
                        <Icon name={isExpanded ? 'expand_more' : 'chevron_right'} size={14} />
                    </button>
                ) : (
                    <div className="w-[14px] flex-shrink-0" />
                )}

                {/* Type icon */}
                <div className={`flex-shrink-0 ${iconColor}`}>
                    <Icon name={iconName} size={14} />
                </div>

                {/* Key name */}
                {editingKey ? (
                    <input
                        autoFocus
                        value={keyValue}
                        onChange={e => setKeyValue(e.target.value)}
                        onBlur={() => { onUpdate(node.id, { key: keyValue }); setEditingKey(false); }}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') { onUpdate(node.id, { key: keyValue }); setEditingKey(false); } }}
                        className="flex-1 text-xs bg-[var(--bg-app)] border border-brand/40 rounded px-1.5 py-0.5 outline-none text-[var(--text-main)]"
                    />
                ) : (
                    <span
                        className="flex-1 text-xs font-normal text-[var(--text-main)] truncate cursor-text"
                        onDoubleClick={() => { setKeyValue(node.key); setEditingKey(true); }}
                        title="Double-click to rename"
                    >
                        {node.key}
                        {node.type === 'field' && node.fieldRef && node.fieldRef !== node.key && (
                            <span className={`ml-2 text-[10px] text-[var(--text-muted)] ${UI_CONSTANTS.CODE_EDITOR_CLASS}`}>{node.fieldRef}</span>
                        )}
                    </span>
                )}

                {/* Type badges */}
                <span className={`text-[9px] font-normal px-1.5 py-0.5 rounded flex-shrink-0 ${
                    node.type === 'object' ? 'bg-violet-500/10 text-violet-400'
                    : node.type === 'array' ? 'bg-amber-500/10 text-amber-400'
                    : 'bg-brand/10 text-brand'
                }`}>
                    {node.type === 'object' ? '{}' : node.type === 'array' ? '[]' : 'val'}
                </span>

                {/* Actions */}
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0">
                    {isContainer && (
                        <>
                            <button
                                onClick={() => onAddChild(node.id, 'object')}
                                title="Add Object inside"
                                className="p-1 rounded hover:bg-violet-500/10 text-[var(--text-muted)] hover:text-violet-400 transition-all"
                            >
                                <Icon name="data_object" size={12} />
                            </button>
                            <button
                                onClick={() => onAddChild(node.id, 'array')}
                                title="Add Array inside"
                                className="p-1 rounded hover:bg-amber-500/10 text-[var(--text-muted)] hover:text-amber-400 transition-all"
                            >
                                <Icon name="data_array" size={12} />
                            </button>
                        </>
                    )}
                    <button
                        onClick={() => onDelete(node.id)}
                        title="Remove node"
                        className="p-1 rounded hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-400 transition-all"
                    >
                        <Icon name="close" size={12} />
                    </button>
                </div>
            </div>

            {/* Children */}
            {isContainer && isExpanded && node.children && node.children.length > 0 && (
                <div className="border-l border-[var(--border-base)]/60 ml-5 mt-0.5">
                    {node.children.map(child => (
                        <TreeNodeItem
                            key={child.id}
                            node={child}
                            depth={depth + 1}
                            availableFields={availableFields}
                            onDelete={onDelete}
                            onUpdate={onUpdate}
                            onAddChild={onAddChild}
                            onDropField={onDropField}
                            draggedField={draggedField}
                        />
                    ))}
                </div>
            )}

            {isContainer && isExpanded && (!node.children || node.children.length === 0) && (
                <div
                    className={`ml-5 mt-0.5 border-l border-[var(--border-base)]/60 px-3 py-2 text-[10px] italic text-[var(--text-muted)] transition-all ${
                        isDragOver === 'inside' ? 'bg-brand/5 text-brand' : ''
                    }`}
                    onDragOver={e => { if (draggedField) { e.preventDefault(); setIsDragOver('inside'); }}}
                    onDragLeave={() => setIsDragOver(null)}
                    onDrop={e => { e.preventDefault(); if (draggedField) { onDropField(draggedField, node.id, 'inside'); setIsDragOver(null); }}}
                >
                    Drop fields here…
                </div>
            )}
        </div>
    );
};

// ── Main Component ────────────────────────────────────────────────────────────

export interface JsonBuilderViewProps {
    jsonTree: JsonTreeNode[];
    onChange: (tree: JsonTreeNode[]) => void;
    /** Full multi-query state for SQL preview generation */
    queryState: MultiQueryState;
    /** Flat list of selectable fields: alias or "tableAlias.column" */
    availableFields: string[];
}

export const JsonBuilderView: React.FC<JsonBuilderViewProps> = ({
    jsonTree,
    onChange,
    queryState,
    availableFields,
}) => {
    const [draggedField, setDraggedField] = useState<string | null>(null);
    const [rootDragOver, setRootDragOver] = useState(false);
    const rootDropRef = useRef<HTMLDivElement>(null);

    // ── Tree mutation helpers ──────────────────────────────────────────────────

    const handleDelete = useCallback((id: string) => {
        onChange(deleteNode(jsonTree, id));
    }, [jsonTree, onChange]);

    const handleUpdate = useCallback((id: string, patch: Partial<JsonTreeNode>) => {
        onChange(updateNode(jsonTree, id, patch));
    }, [jsonTree, onChange]);

    const handleAddChild = useCallback((parentId: string, type: JsonNodeType) => {
        const newNode: JsonTreeNode = {
            id: makeId(),
            key: type === 'object' ? 'object' : 'items',
            type,
            children: [],
        };
        onChange(updateNode(jsonTree, parentId, {
            // We need to append to children, not overwrite
        } as any));
        // Re-implement inline for children append
        const appendChild = (nodes: JsonTreeNode[]): JsonTreeNode[] =>
            nodes.map(n => {
                if (n.id === parentId) return { ...n, children: [...(n.children || []), newNode] };
                if (n.children) return { ...n, children: appendChild(n.children) };
                return n;
            });
        onChange(appendChild(jsonTree));
    }, [jsonTree, onChange]);

    // ── Drop a field from left panel ──────────────────────────────────────────

    const handleDropField = useCallback((fieldRef: string, targetId: string, position: 'inside' | 'after') => {
        const label = fieldRef.includes('.') ? fieldRef.split('.').pop()! : fieldRef;
        const newNode: JsonTreeNode = {
            id: makeId(),
            key: label,
            type: 'field',
            fieldRef,
        };
        onChange(insertNode(jsonTree, newNode, targetId, position));
    }, [jsonTree, onChange]);

    // Drop onto root zone (append)
    const handleRootDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setRootDragOver(false);
        if (!draggedField) return;
        const label = draggedField.includes('.') ? draggedField.split('.').pop()! : draggedField;
        const newNode: JsonTreeNode = {
            id: makeId(),
            key: label,
            type: 'field',
            fieldRef: draggedField,
        };
        onChange([...jsonTree, newNode]);
    };

    // Add root container
    const handleAddRoot = (type: JsonNodeType) => {
        const newNode: JsonTreeNode = {
            id: makeId(),
            key: type === 'object' ? 'root' : 'items',
            type,
            children: [],
        };
        onChange([...jsonTree, newNode]);
    };

    // ── SQL preview ───────────────────────────────────────────────────────────

    // Generate preview from queryState with jsonTree injected
    const previewSql = (() => {
        if (jsonTree.length === 0) return null;
        try {
            const { generateJsonSQL: gen } = { generateJsonSQL };
            return gen({ ...queryState, jsonTree });
        } catch {
            return null;
        }
    })();

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div className="flex flex-col h-full gap-0">
            {/* JSON mode active badge */}
            {jsonTree.length > 0 && (
                <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 flex-shrink-0">
                    <Icon name="data_object" size={14} className="text-amber-500" />
                    <span className="text-[10px] font-normal text-amber-600 dark:text-amber-400">
                        JSON mode active — report will output nested JSON instead of a table
                    </span>
                    <button
                        onClick={() => onChange([])}
                        className="ml-auto text-[10px] text-amber-500 hover:text-red-500 transition-all flex items-center gap-1"
                    >
                        <Icon name="close" size={12} />
                        Clear all (revert to table)
                    </button>
                </div>
            )}

            <div className="flex flex-1 min-h-0">
                {/* LEFT: Available fields */}
                <div className="w-56 flex-shrink-0 border-r border-[var(--border-base)] flex flex-col bg-[var(--bg-alt)]">
                    <div className="px-3 py-2 border-b border-[var(--border-base)]/50 flex-shrink-0">
                        <h4 className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-2">
                            <Icon name="table_rows" size={12} className="text-brand" />
                            Available Fields
                        </h4>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
                        {availableFields.length === 0 ? (
                            <p className="text-[10px] text-[var(--text-muted)] italic p-2">
                                Select fields in the Tables tab first.
                            </p>
                        ) : (
                            availableFields.map(field => (
                                <div
                                    key={field}
                                    draggable
                                    onDragStart={() => setDraggedField(field)}
                                    onDragEnd={() => setDraggedField(null)}
                                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-grab active:cursor-grabbing hover:bg-brand/5 border border-transparent hover:border-brand/20 transition-all group"
                                >
                                    <Icon name="drag_indicator" size={12} className="text-[var(--text-muted)] opacity-50 group-hover:opacity-100" />
                                    <Icon name="table_rows" size={12} className="text-brand/60" />
                                    <span className={`text-xs text-[var(--text-main)] truncate ${UI_CONSTANTS.CODE_EDITOR_CLASS}`}>{field}</span>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* RIGHT: JSON Tree */}
                <div className="flex-1 flex flex-col min-w-0 bg-[var(--bg-app)]">
                    {/* Tree header toolbar */}
                    <div className="px-4 py-2 border-b border-[var(--border-base)]/50 flex items-center gap-2 flex-shrink-0">
                        <h4 className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-2 mr-auto">
                            <Icon name="account_tree" size={12} className="text-brand" />
                            JSON Structure
                        </h4>
                        <button
                            onClick={() => handleAddRoot('object')}
                            title="Add Object node at root"
                            className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-normal bg-violet-500/10 text-violet-500 hover:bg-violet-500/20 transition-all border border-violet-500/20"
                        >
                            <Icon name="data_object" size={12} />
                            + Object
                        </button>
                        <button
                            onClick={() => handleAddRoot('array')}
                            title="Add Array node at root"
                            className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-normal bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 transition-all border border-amber-500/20"
                        >
                            <Icon name="data_array" size={12} />
                            + Array
                        </button>
                    </div>

                    {/* Tree body */}
                    <div
                        ref={rootDropRef}
                        className={`flex-1 overflow-y-auto p-3 transition-all ${
                            rootDragOver ? 'bg-brand/5' : ''
                        }`}
                        onDragOver={e => { if (draggedField) { e.preventDefault(); setRootDragOver(true); }}}
                        onDragLeave={e => {
                            if (!rootDropRef.current?.contains(e.relatedTarget as Node)) setRootDragOver(false);
                        }}
                        onDrop={handleRootDrop}
                    >
                        {jsonTree.length === 0 ? (
                            <div className={`h-full flex flex-col items-center justify-center gap-3 p-8 rounded-xl border-2 border-dashed transition-all ${
                                rootDragOver ? 'border-brand bg-brand/5' : 'border-[var(--border-base)]'
                            }`}>
                                <Icon name="account_tree" size={32} className="text-[var(--text-muted)] opacity-30" />
                                <p className="text-xs text-[var(--text-muted)] text-center">
                                    <strong className="text-[var(--text-main)]">Drag fields</strong> from the left panel,<br />
                                    or <strong className="text-[var(--text-main)]">add Object / Array</strong> containers above.
                                </p>
                                <p className="text-[10px] text-[var(--text-muted)] italic">
                                    When empty, the report uses normal tabular SQL.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-0.5">
                                {jsonTree.map(node => (
                                    <TreeNodeItem
                                        key={node.id}
                                        node={node}
                                        depth={0}
                                        availableFields={availableFields}
                                        onDelete={handleDelete}
                                        onUpdate={handleUpdate}
                                        onAddChild={handleAddChild}
                                        onDropField={handleDropField}
                                        draggedField={draggedField}
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    {/* SQL Preview strip */}
                    {previewSql && (
                        <div className="border-t border-[var(--border-base)] bg-[var(--bg-alt)] flex-shrink-0">
                            <div className="px-4 py-1.5 flex items-center gap-2 border-b border-[var(--border-base)]/50">
                                <Icon name="sql" size={12} className="text-[var(--text-muted)]" />
                                <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Generated SQL Preview</span>
                            </div>
                            <pre className={`px-4 py-3 text-[var(--text-muted)] overflow-x-auto max-h-40 whitespace-pre leading-relaxed ${UI_CONSTANTS.CODE_EDITOR_CLASS}`}>
                                {previewSql}
                            </pre>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
