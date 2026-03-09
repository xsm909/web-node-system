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
    <div className="w-full h-full border border-gray-700 rounded-lg overflow-hidden flex flex-col">
      <div className="bg-gray-800 text-gray-200 text-xs px-3 py-1 flex justify-between items-center border-b border-gray-700">
        <span>JSON Schema Editor</span>
      </div>
      <div className="flex-1 overflow-auto">
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
        />
      </div>
    </div>
  );
};
