import { useMemo, useState } from 'react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
} from '@dnd-kit/core';
import {
    sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import {
    useReactTable,
    getCoreRowModel,
    flexRender,
} from '@tanstack/react-table';
import { AppTableDataRow } from './components/AppTableDataRow';
import { AppTableCategoryRows, type TWithCategory } from './components/AppTableCategoryRows';
import { buildCategoryTree } from '../../lib/categoryUtils';
import { getCookie, setCookie } from '../../lib/cookieUtils';
import type { AppTableProps } from './types';
import { UI_CONSTANTS } from '../constants';

export function AppTable<TData extends { id: string | number | any }>({
    data,
    columns,
    config,
    isLoading,
    onRowClick,
    isSearching
}: AppTableProps<TData>) {
    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
    });

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

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            const activeItem = data.find(item => String(item.id) === String(active.id));
            if (activeItem && config?.onReorder) {
                // Find all items in the same group as the active item
                const category = config.categoryExtractor?.(activeItem) || null;
                const itemsInGroup = data.filter(item => (config.categoryExtractor?.(item) || null) === category);
                
                const oldIndex = itemsInGroup.findIndex(item => String(item.id) === String(active.id));
                const newIndex = itemsInGroup.findIndex(item => String(item.id) === String(over.id));
                
                if (oldIndex !== -1 && newIndex !== -1) {
                    const newOrder = [...itemsInGroup];
                    const [movedItem] = newOrder.splice(oldIndex, 1);
                    newOrder.splice(newIndex, 0, movedItem);
                    config.onReorder(activeItem, newOrder);
                }
            }
        }
    };

    const persistKey = config?.persistCategoryKey || 'app_table_expanded_categories';

    // Persistence for expanded categories
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(() => {
        const saved = getCookie(persistKey);
        if (saved) return new Set(JSON.parse(saved));
        return new Set();
    });

    const toggleCategory = (path: string) => {
        setExpandedCategories(prev => {
            const next = new Set(prev);
            if (next.has(path)) next.delete(path);
            else next.add(path);
            setCookie(persistKey, JSON.stringify(Array.from(next)));
            return next;
        });
    };

    const treeData = useMemo(() => {
        if (isSearching || !config?.categoryExtractor) return null;

        const rows = table.getRowModel().rows;
        const mapped: TWithCategory<TData>[] = rows.map(row => ({
            original: row.original,
            row,
            category: config.categoryExtractor!(row.original) || null
        }));

        return buildCategoryTree(mapped);
    }, [table.getRowModel().rows, isSearching, config?.categoryExtractor]);

    const tableContent = (
        <table className={`w-full text-left border-collapse ${config?.layout === 'compact' ? 'min-w-max' : ''}`}>
            <thead className="sticky top-0 z-10 bg-surface-800 shadow-sm border-b border-brand/20">
                {table.getHeaderGroups().map(headerGroup => (
                    <tr key={headerGroup.id} className="bg-brand">
                        {headerGroup.headers.map((header) => (
                            <th 
                                key={header.id} 
                                className={`
                                    ${UI_CONSTANTS.TABLE_HEADER_PY} text-[11px] font-medium text-white uppercase tracking-widest
                                    ${UI_CONSTANTS.TABLE_CELL_PX}
                                `}
                            >
                                {flexRender(header.column.columnDef.header, header.getContext())}
                            </th>
                        ))}
                    </tr>
                ))}
            </thead>
            <tbody className="divide-y divide-[var(--border-base)]/30">
                {isLoading && data.length === 0 ? (
                    <tr>
                        <td colSpan={columns.length} className={`${UI_CONSTANTS.TABLE_CELL_PX} py-8 text-center text-[var(--text-muted)]`}>
                            <div className="flex justify-center flex-col items-center gap-4">
                                <div className="w-8 h-8 rounded-full border-2 border-[var(--border-base)] border-t-brand animate-spin" />
                                <span className="text-sm">Loading data...</span>
                            </div>
                        </td>
                    </tr>
                ) : data.length === 0 ? (
                    <tr>
                        <td colSpan={columns.length} className={`${UI_CONSTANTS.TABLE_CELL_PX} py-8 text-center text-[var(--text-muted)] italic opacity-50`}>
                            {config?.emptyMessage || "No matches found."}
                        </td>
                    </tr>
                ) : treeData ? (
                    <AppTableCategoryRows
                        name="Uncategorized"
                        node={treeData}
                        path=""
                        level={-1}
                        expandedCategories={expandedCategories}
                        onToggle={toggleCategory}
                        onRowClick={onRowClick}
                        config={config}
                        colSpan={columns.length}
                    />
                ) : (
                    table.getRowModel().rows.map(row => (
                        <AppTableDataRow
                            key={row.id}
                            row={row}
                            onClick={onRowClick}
                            config={config}
                        />
                    ))
                )}
            </tbody>
        </table>
    );

    const renderContent = () => {
        if (config?.onReorder) {
            return (
                <DndContext 
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                >
                    {tableContent}
                </DndContext>
            );
        }
        return tableContent;
    };

    return (
        <div className="flex flex-col flex-1 min-h-0 w-full animate-in fade-in duration-300 overflow-hidden">
            <div className="flex-1 overflow-auto custom-scrollbar">
                {renderContent()}
            </div>
        </div>
    );
}
