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
                const isFirstCell = index === 0;
                let cellContent = flexRender(cell.column.columnDef.cell, cell.getContext());

                return (
                    <td
                        key={cell.id}
                        className="px-6 py-2 text-sm"
                        style={isFirstCell && level > 0 ? { paddingLeft: `${1.5 + level * 1.5}rem` } : undefined}
                    >
                        {cellContent}
                    </td>
                );
            })}
        </tr>
    );
}
