import { useMemo, useRef } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { sql as sqlLang, SQLite } from "@codemirror/lang-sql";
import { EditorView, keymap } from "@codemirror/view";
import { Prec } from "@codemirror/state";
import type { TableInfo } from "../../shared/sql/types";
import { sqlPhraseCompletion } from "../../shared/sql/completion";

export function SqlEditor({ draftKey, value, schema, onChange, onRun, busy, autocomplete }: {
  draftKey: string;
  value: string;
  schema: TableInfo[];
  onChange: (sql: string) => void;
  onRun: () => void;
  busy: boolean;
  autocomplete: boolean;
}) {
  const run = useRef(onRun);
  run.current = onRun;
  const extensions = useMemo(() => [
    EditorView.lineWrapping,
    sqlLang({ dialect: SQLite, schema: Object.fromEntries(schema.map(table => [table.name, table.columns.map(column => column.name)])), upperCaseKeywords: true }),
    sqlPhraseCompletion,
    Prec.highest(keymap.of([{ key: "Ctrl-Enter", mac: "Cmd-Enter", run: () => { run.current(); return true; } }])),
  ], [schema]);
  const setup = useMemo(() => ({ autocompletion: autocomplete, completionKeymap: autocomplete, foldGutter: false }), [autocomplete]);

  // Each draft owns its editor instance. A delayed controlled-value update
  // from the previous mode must not overwrite an edit in the newly opened one.
  return <div className="editor-wrap"><CodeMirror key={draftKey} className="sql-editor" value={value}
    onChange={onChange} extensions={extensions} editable={!busy} theme="dark" height="100%"
    aria-label="SQL editor" basicSetup={setup} /></div>;
}
