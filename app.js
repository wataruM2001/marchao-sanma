(function () {
  "use strict";

  const Rules = window.MahjongRules;
  const Tiles = window.MahjongTiles;
  const Game = window.MahjongGame;
  const STORAGE_KEY = "marchao-sanma-score-table-v1";
  let state = loadState();
  let battleState = null;
  let cpuTurnTimer = 0;

  const els = {
    undoButton: document.getElementById("undoButton"),
    resetButton: document.getElementById("resetButton"),
    battleTable: document.getElementById("battleTable"),
    battleSelfHand: document.getElementById("battleSelfHand"),
    battleLeftHand: document.getElementById("battleLeftHand"),
    battleRightHand: document.getElementById("battleRightHand"),
    battleSelfFlowers: document.getElementById("battleSelfFlowers"),
    battleLeftFlowers: document.getElementById("battleLeftFlowers"),
    battleRightFlowers: document.getElementById("battleRightFlowers"),
    battleDoraIndicators: document.getElementById("battleDoraIndicators"),
    battlePlayerScores: document.getElementById("battlePlayerScores"),
    battleFlowerTiles: document.getElementById("battleFlowerTiles"),
    battleSelfRiver: document.getElementById("battleSelfRiver"),
    battleLeftRiver: document.getElementById("battleLeftRiver"),
    battleRightRiver: document.getElementById("battleRightRiver"),
    battleSelfName: document.getElementById("battleSelfName"),
    battleLeftName: document.getElementById("battleLeftName"),
    battleRightName: document.getElementById("battleRightName"),
    battleRoundLabel: document.getElementById("battleRoundLabel"),
    battleHonbaKyotakuLabel: document.getElementById("battleHonbaKyotakuLabel"),
    battleRemainingDraws: document.getElementById("battleRemainingDraws"),
    battleDealerLabel: document.getElementById("battleDealerLabel"),
    battleKyotakuLabel: document.getElementById("battleKyotakuLabel"),
    battleStartButton: document.getElementById("battleStartButton"),
    battleStatus: document.getElementById("battleStatus"),
    handForm: document.getElementById("handForm"),
    dealerSelect: document.getElementById("dealerSelect"),
    honbaInput: document.getElementById("honbaInput"),
    winType: document.getElementById("winType"),
    hanField: document.getElementById("hanField"),
    hanInput: document.getElementById("hanInput"),
    winnerField: document.getElementById("winnerField"),
    winnerSelect: document.getElementById("winnerSelect"),
    secondWinnerField: document.getElementById("secondWinnerField"),
    secondWinnerSelect: document.getElementById("secondWinnerSelect"),
    discarderField: document.getElementById("discarderField"),
    discarderSelect: document.getElementById("discarderSelect"),
    dealerTenpaiField: document.getElementById("dealerTenpaiField"),
    dealerTenpaiSelect: document.getElementById("dealerTenpaiSelect"),
    tenpaiRow: document.getElementById("tenpaiRow"),
    ippatsuInput: document.getElementById("ippatsuInput"),
    blueSouInput: document.getElementById("blueSouInput"),
    bluePinInput: document.getElementById("bluePinInput"),
    blueFlowerInput: document.getElementById("blueFlowerInput"),
    uraInput: document.getElementById("uraInput"),
    bonusRow: document.getElementById("bonusRow"),
    doubleRonPanel: document.getElementById("doubleRonPanel"),
    shimochaWinnerLabel: document.getElementById("shimochaWinnerLabel"),
    shimochaHanInput: document.getElementById("shimochaHanInput"),
    shimochaIppatsuInput: document.getElementById("shimochaIppatsuInput"),
    shimochaBlueSouInput: document.getElementById("shimochaBlueSouInput"),
    shimochaBluePinInput: document.getElementById("shimochaBluePinInput"),
    shimochaBlueFlowerInput: document.getElementById("shimochaBlueFlowerInput"),
    shimochaUraInput: document.getElementById("shimochaUraInput"),
    kamichaWinnerLabel: document.getElementById("kamichaWinnerLabel"),
    kamichaHanInput: document.getElementById("kamichaHanInput"),
    kamichaIppatsuInput: document.getElementById("kamichaIppatsuInput"),
    kamichaBlueSouInput: document.getElementById("kamichaBlueSouInput"),
    kamichaBluePinInput: document.getElementById("kamichaBluePinInput"),
    kamichaBlueFlowerInput: document.getElementById("kamichaBlueFlowerInput"),
    kamichaUraInput: document.getElementById("kamichaUraInput"),
    oorasuActionField: document.getElementById("oorasuActionField"),
    oorasuActionSelect: document.getElementById("oorasuActionSelect"),
    recordButton: document.getElementById("recordButton"),
    paymentPreview: document.getElementById("paymentPreview"),
    roundStatus: document.getElementById("roundStatus"),
    finishType: document.getElementById("finishType"),
    finishWinnerSelect: document.getElementById("finishWinnerSelect"),
    settlementList: document.getElementById("settlementList"),
    tileGroups: document.getElementById("tileGroups"),
    tileCount: document.getElementById("tileCount"),
    historyCount: document.getElementById("historyCount"),
    historyList: document.getElementById("historyList"),
  };

  init();

  function init() {
    renderTileGroups();
    bindEvents();
    render();
  }

  function bindEvents() {
    els.battleStartButton?.addEventListener("click", () => {
      startBattleHand();
    });

    els.battleSelfHand?.addEventListener("click", (event) => {
      const tileImage = event.target.closest("[data-discard-tile-id]");
      if (!tileImage) return;
      handleHumanDiscard(tileImage.dataset.discardTileId);
    });

    els.handForm.addEventListener("submit", (event) => {
      event.preventDefault();
      try {
        state = Rules.applyHand(state, collectHandInput());
        clearHandExtras();
        saveState();
        render();
      } catch (error) {
        els.paymentPreview.textContent = error.message;
      }
    });

    els.resetButton.addEventListener("click", () => {
      state = Rules.createInitialState();
      localStorage.removeItem(STORAGE_KEY);
      render();
    });

    els.undoButton.addEventListener("click", () => {
      if (state.history.length === 0) return;
      const latest = state.history[state.history.length - 1];
      if (latest?.stateBefore) {
        state = restoreState(latest.stateBefore);
        saveState();
        render();
        return;
      }
      const names = state.players.map((player) => player.name);
      let rebuilt = Rules.createInitialState({ seatOrder: Rules.initialSeatOrderOf(state) });
      rebuilt.players.forEach((player, index) => {
        player.name = names[index];
      });
      for (const hand of state.history.slice(0, -1)) {
        rebuilt = Rules.applyHand(rebuilt, hand);
      }
      state = rebuilt;
      saveState();
      render();
    });

    ["input", "change"].forEach((eventName) => {
      document.addEventListener(eventName, (event) => {
        if (event.type === "click") return;
        if (event.target.matches("[id^='playerName']")) {
          syncPlayersFromInputs();
          populatePlayerSelects();
          saveState();
          renderSettlement();
          updatePreview();
        }
        if (event.target.matches("[id^='playerScore']")) {
          syncPlayersFromInputs();
          saveState();
          render();
        }
        if (event.target === els.dealerSelect) {
          state.seatOrder = Rules.seatOrderWithDealer(state, Number(els.dealerSelect.value));
          if (state.history.length === 0) {
            state.initialSeatOrder = [...state.seatOrder];
          }
          state.dealer = Rules.dealerOf(state);
          saveState();
          render();
        }
        if (els.handForm.contains(event.target)) {
          updatePreview();
        }
        if (event.target === els.finishType || event.target === els.finishWinnerSelect) {
          renderSettlement();
        }
      });
    });

    document.addEventListener("click", (event) => {
      const button = event.target.closest("[data-riichi-button]");
      if (!button) return;
      try {
        const playerIndex = Number(button.dataset.riichiButton);
        state = state.riichi?.[playerIndex]
          ? Rules.cancelRiichi(state, playerIndex)
          : Rules.applyRiichi(state, playerIndex);
        saveState();
        render();
      } catch (error) {
        els.paymentPreview.textContent = error.message;
      }
    });
  }

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (saved && Array.isArray(saved.players) && saved.players.length === 3) {
        const seatOrder = Rules.normalizeSeatOrder(saved.seatOrder, saved.dealer);
        const initialSeatOrder = saved.initialSeatOrder
          ? Rules.normalizeSeatOrder(saved.initialSeatOrder, seatOrder[0])
          : Rules.initialSeatOrderOf({ ...saved, seatOrder });
        return {
          ...Rules.createInitialState(),
          ...saved,
          seatOrder,
          initialSeatOrder,
          dealer: Rules.dealerOf(seatOrder),
          dealerTurns: Number.isFinite(Number(saved.dealerTurns)) ? Number(saved.dealerTurns) : 0,
          gameEnded: Boolean(saved.gameEnded),
          endReason: saved.endReason || "",
          kyotaku: Number.isFinite(Number(saved.kyotaku)) ? Number(saved.kyotaku) : 0,
          riichi: Array.isArray(saved.riichi) ? saved.riichi.map(Boolean).slice(0, 3) : [false, false, false],
          players: saved.players.map((player, index) => ({
            name: player.name || `Player ${index + 1}`,
            score: Number(player.score) || 0,
            bonus: Number(player.bonus) || 0,
            tobi: Number(player.tobi) || 0,
          })),
          history: Array.isArray(saved.history) ? saved.history : [],
        };
      }
    } catch (error) {
      console.warn("保存データを読み込めませんでした", error);
    }
    return Rules.createInitialState();
  }

  function restoreState(snapshot) {
    return {
      ...Rules.createInitialState({ seatOrder: Rules.initialSeatOrderOf(snapshot) }),
      ...snapshot,
      players: Rules.clonePlayers(snapshot.players),
      seatOrder: Rules.normalizeSeatOrder(snapshot.seatOrder, snapshot.dealer),
      initialSeatOrder: Rules.initialSeatOrderOf(snapshot),
      dealer: Rules.dealerOf(snapshot),
      dealerTurns: Number(snapshot.dealerTurns) || 0,
      gameEnded: Boolean(snapshot.gameEnded),
      endReason: snapshot.endReason || "",
      honba: Number(snapshot.honba) || 0,
      kyotaku: Number(snapshot.kyotaku) || 0,
      riichi: Array.isArray(snapshot.riichi) ? snapshot.riichi.map(Boolean).slice(0, 3) : [false, false, false],
      history: Array.isArray(snapshot.history) ? snapshot.history : [],
    };
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function render() {
    populatePlayerSelects();
    renderPlayers();
    renderBattleTable();
    renderRoundStatus();
    renderHistory();
    renderSettlement();
    updatePreview();
  }

  function renderPlayers() {
    state.players.forEach((player, index) => {
      document.querySelector(`[data-player-card="${index}"] .seat-chip`).textContent = Rules.seatForPlayer(state, index);
      document.getElementById(`playerName${index}`).value = player.name;
      document.getElementById(`playerScore${index}`).value = player.score;
      document.getElementById(`bonus${index}`).textContent = formatSigned(player.bonus);
      document.getElementById(`tobi${index}`).textContent = formatSigned(player.tobi);
      document.querySelector(`[data-player-card="${index}"]`).classList.toggle("is-dealer", index === Rules.dealerOf(state));
      document.getElementById(`tenpaiLabel${index}`).textContent = `${Rules.seatForPlayer(state, index)} ${player.name} 聴牌`;
      const riichiButton = document.querySelector(`[data-riichi-button="${index}"]`);
      const isRiichi = Boolean(state.riichi?.[index]);
      riichiButton.textContent = isRiichi ? "取消" : "成立";
      riichiButton.classList.toggle("is-active", isRiichi);
      riichiButton.disabled = Boolean(Rules.halfFinishReason(state)) || (!isRiichi && player.score < 1000);
    });
    els.dealerSelect.value = String(Rules.dealerOf(state));
    els.honbaInput.value = String(state.honba);
  }

  function startBattleHand() {
    if (!Game) {
      els.battleStatus.textContent = "対局ロジックを読み込めませんでした";
      return;
    }
    window.clearTimeout(cpuTurnTimer);
    syncPlayersFromInputs();
    battleState = Game.startNewHand({
      playerNames: [
        state.players[0]?.name || "Player 1",
        state.players[1]?.name || "CPU 下家",
        state.players[2]?.name || "CPU 上家",
      ],
      dealerIndex: 0,
      roundWind: "east",
      handNumber: 1,
      honba: state.honba || 0,
      kyotaku: Math.floor((Number(state.kyotaku) || 0) / 1000),
    });
    renderBattleTable();
    scheduleCpuTurn();
  }

  function handleHumanDiscard(tileId) {
    if (!battleState || battleState.phase !== "discard") return;
    const currentPlayer = battleState.players[battleState.currentPlayerIndex];
    if (currentPlayer?.seat !== "self") return;
    try {
      battleState = Game.discardTile(battleState, battleState.currentPlayerIndex, tileId);
      battleState = Game.nextTurn(battleState);
      renderBattleTable();
      scheduleCpuTurn();
    } catch (error) {
      els.battleStatus.textContent = error.message;
    }
  }

  function scheduleCpuTurn() {
    window.clearTimeout(cpuTurnTimer);
    if (!battleState || battleState.phase !== "discard") return;
    const currentPlayer = battleState.players[battleState.currentPlayerIndex];
    if (!currentPlayer?.isCpu) return;
    cpuTurnTimer = window.setTimeout(runCpuTurn, 520);
  }

  function runCpuTurn() {
    if (!battleState || battleState.phase !== "discard") return;
    const currentPlayer = battleState.players[battleState.currentPlayerIndex];
    if (!currentPlayer?.isCpu) return;
    const discard = Game.decideCpuDiscard(currentPlayer, battleState);
    if (!discard) {
      battleState = Game.endHandAsRyukyoku(battleState);
      renderBattleTable();
      return;
    }
    battleState = Game.discardTile(battleState, battleState.currentPlayerIndex, discard.id);
    battleState = Game.nextTurn(battleState);
    renderBattleTable();
    scheduleCpuTurn();
  }

  function battleStatusText() {
    if (!battleState) return "待機中";
    if (battleState.phase === "ryukyoku") return "流局しました";
    const currentPlayer = battleState.players[battleState.currentPlayerIndex];
    if (battleState.phase === "discard" && currentPlayer?.seat === "self") return "あなたの打牌";
    if (currentPlayer?.isCpu) return "CPU思考中";
    return "進行中";
  }

  function windText(wind) {
    return wind === "south" ? "南" : "東";
  }

  function playerPositionLabel(seat) {
    if (seat === "self") return "自分";
    if (seat === "shimocha") return "下家";
    if (seat === "kamicha") return "上家";
    return "Player";
  }

  function currentSeatWind(playerIndex, dealerIndex) {
    const winds = ["東家", "南家", "西家"];
    return winds[(playerIndex - dealerIndex + 3) % 3] || "西家";
  }

  function formatBattleScore(value) {
    return `${Math.round(Number(value) || 0).toLocaleString("ja-JP")}点`;
  }

  function formatBattleChip(value) {
    const rounded = Math.round(Number(value) || 0);
    const sign = rounded > 0 ? "+" : "";
    return `${sign}${rounded.toLocaleString("ja-JP")}pt`;
  }

  function renderCentralInfoPanel(gameState) {
    if (!gameState) return;
    const kyotakuCount = Math.floor((Number(gameState.kyotaku) || 0) / 1000);
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    const dealerPlayer = gameState.players[gameState.dealerIndex];

    els.battleRoundLabel.textContent = `${windText(gameState.roundWind)}${gameState.handNumber}局`;
    if (els.battleHonbaKyotakuLabel) {
      els.battleHonbaKyotakuLabel.textContent = `${gameState.honba}本場 供託${kyotakuCount} 残${gameState.remainingDraws}`;
    }
    els.battleRemainingDraws.textContent = `残 ${gameState.remainingDraws}`;
    els.battleDealerLabel.textContent = `親 ${playerPositionLabel(dealerPlayer?.seat)}`;
    els.battleKyotakuLabel.textContent = `手番 ${playerPositionLabel(currentPlayer?.seat)}`;
    els.battleDoraIndicators.innerHTML = renderDoraIndicatorRow(gameState.doraIndicators);
    if (els.battlePlayerScores) {
      els.battlePlayerScores.innerHTML = gameState.players
        .map((player, index) => {
          const seatWind = currentSeatWind(index, gameState.dealerIndex);
          return `
            <div class="central-player-row central-player-${escapeHtml(player.seat)}">
              <span>${escapeHtml(playerPositionLabel(player.seat))}</span>
              <strong>${escapeHtml(seatWind)}</strong>
              <span>${escapeHtml(formatBattleScore(player.points))}</span>
              <span>${escapeHtml(formatBattleChip(player.chips))}</span>
            </div>
          `;
        })
        .join("");
    }
  }

  function renderDoraIndicatorRow(doraIndicators = []) {
    const backImage = Tiles.tileImagePath("blue_back");
    return Array.from({ length: 5 }, (_, index) => {
      const tile = doraIndicators[index];
      const src = tile?.image || backImage;
      const label = tile ? tile.name || tile.baseId || tile.id : "ドラ表示牌 裏";
      return `<img class="table-tile-img dora-indicator-tile" src="${escapeHtml(src)}" alt="${escapeHtml(label)}" loading="lazy" />`;
    }).join("");
  }

  function battleTileSortValue(tile) {
    const suitOrder = { pin: 0, sou: 1, honor: 2, man: 3, flower: 4 };
    const honorOrder = {
      east: 1,
      south: 2,
      west: 3,
      north: 4,
      white: 5,
      green: 6,
      red: 7,
    };
    const number = tile.suit === "honor" ? honorOrder[tile.baseId] || 99 : tile.number || 99;
    const colorOrder = { normal: 0, red: 1, blue: 2 };
    return [
      suitOrder[tile.suit] ?? 99,
      number,
      tile.baseId || tile.id,
      colorOrder[tile.color] ?? 9,
      tile.id,
    ];
  }

  function compareBattleTiles(a, b) {
    const left = battleTileSortValue(a);
    const right = battleTileSortValue(b);
    for (let index = 0; index < left.length; index += 1) {
      if (left[index] < right[index]) return -1;
      if (left[index] > right[index]) return 1;
    }
    return 0;
  }

  function sortedBattleTiles(tiles) {
    return [...(tiles || [])].sort(compareBattleTiles);
  }

  function drawnTileIdForPlayer(playerIndex) {
    if (
      battleState?.phase === "discard" &&
      battleState.lastAction?.type === "draw" &&
      battleState.lastAction.playerIndex === playerIndex
    ) {
      return battleState.lastAction.tileId;
    }
    return "";
  }

  function splitHandForDisplay(player, playerIndex) {
    const hand = player?.hand || [];
    let drawnTile = null;
    const drawnTileId = drawnTileIdForPlayer(playerIndex);
    const concealed = [];

    hand.forEach((tile, index) => {
      const isTrackedDraw = drawnTileId && tile.id === drawnTileId;
      const isFallbackDraw = !drawnTileId && hand.length % 3 === 2 && index === hand.length - 1;
      if (!drawnTile && (isTrackedDraw || isFallbackDraw)) {
        drawnTile = tile;
      } else {
        concealed.push(tile);
      }
    });

    return {
      concealed: sortedBattleTiles(concealed),
      drawnTile,
    };
  }

  function renderSelfHand(player, playerIndex, canDiscard) {
    const display = splitHandForDisplay(player, playerIndex);
    const normalTiles = display.concealed
      .map((tile) => renderBattleTile(tile, canDiscard ? "discardable" : "", canDiscard))
      .join("");
    const drawnTile = display.drawnTile
      ? renderBattleTile(display.drawnTile, canDiscard ? "discardable drawn" : "drawn", canDiscard)
      : "";
    return normalTiles + drawnTile;
  }

  function discardTileOf(discard) {
    return discard?.tile || discard || null;
  }

  function tileRotationClassForSeat(seat) {
    if (seat === "shimocha") return "tile-rotate-left";
    if (seat === "kamicha") return "tile-rotate-right";
    return "tile-no-rotate";
  }

  function orderDiscardsForRiver(player) {
    return [...(player?.discards || [])];
  }

  function riverTileStyleForSeat(seat, index) {
    if (seat === "self") {
      const row = Math.floor(index / 6) + 1;
      const column = (index % 6) + 1;
      return `style="grid-row:${row};grid-column:${column};"`;
    }
    if (seat === "shimocha") {
      const row = 6 - (index % 6);
      const column = Math.floor(index / 6) + 1;
      return `style="grid-row:${row};grid-column:${column};"`;
    }
    return "";
  }

  function renderDiscardRiver(player) {
    const rotationClass = tileRotationClassForSeat(player?.seat);
    return orderDiscardsForRiver(player)
      .map((discard, index) => {
        const tile = discardTileOf(discard);
        if (!tile) return "";
        const classes = [
          "river-tile",
          rotationClass,
          discard?.isTsumogiri ? "tsumogiri" : "",
          discard?.isRiichiDeclaration ? "riichi-discard" : "",
        ]
          .filter(Boolean)
          .join(" ");
        return renderBattleTile(tile, classes, false, riverTileStyleForSeat(player?.seat, index));
      })
      .join("");
  }

  function renderBattleTable() {
    if (!els.battleTable || !Tiles?.createTiles) return;
    if (!battleState) {
      renderEmptyBattleTable();
      return;
    }

    const selfPlayer = battleState.players.find((player) => player.seat === "self");
    const rightPlayer = battleState.players.find((player) => player.seat === "shimocha");
    const leftPlayer = battleState.players.find((player) => player.seat === "kamicha");
    const currentPlayer = battleState.players[battleState.currentPlayerIndex];
    const openFlowers = battleState.players.flatMap((player) => player.flowers);
    const canDiscard = battleState.phase === "discard" && currentPlayer?.seat === "self";

    els.battleSelfName.textContent = `自分 ${selfPlayer?.name || "Player 1"}`;
    els.battleRightName.textContent = `下家 ${rightPlayer?.name || "CPU 下家"}`;
    els.battleLeftName.textContent = `上家 ${leftPlayer?.name || "CPU 上家"}`;
    renderCentralInfoPanel(battleState);
    els.battleStatus.textContent = battleStatusText();
    els.battleStartButton.textContent = battleState.phase === "ryukyoku" ? "もう一局" : "対局開始";

    els.battleSelfHand.innerHTML = renderSelfHand(selfPlayer, battleState.players.indexOf(selfPlayer), canDiscard);
    els.battleSelfFlowers.innerHTML = (selfPlayer?.flowers || [])
      .map((tile) => renderBattleTile(tile, "flower-open self-flower-tile tile-no-rotate"))
      .join("");
    els.battleLeftFlowers.innerHTML = (leftPlayer?.flowers || [])
      .map((tile) => renderBattleTile(tile, `flower-open side-flower ${tileRotationClassForSeat(leftPlayer?.seat)}`))
      .join("");
    els.battleRightFlowers.innerHTML = (rightPlayer?.flowers || [])
      .map((tile) => renderBattleTile(tile, `flower-open side-flower ${tileRotationClassForSeat(rightPlayer?.seat)}`))
      .join("");
    els.battleFlowerTiles.innerHTML = openFlowers.map((tile) => renderBattleTile(tile, "mini")).join("");
    els.battleSelfRiver.innerHTML = renderDiscardRiver(selfPlayer);
    els.battleLeftRiver.innerHTML = renderDiscardRiver(leftPlayer);
    els.battleRightRiver.innerHTML = renderDiscardRiver(rightPlayer);
    els.battleLeftHand.innerHTML = renderBackTiles(leftPlayer?.hand.length || 0, "side", drawnTileIdForPlayer(battleState.players.indexOf(leftPlayer)));
    els.battleRightHand.innerHTML = renderBackTiles(rightPlayer?.hand.length || 0, "side", drawnTileIdForPlayer(battleState.players.indexOf(rightPlayer)));
  }

  function renderEmptyBattleTable() {
    const ownPlayer = state.players[0];
    const rightPlayer = state.players[1];
    const leftPlayer = state.players[2];
    const dealer = Rules.dealerOf(state);
    const kyotakuCount = Math.floor((Number(state.kyotaku) || 0) / 1000);
    els.battleSelfName.textContent = `自分 ${ownPlayer?.name || "Player 1"}`;
    els.battleRightName.textContent = `下家 ${rightPlayer?.name || "Player 2"}`;
    els.battleLeftName.textContent = `上家 ${leftPlayer?.name || "Player 3"}`;
    els.battleRoundLabel.textContent = Rules.roundLabel(state);
    if (els.battleHonbaKyotakuLabel) {
      els.battleHonbaKyotakuLabel.textContent = `${state.honba || 0}本場 供託${kyotakuCount} 残--`;
    }
    els.battleRemainingDraws.textContent = "残りツモ --";
    els.battleDealerLabel.textContent = `親 ${state.players[dealer]?.name || `Player ${dealer + 1}`}`;
    els.battleKyotakuLabel.textContent = `供託${kyotakuCount}`;
    els.battleStatus.textContent = "待機中";
    els.battleStartButton.textContent = "対局開始";
    els.battleSelfHand.innerHTML = "";
    els.battleSelfFlowers.innerHTML = "";
    els.battleLeftFlowers.innerHTML = "";
    els.battleRightFlowers.innerHTML = "";
    els.battleDoraIndicators.innerHTML = "";
    if (els.battlePlayerScores) els.battlePlayerScores.innerHTML = "";
    els.battleFlowerTiles.innerHTML = "";
    els.battleSelfRiver.innerHTML = "";
    els.battleLeftRiver.innerHTML = "";
    els.battleRightRiver.innerHTML = "";
    els.battleLeftHand.innerHTML = renderBackTiles(13);
    els.battleRightHand.innerHTML = renderBackTiles(13);
  }

  function renderBattleTile(tile, modifier = "", interactive = false, extraAttributes = "") {
    if (!tile) return "";
    const definition = Tiles.getTileDefinition(tile);
    const label = tile.name || definition?.name || definition?.label || tile.baseId || tile.id;
    const data = interactive ? ` data-discard-tile-id="${escapeHtml(tile.id)}"` : "";
    const attributes = extraAttributes ? ` ${extraAttributes}` : "";
    return `<img class="table-tile-img ${modifier}"${data}${attributes} src="${escapeHtml(tile.image)}" alt="${escapeHtml(label)}" loading="lazy" />`;
  }

  function renderBackTiles(count, modifier = "", drawnTileId = "") {
    return Array.from({ length: count }, (_, index) => {
      const classes = ["table-back", modifier, drawnTileId && index === count - 1 ? "drawn" : ""]
        .filter(Boolean)
        .join(" ");
      return `<img class="table-tile-img ${classes}" src="${escapeHtml(Tiles.tileImagePath("blue_back"))}" alt="opponent tile ${index + 1}" loading="lazy" />`;
    }).join("");
  }

  function populatePlayerSelects() {
    state.seatOrder = Rules.normalizeSeatOrder(state.seatOrder, state.dealer);
    const optionHtml = state.seatOrder
      .map((playerIndex) => {
        const player = state.players[playerIndex];
        return `<option value="${playerIndex}">${escapeHtml(Rules.seatForPlayer(state, playerIndex))} ${escapeHtml(player.name)}</option>`;
      })
      .join("");
    [els.dealerSelect, els.winnerSelect, els.secondWinnerSelect, els.discarderSelect, els.finishWinnerSelect].forEach((select) => {
      const current = select.value;
      select.innerHTML = optionHtml;
      if (["0", "1", "2"].includes(current)) {
        select.value = current;
      }
    });
    if (els.discarderSelect.value === els.winnerSelect.value) {
      els.discarderSelect.value = String(Rules.shimochaOf(state, Number(els.winnerSelect.value)));
    }
    if (els.secondWinnerSelect.value === els.winnerSelect.value) {
      els.secondWinnerSelect.value = String(Rules.shimochaOf(state, Number(els.winnerSelect.value)));
    }
    updateDoubleRonLabels();
  }

  function syncPlayersFromInputs() {
    state.players.forEach((player, index) => {
      player.name = document.getElementById(`playerName${index}`).value.trim() || `Player ${index + 1}`;
      player.score = Number(document.getElementById(`playerScore${index}`).value) || 0;
    });
  }

  function collectBonusInputs(prefix = "") {
    const key = (name) => (prefix ? `${prefix}${name}` : `${name.charAt(0).toLowerCase()}${name.slice(1)}`);
    return {
      ippatsu: Boolean(els[key("IppatsuInput")]?.checked),
      blueSou: Boolean(els[key("BlueSouInput")]?.checked),
      bluePin: Boolean(els[key("BluePinInput")]?.checked),
      blueFlower: Boolean(els[key("BlueFlowerInput")]?.checked),
      ura: Number(els[key("UraInput")]?.value || 0),
    };
  }

  function doubleRonPlayersFromDiscarder(discarder = Number(els.discarderSelect.value)) {
    return {
      discarder: Number(discarder),
      shimocha: Rules.shimochaOf(state, Number(discarder)),
      kamicha: Rules.upperPlayerOf(state, Number(discarder)),
    };
  }

  function playerLabel(playerIndex) {
    return `${Rules.seatForPlayer(state, playerIndex)} ${state.players[playerIndex]?.name || `Player ${playerIndex + 1}`}`;
  }

  function updateDoubleRonLabels() {
    if (!els.shimochaWinnerLabel || !els.kamichaWinnerLabel) return;
    const { shimocha, kamicha } = doubleRonPlayersFromDiscarder();
    els.shimochaWinnerLabel.textContent = playerLabel(shimocha);
    els.kamichaWinnerLabel.textContent = playerLabel(kamicha);
  }

  function collectHandInput() {
    syncPlayersFromInputs();
    const winType = els.winType.value;
    const baseHand = {
      winType,
      dealer: Rules.dealerOf(state),
      seatOrder: state.seatOrder,
      honba: Number(state.honba) || 0,
      oorasuAction: els.oorasuActionSelect.value,
      tenpai: [0, 1, 2].map((index) => Boolean(document.querySelector(`[data-tenpai-input="${index}"]`)?.checked)),
      dealerTenpai: Boolean(document.querySelector(`[data-tenpai-input="${Rules.dealerOf(state)}"]`)?.checked),
      autoAdvance: true,
    };
    if (winType === "doubleRon") {
      const { discarder, shimocha, kamicha } = doubleRonPlayersFromDiscarder();
      const shimochaHand = {
        han: Number(els.shimochaHanInput.value),
        ...collectBonusInputs("shimocha"),
      };
      const kamichaHand = {
        han: Number(els.kamichaHanInput.value),
        ...collectBonusInputs("kamicha"),
      };
      return {
        ...baseHand,
        winner: shimocha,
        secondWinner: kamicha,
        discarder,
        han: shimochaHand.han,
        doubleRonWinners: [shimocha, kamicha],
        doubleRonHands: {
          [shimocha]: shimochaHand,
          [kamicha]: kamichaHand,
        },
      };
    }
    return {
      ...baseHand,
      han: Number(els.hanInput.value),
      winner: Number(els.winnerSelect.value),
      secondWinner: Number(els.secondWinnerSelect.value),
      discarder: Number(els.discarderSelect.value),
      ...collectBonusInputs(),
    };
  }

  function renderRoundStatus() {
    const reason = Rules.halfFinishReason(state);
    const kyotakuCount = Math.floor((Number(state.kyotaku) || 0) / 1000);
    const statusText = reason
      ? `終了: ${reason}`
      : `${Rules.roundLabel(state)}${state.honba || 0}本場、供託${kyotakuCount}${Rules.isOorasu(state) ? "（オーラス）" : ""}`;
    els.recordButton.disabled = Boolean(reason);
    els.roundStatus.innerHTML = `
      <div class="round-chip ${reason ? "is-finished" : ""}">
        <strong>${escapeHtml(statusText)}</strong>
      </div>
    `;
  }

  function clearHandExtras() {
    [
      els.ippatsuInput,
      els.blueSouInput,
      els.bluePinInput,
      els.blueFlowerInput,
      els.shimochaIppatsuInput,
      els.shimochaBlueSouInput,
      els.shimochaBluePinInput,
      els.shimochaBlueFlowerInput,
      els.kamichaIppatsuInput,
      els.kamichaBlueSouInput,
      els.kamichaBluePinInput,
      els.kamichaBlueFlowerInput,
    ].forEach((input) => {
      if (input) input.checked = false;
    });
    [els.uraInput, els.shimochaUraInput, els.kamichaUraInput].forEach((input) => {
      if (input) input.value = "0";
    });
    document.querySelectorAll("[data-tenpai-input]").forEach((input) => {
      input.checked = false;
    });
  }

  function updatePreview() {
    try {
      const hand = collectHandInput();
      if (hand.winType !== "draw") {
        normalizeWinnerFields(hand);
      }
      const finishReason = Rules.halfFinishReason(state);
      if (finishReason) {
        updateInputVisibility(hand);
        els.paymentPreview.textContent = `半荘終了: ${finishReason}`;
        return;
      }
      updateInputVisibility(hand);
      if (hand.winType === "draw") {
        const dealer = Rules.dealerOf(state);
        const south = Rules.playerAtSeat(state, 1);
        const drawPayment = Rules.calculateDrawPayment(hand);
        const parentText = `${state.players[dealer].name} 親${drawPayment.tenpai[dealer] ? "聴牌" : "ノーテン"}`;
        const nextText = drawPayment.tenpai[dealer]
          ? oorasuPreviewText(hand, true)
          : Rules.isOorasu(state)
            ? "南3局終了"
            : `${state.players[south].name} が次の東家`;
        const paymentText = drawPayment.payerDetails.length
          ? drawPayment.payerDetails.map((item) => `${state.players[item.player].name}→${state.players[item.winner].name} ${item.amount.toLocaleString("ja-JP")}`).join(" / ")
          : "点棒移動なし";
        els.paymentPreview.textContent = `${paymentText} / ${parentText} / ${nextText} / 本場 +1 / 供託 ${(Number(state.kyotaku) || 0).toLocaleString("ja-JP")}点持ち越し`;
        return;
      }
      if (hand.winType === "ron" && hand.discarder === hand.winner) {
        els.discarderSelect.value = String(Rules.shimochaOf(state, hand.winner));
        hand.discarder = Number(els.discarderSelect.value);
      }
      const payment = Rules.calculatePayment(hand);
      const bonusSettlement = Rules.calculateBonusSettlement(hand);
      const bonus = bonusSettlement.amount;
      const payerText = payment.payerDetails
        .map((item) => {
          const winnerText = item.winner !== undefined ? `→${state.players[item.winner].name}` : "";
          return `${state.players[item.player].name}${winnerText} ${item.amount.toLocaleString("ja-JP")}`;
        })
        .join(" / ");
      const kyotakuWinner = Rules.kyotakuWinnerFor(hand, state);
      const kyotakuText =
        (Number(state.kyotaku) || 0) > 0 && kyotakuWinner !== null
          ? ` / 供託 ${(Number(state.kyotaku) || 0).toLocaleString("ja-JP")}点→${state.players[kyotakuWinner].name}`
          : "";
      const nextText =
        Rules.isParentContinuationWin(hand, state)
          ? oorasuPreviewText(hand, true)
          : Rules.isOorasu(state)
            ? "南3局終了"
            : `${state.players[Rules.playerAtSeat(state, 1)].name} が次の東家・本場 0`;
      const bonusText = bonusSettlement.details.length
        ? bonusSettlement.details.map((item) => `${state.players[item.payer].name}→${state.players[item.winner].name} ${item.amount.toLocaleString("ja-JP")}pt`).join(" / ")
        : "祝儀 0";
      els.paymentPreview.textContent = `${payerText}${kyotakuText} / ${bonusText} / ${nextText}`;
    } catch (error) {
      els.paymentPreview.textContent = error.message;
    }
  }

  function updateInputVisibility(hand) {
    const isDraw = hand.winType === "draw";
    const isDoubleRon = hand.winType === "doubleRon";
    const isTsumo = hand.winType === "tsumo";
    els.hanField.hidden = isDraw || isDoubleRon;
    els.winnerField.hidden = isDraw || isDoubleRon;
    els.secondWinnerField.hidden = true;
    els.discarderField.hidden = isDraw || hand.winType === "tsumo";
    els.dealerTenpaiField.hidden = true;
    els.tenpaiRow.hidden = !isDraw;
    els.bonusRow.hidden = isDraw || isDoubleRon;
    els.doubleRonPanel.hidden = !isDoubleRon;
    updateDoubleRonLabels();
    if (isTsumo) {
      els.discarderSelect.value = String(Rules.shimochaOf(state, Number(els.winnerSelect.value)));
    }
    els.oorasuActionField.hidden = !shouldShowOorasuAction(hand);
  }

  function shouldShowOorasuAction(hand) {
    if (!Rules.isOorasu(state)) return false;
    const dealer = Rules.dealerOf(state);
    try {
      if (hand.winType === "draw") {
        const drawPayment = Rules.calculateDrawPayment(hand);
        if (!drawPayment.tenpai[dealer]) return false;
        return !Rules.isSingleTop(projectedPlayersAfterPointMovement(hand), dealer);
      }
      if (!Rules.isParentContinuationWin(hand, state)) return false;
      return !Rules.isSingleTop(projectedPlayersAfterPointMovement(hand), dealer);
    } catch (error) {
      return false;
    }
  }

  function projectedPlayersAfterPointMovement(hand) {
    const players = Rules.clonePlayers(state.players);
    if (hand.winType === "draw") {
      const drawPayment = Rules.calculateDrawPayment(hand);
      drawPayment.deltas.forEach((delta, index) => {
        players[index].score += delta;
      });
      return players;
    }
    const payment = Rules.calculatePayment(hand);
    payment.deltas.forEach((delta, index) => {
      players[index].score += delta;
    });
    const kyotakuWinner = Rules.kyotakuWinnerFor(hand, state);
    if (kyotakuWinner !== null && (Number(state.kyotaku) || 0) > 0) {
      players[kyotakuWinner].score += Number(state.kyotaku) || 0;
    }
    return players;
  }

  function oorasuPreviewText(hand, isParentContinuation) {
    if (!Rules.isOorasu(state) || !isParentContinuation) {
      return "親継続・本場 +1";
    }
    if (Rules.isSingleTop(state.players, Rules.dealerOf(state))) {
      return "オーラス親単独1位なら終了";
    }
    return els.oorasuActionSelect.value === "end" ? "オーラス親が終了を選択" : "オーラス親が続行を選択・本場 +1";
  }

  function normalizeWinnerFields(hand) {
    if (hand.winType === "doubleRon") {
      const { discarder, shimocha, kamicha } = doubleRonPlayersFromDiscarder(hand.discarder);
      hand.winner = shimocha;
      hand.secondWinner = kamicha;
      hand.discarder = discarder;
      hand.doubleRonWinners = [shimocha, kamicha];
      updateDoubleRonLabels();
      return;
    }
    if (hand.winType === "ron" && hand.discarder === hand.winner) {
      els.discarderSelect.value = String(Rules.shimochaOf(state, hand.winner));
      hand.discarder = Number(els.discarderSelect.value);
    }
  }

  function renderSettlement() {
    const settlement = Rules.settleHalf(state);
    els.settlementList.innerHTML = settlement
      .map(
        (item) => `
          <article class="settlement-card">
            <div>
              <span>${item.rank}位 / ${item.score.toLocaleString("ja-JP")}点</span>
              <strong class="rank-name">${escapeHtml(item.name)}</strong>
              <span>順位 ${formatSigned(item.rankPoint)} / 祝儀 ${formatSigned(item.bonus)} / トビ賞 ${formatSigned(item.tobi)} / 供託回収 ${formatSigned(item.kyotakuRecovery)}</span>
            </div>
            <strong class="${item.total >= 0 ? "positive" : "negative"}">${formatSigned(item.total)}</strong>
          </article>
        `
      )
      .join("");
  }

  function renderHistory() {
    els.historyCount.textContent = `${state.history.length}局`;
    if (state.history.length === 0) {
      els.historyList.innerHTML = "<li>まだ記録がありません</li>";
      return;
    }
    els.historyList.innerHTML = state.history
      .slice()
      .reverse()
      .map((hand, reverseIndex) => {
        const number = state.history.length - reverseIndex;
        const scoreText = hand.scores.map((score, index) => `${state.players[index].name}: ${score.toLocaleString("ja-JP")}`).join(" / ");
        if (hand.winType === "draw") {
          const dealerName = state.players[hand.dealer]?.name || `Player ${hand.dealer + 1}`;
          const nextText = hand.dealerTenpai ? "親継続" : "南家へ親移動";
          const paymentText = hand.payment?.payerDetails?.length
            ? hand.payment.payerDetails.map((item) => `${state.players[item.player].name}→${state.players[item.winner].name} ${item.amount.toLocaleString("ja-JP")}点`).join(" / ")
            : "点棒移動なし";
          return `
          <li>
            ${number}. ${escapeHtml(hand.roundLabel || "")}${Number.isFinite(Number(hand.honba)) ? `${hand.honba}本場 ` : ""}流局 ${escapeHtml(paymentText)} / 親 ${escapeHtml(dealerName)} ${hand.dealerTenpai ? "聴牌" : "ノーテン"} ${nextText} / 供託 ${(Number(hand.kyotakuAfter) || 0).toLocaleString("ja-JP")}点持ち越し
            <small>${escapeHtml(scoreText)}</small>
          </li>
        `;
        }
        const winnerSeat = hand.seats?.[hand.winner] || Rules.seatForPlayer(hand.dealer, hand.winner);
        const winnerName = state.players[hand.winner]?.name || `Player ${hand.winner + 1}`;
        const secondWinnerText =
          hand.winType === "doubleRon"
            ? `・${hand.seats?.[hand.secondWinner] || Rules.seatForPlayer(hand.dealer, hand.secondWinner)} ${state.players[hand.secondWinner]?.name || `Player ${hand.secondWinner + 1}`}`
            : "";
        const winLabel = hand.winType === "tsumo" ? "ツモ" : hand.winType === "doubleRon" ? "ダブロン" : "ロン";
        const hanText =
          hand.winType === "doubleRon"
            ? Rules.winnersOf(hand)
                .map((winnerIndex) => {
                  const seat = hand.seats?.[winnerIndex] || Rules.seatForPlayer(hand.dealer, winnerIndex);
                  const name = state.players[winnerIndex]?.name || `Player ${winnerIndex + 1}`;
                  const han = hand.doubleRonHands?.[winnerIndex]?.han ?? hand.doubleRonHands?.[String(winnerIndex)]?.han ?? hand.han;
                  return `${seat} ${name} ${han}ハン`;
                })
                .join(" / ")
            : `${hand.han}ハン`;
        const kyotakuText =
          Number(hand.kyotakuBefore) > 0 && hand.kyotakuWinner !== null
            ? ` / 供託 ${Number(hand.kyotakuBefore).toLocaleString("ja-JP")}点→${state.players[hand.kyotakuWinner].name}`
            : "";
        const bonusText =
          hand.bonusSettlement?.details?.length
            ? ` / 祝儀 ${hand.bonusSettlement.details.map((item) => `${state.players[item.payer].name}→${state.players[item.winner].name} ${item.amount.toLocaleString("ja-JP")}pt`).join(" / ")}`
            : "";
        return `
          <li>
            ${number}. ${escapeHtml(hand.roundLabel || "")}${Number.isFinite(Number(hand.honba)) ? `${hand.honba}本場 ` : ""}${escapeHtml(winnerSeat)} ${escapeHtml(winnerName)}${escapeHtml(secondWinnerText)} ${winLabel} ${escapeHtml(hanText)} ${hand.payment.label}${escapeHtml(kyotakuText)}${escapeHtml(bonusText)}
            <small>${escapeHtml(scoreText)}</small>
          </li>
        `;
      })
      .join("");
  }

  function renderTileGroups() {
    if (!Tiles) {
      els.tileCount.textContent = `${Rules.tileTotal()}枚`;
      els.tileGroups.innerHTML = Rules.TILE_GROUPS.map(
        (group) => `
          <article class="tile-group">
            <h3>${escapeHtml(group.name)}</h3>
            <div class="tiles">
              ${group.tiles
                .map(
                  (tile) =>
                    `<span class="tile ${tile.tone || ""}" title="${escapeHtml(tile.label)} ${tile.count}枚">${escapeHtml(shortTile(tile.label))}<small>×${tile.count}</small></span>`
                )
                .join("")}
            </div>
          </article>
        `
      ).join("");
      return;
    }

    els.tileCount.textContent = `${Tiles.totalTileCount()}枚`;
    const groupHtml = Tiles.TILE_DISPLAY_GROUPS.map(
      (group) => `
        <article class="tile-group">
          <h3>${escapeHtml(group.name)}</h3>
          <div class="tiles">
            ${group.tileIds
              .map((tileId) => renderTileImage(tileId, Tiles.TILE_COUNTS[tileId] || 0))
              .join("")}
          </div>
        </article>
      `
    ).join("");
    els.tileGroups.innerHTML = `${groupHtml}
      <article class="tile-group">
        <h3>背面牌</h3>
        <div class="tiles">
          <span class="tile image-tile back-tile" title="相手手牌表示用">
            <img src="${escapeHtml(Tiles.tileImagePath("blue_back"))}" alt="背面牌" loading="lazy" />
            <small>blue_back</small>
          </span>
        </div>
      </article>
    `;
  }

  function renderTileImage(tileId, count) {
    const tile = Tiles.getTileDefinition(tileId);
    if (!tile) return "";
    const bonusText = tile.bonusHan > 0 ? ` / ドラ+${tile.bonusHan}` : "";
    const classes = ["tile", "image-tile", tile.color !== "normal" ? tile.color : "", tile.isFlower ? "flower" : ""]
      .filter(Boolean)
      .join(" ");
    return `
      <span class="${classes}" title="${escapeHtml(tile.label)} ${count}枚${bonusText}">
        <img src="${escapeHtml(tile.image)}" alt="${escapeHtml(tile.label)}" loading="lazy" />
        <small>${escapeHtml(tile.label)} ×${count}${bonusText}</small>
      </span>
    `;
  }

  function shortTile(label) {
    return label.replace("赤", "赤").replace("青", "青");
  }

  function formatSigned(value) {
    const rounded = Math.round((Number(value) || 0) * 10) / 10;
    const body = rounded.toLocaleString("ja-JP", { maximumFractionDigits: 1 });
    return rounded > 0 ? `+${body}` : body;
  }

  function formatSeatCounts(counts) {
    return counts
      .map((count, index) => `${state.players[index].name} ${count.東}/${count.南}/${count.西}`)
      .join(" / ");
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
})();
