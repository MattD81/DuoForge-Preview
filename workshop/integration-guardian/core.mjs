export const INTEGRATIONS = Object.freeze([
  {id:"render-world",name:"Render World",file:"../studio/render-world.mjs",importPath:"./render-world.mjs",bootCall:"initRenderWorld("},
  {id:"material-lab",name:"Material Lab",file:"../studio/material-lab.mjs",importPath:"./material-lab.mjs",bootCall:"initMaterialLab("},
  {id:"character-forge",name:"Character Forge",file:"../studio/character-forge.mjs",importPath:"./character-forge.mjs",bootCall:"initCharacterForge("},
  {id:"fusion-lab",name:"Fusion Lab",file:"../studio/fusion-lab.mjs",importPath:"./fusion-lab.mjs",bootCall:"initFusionLab("},
  {id:"research-stack",name:"Research Stack",file:"../studio/research-stack-ui.mjs",importPath:"./research-stack-ui.mjs",bootCall:"initResearchStack("},
  {id:"sites-cinema-bridge",name:"Sites ↔ Cinema Bridge",file:"../studio/sites-cinema-bridge.mjs",importPath:"./sites-cinema-bridge.mjs",bootCall:"initSitesStudioBridge("},
  {id:"gpu-deluxe-v2",name:"GPU Deluxe V2",file:"../studio/gpu-deluxe-v2-studio.mjs",importPath:"./gpu-deluxe-v2-studio.mjs",bootCall:"initGpuDeluxeV2Studio("},
  {id:"gpu-deluxe-v5",name:"GPU Deluxe V5",file:"../studio/gpu-deluxe-v5-studio.mjs",importPath:"./gpu-deluxe-v5-studio.mjs",bootCall:"initGpuDeluxeV5Studio("},
  {id:"mobile-studio",name:"Mobile Studio UX",file:"../studio/mobile-studio-ux.mjs",importPath:"./mobile-studio-ux.mjs",bootCall:"initStudioMobileUX("}
]);

export async function auditIntegrations({baseUrl, fetcher=fetch}={}) {
  if (!baseUrl) throw new TypeError("baseUrl måste anges");
  const appUrl = new URL("../studio/studio.mjs", baseUrl);
  let appSource = "";
  let appError = "";
  try {
    const response = await fetcher(appUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    appSource = await response.text();
  } catch (error) {
    appError = error instanceof Error ? error.message : String(error);
  }

  return Promise.all(INTEGRATIONS.map(async integration => {
    if (appError) return {...integration,state:"app-unavailable",detail:`Studio-koden kunde inte läsas: ${appError}`};
    const imported = appSource.includes(`from "${integration.importPath}"`) ||
      appSource.includes(`from '${integration.importPath}'`);
    const started = appSource.includes(integration.bootCall);
    let fileAvailable = false;
    let fileDetail = "";
    try {
      const response = await fetcher(new URL(integration.file, baseUrl), {method:"HEAD"});
      fileAvailable = response.ok;
      if (!response.ok) fileDetail = `HTTP ${response.status}`;
    } catch (error) {
      fileDetail = error instanceof Error ? error.message : String(error);
    }

    if (!fileAvailable) return {...integration,state:"module-unavailable",detail:fileDetail||"Källfilen svarar inte"};
    if (!imported) return {...integration,state:"import-missing",detail:"Källfilen finns men import saknas i Studio"};
    if (!started) return {...integration,state:"startup-missing",detail:"Import finns men startanrop saknas i Studio"};
    return {...integration,state:"wired",detail:"Källfil, import och startanrop finns"};
  }));
}

export function summarizeAudit(results) {
  const wired=results.filter(item=>item.state==="wired").length;
  return {wired,total:results.length,issues:results.length-wired};
}
