(function (root, factory) {
  const api = factory(root);
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.MahjongGame = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (root) {
  "use strict";

  const Tiles =
    root.MahjongTiles ||
    (typeof require === "function" ? require("./tiles.js") : null);
  function HandEval() {
    return (
      root.MahjongHandEvaluation ||
      (typeof require === "function" ? require("./hand-evaluation.js") : null)
    );
  }

  const PLAYER_SEATS = ["self", "shimocha", "kamicha"];
  const DEFAULT_PLAYER_NAMES = ["Player 1", "CPU Shimocha", "CPU Kamicha"];
  const ACTIONS = ["ron", "tsumo", "pon", "kan", "riichi", "skip"];

  const INITIAL_HAND_SIZE = 13;
  const DEAL_TILE_COUNT = 39;
  const DRAW_WALL_COUNT = 63;
  const DORA_INDICATOR_COUNT = 1;
  const URA_DORA_INDICATOR_COUNT = 1;
  const RINSHAN_TILE_COUNT = 8;
  const TOTAL_WALL_COUNT =
    DEAL_TILE_COUNT +
    DRAW_WALL_COUNT +
    DORA_INDICATOR_COUNT +
    URA_DORA_INDICATOR_COUNT +
    RINSHAN_TILE_COUNT;

  function assertTiles() {
    if (!Tiles) {
      throw new Error("MahjongTiles is not loaded.");
    }
  }

  function cloneTile(tile) {
    return tile ? { ...tile } : null;
  }

  function cloneTiles(tiles) {
    return Array.isArray(tiles) ? tiles.map(cloneTile).filter(Boolean) : [];
  }

  function tileFromDiscard(discard) {
    return discard?.tile || discard || null;
  }

  function cloneDiscard(discard) {
    const tile = tileFromDiscard(discard);
    if (!tile) return null;
    return {
      tile: cloneTile(tile),
      isRiichiDeclaration: Boolean(discard?.isRiichiDeclaration),
      isTsumogiri: Boolean(discard?.isTsumogiri),
    };
  }

  function cloneDiscards(discards) {
    return Array.isArray(discards) ? discards.map(cloneDiscard).filter(Boolean) : [];
  }

  function tilesFromDiscards(discards) {
    return cloneTiles((discards || []).map(tileFromDiscard));
  }

  function clonePlayer(player) {
    return {
      ...player,
      hand: cloneTiles(player.hand),
      discards: cloneDiscards(player.discards),
      flowers: cloneTiles(player.flowers),
      melds: Array.isArray(player.melds) ? player.melds.map((meld) => ({ ...meld })) : [],
      riichiWinningTiles: Array.isArray(player.riichiWinningTiles)
        ? [...player.riichiWinningTiles]
        : [],
    };
  }

  function cloneGameState(gameState) {
    const drawWall = cloneTiles(gameState.drawWall || gameState.wall);
    return {
      ...gameState,
      dealTiles: cloneTiles(gameState.dealTiles),
      drawWall,
      wall: drawWall.map(cloneTile),
      rinshanTiles: cloneTiles(gameState.rinshanTiles),
      players: gameState.players.map(clonePlayer),
      doraIndicators: cloneTiles(gameState.doraIndicators),
      uraDoraIndicators: cloneTiles(gameState.uraDoraIndicators),
      lastAction: gameState.lastAction ? { ...gameState.lastAction } : null,
      pendingAction: clonePendingAction(gameState.pendingAction),
      riichiDeclaration: gameState.riichiDeclaration ? { ...gameState.riichiDeclaration } : null,
      pendingRiichi: gameState.pendingRiichi ? { ...gameState.pendingRiichi } : null,
    };
  }

  function clonePendingAction(pendingAction) {
    if (!pendingAction) return null;
    return {
      ...pendingAction,
      discardTile: cloneTile(pendingAction.discardTile),
      availableActions: { ...(pendingAction.availableActions || {}) },
      candidates: Array.isArray(pendingAction.candidates)
        ? pendingAction.candidates.map(cloneKanCandidate)
        : [],
    };
  }

  function cloneKanCandidate(candidate) {
    return candidate
      ? {
          ...candidate,
          tiles: cloneTiles(candidate.tiles),
          claimedTile: cloneTile(candidate.claimedTile),
        }
      : null;
  }

  function createTiles() {
    assertTiles();
    return Tiles.createTiles();
  }

  function shuffleWall(tiles, random = Math.random) {
    assertTiles();
    return Tiles.shuffleWall(tiles, random);
  }

  function createWall(random = Math.random) {
    assertTiles();
    return Tiles.createWall(random);
  }

  function drawTile(wall) {
    assertTiles();
    return Tiles.drawTile(wall);
  }

  function validateWall(wall) {
    assertTiles();
    return Tiles.validateWall(wall);
  }

  function syncDrawWallState(gameState) {
    gameState.drawWall = cloneTiles(gameState.drawWall);
    gameState.wall = gameState.drawWall.map(cloneTile);
    gameState.remainingDraws = gameState.drawWall.length;
    return gameState;
  }

  function splitWall(wall) {
    const tiles = cloneTiles(wall);
    if (tiles.length !== TOTAL_WALL_COUNT) {
      throw new Error(`Marchao sanma wall must have ${TOTAL_WALL_COUNT} tiles. Current: ${tiles.length}`);
    }

    const dealTiles = tiles.slice(0, DEAL_TILE_COUNT);
    const drawWall = tiles.slice(DEAL_TILE_COUNT, DEAL_TILE_COUNT + DRAW_WALL_COUNT);
    const doraStart = DEAL_TILE_COUNT + DRAW_WALL_COUNT;
    const doraIndicators = tiles.slice(doraStart, doraStart + DORA_INDICATOR_COUNT);
    const uraDoraStart = doraStart + DORA_INDICATOR_COUNT;
    const uraDoraIndicators = tiles.slice(uraDoraStart, uraDoraStart + URA_DORA_INDICATOR_COUNT);
    const rinshanTiles = tiles.slice(uraDoraStart + URA_DORA_INDICATOR_COUNT);

    return {
      dealTiles,
      drawWall,
      doraIndicators,
      uraDoraIndicators,
      rinshanTiles,
    };
  }

  function validateWallSections(gameState) {
    const playerTiles = Array.isArray(gameState.players)
      ? gameState.players.flatMap((player) => [
          ...cloneTiles(player.hand),
          ...tilesFromDiscards(player.discards),
          ...cloneTiles(player.flowers),
          ...(Array.isArray(player.melds)
            ? player.melds.flatMap((meld) => cloneTiles(meld.tiles))
            : []),
        ])
      : [];
    const sections = {
      dealTiles: cloneTiles(gameState.dealTiles),
      drawWall: cloneTiles(gameState.drawWall || gameState.wall),
      doraIndicators: cloneTiles(gameState.doraIndicators),
      uraDoraIndicators: cloneTiles(gameState.uraDoraIndicators),
      rinshanTiles: cloneTiles(gameState.rinshanTiles),
      playerTiles,
    };
    const combined = [
      ...sections.dealTiles,
      ...sections.drawWall,
      ...sections.doraIndicators,
      ...sections.uraDoraIndicators,
      ...sections.rinshanTiles,
      ...sections.playerTiles,
    ];
    const validation = validateWall(combined);
    const sectionErrors = [];

    if (sections.dealTiles.length > DEAL_TILE_COUNT) {
      sectionErrors.push(`dealTiles cannot exceed ${DEAL_TILE_COUNT} tiles.`);
    }
    if (sections.drawWall.length > DRAW_WALL_COUNT) {
      sectionErrors.push(`drawWall cannot exceed ${DRAW_WALL_COUNT} tiles.`);
    }
    if (sections.doraIndicators.length < DORA_INDICATOR_COUNT) {
      sectionErrors.push("doraIndicators must have at least one tile.");
    }
    if (sections.uraDoraIndicators.length < URA_DORA_INDICATOR_COUNT) {
      sectionErrors.push("uraDoraIndicators must have at least one tile.");
    }
    if (sections.rinshanTiles.length > RINSHAN_TILE_COUNT) {
      sectionErrors.push(`rinshanTiles cannot exceed ${RINSHAN_TILE_COUNT} tiles.`);
    }

    return {
      valid: validation.valid && sectionErrors.length === 0,
      errors: [...validation.errors, ...sectionErrors],
      sections: Object.fromEntries(Object.entries(sections).map(([key, value]) => [key, value.length])),
    };
  }

  function nextPlayerIndex(index) {
    return (Number(index) + 1) % 3;
  }

  function tileBaseId(tile) {
    return tile?.baseId || Tiles?.getTileDefinition?.(tile)?.baseId || "";
  }

  function tileKindId(tile) {
    return Tiles?.tileKindId ? Tiles.tileKindId(tile) : String(tile?.id || "").replace(/_\d+$/, "");
  }

  function sameBaseTiles(tiles, baseId) {
    return cloneTiles(tiles).filter((tile) => tileBaseId(tile) === baseId);
  }

  function availableActionState(overrides = {}) {
    return ACTIONS.reduce((actions, action) => {
      actions[`can${action[0].toUpperCase()}${action.slice(1)}`] = Boolean(overrides[action]);
      return actions;
    }, {});
  }

  function hasAnyAction(actions) {
    return Boolean(actions?.canRon || actions?.canTsumo || actions?.canPon || actions?.canKan || actions?.canRiichi);
  }

  function isMenzen(player) {
    return (player?.melds || []).every((meld) => meld.type === "ankan");
  }

  function baseTileCandidates() {
    const seen = new Set();
    return (Tiles?.createTiles?.() || [])
      .filter((tile) => !tile.isFlower)
      .filter((tile) => {
        const baseId = tileBaseId(tile);
        if (!baseId || seen.has(baseId)) return false;
        seen.add(baseId);
        return true;
      });
  }

  function getWinningTiles(hand) {
    const evaluator = HandEval();
    if (!evaluator?.getWinningCandidates) return [];
    const normalHand = cloneTiles(hand).filter((tile) => !tile.isFlower);
    if (normalHand.length % 3 !== 1) return [];
    return baseTileCandidates()
      .filter((candidateTile) =>
        evaluator.getWinningCandidates([...normalHand, candidateTile], candidateTile).length > 0
      )
      .map(tileBaseId)
      .sort();
  }

  function areSameWinningTiles(left = [], right = []) {
    const leftSet = new Set(left);
    const rightSet = new Set(right);
    if (leftSet.size !== rightSet.size) return false;
    for (const baseId of leftSet) {
      if (!rightSet.has(baseId)) return false;
    }
    return true;
  }

  function isFuriten(player, gameState, winningTiles = getWinningTiles(player?.hand || [])) {
    const waits = new Set(winningTiles);
    return (player?.discards || []).some((discard) => waits.has(tileBaseId(tileFromDiscard(discard))));
  }

  function canRon(player, discardTile, gameState) {
    if (!player || !discardTile || player.seat === gameState.players[gameState.currentPlayerIndex]?.seat) {
      return false;
    }
    const evaluator = HandEval();
    if (!evaluator?.evaluateWinningHand) return false;
    const result = evaluator.evaluateWinningHand([...cloneTiles(player.hand), cloneTile(discardTile)], discardTile, {
      allWinTiles: [...cloneTiles(player.hand), cloneTile(discardTile), ...cloneTiles(player.flowers)],
      isTsumo: false,
      isMenzen: isMenzen(player),
      isRiichi: Boolean(player.isRiichi),
      doraIndicators: gameState.doraIndicators,
      uraDoraIndicators: gameState.uraDoraIndicators,
    });
    return Boolean(result.best);
  }

  function canTsumo(player, gameState) {
    if (!player || gameState.players[gameState.currentPlayerIndex] !== player) return false;
    const evaluator = HandEval();
    if (!evaluator?.evaluateWinningHand) return false;
    const drawnTile = drawnTileForPlayer(gameState, gameState.currentPlayerIndex);
    const result = evaluator.evaluateWinningHand(cloneTiles(player.hand), drawnTile, {
      allWinTiles: [...cloneTiles(player.hand), ...cloneTiles(player.flowers)],
      isTsumo: true,
      isMenzen: isMenzen(player),
      isRiichi: Boolean(player.isRiichi),
      doraIndicators: gameState.doraIndicators,
      uraDoraIndicators: gameState.uraDoraIndicators,
    });
    return Boolean(result.best);
  }

  function canPon(player, discardTile) {
    if (!player || player.isRiichi || !discardTile) return false;
    return sameBaseTiles(player.hand, tileBaseId(discardTile)).length >= 2;
  }

  function getAnkanCandidates(player, gameState) {
    if (!player || Number(gameState?.remainingDraws) <= 1) return [];
    const counts = new Map();
    cloneTiles(player.hand).forEach((tile) => {
      const baseId = tileBaseId(tile);
      counts.set(baseId, (counts.get(baseId) || 0) + 1);
    });
    return [...counts.entries()]
      .filter(([, count]) => count >= 4)
      .map(([baseId]) => ({
        type: "ankan",
        baseId,
        tiles: sameBaseTiles(player.hand, baseId).slice(0, 4),
      }));
  }

  function getMinkanCandidates(player, gameState) {
    const discardTile = gameState?.pendingAction?.discardTile || gameState?.lastAction?.tile;
    if (!player || player.isRiichi || Number(gameState?.remainingDraws) <= 1 || !discardTile) return [];
    const baseId = tileBaseId(discardTile);
    const tiles = sameBaseTiles(player.hand, baseId).slice(0, 3);
    return tiles.length >= 3
      ? [{ type: "minkan", baseId, tiles, claimedTile: cloneTile(discardTile) }]
      : [];
  }

  function getKakanCandidates(player, gameState) {
    if (!player || player.isRiichi || Number(gameState?.remainingDraws) <= 1) return [];
    return (player.melds || [])
      .filter((meld) => meld.type === "pon")
      .map((meld) => {
        const baseId = meld.baseId || tileBaseId(meld.tiles?.[0]);
        const tile = sameBaseTiles(player.hand, baseId)[0];
        return tile ? { type: "kakan", baseId, tiles: [tile], meldId: meld.id } : null;
      })
      .filter(Boolean);
  }

  function getKanCandidates(player, gameState) {
    if (!player || Number(gameState?.remainingDraws) <= 1) return [];
    if (player.isRiichi) return getRiichiAnkanCandidates(player, gameState);
    if (gameState?.pendingAction?.source === "afterDiscard") return getMinkanCandidates(player, gameState);
    return [...getAnkanCandidates(player, gameState), ...getKakanCandidates(player, gameState)];
  }

  function canKan(player, gameState) {
    return Number(gameState?.remainingDraws) >= 2 && getKanCandidates(player, gameState).length > 0;
  }

  function riichiDiscardOptions(player, gameState) {
    if (!player || player.isRiichi || !isMenzen(player) || Number(player.points) < 1000) return [];
    const options = [];
    player.hand.forEach((tile) => {
      const trialHand = cloneTiles(player.hand);
      const index = trialHand.findIndex((candidate) => candidate.id === tile.id);
      if (index < 0) return;
      trialHand.splice(index, 1);
      const waits = getWinningTiles(trialHand);
      if (waits.length === 0) return;
      if (isFuriten({ ...player, hand: trialHand }, gameState, waits)) return;
      options.push({ tileId: tile.id, waits });
    });
    return options;
  }

  function canRiichi(player, gameState) {
    return (
      Boolean(player) &&
      gameState?.phase === "discard" &&
      gameState.players[gameState.currentPlayerIndex] === player &&
      !player.isRiichi &&
      isMenzen(player) &&
      Number(player.points) >= 1000 &&
      riichiDiscardOptions(player, gameState).length > 0
    );
  }

  function getRiichiAnkanCandidates(player, gameState) {
    if (!player?.isRiichi || Number(gameState?.remainingDraws) <= 1) return [];
    const riichiWaits = player.riichiWinningTiles || [];
    return getAnkanCandidates({ ...player, isRiichi: false }, gameState).filter((candidate) => {
      const afterKanHand = cloneTiles(player.hand).filter(
        (tile) => !candidate.tiles.some((kanTile) => kanTile.id === tile.id)
      );
      const waits = getWinningTiles(afterKanHand);
      return waits.length > 0 && areSameWinningTiles(waits, riichiWaits);
    });
  }

  function canRiichiAnkan(player, gameState) {
    return getRiichiAnkanCandidates(player, gameState).length > 0;
  }

  function getAvailableActions(player, gameState) {
    if (!player || !gameState) return availableActionState();
    if (gameState.pendingAction?.source === "afterDiscard") {
      const discardTile = gameState.pendingAction.discardTile;
      return availableActionState({
        ron: canRon(player, discardTile, gameState),
        pon: canPon(player, discardTile),
        kan: canKan(player, gameState),
        skip: true,
      });
    }
    if (player.isRiichi) {
      return availableActionState({
        kan: canRiichiAnkan(player, gameState),
        skip: canRiichiAnkan(player, gameState),
      });
    }
    return availableActionState({
      tsumo: canTsumo(player, gameState),
      kan: canKan(player, gameState),
      riichi: canRiichi(player, gameState),
      skip: true,
    });
  }

  function shouldAutoTsumogiriAfterRiichi(player, gameState) {
    return Boolean(player?.isRiichi) && !canTsumo(player, gameState) && !canRiichiAnkan(player, gameState);
  }

  function drawnTileForPlayer(gameState, playerIndex) {
    if (
      gameState?.lastAction?.type === "draw" &&
      gameState.lastAction.playerIndex === playerIndex
    ) {
      return gameState.players[playerIndex]?.hand.find((tile) => tile.id === gameState.lastAction.tileId) || null;
    }
    const player = gameState?.players?.[playerIndex];
    return player?.hand?.length % 3 === 2 ? player.hand[player.hand.length - 1] : null;
  }

  function createPlayers(options = {}) {
    const dealerIndex = Number.isInteger(options.dealerIndex) ? options.dealerIndex : 0;
    const names = options.playerNames || DEFAULT_PLAYER_NAMES;
    return PLAYER_SEATS.map((seat, index) => ({
      id: seat,
      name: names[index] || DEFAULT_PLAYER_NAMES[index],
      seat,
      points: Number(options.startingPoints) || 35000,
      chips: 0,
      hand: [],
      discards: [],
      flowers: [],
      melds: [],
      isDealer: index === dealerIndex,
      isCpu: index !== 0,
      isRiichi: false,
      riichiWinningTiles: [],
    }));
  }

  function flowerAsAir(gameState, playerIndex, flowerTile) {
    const next = cloneGameState(gameState);
    if (flowerTile) {
      next.players[playerIndex].flowers.push(cloneTile(flowerTile));
      next.lastAction = {
        type: "flower",
        playerIndex,
        tileId: flowerTile.id,
      };
    }
    return syncDrawWallState(next);
  }

  function drawRinshanReplacement(gameState, playerIndex, flowers = []) {
    let next = cloneGameState(gameState);

    while (next.rinshanTiles.length > 0) {
      const drawn = drawTile(next.rinshanTiles);
      next.rinshanTiles = drawn.wall;
      if (!drawn.tile) break;

      if (drawn.tile.isFlower) {
        next = flowerAsAir(next, playerIndex, drawn.tile);
        flowers.push(drawn.tile);
        continue;
      }

      next.players[playerIndex].hand.push(drawn.tile);
      return { state: syncDrawWallState(next), tile: drawn.tile, flowers };
    }

    return { state: endHandAsRyukyoku(syncDrawWallState(next)), tile: null, flowers };
  }

  function drawNonFlowerTileWithFlowerReplacement(gameState, playerIndex = gameState.currentPlayerIndex) {
    let next = cloneGameState(gameState);
    const flowers = [];

    if (next.phase === "ryukyoku" || next.phase === "ended") {
      return { state: next, tile: null, flowers };
    }

    while (next.drawWall.length > 0) {
      const drawn = drawTile(next.drawWall);
      next.drawWall = drawn.wall;
      syncDrawWallState(next);
      if (!drawn.tile) break;

      if (drawn.tile.isFlower) {
        next = flowerAsAir(next, playerIndex, drawn.tile);
        flowers.push(drawn.tile);
        const replacement = drawRinshanReplacement(next, playerIndex, flowers);
        next = replacement.state;
        if (replacement.tile) {
          next.lastAction = {
            type: "draw",
            playerIndex,
            tileId: replacement.tile.id,
            flowers: flowers.map((tile) => tile.id),
          };
          return { state: next, tile: replacement.tile, flowers };
        }
        return { state: next, tile: null, flowers };
      }

      next.players[playerIndex].hand.push(drawn.tile);
      next.lastAction = {
        type: "draw",
        playerIndex,
        tileId: drawn.tile.id,
        flowers: flowers.map((tile) => tile.id),
      };
      return { state: syncDrawWallState(next), tile: drawn.tile, flowers };
    }

    return { state: endHandAsRyukyoku(syncDrawWallState(next)), tile: null, flowers };
  }

  function replaceInitialFlowers(gameState, playerIndex) {
    let next = cloneGameState(gameState);

    while (next.players[playerIndex].hand.some((tile) => tile.isFlower)) {
      const player = next.players[playerIndex];
      const flowerIndex = player.hand.findIndex((tile) => tile.isFlower);
      const [flowerTile] = player.hand.splice(flowerIndex, 1);
      next = flowerAsAir(next, playerIndex, flowerTile);
      next = drawRinshanReplacement(next, playerIndex).state;
      if (next.phase === "ryukyoku") break;
    }

    return syncDrawWallState(next);
  }

  function dealInitialHands(gameState) {
    let next = {
      ...cloneGameState(gameState),
      phase: "dealing",
    };

    for (let playerIndex = 0; playerIndex < next.players.length; playerIndex += 1) {
      while (next.players[playerIndex].hand.length < INITIAL_HAND_SIZE && next.dealTiles.length > 0) {
        const drawn = drawTile(next.dealTiles);
        next.dealTiles = drawn.wall;
        if (drawn.tile) {
          next.players[playerIndex].hand.push(drawn.tile);
        }
      }
    }

    for (let playerIndex = 0; playerIndex < next.players.length; playerIndex += 1) {
      next = replaceInitialFlowers(next, playerIndex);
      if (next.phase === "ryukyoku") return next;
    }

    next.currentPlayerIndex = next.dealerIndex;
    next.phase = "draw";
    next = drawNonFlowerTileWithFlowerReplacement(next, next.dealerIndex).state;
    if (next.phase !== "ryukyoku") {
      next.phase = "discard";
    }
    return syncDrawWallState(next);
  }

  function discardTile(gameState, playerIndex, tileId) {
    const next = cloneGameState(gameState);
    const player = next.players[playerIndex];
    if (!player) {
      throw new Error("Player not found.");
    }
    if (next.phase !== "discard") {
      throw new Error("Current phase does not allow discarding.");
    }
    const tileIndex = player.hand.findIndex((tile) => tile.id === tileId);
    if (tileIndex < 0) {
      throw new Error("Discard tile is not in the player's hand.");
    }
    const [discarded] = player.hand.splice(tileIndex, 1);
    const isRiichiDeclaration =
      next.riichiDeclaration?.playerIndex === playerIndex &&
      riichiDiscardOptions({ ...player, hand: [...player.hand, discarded] }, next).some((option) => option.tileId === tileId);
    const riichiWaits = isRiichiDeclaration ? getWinningTiles(player.hand) : [];
    const isTsumogiri =
      next.lastAction?.type === "draw" &&
      next.lastAction.playerIndex === playerIndex &&
      next.lastAction.tileId === tileId;
    player.discards.push({
      tile: discarded,
      isRiichiDeclaration,
      isTsumogiri,
    });
    next.phase = "draw";
    next.pendingAction = null;
    next.riichiDeclaration = null;
    next.pendingRiichi = isRiichiDeclaration
      ? {
          playerIndex,
          riichiWinningTiles: riichiWaits,
          discardTileId: tileId,
        }
      : null;
    next.lastAction = {
      type: "discard",
      playerIndex,
      tileId,
      tile: cloneTile(discarded),
      isTsumogiri,
      isRiichiDeclaration,
    };
    return syncDrawWallState(next);
  }

  function setPendingAction(gameState, pendingAction) {
    const next = cloneGameState(gameState);
    next.phase = "actionPending";
    next.pendingAction = clonePendingAction(pendingAction);
    return syncDrawWallState(next);
  }

  function clearPendingAction(gameState, nextPhase = "discard") {
    const next = cloneGameState(gameState);
    next.pendingAction = null;
    next.phase = nextPhase;
    return syncDrawWallState(next);
  }

  function startRiichiDeclaration(gameState, playerIndex) {
    const next = cloneGameState(gameState);
    const player = next.players[playerIndex];
    const riichiCheckState = { ...next, phase: "discard" };
    if (!canRiichi(player, riichiCheckState)) {
      throw new Error("Riichi is not available.");
    }
    next.pendingAction = null;
    next.riichiDeclaration = {
      playerIndex,
      options: riichiDiscardOptions(player, riichiCheckState),
    };
    next.phase = "discard";
    next.lastAction = {
      ...(next.lastAction || {}),
      type: "riichiDeclaration",
      playerIndex,
      effect: "リーチ",
    };
    next.lastEffect = "リーチ";
    return syncDrawWallState(next);
  }

  function commitRiichiIfPending(gameState) {
    const next = cloneGameState(gameState);
    const pending = next.pendingRiichi;
    if (!pending) return syncDrawWallState(next);
    const player = next.players[pending.playerIndex];
    if (player && !player.isRiichi) {
      player.isRiichi = true;
      player.riichiWinningTiles = [...(pending.riichiWinningTiles || [])];
      player.points -= 1000;
      next.kyotaku = Math.max(0, Math.floor(Number(next.kyotaku) || 0)) + 1;
      next.lastAction = {
        type: "riichi",
        playerIndex: pending.playerIndex,
        tileId: pending.discardTileId,
        effect: "リーチ",
      };
      next.lastEffect = "リーチ";
    }
    next.pendingRiichi = null;
    return syncDrawWallState(next);
  }

  function declareRiichiAndDiscard(gameState, playerIndex) {
    let next = startRiichiDeclaration(gameState, playerIndex);
    const player = next.players[playerIndex];
    const options = next.riichiDeclaration?.options || riichiDiscardOptions(player, next);
    const drawnTile = drawnTileForPlayer(next, playerIndex);
    const discardTileId =
      options.find((option) => option.tileId === drawnTile?.id)?.tileId ||
      options[0]?.tileId;
    if (!discardTileId) {
      throw new Error("Riichi discard is not available.");
    }
    next = discardTile(next, playerIndex, discardTileId);
    next.lastEffect = "リーチ";
    next.lastAction = {
      ...(next.lastAction || {}),
      effect: "リーチ",
    };
    return syncDrawWallState(next);
  }

  function discardDrawnTile(gameState, playerIndex = gameState.currentPlayerIndex) {
    const drawnTile = drawnTileForPlayer(gameState, playerIndex);
    if (!drawnTile) return gameState;
    const next = cloneGameState(gameState);
    next.phase = "discard";
    return discardTile(next, playerIndex, drawnTile.id);
  }

  function removeTilesById(tiles, removingTiles) {
    const removingIds = new Set((removingTiles || []).map((tile) => tile.id));
    return cloneTiles(tiles).filter((tile) => !removingIds.has(tile.id));
  }

  function removeLastDiscard(player, tileId) {
    const discards = cloneDiscards(player.discards);
    for (let index = discards.length - 1; index >= 0; index -= 1) {
      if (tileFromDiscard(discards[index])?.id === tileId) {
        return {
          removed: discards[index],
          discards: [...discards.slice(0, index), ...discards.slice(index + 1)],
        };
      }
    }
    return { removed: null, discards };
  }

  function callPon(gameState, playerIndex, discardTile = gameState.pendingAction?.discardTile) {
    const next = cloneGameState(gameState);
    const player = next.players[playerIndex];
    const discarder = next.players[next.lastAction?.playerIndex];
    if (!canPon(player, discardTile)) throw new Error("Pon is not available.");
    const baseId = tileBaseId(discardTile);
    const handTiles = sameBaseTiles(player.hand, baseId).slice(0, 2);
    const removedDiscard = discarder ? removeLastDiscard(discarder, discardTile.id) : { removed: null, discards: [] };
    if (discarder) discarder.discards = removedDiscard.discards;
    player.hand = removeTilesById(player.hand, handTiles);
    player.melds.push({
      id: `pon_${baseId}_${player.melds.length + 1}`,
      type: "pon",
      baseId,
      tiles: [...handTiles, cloneTile(discardTile)],
      fromPlayerIndex: next.lastAction?.playerIndex,
    });
    next.currentPlayerIndex = playerIndex;
    next.pendingAction = null;
    next.pendingRiichi = null;
    next.phase = "discard";
    next.lastAction = {
      type: "pon",
      playerIndex,
      fromPlayerIndex: next.lastAction?.playerIndex,
      tileId: discardTile.id,
      effect: "ポン",
    };
    next.lastEffect = "ポン";
    return syncDrawWallState(next);
  }

  function drawAfterKan(next, playerIndex) {
    if (next.rinshanTiles.length <= 0) return endHandAsRyukyoku(next);
    const replacement = drawRinshanReplacement(next, playerIndex);
    next = replacement.state;
    const doraTile = next.drawWall.shift() || null;
    const uraTile = next.drawWall.shift() || null;
    if (doraTile) next.doraIndicators.push(doraTile);
    if (uraTile) next.uraDoraIndicators.push(uraTile);
    next.currentPlayerIndex = playerIndex;
    if (next.phase !== "ryukyoku") next.phase = "discard";
    syncDrawWallState(next);
    if (replacement.tile) {
      next.lastAction = {
        type: "draw",
        playerIndex,
        tileId: replacement.tile.id,
        afterKan: true,
      };
    }
    return next;
  }

  function callKan(gameState, playerIndex, candidate = null) {
    let next = cloneGameState(gameState);
    const player = next.players[playerIndex];
    const candidates = candidate ? [candidate] : getKanCandidates(player, next);
    const kan = candidates[0];
    if (!kan || Number(next.remainingDraws) <= 1) throw new Error("Kan is not available.");

    if (kan.type === "ankan") {
      player.hand = removeTilesById(player.hand, kan.tiles);
      player.melds.push({
        id: `ankan_${kan.baseId}_${player.melds.length + 1}`,
        type: "ankan",
        baseId: kan.baseId,
        tiles: cloneTiles(kan.tiles),
      });
    } else if (kan.type === "minkan") {
      const discarder = next.players[next.lastAction?.playerIndex];
      if (discarder && kan.claimedTile) {
        discarder.discards = removeLastDiscard(discarder, kan.claimedTile.id).discards;
      }
      player.hand = removeTilesById(player.hand, kan.tiles);
      player.melds.push({
        id: `minkan_${kan.baseId}_${player.melds.length + 1}`,
        type: "minkan",
        baseId: kan.baseId,
        tiles: [...cloneTiles(kan.tiles), cloneTile(kan.claimedTile)],
        fromPlayerIndex: next.lastAction?.playerIndex,
      });
    } else if (kan.type === "kakan") {
      const tile = kan.tiles[0];
      player.hand = removeTilesById(player.hand, [tile]);
      const meld = player.melds.find((candidateMeld) => candidateMeld.id === kan.meldId);
      if (meld) {
        meld.type = "kakan";
        meld.tiles = [...cloneTiles(meld.tiles), cloneTile(tile)];
      }
    }

    next.pendingAction = null;
    next.pendingRiichi = null;
    next.lastAction = {
      type: "kan",
      playerIndex,
      kanType: kan.type,
      baseId: kan.baseId,
      effect: "カン",
    };
    next.lastEffect = "カン";
    next = drawAfterKan(next, playerIndex);
    return syncDrawWallState(next);
  }

  function resolveWin(gameState, { winType, winnerIndex, discarderIndex = null } = {}) {
    const next = cloneGameState(gameState);
    next.phase = "result";
    next.pendingAction = null;
    next.pendingRiichi = null;
    next.lastAction = {
      type: "win",
      winType,
      winnerIndex,
      discarderIndex,
      effect: winType === "tsumo" ? "ツモ" : "ロン",
    };
    next.lastEffect = next.lastAction.effect;
    return syncDrawWallState(next);
  }

  function handleRiichiDraw(player, gameState) {
    const playerIndex = gameState.players.indexOf(player);
    if (playerIndex < 0 || !player?.isRiichi) return gameState;
    if (canTsumo(player, gameState)) {
      return resolveWin(gameState, { winType: "tsumo", winnerIndex: playerIndex });
    }
    const candidates = getRiichiAnkanCandidates(player, gameState);
    if (candidates.length > 0) {
      return setPendingAction(gameState, {
        playerId: player.id,
        playerIndex,
        source: "afterDraw",
        availableActions: availableActionState({ kan: true, skip: true }),
        candidates,
        reason: "riichiAnkan",
      });
    }
    return afterPlayerDiscard(discardDrawnTile(gameState, playerIndex));
  }

  function afterPlayerDraw(gameState) {
    const next = cloneGameState(gameState);
    if (next.phase !== "discard") return syncDrawWallState(next);
    const player = next.players[next.currentPlayerIndex];
    if (!player) return syncDrawWallState(next);

    if (player.isRiichi) {
      return handleRiichiDraw(player, next);
    }
    if (player.isCpu) {
      if (canTsumo(player, next)) {
        return resolveWin(next, { winType: "tsumo", winnerIndex: next.currentPlayerIndex });
      }
      return syncDrawWallState(next);
    }

    const actions = getAvailableActions(player, next);
    if (hasAnyAction(actions)) {
      return setPendingAction(next, {
        playerId: player.id,
        playerIndex: next.currentPlayerIndex,
        source: "afterDraw",
        availableActions: actions,
        candidates: getKanCandidates(player, next),
      });
    }
    return syncDrawWallState(next);
  }

  function afterPlayerDiscard(gameState) {
    let next = cloneGameState(gameState);
    if (next.lastAction?.type !== "discard") return syncDrawWallState(next);
    const discarderIndex = next.lastAction.playerIndex;
    const discardTile = next.lastAction.tile;
    if (!discardTile) return syncDrawWallState(next);

    const reactionPlayers = next.players
      .map((player, playerIndex) => ({ player, playerIndex }))
      .filter(({ playerIndex }) => playerIndex !== discarderIndex);

    const riichiRon = reactionPlayers.find(({ player }) => player.isRiichi && canRon(player, discardTile, next));
    if (riichiRon) {
      return resolveWin(next, {
        winType: "ron",
        winnerIndex: riichiRon.playerIndex,
        discarderIndex,
      });
    }

    const humanReaction = reactionPlayers
      .filter(({ player }) => !player.isCpu)
      .map(({ player, playerIndex }) => {
        const trial = cloneGameState(next);
        trial.pendingAction = {
          source: "afterDiscard",
          discardTile: cloneTile(discardTile),
        };
        const actions = getAvailableActions(player, trial);
        return {
          player,
          playerIndex,
          actions,
          candidates: getKanCandidates(player, trial),
        };
      })
      .find(({ actions }) => hasAnyAction(actions));

    if (humanReaction) {
      return setPendingAction(next, {
        playerId: humanReaction.player.id,
        playerIndex: humanReaction.playerIndex,
        source: "afterDiscard",
        discardTile,
        availableActions: humanReaction.actions,
        candidates: humanReaction.candidates,
      });
    }

    const cpuRon = reactionPlayers.find(({ player }) => player.isCpu && canRon(player, discardTile, next));
    if (cpuRon) {
      return resolveWin(next, {
        winType: "ron",
        winnerIndex: cpuRon.playerIndex,
        discarderIndex,
      });
    }

    next = commitRiichiIfPending(next);
    next = nextTurn(next);
    return afterPlayerDraw(next);
  }

  function performPendingAction(gameState, action) {
    const pending = gameState?.pendingAction;
    if (!pending) return gameState;
    const playerIndex = pending.playerIndex;
    const player = gameState.players[playerIndex];

    if (action === "ron" && pending.availableActions?.canRon) {
      return resolveWin(gameState, {
        winType: "ron",
        winnerIndex: playerIndex,
        discarderIndex: gameState.lastAction?.playerIndex,
      });
    }
    if (action === "tsumo" && pending.availableActions?.canTsumo) {
      return resolveWin(gameState, { winType: "tsumo", winnerIndex: playerIndex });
    }
    if (action === "pon" && pending.availableActions?.canPon) {
      return callPon(gameState, playerIndex, pending.discardTile);
    }
    if (action === "kan" && pending.availableActions?.canKan) {
      const next = callKan(gameState, playerIndex, pending.candidates?.[0] || null);
      return afterPlayerDraw(next);
    }
    if (action === "riichi" && pending.availableActions?.canRiichi) {
      return startRiichiDeclaration(gameState, playerIndex);
    }
    if (action === "skip" && pending.availableActions?.canSkip) {
      if (pending.source === "afterDraw") {
        if (player?.isRiichi) {
          const discarded = discardDrawnTile(gameState, playerIndex);
          return afterPlayerDiscard(discarded);
        }
        return clearPendingAction(gameState, "discard");
      }
      if (pending.source === "afterDiscard") {
        let next = clearPendingAction(gameState, "draw");
        next = commitRiichiIfPending(next);
        next = nextTurn(next);
        return afterPlayerDraw(next);
      }
    }

    return gameState;
  }

  function nextTurn(gameState) {
    let next = syncDrawWallState(cloneGameState(gameState));
    if (next.phase === "actionPending" || next.phase === "ryukyoku" || next.phase === "ended" || next.phase === "result") {
      return next;
    }
    if (next.drawWall.length <= 0) {
      return endHandAsRyukyoku(next);
    }

    const playerIndex = nextPlayerIndex(next.currentPlayerIndex);
    next.currentPlayerIndex = playerIndex;
    next.phase = "draw";
    next = drawNonFlowerTileWithFlowerReplacement(next, playerIndex).state;
    if (next.phase !== "ryukyoku") {
      next.phase = "discard";
    }
    return syncDrawWallState(next);
  }

  function decideCpuDiscard(player, gameState, random = Math.random) {
    if (!player || player.hand.length === 0) {
      return null;
    }
    const index = Math.floor(random() * player.hand.length);
    return player.hand[index];
  }

  function endHandAsRyukyoku(gameState) {
    const next = syncDrawWallState(cloneGameState(gameState));
    next.phase = "ryukyoku";
    next.lastAction = {
      type: "ryukyoku",
      playerIndex: next.currentPlayerIndex,
    };
    return next;
  }

  function startNewHand(options = {}) {
    assertTiles();
    const dealerIndex = Number.isInteger(options.dealerIndex) ? options.dealerIndex : 0;
    const wallSections = splitWall(createWall(options.random || Math.random));

    const gameState = {
      dealTiles: wallSections.dealTiles,
      drawWall: wallSections.drawWall,
      wall: wallSections.drawWall.map(cloneTile),
      rinshanTiles: wallSections.rinshanTiles,
      players: createPlayers({ ...options, dealerIndex }),
      currentPlayerIndex: dealerIndex,
      dealerIndex,
      roundWind: options.roundWind || "east",
      handNumber: options.handNumber || 1,
      honba: Math.max(0, Math.floor(Number(options.honba) || 0)),
      kyotaku: Math.max(0, Math.floor(Number(options.kyotaku) || 0)),
      doraIndicators: wallSections.doraIndicators,
      uraDoraIndicators: wallSections.uraDoraIndicators,
      remainingDraws: wallSections.drawWall.length,
      phase: "dealing",
      lastAction: null,
    };

    return dealInitialHands(gameState);
  }

  return {
    PLAYER_SEATS,
    createTiles,
    createWall,
    shuffleWall,
    splitWall,
    validateWallSections,
    dealInitialHands,
    drawTile,
    drawNonFlowerTileWithFlowerReplacement,
    flowerAsAir,
    isMenzen,
    isFuriten,
    canRon,
    canTsumo,
    canPon,
    getKanCandidates,
    getAnkanCandidates,
    getRiichiAnkanCandidates,
    canKan,
    canRiichi,
    canRiichiAnkan,
    getWinningTiles,
    getAvailableActions,
    shouldAutoTsumogiriAfterRiichi,
    handleRiichiDraw,
    afterPlayerDraw,
    afterPlayerDiscard,
    performPendingAction,
    startRiichiDeclaration,
    discardTile,
    nextTurn,
    decideCpuDiscard,
    startNewHand,
    endHandAsRyukyoku,
    validateWall,
  };
});
