import { flexRender, type Row } from '@tanstack/react-table';
import type { AppTableConfig } from '../types';
import { Icon } from '../../icon/Icon';

interface AppTableDataRowProps<TData> {
    row: Row<TData>;
    onClick?: (row: TData) => void;
    level?: number;
    config?: AppTableConfig<TData>;
}

export function AppTableDataRow<TData>({ row, onClick, level = 0, config }: AppTableDataRowProps<TData>) {
    const isClickable = !!onClick;
    const customClass = config?.rowClassName ? config.rowClassName(row.original) : '';
    const isLocked = (row.original as any)?.is_locked;

    return (
        <tr
            onClick={() => onClick?.(row.original)}
            className={`
                group transition-colors border-transparent
                even:bg-slate-500/[0.02]
                ${isClickable ? 'cursor-pointer hover:bg-surface-700/30' : ''}
                ${customClass}
            `}
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
                            {isIndentCell && (
                                <div className="flex items-center justify-center w-5 h-5 flex-shrink-0">
                                    {isLocked && (
                                        <Icon 
                                            name="lock" 
                                            size={16} 
                                            className="text-amber-500" 
                                        />
                                    )}
                                </div>
                            )}
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
