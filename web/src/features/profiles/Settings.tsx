import type { SafariFleeLimit } from "../safari/types";
import { PersonalizationPage } from "./PersonalizationPage";
import ballThemes from "./themes.json";

interface Props {
  ballTheme: string; autocomplete: boolean; safariFleeAfter: SafariFleeLimit; saveError: boolean;
  onThemeChange: (id: string) => void; onAutocompleteChange: (enabled: boolean) => void;
  onSafariFleeAfterChange: (limit: SafariFleeLimit) => void; onDone: () => void;
}

export function Settings({ ballTheme, autocomplete, safariFleeAfter, saveError, onThemeChange, onAutocompleteChange, onSafariFleeAfterChange, onDone }: Props) {
  return <PersonalizationPage title="Settings" description="Settle into your own way to play and practice." saveError={saveError} onDone={onDone}>
    <fieldset className="profile-section">
      <legend>Poké Ball colors</legend><p>Your colors also choose the ball used for Safari catches.</p>
      <div className="theme-options">{ballThemes.map(theme => <label className="theme-option" key={theme.id}>
        <input type="radio" name="ball-theme" value={theme.id} checked={ballTheme === theme.id} onChange={() => onThemeChange(theme.id)} />
        <img src={`${import.meta.env.BASE_URL}sprites/items/${theme.id}.png`} alt="" width={40} height={40} /><span>{theme.name}</span>
      </label>)}</div>
    </fieldset>
    <section className="profile-section" aria-labelledby="editor-preferences-title">
      <h3 id="editor-preferences-title">Editor assistance</h3>
      <label className="autocomplete-setting"><span><strong>SQL autocomplete</strong><small id="autocomplete-description">Suggest SQL keywords, table and column names, and phrases like LEFT JOIN as you type.</small></span>
        <input type="checkbox" role="switch" aria-label="SQL autocomplete" aria-describedby="autocomplete-description" checked={autocomplete} onChange={event => onAutocompleteChange(event.target.checked)} />
      </label><p>When enabled, use ↑ / ↓ to choose, Enter to accept, and Escape to dismiss. Ctrl+Space opens suggestions.</p>
    </section>
    <section className="profile-section" aria-labelledby="safari-preferences-title">
      <h3 id="safari-preferences-title">Safari encounters</h3>
      <label className="safari-limit-setting" htmlFor="safari-flee-after">Chances before fleeing</label>
      <select id="safari-flee-after" value={safariFleeAfter ?? "unlimited"} aria-describedby="safari-flee-description" onChange={event => onSafariFleeAfterChange(event.target.value === "unlimited" ? null : event.target.value === "5" ? 5 : 8)}>
        <option value="unlimited">Unlimited — relaxed practice</option><option value="5">5 incorrect answers</option><option value="8">8 incorrect answers</option>
      </select><p id="safari-flee-description">Choose a limit to let Pokémon flee. Hints, SQL errors and stopped queries keep your chances. Changes apply to your next encounter; the current encounter keeps its original limit.</p>
    </section>
  </PersonalizationPage>;
}
