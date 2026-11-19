import { useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";
import "./Profiles.css";

interface Props {
  title: string; description: string; saveError: boolean;
  onDone: () => void; children: ReactNode;
}

export function PersonalizationPage({ title, description, saveError, onDone, children }: Props) {
  const titleId = useId();
  const page = useRef<HTMLElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    page.current?.scrollIntoView({ block: "start" });
    heading.current?.focus({ preventScroll: true });
  }, []);
  return <section className="profiles-page" ref={page} aria-labelledby={titleId}>
    <header className="profiles-heading">
      <div><h2 id={titleId} ref={heading} tabIndex={-1}>{title}</h2><p>{description}</p></div>
      <button className="btn" onClick={onDone}>Done</button>
    </header>
    {children}
    <p className={saveError ? "notice" : "profile-save-note"} role="status">{saveError ? "This device could not save a profile change. Your changes apply for this session; they may reset when you reopen the app." : "Your changes save automatically on this device."}</p>
  </section>;
}
