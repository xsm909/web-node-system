import React, { useEffect, useRef } from 'react';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import 'tabulator-tables/dist/css/tabulator.min.css';
import './AppTabulatorTable.css';

interface AppTabulatorTableProps {
    data: any[];
    columns?: any[];
    height?: string | number;
    maxWidth?: number;
}

export const AppTabulatorTable: React.FC<AppTabulatorTableProps> = ({ 
    data, 
    columns: manualColumns, 
    height = "100%",
    maxWidth
}) => {
    const tableRef = useRef<HTMLDivElement>(null);
    const tabulatorInstance = useRef<Tabulator | null>(null);

    useEffect(() => {
        if (!tableRef.current) return;

        // Auto-generate columns if none provided
        const formatter = (cell: any) => {
            const val = cell.getValue();
            const stringVal = (typeof val === 'object' && val !== null) ? JSON.stringify(val) : String(val ?? '');

            const container = document.createElement("div");
            container.className = "cell-copy-container";

            const valSpan = document.createElement("span");
            valSpan.className = "cell-value";
            valSpan.innerText = stringVal;
            container.appendChild(valSpan);

            const btn = document.createElement("button");
            btn.className = "cell-copy-btn";
            btn.title = "Copy to clipboard";
            btn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" height="14px" viewBox="0 -960 960 960" width="14px" fill="currentColor">
                    <path d="M355-240q-30.94 0-52.97-22.03Q280-284.06 280-315v-480q0-30.94 22.03-52.97Q324.06-870 355-870h360q30.94 0 52.97 22.03Q790-825.94 790-795v480q0 30.94-22.03 52.97Q745.94-240 715-240H355Zm0-75h360v-480H355v480ZM205-90q-30.94 0-52.97-22.03Q130-134.06 130-165v-517.5q0-15.5 11-26.5t26.5-11q15.5 0 26.5 11t11 26.5V-165h397.5q15.5 0 26.5 11t11 26.5q0 15.5-11 26.5t-26.5 11H205Zm150-225v-480 480Z"/>
                </svg>
            `;

            btn.onclick = async (e) => {
                e.stopPropagation();
                try {
                    await navigator.clipboard.writeText(stringVal);
                    
                    // Visual feedback
                    const originalHTML = btn.innerHTML;
                    btn.innerHTML = `
                        <svg xmlns="http://www.w3.org/2000/svg" height="14px" viewBox="0 -960 960 960" width="14px" fill="currentColor">
                            <path d="M382-240 154-468l57-57 171 171 367-367 57 57-424 424Z"/>
                        </svg>
                    `;
                    btn.classList.add('copied');
                    
                    setTimeout(() => {
                        btn.innerHTML = originalHTML;
                        btn.classList.remove('copied');
                    }, 2000);
                } catch (err) {
                    console.error('Failed to copy!', err);
                }
            };

            container.appendChild(btn);
            return container;
        };

        const columns = manualColumns || (data.length > 0 ? Object.keys(data[0]).map(key => ({
            title: key,
            field: key,
            headerHozAlign: "left" as const,
            hozAlign: "left" as const,
            formatter: formatter,
            headerSort: true,
            resizable: true,
            minWidth: 100,
            maxWidth: maxWidth
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
                maxWidth: maxWidth
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
