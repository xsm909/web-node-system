import React, { useState, useEffect } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { json, jsonParseLinter } from '@codemirror/lang-json';
import { linter, lintGutter } from '@codemirror/lint';
import { vscodeDark, vscodeLight } from '@uiw/codemirror-theme-vscode';
import { useThemeStore } from '../../shared/lib/theme/store';

interface SchemaEditorProps {
  initialValue: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
}

export const SchemaEditor: React.FC<SchemaEditorProps> = ({
  initialValue,
  onChange,
  readOnly = false
}) => {
  const { theme } = useThemeStore();
  const [code, setCode] = useState(initialValue);

  // Sync internal state if initialValue changes from outside
  useEffect(() => {
    setCode(initialValue);
  }, [initialValue]);

  const handleChange = (val: string) => {
    setCode(val);
    onChange(val);
  };

  return (
    <div className="w-full h-full flex flex-col min-h-0 rounded-xl border border-[var(--border-base)] overflow-hidden focus-within:border-brand transition-all shadow-sm">
      <div className="flex-1 min-h-0">
        <CodeMirror
          value={code}
          height="100%"
          theme={theme === 'dark' ? vscodeDark : vscodeLight}
          extensions={[
            json(),
            linter(jsonParseLinter()),
            lintGutter()
          ]}
          onChange={handleChange}
          readOnly={readOnly}
          className="h-full font-mono text-sm"
          basicSetup={{
            lineNumbers: true,
            foldGutter: true,
            dropCursor: true,
            allowMultipleSelections: true,
            indentOnInput: true,
            syntaxHighlighting: true,
            bracketMatching: true,
            autocompletion: true,
            rectangularSelection: true,
            crosshairCursor: true,
            highlightSelectionMatches: true,
            closeBrackets: true,
            defaultKeymap: true,
            searchKeymap: true,
            historyKeymap: true,
            foldKeymap: true,
            completionKeymap: true,
            lintKeymap: true,
          }}
        />
      </div>
    </div>
  );
};
