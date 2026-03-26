import {
    SortableContext,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import type { Row } from '@tanstack/react-table';
import { Icon } from '../../icon';
import type { CategoryTreeNode } from '../../../lib/categoryUtils';
import { AppTableDataRow } from './AppTableDataRow';
import type { AppTableConfig } from '../types';

export type TWithCategory<TData extends { id: any }> = {
    original: TData;
    row: Row<TData>;
    category: string | null;
    key?: string;
    name?: string;
};

interface AppTableCategoryRowsProps<TData extends { id: any }> {
    name: string;
    node: CategoryTreeNode<TWithCategory<TData>>;
    path: string;
    level: number;
    expandedCategories: Set<string>;
    onToggle: (path: string) => void;
    onRowClick?: (row: TData) => void;
    config: AppTableConfig<TData>;
    colSpan: number;
}

export function AppTableCategoryRows<TData extends { id: any }>({
    name,
    node,
    path,
    level,
    expandedCategories,
    onToggle,
    onRowClick,
    config,
    colSpan
}: AppTableCategoryRowsProps<TData>) {
    const isRoot = name === "Uncategorized";
    const isExpanded = name === "Uncategorized" || expandedCategories.has(path);

    if (isRoot) {
        return (
            <>
                {Object.entries(node.children).map(([childKey, childNode]) => (
                    <AppTableCategoryRows
                        key={childKey}
                        name={childNode.name}
                        node={childNode}
                        path={childKey}
                        level={0}
                        expandedCategories={expandedCategories}
                        onToggle={onToggle}
                        onRowClick={onRowClick}
                        config={config}
                        colSpan={colSpan}
                    />
                ))}
                {node.nodes.length > 0 && (
                    <tr className="bg-brand/5 border-b border-brand/10">
                        <td colSpan={colSpan} className="px-6 py-1.5 opacity-40">
                            <div className="flex items-center gap-2">
                                <Icon name="folder_open" size={14} />
                                <span className="text-[10px] font-bold uppercase tracking-widest text-brand/80">Uncategorized</span>
                            </div>
                        </td>
                    </tr>
                )}
                <SortableContext 
                    items={node.nodes.map(item => String((item.original as any).id))} 
                    strategy={verticalListSortingStrategy}
                >
                    {node.nodes.map(item => (
                        <AppTableDataRow
                            key={item.row.id}
                            row={item.row}
                            onClick={onRowClick}
                            level={0}
                            config={config}
                        />
                    ))}
                </SortableContext>
            </>
        );
    }

    return (
        <>
            <tr
                className="bg-brand/10 hover:bg-brand/20 cursor-pointer transition-colors border-b border-brand/20 group/row"
                onClick={() => onToggle(path)}
            >
                <td colSpan={colSpan} className="px-6 py-2" style={{ paddingLeft: `${1 + level * 1}rem` }}>
                    <div className="flex items-center gap-2">
                        <Icon
                            name={isExpanded ? 'keyboard_arrow_down' : 'keyboard_arrow_right'}
                            size={18}
                            className="text-[var(--text-muted)] opacity-60"
                        />
                        <Icon name="folder" size={16} className="text-brand/70" />
                        <span className="text-xs font-bold text-brand uppercase tracking-wider">{node.name}</span>
                    </div>
                </td>
            </tr>
            {isExpanded && (
                <>
                    {Object.entries(node.children).map(([childKey, childNode]) => (
                        <AppTableCategoryRows
                            key={childKey}
                            name={childNode.name}
                            node={childNode}
                            path={`${path}|${childKey}`}
                            level={level + 1}
                            expandedCategories={expandedCategories}
                            onToggle={onToggle}
                            onRowClick={onRowClick}
                            config={config}
                            colSpan={colSpan}
                        />
                    ))}
                    <SortableContext 
                        items={node.nodes.map(item => String((item.original as any).id))} 
                        strategy={verticalListSortingStrategy}
                    >
                        {node.nodes.map(item => (
                            <AppTableDataRow
                                key={item.row.id}
                                row={item.row}
                                onClick={onRowClick}
                                level={level + 1}
                                config={config}
                            />
                        ))}
                    </SortableContext>
                </>
            )}
        </>
    );
}
