import { useState } from "react";
import { BAG_ITEMS, CHARM_UNLOCK_CATCHES, createBag, itemQuantity, shinyOdds, SHINY_ODDS } from "./bag-model";
import type { BagItemId } from "./bag-model";
import type { SafariSession } from "./types";
import "./Bag.css";

export function Bag({ session, canUse, saveError, onUse, onClose }: {
  session: SafariSession; canUse: boolean; saveError: boolean;
  onUse: (id: BagItemId) => void; onClose: () => void;
}) {
  const [selectedId, setSelectedId] = useState<BagItemId>("repel");
  const [message, setMessage] = useState("");
  const bag = session.bag ?? createBag();
  const item = BAG_ITEMS.find(item => item.id === selectedId)!;
  const pocket = item.pocket;
  const quantity = itemQuantity(session.catches, item.id);
  const disabled = !canUse || !quantity || (item.steps > 0 && bag.repelSteps > 0);
  const choosePocket = (next: string) => { setSelectedId(next === "items" ? "repel" : "shiny-charm"); setMessage(""); };
  return <section className="bag-page" aria-labelledby="bag-title">
    <header className="bag-heading"><h2 id="bag-title">Bag</h2><button className="btn" onClick={onClose}>Close Bag</button></header>
    {saveError && <p className="notice" role="status">Your Bag could not be saved on this device. Keep this window open.</p>}
    <div className="bag-screen game-window">
      <div className="bag-pockets" role="group" aria-label="Bag pockets">{[["items", "Items"], ["key-items", "Key Items"]].map(([id, label]) => <button key={id} aria-pressed={pocket === id} onClick={() => choosePocket(id)}>{label}</button>)}</div>
      <div className="bag-inventory">
        <div className="bag-illustration" aria-hidden="true"><img src={`${import.meta.env.BASE_URL}safari/bag.png`} alt="" width={128} height={128} /><strong>{pocket === "items" ? "Items" : "Key Items"}</strong></div>
        <div className="bag-list" role="group" aria-label="Bag contents">{BAG_ITEMS.filter(entry => entry.pocket === pocket).map(entry => {
          const count = itemQuantity(session.catches, entry.id);
          return <button key={entry.id} className="bag-item" aria-pressed={item.id === entry.id} onClick={() => { setSelectedId(entry.id); setMessage(""); }}><span className="bag-cursor" aria-hidden="true">▶</span><img src={`${import.meta.env.BASE_URL}sprites/items/${entry.id}.png`} alt="" width={48} height={48}/><span>{entry.name}</span><small>{count === Infinity ? "Unlimited" : count ? `× ${count}` : "Locked"}</small></button>;
        })}</div>
      </div>
      <div className="bag-description"><img src={`${import.meta.env.BASE_URL}sprites/items/${item.id}.png`} alt="" width={72} height={72}/><div><h3>{item.name}</h3><p>{item.description}</p>{item.id === "shiny-charm" && !quantity && <p>{Math.min(session.catches, CHARM_UNLOCK_CATCHES)} / {CHARM_UNLOCK_CATCHES} catches</p>}<button className="btn btn-primary" disabled={disabled} onClick={() => {
          onUse(item.id); setMessage(item.id === "shiny-charm" ? bag.charmEnabled ? "Shiny Charm put away." : "Shiny Charm activated." : `Used ${item.name}. Encounters are prevented for ${item.steps} steps.`);
        }}>{item.id === "shiny-charm" ? bag.charmEnabled ? "Put away" : "Activate" : "Use"}</button></div></div>
      <p className="bag-message" role="status">{message || (!canUse ? "Return to the route after this encounter to use items." : bag.repelSteps ? "A Repel is already active." : "Choose an item to use.")}</p>
    </div>
    <div className="bag-effects game-window" aria-label="Active item effects"><span>Repel: <strong>{bag.repelSteps ? `${bag.repelSteps} steps left` : "Inactive"}</strong></span><span>Shiny Charm: <strong>{shinyOdds(bag, session.catches) < SHINY_ODDS ? "Active" : "Inactive"} · 1 in {shinyOdds(bag, session.catches)}</strong></span></div>
    <p className="bag-supplies">Repels are unlimited for now. Use another when the current Repel wears off. Items affect future encounters only. SQL errors and failed catches never use items.</p>
  </section>;
}
