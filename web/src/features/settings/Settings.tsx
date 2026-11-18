import { useRef } from "react";
import ballThemes from "./themes.json";
import "./Settings.css";

interface SettingsProps {
  ballTheme: string;
  autocomplete: boolean;
  saveError: boolean;
  onThemeChange: (theme: string) => void;
  onAutocompleteChange: (enabled: boolean) => void;
}

export function Settings({ ballTheme, autocomplete, saveError, onThemeChange, onAutocompleteChange }: SettingsProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  return <>
    <button className="btn btn-secondary settings-button" onClick={() => dialog.current?.showModal()}>Settings</button>
    <dialog className="settings-dialog" ref={dialog} aria-labelledby="settings-title" aria-describedby="settings-description">
      <header className="settings-heading">
        <div><span className="eyebrow">Make it yours</span><h2 id="settings-title">Settings</h2></div>
        <button className="btn" onClick={() => dialog.current?.close()}>Done</button>
      </header>
      <p id="settings-description">Your Pokédex, your way. Changes apply right away.</p>
      <fieldset className="settings-section">
        <legend>Poké Ball colors</legend>
        <p>A familiar red shell, a little pastel, or something after dark.</p>
        <div className="theme-options">
          {ballThemes.map(theme => <label className="theme-option" key={theme.id}>
            <input type="radio" name="ball-theme" value={theme.id} checked={ballTheme === theme.id} onChange={() => onThemeChange(theme.id)} />
            <img src={`${import.meta.env.BASE_URL}sprites/items/${theme.id}.png`} alt="" width={40} height={40} />
            <span>{theme.name}</span>
          </label>)}
        </div>
      </fieldset>
      <section className="settings-section" aria-labelledby="editor-settings-title">
        <h3 id="editor-settings-title">Editor assistance</h3>
        <label className="autocomplete-setting">
          <span><strong>SQL autocomplete</strong><small id="autocomplete-description">Suggest SQL keywords, table and column names, and phrases like LEFT JOIN as you type.</small></span>
          <input type="checkbox" role="switch" aria-label="SQL autocomplete" aria-describedby="autocomplete-description" checked={autocomplete} onChange={event => onAutocompleteChange(event.target.checked)} />
        </label>
        <p className="settings-help">When enabled, use ↑ / ↓ to choose, Enter to accept, and Escape to dismiss. Ctrl+Space opens suggestions.</p>
      </section>
      <p className={saveError ? "notice" : "settings-save-note"} role="status">{saveError ? "This device could not save a setting. Your changes apply for this session; they may reset when you reopen the app." : "Changes save automatically on this device."}</p>
    </dialog>
  </>;
}
