/*
 * DuoForge Local GLB Vault.
 * Browser-only, same-origin IndexedDB library. No cloud upload, no external server.
 * Content-addressed imports deduplicate identical GLB bytes. Two stores ensure listing
 * models never loads their binary contents into memory.
 */
export const MAX_VAULT_BYTES = 50 * 1024 * 1024;
const DB_NAME = "duoforge-studio-assets-v1";
const DB_VERSION = 1;
const $ = id => document.getElementById(id);

export function cleanAssetName(name) {
 return String(name || "Min modell").replace(/\.glb$/i, "").trim().slice(0, 80) || "Min modell";
}
export async function validateGLB(blob) {
 if (!blob || typeof blob.size !== "number" || blob.size < 20 || blob.size > MAX_VAULT_BYTES)
  throw Error("GLB måste vara mellan 20 byte och 50 MB.");
 const header = new DataView(await blob.slice(0, 12).arrayBuffer());
 if (header.getUint32(0, true) !== 0x46546c67 || header.getUint32(4, true) !== 2
     || header.getUint32(8, true) !== blob.size)
  throw Error("Filen är inte en giltig GLB 2.0 (felaktig header eller filstorlek).");
 return true;
}
async function hashGLB(blob) {
 if (!globalThis.crypto?.subtle) throw Error("Säker webbläsarkontext krävs för lokalt modellbibliotek.");
 const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", await blob.arrayBuffer()));
 return Array.from(digest, byte => byte.toString(16).padStart(2, "0")).join("");
}
function database() {
 return new Promise((resolve, reject) => {
  if (!globalThis.indexedDB) { reject(Error("IndexedDB saknas i webbläsaren.")); return; }
  const req = indexedDB.open(DB_NAME, DB_VERSION);
  req.onupgradeneeded = () => {
   const db = req.result;
   if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta", {keyPath:"id"});
   if (!db.objectStoreNames.contains("blobs")) db.createObjectStore("blobs");
  };
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error || Error("Kunde inte öppna modellbiblioteket."));
  req.onblocked = () => reject(Error("Stäng andra flikar som använder modellbiblioteket."));
 });
}
async function transaction(mode, stores, action) {
 const db = await database();
 try {
  return await new Promise((resolve, reject) => {
   const tx = db.transaction(stores, mode);
   let value;
   tx.oncomplete = () => resolve(value);
   tx.onabort = () => reject(tx.error || Error("Lagring avbruten. Kontrollera ledigt utrymme."));
   tx.onerror = () => {}; // Abort handler supplies the actual rejection.
   try {
    const req = action(tx);
    if (req) {
     req.onsuccess = () => {value = req.result;};
    }
   } catch (error) { tx.abort(); reject(error); }
  });
 } finally { db.close(); }
}
export async function listAssets() {
 const items = await transaction("readonly", ["meta"], tx => tx.objectStore("meta").getAll());
 return items.sort((a,b) => b.updated - a.updated);
}
export async function saveAsset(blob, name) {
 await validateGLB(blob);
 const id = await hashGLB(blob);
 const previous = await transaction("readonly", ["meta"], tx => tx.objectStore("meta").get(id));
 const now = Date.now();
 const meta = {id, name:cleanAssetName(name), bytes:blob.size, added:previous?.added || now, updated:now};
 // Metadata and bytes are committed atomically: never show broken/half-saved models.
 await transaction("readwrite", ["meta","blobs"], tx => {
  tx.objectStore("blobs").put(blob, id);
  tx.objectStore("meta").put(meta);
 });
 return {meta, duplicate:Boolean(previous)};
}
export async function getAsset(id) {
 const [meta, blob] = await Promise.all([
  transaction("readonly", ["meta"], tx => tx.objectStore("meta").get(id)),
  transaction("readonly", ["blobs"], tx => tx.objectStore("blobs").get(id))
 ]);
 if (!meta || !blob) throw Error("Den sparade modellen saknas.");
 await validateGLB(blob);
 return {meta, blob};
}
export async function deleteAsset(id) {
 await transaction("readwrite", ["meta","blobs"], tx => {
  tx.objectStore("meta").delete(id);
  tx.objectStore("blobs").delete(id);
 });
}
function readableSize(bytes) {return bytes >= 1048576 ? (bytes/1048576).toFixed(1)+" MB" : Math.ceil(bytes/1024)+" kB";}
export function initAssetVault({loadGLB, exportSelectedGLB, getSelected, scaleSelected, notify}) {
 const anchor = $("library")?.closest(".panel-section");
 if (!anchor) throw Error("Modellbibliotekets panel saknas.");
 const panel = document.createElement("section");
 panel.className = "panel-section asset-vault";
 panel.id = "assetVaultPanel";
 panel.innerHTML = '<div class="section-heading"><h2>📦 Mina GLB-modeller</h2><span class="mini-pill">Lokalt</span></div>'
  + '<p class="hint">Dina importerade GLB sparas i den här webbläsaren och kan återanvändas i nya scener, film och testvärldar. Inte synkade med DuoForge Sites.</p>'
  + '<div class="asset-vault-actions"><label class="btn" for="importFile">📁 Importera GLB</label><button id="assetVaultSave" type="button">💾 Spara markerad</button></div>'
  + '<div class="asset-vault-actions"><button id="assetVaultScale2" type="button">Skala markerad ×2</button><button id="assetVaultScale10" type="button">×10</button></div>'
  + '<div id="assetVaultStatus" class="hint" role="status" aria-live="polite">Läser dina modeller …</div>'
  + '<div id="assetVaultList" class="asset-vault-list" aria-label="Mina lokala GLB-modeller"></div>';
 anchor.before(panel);
 const css = document.createElement("style");
 css.textContent = '.asset-vault-actions{display:flex;flex-wrap:wrap;gap:8px;margin:9px 0}'
  + '.asset-vault-actions button,.asset-vault-actions .btn{flex:1 1 110px;text-align:center;min-height:43px;display:flex;align-items:center;justify-content:center}'
  + '.asset-vault-list{display:grid;gap:7px;margin-top:8px}'
  + '.asset-vault-row{display:flex;align-items:center;gap:7px;min-width:0;padding:8px;background:#132e33;border:1px solid #285c53;border-radius:9px}'
  + '.asset-vault-row .asset-vault-name{flex:1;min-width:0;overflow-wrap:anywhere;font-size:13px}'
  + '.asset-vault-row small{display:block;color:#abd6c8;font-size:11px;margin-top:3px}'
  + '.asset-vault-row button{min-height:41px;padding:7px 9px;flex:0 0 auto}'
  + '@media(max-width:420px){.asset-vault-row{flex-wrap:wrap}.asset-vault-name{flex-basis:100%!important}}';
 document.head.append(css);
 const status = $("assetVaultStatus"), list = $("assetVaultList");
 let busy = false;
 async function refresh() {
  try {
   const items = await listAssets();
   list.replaceChildren();
   status.textContent = items.length + " sparade modeller på denna enhet. Importera eller välj en modell nedan.";
   for (const item of items) {
    const row = document.createElement("div"); row.className = "asset-vault-row";
    const name = document.createElement("div"); name.className = "asset-vault-name";
    name.textContent = item.name;
    const detail = document.createElement("small"); detail.textContent = readableSize(item.bytes);
    name.append(detail);
    const add = document.createElement("button"); add.type = "button"; add.textContent = "Lägg in";
    add.setAttribute("aria-label", "Lägg in " + item.name);
    add.onclick = async () => {
     if (busy) return; busy = true; add.disabled = true;
     try {
      const {blob, meta} = await getAsset(item.id);
      await loadGLB(blob, meta.name);
      notify(meta.name + " infogad i scenen.");
     } catch (error) {notify("Kunde inte lägga in GLB: " + error.message, 6000);}
     finally {busy = false; add.disabled = false;}
    };
    const remove = document.createElement("button"); remove.type = "button"; remove.textContent = "✕";
    remove.setAttribute("aria-label", "Ta bort " + item.name + " från mitt bibliotek");
    remove.onclick = async () => {
     if (!confirm("Ta bort " + item.name + " från ditt lokala GLB-bibliotek? Modeller i scener påverkas inte.")) return;
     try {await deleteAsset(item.id); await refresh();} catch(error){notify("Kunde inte ta bort: "+error.message,6000);}
    };
    row.append(name, add, remove); list.append(row);
   }
  } catch (error) {
   status.textContent = "Biblioteket kan inte öppnas: " + error.message;
  }
 }
 $("assetVaultSave").onclick = async () => {
  if (busy) return;
  const obj = getSelected();
  if (!obj) return notify("Markera först en modell i scenen.");
  busy = true; $("assetVaultSave").disabled = true;
  try {
   status.textContent = "Exporterar markerad modell till ditt bibliotek …";
   const blob = await exportSelectedGLB();
   const result = await saveAsset(blob, obj.name);
   await refresh();
   notify(result.duplicate ? "Modellen finns redan i biblioteket." : "Markerad modell sparad lokalt i Mina GLB.", 5000);
  } catch(error) {status.textContent = "Kunde inte spara: " + error.message; notify(status.textContent, 6000);}
  finally {busy = false; $("assetVaultSave").disabled = false;}
 };
 for (const [id, factor] of [["assetVaultScale2",2],["assetVaultScale10",10]]) {
  $(id).onclick = () => scaleSelected(factor);
 }
 refresh();
 return {
  async rememberImport(file) {
   try {
    const result = await saveAsset(file, file.name);
    await refresh();
    notify(result.duplicate ? "GLB importerad – finns redan i Mina GLB." : "GLB importerad och sparad i Mina GLB.", 4000);
   } catch(error) {
    notify("GLB importerad, men inte sparad lokalt: " + error.message, 6500);
   }
  },
  refresh
 };
}
