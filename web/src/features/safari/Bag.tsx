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
  const quantity = itemQuantity(bag, session.catches, item.id);
  const disabled = !canUse || !quantity || (item.steps > 0 && bag.repelSteps > 0);
  const choosePocket = (next: string) => { setSelectedId(next === "items" ? "repel" : "shiny-charm"); setMessage(""); };
  return <section className="bag-page" aria-labelledby="bag-title">
    <header className="bag-heading"><h2 id="bag-title">Bag</h2><button className="btn" onClick={onClose}>Close Bag</button></header>
    {saveError && <p className="notice" role="status">Your Bag could not be saved on this device. Keep this window open.</p>}
    <div className="bag-screen game-window">
      <div className="bag-pockets" role="group" aria-label="Bag pockets">{[["items", "Items"], ["key-items", "Key Items"]].map(([id, label]) => <button key={id} aria-pressed={pocket === id} onClick={() => choosePocket(id)}>{label}</button>)}</div>
      <div className="bag-inventory">
        <div className="bag-illustration" aria-hidden="true"><svg viewBox="0 0 100 120"><path d="M30 30V20Q50 0 70 20V30"/><path d="M22 29Q50 19 78 29L85 101Q50 119 15 101Z"/><path d="M26 61Q50 53 74 61L76 93Q50 104 24 93Z"/><path d="M18 45H9V82H17M82 45H91V82H83M35 29V47H65V29"/></svg><strong>{pocket === "items" ? "Items" : "Key Items"}</strong></div>
        <div className="bag-list" role="group" aria-label="Bag contents">{BAG_ITEMS.filter(entry => entry.pocket === pocket).map(entry => {
          const count = itemQuantity(bag, session.catches, entry.id);
          return <button key={entry.id} className="bag-item" aria-pressed={item.id === entry.id} onClick={() => { setSelectedId(entry.id); setMessage(""); }}><span className="bag-cursor" aria-hidden="true">▶</span><img src={`${import.meta.env.BASE_URL}sprites/items/${entry.id}.png`} alt="" width={48} height={48}/><span>{entry.name}</span><small>{count ? `× ${count}` : entry.id === "shiny-charm" ? "Locked" : "× 0"}</small></button>;
        })}</div>
      </div>
      <div className="bag-description"><img src={`${import.meta.env.BASE_URL}sprites/items/${item.id}.png`} alt="" width={72} height={72}/><div><h3>{item.name}</h3><p>{item.description}</p>{item.id === "shiny-charm" && !quantity && <p>{Math.min(session.catches, CHARM_UNLOCK_CATCHES)} / {CHARM_UNLOCK_CATCHES} catches</p>}<button className="btn btn-primary" disabled={disabled} onClick={() => {
          onUse(item.id); setMessage(item.id === "shiny-charm" ? bag.charmEnabled ? "Shiny Charm put away." : "Shiny Charm activated." : `Used ${item.name}. Encounters are prevented for ${item.steps} steps.`);
        }}>{item.id === "shiny-charm" ? bag.charmEnabled ? "Put away" : "Activate" : "Use"}</button></div></div>
      <p className="bag-message" role="status">{message || (!canUse ? "Return to the route after this encounter to use items." : bag.repelSteps ? "A Repel is already active." : "Choose an item to use.")}</p>
    </div>
    <div className="bag-effects game-window" aria-label="Active item effects"><span>Repel: <strong>{bag.repelSteps ? `${bag.repelSteps} steps left` : "Inactive"}</strong></span><span>Shiny Charm: <strong>{shinyOdds(bag, session.catches) < SHINY_ODDS ? "Active" : "Inactive"} · 1 in {shinyOdds(bag, session.catches)}</strong></span></div>
    <p className="bag-supplies">Starter supplies: 3 Repels, 1 Super Repel and 1 Max Repel. Earn another Repel every 5 Safari catches. Items affect future encounters only. SQL errors and failed catches never use items.</p>
  </section>;
}
