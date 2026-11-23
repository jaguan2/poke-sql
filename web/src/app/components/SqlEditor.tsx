import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { undo, redo, undoDepth, redoDepth } from "@codemirror/commands";
import { sql as sqlLang, SQLite } from "@codemirror/lang-sql";
import { EditorView, keymap, type ViewUpdate } from "@codemirror/view";
import { Prec } from "@codemirror/state";
import type { TableInfo } from "../../shared/sql/types";
import { sqlPhraseCompletion } from "../../shared/sql/completion";

export function SqlEditor({ draftKey, value, schema, onChange, onRun, busy, autocomplete, actions, autoFocus = false }: {
  draftKey: string;
  value: string;
  schema: TableInfo[];
  onChange: (sql: string) => void;
  onRun: () => void;
  busy: boolean;
  autocomplete: boolean;
  actions: ReactNode;
  autoFocus?: boolean;
}) {
  const view = useRef<EditorView | null>(null);
  const [history, setHistory] = useState({ undo: false, redo: false });
  const syncHistory = useCallback((editor: EditorView) => {
    view.current = editor;
    const next = { undo: undoDepth(editor.state) > 0, redo: redoDepth(editor.state) > 0 };
    setHistory(previous => previous.undo === next.undo && previous.redo === next.redo ? previous : next);
  }, []);
  const onUpdate = useCallback((update: ViewUpdate) => syncHistory(update.view), [syncHistory]);
  const onCreateEditor = useCallback((editor: EditorView) => {
    syncHistory(editor);
    if (autoFocus) editor.dispatch({ selection: { anchor: editor.state.doc.length } });
  }, [autoFocus, syncHistory]);
  const editHistory = (command: typeof undo) => {
    if (busy || !view.current) return;
    command(view.current);
    view.current.focus();
  };
  const run = useRef(onRun);
  run.current = onRun;
  const extensions = useMemo(() => [
    EditorView.lineWrapping,
    sqlLang({ dialect: SQLite, schema: Object.fromEntries(schema.map(table => [table.name, table.columns.map(column => column.name)])), upperCaseKeywords: true }),
    sqlPhraseCompletion,
    Prec.highest(keymap.of([
      { key: "Ctrl-Enter", mac: "Cmd-Enter", run: () => { run.current(); return true; } },
      { key: "Mod-Shift-z", run: redo, preventDefault: true },
    ])),
  ], [schema]);
  const setup = useMemo(() => ({ autocompletion: autocomplete, completionKeymap: autocomplete, foldGutter: false }), [autocomplete]);

  // Each draft owns its editor instance. A delayed controlled-value update
  // from the previous mode must not overwrite an edit in the newly opened one.
  return <>
    <div className="editor-wrap"><CodeMirror key={draftKey} className="sql-editor" value={value}
      onChange={onChange} onCreateEditor={onCreateEditor} onUpdate={onUpdate}
      extensions={extensions} editable={!busy} readOnly={busy} autoFocus={autoFocus} theme="dark" height="100%"
      aria-label="SQL editor" basicSetup={setup} /></div>
    <div className="editor-actions">
      <div className="editor-history" role="group" aria-label="Edit history">
        <button type="button" className="btn" disabled={busy || !history.undo} onClick={() => editHistory(undo)} title="Undo edit (Ctrl/Cmd+Z)"><span aria-hidden="true">↶</span> Undo</button>
        <button type="button" className="btn" disabled={busy || !history.redo} onClick={() => editHistory(redo)} title="Redo edit (Ctrl/Cmd+Shift+Z)"><span aria-hidden="true">↷</span> Redo</button>
      </div>
      {actions}
    </div>
  </>;
}
