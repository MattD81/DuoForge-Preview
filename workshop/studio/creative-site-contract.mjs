// Site-side integration contract, NOT a live endpoint.
// A trusted Sites backend must provide auth and storage adapters before this can be used.
import { inspectManifest, MAX_BUNDLE_BYTES } from "./creative-core.mjs";

export async function attachCreativeAsset({
  manifest, model, projectId, session, authorize, findAsset, storeAsset, linkAsset
}) {
  const { file, hash } = inspectManifest(manifest);
  if (typeof projectId !== "string" || !/^[a-zA-Z0-9_-]{4,100}$/.test(projectId)) {
    throw Error("Ett giltigt målprojekt krävs.");
  }
  if (!session || [authorize,findAsset,storeAsset,linkAsset].some(fn => typeof fn !== "function")) {
    throw Error("Sites-authentisering och lagringsadapter saknas.");
  }
  if (!await authorize({ session, projectId, action: "creative:asset-write" })) {
    throw Error("Saknar behörighet till projektet.");
  }
  if (!(model instanceof Blob) && !(model instanceof Uint8Array)) {
    throw Error("Importen kräver en GLB-binärobjekt.");
  }
  const bytes = model instanceof Blob ? new Uint8Array(await model.arrayBuffer()) : model;
  if (!bytes.byteLength || bytes.byteLength > MAX_BUNDLE_BYTES) throw Error("GLB måste vara 1–50 MB.");
  // GLB magic: ASCII "glTF", little-endian format version 2.
  const header = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.byteLength < 12 || header.getUint32(0, true) !== 0x46546c67 ||
      header.getUint32(4, true) !== 2 || header.getUint32(8, true) !== bytes.byteLength) {
    throw Error("Filen är inte en giltig GLB 2.0-container.");
  }
  const digest = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
    .map(n => n.toString(16).padStart(2,"0")).join("");
  if (hash !== digest) throw Error("Kontrollsumman stämmer inte – importen avbröts.");

  // IMPORTANT: findAsset MUST be scoped by the authenticated owner/project; never global public lookup.
  const old = await findAsset({ session, projectId, sha256: hash });
  let assetId = old?.id, deduplicated = Boolean(assetId);
  if (!assetId) {
    const created = await storeAsset({ session, projectId, filename: file,
      data: new Blob([bytes], {type:"model/gltf-binary"}), sha256: hash });
    if (!created?.id) throw Error("Lagringsadaptern returnerade inget resurs-ID.");
    assetId = created.id;
  }
  await linkAsset({ session, projectId, assetId, format: manifest.format, filename: file });
  return { assetId, projectId, reused: deduplicated };
}
