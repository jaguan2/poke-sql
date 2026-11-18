import { QueryResults } from "../shared/ui/QueryResults";
import { Sidebar } from "./components/Sidebar";
import { SqlEditor } from "./components/SqlEditor";
import { Settings } from "../features/settings/Settings";
import { QueryHelp } from "../features/practice/QueryHelp";
import { MusicPlayer } from "../features/music/MusicPlayer";
import { MysteryNotebook, MysteryPanel } from "../features/mystery/PokemonMystery";
import { mysterySolved } from "../features/mystery/model";
import { PersonalPokedex } from "../features/pokedex/PersonalPokedex";
import { useWorkspace } from "./use-workspace";
import { SafariZone } from "../features/safari/SafariZone";
import "./App.css";
import "../features/settings/themes.css";

export default function App() {
  const {
    ready, loadError, selection, activeChallenge, isMystery, challenge, sample, practice,
    query, draftKey, editorSchema, showPokedex, showSafari, safari, encounters, achievementCatalog, encounterSaveError, encountersRecovered,
    datasetUpdateAvailable, busy, notice, storageError, offlineStatus, ballTheme, autocomplete,
    settingsSaveError, mysteryRound, mysteryMode, dailyMysteryRound, today, completed, history,
    saved, queryName, runState, actions,
  } = useWorkspace();

  if (loadError) return <div className="load-screen"><h1>Could not load PokéSQL</h1><p>{loadError}</p><button className="btn" onClick={() => location.reload()}>Try again</button></div>;
  if (!ready) return <div className="load-screen"><img src={`${import.meta.env.BASE_URL}pokeball.svg`} alt="" width={64} height={64} className="spin" /><p>Loading your Pokédex…</p></div>;

  return <div className="app">
    <header className="header">
      <div className="brand">
        <div className="dex-lights" aria-hidden="true"><span className="dex-lens" /><span className="dex-light" /><span className="dex-light" /></div>
        <div><h1>Poké<span className="brand-accent">SQL</span></h1><span className="tagline">Your pocket SQL laboratory</span></div>
      </div>
      <Settings ballTheme={ballTheme} autocomplete={autocomplete} saveError={settingsSaveError}
        onThemeChange={actions.changeTheme} onAutocompleteChange={actions.changeAutocomplete} />
      <div className="header-actions">
        {showPokedex || showSafari ? <>
          <button className="btn btn-secondary" disabled={busy} onClick={actions.returnToWorkspace}>Back to workspace</button>
          {busy ? <button className="btn btn-primary" onClick={() => actions.stop()}>■ Stop query</button> : <button className="btn btn-primary" onClick={actions.openDailyMystery}>Today's mystery</button>}
        </> : <>
        <button className="btn btn-secondary" disabled={busy} onClick={() => void actions.reset()} title="Restore the original database; keeps saved SQL and progress">Reset DB</button>
        {busy ? <button className="btn btn-primary" onClick={() => actions.stop()}>■ Stop query</button> : <button className="btn btn-primary" disabled={!query.trim() || (isMystery && (!mysteryRound || mysterySolved(mysteryRound)))} onClick={actions.run}>{isMystery ? "Guess Pokémon" : challenge ? "Check answer" : "▶ Run"} <kbd>Ctrl+Enter</kbd></button>}
        </>}
      </div>
    </header>
    <div className="body">
      <Sidebar schema={editorSchema} busy={busy} history={history} saved={saved} completed={completed} activeChallenge={showSafari ? null : activeChallenge} activeSample={showSafari ? null : sample?.id ?? null} activeMystery={isMystery && !showPokedex && !showSafari}
        activeSafari={showSafari} onSafari={actions.openSafari}
        pokedexCount={encounters.length} activePokedex={showPokedex} onPokedex={actions.openPokedex}
        onMystery={actions.openDailyMystery} onSample={actions.selectSample} onLoadSql={actions.loadSql}
        onGuideSql={actions.loadGuideSql} onPreviewSql={actions.previewSql} onChallenge={actions.selectChallenge}
        onDeleteSaved={actions.deleteSaved} onClearHistory={actions.clearHistory} />
      <main className={`main${isMystery && !showPokedex && !showSafari ? " mystery-workspace" : ""}`}>
        {showSafari ? <SafariZone session={safari.session} phase={safari.phase} today={today} busy={busy} saveError={safari.saveError}
          registeredIds={encounters.map(entry => entry.pokemon.id)} results={safari.results} message={safari.message} error={safari.error} onMove={safari.actions.move} onZone={safari.actions.changeZone}
          onSubmit={() => void safari.actions.submit()} onStop={() => actions.stop()} onLeave={safari.actions.leave} onPokedex={actions.openPokedex}
          editor={<SqlEditor draftKey={`safari:${safari.session.encounter?.id ?? "map"}`} value={safari.session.draft} schema={editorSchema}
            onChange={safari.actions.editDraft} onRun={() => void safari.actions.submit()} busy={busy} autocomplete={autocomplete} />} />
        : showPokedex ? <PersonalPokedex encounters={encounters} catalog={achievementCatalog} saveError={encounterSaveError} recovered={encountersRecovered} onSafari={actions.openSafari} onDaily={actions.openDailyMystery} onRandom={actions.openRandomMystery} /> : <>
        {datasetUpdateAvailable && !isMystery && !challenge && <div className="notice dataset-update" role="status">
          <strong>New Pokédex fields and forms are available.</strong> Your saved practice database is an older version. Reset DB loads the update and replaces practice database edits. Your SQL drafts, saved queries, and progress stay saved.
          <button className="btn" disabled={busy} onClick={() => void actions.reset()}>Reset DB and load update</button>
        </div>}
        {isMystery && <MysteryPanel round={mysteryRound} busy={busy} mode={mysteryMode} date={dailyMysteryRound?.date} today={today}
          onDaily={actions.openDailyMystery} onRandom={actions.openRandomMystery} onNew={() => void actions.newMystery()}
          onLeave={actions.leaveMystery} />}
        {practice && <section className="practice-panel" key={`${selection?.kind}:${practice.id}`} aria-label={challenge ? "Current challenge" : "Get started query"}>
          <div className="challenge-heading"><span className="eyebrow">{challenge?.topic ?? "Get started"}</span><button className="sample-btn" disabled={busy} onClick={actions.leavePractice}>Back to free practice</button></div>
          <h2>{practice.title}</h2><p>{practice.prompt}</p>
          <QueryHelp hint={practice.hint} hintSql={practice.hintSql} answer={practice.sql} alternatives={practice.alternatives} busy={busy} onUseAnswer={actions.loadAnswer} />
          <small>{challenge ? "Answers run against the original Pokédex. Your practice database stays separate." : "These examples use your practice database. Reset DB if you want to restore the original data."}</small>
        </section>}
        <form className="editor-toolbar" onSubmit={event => { event.preventDefault(); actions.saveQuery(); }}>
          <span className="editor-label">{isMystery ? "Your next guess" : practice ? "Your answer" : "Free practice"}</span>
          <label className="sr-only" htmlFor="query-name">Query name</label><input id="query-name" value={queryName} onChange={event => actions.setQueryName(event.target.value)} placeholder="Name this query…" maxLength={80} />
          <button className="btn" disabled={!queryName.trim() || !query.trim()}>Save query</button>
        </form>
        <SqlEditor draftKey={draftKey} value={query} schema={editorSchema} onChange={actions.editQuery}
          onRun={actions.run} busy={busy} autocomplete={autocomplete} />
        <div className="results" aria-busy={busy}>
          <h2 className="results-heading">{isMystery ? "Mystery notebook" : "Query results"}</h2>
          {isMystery && mysteryRound && <MysteryNotebook round={mysteryRound} daily={mysteryMode === "daily"} onOpenPokedex={actions.openPokedex} />}
          {(storageError || encounterSaveError) && <p className="notice" role="status">This device could not save your SQL or progress. Keep a copy before closing.</p>}
          {notice && <p className="notice" role="status">{notice}</p>}
          {busy ? <p className="running-notice" role="status">Running SQL… You can stop it at any time. Queries time out after 8 seconds.</p> : <>
            {runState.status === "idle" && (isMystery ? <p className="mystery-idle">{runState.message}</p> : <div className="empty-state">
              <div className="starter-sprites" aria-hidden="true">{[1, 4, 7].map(id => <img key={id} src={`${import.meta.env.BASE_URL}sprites/${id}.png`} alt="" width={72} height={72} />)}</div>
              <h2>A little curiosity. A whole Pokédex.</h2><p>{runState.message}</p>
            </div>)}
            {runState.status === "error" && <div className="error-panel" role="alert"><strong>SQL message:</strong> {runState.message}</div>}
            {runState.status === "ok" && <>
              {runState.passed !== undefined && <div className={runState.passed ? "reset-notice" : "notice"} role="status">{runState.passed ? "✓ Correct! Challenge completed." : "Not quite yet. Check the requested columns, filters, duplicates, and row order, then try again."}</div>}
              <div className="status-bar">{runState.results.length === 0 ? "Statement executed — no rows returned." : `${runState.results.reduce((n, r) => n + r.values.length, 0).toLocaleString()}${runState.results.some(r => r.truncated) ? "+" : ""} row(s) in ${runState.ms.toFixed(1)} ms`}</div>
              {isMystery && runState.mysteryGuess ? <details className="mystery-query-results"><summary>Latest query results</summary><QueryResults results={runState.results} /></details> : <QueryResults results={runState.results} />}
            </>}
          </>}
        </div>
        </>}
        <MusicPlayer />
        <footer className="workspace-status"><span>SQLite · stored on this device</span><span role="status">{offlineStatus}</span></footer>
      </main>
    </div>
  </div>;
}
