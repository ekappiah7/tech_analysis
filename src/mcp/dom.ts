import { JSDOM } from "jsdom";

/**
 * The MetaTrader importer reads statements with `DOMParser`, which exists in
 * browsers and not in Node. Installing jsdom's implementation on `globalThis`
 * lets the exact same parser code serve both the web app and this MCP server,
 * rather than maintaining a second HTML reader that would drift out of step
 * with the first.
 */
export function installDomParser(): void {
  if (typeof globalThis.DOMParser === "undefined") {
    const { window } = new JSDOM("");
    globalThis.DOMParser = window.DOMParser;
  }
}
