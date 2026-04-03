import React, { useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { vscodeDark, vscodeLight } from '@uiw/codemirror-theme-vscode';
import { marked } from 'marked';
import { useThemeStore } from '../../../../shared/lib/theme/store';
import { UI_CONSTANTS } from '../../../../shared/ui/constants';

interface MarkdownEditorProps {
    value: string;
    onChange: (val: string) => void;
    isReadOnly: boolean;
}

export const MarkdownEditor: React.FC<MarkdownEditorProps> = ({ value, onChange, isReadOnly }) => {
    const { theme } = useThemeStore();
    const editorTheme = theme === 'dark' ? vscodeDark : vscodeLight;
    const [previewMode, setPreviewMode] = useState(false);

    if (previewMode) {
        return (
            <div className="flex-1 flex flex-col min-h-[400px] bg-[var(--bg-app)] border border-[var(--border-base)] rounded-xl overflow-hidden shadow-sm animate-in fade-in zoom-in-95 duration-200">
                <div className="px-4 py-2 bg-[var(--bg-alt)] border-b border-[var(--border-base)] flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Preview Mode</span>
                    <button onClick={() => setPreviewMode(false)} className="text-[10px] font-bold text-brand hover:underline">Back to Edit</button>
                </div>
                <div 
                    className="flex-1 overflow-y-auto p-6 prose prose-invert max-w-none text-sm leading-relaxed custom-scrollbar markdown-preview"
                    dangerouslySetInnerHTML={{ __html: marked.parse(value || '') as any }}
                />
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col min-h-[400px]">
             <div className="px-4 py-2 bg-[var(--bg-alt)] border-b border-[var(--border-base)] flex items-center justify-between mb-2 rounded-t-xl">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Editor Mode</span>
                <button onClick={() => setPreviewMode(true)} className="text-[10px] font-bold text-brand hover:underline">Show Preview</button>
            </div>
            <div className="flex-1 border border-[var(--border-base)] rounded-b-xl overflow-hidden">
                <CodeMirror
                    value={value}
                    height="100%"
                    theme={editorTheme}
                    extensions={[markdown()]}
                    onChange={onChange}
                    readOnly={isReadOnly}
                    className={`${UI_CONSTANTS.CODE_EDITOR_CLASS} h-full`}
                />
            </div>
        </div>
    );
};
