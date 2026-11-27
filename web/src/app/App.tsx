import { Bag } from "../features/safari/Bag";
import "../shared/ui/GameWindows.css";
import { QueryResults } from "../shared/ui/QueryResults";
import { Sidebar } from "./components/Sidebar";
import { SqlEditor } from "./components/SqlEditor";
import { WorkspaceLibrary } from "./components/WorkspaceLibrary";
import { PracticeCatalog } from "../features/practice/PracticeCatalog";
import { useRef, useState } from "react";
import { readLocal, writeLocal } from "../shared/storage/local";
import { Profiles } from "../features/profiles/Profiles";
import { Settings } from "../features/profiles/Settings";
import { QueryHelp } from "../features/practice/QueryHelp";
import { MusicPlayer } from "../features/music/MusicPlayer";
import { MysteryNotebook, MysteryPanel } from "../features/mystery/PokemonMystery";
import { mysterySolved } from "../features/mystery/model";
import { PersonalPokedex } from "../features/pokedex/PersonalPokedex";
import { useWorkspace } from "./use-workspace";
import { SafariZone } from "../features/safari/SafariZone";
import { zoneById } from "../features/safari/zones";
import { PCBoxes } from "../features/pc/PCBoxes";
import { FeaturedPokemon } from "../features/pc/FeaturedPokemon";
import "./App.css";
import "../features/profiles/themes.css";

export default function App() {
  const {
    ready, loadError, selection, isMystery, challenge, practice, pc, showPc, showBag,
    query, draftKey, drafts, editorSchema, showWorkspace, activeNavigation, catalogKind, catalogFilters, libraryView, completedCount, challengeCount, showPokedex, showSafari, showProfiles, showSettings, pokedexView, safari, encounters, seenIds, seenSaveError, achievementCatalog, encounterSaveError, encountersRecovered,
    datasetUpdateAvailable, busy, notice, storageError, offlineStatus, ballTheme, trainer, trainerName, trainerIdentity, profileProgress, autocomplete, safariFleeAfter,
    profileSaveError, mysteryRound, mysteryMode, dailyMysteryRound, today, completed, history,
    saved, runState, actions,
  } = useWorkspace();
  const profileButton = useRef<HTMLButtonElement>(null);
  const settingsButton = useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(() => readLocal("menu-open", true, (value): value is boolean => typeof value === "boolean"));

  if (loadError) return <div className="load-screen"><h1>Could not load PokéSQL</h1><p>{loadError}</p><button className="btn" onClick={() => location.reload()}>Try again</button></div>;
  if (!ready) return <div className="load-screen"><img src={`${import.meta.env.BASE_URL}pokeball.svg`} alt="" width={64} height={64} className="spin" /><p>Loading your Pokédex…</p></div>;
  const areaMusic = showSafari ? zoneById(safari.session.zoneId).music : undefined;

  return <div className="app">
    <header className="header">
      <div className="brand">
        <button className="btn btn-secondary menu-button" aria-label={menuOpen ? "Hide menu" : "Show menu"} title={menuOpen ? "Hide menu" : "Show menu"}
          aria-expanded={menuOpen} aria-controls="workspace-menu" onClick={() => { const next = !menuOpen; setMenuOpen(next); writeLocal("menu-open", next); }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
            <rect x="3" y="4" width="18" height="16" rx="3" /><path d="M9 4v16" />
            <path d={menuOpen ? "m16 9-3 3 3 3" : "m13 9 3 3-3 3"} />
          </svg>
        </button>
        <div className="dex-lights" aria-hidden="true"><span className="dex-lens" /><span className="dex-light" /><span className="dex-light" /></div>
        <h1>Poké<span className="brand-accent">SQL</span></h1>
      </div>
      <div className="header-personalization">
        <button className="btn btn-secondary header-icon profiles-button" ref={profileButton} aria-label="Profiles" title="Trainer ID" aria-pressed={showProfiles} disabled={busy} onClick={actions.openProfiles}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true"><rect x="2" y="3" width="20" height="18" rx="3" /><circle cx="9" cy="9" r="2.5" /><path d="M4.5 18v-1a4.5 4.5 0 0 1 9 0v1M16 8h3m-3 4h3m-3 4h3" /></svg>
        </button>
        <button className="btn btn-secondary header-icon" ref={settingsButton} aria-label="Settings" title="Settings" aria-pressed={showSettings} disabled={busy} onClick={actions.openSettings}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" aria-hidden="true"><path d="M9 2h6l1 4 3-1 3 5-3 2 3 2-3 5-3-1-1 4H9l-1-4-3 1-3-5 3-2-3-2 3-5 3 1Z" /><circle cx="12" cy="12" r="3" /></svg>
        </button>
      </div>
      <div className="header-actions">
        {!showWorkspace ? <>
          <button className="btn btn-secondary" disabled={busy} onClick={actions.returnToWorkspace}>Back to workspace</button>
          {busy ? <button className="btn btn-primary" onClick={() => actions.stop()}>■ Stop query</button> : <button className="btn btn-primary" onClick={actions.openDailyMystery}>Today's mystery</button>}
        </> : <>
        <button className="btn btn-secondary" disabled={busy} onClick={() => void actions.reset()} title="Restore the original database; keeps saved SQL and progress">Reset DB</button>
        </>}
      </div>
    </header>
    <div className={`body${menuOpen ? "" : " menu-collapsed"}`}>
      <Sidebar collapsed={!menuOpen} active={activeNavigation} busy={busy} pokedexCount={encounters.length} pcCount={pc.collection?.captures.length ?? 0} completedCount={completedCount} challengeCount={challengeCount} onNavigate={actions.navigate} />
      <main className={`main${isMystery && showWorkspace ? " mystery-workspace" : ""}`}>
        {!showPc && pc.pendingCount > 0 && pc.error && <div className="notice dataset-update" role="status">{pc.pendingCount} caught Pokémon {pc.pendingCount === 1 ? "is" : "are"} waiting to be saved to PC Boxes. {pc.error} Keep this window open if device storage is blocked. <button className="btn" disabled={pc.busy} onClick={() => void pc.retry()}>Retry PC save</button></div>}
        {showProfiles ? <Profiles name={trainerName} trainer={trainer} identity={trainerIdentity} progress={profileProgress} ballTheme={ballTheme} saveError={profileSaveError}
          featuredPokemon={<FeaturedPokemon collection={pc.collection} busy={pc.busy || pc.pendingCount > 0} error={pc.error} onCommand={pc.command} onRetry={pc.retry} onOpenPc={() => actions.navigate("pc")} />}
          onNameChange={actions.changeTrainerName} onTrainerChange={actions.changeTrainer}
          onDone={() => { actions.closePersonalization(); profileButton.current?.focus(); }} />
        : showSettings ? <Settings ballTheme={ballTheme} autocomplete={autocomplete} safariFleeAfter={safariFleeAfter} saveError={profileSaveError}
          onThemeChange={actions.changeTheme} onAutocompleteChange={actions.changeAutocomplete} onSafariFleeAfterChange={actions.changeSafariFleeAfter}
          onDone={() => { actions.closePersonalization(); settingsButton.current?.focus(); }} />
        : catalogKind ? <PracticeCatalog kind={catalogKind} filters={catalogFilters[catalogKind]} completed={completed} drafts={drafts} busy={busy} onFiltersChange={filters => actions.setCatalogFilters(catalogKind, filters)} onSelect={catalogKind === "samples" ? actions.selectSample : actions.selectChallenge} onFreePractice={() => actions.navigate("workspace")} />
        : libraryView ? <WorkspaceLibrary view={libraryView} schema={editorSchema} history={history} saved={saved} busy={busy} schemaTitle={isMystery ? "Mystery schema" : challenge ? "Challenge schema" : "Schema"}
          onPreviewSql={actions.previewSql} onGuideSql={actions.loadGuideSql} onLoadSql={actions.loadSql} onDeleteSaved={actions.deleteSaved} onClearHistory={actions.clearHistory} />
        : showBag ? <Bag session={safari.session} canUse={safari.phase === "roaming" && !safari.slideMs && !busy} saveError={safari.saveError} onUse={safari.actions.useItem} onClose={actions.openSafari} />
        : showPc ? <PCBoxes collection={pc.collection} error={pc.error} pendingCount={pc.pendingCount} busy={pc.busy} onCommand={pc.command} onRetry={pc.retry} onSafari={actions.openSafari} onProfile={actions.openProfiles} />
        : showSafari ? <SafariZone session={safari.session} phase={safari.phase} slideMs={safari.slideMs} today={today} busy={busy} saveError={safari.saveError} fleeAfter={safariFleeAfter} ballTheme={ballTheme} trainer={trainer} musicLink={areaMusic && <a href="#game-music">♫ Music</a>} onRegion={safari.actions.changeRegion}
          registeredIds={encounters.map(entry => entry.pokemon.id)} results={safari.results} message={safari.message} error={safari.error} onMove={safari.actions.move} onZone={safari.actions.changeZone} onHoneyTree={safari.actions.checkHoneyTree}
          onSmooth={safari.actions.setSmooth} onExplorationSave={safari.actions.saveExploration} onWild={safari.actions.interact}
          onBag={() => actions.navigate("bag")} onPreview={safari.actions.preview} onSubmit={safari.actions.submit} onStop={() => actions.stop()} onLeave={safari.actions.leave} onPokedex={actions.openPokedex} onPc={() => actions.navigate("pc")}
          editor={controls => <SqlEditor draftKey={`safari:${safari.session.encounter?.id ?? "map"}`} value={safari.session.draft} schema={editorSchema}
            onChange={safari.actions.editDraft} onRun={safari.actions.submit} busy={busy} autocomplete={autocomplete} autoFocus actions={controls} />} />
        : showPokedex ? <PersonalPokedex seenIds={seenIds} ownedIds={pc.collection?.captures.map(capture => capture.pokemon.id) ?? []} activeView={pokedexView} onViewChange={actions.setPokedexView} encounters={encounters} catalog={achievementCatalog} saveError={encounterSaveError || seenSaveError} recovered={encountersRecovered} onSafari={actions.openSafari} onDaily={actions.openDailyMystery} onRandom={actions.openRandomMystery} /> : <>
        {datasetUpdateAvailable && !isMystery && !challenge && <div className="notice dataset-update" role="status">
          <strong>New Pokédex fields and forms are available.</strong> Your saved practice database is an older version. Reset DB loads the update and replaces practice database edits. Your SQL drafts, saved queries, and progress stay saved.
          <button className="btn" disabled={busy} onClick={() => void actions.reset()}>Reset DB and load update</button>
        </div>}
        {isMystery && <MysteryPanel trainer={trainer} ballTheme={ballTheme} round={mysteryRound} busy={busy} mode={mysteryMode} date={dailyMysteryRound?.date} today={today}
          onDaily={actions.openDailyMystery} onRandom={actions.openRandomMystery} onNew={() => void actions.newMystery()}
          onLeave={actions.leaveMystery} />}
        {practice && <section className="practice-panel" key={`${selection?.kind}:${practice.id}`} aria-label={challenge ? "Current challenge" : "Get started query"}>
          <div className="challenge-heading"><span className="eyebrow">{challenge?.topic ?? "Get started"}</span><div className="practice-navigation"><button className="sample-btn" disabled={busy} onClick={() => actions.navigate(challenge ? "challenges" : "get-started")}>All {challenge ? "challenges" : "questions"}</button><button className="sample-btn" disabled={busy} onClick={actions.leavePractice}>Back to free practice</button></div></div>
          <h2>{practice.title}</h2><p>{practice.prompt}</p>
          {challenge && <p className="challenge-progress">Training · {completedCount}/{challengeCount} complete</p>}
          <QueryHelp hint={practice.hint} hintSql={practice.hintSql} answer={practice.sql} alternatives={practice.alternatives} busy={busy} onUseAnswer={actions.loadAnswer} />
          <small>{challenge ? "Answers run against the original Pokédex. Your practice database stays separate." : "These examples use your practice database. Reset DB if you want to restore the original data."}</small>
        </section>}
        <div className="editor-label">{isMystery ? "Your next guess" : practice ? "Your answer" : "Free practice"}</div>
        <SqlEditor draftKey={draftKey} value={query} schema={editorSchema} onChange={actions.editQuery}
          onRun={actions.run} busy={busy} autocomplete={autocomplete} actions={
            busy ? <button className="btn btn-primary" onClick={() => actions.stop()}>■ Stop query</button>
              : <button className="btn btn-primary" disabled={!query.trim() || (isMystery && (!mysteryRound || mysterySolved(mysteryRound)))} onClick={actions.run}>Run query <kbd>Ctrl+Enter</kbd></button>
          } />
        <div className="results" aria-busy={busy}>
          <h2 className="results-heading">{isMystery ? "Mystery notebook" : "Query results"}</h2>
          {isMystery && mysteryRound && <MysteryNotebook round={mysteryRound} daily={mysteryMode === "daily"} onOpenPokedex={actions.openPokedex} onOpenPc={() => actions.navigate("pc")} />}
          {(storageError || encounterSaveError) && <p className="notice" role="status">This device could not save your SQL or progress. Keep a copy before closing.</p>}
          {notice && <p className="notice" role="status">{notice}</p>}
          {busy ? <p className="running-notice" role="status">Running SQL… You can stop it at any time. Queries time out after 8 seconds.</p> : <>
            {runState.status === "idle" && (isMystery ? <p className="mystery-idle">{runState.message}</p> : <div className="empty-state">
              <div className="starter-sprites" aria-hidden="true">{[1, 4, 7].map(id => <img key={id} src={`${import.meta.env.BASE_URL}sprites/${id}.png`} alt="" width={72} height={72} />)}</div>
              <p>{runState.message}</p>
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
        <MusicPlayer areaMusic={areaMusic} />
        <footer className="workspace-status"><span>SQLite · stored on this device</span><span role="status">{offlineStatus}</span></footer>
      </main>
    </div>
  </div>;
}
