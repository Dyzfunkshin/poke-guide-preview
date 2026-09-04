// @ts-check
import { defineConfig } from "@playwright/test";

// The port is overridable because 4173 is not always available on a developer machine.
// On at least one Windows box a `netsh portproxy` rule forwards 0.0.0.0:4173 to another
// host, so the port answers a TCP connect (satisfying a port-only readiness check) and
// then resets every HTTP request - the suite failed with ERR_CONNECTION_RESET before the
// first assertion. Set PW_PORT to route around a conflict; CI keeps 4173.
const PORT = Number(process.env.PW_PORT ?? 4173);
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  retries: 0,
  use: {
    baseURL: BASE_URL,
    headless: true
  },
  webServer: {
    // Bind the loopback address explicitly rather than 0.0.0.0, so the server we start is
    // the one the tests reach and not whatever else may hold the wildcard address.
    command: `python -m http.server ${PORT} --bind 127.0.0.1`,
    // `url` rather than `port`: Playwright then waits for a real HTTP response instead of
    // just an open socket, so a port held by something that is not this site is detected.
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 120000
  }
});
