// Shared, dependency-free contract for DuoForge Creative Studio (GitHub preview).
// No platform writes, external API calls or private model uploads.
export const CREATIVE_FORMAT = "duoforge-creative-scene@1";
export const MAX_BUNDLE_BYTES = 50 * 1024 * 1024;

export function safeAssetName(input) {
  return String(input || "duoforge-scen").trim().replace(/[^a-zA-Z0-9åäöÅÄÖ _-]/g, "_").replace(/\s+/g, "-").slice(0, 72) || "duoforge-scen";
}

export function categorizeAsset(name) {
  const s = String(name || "").toLowerCase();
  if (/bil|car|kart|vehicle|racing|hjul|truck|tractor|fordon/.test(s)) return "fordon";
  if (/hus|house|bygg|building|stad|city|door|dörr/.test(s)) return "byggnad";
  if (/träd|tree|skog|forest|sten|rock|terrain|berg/.test(s)) return "natur";
  if (/båt|boat|ship|skepp|fartyg|ocean/.test(s)) return "fartyg";
  if (/figur|person|human|avatar|character|robot|monster/.test(s)) return "karaktär";
  return "övrigt";
}

export function makeCreativeManifest({ name, projectId = null, hash, filename, objects = [] }) {
  if (!/^[a-f0-9]{64}$/.test(hash || "")) throw Error("Ogiltig SHA-256-kontrollsumma.");
  if (typeof filename !== "string" || !/^[^/\\]+\.glb$/i.test(filename)) throw Error("Ogiltigt GLB-filnamn.");
  return {
    format: CREATIVE_FORMAT,
    version: 1,
    title: String(name || "DuoForge-scen").slice(0, 120),
    source: { type: "duoforge-preview-local", projectId: projectId || null },
    coordinateSystem: { up: "Y", unit: "meter" },
    asset: { file: filename, mediaType: "model/gltf-binary", sha256: hash },
    objects: objects.slice(0, 300).map(o => ({
      name: String(o.name || "Objekt").slice(0, 100),
      kind: String(o.kind || "object").slice(0, 30),
      category: categorizeAsset(o.name)
    })),
    compatibility: {
      editor: "duoforge-creative-scene@1",
      game: "GLB import via befintlig spelbyggare (manuellt tills Sites-adapter finns)",
      film: "Render World / Film Studio i 3D-studion"
    }
  };
}

export function inspectManifest(input) {
  if (!input || input.format !== CREATIVE_FORMAT || input.version !== 1 ||
      !/^[a-f0-9]{64}$/.test(input.asset?.sha256 || "") ||
      typeof input.asset?.file !== "string" || !/^[^/\\]+\.glb$/i.test(input.asset.file)) {
    throw Error("Okänt eller ofullständigt DuoForge Creative-manifest.");
  }
  return { file: input.asset.file, hash: input.asset.sha256 };
}

export function findReuse(candidate, assets = []) {
  const exact = assets.find(asset => asset.sha256 && asset.sha256 === candidate.sha256);
  if (exact) return { status: "reuse", asset: exact };
  const name = String(candidate.name || "").trim().toLowerCase();
  const possible = name && assets.find(asset => String(asset.name || "").trim().toLowerCase() === name);
  return possible ? { status: "review", asset: possible } : { status: "new", asset: null };
}

const intentPatterns = [
  ["fordon", /\b(bil|bilar|fordon|racerbil|kart|car|vehicle|truck|traktor)\b/i],
  ["byggnad", /\b(hus|husen|byggnad|byggnader|stad|by|house|building)\b/i],
  ["natur", /\b(träd|träden|skog|berg|sten|natur|tree|forest)\b/i],
  ["fartyg", /\b(båt|båtar|skepp|fartyg|ship|boat)\b/i],
  ["karaktär", /\b(människa|person|figur|avatar|karaktär|monster|robot)\b/i]
];
export function createLocalAgentPlan(prompt, assets = []) {
  const requested = intentPatterns.filter(([, pattern]) => pattern.test(String(prompt || ""))).map(([type]) => type);
  const reusable = [];
  const missing = [];
  for (const type of requested) {
    const found = assets.filter(asset => (asset.category || categorizeAsset(asset.name)) === type);
    if (found.length) reusable.push(...found.slice(0, 3));
    else missing.push(type);
  }
  return { requested, reusable: reusable.slice(0, 8), missing,
    mode: "local-rules", note: "Regelbaserad sökning i lokalt bibliotek, inte generativ AI." };
}

export function qualitySettings(tier, devicePixelRatio = 1) {
  const limit = tier === "eco" ? 1 : tier === "high" ? 2 : 1.5;
  return { tier: ["eco","balanced","high"].includes(tier) ? tier : "balanced",
    pixelRatio: Math.min(Math.max(Number(devicePixelRatio) || 1, 0.5), limit) };
}

// Store-only ZIP (no compression or dependency): a GLB plus its metadata in one download.
function checksum(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function header(size) {
  const bytes = new Uint8Array(size);
  return { bytes, v: new DataView(bytes.buffer) };
}
function join(parts) {
  const length = parts.reduce((a,p) => a + p.byteLength, 0);
  const out = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) { out.set(part, offset); offset += part.byteLength; }
  return out;
}
export function makeCreativeZip(files) {
  if (!Array.isArray(files) || files.length < 1 || files.length > 8) throw Error("Ogiltigt antal paketfiler.");
  const encoder = new TextEncoder(), locals = [], central = [];
  let cursor = 0, total = 0;
  for (const file of files) {
    if (typeof file.name !== "string" || !/^[^/\\]{1,120}$/.test(file.name)) throw Error("Osäkert filnamn.");
    if (!(file.bytes instanceof Uint8Array)) throw Error("Paketfil ska vara Uint8Array.");
    total += file.bytes.byteLength;
    if (total > MAX_BUNDLE_BYTES) throw Error("Paketet är större än 50 MB.");
    const name = encoder.encode(file.name), crc = checksum(file.bytes);
    const loc = header(30), c = header(46);
    loc.v.setUint32(0, 0x04034b50, true);
    loc.v.setUint16(4, 20, true); loc.v.setUint16(6, 0x800, true);
    loc.v.setUint32(14, crc, true);
    loc.v.setUint32(18, file.bytes.byteLength, true);
    loc.v.setUint32(22, file.bytes.byteLength, true);
    loc.v.setUint16(26, name.length, true);
    c.v.setUint32(0, 0x02014b50, true);
    c.v.setUint16(4, 20, true); c.v.setUint16(6, 20, true);
    c.v.setUint16(8, 0x800, true);
    c.v.setUint32(16, crc, true);
    c.v.setUint32(20, file.bytes.byteLength, true);
    c.v.setUint32(24, file.bytes.byteLength, true);
    c.v.setUint16(28, name.length, true);
    c.v.setUint32(42, cursor, true);
    locals.push(loc.bytes, name, file.bytes);
    central.push(c.bytes, name);
    cursor += 30 + name.length + file.bytes.byteLength;
  }
  const centralBytes = join(central), end = header(22);
  end.v.setUint32(0, 0x06054b50, true);
  end.v.setUint16(8, files.length, true);
  end.v.setUint16(10, files.length, true);
  end.v.setUint32(12, centralBytes.byteLength, true);
  end.v.setUint32(16, cursor, true);
  return join([...locals, centralBytes, end.bytes]);
}
