// DuoForge CI Guardian V1: deterministic analysis, never an autonomous code repair.
export function diagnoseFailure(log, step = '') {
  const s = String(log || '').slice(-200000);
  if (/Shader Error|VALIDATE_STATUS false/i.test(s) && /(?:'position'|'uv').*redefinition/i.test(s))
    return {code:'shader-duplicate-attribute', note:'WebGL-shadern deklarerar position/uv dubbelt.', action:'Ta bort dubbla attribut och testa riktig WebGL2-rendering.'};
  if (/locator\.click:\s*Timeout|waiting for locator\(/i.test(s))
    return {code:'ui-click-timeout', note:'Playwright kunde inte klicka på elementet inom tidsgränsen.', action:'Undersök synlighet, overlay, animation och väntelogik innan timeout ändras.'};
  if (/strictEqual|ERR_ASSERTION/i.test(s) && /expected:\s*\d*\.\d+[\s\S]{0,250}actual:\s*\d*\.\d+/i.test(s))
    return {code:'float-precision', note:'Strikt flyttalsjämförelse kan fallera på avrundning.', action:'Kontrollera beräkningen och använd motiverad tolerans där det är matematiskt korrekt.'};
  if (/Cannot find package|ERR_MODULE_NOT_FOUND|Module not found|npm-beroendet.*saknas/i.test(s))
    return {code:'missing-dependency', note:'Ett importerat paket eller modul saknas.', action:'Kontrollera package.json och importsökvägar.'};
  if (/AssertionError|ERR_ASSERTION|not ok \d+/i.test(s))
    return {code:'test-assertion', note:'Ett assertionstest misslyckades.', action:'Jämför faktisk funktion och testkrav mot originalloggen.'};
  if (/Timed out|TimeoutError|timeout\b/i.test(s))
    return {code:'timeout', note:'En operation överskred tidsgränsen.', action:'Kontrollera resursåtgång och externa beroenden.'};
  return {code:'unclassified', note:'Orsaken kan inte fastställas från det tillgängliga underlaget.', action:'Granska originalloggen för steget: '+String(step).slice(0,80)};
}
export function isLatestFailedRun(run, sha) {
  return run?.conclusion === 'failure' && typeof sha === 'string' && run.head_sha === sha;
}
function safe(s) {
  return String(s || '').replace(/[\\`*_{}[\]()#+!|<>]/g,'\\$&').replace(/[\r\n]/g,' ').slice(0,200);
}
export function renderSummary(run, items, current) {
  const header = '## DuoForge CI Guardian – '+safe(run.name)+'\n\n';
  if (!current) return header+'ℹ️ Körningen är inte längre aktuell. Ingen automatisk åtgärd.\n';
  const details = items.length ? items.map(x =>
    '- **'+safe(x.job)+' / '+safe(x.step)+'**: '+safe(x.diagnosis.code)+' — '+safe(x.diagnosis.note)+'\n  - Kontrollera: '+safe(x.diagnosis.action)
  ).join('\n') : '- Felloggen är inte tillgänglig. Öppna originalkörningen.';
  return header+'Gren: '+safe(run.head_branch)+' · SHA: '+safe((run.head_sha || '').slice(0,12))+
    '\n\n'+details+'\n\nSe GitHub Actions: https://github.com/'+safe(run.repository?.full_name)+'/actions/runs/'+Number(run.id)+
    '\n\nDetta är regelbaserad diagnos, inte en verifierad kodreparation. Inga kodändringar eller merge görs automatiskt.\n';
}