(function () {
  "use strict";

  const Rules = window.MahjongRules;
  const Tiles = window.MahjongTiles;
  const Game = window.MahjongGame;
  const STORAGE_KEY = "marchao-sanma-score-table-v1";
  let state = loadState();
  let battleState = null;
  let appScreen = "start";
  let lastHandResult = null;
  let battleSettlement = null;
  let cpuTurnTimer = 0;
  let autoWinEnabled = true;
  let settlementBreakdownVisible = false;

  const els = {
    undoButton: document.getElementById("undoButton"),
    resetButton: document.getElementById("resetButton"),
    battleTable: document.getElementById("battleTable"),
    battleEffect: document.getElementById("battleEffect"),
    battleResultPanel: document.getElementById("battleResultPanel"),
    battleResultTitle: document.getElementById("battleResultTitle"),
    battleResultBody: document.getElementById("battleResultBody"),
    battleConfirmButton: document.getElementById("battleConfirmButton"),
    battleContinueButton: document.getElementById("battleContinueButton"),
    battleEndButton: document.getElementById("battleEndButton"),
    battleSettlementPanel: document.getElementById("battleSettlementPanel"),
    battleSettlementBody: document.getElementById("battleSettlementBody"),
    battleSettlementDetailButton: document.getElementById("battleSettlementDetailButton"),
    battleRestartButton: document.getElementById("battleRestartButton"),
    battleSelfHand: document.getElementById("battleSelfHand"),
    battleLeftHand: document.getElementById("battleLeftHand"),
    battleRightHand: document.getElementById("battleRightHand"),
    battleSelfMelds: document.getElementById("battleSelfMelds"),
    battleLeftMelds: document.getElementById("battleLeftMelds"),
    battleRightMelds: document.getElementById("battleRightMelds"),
    battleSelfFlowers: document.getElementById("battleSelfFlowers"),
    battleLeftFlowers: document.getElementById("battleLeftFlowers"),
    battleRightFlowers: document.getElementById("battleRightFlowers"),
    battleDoraIndicators: document.getElementById("battleDoraIndicators"),
    battlePlayerScores: document.getElementById("battlePlayerScores"),
    battleActionButtons: document.getElementById("battleActionButtons"),
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
    autoWinButton: document.getElementById("autoWinButton"),
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
    removeKanSkipButtonIfPresent();
    renderTileGroups();
    bindEvents();
    render();
  }

  function removeKanSkipButtonIfPresent() {
    document.getElementById("kanSkipButton")?.remove();
  }

  function bindEvents() {
    els.battleStartButton?.addEventListener("click", () => {
      startBattleHanchan();
    });
    els.battleConfirmButton?.addEventListener("click", () => {
      handleBattleResultConfirm();
    });
    els.battleContinueButton?.addEventListener("click", () => {
      handleContinueOorasu();
    });
    els.battleEndButton?.addEventListener("click", () => {
      handleEndOorasu();
    });
    els.battleRestartButton?.addEventListener("click", () => {
      startBattleHanchan();
    });
    els.battleSettlementDetailButton?.addEventListener("click", () => {
      settlementBreakdownVisible = !settlementBreakdownVisible;
      renderBattleSettlementPanel();
    });
    els.autoWinButton?.addEventListener("click", () => {
      autoWinEnabled = !autoWinEnabled;
      settleBattleAutomation();
      enterResultIfHandEnded();
      renderBattleTable();
      scheduleCpuTurn();
    });
    els.battleSelfHand?.addEventListener("click", (event) => {
      const tileImage = event.target.closest("[data-discard-tile-id]");
      if (!tileImage) return;
      handleHumanDiscard(tileImage.dataset.discardTileId);
    });
    document.addEventListener("contextmenu", handleContextMenuTsumogiri);

    els.battleActionButtons?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-battle-action]");
      if (!button) return;
      handleBattleAction(button.dataset.battleAction);
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
    const initialDealerIndex = randomBattleDealerIndex();
    battleState = Game.startNewHand({
      playerNames: [
        state.players[0]?.name || "Player 1",
        state.players[1]?.name || "CPU 下家",
        state.players[2]?.name || "CPU 上家",
      ],
      dealerIndex: initialDealerIndex,
      initialDealerIndex,
      roundWind: "east",
      handNumber: 1,
      honba: state.honba || 0,
      kyotaku: Math.floor((Number(state.kyotaku) || 0) / 1000),
    });
    battleState = Game.afterPlayerDraw(battleState);
    settleBattleAutomation();
    renderBattleTable();
    scheduleCpuTurn();
  }

  function startBattleHanchan() {
    if (!Game) {
      els.battleStatus.textContent = "対局ロジックを読み込めませんでした";
      return;
    }
    window.clearTimeout(cpuTurnTimer);
    syncPlayersFromInputs();
    appScreen = "playing";
    lastHandResult = null;
    battleSettlement = null;
    settlementBreakdownVisible = false;
    autoWinEnabled = true;
    const initialDealerIndex = randomBattleDealerIndex();
    battleState = createBattleHand({
      dealerIndex: initialDealerIndex,
      initialDealerIndex,
      roundWind: "east",
      handNumber: 1,
      honba: 0,
      kyotaku: 0,
    });
    settleBattleAutomation();
    enterResultIfHandEnded();
    renderBattleTable();
    scheduleCpuTurn();
  }

  function battlePlayerNames() {
    return [
      state.players[0]?.name || "Player 1",
      state.players[1]?.name || "CPU 下家",
      state.players[2]?.name || "CPU 上家",
    ];
  }

  function createBattleHand(options, previousPlayers = null) {
    const next = Game.startNewHand({
      playerNames: battlePlayerNames(),
      ...options,
    });
    if (previousPlayers) {
      next.players.forEach((player, index) => {
        const previous = previousPlayers[index];
        if (!previous) return;
        player.name = previous.name;
        player.points = Number(previous.points) || 0;
        player.chips = Number(previous.chips) || 0;
      });
    }
    return Game.afterPlayerDraw(next);
  }

  function handleHumanDiscard(tileId) {
    if (!battleState || appScreen !== "playing") return;
    if (battleState.phase === "actionPending") {
      if (!Game.canDiscardDuringActionPending?.(battleState)) return;
      battleState = Game.skipOptionalSelfActionsBeforeDiscard(battleState);
    }
    if (battleState.phase !== "discard") return;
    const currentPlayer = battleState.players[battleState.currentPlayerIndex];
    if (currentPlayer?.seat !== "self") return;
    try {
      battleState = Game.discardTile(battleState, battleState.currentPlayerIndex, tileId);
      battleState = Game.afterPlayerDiscard(battleState);
      settleBattleAutomation();
      enterResultIfHandEnded();
      renderBattleTable();
      scheduleCpuTurn();
    } catch (error) {
      els.battleStatus.textContent = error.message;
    }
  }

  function discardDrawnTileAsTsumogiri() {
    if (!battleState || appScreen !== "playing") return;
    const selfIndex = battleState.players.findIndex((player) => player.seat === "self");
    if (selfIndex < 0 || battleState.currentPlayerIndex !== selfIndex) return;
    const selfPlayer = battleState.players[selfIndex];
    const drawnTile = splitHandForDisplay(selfPlayer, selfIndex).drawnTile;
    if (!drawnTile) return;
    handleHumanDiscard(drawnTile.id);
  }

  function handleContextMenuTsumogiri(event) {
    if (appScreen !== "playing") return;
    event.preventDefault();
    if (!battleState) return;
    if (isSelfPonOrKanActionPending()) {
      handleBattleAction("skip");
      return;
    }
    if (battleState.phase === "actionPending" && !Game.canDiscardDuringActionPending?.(battleState)) return;
    if (battleState.phase !== "discard" && battleState.phase !== "actionPending") return;
    discardDrawnTileAsTsumogiri();
  }

  function isSelfPendingAction() {
    if (!battleState || battleState.phase !== "actionPending") return false;
    const player = battleState.players[battleState.pendingAction?.playerIndex];
    return player?.seat === "self";
  }

  function isSelfPonOrKanActionPending() {
    if (!isSelfPendingAction()) return false;
    const actions = battleState.pendingAction?.availableActions || {};
    return Boolean(actions.canPon || actions.canKan);
  }

  function isSelfAutoWinPending() {
    if (!autoWinEnabled || !isSelfPendingAction()) return false;
    const actions = battleState.pendingAction?.availableActions || {};
    return Boolean(actions.canRon || actions.canTsumo);
  }

  function settleBattleAutomation() {
    if (!battleState || appScreen !== "playing") return false;
    let changed = false;
    for (let guard = 0; guard < 6; guard += 1) {
      if (isSelfAutoWinPending()) {
        const actions = battleState.pendingAction?.availableActions || {};
        battleState = Game.performPendingAction(battleState, actions.canTsumo ? "tsumo" : "ron");
        changed = true;
        continue;
      }
      break;
    }
    return changed;
  }

  function handleBattleAction(action) {
    if (!battleState || appScreen !== "playing" || battleState.phase !== "actionPending") return;
    try {
      battleState = Game.performPendingAction(battleState, action);
      settleBattleAutomation();
      enterResultIfHandEnded();
      renderBattleTable();
      scheduleCpuTurn();
    } catch (error) {
      els.battleStatus.textContent = error.message;
    }
  }

  function scheduleCpuTurn() {
    window.clearTimeout(cpuTurnTimer);
    if (!battleState || appScreen !== "playing" || battleState.phase !== "discard") return;
    const currentPlayer = battleState.players[battleState.currentPlayerIndex];
    if (!currentPlayer?.isCpu) return;
    cpuTurnTimer = window.setTimeout(runCpuTurn, 520);
  }

  function runCpuTurn() {
    if (!battleState || appScreen !== "playing" || battleState.phase !== "discard") return;
    const currentPlayer = battleState.players[battleState.currentPlayerIndex];
    if (!currentPlayer?.isCpu) return;
    const discard = Game.decideCpuDiscard(currentPlayer, battleState);
    if (!discard) {
      battleState = Game.endHandAsRyukyoku(battleState);
      enterResultIfHandEnded();
      renderBattleTable();
      return;
    }
    battleState = Game.discardTile(battleState, battleState.currentPlayerIndex, discard.id);
    battleState = Game.afterPlayerDiscard(battleState);
    settleBattleAutomation();
    enterResultIfHandEnded();
    renderBattleTable();
    scheduleCpuTurn();
  }

  function enterResultIfHandEnded() {
    if (!battleState || !["result", "ryukyoku"].includes(battleState.phase)) return false;
    window.clearTimeout(cpuTurnTimer);
    if (appScreen !== "result") {
      if (battleState.phase === "ryukyoku") {
        battleState = applyBattleRyukyokuSettlement(battleState);
      }
      lastHandResult = buildBattleHandResult(battleState);
      appScreen = "result";
    }
    return true;
  }

  function applyBattleRyukyokuSettlement(gameState) {
    if (gameState.lastAction?.ryukyokuSettled) return gameState;
    const pointDeltas = [0, 0, 0];
    const tenpaiPlayerIndexes = gameState.players
      .map((player, index) => ({ player, index, waits: Game.getWinningTiles(player) }))
      .filter((entry) => entry.waits.length > 0)
      .map((entry) => entry.index);
    const notenPlayerIndexes = [0, 1, 2].filter((index) => !tenpaiPlayerIndexes.includes(index));

    if (tenpaiPlayerIndexes.length === 1) {
      const receiver = tenpaiPlayerIndexes[0];
      notenPlayerIndexes.forEach((payer) => {
        pointDeltas[receiver] += 1000;
        pointDeltas[payer] -= 1000;
      });
    } else if (tenpaiPlayerIndexes.length === 2) {
      const payer = notenPlayerIndexes[0];
      tenpaiPlayerIndexes.forEach((receiver) => {
        pointDeltas[receiver] += 1000;
        pointDeltas[payer] -= 1000;
      });
    }

    const next = {
      ...gameState,
      players: gameState.players.map((player, index) => ({
        ...player,
        points: Number(player.points) + pointDeltas[index],
      })),
      lastAction: {
        ...(gameState.lastAction || {}),
        pointDeltas,
        chipDeltas: [0, 0, 0],
        tenpaiPlayerIndexes,
        dealerTenpai: tenpaiPlayerIndexes.includes(gameState.dealerIndex),
        kyotakuBefore: Number(gameState.kyotaku) || 0,
        kyotakuAfter: Number(gameState.kyotaku) || 0,
        ryukyokuSettled: true,
      },
    };
    return next;
  }

  function battleRoundText(gameState) {
    return `${gameState.roundWind === "south" ? "南" : "東"}${gameState.handNumber}局`;
  }

  function isBattleOorasu(gameState) {
    return gameState?.roundWind === "south" && Number(gameState.handNumber) === 3;
  }

  function nextBattleRoundInfo(gameState, dealerContinue, type) {
    const sequence = [
      { roundWind: "east", handNumber: 1 },
      { roundWind: "east", handNumber: 2 },
      { roundWind: "east", handNumber: 3 },
      { roundWind: "south", handNumber: 1 },
      { roundWind: "south", handNumber: 2 },
      { roundWind: "south", handNumber: 3 },
    ];
    const currentIndex = Math.max(
      0,
      sequence.findIndex(
        (round) => round.roundWind === gameState.roundWind && round.handNumber === gameState.handNumber
      )
    );
    const nextRound = dealerContinue ? sequence[currentIndex] : sequence[Math.min(currentIndex + 1, sequence.length - 1)];
    return {
      ...nextRound,
      dealerIndex: dealerContinue ? gameState.dealerIndex : (gameState.dealerIndex + 1) % 3,
      honba: dealerContinue || type === "ryukyoku" ? Number(gameState.honba || 0) + 1 : 0,
    };
  }

  function battlePlayerName(gameState, playerIndex) {
    return gameState.players[playerIndex]?.name || `Player ${playerIndex + 1}`;
  }

  function randomBattleDealerIndex() {
    return Math.floor(Math.random() * 3);
  }

  function battleInitialSeatOrder(gameState) {
    const dealerIndex = Number.isInteger(gameState?.initialDealerIndex)
      ? gameState.initialDealerIndex
      : 0;
    return [dealerIndex, (dealerIndex + 1) % 3, (dealerIndex + 2) % 3];
  }

  function pointRecordFromDeltas(deltas = []) {
    return {
      self: Number(deltas[0]) || 0,
      shimocha: Number(deltas[1]) || 0,
      kamicha: Number(deltas[2]) || 0,
    };
  }

  function rankBattlePlayers(players = [], initialOrder = [0, 1, 2]) {
    const orderRank = new Map(initialOrder.map((playerIndex, order) => [playerIndex, order]));
    return players
      .map((player, index) => ({ ...player, index }))
      .sort((left, right) => {
        if ((right.points || 0) !== (left.points || 0)) return (right.points || 0) - (left.points || 0);
        return (orderRank.get(left.index) ?? 99) - (orderRank.get(right.index) ?? 99);
      })
      .map((player, index) => ({ ...player, rank: index + 1 }));
  }

  function roundBattleScore(value, digits = 1) {
    const scale = 10 ** digits;
    return Math.round((Number(value) || 0) * scale) / scale;
  }

  function battleShimochaIndex(playerIndex) {
    return (playerIndex + 1) % 3;
  }

  function battleTobiTargetIndexes(players = []) {
    return players
      .map((player, index) => ({ index, points: Number(player.points) || 0 }))
      .filter((player) => player.points <= 0)
      .map((player) => player.index);
  }

  function battleTobiAwardIndex(gameState, result, tobiTargetIndex) {
    const action = result?.action || gameState?.lastAction || {};
    const tenpaiPlayerIndexes = action.tenpaiPlayerIndexes || [];
    if (result?.type === "doubleRon" || action.winType === "doubleRon") {
      return battleShimochaIndex(tobiTargetIndex);
    }
    if (result?.type === "ryukyoku" || action.type === "ryukyoku") {
      if (tenpaiPlayerIndexes.length === 1) return tenpaiPlayerIndexes[0];
      if (tenpaiPlayerIndexes.length === 2) return battleShimochaIndex(tobiTargetIndex);
      return null;
    }
    if (Number.isInteger(action.winnerIndex)) return action.winnerIndex;
    if (Array.isArray(action.winnerIndexes) && action.winnerIndexes.length === 2) {
      return battleShimochaIndex(tobiTargetIndex);
    }
    return null;
  }

  function calculateBattleTobiBonus(gameState, result) {
    const bonuses = [0, 0, 0];
    const isTobiEnd = result?.endReason === "tobi" || gameState?.players?.some((player) => Number(player.points) <= 0);
    if (!isTobiEnd) return bonuses;
    battleTobiTargetIndexes(gameState.players).forEach((targetIndex) => {
      const awardIndex = battleTobiAwardIndex(gameState, result, targetIndex);
      if (Number.isInteger(awardIndex)) bonuses[awardIndex] += 10;
      bonuses[targetIndex] -= 10;
    });
    return bonuses;
  }

  function isBattleSingleTop(players, playerIndex) {
    const score = Number(players[playerIndex]?.points);
    return Number.isFinite(score) && players.every((player, index) => index === playerIndex || score > Number(player.points));
  }

  function buildBattleHandResult(gameState) {
    const action = gameState.lastAction || {};
    const isRyukyoku = gameState.phase === "ryukyoku" || action.type === "ryukyoku";
    const type = isRyukyoku ? "ryukyoku" : action.winType === "tsumo" ? "tsumo" : "ron";
    const winnerIds = Number.isInteger(action.winnerIndex) ? [gameState.players[action.winnerIndex].id] : [];
    const pointDeltas = action.pointDeltas || [0, 0, 0];
    const chipDeltas = action.chipDeltas || [0, 0, 0];
    const dealerContinue = isRyukyoku
      ? Boolean(action.dealerTenpai)
      : Number(action.winnerIndex) === gameState.dealerIndex;
    const nextRound = nextBattleRoundInfo(gameState, dealerContinue, type);
    const dealerTop = isBattleSingleTop(gameState.players, gameState.dealerIndex);
    const isOorasu = isBattleOorasu(gameState);
    const hasTobi = gameState.players.some((player) => Number(player.points) <= 0);
    const requiresOorasuDealerChoice = isOorasu && dealerContinue && !dealerTop && !hasTobi;
    const isHanchanEnded =
      hasTobi ||
      (isOorasu && !requiresOorasuDealerChoice && (!dealerContinue || dealerTop));
    const endReason = hasTobi
      ? "tobi"
      : isOorasu && dealerContinue && dealerTop
        ? "dealerTop"
        : isOorasu && isHanchanEnded
          ? "oorasu"
          : "normal";

    return {
      type,
      roundLabel: battleRoundText(gameState),
      honbaBefore: Number(gameState.honba) || 0,
      honbaAfter: nextRound.honba,
      winnerIds,
      loserId: Number.isInteger(action.discarderIndex) ? gameState.players[action.discarderIndex].id : undefined,
      tenpaiPlayerIds: (action.tenpaiPlayerIndexes || []).map((index) => gameState.players[index].id),
      pointChanges: pointRecordFromDeltas(pointDeltas),
      chipChanges: pointRecordFromDeltas(chipDeltas),
      kyotakuBefore: Number(action.kyotakuBefore ?? gameState.kyotaku) || 0,
      kyotakuAfter: Number(action.kyotakuAfter ?? gameState.kyotaku) || 0,
      nextRoundLabel: `${nextRound.roundWind === "south" ? "南" : "東"}${nextRound.handNumber}局${nextRound.honba}本場`,
      nextRound,
      isDealerContinue: dealerContinue,
      isHanchanEnded,
      requiresOorasuDealerChoice,
      canContinueOorasu: requiresOorasuDealerChoice,
      canEndOorasu: requiresOorasuDealerChoice,
      endReason,
      action,
      rankings: rankBattlePlayers(gameState.players, battleInitialSeatOrder(gameState)),
    };
  }

  function handleBattleResultConfirm() {
    if (!lastHandResult || lastHandResult.requiresOorasuDealerChoice) return;
    if (lastHandResult.isHanchanEnded) {
      battleSettlement = buildBattleSettlement(battleState);
      settlementBreakdownVisible = false;
      appScreen = "settlement";
      renderBattleTable();
      return;
    }
    startNextBattleHand(lastHandResult.nextRound);
  }

  function handleContinueOorasu() {
    if (!lastHandResult?.canContinueOorasu) return;
    startNextBattleHand({
      roundWind: battleState.roundWind,
      handNumber: battleState.handNumber,
      dealerIndex: battleState.dealerIndex,
      honba: lastHandResult.honbaAfter,
    });
  }

  function handleEndOorasu() {
    if (!lastHandResult?.canEndOorasu) return;
    lastHandResult = {
      ...lastHandResult,
      isHanchanEnded: true,
      endReason: "dealerChoiceEnd",
      requiresOorasuDealerChoice: false,
    };
    battleSettlement = buildBattleSettlement(battleState);
    settlementBreakdownVisible = false;
    appScreen = "settlement";
    renderBattleTable();
  }

  function startNextBattleHand(nextRound) {
    const previousPlayers = battleState.players.map((player) => ({
      name: player.name,
      points: player.points,
      chips: player.chips,
    }));
    appScreen = "playing";
    lastHandResult = null;
    battleSettlement = null;
    battleState = createBattleHand(
      {
        dealerIndex: nextRound.dealerIndex,
        roundWind: nextRound.roundWind,
        handNumber: nextRound.handNumber,
        honba: nextRound.honba,
        kyotaku: Number(battleState.kyotaku) || 0,
        initialDealerIndex: Number.isInteger(battleState.initialDealerIndex)
          ? battleState.initialDealerIndex
          : battleState.dealerIndex,
      },
      previousPlayers
    );
    settleBattleAutomation();
    enterResultIfHandEnded();
    renderBattleTable();
    scheduleCpuTurn();
  }

  function buildBattleSettlement(gameState) {
    const initialOrder = battleInitialSeatOrder(gameState);
    const kyotaku = Math.max(0, Math.floor(Number(gameState.kyotaku) || 0));
    const settlementPlayers = gameState.players.map((player, index) => ({ ...player, index }));
    const topBeforeKyotaku = rankBattlePlayers(settlementPlayers, initialOrder)[0];
    if (topBeforeKyotaku && kyotaku > 0) {
      settlementPlayers[topBeforeKyotaku.index].points += kyotaku * 1000;
    }
    const ranked = rankBattlePlayers(settlementPlayers, initialOrder);
    const tobiBonuses = calculateBattleTobiBonus(gameState, lastHandResult);
    return ranked.map((player) => {
      const uma = player.rank === 1 ? 20 : player.rank === 3 ? -20 : 0;
      const basePointScore = roundBattleScore(((Number(player.points) || 0) - 40000) / 1000);
      const oka = player.rank === 1 ? 15 : 0;
      const specialAdjustment = player.rank === 1 ? -7 : -5;
      const tobi = tobiBonuses[player.index] || 0;
      const chipScore = roundBattleScore((Number(player.chips) || 0) / 500);
      const internalFinalPoint = roundBattleScore(basePointScore + uma + oka + specialAdjustment + tobi + chipScore);
      const displayFinalPoint = Math.round(internalFinalPoint * 100);
      return {
        ...player,
        rankPoint: basePointScore,
        basePointScore,
        uma,
        oka,
        specialAdjustment,
        tobi,
        chipScore,
        internalFinalPoint,
        displayFinalPoint,
        kyotakuRecovery: topBeforeKyotaku?.index === player.index ? kyotaku * 1000 : 0,
        finalScore: displayFinalPoint,
      };
    });
  }

  function battleStatusText() {
    if (!battleState) return "待機中";
    if (battleState.phase === "ryukyoku") return "流局しました";
    if (battleState.phase === "result") return battleState.lastAction?.effect || "結果";
    if (battleState.phase === "actionPending") return "アクション選択";
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

  function playerDisplaySeat(player, index) {
    return player?.seat || Game.PLAYER_SEATS[index] || "self";
  }

  function playerDisplayPoints(player) {
    return Number(player?.points ?? player?.score) || 0;
  }

  function playerDisplayChipPoints(player) {
    return Number(player?.chips ?? player?.bonus) || 0;
  }

  function formatDisplayPoints(points) {
    return String(Math.round((Number(points) || 0) / 100));
  }

  function formatDisplayChipPoints(chipPoints) {
    const value = Math.round((Number(chipPoints) || 0) / 500);
    if (value > 0) return `+${value}`;
    if (value < 0) return String(value);
    return "0";
  }

  function formatScoreDisplay(points, chipPoints) {
    return `${formatDisplayPoints(points)}  ${formatDisplayChipPoints(chipPoints)}`;
  }

  function renderCenterScoreDisplay(players = []) {
    const bySeat = {};
    players.forEach((player, index) => {
      bySeat[playerDisplaySeat(player, index)] = player;
    });
    return ["kamicha", "shimocha", "self"]
      .map((seat) => {
        const player = bySeat[seat];
        const text = formatScoreDisplay(playerDisplayPoints(player), playerDisplayChipPoints(player));
        return `<div class="score-display ${seat}-score">${escapeHtml(text)}</div>`;
      })
      .join("");
  }

  function renderCentralInfoPanel(gameState) {
    if (!gameState) return;
    const kyotakuCount = Math.max(0, Math.floor(Number(gameState.kyotaku) || 0));
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
      els.battlePlayerScores.innerHTML = renderCenterScoreDisplay(gameState.players);
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

  function renderBattleActionButtons(gameState) {
    if (!gameState || gameState.phase !== "actionPending") return "";
    const actions = gameState.pendingAction?.availableActions || {};
    const buttons = [
      ["ron", "ロン", actions.canRon],
      ["tsumo", "ツモ", actions.canTsumo],
      ["pon", "ポン", actions.canPon],
      ["kan", "カン", actions.canKan],
      ["riichi", "リーチ", actions.canRiichi],
      ["skip", "スキップ", actions.canSkip],
    ];
    return buttons
      .filter(([, , enabled]) => enabled)
      .map(
        ([action, label]) =>
          `<button class="primary-button battle-action-button" type="button" data-battle-action="${action}">${label}</button>`
      )
      .join("");
  }

  function renderAutoControlButtons() {
    if (els.autoWinButton) {
      els.autoWinButton.classList.toggle("is-on", autoWinEnabled);
      els.autoWinButton.classList.toggle("is-off", !autoWinEnabled);
      els.autoWinButton.setAttribute("aria-pressed", String(autoWinEnabled));
      els.autoWinButton.textContent = "自動和了";
    }
  }

  function formatBattleDelta(value, suffix = "") {
    const number = Number(value) || 0;
    if (number > 0) return `+${number.toLocaleString("ja-JP")}${suffix}`;
    if (number < 0) return `${number.toLocaleString("ja-JP")}${suffix}`;
    return `0${suffix}`;
  }

  function formatBattlePointDelta(value) {
    const number = roundBattleScore(value);
    const text = number.toLocaleString("ja-JP", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
    if (number > 0) return `+${text}`;
    if (number < 0) return text;
    return "0.0";
  }

  function battleResultTypeText(result) {
    if (!result) return "";
    if (result.type === "tsumo") return "ツモアガリ";
    if (result.type === "doubleRon") return "ダブロン";
    if (result.type === "ryukyoku") return "流局";
    return "ロンアガリ";
  }

  function battleEndReasonText(reason) {
    return {
      normal: "",
      tobi: "トビ",
      oorasu: "オーラス終了",
      dealerTop: "オーラス親1位",
      dealerChoiceEnd: "オーラス親の終了選択",
      userSelectedEnd: "終了選択",
    }[reason] || "";
  }

  function renderBattleDeltaRows(record = {}, suffix = "") {
    const seats = ["self", "shimocha", "kamicha"];
    return seats
      .map((seat, index) => {
        const player = battleState?.players[index];
        return `<li>${escapeHtml(playerPositionLabel(seat))} ${escapeHtml(player?.name || `Player ${index + 1}`)} ${escapeHtml(formatBattleDelta(record[seat], suffix))}</li>`;
      })
      .join("");
  }

  function renderBattleResultPanel() {
    if (!els.battleResultPanel || !lastHandResult) return;
    const result = lastHandResult;
    const action = result.action || {};
    const winnerName = Number.isInteger(action.winnerIndex) ? battlePlayerName(battleState, action.winnerIndex) : "";
    const loserName = Number.isInteger(action.discarderIndex) ? battlePlayerName(battleState, action.discarderIndex) : "";
    const endReasonText = battleEndReasonText(result.endReason);
    const rankRows = result.rankings
      .map(
        (player) =>
          `<li>${player.rank}位 ${escapeHtml(player.name)} ${Number(player.points).toLocaleString("ja-JP")}点</li>`
      )
      .join("");

    els.battleResultTitle.textContent = `${result.roundLabel}${result.honbaBefore}本場 終了`;
    els.battleResultBody.innerHTML = `
      <section>
        <h3>結果</h3>
        <p>${escapeHtml(battleResultTypeText(result))}${winnerName ? `：${escapeHtml(winnerName)}` : ""}${loserName ? ` / 放銃：${escapeHtml(loserName)}` : ""}</p>
      </section>
      ${
        result.type === "ryukyoku"
          ? `<section><h3>聴牌</h3><p>${result.tenpaiPlayerIds.length ? result.tenpaiPlayerIds.map((id) => escapeHtml(battleState.players.find((player) => player.id === id)?.name || id)).join(" / ") : "全員ノーテン"}</p></section>`
          : ""
      }
      <section>
        <h3>点棒移動</h3>
        <ul>${renderBattleDeltaRows(result.pointChanges, "点")}</ul>
      </section>
      <section>
        <h3>祝儀</h3>
        <ul>${renderBattleDeltaRows(result.chipChanges, "pt")}</ul>
      </section>
      <section>
        <h3>供託</h3>
        <p>${result.kyotakuBefore}本 → ${result.kyotakuAfter}本</p>
      </section>
      ${
        result.requiresOorasuDealerChoice
          ? `<section><h3>現在順位</h3><ul>${rankRows}</ul><p>親は1位ではないため、続行または終了を選択できます。</p></section>`
          : ""
      }
      ${endReasonText ? `<section><h3>半荘終了理由</h3><p>${escapeHtml(endReasonText)}</p></section>` : ""}
      ${!result.isHanchanEnded || result.requiresOorasuDealerChoice ? `<section><h3>次局</h3><p>${escapeHtml(result.nextRoundLabel)}</p></section>` : ""}
    `;
    els.battleConfirmButton.hidden = result.requiresOorasuDealerChoice;
    els.battleContinueButton.hidden = !result.requiresOorasuDealerChoice;
    els.battleEndButton.hidden = !result.requiresOorasuDealerChoice;
  }

  function renderBattleSettlementPanel() {
    if (!els.battleSettlementPanel) return;
    const settlement = battleSettlement || (battleState ? buildBattleSettlement(battleState) : []);
    els.battleSettlementBody.innerHTML = settlement
      .map(
        (item) => {
          const detailRows = settlementBreakdownVisible
            ? `
            <span>素点：${formatBattlePointDelta(item.basePointScore)}</span>
            <span>ウマ：${formatBattleDelta(item.uma)}</span>
            <span>オカ：${formatBattleDelta(item.oka)}</span>
            <span>特別調整：${formatBattleDelta(item.specialAdjustment)}</span>
            <span>トビ賞：${formatBattleDelta(item.tobi)}</span>
            <span>祝儀：${formatBattleDelta(item.chipScore)}</span>
            <span>内部最終ポイント：${formatBattlePointDelta(item.internalFinalPoint)}</span>
            <span>供託回収：${formatBattleDelta(item.kyotakuRecovery, "点")}</span>
          `
            : "";
          return `
          <article class="battle-settlement-card">
            <strong>${item.rank}位：${escapeHtml(item.name)}</strong>
            <span>最終持ち点：${Number(item.points).toLocaleString("ja-JP")}</span>
            ${detailRows}
            <b>最終ポイント：${formatBattleDelta(item.displayFinalPoint)}</b>
          </article>
        `;
        }
      )
      .join("");
    if (els.battleSettlementDetailButton) {
      els.battleSettlementDetailButton.textContent = "精算内訳";
      els.battleSettlementDetailButton.setAttribute("aria-pressed", String(settlementBreakdownVisible));
    }
  }

  function renderBattleScreenPanels() {
    const isResult = appScreen === "result";
    const isSettlement = appScreen === "settlement";
    if (els.battleResultPanel) els.battleResultPanel.hidden = !isResult;
    if (els.battleSettlementPanel) els.battleSettlementPanel.hidden = !isSettlement;
    if (els.battleStartButton) els.battleStartButton.hidden = appScreen !== "start";
    if (els.battleActionButtons) els.battleActionButtons.hidden = appScreen !== "playing";
    if (isResult) renderBattleResultPanel();
    if (isSettlement) renderBattleSettlementPanel();
  }

  function renderBattleEffect(gameState) {
    const effect = gameState?.lastEffect || gameState?.lastAction?.effect || "";
    if (!els.battleEffect) return;
    els.battleEffect.textContent = effect;
    els.battleEffect.hidden = !effect;
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
      (battleState?.phase === "discard" || battleState?.phase === "actionPending") &&
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
      .map((tile) => {
        const canDiscardTile = canDiscard && canSelectBattleDiscard(tile, playerIndex);
        return renderBattleTile(tile, canDiscardTile ? "discardable" : "discard-disabled", canDiscardTile);
      })
      .join("");
    const drawnTile = display.drawnTile
      ? renderBattleTile(
          display.drawnTile,
          canDiscard && canSelectBattleDiscard(display.drawnTile, playerIndex)
            ? "discardable drawn"
            : "drawn discard-disabled",
          canDiscard && canSelectBattleDiscard(display.drawnTile, playerIndex)
        )
      : "";
    return normalTiles + drawnTile;
  }

  function canSelectBattleDiscard(tile, playerIndex) {
    if (!battleState?.riichiDeclaration) return true;
    return (
      battleState.riichiDeclaration.playerIndex === playerIndex &&
      battleState.riichiDeclaration.options?.some((option) => option.tileId === tile.id)
    );
  }

  function discardTileOf(discard) {
    return discard?.tile || discard || null;
  }

  function tileRotationClassForSeat(seat) {
    if (seat === "shimocha") return "tile-rotate-left";
    if (seat === "kamicha") return "tile-rotate-right";
    return "tile-no-rotate";
  }

  function calledTileIndexForMeld(meld, tiles) {
    if (!meld || meld.type === "ankan") return null;
    if (meld.calledFromSeat === "kamicha") return 0;
    if (meld.calledFromSeat === "shimocha") return Math.max(0, tiles.length - 1);
    return null;
  }

  function meldBaseTiles(meld) {
    const tiles = [...(meld?.tiles || [])];
    if (meld?.type === "kakan" && meld.addedTile) {
      return tiles.filter((tile) => tile.id !== meld.addedTile.id).slice(0, 3);
    }
    return tiles;
  }

  function arrangeCalledMeldTiles(meld) {
    const tiles = meldBaseTiles(meld);
    if (meld?.type === "ankan" || !meld?.calledTile) return tiles;
    const calledTile = meld.calledTile;
    const handTiles = tiles.filter((tile) => tile.id !== calledTile.id);
    if (meld.calledFromSeat === "kamicha") return [calledTile, ...handTiles];
    if (meld.calledFromSeat === "shimocha") return [...handTiles, calledTile];
    return tiles;
  }

  function renderMeldTile(tile, classes = "", useBack = false) {
    if (!tile && !useBack) return "";
    const src = useBack ? Tiles.tileImagePath("blue_back") : tile.image;
    const label = useBack ? "裏向き牌" : tile.name || tile.baseId || tile.id;
    return `<img class="table-tile-img meld-tile ${classes}" src="${escapeHtml(src)}" alt="${escapeHtml(label)}" loading="lazy" />`;
  }

  function renderMeld(meld) {
    if (!meld) return "";
    if (meld.type === "ankan") {
      const tiles = meldBaseTiles(meld);
      return `
        <div class="meld-group ankan">
          ${renderMeldTile(tiles[0], "", true)}
          ${renderMeldTile(tiles[1])}
          ${renderMeldTile(tiles[2])}
          ${renderMeldTile(tiles[3], "", true)}
        </div>
      `;
    }
    const tiles = arrangeCalledMeldTiles(meld);
    const calledIndex = calledTileIndexForMeld(meld, tiles);
    return `
      <div class="meld-group ${escapeHtml(meld.type || "")}">
        ${tiles
          .map((tile, index) => {
            if (meld.type === "kakan" && index === calledIndex && meld.addedTile) {
              return `
                <span class="called-tile-stack">
                  ${renderMeldTile(tile, "called-tile")}
                  ${renderMeldTile(meld.addedTile, "called-tile added-kan-tile")}
                </span>
              `;
            }
            return renderMeldTile(tile, index === calledIndex ? "called-tile" : "");
          })
          .join("")}
      </div>
    `;
  }

  function renderPlayerMelds(player) {
    return (player?.melds || []).map(renderMeld).join("");
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
    const canDiscard =
      (battleState.phase === "discard" || Game.canDiscardDuringActionPending?.(battleState)) &&
      currentPlayer?.seat === "self" &&
      (!battleState.riichiDeclaration ||
        battleState.riichiDeclaration.playerIndex === battleState.currentPlayerIndex);

    els.battleSelfName.textContent = `自分 ${selfPlayer?.name || "Player 1"}`;
    els.battleRightName.textContent = `下家 ${rightPlayer?.name || "CPU 下家"}`;
    els.battleLeftName.textContent = `上家 ${leftPlayer?.name || "CPU 上家"}`;
    renderCentralInfoPanel(battleState);
    renderBattleEffect(battleState);
    renderAutoControlButtons();
    if (els.battleActionButtons) {
      els.battleActionButtons.innerHTML = renderBattleActionButtons(battleState);
    }
    els.battleStatus.textContent = battleStatusText();
    els.battleStartButton.textContent = battleState.phase === "ryukyoku" ? "もう一局" : "対局開始";

    els.battleSelfHand.innerHTML = renderSelfHand(selfPlayer, battleState.players.indexOf(selfPlayer), canDiscard);
    els.battleSelfMelds.innerHTML = renderPlayerMelds(selfPlayer);
    els.battleLeftMelds.innerHTML = renderPlayerMelds(leftPlayer);
    els.battleRightMelds.innerHTML = renderPlayerMelds(rightPlayer);
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
    renderBattleScreenPanels();
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
    els.battleSelfMelds.innerHTML = "";
    els.battleLeftMelds.innerHTML = "";
    els.battleRightMelds.innerHTML = "";
    els.battleSelfFlowers.innerHTML = "";
    els.battleLeftFlowers.innerHTML = "";
    els.battleRightFlowers.innerHTML = "";
    els.battleDoraIndicators.innerHTML = "";
    renderBattleEffect(null);
    renderAutoControlButtons();
    if (els.battleActionButtons) els.battleActionButtons.innerHTML = "";
    if (els.battlePlayerScores) els.battlePlayerScores.innerHTML = renderCenterScoreDisplay(state.players);
    els.battleFlowerTiles.innerHTML = "";
    els.battleSelfRiver.innerHTML = "";
    els.battleLeftRiver.innerHTML = "";
    els.battleRightRiver.innerHTML = "";
    els.battleLeftHand.innerHTML = renderBackTiles(13);
    els.battleRightHand.innerHTML = renderBackTiles(13);
    renderBattleScreenPanels();
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
