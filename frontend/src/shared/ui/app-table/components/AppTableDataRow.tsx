import { flexRender, type Row } from '@tanstack/react-table';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { AppTableConfig } from '../types';

interface AppTableDataRowProps<TData> {
    row: Row<TData>;
    onClick?: (row: TData) => void;
    level?: number;
    config?: AppTableConfig<TData>;
}

export function AppTableDataRow<TData extends { id: string | number | any }>({ row, onClick, level = 0, config }: AppTableDataRowProps<TData>) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: String((row.original as any).id) });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : undefined,
        position: isDragging ? 'relative' : undefined,
        opacity: isDragging ? 0.5 : undefined,
    } as React.CSSProperties;

    const isClickable = !!onClick;
    const customClass = config?.rowClassName ? config.rowClassName(row.original) : '';

    return (
        <tr
            ref={setNodeRef}
            style={style}
            onClick={() => onClick?.(row.original)}
            className={`
                group transition-all duration-200
                even:bg-slate-500/[0.02]
                ${isDragging ? 'bg-surface-700 shadow-xl ring-1 ring-brand/50 z-50' : ''}
                ${isClickable ? 'cursor-pointer hover:bg-surface-700/30' : ''}
                ${customClass}
            `}
            {...attributes}
            {...listeners}
        >
            {row.getVisibleCells().map((cell, index) => {
                const isIndentCell = config?.indentColumnId 
                    ? cell.column.id === config.indentColumnId 
                    : index === 0;
                let cellContent = flexRender(cell.column.columnDef.cell, cell.getContext());
                const isActions = cell.column.id === 'actions';

                return (
                    <td
                        key={cell.id}
                        className={`
                            text-sm transition-all
                            ${isIndentCell ? 'px-4' : 'px-6'}
                            ${config?.layout === 'compact' ? 'whitespace-nowrap overflow-hidden text-ellipsis max-w-[300px] h-10 py-0' : 'py-2'}
                        `}
                        style={isIndentCell && level > 0 ? { paddingLeft: `${1 + level * 1.5}rem` } : undefined}
                    >
                        <div className={`
                            flex items-center gap-2 w-full h-full
                            ${isActions ? 'justify-end' : 'justify-start'}
                        `}>
                            <div className="flex-1 min-w-0">
                                {cellContent}
                            </div>
                        </div>
                    </td>
                );
            })}
        </tr>
    );
}
