import React, { useState, memo, useMemo, useEffect, useRef } from 'react';
import { AppCompactModalForm } from '../app-compact-modal-form/AppCompactModalForm';
import { AppValueEditor } from './AppValueEditor';
import { SelectionList } from '../selection-list/SelectionList';
import { QueryBuilderModal } from '../../../features/query-builder/ui/QueryBuilderModal';
import { SpecializedEditorsModal } from '../../../widgets/node-editor-view/ui/components/SpecializedEditorsModal';
import { DataclassListEditor } from '../dataclass-list-editor';
import { useParameterOptions } from '../../../features/node-editor/lib/useParameterOptions';
import { resolveValuePreview } from './ValuePreview.lib';
import { AppPreviewWrapper } from './AppPreviewWrapper';
import { useThemeStore } from '../../lib/theme/store';
import { vscodeDark, vscodeLight } from '@uiw/codemirror-theme-vscode';

export interface AppValuePreviewProps {
    value: any;
    parameterName?: string;
    paramDef?: any;
    nodeTypeId?: string;
    allParams?: Record<string, any>;
    label?: string;
    onSave?: (newValue: any, displayLabel?: string) => void;
    onSelect?: () => void;
    isLocked?: boolean;
    className?: string;
    workflowParameters?: any[];
}

/**
 * AppValuePreview
 * 
 * Renders a stylized 'gadget' preview of a value.
 * Clicking triggers context-aware editing interfaces.
 * Ensures synchronization with the sidebar/workflow state.
 */
export const AppValuePreview = memo(({
    value,
    parameterName,
    paramDef,
    nodeTypeId,
    allParams = {},
    label,
    onSave,
    onSelect,
    isLocked = false,
    className = '',
    workflowParameters = [],
}: AppValuePreviewProps) => {
    const { theme } = useThemeStore();
    const editorTheme = theme === "dark" ? vscodeDark : vscodeLight;

    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isSqlModalOpen, setIsSqlModalOpen] = useState(false);
    const [isSpecialModalOpen, setIsSpecialModalOpen] = useState(false);
    const [isDataclassModalOpen, setIsDataclassModalOpen] = useState(false);
    const [isComboOpen, setIsComboOpen] = useState(false);
    const [comboPosition, setComboPosition] = useState({ x: 0, y: 0 });

    const containerRef = useRef<HTMLDivElement>(null);

    // Local state for the modal editor
    const [modalTempValue, setModalTempValue] = useState<any>(value);
    // Ref shadow — always holds the latest value synchronously.
    // Needed because DataclassListEditor's onChange (cellEdited) and the modal
    // form submit can race: the Enter key both confirms a Tabulator cell AND
    // triggers form submit before React flushes the setState.
    const latestModalTempValue = useRef<any>(value);

    const setModalTempValueSync = (val: any) => {
        latestModalTempValue.current = val;
        setModalTempValue(val);
    };

    // Sync local state when external value changes
    useEffect(() => {
        latestModalTempValue.current = value;
        setModalTempValue(value);
    }, [value]);

    // Detect parameter behavior based on metadata
    // Priority 1: SQL/Specialized Modals
    const isSqlConstructor = !!paramDef?.is_sql_query_constructor;
    const isSpecialEditor = !!(paramDef?.is_md_editor || paramDef?.is_python_editor || paramDef?.is_text_editor || paramDef?.parameter_type === 'code' || paramDef?.parameter_type === 'text');
    // Priority 2: Dataclass list table editor
    const isDataclassList = paramDef?.type === 'list_dataclass' && Array.isArray(paramDef?.schema);
    // Priority 3: ComboBox (Strict check matching sidebar logic)
    const isComboBox = paramDef?.options_source?.component === 'ComboBox';

    // Fetch options for ComboBox if applicable
    const { options, isLoading: isOptionsLoading } = useParameterOptions({
        param: paramDef,
        nodeTypeId,
        allParams
    });

    // Get the visual type and display string from the shared library
    const preview = useMemo(() => resolveValuePreview(value, parameterName), [value, parameterName]);

    const isEditable = !!onSave && !isLocked;

    const handleContainerClick = (e: React.MouseEvent) => {
        if (!isEditable) return;
        e.stopPropagation();

        // Trigger node selection relative to the graph when any parameter is clicked
        onSelect?.();

        // SPECIAL CASE: Booleans should just toggle immediately without a modal
        if (typeof value === 'boolean') {
            handleInternalSave(!value);
            return;
        }

        if (isSqlConstructor) {
            setIsSqlModalOpen(true);
        } else if (isSpecialEditor) {
            setModalTempValue(value);
            setIsSpecialModalOpen(true);
        } else if (isDataclassList) {
            setModalTempValue(Array.isArray(value) ? value : []);
            setIsDataclassModalOpen(true);
        } else if (isComboBox) {
            // Calculate position for the SelectionList dropdown
            const rect = containerRef.current?.getBoundingClientRect();
            if (rect) {
                setComboPosition({ x: rect.left, y: rect.bottom + 4 });
                setIsComboOpen(true);
            }
        } else {
            setModalTempValue(value);
            setIsEditModalOpen(true);
        }
    };

    const handleInternalSave = (newVal: any, displayLabel?: string) => {
        onSave?.(newVal, displayLabel);
        setIsEditModalOpen(false);
        setIsSqlModalOpen(false);
        setIsSpecialModalOpen(false);
        setIsDataclassModalOpen(false);
        setIsComboOpen(false);
    };

    return (
        <div
            ref={containerRef}
            onClick={handleContainerClick}
            className={`
                group relative flex items-center min-w-0 transition-all w-fit max-w-full
                ${isEditable ? 'cursor-pointer hover:opacity-80 active:scale-[0.98]' : 'opacity-100'}
                ${className}
            `}
        >
            <AppPreviewWrapper type={preview.type} isLinked={preview.isLinked}>
                {preview.display || <span className="opacity-30 italic leading-none">empty</span>}
            </AppPreviewWrapper>

            {/* Seamless ComboBox: Rendered as a Portal-based SelectionList directly from the gadget */}
            {isComboOpen && isEditable && isComboBox && (
                <SelectionList
                    data={{}}
                    items={options}
                    activeItemId={String(value ?? '')}
                    onSelect={(item) => handleInternalSave(item.id, item.name)}
                    onClose={() => setIsComboOpen(false)}
                    position={comboPosition}
                    searchPlaceholder={isOptionsLoading ? "Loading options..." : "Search..."}
                />
            )}

            {/* Editing Interfaces */}
            {isEditModalOpen && (
                <AppCompactModalForm
                    isOpen={isEditModalOpen}
                    title={label || parameterName || 'Edit Value'}
                    onClose={() => setIsEditModalOpen(false)}
                    onSubmit={() => handleInternalSave(modalTempValue)}
                    width="max-w-md"
                >
                    <div className="py-2">
                        <AppValueEditor
                            value={modalTempValue}
                            type={preview.type}
                            onChange={setModalTempValue}
                            isLocked={isLocked}
                        />
                    </div>
                </AppCompactModalForm>
            )}

            {isSqlModalOpen && (
                <QueryBuilderModal
                    isOpen={isSqlModalOpen}
                    initialSql={value || ''}
                    onClose={() => setIsSqlModalOpen(false)}
                    onDone={handleInternalSave}
                    parameters={workflowParameters}
                />
            )}

            {isSpecialModalOpen && (
                <SpecializedEditorsModal
                    param={paramDef}
                    value={String(modalTempValue ?? '')}
                    onChange={setModalTempValue}
                    onClose={() => setIsSpecialModalOpen(false)}
                    onSave={() => handleInternalSave(modalTempValue)}
                    isReadOnly={isLocked}
                    editorTheme={editorTheme}
                />
            )}

            {isDataclassModalOpen && isDataclassList && (
                <AppCompactModalForm
                    isOpen={isDataclassModalOpen}
                    title={label || parameterName || 'Edit List'}
                    onClose={() => setIsDataclassModalOpen(false)}
                    onSubmit={() => handleInternalSave(latestModalTempValue.current)}
                    width="max-w-2xl"
                >
                    <div className="py-2 px-1">
                        <DataclassListEditor
                            schema={paramDef.schema}
                            value={modalTempValue}
                            onChange={setModalTempValueSync}
                            isReadOnly={isLocked}
                            label={label || parameterName || ''}
                        />
                    </div>
                </AppCompactModalForm>
            )}
        </div>
    );
});
