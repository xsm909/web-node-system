import React from 'react';
import { AppCompactModalForm } from '../../../../shared/ui/app-compact-modal-form/AppCompactModalForm';
import { MarkdownEditor } from './MarkdownEditor';
import CodeMirror from '@uiw/react-codemirror';
import { python } from '@codemirror/lang-python';
import { AppInput } from '../../../../shared/ui/app-input';
import { UI_CONSTANTS } from '../../../../shared/ui/constants';

interface SpecializedEditorsModalProps {
    param: any;
    value: string;
    onChange: (val: string) => void;
    onClose: () => void;
    onSave: () => void;
    isReadOnly: boolean;
    editorTheme: any;
}

export const SpecializedEditorsModal: React.FC<SpecializedEditorsModalProps> = ({
    param,
    value,
    onChange,
    onClose,
    onSave,
    isReadOnly,
    editorTheme
}) => {
    if (!param) return null;

    return (
        <AppCompactModalForm
            isOpen={true}
            title={param.label || 'Editor'}
            icon={param.is_python_editor ? 'function' : param.is_md_editor ? 'article' : 'notes'}
            onClose={onClose}
            onSubmit={onSave}
            submitLabel="Apply Changes"
            width={param.is_text_editor ? "max-w-xl" : "max-w-5xl"}
            fullHeight={!param.is_text_editor}
        >
            <div className="flex-1 flex flex-col min-h-0">
                {param.is_md_editor && (
                    <MarkdownEditor 
                        value={value} 
                        onChange={onChange} 
                        isReadOnly={isReadOnly} 
                    />
                )}
                {param.is_python_editor && (
                    <div className="flex-1 border border-[var(--border-base)] rounded-xl overflow-hidden">
                        <CodeMirror
                            value={value}
                            height="100%"
                            theme={editorTheme}
                            extensions={[python()]}
                            onChange={onChange}
                            readOnly={isReadOnly}
                            className={`${UI_CONSTANTS.CODE_EDITOR_CLASS} h-full`}
                        />
                    </div>
                )}
                {param.is_text_editor && (
                    <AppInput
                        label="Content"
                        multiline
                        rows={10}
                        value={value}
                        onChange={onChange}
                        placeholder="Enter text content..."
                        disabled={isReadOnly}
                        autoFocus
                    />
                )}
            </div>
        </AppCompactModalForm>
    );
};
