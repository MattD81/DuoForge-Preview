const clone = value => JSON.parse(JSON.stringify(value));

export function mountGamePreview(root, source) {
  root.replaceChildren();

  const header = document.createElement("div");
  header.className = "play-header";
  const heading = document.createElement("div");
  heading.innerHTML = '<div class="eyebrow">SPELBAR PROVYTA</div><h2>Asklandet · ut på vägen</h2><p>Testa rörelse, crafting, bilreparation och uppdragsmål direkt från spelmodulen.</p>';
  const restart = document.createElement("button");
  restart.type = "button";
  restart.className = "secondary";
  restart.textContent = "Starta om";
  header.append(heading, restart);

  const frame = document.createElement("div");
  frame.className = "play-frame";
  const canvas = document.createElement("canvas");
  canvas.width = 960;
  canvas.height = 540;
  canvas.tabIndex = 0;
  canvas.setAttribute("aria-label", "Spelbar Asklandet-förhandsvisning. Använd piltangenter eller WASD och E för att interagera.");
  const hud = document.createElement("div");
  hud.className = "play-hud";
  const objective = document.createElement("div");
  const region = document.createElement("div");
  const inventory = document.createElement("div");
  hud.append(objective, region, inventory);
  frame.append(canvas, hud);

  const controls = document.createElement("div");
  controls.className = "play-controls";
  const dpad = document.createElement("div");
  dpad.className = "play-dpad";
  dpad.setAttribute("role", "group");
  dpad.setAttribute("aria-label", "Rörelsekontroller");
  const actions = document.createElement("div");
  actions.className = "play-actions";
  const message = document.createElement("p");
  message.className = "play-message";
  message.setAttribute("role", "status");
  message.setAttribute("aria-live", "polite");

  const moveButtons = [
    ["up", "↑", "Gå upp"],
    ["left", "←", "Gå vänster"],
    ["down", "↓", "Gå ned"],
    ["right", "→", "Gå höger"]
  ];
  moveButtons.forEach(([direction, symbol, label]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "direction";
    button.textContent = symbol;
    button.setAttribute("aria-label", label);
    button.addEventListener("click", () => move(direction));
    dpad.append(button);
  });
  const interactButton = actionButton("Interagera · E", "Interagera");
  const craftButton = actionButton("Crafta · C", "Crafta");
  const repairButton = actionButton("Reparera · R", "Reparera");
  actions.append(interactButton, craftButton, repairButton);
  controls.append(dpad, actions);

  const help = document.createElement("p");
  help.className = "play-help";
  help.textContent = "Dator: WASD/piltangenter för att gå · E för att interagera · C för att crafta · R för att reparera. Mobil: använd pilarna och åtgärdsknapparna.";
  root.append(header, frame, controls, message, help);

  let state;
  let x;
  let y;
  let particles;
  let animationFrame;
  let active = true;
  const cols = 16;
  const rows = 9;
  const tile = 60;
  const zones = Array.isArray(source?.world?.zones) && source.world.zones.length
    ? source.world.zones
    : [{ id: "start", name: "Asklandet", danger: 1, landmarks: [] }];
  const quests = Array.isArray(source?.quests) ? source.quests : [];
  const firstQuest = quests[0];
  const objectives = Array.isArray(firstQuest?.objectives) ? firstQuest.objectives : [];
  const vehicles = Array.isArray(source?.vehicles) ? source.vehicles : [];
  const recipes = Array.isArray(source?.craftingRecipes) ? source.craftingRecipes : [];
  const scrapCatalog = Array.isArray(source?.scrapCatalog) ? source.scrapCatalog : [];

  function reset() {
    state = clone(source || {});
    if (!state.player || typeof state.player !== "object") state.player = {};
    if (!Array.isArray(state.player.inventory)) state.player.inventory = [];
    if (!state.player.vitals || typeof state.player.vitals !== "object") state.player.vitals = { health: 100 };
    if (!Array.isArray(state.vehicles)) state.vehicles = [];
    if (!Array.isArray(state.quests)) state.quests = [];
    if (!Array.isArray(state.craftingRecipes)) state.craftingRecipes = [];
    x = 2;
    y = 6;
    particles = Array.from({ length: 45 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      speed: 0.18 + Math.random() * 0.5,
      size: 1 + Math.random() * 2
    }));
    message.textContent = "Mira har hittat Gråvädret. Följ markörerna och leta efter reservdelar.";
    updateHud();
    draw();
    if (animationFrame) cancelAnimationFrame(animationFrame);
    animate();
  }

  function setMessage(text) {
    message.textContent = text;
  }

  function currentZoneIndex() {
    return Math.min(zones.length - 1, Math.floor((x / cols) * zones.length));
  }

  function currentZone() {
    return zones[currentZoneIndex()];
  }

  function updateHud() {
    const zone = currentZone();
    const risk = Number.isFinite(zone?.danger) && Number.isFinite(source?.world?.ashfallIntensity)
      ? Math.max(0, Math.min(100, Math.round(zone.danger * 15 + source.world.ashfallIntensity * 30)))
      : Math.max(0, Math.min(100, Math.round((zone?.danger || 1) * 15)));
    const health = state.player?.vitals?.health ?? 100;
    const questProgress = state.questProgress?.[firstQuest?.id] || [];
    const doneCount = questProgress.length;
    const activeObjective = objectives.find(item => !questProgress.includes(item));
    objective.textContent = activeObjective
      ? "UPPDRAG · " + firstQuest.title + " · " + doneCount + "/" + objectives.length + " mål"
      : (firstQuest ? "UPPDRAG KLART · " + firstQuest.title : "UTFORSKA OMRÅDET");
    region.textContent = "ZON · " + (zone?.name || "Asklandet") + " · RISK " + risk + "% · HÄLSA " + health;
    inventory.textContent = state.player.inventory.length
      ? "PACKNING · " + state.player.inventory.map(item => (item.name || item.id) + " ×" + item.quantity).join("  ·  ")
      : "PACKNING · tom";
  }

  function objectivePoint(index) {
    return { x: 6 + (index % 3) * 4, y: index % 2 ? 6 : 2 };
  }

  function drawRuins(ctx, tx, ty, width, height) {
    ctx.fillStyle = "#2c3430";
    ctx.fillRect(tx, ty, width, height);
    ctx.fillStyle = "#49514b";
    ctx.fillRect(tx + 6, ty + 5, width - 12, 8);
    ctx.fillStyle = "#111b1b";
    for (let wx = tx + 10; wx < tx + width - 6; wx += 22) {
      ctx.fillRect(wx, ty + 20, 10, 18);
    }
    ctx.strokeStyle = "#7b7767";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(tx + 3, ty + height - 8);
    ctx.lineTo(tx + width - 5, ty + height - 8);
    ctx.stroke();
  }

  function drawVehicle(ctx, px, py, vehicle) {
    const condition = Math.max(0, Math.min(100, vehicle?.condition ?? 35));
    ctx.fillStyle = "rgba(0,0,0,.38)";
    ctx.fillRect(px + 4, py + 34, 53, 11);
    ctx.fillStyle = condition > 45 ? "#66736a" : "#56514a";
    ctx.beginPath();
    ctx.roundRect(px + 5, py + 14, 50, 24, 5);
    ctx.fill();
    ctx.fillStyle = "#1b2526";
    ctx.fillRect(px + 14, py + 9, 25, 15);
    ctx.fillStyle = "#778a88";
    ctx.fillRect(px + 18, py + 11, 8, 8);
    ctx.fillRect(px + 28, py + 11, 8, 8);
    ctx.fillStyle = "#151b1b";
    ctx.beginPath();
    ctx.arc(px + 15, py + 38, 6, 0, Math.PI * 2);
    ctx.arc(px + 46, py + 38, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#d68c45";
    ctx.fillRect(px + 5, py + 18, 4, 5);
    ctx.fillRect(px + 51, py + 18, 4, 5);
  }

  function draw() {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
    sky.addColorStop(0, "#343d39");
    sky.addColorStop(0.55, "#656454");
    sky.addColorStop(1, "#756950");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const shade = Math.sin(col * 7.3 + row * 15.7) * 5;
        ctx.fillStyle = row === 4 ? "#444642" : "rgb(" + (78 + shade) + "," + (78 + shade) + "," + (65 + shade) + ")";
        ctx.fillRect(col * tile, row * tile, tile, tile);
        if (row !== 4) {
          ctx.fillStyle = "rgba(28,30,26,.25)";
          ctx.fillRect(col * tile + 12, row * tile + 18, 8, 3);
          ctx.fillRect(col * tile + 39, row * tile + 43, 12, 2);
        }
      }
    }
    ctx.fillStyle = "#b0a37d";
    ctx.fillRect(0, 4 * tile + 28, canvas.width, 3);
    ctx.setLineDash([24, 25]);
    ctx.strokeStyle = "#c7ad67";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 4 * tile + 31);
    ctx.lineTo(canvas.width, 4 * tile + 31);
    ctx.stroke();
    ctx.setLineDash([]);

    drawRuins(ctx, 35, 44, 136, 111);
    drawRuins(ctx, 763, 29, 149, 128);
    drawRuins(ctx, 58, 407, 101, 92);
    drawRuins(ctx, 790, 399, 126, 108);

    ctx.fillStyle = "#292c29";
    ctx.beginPath();
    ctx.ellipse(255, 380, 75, 18, -0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#756b53";
    ctx.fillRect(194, 375, 36, 9);
    ctx.fillRect(266, 356, 42, 8);
    ctx.fillRect(301, 378, 26, 10);

    vehicles.forEach((vehicle, index) => {
      const pos = index === 0 ? { x: 3, y: 6 } : { x: 12 + (index % 2), y: 7 };
      drawVehicle(ctx, pos.x * tile, pos.y * tile + 4, state.vehicles[index]);
      ctx.fillStyle = "#e0d0ad";
      ctx.font = "11px ui-monospace, monospace";
      ctx.fillText(vehicle.name || vehicle.id, pos.x * tile, pos.y * tile + 58);
    });

    objectives.forEach((text, index) => {
      const pos = objectivePoint(index);
      const done = (state.questProgress?.[firstQuest?.id] || []).includes(text);
      ctx.fillStyle = done ? "#6fd7b2" : "#dbad5c";
      ctx.beginPath();
      ctx.arc(pos.x * tile + 30, pos.y * tile + 25, 13 + Math.sin(Date.now() / 400 + index) * 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#17201c";
      ctx.font = "bold 12px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillText(done ? "✓" : String(index + 1), pos.x * tile + 30, pos.y * tile + 29);
      ctx.textAlign = "left";
      ctx.fillStyle = "#fff0cd";
      ctx.font = "11px ui-monospace, monospace";
      ctx.fillText(text.slice(0, 27), pos.x * tile - 6, pos.y * tile + 51);
    });

    const salvageX = 13 * tile;
    const salvageY = 2 * tile;
    ctx.fillStyle = "#302b22";
    ctx.fillRect(salvageX + 7, salvageY + 16, 43, 26);
    ctx.fillStyle = "#a37a3e";
    ctx.fillRect(salvageX + 10, salvageY + 10, 36, 8);
    ctx.fillStyle = "#d5b570";
    ctx.fillRect(salvageX + 26, salvageY + 10, 4, 32);
    ctx.fillStyle = "#e8d3a0";
    ctx.font = "11px ui-monospace, monospace";
    ctx.fillText("SKROT", salvageX + 7, salvageY + 57);

    particles.forEach(particle => {
      ctx.fillStyle = "rgba(234,223,190,.55)";
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
    });

    const px = x * tile + 30;
    const py = y * tile + 31;
    ctx.fillStyle = "rgba(0,0,0,.45)";
    ctx.beginPath();
    ctx.ellipse(px, py + 16, 17, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1f2927";
    ctx.beginPath();
    ctx.roundRect(px - 11, py - 2, 22, 23, 6);
    ctx.fill();
    ctx.fillStyle = "#b4a181";
    ctx.beginPath();
    ctx.arc(px, py - 8, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#bd6e3f";
    ctx.beginPath();
    ctx.arc(px, py - 11, 9, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#dce6dd";
    ctx.fillRect(px - 2, py + 3, 4, 12);
    ctx.fillStyle = "rgba(17,22,21,.22)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#f3e4c4";
    ctx.font = "bold 12px ui-monospace, monospace";
    ctx.fillText(state.player.callsign || "UTFORSKARE", px - 33, py - 25);
    const fog = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    fog.addColorStop(0, "rgba(214,202,163,.12)");
    fog.addColorStop(.5, "rgba(209,199,167,.02)");
    fog.addColorStop(1, "rgba(214,202,163,.18)");
    ctx.fillStyle = fog;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  function animate() {
    if (!active) return;
    particles.forEach(p => {
      p.x -= p.speed;
      p.y += p.speed * 0.35;
      if (p.x < -4) { p.x = canvas.width + 4; p.y = Math.random() * canvas.height; }
      if (p.y > canvas.height + 4) p.y = -4;
    });
    draw();
    animationFrame = requestAnimationFrame(animate);
  }

  function move(direction) {
    const delta = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[direction];
    if (!delta) return;
    x = Math.max(0, Math.min(cols - 1, x + delta[0]));
    y = Math.max(0, Math.min(rows - 1, y + delta[1]));
    updateHud();
    draw();
  }

  function nearby(px, py) {
    return Math.abs(x - px) + Math.abs(y - py) <= 1;
  }

  function interact() {
    const progress = state.questProgress?.[firstQuest?.id] || [];
    const nextIndex = objectives.findIndex(item => !progress.includes(item));
    if (nextIndex >= 0) {
      const point = objectivePoint(nextIndex);
      if (nearby(point.x, point.y)) {
        const result = completeQuestObjective(state, firstQuest.id, objectives[nextIndex]);
        if (result) {
          state = result;
          updateHud();
          setMessage("Mål avklarat: " + objectives[nextIndex] + (state.completedQuestIds?.includes(firstQuest.id) ? " · Uppdraget är klart!" : ""));
          return;
        }
      }
    }
    if (nearby(13, 2)) {
      const item = scrapCatalog.find(entry => !state.player.inventory.some(stack => stack.id === entry.id));
      if (item) {
        state = { ...state, player: { ...state.player, inventory: [...state.player.inventory, { id: item.id, name: item.name, quantity: 1, weightKg: item.weightKg || 0.5, rarity: item.rarity || "common" }] } };
        updateHud();
        setMessage("Du hittade " + (item.name || item.id) + " i skrotlådan.");
        return;
      }
    }
    setMessage("Gå nära en gul uppdragsmarkör eller skrotlådan och tryck E.");
  }

  function craft() {
    const recipe = recipes[0];
    if (!recipe) {
      setMessage("Det finns inget recept i JSON-modulen.");
      return;
    }
    const next = craftItem(state, recipe.id);
    if (!next) {
      setMessage("Saknar material för att tillverka " + recipe.name + ".");
      return;
    }
    state = next;
    updateHud();
    setMessage("Tillverkade " + recipe.name + ".");
  }

  function repair() {
    if (!vehicles.length) {
      setMessage("Det finns inget fordon i JSON-modulen.");
      return;
    }
    const pos = { x: 3, y: 6 };
    if (!nearby(pos.x, pos.y)) {
      setMessage("Gå fram till Gråvädret för att reparera det.");
      return;
    }
    const repairPart = scrapCatalog.find(item =>
      Array.isArray(item.uses) &&
      item.uses.includes("vehicle-repair") &&
      state.player.inventory.some(stack => stack.id === item.id && stack.quantity > 0)
    );
    const costItem = repairPart || state.player.inventory.find(item => item.quantity > 0);
    if (!costItem) {
      setMessage("Du behöver en reservdel i packningen för att reparera.");
      return;
    }
    const next = repairVehicle(state, vehicles[0].id, [{ itemId: costItem.id, amount: 1 }], 25);
    if (!next) {
      setMessage("Reparationen gick inte. Bilen kan redan vara fullt lagad.");
      return;
    }
    state = next;
    updateHud();
    setMessage("Gråvädret reparerat med " + (costItem.name || costItem.id) + ".");
  }

  function completeQuestObjective(currentState, questId, objectiveText) {
    const quest = currentState.quests.find(item => item.id === questId);
    if (!quest || !quest.objectives?.includes(objectiveText)) return null;
    const currentProgress = currentState.questProgress || {};
    const completedObjectives = currentProgress[questId] || [];
    if (completedObjectives.includes(objectiveText)) return null;
    const nextObjectives = [...completedObjectives, objectiveText];
    const questProgress = { ...currentProgress, [questId]: nextObjectives };
    const completedQuestIds = currentState.completedQuestIds || [];
    const complete = quest.objectives.every(item => nextObjectives.includes(item));
    return {
      ...currentState,
      questProgress,
      completedQuestIds: complete && !completedQuestIds.includes(questId)
        ? [...completedQuestIds, questId]
        : completedQuestIds
    };
  }

  function craftItem(currentState, recipeId) {
    const recipe = currentState.craftingRecipes.find(item => item.id === recipeId);
    if (!recipe) return null;
    const inventory = consumeItems(currentState.player.inventory, recipe.inputs);
    if (!inventory) return null;
    const existing = inventory.find(item => item.id === recipe.output.id);
    const nextInventory = existing
      ? inventory.map(item => item.id === recipe.output.id
          ? { ...item, quantity: item.quantity + recipe.output.quantity }
          : item)
      : [...inventory, { ...recipe.output }];
    return { ...currentState, player: { ...currentState.player, inventory: nextInventory } };
  }

  function repairVehicle(currentState, vehicleId, costs, conditionGain) {
    if (!Number.isFinite(conditionGain) || conditionGain <= 0) return null;
    const vehicle = currentState.vehicles.find(item => item.id === vehicleId);
    if (!vehicle || vehicle.condition >= 100) return null;
    const inventory = consumeItems(currentState.player.inventory, costs);
    if (!inventory) return null;
    return {
      ...currentState,
      player: { ...currentState.player, inventory },
      vehicles: currentState.vehicles.map(item => item.id === vehicleId
        ? { ...item, condition: Math.min(100, item.condition + conditionGain) }
        : item)
    };
  }

  function consumeItems(items, costs) {
    const next = items.map(item => ({ ...item }));
    for (const cost of costs || []) {
      if (!Number.isInteger(cost.amount) || cost.amount <= 0) return null;
      const stack = next.find(item => item.id === cost.itemId);
      if (!stack || stack.quantity < cost.amount) return null;
      stack.quantity -= cost.amount;
    }
    return next.filter(item => item.quantity > 0);
  }

  const keys = { ArrowUp: "up", w: "up", W: "up", ArrowDown: "down", s: "down", S: "down", ArrowLeft: "left", a: "left", A: "left", ArrowRight: "right", d: "right", D: "right" };
  canvas.addEventListener("keydown", event => {
    const direction = keys[event.key];
    if (direction) { event.preventDefault(); move(direction); return; }
    if (event.key === "e" || event.key === "E" || event.key === " " || event.key === "Enter") { event.preventDefault(); interact(); }
    if (event.key === "c" || event.key === "C") { event.preventDefault(); craft(); }
    if (event.key === "r" || event.key === "R") { event.preventDefault(); repair(); }
  });
  interactButton.addEventListener("click", interact);
  craftButton.addEventListener("click", craft);
  repairButton.addEventListener("click", repair);
  restart.addEventListener("click", reset);
  reset();
  canvas.focus();
  return () => {
    active = false;
    if (animationFrame) cancelAnimationFrame(animationFrame);
    canvas.removeEventListener("keydown", () => {});
  };
}
