import React, { useState, useMemo, useEffect } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';
import { useThemeStore } from '../../../shared/lib/theme/store';
import { vscodeDark, vscodeLight } from '@uiw/codemirror-theme-vscode';
import { UI_CONSTANTS } from '../../../shared/ui/constants';

interface WorkflowDataEditorProps {
    data: any;
    onChange: (value: any) => void;
}

export const WorkflowDataEditorTabs: React.FC<WorkflowDataEditorProps> = ({
    data,
    onChange,
}) => {
    const { theme } = useThemeStore();
    const [dataStr, setDataStr] = useState(() => JSON.stringify(data, null, 2));

    const editorTheme = useMemo(() => (theme === "dark" ? vscodeDark : vscodeLight), [theme]);

    const codeMirrorExtensions = useMemo(() => [json()], []);

    useEffect(() => {
        setDataStr(JSON.stringify(data, null, 2));
    }, [data]);

    const handleChange = (value: string) => {
        setDataStr(value);
        try {
            onChange(JSON.parse(value));
        } catch {
            // Invalid JSON — don't propagate yet
        }
    };

    return (
        <div className="w-full h-full flex flex-col bg-[var(--bg-app)] overflow-hidden">
            <header className="px-6 pt-6 pb-2 border-b border-[var(--border-base)]">
                <div className="flex items-center justify-between">
                    <div className="text-[10px] font-black text-brand uppercase tracking-[0.2em]">Workflow Configuration Data</div>
                </div>
            </header>

            <div className="flex-1 overflow-hidden relative">
                <div className="absolute inset-0 flex flex-col pt-4 px-6 pb-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <div className="flex-1 rounded-xl border border-[var(--border-base)] overflow-hidden focus-within:border-brand transition-all shadow-sm">
                        <CodeMirror
                            value={dataStr}
                            height="100%"
                            theme={editorTheme}
                            extensions={codeMirrorExtensions}
                            onChange={handleChange}
                            className={`h-full ${UI_CONSTANTS.CODE_EDITOR_CLASS}`}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};
