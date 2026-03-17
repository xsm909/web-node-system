import { flexRender, type Row } from '@tanstack/react-table';
import type { AppTableConfig } from '../types';

interface AppTableDataRowProps<TData> {
    row: Row<TData>;
    onClick?: (row: TData) => void;
    level?: number;
    config?: AppTableConfig<TData>;
}

export function AppTableDataRow<TData>({ row, onClick, level = 0, config }: AppTableDataRowProps<TData>) {
    const isClickable = !!onClick;
    const customClass = config?.rowClassName ? config.rowClassName(row.original) : '';

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
                const isFirstCell = index === 0;

                return (
                    <td
                        key={cell.id}
                        className={`py-2 text-sm ${isFirstCell ? 'w-px whitespace-nowrap pl-4 pr-0' : 'px-6'}`}
                        style={isIndentCell && level > 0 ? { paddingLeft: `${1 + level * 1}rem` } : undefined}
                    >
                        {cellContent}
                    </td>
                );
            })}
        </tr>
    );
}
