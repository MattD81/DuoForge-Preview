# DuoForge Chat → 3D Studio GLB Bridge (beta)

New **💬 Från chatten** in the existing preview Studio. This is an in-browser addition to DuoForge, not a new platform, backend, account, or external 3D editor.

## One-click flow
1. Place a GLB under a **public** DuoForge-owned GitHub repository, preferably `workshop/models/<name>.glb` (or equivalent in another MattD81 repo).
2. Share this URL in ChatGPT as a Studio link (the query parameters must be URL-encoded):
   `https://mattd81.github.io/DuoForge-Preview/workshop/studio/?df_glb=https%3A%2F%2Fmattd81.github.io%2FDuoForge-Preview%2Fworkshop%2Fmodels%2Fname.glb&df_name=DuoForge%20Gran`
3. Opening the link loads the GLB directly into the existing Three.js Studio, selects it, frames it, and retains the usual move/rotate/scale, materials and save/export workflow.
4. Alternatively tap **Från chatten** and enter the public GLB URL. **Kopiera öppningslänk** creates a reusable deep link.

## Restrictions and test status
- A `sandbox:/mnt/data/...` ChatGPT attachment is **not a publicly fetchable HTTPS GLB**. Upload the binary to the approved library first; this public static preview cannot securely fetch a private chat attachment or upload it for you.
- No OpenAI or GitHub login tokens are handled by Studio. Only same-origin GLBs and raw.githubusercontent.com URLs owned by MattD81 are accepted.
- Max size 50 MiB; verifies GLB v2 header/declared length, streams with a size limit and fetch timeout. Any networking/CORS error is shown to the user.
- Existing unsaved scene contents remain unchanged and remote imports append to the scene. A direct-link session skips loading the default demo kart so the GLB is the focus.
- The feature is in **GitHub Preview** only until explicitly installed into the separate DuoForge Sites production code.
- Automated Node tests: `node --test workshop/studio/tests/chat-import-bridge.test.mjs`. Browser/mobile and GitHub Pages end-to-end checks still need execution; do not represent those as passed without running them.
