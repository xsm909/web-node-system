import React, { useEffect, useRef } from 'react';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import 'tabulator-tables/dist/css/tabulator.min.css';
import './AppTabulatorTable.css';

interface AppTabulatorTableProps {
    data: any[];
    columns?: any[];
    height?: string | number;
}

export const AppTabulatorTable: React.FC<AppTabulatorTableProps> = ({ 
    data, 
    columns: manualColumns, 
    height = "100%" 
}) => {
    const tableRef = useRef<HTMLDivElement>(null);
    const tabulatorInstance = useRef<Tabulator | null>(null);

    useEffect(() => {
        if (!tableRef.current) return;

        // Auto-generate columns if none provided
        const formatter = (cell: any) => {
            const val = cell.getValue();
            if (typeof val === 'object' && val !== null) {
                return JSON.stringify(val);
            }
            return String(val ?? '');
        };

        const columns = manualColumns || (data.length > 0 ? Object.keys(data[0]).map(key => ({
            title: key,
            field: key,
            headerHozAlign: "left" as const,
            hozAlign: "left" as const,
            formatter: formatter,
            headerSort: true,
            resizable: true,
            minWidth: 100
        })) : []);

        const table = new Tabulator(tableRef.current, {
            data: data,
            columns: columns,
            layout: "fitDataFill",
            height: height,
            movableColumns: true,
            resizableColumnFit: true,
            keybindings: {
                "navPrev": "shift + 9",
                "navNext": "9",
                "navUp": "38",
                "navDown": "40",
                "navLeft": "37",
                "navRight": "39",
            },
            selectableRows: true,
            selectableRange: true,
            selectableRangeColumns: true,
            selectableRangeRows: true,
            clipboard: "copy",
            columnDefaults: {
                tooltip: true,
                headerSort: true,
                formatter: formatter,
            },
            placeholder: "No data available",
        });

        tabulatorInstance.current = table;

        return () => {
            if (tabulatorInstance.current) {
                tabulatorInstance.current.destroy();
                tabulatorInstance.current = null;
            }
        };
    }, []);

    // Update data when it changes
    useEffect(() => {
        if (tabulatorInstance.current) {
            tabulatorInstance.current.setData(data);
        }
    }, [data]);

    return (
        <div className="app-tabulator-container h-full w-full">
            <div ref={tableRef} className="h-full w-full" />
        </div>
    );
};
