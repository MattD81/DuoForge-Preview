const jsonInput = document.querySelector("#json-input");
const rootName = document.querySelector("#root-name");
const language = document.querySelector("#language");
const outputMode = document.querySelector("#output-mode");
const output = document.querySelector("#code-output");
const generateButton = document.querySelector("#generate");
const copyButton = document.querySelector("#copy");
const loadAsklandetButton = document.querySelector("#load-asklandet");
const status = document.querySelector("#status");
const count = document.querySelector("#input-count");
const languageLabel = document.querySelector("#language-label");
const modeHint = document.querySelector("#mode-hint");

const languages = new Map(Array.from(language.options, option => [option.value, option.textContent]));
const wasmUrl = "https://cdn.jsdelivr.net/npm/quickertype-core@0.3.0/dist/native/wasm/quicktype_wasm_bg.wasm";
const apiUrl = "https://esm.sh/quickertype-core@0.3.0?bundle";
let enginePromise;
let previousModelLanguage = "typescript";

const asklandetExample = {
  title: "Asklandet: Vägen genom askan",
  version: "0.1.0",
  settingYear: 2049,
  region: "Sjuhärad, Sverige",
  world: {
    ashfallIntensity: 0.72,
    weatherCycle: ["askregn", "kall dimma", "radiostorm"],
    zones: [
      { id: "kinna", name: "Kinna under askregnet", danger: 2, landmarks: ["övergiven järnvägsstation", "växthus med sprucket glas"] },
      { id: "road41", name: "Väg 41: den rostiga pulsådern", danger: 4, landmarks: ["lastbilskonvoj", "bensinstation utan tak"] },
      { id: "scrapyard", name: "Skrotkatedralen", danger: 5, landmarks: ["bilberg", "radiofyr av reservdelar"] }
    ]
  },
  player: {
    callsign: "Mira",
    role: "vägskrotare",
    vitals: { health: 100, stamina: 84, hunger: 21, thirst: 18, radiation: 7 },
    skills: { mechanics: 2, scavenging: 3, tracking: 1 },
    inventory: [
      { id: "copper-wire", name: "koppartråd", quantity: 4, weightKg: 0.2, rarity: "common" },
      { id: "filter-cloth", name: "filterduk", quantity: 1, weightKg: 0.4, rarity: "uncommon" },
      { id: "tin-coffee", name: "kaffe på burk", quantity: 2, weightKg: 0.3, rarity: "common" },
      { id: "sheet-metal", name: "rostig karossplåt", quantity: 2, weightKg: 1.5, rarity: "common" },
      { id: "radiator-hose", name: "kylarslang", quantity: 1, weightKg: 0.6, rarity: "uncommon" }
    ]
  },
  vehicles: [
    { id: "grey-weather", name: "Nordland 240 — Gråvädret", type: "kombi", condition: 56, fuelLitres: 18, fuelCapacity: 60, cargoSlots: 8, installedParts: ["reparerad kylare", "hemmabyggd hasplåt"] },
    { id: "mole", name: "Mullvaden", type: "pickup", condition: 31, fuelLitres: 7, fuelCapacity: 45, cargoSlots: 5, installedParts: ["förstärkt stötfångare"] }
  ],
  scrapCatalog: [
    { id: "radiator-hose", name: "kylarslang", category: "vehicle-part", salvageDifficulty: 2, uses: ["repair-engine"] },
    { id: "spark-cell", name: "gnistcell", category: "electronics", salvageDifficulty: 4, uses: ["power-radio", "craft-trap"] },
    { id: "sheet-metal", name: "rostig karossplåt", category: "metal", salvageDifficulty: 1, uses: ["armor", "vehicle-repair"] }
  ],
  factions: [
    { id: "road-wardens", name: "Vägväktarna", attitude: "wary", territory: "väg 41", tradeGoods: ["bensin", "batterier"] },
    { id: "ash-garden", name: "Askträdgården", attitude: "friendly", territory: "Kinna växthus", tradeGoods: ["frön", "rent vatten"] }
  ],
  threats: [
    { id: "dust-hound", name: "damhund", kind: "mutated-animal", health: 38, hearsEngine: true, weakness: "flare-light" },
    { id: "scrap-sentinel", name: "skrotväktare", kind: "machine", health: 90, hearsEngine: false, weakness: "emp-charge" }
  ],
  quests: [
    { id: "last-generator", title: "Den sista generatorn", zoneId: "kinna", objectives: ["hitta en gnistcell", "starta växthusets radiofyr"], reward: { scrap: 30, reputation: 2 } },
    { id: "night-run", title: "Nattkörning genom askan", zoneId: "road41", objectives: ["laga kylarslangen", "nå Skrotkatedralen före gryningen"], reward: { fuelLitres: 12, vehiclePart: "förstärkt axel" } }
  ],
  craftingRecipes: [
    {
      id: "filter-mask",
      name: "askfilter",
      inputs: [{ itemId: "filter-cloth", amount: 1 }, { itemId: "copper-wire", amount: 2 }],
      output: { id: "ash-mask", name: "askfilter", quantity: 1, weightKg: 0.3, rarity: "crafted" },
      craftSeconds: 8
    },
    {
      id: "flare-trap",
      name: "bländfälla",
      inputs: [{ itemId: "spark-cell", amount: 1 }, { itemId: "sheet-metal", amount: 2 }],
      output: { id: "flare-trap", name: "bländfälla", quantity: 1, weightKg: 0.7, rarity: "crafted" },
      craftSeconds: 14
    }
  ]
};

function setStatus(message, isError = false) {
  status.textContent = message;
  status.classList.toggle("error", isError);
}

function updateCount() {
  count.textContent = jsonInput.value.length.toLocaleString("sv-SE") + " tecken";
}

function updateMode() {
  const gameMode = outputMode.value === "game";
  if (gameMode) {
    if (!language.disabled) previousModelLanguage = language.value;
    language.value = "typescript";
    language.disabled = true;
    languageLabel.textContent = "Spelmodul · TypeScript";
    modeHint.textContent = "Spelmodulen innehåller typad startdata och genererar system när JSON-strukturen passar: crafting, fordonsreparation, zonrisk och questprogression.";
    generateButton.textContent = "Skapa spelmodul";
  } else {
    if (language.disabled) language.value = previousModelLanguage;
    language.disabled = false;
    languageLabel.textContent = languages.get(language.value) || language.value;
    modeHint.textContent = "Datamodellen omvandlar JSON-exemplet till typad kod i valt språk.";
    generateButton.textContent = "Skapa datamodell";
  }
}

function updateModelLanguage() {
  previousModelLanguage = language.value;
  languageLabel.textContent = languages.get(language.value) || language.value;
}

jsonInput.addEventListener("input", updateCount);
language.addEventListener("change", updateModelLanguage);
outputMode.addEventListener("change", updateMode);

loadAsklandetButton.addEventListener("click", () => {
  jsonInput.value = JSON.stringify(asklandetExample, null, 2);
  rootName.value = "AsklandetGame";
  output.value = "";
  copyButton.disabled = true;
  updateCount();
  setStatus("Asklandet-exemplet är laddat. Välj Skapa spelmodul för att generera kod.");
});

function loadEngine() {
  if (!enginePromise) {
    enginePromise = (async () => {
      let wasmAvailable = false;
      try {
        const response = await fetch(wasmUrl, { mode: "cors" });
        if (!response.ok) throw new Error("WASM download failed");
        const bytes = await response.arrayBuffer();
        globalThis[Symbol.for("quicktype-core.wasmModule")] = await WebAssembly.compile(bytes);
        wasmAvailable = true;
      } catch {
        globalThis[Symbol.for("quicktype-core.wasmModule")] = undefined;
      }
      const api = await import(apiUrl);
      return { api, wasmAvailable };
    })();
  }
  return enginePromise;
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasInventoryModel(sample) {
  return isRecord(sample?.player) &&
    Array.isArray(sample.player.inventory) &&
    sample.player.inventory.every(item =>
      isRecord(item) && typeof item.id === "string" && Number.isFinite(item.quantity)
    );
}

function supportsCrafting(sample) {
  return hasInventoryModel(sample) &&
    Array.isArray(sample.craftingRecipes) &&
    sample.craftingRecipes.every(recipe =>
      isRecord(recipe) &&
      typeof recipe.id === "string" &&
      Array.isArray(recipe.inputs) &&
      recipe.inputs.every(cost =>
        isRecord(cost) && typeof cost.itemId === "string" && Number.isFinite(cost.amount)
      ) &&
      isRecord(recipe.output) &&
      typeof recipe.output.id === "string" &&
      Number.isFinite(recipe.output.quantity)
    );
}

function supportsVehicles(sample) {
  return hasInventoryModel(sample) &&
    Array.isArray(sample.vehicles) &&
    sample.vehicles.every(vehicle =>
      isRecord(vehicle) &&
      typeof vehicle.id === "string" &&
      Number.isFinite(vehicle.condition)
    );
}

function supportsZoneRisk(sample) {
  return isRecord(sample?.world) &&
    Number.isFinite(sample.world.ashfallIntensity) &&
    Array.isArray(sample.world.zones) &&
    sample.world.zones.every(zone =>
      isRecord(zone) && typeof zone.id === "string" && Number.isFinite(zone.danger)
    );
}

function supportsQuests(sample) {
  return Array.isArray(sample?.quests) &&
    sample.quests.every(quest => isRecord(quest) && typeof quest.id === "string");
}

function gameSystems(sample) {
  const systems = [];
  if (supportsCrafting(sample)) systems.push("crafting");
  if (supportsVehicles(sample)) systems.push("reparation");
  if (supportsZoneRisk(sample)) systems.push("zonrisk");
  if (supportsQuests(sample)) systems.push("questprogression");
  return systems;
}

function appendInventoryRuntime(lines) {
  lines.push(
    "type DuoForgeRuntimeItem = { id: string; quantity: number };",
    "type DuoForgeRuntimeCost = { itemId: string; amount: number };",
    "",
    "function consumeDuoForgeItems(",
    "  inventory: DuoForgeRuntimeItem[],",
    "  costs: DuoForgeRuntimeCost[]",
    "): DuoForgeRuntimeItem[] | null {",
    "  const next = inventory.map(item => ({ ...item }));",
    "  for (const cost of costs) {",
    "    if (!Number.isInteger(cost.amount) || cost.amount <= 0) return null;",
    "    const stack = next.find(item => item.id === cost.itemId);",
    "    if (!stack || stack.quantity < cost.amount) return null;",
    "    stack.quantity -= cost.amount;",
    "  }",
    "  return next.filter(item => item.quantity > 0);",
    "}",
    ""
  );
}

function buildGameModule(modelCode, sample, typeName) {
  const systems = gameSystems(sample);
  const lines = [
    modelCode.trim(),
    "",
    "// DuoForge game module: generated from the JSON structure below.",
    "export const initialState: " + typeName + " = " + JSON.stringify(sample, null, 2) + ";",
    "",
    "export function cloneGameState<T>(state: T): T {",
    "  return JSON.parse(JSON.stringify(state)) as T;",
    "}",
    "",
    "export function applyGameUpdate<T>(state: T, update: (draft: T) => void): T {",
    "  const draft = cloneGameState(state);",
    "  update(draft);",
    "  return draft;",
    "}"
  ];

  const needsInventory = supportsCrafting(sample) || supportsVehicles(sample);
  if (needsInventory) appendInventoryRuntime(lines);

  if (supportsCrafting(sample)) {
    lines.push(
      "type DuoForgeRuntimeRecipe = { id: string; inputs: DuoForgeRuntimeCost[]; output: DuoForgeRuntimeItem };",
      "type DuoForgeCraftingState = {",
      "  player: { inventory: DuoForgeRuntimeItem[] };",
      "  craftingRecipes: DuoForgeRuntimeRecipe[];",
      "};",
      "",
      "export function canCraft<T extends DuoForgeCraftingState>(state: T, recipeId: string): boolean {",
      "  const recipe = state.craftingRecipes.find(item => item.id === recipeId);",
      "  return !!recipe && consumeDuoForgeItems(state.player.inventory, recipe.inputs) !== null;",
      "}",
      "",
      "export function craftItem<T extends DuoForgeCraftingState>(state: T, recipeId: string): T | null {",
      "  const recipe = state.craftingRecipes.find(item => item.id === recipeId);",
      "  if (!recipe) return null;",
      "  const inventory = consumeDuoForgeItems(state.player.inventory, recipe.inputs);",
      "  if (!inventory) return null;",
      "  const existing = inventory.find(item => item.id === recipe.output.id);",
      "  const nextInventory = existing",
      "    ? inventory.map(item => item.id === recipe.output.id",
      "        ? { ...item, quantity: item.quantity + recipe.output.quantity }",
      "        : item)",
      "    : [...inventory, { ...recipe.output } as T[\"player\"][\"inventory\"][number]];",
      "  return { ...state, player: { ...state.player, inventory: nextInventory as unknown as T[\"player\"][\"inventory\"] } } as unknown as T;",
      "}"
    );
  }

  if (supportsVehicles(sample)) {
    lines.push(
      "type DuoForgeRuntimeVehicle = { id: string; condition: number };",
      "type DuoForgeVehicleState = {",
      "  player: { inventory: DuoForgeRuntimeItem[] };",
      "  vehicles: DuoForgeRuntimeVehicle[];",
      "};",
      "",
      "export function repairVehicle<T extends DuoForgeVehicleState>(",
      "  state: T,",
      "  vehicleId: string,",
      "  costs: DuoForgeRuntimeCost[],",
      "  conditionGain: number",
      "): T | null {",
      "  if (!Number.isFinite(conditionGain) || conditionGain <= 0) return null;",
      "  const vehicle = state.vehicles.find(item => item.id === vehicleId);",
      "  if (!vehicle || vehicle.condition >= 100) return null;",
      "  const inventory = consumeDuoForgeItems(state.player.inventory, costs);",
      "  if (!inventory) return null;",
      "  return {",
      "    ...state,",
      "    player: { ...state.player, inventory: inventory as unknown as T[\"player\"][\"inventory\"] },",
      "    vehicles: state.vehicles.map(item => item.id === vehicleId",
      "      ? { ...item, condition: Math.min(100, item.condition + conditionGain) }",
      "      : item)",
      "  } as unknown as T;",
      "}"
    );
  }

  if (supportsZoneRisk(sample)) {
    lines.push(
      "type DuoForgeZoneRiskState = {",
      "  world: { ashfallIntensity: number; zones: Array<{ id: string; danger: number }> };",
      "};",
      "",
      "export function zoneRiskScore<T extends DuoForgeZoneRiskState>(state: T, zoneId: string): number | null {",
      "  const zone = state.world.zones.find(item => item.id === zoneId);",
      "  if (!zone) return null;",
      "  return Math.max(0, Math.min(100, Math.round(zone.danger * 15 + state.world.ashfallIntensity * 30)));",
      "}"
    );
  }

  if (supportsQuests(sample)) {
    lines.push(
      "type DuoForgeQuestState = { quests: Array<{ id: string }>; completedQuestIds?: string[] };",
      "",
      "export function completeQuest<T extends DuoForgeQuestState>(",
      "  state: T,",
      "  questId: string",
      "): (T & { completedQuestIds: string[] }) | null {",
      "  if (!state.quests.some(quest => quest.id === questId)) return null;",
      "  const completed = state.completedQuestIds ?? [];",
      "  if (completed.includes(questId)) return null;",
      "  return { ...state, completedQuestIds: [...completed, questId] } as T & { completedQuestIds: string[] };",
      "}"
    );
  }

  const usage = [];
  if (supportsCrafting(sample) && sample.craftingRecipes[0]?.id) {
    usage.push("craftItem(initialState, " + JSON.stringify(sample.craftingRecipes[0].id) + ")");
  }
  if (supportsVehicles(sample)) {
    const vehicleId = sample.vehicles[0]?.id;
    const repairItem = sample.scrapCatalog?.find(item =>
      Array.isArray(item.uses) && item.uses.includes("vehicle-repair") &&
      sample.player.inventory.some(stack => stack.id === item.id && stack.quantity > 0)
    )?.id;
    if (vehicleId && repairItem) {
      usage.push("repairVehicle(initialState, " + JSON.stringify(vehicleId) +
        ", [{ itemId: " + JSON.stringify(repairItem) + ", amount: 1 }], 25)");
    }
  }
  if (supportsZoneRisk(sample) && sample.world.zones[0]?.id) {
    usage.push("zoneRiskScore(initialState, " + JSON.stringify(sample.world.zones[0].id) + ")");
  }
  if (usage.length) {
    lines.push("", "// Starta med exempel:", ...usage.map(line => "// " + line));
  }
  return lines.join("\n").replace(/\n{3,}/g, "\n\n");
}

async function loadEngine() {
  if (!enginePromise) {
    enginePromise = (async () => {
      let wasmAvailable = false;
      try {
        const response = await fetch(wasmUrl, { mode: "cors" });
        if (!response.ok) throw new Error("WASM download failed");
        const bytes = await response.arrayBuffer();
        globalThis[Symbol.for("quicktype-core.wasmModule")] = await WebAssembly.compile(bytes);
        wasmAvailable = true;
      } catch {
        globalThis[Symbol.for("quicktype-core.wasmModule")] = undefined;
      }
      const api = await import(apiUrl);
      return { api, wasmAvailable };
    })();
  }
  try {
    return await enginePromise;
  } catch (error) {
    enginePromise = undefined;
    throw error;
  }
}

generateButton.addEventListener("click", async () => {
  status.classList.remove("error");
  copyButton.disabled = true;
  const source = jsonInput.value;
  const typeName = rootName.value.trim();
  const gameMode = outputMode.value === "game";
  const targetLanguage = gameMode ? "typescript" : language.value;
  let sample;

  if (source.length > 1_000_000) {
    setStatus("JSON-exemplet får vara högst 1 MB.", true);
    return;
  }
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(typeName)) {
    setStatus("Rottypen ska börja med en bokstav eller _ och bara innehålla bokstäver, siffror och _.", true);
    return;
  }
  try {
    sample = JSON.parse(source);
  } catch (error) {
    setStatus("Ogiltig JSON: " + error.message, true);
    return;
  }

  generateButton.disabled = true;
  generateButton.textContent = gameMode ? "Skapar spelmodul…" : "Skapar datamodell…";
  output.value = "";
  setStatus("Laddar kodmotorn och skapar koden lokalt…");
  try {
    const { api, wasmAvailable } = await loadEngine();
    const input = api.jsonInputForTargetLanguage(targetLanguage);
    await input.addSource({ name: typeName, samples: [source] });
    const inputData = new api.InputData();
    inputData.addInput(input);
    const result = await api.quicktype({
      inputData,
      lang: targetLanguage,
      alphabetizeProperties: true,
    });
    const modelCode = result.lines.join("\n");
    output.value = gameMode ? buildGameModule(modelCode, sample, typeName) : modelCode;
    copyButton.disabled = !output.value;
    const systems = gameMode ? gameSystems(sample) : [];
    const resultText = gameMode
      ? "Spelmodul klar: startdata" + (systems.length ? " + " + systems.join(", ") : " + grundläggande state-uppdatering") + "."
      : "Datamodell klar.";
    setStatus(wasmAvailable
      ? resultText + " JSON bearbetades i webbläsaren med WebAssembly."
      : resultText + " JSON bearbetades i webbläsaren med reservmotorn.");
  } catch (error) {
    setStatus("Kunde inte skapa koden. Kontrollera anslutningen och försök igen. " + (error.message || ""), true);
  } finally {
    generateButton.disabled = false;
    updateMode();
  }
});

copyButton.addEventListener("click", async () => {
  if (!output.value) return;
  try {
    await navigator.clipboard.writeText(output.value);
    setStatus("Koden är kopierad.");
  } catch {
    setStatus("Markera och kopiera koden manuellt.", true);
  }
});

jsonInput.value = JSON.stringify(asklandetExample, null, 2);
rootName.value = "AsklandetGame";
updateCount();
updateMode();
setStatus("Asklandet-exemplet laddas. Skapa spelmodulen när du är redo.");
