/// <reference lib="dom" />

import {
  canPass,
  chooseAutomatedPlay,
  containsCardCode,
  legalPlays,
  sortCards,
  validatePlay,
  type Combo,
  type KnownCard,
  type PlayContext,
} from "./big2";
import { OpenCardApi, type ApiLogEntry, type Player, type ProjectedCard, type ProjectedTable, type ProjectedZone } from "./openCardApi";

type Seat = {
  player: Player;
  handZoneId: string;
};

type Snapshot = {
  table: ProjectedTable;
  hands: Map<string, KnownCard[]>;
  currentPlayCards: KnownCard[];
  currentPlayCount: number;
  events: Array<{ id: string; type: string; summary: string; createdAt: string }>;
};

type ActivePlay = {
  playerId: string;
  playerName: string;
  combo: Combo;
  cards: KnownCard[];
};

type RoundTurn =
  | {
      id: string;
      action: "play";
      playerId: string;
      playerName: string;
      comboLabel: string;
      cards: KnownCard[];
    }
  | {
      id: string;
      action: "pass";
      playerId: string;
      playerName: string;
    };

type WonRound = {
  id: string;
  number: number;
  winnerPlayerId: string;
  winnerName: string;
  winningComboLabel: string;
  winningCards: KnownCard[];
  turns: RoundTurn[];
  totalCards: number;
};

type Big2Game = {
  currentPlayerId: string;
  activePlay: ActivePlay | null;
  passes: number;
  isFirstPlay: boolean;
  winnerPlayerId: string | null;
  turnNumber: number;
};

type ZoneIds = {
  deck: string;
  currentPlay: string;
  finishedPile: string;
};

type DemoState = {
  apiUrl: string;
  mode: "step" | "auto";
  manualPlayerId: string;
  tableId: string | null;
  seats: Seat[];
  zones: ZoneIds | null;
  snapshot: Snapshot | null;
  game: Big2Game | null;
  selectedCardIds: Set<string>;
  currentRoundTurns: RoundTurn[];
  wonRounds: WonRound[];
  expandedRoundId: string | null;
  roundTurnSequence: number;
  wonRoundSequence: number;
  apiLogs: ApiLogEntry[];
  gameLog: string[];
  status: string;
  busy: boolean;
  autoTimer: number | undefined;
};

const playerNames = ["North", "East", "South", "West"];
const defaultApiUrl = "http://localhost:3000";

const state: DemoState = {
  apiUrl: localStorage.getItem("open-card-big2-api-url") ?? defaultApiUrl,
  mode: "step",
  manualPlayerId: "none",
  tableId: null,
  seats: [],
  zones: null,
  snapshot: null,
  game: null,
  selectedCardIds: new Set(),
  currentRoundTurns: [],
  wonRounds: [],
  expandedRoundId: null,
  roundTurnSequence: 0,
  wonRoundSequence: 0,
  apiLogs: [],
  gameLog: [],
  status: "Ready.",
  busy: false,
  autoTimer: undefined,
};

const apiUrlInput = element<HTMLInputElement>("#api-url");
const newGameButton = element<HTMLButtonElement>("#new-game");
const checkApiButton = element<HTMLButtonElement>("#check-api");
const stepButton = element<HTMLButtonElement>("#step-turn");
const playButton = element<HTMLButtonElement>("#play-selected");
const passButton = element<HTMLButtonElement>("#pass-turn");
const manualPlayerSelect = element<HTMLSelectElement>("#manual-player");
const statusText = element<HTMLElement>("#status-text");
const tableMeta = element<HTMLElement>("#table-meta");
const playersGrid = element<HTMLElement>("#players-grid");
const currentPlay = element<HTMLElement>("#current-play");
const validationText = element<HTMLElement>("#validation-text");
const eventsList = element<HTMLElement>("#events-list");
const apiLogList = element<HTMLElement>("#api-log-list");
const gameLogList = element<HTMLElement>("#game-log-list");

apiUrlInput.value = state.apiUrl;
newGameButton.addEventListener("click", () => void runTask(startNewGame));
checkApiButton.addEventListener("click", () => void runTask(checkApi));
stepButton.addEventListener("click", () => void runTask(stepTurn));
playButton.addEventListener("click", () => void runTask(playSelectedCards));
passButton.addEventListener("click", () => void runTask(passTurn));
manualPlayerSelect.addEventListener("change", () => {
  state.manualPlayerId = manualPlayerSelect.value;
  render();
  scheduleAutoPlay();
});
apiUrlInput.addEventListener("change", () => {
  state.apiUrl = normalizeApiUrl(apiUrlInput.value);
  apiUrlInput.value = state.apiUrl;
  localStorage.setItem("open-card-big2-api-url", state.apiUrl);
  render();
});

for (const button of document.querySelectorAll<HTMLButtonElement>("[data-mode]")) {
  button.addEventListener("click", () => {
    state.mode = button.dataset.mode === "auto" ? "auto" : "step";
    render();
    scheduleAutoPlay();
  });
}

render();
void runTask(checkApi);

async function checkApi(): Promise<void> {
  const response = await api().health();
  state.status = response.ok ? "Open Card API is reachable." : "Open Card API did not return ok.";
}

async function startNewGame(): Promise<void> {
  stopAutoPlay();
  state.selectedCardIds.clear();
  state.apiLogs = [];
  state.gameLog = [];
  state.seats = [];
  state.zones = null;
  state.snapshot = null;
  state.game = null;
  state.currentRoundTurns = [];
  state.wonRounds = [];
  state.expandedRoundId = null;
  state.roundTurnSequence = 0;
  state.wonRoundSequence = 0;
  state.status = "Creating table.";
  render();

  const client = api();
  const table = await client.createTable(`Big 2 demo ${new Date().toLocaleTimeString()}`);
  const players: Player[] = [];

  for (const name of playerNames) {
    const result = await client.addPlayer(table.id, name);
    players.push(result.player);
  }

  const actorPlayerId = players[0]!.id;
  await client.setDealer(table.id, {
    actor: { type: "nonPlayer", name: "Big 2 demo" },
    positionPlayerId: actorPlayerId,
    actorPlayerId,
  });

  const deck = await client.createZone(table.id, { name: "Deck", defaultVisibility: "none" });
  const currentPlayZone = await client.createZone(table.id, { name: "Current play", defaultVisibility: "everyone" });
  const finishedPile = await client.createZone(table.id, { name: "Finished pile", defaultVisibility: "everyone" });
  const seats: Seat[] = [];

  for (const player of players) {
    const hand = await client.createZone(table.id, {
      name: `${player.name} hand`,
      ownerPlayerId: player.id,
      defaultVisibility: { type: "owner" },
    });
    seats.push({ player, handZoneId: hand.zone.id });
  }

  await client.addDeck(table.id, deck.zone.id, actorPlayerId);
  await client.shuffleZone(table.id, deck.zone.id, actorPlayerId);
  await client.dealCards(table.id, {
    fromZoneId: deck.zone.id,
    toZoneIds: seats.map((seat) => seat.handZoneId),
    cardsPerTarget: 13,
    from: "top",
    to: "bottom",
    actorPlayerId,
  });

  state.tableId = table.id;
  state.seats = seats;
  state.zones = {
    deck: deck.zone.id,
    currentPlay: currentPlayZone.zone.id,
    finishedPile: finishedPile.zone.id,
  };
  await refreshSnapshot();

  const starter = state.seats.find((seat) => containsCardCode(handFor(seat.player.id), "3D")) ?? state.seats[0]!;
  state.game = {
    currentPlayerId: starter.player.id,
    activePlay: null,
    passes: 0,
    isFirstPlay: true,
    winnerPlayerId: null,
    turnNumber: 1,
  };
  state.manualPlayerId = starter.player.id;
  appendGameLog(`${starter.player.name} opens with 3D.`);
  state.status = "Game ready.";
}

async function stepTurn(): Promise<void> {
  const game = requireGame();
  const currentPlayer = requireCurrentPlayer();

  if (game.winnerPlayerId !== null) {
    state.status = "Game complete.";
    return;
  }

  if (state.manualPlayerId === currentPlayer.id) {
    state.status = `${currentPlayer.name} is waiting for a manual play.`;
    return;
  }

  await playAutomatedTurn(currentPlayer);
}

async function playSelectedCards(): Promise<void> {
  const game = requireGame();
  const player = requireCurrentPlayer();

  if (game.winnerPlayerId !== null || player.id !== state.manualPlayerId) {
    return;
  }

  const selectedCards = selectedCardsForCurrentPlayer();
  const validation = validatePlay(selectedCards, playContext());

  if (!validation.ok) {
    state.status = validation.message;
    return;
  }

  await commitPlay(player, validation.combo, selectedCards);
}

async function passTurn(): Promise<void> {
  const game = requireGame();
  const player = requireCurrentPlayer();
  let roundWinnerName: string | null = null;

  if (game.winnerPlayerId !== null) {
    return;
  }

  if (!canPass(playContext())) {
    state.status = "Lead player must play.";
    return;
  }

  state.selectedCardIds.clear();
  appendRoundPass(player);
  appendGameLog(`${player.name} passes.`);
  game.passes += 1;

  if (game.passes >= state.seats.length - 1 && game.activePlay !== null) {
    const winningPlay = game.activePlay;
    const leadPlayer = playerById(game.activePlay.playerId);
    await finishCurrentRound(leadPlayer, winningPlay, player.id);
    game.currentPlayerId = leadPlayer.id;
    game.activePlay = null;
    game.passes = 0;
    roundWinnerName = leadPlayer.name;
    appendGameLog(`${leadPlayer.name} takes the trick and leads next.`);
    await refreshSnapshot();
  } else {
    game.currentPlayerId = nextPlayerId(player.id);
  }

  game.turnNumber += 1;
  state.status = roundWinnerName === null ? "Turn passed." : `${roundWinnerName} wins the round.`;
}

async function playAutomatedTurn(player: Player): Promise<void> {
  const hand = handFor(player.id);
  const candidate = chooseAutomatedPlay(hand, playContext());

  if (candidate === null) {
    await passTurn();
    return;
  }

  await commitPlay(player, candidate.combo, candidate.cards);
}

async function commitPlay(player: Player, combo: Combo, cards: KnownCard[]): Promise<void> {
  const client = api();
  const game = requireGame();
  const zones = requireZones();
  const handZoneId = handZoneIdFor(player.id);
  const sortedCards = sortCards(cards);
  const cardIds = sortedCards.map((card) => card.id);
  const handSizeBeforePlay = handFor(player.id).length;

  await clearCurrentPlay(player.id);
  const moved = await client.moveCards(requireTableId(), {
    fromZoneId: handZoneId,
    toZoneId: zones.currentPlay,
    selection: { type: "cardIds", cardIds },
    to: "bottom",
    actorPlayerId: player.id,
  });
  await client.flipCards(requireTableId(), {
    selection: { type: "cardIds", cardIds: moved.cardIds },
    face: "up",
    actorPlayerId: player.id,
  });

  game.activePlay = {
    playerId: player.id,
    playerName: player.name,
    combo,
    cards: sortedCards,
  };
  appendRoundPlay(player, combo, sortedCards);
  game.passes = 0;
  game.isFirstPlay = false;
  state.selectedCardIds.clear();
  appendGameLog(`${player.name} plays ${combo.label}: ${sortedCards.map((card) => card.code).join(" ")}.`);

  await refreshSnapshot();

  if (handSizeBeforePlay === sortedCards.length) {
    await finishCurrentRound(player, game.activePlay, player.id);
    await refreshSnapshot();
    game.activePlay = null;
    game.winnerPlayerId = player.id;
    state.status = `${player.name} wins.`;
    appendGameLog(`${player.name} wins the hand.`);
    return;
  }

  game.currentPlayerId = nextPlayerId(player.id);
  game.turnNumber += 1;
  state.status = `${player.name} played ${combo.label}.`;
}

async function clearCurrentPlay(actorPlayerId: string, count = state.snapshot?.currentPlayCount ?? 0): Promise<void> {
  const snapshot = state.snapshot;
  const zones = requireZones();

  if (snapshot === null || count === 0) {
    return;
  }

  await api().moveCards(requireTableId(), {
    fromZoneId: zones.currentPlay,
    toZoneId: zones.finishedPile,
    selection: { type: "count", count, from: "top" },
    to: "bottom",
    actorPlayerId,
  });
}

async function finishCurrentRound(winner: Player, winningPlay: ActivePlay, actorPlayerId: string): Promise<void> {
  const turns = [...state.currentRoundTurns];
  const totalCards = turns.reduce((total, turn) => total + (turn.action === "play" ? turn.cards.length : 0), 0);

  state.wonRoundSequence += 1;
  state.wonRounds.unshift({
    id: `round_${state.wonRoundSequence}`,
    number: state.wonRoundSequence,
    winnerPlayerId: winner.id,
    winnerName: winner.name,
    winningComboLabel: winningPlay.combo.label,
    winningCards: winningPlay.cards,
    turns,
    totalCards,
  });
  state.currentRoundTurns = [];
  await clearCurrentPlay(actorPlayerId, winningPlay.cards.length);
}

function appendRoundPlay(player: Player, combo: Combo, cards: KnownCard[]): void {
  state.currentRoundTurns.push({
    id: nextRoundTurnId(),
    action: "play",
    playerId: player.id,
    playerName: player.name,
    comboLabel: combo.label,
    cards,
  });
}

function appendRoundPass(player: Player): void {
  state.currentRoundTurns.push({
    id: nextRoundTurnId(),
    action: "pass",
    playerId: player.id,
    playerName: player.name,
  });
}

function nextRoundTurnId(): string {
  state.roundTurnSequence += 1;
  return `turn_${state.roundTurnSequence}`;
}

async function refreshSnapshot(): Promise<void> {
  const tableId = requireTableId();
  const projections = await Promise.all(state.seats.map((seat) => api().getTable(tableId, seat.player.id)));
  const table = projections[0] ?? (await api().getTable(tableId));
  const hands = new Map<string, KnownCard[]>();

  for (const [index, seat] of state.seats.entries()) {
    const projection = projections[index] ?? table;
    const handZone = projection.zones.find((zone) => zone.id === seat.handZoneId);
    hands.set(seat.player.id, handZone === undefined ? [] : knownCards(handZone.cards));
  }

  const zones = requireZones();
  const currentPlayZone = table.zones.find((zone) => zone.id === zones.currentPlay);
  const eventResponse = await api().getEvents(tableId);

  state.snapshot = {
    table,
    hands,
    currentPlayCards: currentPlayZone === undefined ? [] : knownCards(currentPlayZone.cards),
    currentPlayCount: currentPlayZone?.count ?? 0,
    events: eventResponse.events,
  };
}

async function runTask(task: () => Promise<void>): Promise<void> {
  if (state.busy) {
    return;
  }

  state.busy = true;
  stopAutoPlay();
  render();

  try {
    await task();
  } catch (error) {
    state.status = error instanceof Error ? error.message : "Unexpected error.";
  } finally {
    state.busy = false;
    render();
    scheduleAutoPlay();
  }
}

function render(): void {
  statusText.textContent = state.busy ? "Working." : state.status;
  renderModeButtons();
  renderManualPlayers();
  renderTableMeta();
  renderPlayers();
  renderCurrentPlay();
  renderLogs();
  renderControls();
}

function renderModeButtons(): void {
  for (const button of document.querySelectorAll<HTMLButtonElement>("[data-mode]")) {
    button.classList.toggle("is-active", button.dataset.mode === state.mode);
  }
}

function renderManualPlayers(): void {
  const previousValue = manualPlayerSelect.value || state.manualPlayerId;
  manualPlayerSelect.replaceChildren(option("No manual seat", "none"));

  for (const seat of state.seats) {
    manualPlayerSelect.append(option(seat.player.name, seat.player.id));
  }

  if (state.seats.some((seat) => seat.player.id === previousValue)) {
    state.manualPlayerId = previousValue;
  } else if (state.seats.some((seat) => seat.player.id === state.manualPlayerId)) {
    manualPlayerSelect.value = state.manualPlayerId;
    return;
  } else {
    state.manualPlayerId = "none";
  }

  manualPlayerSelect.value = state.manualPlayerId;
}

function renderTableMeta(): void {
  const game = state.game;
  const snapshot = state.snapshot;

  if (game === null || snapshot === null) {
    tableMeta.textContent = "No active table.";
    return;
  }

  const currentPlayer = playerById(game.currentPlayerId);
  const winner = game.winnerPlayerId === null ? null : playerById(game.winnerPlayerId);
  const active = game.activePlay === null ? "open lead" : `${game.activePlay.playerName} ${game.activePlay.combo.label}`;
  tableMeta.textContent = winner === null
    ? `Turn ${game.turnNumber} | ${currentPlayer.name} to act | ${active} | passes ${game.passes}`
    : `Winner: ${winner.name} | table ${snapshot.table.id}`;
}

function renderPlayers(): void {
  playersGrid.replaceChildren();

  if (state.snapshot === null) {
    playersGrid.append(emptyState("Start a game to deal four hands."));
    return;
  }

  for (const seat of state.seats) {
    const player = seat.player;
    const hand = sortCards(handFor(player.id));
    const panel = document.createElement("section");
    const isCurrent = state.game?.currentPlayerId === player.id;
    const isManual = state.manualPlayerId === player.id;
    const isWinner = state.game?.winnerPlayerId === player.id;
    panel.className = ["player-panel", isCurrent ? "is-current" : "", isWinner ? "is-winner" : ""].filter(Boolean).join(" ");

    const header = document.createElement("header");
    header.className = "player-header";
    const title = document.createElement("div");
    title.innerHTML = `<strong>${escapeHtml(player.name)}</strong><span>${hand.length} cards</span>`;
    const mode = document.createElement("span");
    mode.className = isManual ? "seat-mode manual" : "seat-mode";
    mode.textContent = isManual ? "manual" : "auto";
    header.append(title, mode);

    const cards = document.createElement("div");
    cards.className = "hand";

    for (const card of hand) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = ["card", isRedSuit(card) ? "red" : "black", state.selectedCardIds.has(card.id) ? "selected" : ""]
        .filter(Boolean)
        .join(" ");
      button.textContent = card.code;
      button.title = card.label ?? card.code;
      button.disabled = !canSelectCardsFor(player.id);
      button.addEventListener("click", () => toggleSelectedCard(card.id));
      cards.append(button);
    }

    panel.append(header, cards);
    playersGrid.append(panel);
  }
}

function renderCurrentPlay(): void {
  currentPlay.replaceChildren();
  const snapshot = state.snapshot;
  const active = state.game?.activePlay ?? null;

  if (snapshot === null) {
    currentPlay.append(emptyState("No current play."));
    return;
  }

  const header = document.createElement("div");
  header.className = "current-header";
  const currentRoundCardCount = state.currentRoundTurns.reduce(
    (total, turn) => total + (turn.action === "play" ? turn.cards.length : 0),
    0,
  );
  header.innerHTML = `<strong>${active === null ? "Lead is open" : `${escapeHtml(active.playerName)} played ${escapeHtml(active.combo.label)}`}</strong><span>${state.wonRounds.length} stacks | ${currentRoundCardCount} live</span>`;

  const board = document.createElement("div");
  board.className = "table-board";
  board.append(renderWonRounds(), renderCurrentRound());
  currentPlay.append(header, board);

  const expandedRound = state.wonRounds.find((round) => round.id === state.expandedRoundId);
  if (expandedRound !== undefined) {
    currentPlay.append(renderRoundInspector(expandedRound));
  }
}

function renderWonRounds(): HTMLElement {
  const area = document.createElement("section");
  area.className = "won-rounds";

  const stacks = document.createElement("div");
  stacks.className = "round-stacks";

  for (const round of state.wonRounds) {
    const stack = document.createElement("button");
    stack.type = "button";
    stack.className = ["round-stack", state.expandedRoundId === round.id ? "is-expanded" : ""].filter(Boolean).join(" ");
    stack.setAttribute("aria-expanded", state.expandedRoundId === round.id ? "true" : "false");
    stack.addEventListener("click", () => {
      state.expandedRoundId = state.expandedRoundId === round.id ? null : round.id;
      render();
    });

    const title = document.createElement("span");
    title.className = "stack-title";
    title.textContent = `Round ${round.number}`;
    const meta = document.createElement("span");
    meta.className = "stack-meta";
    meta.textContent = `${round.winnerName} | ${round.totalCards}`;

    const topHand = document.createElement("span");
    topHand.className = "stack-top-hand";
    for (const card of round.winningCards) {
      topHand.append(createCardSpan(card, { compact: true }));
    }

    stack.append(title, meta, topHand);
    stacks.append(stack);
  }

  if (state.wonRounds.length === 0) {
    stacks.append(emptyState("No won rounds."));
  }

  area.append(stacks);
  return area;
}

function renderRoundInspector(round: WonRound): HTMLElement {
  const inspector = document.createElement("section");
  inspector.className = "round-inspector";

  const header = document.createElement("div");
  header.className = "round-inspector-header";
  const title = document.createElement("div");
  title.innerHTML = `<strong>Round ${round.number}: ${escapeHtml(round.winnerName)} won with ${escapeHtml(round.winningComboLabel)}</strong><span>${round.totalCards} cards</span>`;
  const close = document.createElement("button");
  close.type = "button";
  close.className = "icon-button";
  close.setAttribute("aria-label", "Close round details");
  close.textContent = "X";
  close.addEventListener("click", () => {
    state.expandedRoundId = null;
    render();
  });
  header.append(title, close);

  const turns = document.createElement("div");
  turns.className = "round-turns inspector-turns";
  renderRoundTurns(turns, round.turns, null, { compactCards: true });
  inspector.append(header, turns);
  return inspector;
}

function renderCurrentRound(): HTMLElement {
  const area = document.createElement("section");
  area.className = "current-round";
  const header = document.createElement("div");
  header.className = "round-section-header";
  header.innerHTML = "<strong>Current round</strong><span>chronological</span>";
  const turns = document.createElement("div");
  turns.className = "round-turns";
  const latestTurnId = latestPlayTurnId(state.currentRoundTurns);
  renderRoundTurns(turns, state.currentRoundTurns, latestTurnId);

  if (state.currentRoundTurns.length === 0) {
    turns.append(emptyState("Waiting for the next lead."));
  }

  area.append(header, turns);
  return area;
}

function renderRoundTurns(
  container: HTMLElement,
  turns: RoundTurn[],
  latestTurnId: string | null,
  options: { compactCards?: boolean } = {},
): void {
  for (const turn of turns) {
    const row = document.createElement("section");
    row.className = ["round-turn", turn.id === latestTurnId ? "latest-turn" : ""].filter(Boolean).join(" ");

    const label = document.createElement("div");
    label.className = "round-turn-label";
    const playerName = document.createElement("strong");
    playerName.textContent = turn.playerName;
    const detail = document.createElement("span");
    detail.textContent = turn.action === "play" ? turn.comboLabel : "pass";
    label.append(playerName, detail);

    if (turn.action === "pass") {
      const pass = document.createElement("span");
      pass.className = "pass-chip";
      pass.textContent = "pass";
      row.append(label, pass);
    } else {
      const group = document.createElement("div");
      group.className = [
        "hand-group",
        turn.cards.length > 1 ? "multi-card" : "",
        turn.id === latestTurnId ? "latest-hand" : "",
      ]
        .filter(Boolean)
        .join(" ");
      const lastCardId = turn.id === latestTurnId ? turn.cards.at(-1)?.id : undefined;

      for (const card of turn.cards) {
        group.append(createCardSpan(card, { compact: options.compactCards, lastPlayed: card.id === lastCardId }));
      }

      row.append(label, group);
    }

    container.append(row);
  }
}

function latestPlayTurnId(turns: RoundTurn[]): string | null {
  for (let index = turns.length - 1; index >= 0; index -= 1) {
    const turn = turns[index]!;

    if (turn.action === "play") {
      return turn.id;
    }
  }

  return null;
}

function renderLogs(): void {
  eventsList.replaceChildren();
  apiLogList.replaceChildren();
  gameLogList.replaceChildren();

  for (const event of [...(state.snapshot?.events ?? [])].slice(-8).reverse()) {
    eventsList.append(logItem(event.summary, event.type));
  }

  for (const entry of state.apiLogs.slice(0, 10)) {
    const status = entry.status === undefined ? "..." : `${entry.status}`;
    apiLogList.append(logItem(`${entry.method} ${entry.path}`, status));
  }

  for (const entry of state.gameLog.slice(0, 10)) {
    gameLogList.append(logItem(entry, "game"));
  }
}

function renderControls(): void {
  const game = state.game;
  const currentPlayer = game === null ? null : playerById(game.currentPlayerId);
  const isManualTurn = currentPlayer !== null && currentPlayer.id === state.manualPlayerId && game?.winnerPlayerId === null;
  const selectedCards = selectedCardsForCurrentPlayer();
  const validation = selectedCards.length === 0 ? null : validatePlay(selectedCards, playContext());

  stepButton.disabled = state.busy || game === null || game.winnerPlayerId !== null || isManualTurn;
  playButton.disabled = state.busy || !isManualTurn || validation?.ok !== true;
  passButton.disabled = state.busy || !isManualTurn || !canPass(playContext());
  newGameButton.disabled = state.busy;
  checkApiButton.disabled = state.busy;
  apiUrlInput.disabled = state.busy;

  if (!isManualTurn) {
    validationText.textContent = currentPlayer === null ? "No manual turn." : `${currentPlayer.name} is controlled by automation.`;
  } else if (selectedCards.length === 0) {
    const legalCount = legalPlays(handFor(currentPlayer.id), playContext()).length;
    validationText.textContent = `${currentPlayer.name}: ${legalCount} legal plays available.`;
  } else {
    validationText.textContent = validation?.message ?? "Invalid selection.";
  }
}

function toggleSelectedCard(cardId: string): void {
  if (state.selectedCardIds.has(cardId)) {
    state.selectedCardIds.delete(cardId);
  } else {
    state.selectedCardIds.add(cardId);
  }

  const currentHandIds = new Set(handFor(requireCurrentPlayer().id).map((card) => card.id));
  state.selectedCardIds = new Set([...state.selectedCardIds].filter((id) => currentHandIds.has(id)));
  render();
}

function selectedCardsForCurrentPlayer(): KnownCard[] {
  if (state.game === null) {
    return [];
  }

  const selected = new Set(state.selectedCardIds);
  return sortCards(handFor(state.game.currentPlayerId).filter((card) => selected.has(card.id)));
}

function playContext(): PlayContext {
  return {
    activePlay: state.game?.activePlay?.combo ?? null,
    isFirstPlay: state.game?.isFirstPlay ?? false,
    requiredOpeningCode: "3D",
  };
}

function scheduleAutoPlay(): void {
  stopAutoPlay();

  if (state.mode !== "auto" || state.busy || state.game === null || state.game.winnerPlayerId !== null) {
    return;
  }

  if (state.game.currentPlayerId === state.manualPlayerId) {
    state.status = `${playerById(state.game.currentPlayerId).name} is waiting for manual input.`;
    render();
    return;
  }

  state.autoTimer = window.setTimeout(() => void runTask(stepTurn), 650);
}

function stopAutoPlay(): void {
  if (state.autoTimer !== undefined) {
    window.clearTimeout(state.autoTimer);
    state.autoTimer = undefined;
  }
}

function api(): OpenCardApi {
  return new OpenCardApi(normalizeApiUrl(state.apiUrl), recordApiLog);
}

function recordApiLog(entry: ApiLogEntry): void {
  const existingIndex = state.apiLogs.findIndex((candidate) => candidate.id === entry.id);

  if (existingIndex === -1) {
    state.apiLogs.unshift(entry);
  } else {
    state.apiLogs[existingIndex] = { ...state.apiLogs[existingIndex]!, ...entry };
  }

  state.apiLogs = state.apiLogs.slice(0, 24);
  renderLogs();
}

function appendGameLog(message: string): void {
  state.gameLog.unshift(message);
  state.gameLog = state.gameLog.slice(0, 24);
}

function handFor(playerId: string): KnownCard[] {
  return state.snapshot?.hands.get(playerId) ?? [];
}

function handZoneIdFor(playerId: string): string {
  const seat = state.seats.find((candidate) => candidate.player.id === playerId);

  if (seat === undefined) {
    throw new Error(`No hand zone for ${playerId}.`);
  }

  return seat.handZoneId;
}

function playerById(playerId: string): Player {
  const seat = state.seats.find((candidate) => candidate.player.id === playerId);

  if (seat === undefined) {
    throw new Error(`Player ${playerId} is not seated.`);
  }

  return seat.player;
}

function nextPlayerId(playerId: string): string {
  const index = state.seats.findIndex((seat) => seat.player.id === playerId);

  if (index === -1) {
    throw new Error(`Player ${playerId} is not seated.`);
  }

  return state.seats[(index + 1) % state.seats.length]!.player.id;
}

function requireCurrentPlayer(): Player {
  return playerById(requireGame().currentPlayerId);
}

function requireGame(): Big2Game {
  if (state.game === null) {
    throw new Error("Start a game first.");
  }

  return state.game;
}

function requireZones(): ZoneIds {
  if (state.zones === null) {
    throw new Error("Start a game first.");
  }

  return state.zones;
}

function requireTableId(): string {
  if (state.tableId === null) {
    throw new Error("Start a game first.");
  }

  return state.tableId;
}

function knownCards(cards: ProjectedCard[]): KnownCard[] {
  return cards.filter(isKnownCard).map((card) => ({
    id: card.id,
    code: card.code,
    rank: card.rank,
    suit: card.suit,
    label: card.label,
  }));
}

function isKnownCard(card: ProjectedCard): card is Extract<ProjectedCard, { unknown: false }> {
  return card.unknown === false;
}

function canSelectCardsFor(playerId: string): boolean {
  const game = state.game;
  return !state.busy && game !== null && game.winnerPlayerId === null && game.currentPlayerId === playerId && state.manualPlayerId === playerId;
}

function normalizeApiUrl(value: string): string {
  return (value.trim() || defaultApiUrl).replace(/\/+$/, "");
}

function isRedSuit(card: KnownCard): boolean {
  return card.suit === "diamonds" || card.suit === "hearts";
}

function createCardSpan(card: KnownCard, options: { compact?: boolean; lastPlayed?: boolean } = {}): HTMLSpanElement {
  const item = document.createElement("span");
  item.className = ["card", isRedSuit(card) ? "red" : "black", options.compact ? "compact" : "", options.lastPlayed ? "last-played" : ""]
    .filter(Boolean)
    .join(" ");
  item.textContent = card.code;
  item.title = card.label ?? card.code;
  return item;
}

function option(label: string, value: string): HTMLOptionElement {
  const item = document.createElement("option");
  item.value = value;
  item.textContent = label;
  return item;
}

function logItem(message: string, meta: string): HTMLElement {
  const item = document.createElement("li");
  const detail = document.createElement("span");
  detail.textContent = meta;
  item.append(detail, document.createTextNode(message));
  return item;
}

function emptyState(message: string): HTMLElement {
  const item = document.createElement("p");
  item.className = "empty";
  item.textContent = message;
  return item;
}

function element<T extends HTMLElement>(selector: string): T {
  const item = document.querySelector<T>(selector);

  if (item === null) {
    throw new Error(`Missing element ${selector}.`);
  }

  return item;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}
