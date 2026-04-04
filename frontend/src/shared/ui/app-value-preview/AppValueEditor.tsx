import React from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { python } from '@codemirror/lang-python';
import { sql } from '@codemirror/lang-sql';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { AppInput } from '../app-input/AppInput';
import { UI_CONSTANTS } from '../constants';
import type { ValuePreviewType } from './ValuePreview.lib';

interface AppValueEditorProps {
    value: any;
    type: ValuePreviewType;
    onChange: (val: any) => void;
    isLocked?: boolean;
    autoFocus?: boolean;
}

export const AppValueEditor: React.FC<AppValueEditorProps> = ({ 
    value, 
    type, 
    onChange, 
    isLocked = false,
    autoFocus = true 
}) => {
    // Determine if we need a code editor
    const isCode = type === 'sql' || type === 'python' || type === 'markdown' || type === 'array' || type === 'object' || type === 'hint';
    
    // Prepare string value for the editor
    const stringValue = React.useMemo(() => {
        if (value === null || value === undefined) return '';
        if (typeof value === 'object') return JSON.stringify(value, null, 2);
        return String(value);
    }, [value]);

    const handleCodeChange = React.useCallback((val: string) => {
        if (type === 'array' || type === 'object') {
            try {
                const parsed = JSON.parse(val);
                onChange(parsed);
            } catch (e) {
                // Keep as string if invalid JSON, or handle error
                onChange(val);
            }
        } else {
            onChange(val);
        }
    }, [type, onChange]);

    const handlePrimitiveChange = React.useCallback((val: string) => {
        if (typeof value === 'number') {
            const num = Number(val);
            onChange(isNaN(num) ? val : num);
        } else {
            onChange(val);
        }
    }, [value, onChange]);

    if (isCode) {
        const extensions = [];
        if (type === 'python') extensions.push(python());
        if (type === 'sql') extensions.push(sql());
        if (type === 'markdown' || type === 'hint') extensions.push(markdown());
        if (type === 'array' || type === 'object') extensions.push(json());

        return (
            <div className="flex-1 border border-[var(--border-base)] rounded-xl overflow-hidden min-h-[300px] bg-[var(--bg-app-alt)]">
                <CodeMirror
                    value={stringValue}
                    height="100%"
                    extensions={extensions}
                    onChange={handleCodeChange}
                    readOnly={isLocked}
                    autoFocus={autoFocus}
                    className={`${UI_CONSTANTS.CODE_EDITOR_CLASS} h-full`}
                />
            </div>
        );
    }

    return (
        <AppInput
            value={stringValue}
            onChange={handlePrimitiveChange}
            type={typeof value === 'number' ? 'number' : 'text'}
            disabled={isLocked}
            multiline={stringValue.length > 50}
            rows={5}
            autoFocus={autoFocus}
        />
    );
};
