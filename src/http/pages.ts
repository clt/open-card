export function acceptanceResultsPage(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Open Card Acceptance Results</title>
    <style>
      :root {
        color-scheme: light;
        --ink: #17211d;
        --muted: #66736d;
        --line: #d9e0db;
        --page: #f5f7f1;
        --surface: #ffffff;
        --soft: #edf4ef;
        --green: #187348;
        --green-soft: #dff2e6;
        --red: #ae2437;
        --red-soft: #f8dfe4;
        --blue: #1c5f8f;
        --gold: #9d6b14;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        min-height: 100vh;
        background: var(--page);
        color: var(--ink);
        font-family:
          Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
          "Segoe UI", sans-serif;
        letter-spacing: 0;
      }

      button {
        font: inherit;
      }

      .shell {
        width: min(1200px, calc(100% - 32px));
        margin: 0 auto;
        padding: 28px 0 36px;
      }

      header {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 16px;
        align-items: end;
        margin-bottom: 18px;
      }

      h1 {
        margin: 0;
        font-size: clamp(2rem, 4.5vw, 4.8rem);
        line-height: 0.95;
        letter-spacing: 0;
      }

      .lede {
        max-width: 760px;
        margin: 12px 0 0;
        color: var(--muted);
        font-size: 1rem;
        line-height: 1.5;
      }

      .actions {
        display: flex;
        gap: 10px;
        align-items: center;
        justify-content: flex-end;
      }

      .button {
        min-height: 40px;
        border: 1px solid #163d33;
        border-radius: 6px;
        background: #163d33;
        color: #fff;
        cursor: pointer;
        padding: 0 14px;
        font-weight: 800;
      }

      .button:disabled {
        cursor: progress;
        opacity: 0.72;
      }

      .pill {
        min-width: 110px;
        border: 1px solid var(--line);
        border-radius: 999px;
        background: var(--surface);
        color: var(--muted);
        padding: 8px 12px;
        text-align: center;
        font-size: 0.86rem;
        font-weight: 800;
      }

      .pill.pass {
        border-color: #8ccaa5;
        background: var(--green-soft);
        color: var(--green);
      }

      .pill.fail {
        border-color: #e6a2ad;
        background: var(--red-soft);
        color: var(--red);
      }

      .metrics {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 10px;
        margin-bottom: 16px;
      }

      .metric {
        min-height: 78px;
        border: 1px solid var(--line);
        border-radius: 8px;
        background: var(--surface);
        padding: 12px;
      }

      .metric span {
        display: block;
        color: var(--muted);
        font-size: 0.78rem;
        font-weight: 800;
        text-transform: uppercase;
      }

      .metric strong {
        display: block;
        margin-top: 8px;
        font-size: 1.5rem;
        line-height: 1;
      }

      .grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 14px;
      }

      .scenario {
        border: 1px solid var(--line);
        border-radius: 8px;
        background: var(--surface);
        overflow: hidden;
      }

      .scenario-head {
        display: flex;
        min-height: 62px;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        border-bottom: 1px solid var(--line);
        padding: 14px;
      }

      h2 {
        margin: 0;
        font-size: 1.04rem;
        letter-spacing: 0;
      }

      .scenario-subtitle {
        margin-top: 4px;
        color: var(--muted);
        font-size: 0.88rem;
      }

      .body {
        display: grid;
        gap: 12px;
        padding: 12px;
      }

      .counts {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 8px;
      }

      .count {
        min-height: 58px;
        border: 1px solid var(--line);
        border-radius: 8px;
        background: var(--soft);
        padding: 10px;
      }

      .count span {
        display: block;
        color: var(--muted);
        font-size: 0.76rem;
        font-weight: 800;
      }

      .count strong {
        display: block;
        margin-top: 6px;
        font-size: 1.2rem;
      }

      .assertions,
      .steps {
        display: grid;
        gap: 8px;
        margin: 0;
        padding: 0;
        list-style: none;
      }

      .assertion,
      .step {
        min-height: 46px;
        border: 1px solid var(--line);
        border-radius: 8px;
        background: #fbfcfa;
        padding: 10px;
      }

      .assertion.pass {
        border-color: #8ccaa5;
        background: var(--green-soft);
      }

      .assertion.fail {
        border-color: #e6a2ad;
        background: var(--red-soft);
      }

      .assertion strong,
      .step strong {
        display: block;
        margin-bottom: 3px;
        font-size: 0.92rem;
      }

      .assertion span,
      .step span {
        display: block;
        color: var(--muted);
        font-size: 0.84rem;
        line-height: 1.35;
        overflow-wrap: anywhere;
      }

      .step span {
        color: var(--blue);
      }

      .error {
        border-color: #e6a2ad;
        background: var(--red-soft);
        color: var(--red);
      }

      @media (max-width: 900px) {
        .shell {
          width: min(100% - 20px, 680px);
          padding-top: 18px;
        }

        header,
        .metrics,
        .grid,
        .counts {
          grid-template-columns: 1fr;
        }

        header {
          align-items: start;
        }

        .actions {
          justify-content: flex-start;
          flex-wrap: wrap;
        }
      }
    </style>
  </head>
  <body>
    <main class="shell">
      <header>
        <div>
          <h1>Acceptance Results</h1>
          <p class="lede">The page runs the public API through two real table setups and displays each physical-table assertion.</p>
        </div>
        <div class="actions">
          <span id="overall-status" class="pill" data-testid="overall-status">Queued</span>
          <button id="run-button" class="button" type="button" data-testid="run-acceptance">Run tests</button>
        </div>
      </header>

      <section class="metrics" aria-label="Acceptance summary">
        <div class="metric"><span>Scenarios</span><strong id="metric-scenarios">0/2</strong></div>
        <div class="metric"><span>Assertions</span><strong id="metric-assertions">0/0</strong></div>
        <div class="metric"><span>Cards checked</span><strong id="metric-cards">0</strong></div>
        <div class="metric"><span>Last run</span><strong id="metric-last-run">Pending</strong></div>
      </section>

      <section class="grid" id="results" data-testid="acceptance-results"></section>
    </main>

    <script>
      const scenarios = [
        {
          id: "holdem",
          title: "Texas hold'em",
          subtitle: "5 players, private hands, board, burn, draw",
          run: runHoldem,
        },
        {
          id: "big-two",
          title: "鋤大弟",
          subtitle: "4 players, full-deck round-robin deal",
          run: runBigTwo,
        },
      ];

      const state = {
        passedScenarios: 0,
        assertions: 0,
        passedAssertions: 0,
        cardsChecked: 0,
      };

      const elements = {
        button: document.querySelector("#run-button"),
        status: document.querySelector("#overall-status"),
        scenarios: document.querySelector("#metric-scenarios"),
        assertions: document.querySelector("#metric-assertions"),
        cards: document.querySelector("#metric-cards"),
        lastRun: document.querySelector("#metric-last-run"),
        results: document.querySelector("#results"),
      };

      function setStatus(text, mode) {
        elements.status.textContent = text;
        elements.status.className = "pill" + (mode ? " " + mode : "");
      }

      function reset() {
        state.passedScenarios = 0;
        state.assertions = 0;
        state.passedAssertions = 0;
        state.cardsChecked = 0;
        elements.results.replaceChildren();
        setStatus("Running", "");
        renderMetrics();
      }

      function renderMetrics() {
        elements.scenarios.textContent = String(state.passedScenarios) + "/" + String(scenarios.length);
        elements.assertions.textContent = String(state.passedAssertions) + "/" + String(state.assertions);
        elements.cards.textContent = String(state.cardsChecked);
        elements.lastRun.textContent = new Date().toLocaleTimeString();
      }

      function makeScenarioNode(scenario) {
        const section = document.createElement("article");
        section.className = "scenario";
        section.dataset.testid = "scenario-" + scenario.id;
        section.innerHTML =
          '<div class="scenario-head">' +
            '<div><h2></h2><div class="scenario-subtitle"></div></div>' +
            '<span class="pill">Running</span>' +
          '</div>' +
          '<div class="body">' +
            '<div class="counts"></div>' +
            '<ol class="steps"></ol>' +
            '<ol class="assertions"></ol>' +
          '</div>';

        section.querySelector("h2").textContent = scenario.title;
        section.querySelector(".scenario-subtitle").textContent = scenario.subtitle;
        elements.results.append(section);

        return {
          root: section,
          status: section.querySelector(".pill"),
          counts: section.querySelector(".counts"),
          steps: section.querySelector(".steps"),
          assertions: section.querySelector(".assertions"),
        };
      }

      function addStep(view, title, detail) {
        const item = document.createElement("li");
        item.className = "step";
        const label = document.createElement("strong");
        label.textContent = title;
        const text = document.createElement("span");
        text.textContent = detail;
        item.append(label, text);
        view.steps.append(item);
      }

      function setCounts(view, counts) {
        view.counts.replaceChildren();
        for (const entry of counts) {
          const item = document.createElement("div");
          item.className = "count";
          const label = document.createElement("span");
          label.textContent = entry.label;
          const value = document.createElement("strong");
          value.textContent = String(entry.value);
          item.append(label, value);
          view.counts.append(item);
        }
      }

      function assertResult(view, title, detail, passed) {
        state.assertions += 1;
        if (passed) {
          state.passedAssertions += 1;
        }

        const item = document.createElement("li");
        item.className = "assertion " + (passed ? "pass" : "fail");
        const label = document.createElement("strong");
        label.textContent = (passed ? "PASS: " : "FAIL: ") + title;
        const text = document.createElement("span");
        text.textContent = detail;
        item.append(label, text);
        view.assertions.append(item);
        renderMetrics();

        if (!passed) {
          throw new Error(title + " failed: " + detail);
        }
      }

      async function request(method, path, body) {
        const response = await fetch(path, {
          method,
          headers: body === undefined ? undefined : { "content-type": "application/json" },
          body: body === undefined ? undefined : JSON.stringify(body),
        });
        const text = await response.text();
        const data = text ? JSON.parse(text) : null;

        if (!response.ok) {
          const message = data && data.error ? data.error : method + " " + path + " returned " + response.status;
          throw new Error(message);
        }

        return data;
      }

      async function addPlayer(tableId, name) {
        return (await request("POST", "/tables/" + tableId + "/players", { name: name })).player;
      }

      async function addZone(tableId, input) {
        return (await request("POST", "/tables/" + tableId + "/zones", input)).zone;
      }

      async function getTable(tableId, viewerPlayerId) {
        const suffix = viewerPlayerId ? "?viewerPlayerId=" + encodeURIComponent(viewerPlayerId) : "";
        return request("GET", "/tables/" + tableId + suffix);
      }

      function zoneByName(table, name) {
        const zone = table.zones.find(function (candidate) {
          return candidate.name === name;
        });

        if (!zone) {
          throw new Error("Missing zone " + name);
        }

        return zone;
      }

      function allCardIds(table) {
        return table.zones.flatMap(function (zone) {
          return zone.cards.map(function (card) {
            return card.id;
          });
        });
      }

      async function runHoldem(view) {
        const table = await request("POST", "/tables", { name: "Texas hold'em acceptance" });
        const players = [];
        for (const name of ["Alice", "Ben", "Carl", "Dana", "Eli"]) {
          players.push(await addPlayer(table.id, name));
        }
        addStep(view, "Table created", table.id);

        const draw = await addZone(table.id, { name: "Draw" });
        const burn = await addZone(table.id, { name: "Burn" });
        const board = await addZone(table.id, { name: "Board" });
        const hands = [];
        for (const player of players) {
          hands.push(await addZone(table.id, { name: player.name + " Hand", ownerPlayerId: player.id }));
        }
        addStep(view, "Zones created", "Draw, Burn, Board, and 5 private hands");

        const deck = await request("POST", "/tables/" + table.id + "/decks", { zoneId: draw.id });
        const originalDeckIds = zoneByName(deck.table, "Draw").cards.map(function (card) {
          return card.id;
        });
        addStep(view, "Deck added", "52 hidden face-down cards in Draw");

        await request("POST", "/tables/" + table.id + "/deal", {
          fromZoneId: draw.id,
          toZoneIds: hands.map(function (hand) { return hand.id; }),
          cardsPerTarget: 2,
          from: "top",
          to: "bottom",
          actorPlayerId: players[0].id,
        });
        addStep(view, "Private cards dealt", "2 cards round-robin to each player");

        await burnOne(table.id, draw.id, burn.id, players[0].id);
        await moveToBoard(table.id, draw.id, board.id, 3, players[0].id);
        await flipBoard(table.id, board.id, 3, "top", players[0].id);
        await burnOne(table.id, draw.id, burn.id, players[0].id);
        await moveToBoard(table.id, draw.id, board.id, 1, players[0].id);
        await flipBoard(table.id, board.id, 1, "bottom", players[0].id);
        await burnOne(table.id, draw.id, burn.id, players[0].id);
        await moveToBoard(table.id, draw.id, board.id, 1, players[0].id);
        await flipBoard(table.id, board.id, 1, "bottom", players[0].id);
        addStep(view, "Board dealt", "Burn/flop/burn/turn/burn/river");

        const publicTable = await getTable(table.id);
        const aliceView = await getTable(table.id, players[0].id);
        const drawZone = zoneByName(publicTable, "Draw");
        const burnZone = zoneByName(publicTable, "Burn");
        const boardZone = zoneByName(publicTable, "Board");
        const cardIds = allCardIds(publicTable);
        state.cardsChecked += cardIds.length;

        setCounts(view, [
          { label: "Players", value: players.length },
          { label: "Draw", value: drawZone.count },
          { label: "Board", value: boardZone.count },
          { label: "Burn", value: burnZone.count },
        ]);

        assertResult(view, "private hand counts", "Each of 5 players has 2 cards.", players.every(function (player) {
          return zoneByName(publicTable, player.name + " Hand").count === 2;
        }));
        assertResult(view, "table zone counts", "Board 5, burn 3, draw 34.", boardZone.count === 5 && burnZone.count === 3 && drawZone.count === 34);
        assertResult(view, "52 physical card IDs preserved", "All zones together still make up the original deck.", sortedEqual(cardIds, originalDeckIds));
        assertResult(view, "no duplicate cards", String(new Set(cardIds).size) + " unique cards.", new Set(cardIds).size === 52);
        assertResult(view, "private visibility", "Alice sees Alice Hand; Ben Hand remains hidden.", zoneByName(aliceView, "Alice Hand").cards.every(isKnown) && zoneByName(aliceView, "Ben Hand").cards.every(isUnknown));
        assertResult(view, "public board visibility", "Board identities are visible; burn cards are hidden.", boardZone.cards.every(isKnownUp) && burnZone.cards.every(isUnknownDown));
      }

      async function runBigTwo(view) {
        const table = await request("POST", "/tables", { name: "鋤大弟 acceptance" });
        const players = [];
        for (const name of ["North", "East", "South", "West"]) {
          players.push(await addPlayer(table.id, name));
        }
        addStep(view, "Table created", table.id);

        const draw = await addZone(table.id, { name: "Draw" });
        const hands = [];
        for (const player of players) {
          hands.push(await addZone(table.id, { name: player.name + " Hand", ownerPlayerId: player.id }));
        }
        addStep(view, "Zones created", "Draw and 4 private hands");

        const deck = await request("POST", "/tables/" + table.id + "/decks", { zoneId: draw.id });
        const originalDeckIds = zoneByName(deck.table, "Draw").cards.map(function (card) {
          return card.id;
        });
        addStep(view, "Deck added", "52 hidden face-down cards in Draw");

        await request("POST", "/tables/" + table.id + "/deal", {
          fromZoneId: draw.id,
          toZoneIds: hands.map(function (hand) { return hand.id; }),
          cardsPerTarget: 13,
          from: "top",
          to: "bottom",
          actorPlayerId: players[0].id,
        });
        addStep(view, "Deck dealt", "13 cards round-robin to each player");

        const publicTable = await getTable(table.id);
        const northView = await getTable(table.id, players[0].id);
        const drawZone = zoneByName(publicTable, "Draw");
        const cardIds = allCardIds(publicTable);
        state.cardsChecked += cardIds.length;

        setCounts(view, [
          { label: "Players", value: players.length },
          { label: "Draw", value: drawZone.count },
          { label: "Hand size", value: 13 },
          { label: "Cards", value: cardIds.length },
        ]);

        assertResult(view, "hand counts", "Each of 4 players has 13 cards.", players.every(function (player) {
          return zoneByName(publicTable, player.name + " Hand").count === 13;
        }));
        assertResult(view, "draw is empty", "Draw has " + String(drawZone.count) + " cards.", drawZone.count === 0);
        assertResult(view, "52 physical card IDs preserved", "All hands together still make up the original deck.", sortedEqual(cardIds, originalDeckIds));
        assertResult(view, "no duplicate cards", String(new Set(cardIds).size) + " unique cards.", new Set(cardIds).size === 52);
        assertResult(view, "private visibility", "North sees North Hand; East Hand remains hidden.", zoneByName(northView, "North Hand").cards.every(isKnown) && zoneByName(northView, "East Hand").cards.every(isUnknown));
      }

      async function burnOne(tableId, drawZoneId, burnZoneId, actorPlayerId) {
        await request("POST", "/tables/" + tableId + "/move", {
          fromZoneId: drawZoneId,
          toZoneId: burnZoneId,
          selection: { type: "count", count: 1, from: "top" },
          to: "bottom",
          actorPlayerId: actorPlayerId,
        });
      }

      async function moveToBoard(tableId, drawZoneId, boardZoneId, count, actorPlayerId) {
        await request("POST", "/tables/" + tableId + "/move", {
          fromZoneId: drawZoneId,
          toZoneId: boardZoneId,
          selection: { type: "count", count: count, from: "top" },
          to: "bottom",
          actorPlayerId: actorPlayerId,
        });
      }

      async function flipBoard(tableId, boardZoneId, count, from, actorPlayerId) {
        await request("POST", "/tables/" + tableId + "/flip", {
          selection: { type: "zoneCount", zoneId: boardZoneId, count: count, from: from },
          face: "up",
          actorPlayerId: actorPlayerId,
        });
      }

      function isKnown(card) {
        return card.unknown === false && typeof card.code === "string";
      }

      function isKnownUp(card) {
        return isKnown(card) && card.face === "up";
      }

      function isUnknown(card) {
        return card.unknown === true && card.code === undefined;
      }

      function isUnknownDown(card) {
        return isUnknown(card) && card.face === "down";
      }

      function sortedEqual(left, right) {
        return JSON.stringify(left.slice().sort()) === JSON.stringify(right.slice().sort());
      }

      async function runAll() {
        elements.button.disabled = true;
        reset();

        for (const scenario of scenarios) {
          const view = makeScenarioNode(scenario);

          try {
            await scenario.run(view);
            view.status.textContent = "Passed";
            view.status.className = "pill pass";
            state.passedScenarios += 1;
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            view.status.textContent = "Failed";
            view.status.className = "pill fail";
            const item = document.createElement("li");
            item.className = "step error";
            const label = document.createElement("strong");
            label.textContent = "Run failed";
            const text = document.createElement("span");
            text.textContent = message;
            item.append(label, text);
            view.steps.append(item);
          }

          renderMetrics();
        }

        const passed = state.passedScenarios === scenarios.length && state.passedAssertions === state.assertions;
        setStatus(passed ? "Passed" : "Failed", passed ? "pass" : "fail");
        elements.button.disabled = false;
      }

      elements.button.addEventListener("click", runAll);
      runAll();
    </script>
  </body>
</html>`;
}
