// Additive Creative Studio bridge. Mounts beside the existing editor; does not replace its renderer.
import {
  categorizeAsset, createLocalAgentPlan, findReuse, makeCreativeManifest,
  makeCreativeZip, qualitySettings, safeAssetName, MAX_BUNDLE_BYTES
} from "./creative-core.mjs";

const DB_NAME = "duoforge-creative-assets-local";
function database() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore("assets", { keyPath: "sha256" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function inStore(mode, action) {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction("assets", mode), request = action(tx.objectStore("assets"));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || Error("Lagring avbruten"));
    });
  } finally { db.close(); }
}
async function digest(bytes) {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
    .map(b => b.toString(16).padStart(2, "0")).join("");
}
function saveBlob(name, blob) {
  const url = URL.createObjectURL(blob), a = document.createElement("a");
  a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 12000);
}

export function initCreativeHub({
  root, renderer, canvas, camera, getSelected, getProjectId, getProjectName,
  exporter, toGLB, loadGLB, renderWorld, notify
}) {
  const sidebar = document.querySelector(".sidebar.right-panel");
  if (!sidebar || document.getElementById("creativeHub")) return;
  const panel = document.createElement("section");
  panel.className = "panel-section";
  panel.id = "creativeHub";
  // Only static, trusted markup is used here.
  panel.innerHTML = [
    '<div class="section-heading"><h2>◈ Creative Studio</h2><span class="mini-pill">BETA • LOKALT</span></div>',
    '<p class="hint">Modeller, spel och film använder samma GLB. Dina tillgångar sparas bara på den här enheten.</p>',
    '<div class="subheading">1. Gemensamma resurser</div>',
    '<button id="creativeSave" class="accent-outline">Spara markerat i lokalt bibliotek</button>',
    '<div id="creativeAssets" class="library" role="status">Läser lokala resurser …</div>',
    '<div class="subheading">2. Grafik och prestanda</div>',
    '<label class="field-label" for="creativeQuality">Grafikprofil för 3D-redigeraren</label>',
    '<select id="creativeQuality"><option value="eco">Mobil / energisnålt</option><option value="balanced" selected>Balanserat</option><option value="high">Hög kvalitet</option></select>',
    '<div class="subheading">3. Från modell till spel och film</div>',
    '<button id="creativeBundle" class="accent">Exportera spelpaket (GLB + manifest)</button>',
    '<div class="row two"><button id="creativePlay">▶ Testspela</button><button id="creativeFilm">🎬 Filmvärld</button></div>',
    '<p class="hint">ZIP-paketet kan hämtas in i ett spelprojekt manuellt. Direktimport till Sites är ännu inte ansluten.</p>',
    '<div class="subheading">4. Lokal resursassistent</div>',
    '<label class="field-label" for="creativePrompt">Vad vill du använda?</label>',
    '<textarea id="creativePrompt" rows="2" placeholder="Exempel: Lägg in en bil och några träd"></textarea>',
    '<button id="creativeFind">Sök återanvändbara objekt</button>',
    '<div id="creativePlan" class="hint" role="status">Söker bara bland dina lokalt sparade objekt. Ingen extern AI.</div>',
    '<button id="creativeApply" disabled>Placera matchande objekt i scenen</button>'
  ].join("");
  const before = sidebar.querySelector("#renderWorldControls");
  sidebar.insertBefore(panel, before || null);
  const $ = id => panel.querySelector("#" + id);
  let knownAssets = [], currentPlan = null, busy = false;

  async function assetRows() {
    knownAssets = (await inStore("readonly", store => store.getAll()))
      .sort((a,b) => b.savedAt-a.savedAt);
    const holder = $("creativeAssets"); holder.replaceChildren();
    if (!knownAssets.length) {
      holder.textContent = "Inga sparade objekt än.";
      return;
    }
    for (const asset of knownAssets.slice(0, 20)) {
      const row = document.createElement("div");
      row.className = "row";
      row.style.cssText = "align-items:center;gap:8px;margin:4px 0;flex-wrap:wrap;";
      const name = document.createElement("small");
      name.style.flex = "1";
      name.textContent = asset.name + " · " + asset.category;
      const use = document.createElement("button");
      use.textContent = "Använd";
      use.setAttribute("aria-label", "Lägg till " + asset.name);
      use.onclick = async () => {
        try { await loadGLB(asset.blob, asset.name); }
        catch(err) { notify("Kan inte öppna resurs: " + err.message, 5000); }
      };
      row.append(name, use); holder.append(row);
    }
    if (knownAssets.length > 20) {
      const more = document.createElement("small");
      more.textContent = "Visar de 20 senaste av " + knownAssets.length + " resurser.";
      holder.append(more);
    }
  }
  async function exportSelection() {
    const selected = getSelected();
    if (!selected) throw Error("Markera ett objekt först.");
    const buffer = await exporter.parseAsync(selected, { binary: true, onlyVisible: true, maxTextureSize: 2048 });
    const blob = new Blob([buffer], { type: "model/gltf-binary" });
    if (blob.size > MAX_BUNDLE_BYTES) throw Error("Max 50 MB per resurs.");
    return blob;
  }
  $("creativeSave").onclick = async () => {
    if (busy) return;
    busy = true; $("creativeSave").disabled = true;
    try {
      const selected = getSelected(), blob = await exportSelection();
      const bytes = await blob.arrayBuffer(), sha256 = await digest(bytes);
      const check = findReuse({sha256, name:selected.name}, knownAssets);
      if (check.status === "reuse") {
        notify("Resursen finns redan i ditt lokala bibliotek.");
        return;
      }
      const name = String(selected.name || getProjectName() || "Objekt").slice(0,100);
      await inStore("readwrite", store => store.put({
        sha256, name, category: categorizeAsset(name), savedAt: Date.now(), blob
      }));
      await assetRows();
      notify(check.status === "review"
        ? "Sparad som ny version (samma namn men annat innehåll)."
        : "Objektet har lagts till i ditt lokala resursbibliotek.");
    } catch(err) { notify("Kunde inte spara resurs: " + err.message, 6000); }
    finally { busy = false; $("creativeSave").disabled = false; }
  };
  $("creativeBundle").onclick = async () => {
    if (busy) return;
    busy = true; $("creativeBundle").disabled = true;
    try {
      notify("Förbereder spelpaket …", 6000);
      const blob = await toGLB(), bytes = new Uint8Array(await blob.arrayBuffer());
      if (bytes.byteLength > MAX_BUNDLE_BYTES - 100000) throw Error("Scenen är för stor för ett 50 MB-paket.");
      const filename = safeAssetName(getProjectName()) + ".glb";
      const hash = await digest(bytes);
      const objects = [];
      root.traverse(obj => {
        if (obj !== root && objects.length < 300) {
          objects.push({ name:obj.name, kind:obj.isMesh ? "mesh" : obj.isGroup ? "group" : "object" });
        }
      });
      const manifest = makeCreativeManifest({
        name:getProjectName(), projectId:getProjectId(), hash, filename, objects
      });
      const zip = makeCreativeZip([
        { name:filename, bytes },
        { name:"duoforge-creative.json", bytes:new TextEncoder().encode(JSON.stringify(manifest,null,2)) }
      ]);
      saveBlob(safeAssetName(getProjectName()) + ".creative.zip", new Blob([zip], {type:"application/zip"}));
      notify("ZIP-paket nedladdat med GLB och matchande manifest.");
    } catch(err) { notify("Export misslyckades: " + err.message, 6500); }
    finally { busy = false; $("creativeBundle").disabled = false; }
  };
  $("creativePlay").onclick = () => {
    document.getElementById("openRenderWorld")?.click();
  };
  $("creativeFilm").onclick = () => {
    document.getElementById("openRenderWorld")?.click();
    notify("Öppna Film Studio i Render World-panelen för kameror och B-roll.", 5000);
  };
  $("creativeQuality").onchange = e => {
    if (renderWorld?.isActive()) {
      notify("Avsluta Render World innan du ändrar redigerarens kvalitet.", 4500);
      e.target.value = "balanced";
      return;
    }
    const settings = qualitySettings(e.target.value, window.devicePixelRatio || 1);
    renderer.setPixelRatio(settings.pixelRatio);
    const width = Math.max(canvas.clientWidth, 1), height = Math.max(canvas.clientHeight, 1);
    renderer.setSize(width, height, false);
    camera.aspect = width / height; camera.updateProjectionMatrix();
    notify("Grafikprofil: " + settings.tier + ". Ingen extern GPU krävs.");
  };
  $("creativeFind").onclick = async () => {
    try {
      await assetRows();
      currentPlan = createLocalAgentPlan($("creativePrompt").value, knownAssets);
      $("creativeApply").disabled = currentPlan.reusable.length === 0;
      $("creativePlan").textContent = currentPlan.requested.length
        ? "Återanvändbara: " + (currentPlan.reusable.map(a=>a.name).join(", ") || "inga") +
          ". Saknas lokalt: " + (currentPlan.missing.join(", ") || "inget") +
          ". Regelbaserad sökning, ingen generativ AI."
        : "Beskriv exempelvis bil, hus, träd, båt eller karaktär.";
    } catch(err) { $("creativePlan").textContent = "Sökfel: " + err.message; }
  };
  $("creativeApply").onclick = async () => {
    if (busy || !currentPlan?.reusable.length) return;
    busy = true; $("creativeApply").disabled = true;
    let placed = 0;
    try {
      for (const asset of currentPlan.reusable.slice(0, 5)) {
        const match = await inStore("readonly", store => store.get(asset.sha256));
        if (match?.blob) { await loadGLB(match.blob, match.name); placed++; }
      }
      notify(placed + " återanvändbara objekt placerade i scenen.");
    } catch(err) { notify("Resursimport avbröts: " + err.message, 6000); }
    finally { busy = false; currentPlan = null; }
  };
  assetRows().catch(err => { $("creativeAssets").textContent = "Lokalt bibliotek saknas: " + err.message; });
}
