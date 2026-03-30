import { useState, forwardRef, useImperativeHandle, useMemo, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { ReportStyle } from "../../../entities/report/model/types";
import { Icon } from "../../../shared/ui/icon";
import { apiClient } from "../../../shared/api/client";
import { css } from "@codemirror/lang-css";
import CodeMirror from "@uiw/react-codemirror";
import { vscodeDark, vscodeLight } from "@uiw/codemirror-theme-vscode";
import { indentUnit } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { useThemeStore } from "../../../shared/lib/theme/store";
import { AppInput } from "../../../shared/ui/app-input";
import { AppCategoryInput } from "../../../shared/ui/app-category-input/AppCategoryInput";
import { getUniqueCategoryPaths } from "../../../shared/lib/categoryUtils";


interface StyleEditorProps {
    style?: ReportStyle | null;
    allStyles?: ReportStyle[];
    onDirtyChange?: (dirty: boolean) => void;
    isLocked?: boolean;
}

export interface StyleEditorRef {
    handleSave: () => Promise<ReportStyle | void>;
    isSaving: boolean;
}

export const StyleEditor = forwardRef<StyleEditorRef, StyleEditorProps>(({ style, allStyles = [], onDirtyChange, isLocked }, ref) => {
    const { theme } = useThemeStore();
    const queryClient = useQueryClient();
    const [isSaving, setIsSaving] = useState(false);

    const allCategoryPaths = useMemo(() => getUniqueCategoryPaths(allStyles), [allStyles]);

    const editorTheme = useMemo(() => (theme === "dark" ? vscodeDark : vscodeLight), [theme]);
    
    const cssExtensions = useMemo(() => [
        css(),
        indentUnit.of('    '),
        EditorState.tabSize.of(4),
    ], []);

    // Form State
    const [name, setName] = useState(style?.name || '');
    const [category, setCategory] = useState(style?.category || '');
    const [cssContent, setCssContent] = useState(style?.css || '/* Add your CSS here */\n.report-container {\n    \n}');
    const [isDefault, setIsDefault] = useState(style?.is_default || false);

    const initialRef = useRef<any>(null);

    useEffect(() => {
        if (style && !initialRef.current) {
            initialRef.current = {
                name: style.name || '',
                category: style.category || '',
                css: style.css || '',
                isDefault: style.is_default || false,
            };
        }
    }, [style]);

    useEffect(() => {
        if (!initialRef.current) {
            // New style dirty check
            const changed = name !== '' || category !== '' || cssContent !== '/* Add your CSS here */\n.report-container {\n    \n}' || isDefault !== false;
            onDirtyChange?.(changed);
            return;
        }
        const changed =
            name !== initialRef.current.name ||
            category !== initialRef.current.category ||
            cssContent !== initialRef.current.css ||
            isDefault !== initialRef.current.isDefault;
        onDirtyChange?.(changed);
    }, [name, category, cssContent, isDefault]);

    useImperativeHandle(ref, () => ({
        handleSave,
        isSaving
    }));

    const handleSave = async () => {
        if (!name || !cssContent) {
            alert("Name and CSS content are required");
            return;
        }

        setIsSaving(true);
        const payload = {
            name,
            category: category.trim() || null,
            css: cssContent,
            is_default: isDefault
        };

        try {
            let savedStyle: ReportStyle;
            if (style?.id) {
                const { data } = await apiClient.put(`/reports/styles/${style.id}`, payload);
                savedStyle = data;
            } else {
                const { data } = await apiClient.post('/reports/styles', payload);
                savedStyle = data;
            }
            
            initialRef.current = {
                name: savedStyle.name || '',
                category: savedStyle.category || '',
                css: savedStyle.css || '',
                isDefault: savedStyle.is_default || false,
            };
            onDirtyChange?.(false);
            
            queryClient.invalidateQueries({ queryKey: ['report-styles'] });
            return savedStyle;
        } catch (error) {
            console.error("Failed to save style", error);
            alert("Failed to save style.");
            throw error;
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="h-full flex flex-col gap-6 pt-4 max-w-5xl mx-auto w-full">
            <div className="grid grid-cols-2 gap-6">
                <AppInput
                    label="Style Name"
                    required
                    value={name}
                    onChange={setName}
                    placeholder="e.g. Modern Invoice"
                    disabled={isLocked}
                />
                <AppCategoryInput
                    label="Category"
                    value={category}
                    onChange={setCategory}
                    placeholder="e.g. Finance|Invoices"
                    allPaths={allCategoryPaths}
                    disabled={isLocked}
                />
            </div>


            <div className="flex items-center gap-3 p-4 rounded-xl bg-[var(--bg-app)] border border-[var(--border-base)] shadow-sm">
                <div className="relative flex items-center">
                    <input
                        type="checkbox"
                        id="isDefault"
                        checked={isDefault}
                        onChange={(e) => setIsDefault(e.target.checked)}
                        className="w-5 h-5 rounded-md border-[var(--border-base)] text-brand focus:ring-brand cursor-pointer disabled:opacity-50"
                        disabled={isLocked}
                    />
                </div>
                <label htmlFor="isDefault" className="text-sm font-semibold text-[var(--text-main)] cursor-pointer select-none">
                    Set as Default Style for all reports
                </label>
                <div className="ml-auto flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] bg-[var(--border-muted)] px-3 py-1 rounded-full">
                    <Icon name="info" size={12} />
                    Only one default style can exist
                </div>
            </div>

            <div className="flex-1 flex flex-col min-h-0 gap-2">
                <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">CSS Editor</label>
                    <div className="flex items-center gap-2 text-[10px] text-[var(--text-muted)]">
                        <kbd className="px-1.5 py-0.5 rounded bg-[var(--border-muted)] border border-[var(--border-base)] font-mono">TAB</kbd>
                        <span>4 spaces</span>
                    </div>
                </div>
                <div className="flex-1 min-h-0 rounded-xl border border-[var(--border-base)] overflow-hidden shadow-sm bg-[var(--bg-app)] focus-within:border-brand transition-all">
                    <CodeMirror
                        value={cssContent}
                        height="100%"
                        theme={editorTheme}
                        extensions={cssExtensions}
                        onChange={(value) => setCssContent(value)}
                        className="h-full text-sm font-mono"
                        readOnly={isLocked}
                    />
                </div>
            </div>
        </div>
    );
});
