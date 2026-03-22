import React, { useState, useMemo } from 'react';
import type { NodeType } from '../../../entities/node-type/model/types';
import { Icon } from '../../../shared/ui/icon/Icon';
import { AppInput } from '../../../shared/ui/app-input';
import { buildCategoryTree, type CategoryTreeNode } from '../../../shared/lib/categoryUtils';

import { getCookie, setCookie } from '../../../shared/lib/cookieUtils';

interface NodeLibraryProps {
    nodeTypes: NodeType[];
    onAddNode: (node: NodeType) => void;
}

export const NodeLibrary: React.FC<NodeLibraryProps> = ({ nodeTypes, onAddNode }) => {
    const [searchQuery, setSearchQuery] = useState('');

    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(() => {
        const saved = getCookie('manager_node_expanded_categories');
        if (saved) return new Set(JSON.parse(saved));
        return new Set();
    });

    const toggleCategory = (path: string) => {
        setExpandedCategories(prev => {
            const next = new Set(prev);
            if (next.has(path)) next.delete(path);
            else next.add(path);
            setCookie('manager_node_expanded_categories', JSON.stringify(Array.from(next)));
            return next;
        });
    };

    const filteredNodes = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return nodeTypes;

        return nodeTypes.filter(n => {
            const inName = n.name.toLowerCase().includes(q);
            const inDesc = n.description?.toLowerCase().includes(q);
            const inCategory = n.category?.toLowerCase().includes(q);
            return inName || inDesc || inCategory;
        });
    }, [nodeTypes, searchQuery]);

    const nodeTree = useMemo(() => {
        if (searchQuery.trim()) return null;
        return buildCategoryTree<NodeType>(nodeTypes);
    }, [nodeTypes, searchQuery]);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center px-1">
                <div className="flex items-center gap-4 flex-1">
                    <h2 className="text-xl font-bold tracking-tight whitespace-nowrap text-[var(--text-main)]">Node Library</h2>
                        <AppInput
                            label=""
                            value={searchQuery}
                            onChange={setSearchQuery}
                            placeholder="Search nodes by name, category or description..."
                            icon="search"
                            className="w-full"
                        />

                </div>
            </div>

            <div className="bg-surface-800 rounded-2xl border border-gray-700/50 overflow-hidden shadow-xl shadow-black/10">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-gray-700 bg-surface-900/50">
                            <th className="px-6 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Name</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700/50">
                        {searchQuery.trim() ? (
                            filteredNodes.map(node => (
                                <NodeRow key={node.id} node={node} onClick={onAddNode} />
                            ))
                        ) : (
                            nodeTree && (
                                <CategoryRows
                                    name="Uncategorized"
                                    node={nodeTree}
                                    path=""
                                    level={-1}
                                    expandedCategories={expandedCategories}
                                    onToggle={toggleCategory}
                                    onClickNode={onAddNode}
                                />
                            )
                        )}
                        {filteredNodes.length === 0 && (
                            <tr>
                                <td className="px-6 py-12 text-center text-gray-500 italic text-sm">
                                    No nodes matching your criteria.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

interface NodeRowProps {
    node: NodeType;
    onClick: (node: NodeType) => void;
    level?: number;
}

const NodeRow: React.FC<NodeRowProps> = ({ node, onClick, level = 0 }) => (
    <tr
        onClick={() => onClick(node)}
        className="group hover:bg-brand/5 transition-colors cursor-pointer"
    >
        <td className="px-6 py-4" style={{ paddingLeft: `${1.5 + level * 1.5}rem` }}>
            <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-surface-700 text-brand group-hover:bg-brand group-hover:text-white transition-colors">
                    <Icon name={node.icon || 'function'} dir="node_icons" size={18} />
                </div>
                <div className="flex flex-col min-w-0">
                    <span className="text-sm font-bold text-[var(--text-main)] group-hover:text-brand transition-colors truncate">
                        {node.name}
                    </span>
                    <span className="text-[10px] text-[var(--text-muted)] truncate opacity-60">
                        {node.description}
                    </span>
                </div>
            </div>
        </td>
    </tr>
);

interface CategoryRowsProps {
    name: string;
    node: CategoryTreeNode<NodeType>;
    path: string;
    level: number;
    expandedCategories: Set<string>;
    onToggle: (path: string) => void;
    onClickNode: (node: NodeType) => void;
}

const CategoryRows: React.FC<CategoryRowsProps> = ({
    name,
    node,
    path,
    level,
    expandedCategories,
    onToggle,
    onClickNode
}) => {
    const isRoot = name === "Uncategorized";
    const isExpanded = isRoot || expandedCategories.has(path);

    if (isRoot) {
        return (
            <>
                {Object.entries(node.children).map(([childKey, childNode]) => (
                    <CategoryRows
                        key={childKey}
                        name={childNode.name}
                        node={childNode}
                        path={childNode.name}
                        level={0}
                        expandedCategories={expandedCategories}
                        onToggle={onToggle}
                        onClickNode={onClickNode}
                    />
                ))}
                {node.nodes.length > 0 && (
                    <tr className="bg-surface-900/10 border-l-2 border-gray-700/30">
                        <td className="px-6 py-1.5 opacity-40">
                            <div className="flex items-center gap-2">
                                <Icon name="folder_open" size={14} />
                                <span className="text-[10px] font-bold uppercase tracking-widest">Uncategorized</span>
                            </div>
                        </td>
                    </tr>
                )}
                {node.nodes.map(node => (
                    <NodeRow
                        key={node.id}
                        node={node}
                        onClick={onClickNode}
                        level={0}
                    />
                ))}
            </>
        );
    }

    return (
        <>
            <tr
                className="bg-surface-900/30 hover:bg-surface-700/50 cursor-pointer transition-colors border-l-2 border-brand/30"
                onClick={() => onToggle(path)}
            >
                <td className="px-6 py-2" style={{ paddingLeft: `${1.5 + level * 1.5}rem` }}>
                    <div className="flex items-center gap-2">
                        <Icon
                            name={isExpanded ? 'keyboard_arrow_down' : 'keyboard_arrow_right'}
                            size={14}
                            className="text-gray-500 opacity-60"
                        />
                        <Icon name="folder" size={16} className="text-brand/70" />
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{node.name}</span>
                    </div>
                </td>
            </tr>
            {isExpanded && (
                <>
                    {Object.entries(node.children).map(([childKey, childNode]) => (
                        <CategoryRows
                            key={childKey}
                            name={childNode.name}
                            node={childNode}
                            path={`${path}|${childNode.name}`}
                            level={level + 1}
                            expandedCategories={expandedCategories}
                            onToggle={onToggle}
                            onClickNode={onClickNode}
                        />
                    ))}
                    {node.nodes.map(node => (
                        <NodeRow
                            key={node.id}
                            node={node}
                            onClick={onClickNode}
                            level={level + 1}
                        />
                    ))}
                </>
            )}
        </>
    );
};




