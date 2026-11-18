import { createSafariSession, restoreSafariSession } from "./model";

export function loadSafariSession() {
  try {
    return restoreSafariSession(JSON.parse(localStorage.getItem("pokesql:safari") ?? "null")) ?? createSafariSession();
  } catch { return createSafariSession(); }
}
