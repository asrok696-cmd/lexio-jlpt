import { setClientCookie, clearClientCookie } from "./auth";

export const DIAG_DONE_COOKIE = "lexio.diag.done.v1";

export function markDiagnosticDone() {
  setClientCookie(DIAG_DONE_COOKIE, "1");
}

export function clearDiagnosticDone() {
  clearClientCookie(DIAG_DONE_COOKIE);
}
