import React, { useState, useEffect } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { json, jsonParseLinter } from '@codemirror/lang-json';
import { linter, lintGutter } from '@codemirror/lint';
import { vscodeDark } from '@uiw/codemirror-theme-vscode';

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
    <div className="w-full h-full border border-[var(--border-base)] rounded-xl overflow-hidden flex flex-col bg-[var(--bg-app)]">
      <div className="bg-[var(--bg-app)] text-[var(--text-main)] text-[10px] font-black uppercase tracking-widest px-4 py-2 flex justify-between items-center border-b border-[var(--border-base)]">
        <span>JSON Schema Editor</span>
      </div>
      <div className="flex-1 min-h-0">
        <CodeMirror
          value={code}
          height="100%"
          theme={vscodeDark}
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
