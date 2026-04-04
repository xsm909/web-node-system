import React, { useEffect, useRef, useState } from 'react';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import 'tabulator-tables/dist/css/tabulator.min.css';
import '../app-tabulator-table/AppTabulatorTable.css';
import { AppRoundButton } from '../app-round-button/AppRoundButton';
import { useHotkeys } from '../../lib/hotkeys/useHotkeys';
import { HOTKEY_LEVEL } from '../../lib/hotkeys/HotkeysContext';

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
    nodeTypeId?: string;
    parameterName?: string;
    allParams?: any;
    fillDataFunc?: string | null;
}

export const DataclassListEditor: React.FC<DataclassListEditorProps> = ({
    schema,
    value = [],
    onChange,
    isReadOnly = false,
    label,
    nodeTypeId,
    parameterName,
    allParams,
    fillDataFunc,
}) => {
    const tableRef = useRef<HTMLDivElement>(null);
    const tabulatorInstance = useRef<Tabulator | null>(null);
    const [isInternalUpdate, setIsInternalUpdate] = useState(false);
    const [isFilling, setIsFilling] = useState(false);
    // Tracks whether a cell editor is currently open
    const [isCellEditing, setIsCellEditing] = useState(false);

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
            minWidth: 80,
            vertAlign: "middle",
            resizable: false,
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
                    return `
                        <div class="flex items-center justify-center w-full h-full">
                            <div class="delete-row-btn flex items-center justify-center rounded-full transition-all active:scale-95 shrink-0 w-[21px] h-[21px] bg-[var(--bg-app)] border border-red-500/50 text-red-500 hover:bg-red-500/10 cursor-pointer">
                                <svg width="10" height="10" viewBox="0 -960 960 960" fill="currentColor">
                                    <path d="M240-460v-40h480v40H240Z"/>
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
            setIsCellEditing(false);
        });

        // 'cellEditing' fires when the user opens a cell editor
        table.on("cellEditing", () => {
            setIsCellEditing(true);
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

    const handleFillData = async () => {
        if (!nodeTypeId || !parameterName || !fillDataFunc) return;

        setIsFilling(true);
        try {
            const { apiClient } = await import('../../../shared/api/client');
            const response = await apiClient.get(`/workflows/node-types/${nodeTypeId}/fill-data/${parameterName}`, {
                params: {
                    fill_func: fillDataFunc,
                    params: JSON.stringify(allParams || {})
                }
            });

            if (Array.isArray(response.data) && response.data.length > 0) {
                setIsInternalUpdate(true);
                onChange(response.data);
                if (tabulatorInstance.current) {
                    tabulatorInstance.current.setData(response.data);
                }
                setTimeout(() => setIsInternalUpdate(false), 0);
            } else if (Array.isArray(response.data) && response.data.length === 0) {
                alert(`The fill function '${fillDataFunc}' returned an empty list. Check if params like 'api_name' are correctly set.`);
            } else {
                alert(`Unexpected response from fill function: ${JSON.stringify(response.data)}`);
            }
        } catch (error: any) {
            console.error("Failed to fill data:", error);
            const errorDetail = error.response?.data?.detail || error.message;
            alert(`Failed to fill data: ${errorDetail}`);
        } finally {
            setIsFilling(false);
        }
    };

    const handleAddRow = () => {
        if (tabulatorInstance.current && !isReadOnly) {
            const defaultItem = schema.reduce((acc, field) => ({
                ...acc,
                [field.name]: field.type === 'number' ? 0 : ""
            }), {});

            tabulatorInstance.current.addRow(defaultItem, true);
            const newData = tabulatorInstance.current.getData();
            setIsInternalUpdate(true);
            onChange(newData);
            setTimeout(() => setIsInternalUpdate(false), 0);

            // Auto-edit first cell of the new row
            const rows = tabulatorInstance.current.getRows();
            if (rows.length > 0) {
                const rowComponent = rows[0];
                setTimeout(() => {
                    const cells = rowComponent.getCells();
                    if (cells.length > 0) {
                        cells[0].edit();
                    }
                }, 64);
            }
        }
    };

    /**
     * While a Tabulator cell editor is open, register an exclusive OVERLAY scope.
     * This blocks higher-priority hotkeys from parent layers (e.g. Enter → modal submit,
     * Esc → modal close) so the user can freely type and commit/cancel the cell.
     * Tabulator handles Enter and Esc natively via its own DOM keydown listeners;
     * we only need the scope to be registered so those keys don't propagate upward.
     */
    useHotkeys(
        [
            {
                key: 'enter',
                description: 'Confirm cell edit',
                // preventDefault:false — let Tabulator's native keydown handler commit the cell.
                // We register this scope only to block the parent modal's Enter (→ submit).
                preventDefault: false,
                stopPropagation: false,
                handler: () => { /* Tabulator handles this natively */ },
            },
            {
                key: 'escape',
                description: 'Cancel cell edit',
                // preventDefault:false — let Tabulator's native keydown handler cancel the cell.
                // We register this scope only to block the parent modal's Esc (→ close).
                preventDefault: false,
                stopPropagation: false,
                handler: () => {
                    setIsCellEditing(false);
                },
            },
        ],
        {
            scopeName: 'DataclassListEditor-CellEdit',
            level: HOTKEY_LEVEL.OVERLAY,
            exclusive: true,
            enabled: isCellEditing,
        }
    );

    return (
        <div className="space-y-1 group w-full col-span-full mb-4 dataclass-list-editor animate-in fade-in slide-in-from-top-1 duration-300">
            <div className="flex items-center justify-between px-0">
                <label className="text-[8px] font-normal uppercase tracking-[0.15em] text-[var(--text-muted)] group-focus-within:text-[var(--brand)] opacity-80 transition-all">
                    {label}
                </label>
                <div className="flex items-center gap-1">
                    {fillDataFunc && !isReadOnly && (
                        <AppRoundButton
                            icon="filldown"
                            variant="outline"
                            size="xs"
                            onClick={handleFillData}
                            isLoading={isFilling}
                            title={`Fill using ${fillDataFunc}`}
                            className="transition-opacity text-brand"
                        />
                    )}
                    {!isReadOnly && (
                        <AppRoundButton
                            icon="add_st"
                            variant="outline"
                            size="xs"
                            onClick={handleAddRow}
                            title="Add Row"
                            className="transition-opacity"
                        />
                    )}
                </div>
            </div>

            <div
                ref={tableRef}
                className="w-full text-[12px] compact-dataclass-table overflow-hidden border-b border-[var(--border-base)]/60"
            />

            <style>{`
                .compact-dataclass-table {
                    background: transparent !important;
                    border: none !important;
                    max-height: 320px;
                    height: auto !important;
                    min-height: 32px;
                    margin-top: 8px;
                }
                .compact-dataclass-table .tabulator-header {
                    background-color: transparent !important;
                    color: var(--text-muted) !important;
                    border-bottom: 1px solid var(--border-base) !important;
                    border-top: none !important;
                    min-height: 18px !important;
                    height: 18px !important;
                }
                .compact-dataclass-table .tabulator-header .tabulator-col {
                    background-color: transparent !important;
                    border-right: none !important;
                    height: 18px !important;
                }
                .compact-dataclass-table .tabulator-header .tabulator-col-content {
                    padding: 0 4px !important;
                    height: 18px !important;
                    display: flex !important;
                    align-items: center !important;
                }
                .compact-dataclass-table .tabulator-header .tabulator-col-title {
                    text-transform: uppercase !important;
                    font-size: 8px !important;
                    letter-spacing: 0.15em !important;
                    font-weight: 700 !important;
                    line-height: normal !important;
                }
                .compact-dataclass-table .tabulator-placeholder {
                    background: transparent !important;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 8px 0 !important;
                }
                .compact-dataclass-table .tabulator-placeholder span {
                    color: var(--text-muted);
                    font-size: 10px;
                    letter-spacing: 0.1em;
                    text-transform: uppercase;
                }
                .compact-dataclass-table .tabulator-row {
                    background: transparent !important;
                    border-bottom: 1px solid var(--border-base) !important;
                    min-height: 32px !important;
                }
                .compact-dataclass-table .tabulator-row .tabulator-cell {
                    padding: 4px 6px !important;
                    display: flex;
                    align-items: center;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: var(--border-base);
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: var(--brand);
                }
                }
                .compact-dataclass-table .tabulator-header .tabulator-col {
                    background-color: transparent !important;
                    border-right: none !important;
                }
                .compact-dataclass-table .tabulator-header .tabulator-col-content {
                    padding: 2px 0 !important;
                }
                .compact-dataclass-table .tabulator-header .tabulator-col-title {
                    font-size: 8px !important;
                    font-weight: 400 !important;
                    text-transform: uppercase !important;
                    letter-spacing: 0.15em !important;
                    color: var(--text-muted) !important;
                }
                .compact-dataclass-table .tabulator-row {
                    min-height: 26px !important;
                    background-color: transparent !important;
                    border-bottom: none !important;
                    display: flex !important;
                    align-items: center !important;
                }
                .compact-dataclass-table .tabulator-row.tabulator-row-even {
                    background-color: rgba(var(--brand), 0.03) !important;
                }
                .compact-dataclass-table .tabulator-row:last-child {
                    border-bottom: none !important;
                }
                .compact-dataclass-table .tabulator-cell {
                    padding: 4px 0 !important;
                    border-right: none !important;
                    display: flex !important;
                    align-items: center !important;
                    height: 26px !important;
                    color: var(--text-main) !important;
                }
                .compact-dataclass-table .tabulator-cell.tabulator-editing {
                    padding: 0 !important;
                }
                .compact-dataclass-table .tabulator-cell.tabulator-editing input {
                    border: none !important;
                    padding: 0 4px !important;
                    margin: 0 !important;
                    background: var(--bg-app) !important;
                    color: var(--text-main) !important;
                    font-size: 12px !important;
                    width: 100% !important;
                    height: 26px !important;
                    outline: none !important;
                    box-shadow: inset 0 0 0 1px var(--brand) !important;
                    z-index: 50;
                    position: relative;
                }
                .compact-dataclass-table .tabulator-cell[field="__actions"] {
                    padding: 0 !important;
                }
                .compact-dataclass-table .tabulator-placeholder {
                    background-color: transparent !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    min-height: 26px !important;
                    height: 26px !important;
                    border: none !important;
                    padding: 0 !important;
                }
                .compact-dataclass-table .tabulator-placeholder span,
                .compact-dataclass-table .tabulator-placeholder div {
                    font-size: 8px !important;
                    font-weight: 400 !important;
                    color: var(--text-muted) !important;
                    text-transform: uppercase !important;
                    letter-spacing: 0.15em !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    opacity: 0.7;
                }
            `}</style>
        </div>
    );
};
