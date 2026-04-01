import {
    SortableContext,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import type { Row } from '@tanstack/react-table';
import { Icon } from '../../icon';
import type { CategoryTreeNode } from '../../../lib/categoryUtils';
import { AppTableDataRow } from './AppTableDataRow';
import type { AppTableConfig } from '../types';
import { UI_CONSTANTS } from '../../constants';

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
                        <td colSpan={colSpan} className={`${UI_CONSTANTS.TABLE_CELL_PX} py-1 opacity-40`}>
                            <div className="flex items-center gap-2">
                                <Icon name="folder_open" size={14} />
                                <span className={`text-[10px] font-medium uppercase tracking-widest text-brand/80`}>Uncategorized</span>
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
                <td colSpan={colSpan} className={`${UI_CONSTANTS.TABLE_CELL_PX} py-1.5`} style={{ paddingLeft: `${1 + level * 1}rem` }}>
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-1">
                            <Icon
                                name={isExpanded ? 'keyboard_arrow_down' : 'keyboard_arrow_right'}
                                size={18}
                                className="text-[var(--text-muted)] opacity-60"
                            />
                            <Icon name="folder" size={16} className="text-brand/70" />
                            <span className="text-xs font-medium text-brand uppercase tracking-wider">{node.name}</span>
                        </div>
                        
                        {config.categoryActions && (
                            <div className="flex items-center gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity">
                                {config.categoryActions(path, node.nodes.map(n => n.original)).map((action, idx) => (
                                    <button
                                        key={idx}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            action.onClick();
                                        }}
                                        disabled={action.disabled}
                                        className={`flex items-center gap-1 px-2 py-0.5 rounded bg-brand/10 hover:bg-brand/20 text-[10px] font-medium tracking-tight transition-colors ${
                                            action.variant === 'danger' ? 'text-red-500 bg-red-500/10 hover:bg-red-500/20' : 'text-brand'
                                        }`}
                                        title={action.label}
                                    >
                                        <Icon name={action.icon} size={14} />
                                        <span>{action.label}</span>
                                    </button>
                                ))}
                            </div>
                        )}
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
