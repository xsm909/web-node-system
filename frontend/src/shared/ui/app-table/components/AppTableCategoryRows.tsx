import type { Row } from '@tanstack/react-table';
import { Icon } from '../../icon';
import type { CategoryTreeNode } from '../../../lib/categoryUtils';
import { AppTableDataRow } from './AppTableDataRow';
import type { AppTableConfig } from '../types';

export type TWithCategory<TData> = {
    original: TData;
    row: Row<TData>;
    category: string | null;
    key?: string;
    name?: string;
};

interface AppTableCategoryRowsProps<TData> {
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

export function AppTableCategoryRows<TData>({
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
                    <tr className="bg-[var(--border-muted)]/10 border-l-2 border-[var(--border-base)]">
                        <td colSpan={colSpan} className="px-6 py-1.5 opacity-40">
                            <div className="flex items-center gap-2">
                                <Icon name="folder_open" size={14} />
                                <span className="text-[10px] font-bold uppercase tracking-widest">Uncategorized</span>
                            </div>
                        </td>
                    </tr>
                )}
                {node.nodes.map(item => (
                    <AppTableDataRow
                        key={item.row.id}
                        row={item.row}
                        onClick={onRowClick}
                        level={0}
                        config={config}
                    />
                ))}
            </>
        );
    }

    return (
        <>
            <tr
                className="bg-[var(--border-muted)]/20 hover:bg-[var(--border-muted)]/40 cursor-pointer transition-colors border-l-2 border-brand/30"
                onClick={() => onToggle(path)}
            >
                <td colSpan={colSpan} className="px-6 py-2" style={{ paddingLeft: `${1.5 + level * 1.5}rem` }}>
                    <div className="flex items-center gap-2">
                        <Icon
                            name={isExpanded ? 'keyboard_arrow_down' : 'keyboard_arrow_right'}
                            size={18}
                            className="text-[var(--text-muted)] opacity-60"
                        />
                        <Icon name="folder" size={16} className="text-brand/70" />
                        <span className="text-xs font-bold text-[var(--text-main)] opacity-70 uppercase tracking-wider">{node.name}</span>
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
                    {node.nodes.map(item => (
                        <AppTableDataRow
                            key={item.row.id}
                            row={item.row}
                            onClick={onRowClick}
                            level={level + 1}
                            config={config}
                        />
                    ))}
                </>
            )}
        </>
    );
}
