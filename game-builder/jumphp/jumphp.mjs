/**
 * DuoForge JumPHP browser adapter v1.
 * This module consumes already-built, publicly hosted JumPHP/WASM games.
 * It does not execute raw PHP or assume a live DuoForge Sites backend.
 */
const allowedControls = new Set(["keyboard", "touch", "gamepad", "mouse"]);
const form = document.querySelector("#loadForm");
const input = document.querySelector("#manifestUrl");
const status = document.querySelector("#status");
const viewport = document.querySelector("#viewport");
const title = document.querySelector("#title");
const details = document.querySelector("#details");
const info = document.querySelector("#info");
const restart = document.querySelector("#restart");
const openGame = document.querySelector("#openGame");
let current = null;
let requestController = null;

function say(message, isError = false) {
  status.textContent = message;
  status.style.color = isError ? "#ffb8a6" : "#c5eae0";
}
function httpsUrl(inputUrl) {
  const url = new URL(inputUrl);
  if (url.protocol !== "https:" || url.username || url.password || url.hash) {
    throw new Error("Använd en HTTPS-adress utan användarnamn, lösenord eller fragment.");
  }
  return url;
}
/** No absolute URLs, query strings, backslashes or path traversal in entry. */
export function validateJumphpManifest(data, locationUrl) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Manifestet måste vara ett JSON-objekt.");
  }
  if (data.schemaVersion !== 1 || data.engine !== "jumphp-wasm") {
    throw new Error("Detta är inte ett DuoForge JumPHP/WebAssembly-manifest (version 1).");
  }
  if (typeof data.title !== "string" || data.title.trim().length < 1 || data.title.length > 100) {
    throw new Error("Manifestet saknar giltig speltitel.");
  }
  if (typeof data.id !== "string" || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(data.id)) {
    throw new Error("Manifestet saknar giltigt spel-ID.");
  }
  if (typeof data.entry !== "string" || !/^\.\/[a-zA-Z0-9_./-]+\.html$/.test(data.entry) ||
      data.entry.split("/").some(part => part === ".." || part === "." && data.entry !== "./index.html")) {
    throw new Error("Speladressen måste vara en säker relativ HTML-sökväg (t.ex. ./index.html).");
  }
  if (!Array.isArray(data.controls) || data.controls.some(c => !allowedControls.has(c)) ||
      data.controls.length > 4) {
    throw new Error("Manifestet innehåller okända kontroller.");
  }
  if (!Number.isInteger(data.width) || !Number.isInteger(data.height) ||
      data.width < 160 || data.width > 3840 || data.height < 160 || data.height > 2160) {
    throw new Error("Spelets upplösning måste vara mellan 160 och 3840 × 2160.");
  }
  const manifestUrl = httpsUrl(locationUrl);
  const root = new URL("./", manifestUrl);
  const entryUrl = new URL(data.entry, root);
  if (entryUrl.origin !== root.origin || !entryUrl.pathname.startsWith(root.pathname)) {
    throw new Error("Spelets HTML-fil måste ligga i samma publicerade spelmapp.");
  }
  return { id: data.id, title: data.title.trim(), width: data.width, height: data.height,
    controls: data.controls.slice(), entryUrl };
}

function render() {
  if (!current) return;
  const game = current;
  const newTabLink = document.createElement("a");
  newTabLink.href = game.entryUrl.href;
  newTabLink.target = "_blank";
  newTabLink.rel = "noopener noreferrer";
  newTabLink.textContent = "↗ Spela i en separat flik";
  openGame.href = game.entryUrl.href;
  openGame.hidden = false;
  viewport.style.aspectRatio = String(game.width) + " / " + String(game.height);
  if (game.entryUrl.origin === window.location.origin) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "Av säkerhetsskäl startas spel från samma domän i en separat flik.";
    empty.append(document.createElement("br"), newTabLink);
    viewport.replaceChildren(empty);
    say("Manifest laddat. Spelet öppnas separat för att inte ge spelkoden tillgång till byggarens webbplats.");
  } else {
    const frame = document.createElement("iframe");
    frame.title = game.title;
    frame.src = game.entryUrl.href;
    // Only embed a different origin. allow-same-origin is needed by some WASM asset loaders.
    frame.setAttribute("sandbox", "allow-scripts allow-same-origin allow-pointer-lock allow-forms");
    frame.setAttribute("allow", "fullscreen; gamepad");
    frame.setAttribute("allowfullscreen", "");
    frame.referrerPolicy = "no-referrer";
    viewport.replaceChildren(frame);
    say("Spelrutan laddas. Om servern blockerar inbäddning, välj Öppna spelet separat.");
  }
  restart.disabled = false;
}

async function loadManifest(url) {
  if (requestController) requestController.abort();
  const controller = new AbortController();
  requestController = controller;
  current = null;
  info.hidden = true;
  restart.disabled = true;
  openGame.hidden = true;
  viewport.replaceChildren(Object.assign(document.createElement("div"), {className:"empty", textContent:"Läser manifest ..."}));
  try {
    const manifestUrl = httpsUrl(url);
    // Only a JSON manifest is accepted. Cookies are never sent cross-origin.
    if (!manifestUrl.pathname.endsWith("/duoforge-game.json")) {
      throw new Error("Adressen ska sluta med /duoforge-game.json.");
    }
    say("Hämtar spelmanifest ...");
    const response = await fetch(manifestUrl.href, {signal: controller.signal, credentials:"omit", redirect:"error",
      headers:{"Accept":"application/json"}});
    if (!response.ok) throw new Error("Kunde inte läsa manifestet (HTTP " + response.status + ").");
    if (Number(response.headers.get("content-length") || "0") > 40000) throw new Error("Manifestet är för stort.");
    const raw = await response.text();
    if (raw.length > 40000) throw new Error("Manifestet är för stort.");
    const parsed = validateJumphpManifest(JSON.parse(raw), manifestUrl.href);
    if (controller.signal.aborted) return;
    current = parsed;
    title.textContent = parsed.title;
    details.textContent = parsed.width + " × " + parsed.height + " · " + parsed.controls.join(", ") + " · JumPHP/WebAssembly";
    info.hidden = false;
    try { localStorage.setItem("duoforge-jumphp-last-manifest", manifestUrl.href); } catch {}
    render();
  } catch (error) {
    if (controller.signal.aborted) return;
    say("Kunde inte ladda spelet: " + (error instanceof Error ? error.message : "okänt fel") +
      " Kontrollera även CORS på spelservern.", true);
    viewport.replaceChildren(Object.assign(document.createElement("div"),
      {className:"empty", textContent:"Ingen spelbar build har kunnat verifieras."}));
  } finally {
    if (requestController === controller) requestController = null;
  }
}
form.addEventListener("submit", event => {
  event.preventDefault();
  loadManifest(input.value.trim());
});
restart.addEventListener("click", render);
const fromQuery = new URLSearchParams(window.location.search).get("manifest");
let remembered = "";
try { remembered = localStorage.getItem("duoforge-jumphp-last-manifest") || ""; } catch {}
if (fromQuery || remembered) {
  input.value = fromQuery || remembered;
  if (fromQuery) loadManifest(fromQuery);
}
