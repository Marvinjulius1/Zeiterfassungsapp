import "server-only";
import { after } from "next/server";
import { dispatchPendingPush } from "./dispatch";

/** Push-Versand nach der Antwort anstoßen – die Aktion wartet nicht auf Push-Dienste. */
export function schedulePush() {
  after(async () => {
    try {
      await dispatchPendingPush();
    } catch (e) {
      console.error("Push-Versand fehlgeschlagen", e);
    }
  });
}
