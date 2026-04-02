import React, { useEffect, useRef, useState } from 'react';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import 'tabulator-tables/dist/css/tabulator.min.css';
import '../../../shared/ui/app-tabulator-table/AppTabulatorTable.css';
import { AppRoundButton } from '../../../shared/ui/app-round-button/AppRoundButton';

interface DataclassField {
    name: string;
    type: 'string' | 'number' | 'boolean';
    label: string;
}

interface DataclassListEditorProps {
    schema: DataclassField[];
    value: any[];
    onChange: (newValue: any[]) => void;
    isReadOnly?: boolean;
    label: string;
}

export const DataclassListEditor: React.FC<DataclassListEditorProps> = ({
    schema,
    value = [],
    onChange,
    isReadOnly = false,
    label
}) => {
    const tableRef = useRef<HTMLDivElement>(null);
    const tabulatorInstance = useRef<Tabulator | null>(null);
    const [isInternalUpdate, setIsInternalUpdate] = useState(false);

    const safeValue = Array.isArray(value) ? value : [];

    useEffect(() => {
        if (!tableRef.current) return;

        const columns: any[] = schema.map(field => ({
            title: field.label,
            field: field.name,
            editor: isReadOnly ? false : (field.type === 'number' ? 'number' : 'input'),
            hozAlign: "left",
            headerHozAlign: "left",
            headerSort: false,
            minWidth: 100,
            vertAlign: "middle",
        }));

        if (!isReadOnly) {
            columns.push({
                title: "",
                field: "__actions",
                width: 40,
                hozAlign: "center",
                headerSort: false,
                resizable: false,
                formatter: () => {
                    // Simulating AppRoundButton size="xs" variant="danger" structure
                    return `
                        <div class="flex items-center justify-center w-full h-full">
                            <div class="delete-row-btn flex items-center justify-center rounded-full transition-all active:scale-95 shrink-0 w-[21px] h-[21px] bg-[var(--bg-app)] border border-red-500/50 text-red-500 hover:bg-red-500/10 cursor-pointer">
                                <svg width="10" height="10" viewBox="0 -960 960 960" fill="currentColor">
                                    <path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z"/>
                                </svg>
                            </div>
                        </div>
                    `;
                },
                cellClick: (_e: any, cell: any) => {
                    cell.getRow().delete();
                    const newData = tabulatorInstance.current?.getData();
                    setIsInternalUpdate(true);
                    onChange(newData || []);
                    setTimeout(() => setIsInternalUpdate(false), 0);
                }
            });
        }

        const table = new Tabulator(tableRef.current, {
            data: safeValue,
            columns: columns,
            layout: "fitColumns",
            responsiveLayout: "collapse",
            placeholder: "No items added",
            height: safeValue.length > 0 ? undefined : 80, 
            headerVisible: true,
        });

        table.on("cellEdited", () => {
            const newData = table.getData();
            setIsInternalUpdate(true);
            onChange(newData);
            setTimeout(() => setIsInternalUpdate(false), 0);
        });

        tabulatorInstance.current = table;

        return () => {
            if (tabulatorInstance.current) {
                tabulatorInstance.current.destroy();
                tabulatorInstance.current = null;
            }
        };
    }, [schema, isReadOnly, label]);

    useEffect(() => {
        if (tabulatorInstance.current && !isInternalUpdate) {
            const currentTabData = tabulatorInstance.current.getData();
            if (JSON.stringify(currentTabData) !== JSON.stringify(safeValue)) {
                tabulatorInstance.current.setData(safeValue);
            }
        }
    }, [safeValue, isInternalUpdate]);

    const handleAddRow = () => {
        if (tabulatorInstance.current) {
            const newRow = schema.reduce((acc, field) => ({ ...acc, [field.name]: field.type === 'number' ? 0 : '' }), {});
            tabulatorInstance.current.addRow(newRow);
            const newData = tabulatorInstance.current.getData();
            setIsInternalUpdate(true);
            onChange(newData);
            setTimeout(() => setIsInternalUpdate(false), 0);
        }
    };

    return (
        <div className="space-y-1.5 group w-full col-span-full mb-4 dataclass-list-editor">
            <div className="flex items-center justify-between px-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] group-focus-within:text-brand transition-colors">
                    {label}
                </label>
                {!isReadOnly && (
                    <div className="flex items-center gap-2">
                        <span className="text-[9px] font-bold uppercase tracking-tighter text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity">
                            Add Row
                        </span>
                        <AppRoundButton
                            icon="add_circle"
                            variant="outline"
                            size="xs"
                            onClick={handleAddRow}
                            title="Add Row"
                        />
                    </div>
                )}
            </div>

            <div className="border border-[var(--border-base)]/50 rounded-lg overflow-hidden bg-surface-900/10 backdrop-blur-sm">
                <div ref={tableRef} className="w-full text-[12px] compact-dataclass-table" />
            </div>

            <style>{`
                .compact-dataclass-table .tabulator-header {
                    background-color: color-mix(in srgb, var(--brand), transparent 90%) !important;
                    color: var(--text-main) !important;
                    border-bottom: 1px solid var(--border-base) !important;
                    font-size: 10px !important;
                }
                .compact-dataclass-table .tabulator-header .tabulator-col {
                    background-color: transparent !important;
                    border-right: 1px solid var(--border-base) !important;
                }
                .compact-dataclass-table .tabulator-header .tabulator-col-title {
                    padding: 4px 8px !important;
                }
                .compact-dataclass-table .tabulator-row {
                    min-height: 28px !important;
                    background-color: transparent !important;
                }
                .compact-dataclass-table .tabulator-cell {
                    padding: 4px 8px !important;
                    border-right: 1px solid var(--border-base) !important;
                }
                .compact-dataclass-table .tabulator-cell[field="__actions"] {
                    padding: 0 !important;
                }
                .dark .compact-dataclass-table .tabulator-row.tabulator-row-even {
                    background-color: rgba(255, 255, 255, 0.01) !important;
                }
                .compact-dataclass-table .tabulator-header .tabulator-col:last-child,
                .compact-dataclass-table .tabulator-cell:last-child {
                    border-right: none !important;
                }
            `}</style>
        </div>
    );
};
