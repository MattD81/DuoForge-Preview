const jsonInput = document.querySelector("#json-input");
const rootName = document.querySelector("#root-name");
const language = document.querySelector("#language");
const output = document.querySelector("#code-output");
const generateButton = document.querySelector("#generate");
const copyButton = document.querySelector("#copy");
const status = document.querySelector("#status");
const count = document.querySelector("#input-count");
const languageLabel = document.querySelector("#language-label");

const languages = new Map(Array.from(language.options, option => [option.value, option.textContent]));
const wasmUrl = "https://cdn.jsdelivr.net/npm/quickertype-core@0.3.0/dist/native/wasm/quicktype_wasm_bg.wasm";
const apiUrl = "https://esm.sh/quickertype-core@0.3.0?bundle";
let enginePromise;

function setStatus(message, isError = false) {
  status.textContent = message;
  status.classList.toggle("error", isError);
}

function updateCount() {
  count.textContent = jsonInput.value.length.toLocaleString("sv-SE") + " tecken";
}
jsonInput.addEventListener("input", updateCount);
language.addEventListener("change", () => {
  languageLabel.textContent = languages.get(language.value) || language.value;
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

generateButton.addEventListener("click", async () => {
  status.classList.remove("error");
  copyButton.disabled = true;
  const source = jsonInput.value;
  const typeName = rootName.value.trim();
  if (source.length > 1_000_000) {
    setStatus("JSON-exemplet får vara högst 1 MB.", true);
    return;
  }
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(typeName)) {
    setStatus("Rottypen ska börja med en bokstav eller _ och bara innehålla bokstäver, siffror och _.", true);
    return;
  }
  try {
    JSON.parse(source);
  } catch (error) {
    setStatus("Ogiltig JSON: " + error.message, true);
    return;
  }

  generateButton.disabled = true;
  generateButton.textContent = "Skapar modell…";
  output.value = "";
  setStatus("Laddar kodmotorn och skapar modellen lokalt…");
  try {
    const { api, wasmAvailable } = await loadEngine();
    const input = api.jsonInputForTargetLanguage(language.value);
    await input.addSource({ name: typeName, samples: [source] });
    const inputData = new api.InputData();
    inputData.addInput(input);
    const result = await api.quicktype({
      inputData,
      lang: language.value,
      alphabetizeProperties: true,
    });
    output.value = result.lines.join("\n");
    copyButton.disabled = !output.value;
    setStatus(wasmAvailable
      ? "Klart. JSON-exemplet bearbetades i webbläsaren med WebAssembly."
      : "Klart. JSON-exemplet bearbetades i webbläsaren med reservmotorn.");
  } catch (error) {
    setStatus("Kunde inte skapa modellen. Kontrollera anslutningen och försök igen. " + (error.message || ""), true);
  } finally {
    generateButton.disabled = false;
    generateButton.textContent = "Skapa modell";
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

updateCount();