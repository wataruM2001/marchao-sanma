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
      wasCalledByOpponent: Boolean(discard?.wasCalledByOpponent),
    };
  }

  function cloneDiscards(discards) {
    return Array.isArray(discards) ? discards.map(cloneDiscard).filter(Boolean) : [];
  }

  function cloneMeld(meld) {
    return meld
      ? {
          ...meld,
          tiles: cloneTiles(meld.tiles),
          calledTile: cloneTile(meld.calledTile),
          addedTile: cloneTile(meld.addedTile),
        }
      : null;
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
      melds: Array.isArray(player.melds) ? player.melds.map(cloneMeld).filter(Boolean) : [],
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

  function calledFromSeatFor(playerIndex, fromPlayerIndex) {
    if (!Number.isInteger(fromPlayerIndex)) return undefined;
    if (fromPlayerIndex === (playerIndex + 2) % 3) return "kamicha";
    if (fromPlayerIndex === (playerIndex + 1) % 3) return "shimocha";
    return undefined;
  }

  function tileBaseId(tile) {
    return tile?.baseId || Tiles?.getTileDefinition?.(tile)?.baseId || "";
  }

  function tileKindId(tile) {
    return Tiles?.tileKindId ? Tiles.tileKindId(tile) : String(tile?.id || "").replace(/_\d+$/, "");
  }

  function isTanyaoTile(tile) {
    const baseId = tileBaseId(tile);
    const definition = Tiles?.getTileDefinition?.(tile) || Tiles?.getTileDefinition?.(baseId);
    const suit = definition?.suit || tile?.suit || (/^p/.test(baseId) ? "pin" : /^s/.test(baseId) ? "sou" : /^m/.test(baseId) ? "man" : "");
    const number = Number.isInteger(definition?.number) ? definition.number : tile?.number;
    return (suit === "pin" || suit === "sou") && Number(number) >= 2 && Number(number) <= 8;
  }

  function tileSuit(tileOrBaseId) {
    const baseId = typeof tileOrBaseId === "string" ? tileOrBaseId : tileBaseId(tileOrBaseId);
    const definition = Tiles?.getTileDefinition?.(tileOrBaseId) || Tiles?.getTileDefinition?.(baseId);
    if (definition?.suit) return definition.suit;
    if (/^m\d$/.test(baseId)) return "man";
    if (/^p\d$/.test(baseId)) return "pin";
    if (/^s\d$/.test(baseId)) return "sou";
    if (["east", "south", "west", "north", "white", "green", "red"].includes(baseId)) return "honor";
    return "";
  }

  function tileNumber(tileOrBaseId) {
    const baseId = typeof tileOrBaseId === "string" ? tileOrBaseId : tileBaseId(tileOrBaseId);
    const definition = Tiles?.getTileDefinition?.(tileOrBaseId) || Tiles?.getTileDefinition?.(baseId);
    if (Number.isInteger(definition?.number)) return definition.number;
    const match = String(baseId).match(/^[mps](\d)$/);
    return match ? Number(match[1]) : null;
  }

  function windBaseIdForWind(wind) {
    if (wind === "east") return "east";
    if (wind === "south") return "south";
    if (wind === "west") return "west";
    return "";
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

  function meldTiles(player) {
    return cloneTiles((player?.melds || []).flatMap((meld) => meld.tiles || []));
  }

  function seatWindForIndex(gameState, playerIndex) {
    const winds = ["east", "south", "west"];
    return winds[(playerIndex - gameState.dealerIndex + 3) % 3] || "west";
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

  function getWinningTiles(playerOrHand, fixedMelds = []) {
    const evaluator = HandEval();
    if (!evaluator?.getWinningCandidates) return [];
    const hand = Array.isArray(playerOrHand) ? playerOrHand : playerOrHand?.hand || [];
    const melds = Array.isArray(playerOrHand) ? fixedMelds : playerOrHand?.melds || [];
    const normalHand = cloneTiles(hand).filter((tile) => !tile.isFlower);
    if (normalHand.length % 3 !== 1) return [];
    return baseTileCandidates()
      .filter((candidateTile) =>
        evaluator.getWinningCandidates([...normalHand, candidateTile], candidateTile, { fixedMelds: melds }).length > 0
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

  function isFuriten(player, gameState, winningTiles = getWinningTiles(player)) {
    const waits = new Set(winningTiles);
    return (player?.discards || []).some((discard) => waits.has(tileBaseId(tileFromDiscard(discard))));
  }

  function baseSortValue(baseId) {
    const suitOrder = { pin: 0, sou: 1, honor: 2, man: 3 };
    const honorOrder = { east: 1, south: 2, west: 3, north: 4, white: 5, green: 6, red: 7 };
    const suit = tileSuit(baseId);
    const number = suit === "honor" ? honorOrder[baseId] || 99 : tileNumber(baseId) || 99;
    return (suitOrder[suit] ?? 9) * 100 + number;
  }

  function countByBaseId(tiles = []) {
    return cloneTiles(tiles)
      .filter((tile) => !tile.isFlower)
      .reduce((counts, tile) => {
        const baseId = tileBaseId(tile);
        counts.set(baseId, (counts.get(baseId) || 0) + 1);
        return counts;
      }, new Map());
  }

  function sortedCountBaseIds(counts) {
    return [...counts.keys()]
      .filter((baseId) => (counts.get(baseId) || 0) > 0)
      .sort((left, right) => baseSortValue(left) - baseSortValue(right));
  }

  function countKey(counts, meldCount, taatsuCount, hasPair) {
    return `${meldCount}|${taatsuCount}|${hasPair ? 1 : 0}|${sortedCountBaseIds(counts)
      .map((baseId) => `${baseId}:${counts.get(baseId)}`)
      .join(",")}`;
  }

  function addCount(counts, baseId, amount) {
    counts.set(baseId, (counts.get(baseId) || 0) + amount);
  }

  function canMakeSequenceFrom(baseId, counts) {
    const suit = tileSuit(baseId);
    const number = tileNumber(baseId);
    if (!["pin", "sou"].includes(suit) || !Number.isInteger(number) || number > 7) return null;
    const prefix = suit === "pin" ? "p" : "s";
    const second = `${prefix}${number + 1}`;
    const third = `${prefix}${number + 2}`;
    return (counts.get(second) || 0) > 0 && (counts.get(third) || 0) > 0 ? [baseId, second, third] : null;
  }

  function taatsuCandidatesFrom(baseId, counts) {
    const suit = tileSuit(baseId);
    const number = tileNumber(baseId);
    if (!["pin", "sou"].includes(suit) || !Number.isInteger(number)) return [];
    const prefix = suit === "pin" ? "p" : "s";
    return [1, 2]
      .map((offset) => `${prefix}${number + offset}`)
      .filter((nextBaseId) => (counts.get(nextBaseId) || 0) > 0);
  }

  function estimateStandardShanten(tiles = [], meldCount = 0) {
    const counts = countByBaseId(tiles);
    const memo = new Map();

    function walk(currentCounts, currentMelds, currentTaatsu, hasPair) {
      const first = sortedCountBaseIds(currentCounts)[0];
      if (!first) {
        const usableTaatsu = Math.min(currentTaatsu, Math.max(0, 4 - currentMelds));
        return 8 - currentMelds * 2 - usableTaatsu - (hasPair ? 1 : 0);
      }

      const key = countKey(currentCounts, currentMelds, currentTaatsu, hasPair);
      if (memo.has(key)) return memo.get(key);

      let best = 8;
      const count = currentCounts.get(first) || 0;

      if (count >= 3) {
        addCount(currentCounts, first, -3);
        best = Math.min(best, walk(currentCounts, currentMelds + 1, currentTaatsu, hasPair));
        addCount(currentCounts, first, 3);
      }

      const sequence = canMakeSequenceFrom(first, currentCounts);
      if (sequence) {
        sequence.forEach((baseId) => addCount(currentCounts, baseId, -1));
        best = Math.min(best, walk(currentCounts, currentMelds + 1, currentTaatsu, hasPair));
        sequence.forEach((baseId) => addCount(currentCounts, baseId, 1));
      }

      if (count >= 2) {
        addCount(currentCounts, first, -2);
        if (!hasPair) best = Math.min(best, walk(currentCounts, currentMelds, currentTaatsu, true));
        best = Math.min(best, walk(currentCounts, currentMelds, currentTaatsu + 1, hasPair));
        addCount(currentCounts, first, 2);
      }

      taatsuCandidatesFrom(first, currentCounts).forEach((second) => {
        addCount(currentCounts, first, -1);
        addCount(currentCounts, second, -1);
        best = Math.min(best, walk(currentCounts, currentMelds, currentTaatsu + 1, hasPair));
        addCount(currentCounts, second, 1);
        addCount(currentCounts, first, 1);
      });

      addCount(currentCounts, first, -1);
      best = Math.min(best, walk(currentCounts, currentMelds, currentTaatsu, hasPair));
      addCount(currentCounts, first, 1);

      memo.set(key, best);
      return best;
    }

    return Math.max(-1, walk(counts, meldCount, 0, false));
  }

  function estimateChiitoitsuShanten(tiles = []) {
    const counts = countByBaseId(tiles);
    let pairUnits = 0;
    let usableUnits = 0;
    counts.forEach((count) => {
      pairUnits += Math.floor(count / 2);
      usableUnits += Math.floor(count / 2) + (count % 2 > 0 ? 1 : 0);
    });
    return 6 - pairUnits + Math.max(0, 7 - usableUnits);
  }

  function estimateKokushiShanten(tiles = []) {
    const terminalHonorIds = new Set(["m1", "m9", "p1", "p9", "s1", "s9", "east", "south", "west", "north", "white", "green", "red"]);
    const counts = countByBaseId(tiles);
    let unique = 0;
    let hasPair = false;
    terminalHonorIds.forEach((baseId) => {
      const count = counts.get(baseId) || 0;
      if (count > 0) unique += 1;
      if (count >= 2) hasPair = true;
    });
    return 13 - unique - (hasPair ? 1 : 0);
  }

  function estimateShanten(player) {
    const meldCount = (player?.melds || []).length;
    const hand = cloneTiles(player?.hand || []);
    const values = [estimateStandardShanten(hand, meldCount)];
    if (meldCount === 0) {
      values.push(estimateChiitoitsuShanten(hand));
      values.push(estimateKokushiShanten(hand));
    }
    return Math.min(...values);
  }

  function isYakuhaiBaseId(baseId, gameState, playerIndex) {
    if (["white", "green", "red", "north"].includes(baseId)) return true;
    const roundWindBaseId = windBaseIdForWind(gameState?.roundWind);
    const seatWindBaseId = windBaseIdForWind(seatWindForIndex(gameState, playerIndex));
    return Boolean(baseId && (baseId === roundWindBaseId || baseId === seatWindBaseId));
  }

  function isOtateWindBaseId(baseId, gameState, playerIndex) {
    return ["east", "south", "west"].includes(baseId) && !isYakuhaiBaseId(baseId, gameState, playerIndex);
  }

  function isIsolatedTile(tile, hand = []) {
    const baseId = tileBaseId(tile);
    const counts = countByBaseId(hand);
    if ((counts.get(baseId) || 0) >= 2) return false;
    const suit = tileSuit(tile);
    if (suit === "honor" || suit === "man") return true;
    if (!["pin", "sou"].includes(suit)) return false;
    const number = tileNumber(tile);
    if (!Number.isInteger(number)) return false;
    const prefix = suit === "pin" ? "p" : "s";
    return [number - 1, number + 1]
      .filter((neighbor) => neighbor >= 1 && neighbor <= 9)
      .every((neighbor) => (counts.get(`${prefix}${neighbor}`) || 0) === 0);
  }

  function isolatedTileDiscardPriority(tile, hand, gameState, playerIndex) {
    if (!isIsolatedTile(tile, hand)) return 999;
    const baseId = tileBaseId(tile);
    const suit = tileSuit(tile);
    const number = tileNumber(tile);
    if (isOtateWindBaseId(baseId, gameState, playerIndex) || suit === "man") return 1;
    if (isYakuhaiBaseId(baseId, gameState, playerIndex)) return 2;
    if (number === 1 || number === 9) return 3;
    if (number === 2 || number === 8) return 4;
    if (Number(number) >= 3 && Number(number) <= 7) return 5;
    return 999;
  }

  function removeTileById(tiles = [], tileId = "") {
    const next = cloneTiles(tiles);
    const index = next.findIndex((tile) => tile.id === tileId);
    if (index >= 0) next.splice(index, 1);
    return next;
  }

  function countWinningTilesInDrawWall(winningTileBaseIds = [], gameState) {
    const waits = new Set(winningTileBaseIds);
    return cloneTiles(gameState?.drawWall || gameState?.wall || []).filter((tile) => waits.has(tileBaseId(tile))).length;
  }

  function drawableAndRinshanTiles(gameState) {
    return [
      ...cloneTiles(gameState?.drawWall || gameState?.wall || []),
      ...cloneTiles(gameState?.rinshanTiles || []),
    ];
  }

  function countWinningTilesInDrawableAndRinshanTiles(playerOrWinningTileBaseIds, gameState) {
    const winningTileBaseIds = Array.isArray(playerOrWinningTileBaseIds)
      ? playerOrWinningTileBaseIds
      : getWinningTiles(playerOrWinningTileBaseIds);
    const waits = new Set(winningTileBaseIds);
    return drawableAndRinshanTiles(gameState).filter((tile) => waits.has(tileBaseId(tile))).length;
  }

  function countWinningTilesInDrawableTiles(playerOrWinningTileBaseIds, gameState) {
    return countWinningTilesInDrawableAndRinshanTiles(playerOrWinningTileBaseIds, gameState);
  }

  function riichiOptionRemainingWinningTileCount(option, gameState) {
    return countWinningTilesInDrawableAndRinshanTiles(option?.waits || [], gameState);
  }

  function cpuRiichiOptions(player, gameState) {
    if (!player?.isCpu || !canRiichi(player, gameState)) return [];
    return riichiDiscardOptions(player, gameState).filter(
      (option) => riichiOptionRemainingWinningTileCount(option, gameState) >= 2
    );
  }

  function shouldCpuRiichi(player, gameState) {
    return cpuRiichiOptions(player, gameState).length > 0;
  }

  function discardCandidatesForPlayer(player, gameState) {
    if (!player || player.hand.length === 0) return [];
    const playerIndex = gameState?.players?.indexOf(player) ?? -1;
    const riichiOptions =
      gameState?.riichiDeclaration?.playerIndex === playerIndex
        ? gameState.riichiDeclaration.options || []
        : null;
    if (!riichiOptions) return cloneTiles(player.hand);
    const eligibleRiichiOptions = riichiOptions.filter(
      (option) => riichiOptionRemainingWinningTileCount(option, gameState) >= 2
    );
    const legalTileIds = new Set(
      (eligibleRiichiOptions.length > 0 ? eligibleRiichiOptions : riichiOptions).map((option) => option.tileId)
    );
    return cloneTiles(player.hand).filter((tile) => legalTileIds.has(tile.id));
  }

  function playerAfterDiscard(player, discardTile) {
    return {
      ...player,
      hand: removeTileById(player?.hand || [], discardTile?.id),
    };
  }

  function edgeDiscardPriority(tile) {
    const suit = tileSuit(tile);
    const number = tileNumber(tile);
    if (suit === "honor") return 1;
    if (number === 1 || number === 9) return 2;
    if (number === 2 || number === 8) return 3;
    if (number === 3 || number === 7) return 4;
    if (number === 4 || number === 6) return 5;
    if (number === 5) return 6;
    return 99;
  }

  function countAcceptanceTilesAfterDiscard(player, discardTile, gameState) {
    const afterDiscard = playerAfterDiscard(player, discardTile);
    const shantenAfterDiscard = estimateShanten(afterDiscard);
    return drawableAndRinshanTiles(gameState).filter((drawTileCandidate) => {
      const afterDraw = {
        ...afterDiscard,
        hand: [...cloneTiles(afterDiscard.hand), cloneTile(drawTileCandidate)],
      };
      return estimateShanten(afterDraw) <= shantenAfterDiscard - 1;
    }).length;
  }

  function chooseLegacyCpuDiscard(candidates, player, gameState, random = Math.random) {
    const playerIndex = gameState?.players?.indexOf(player) ?? -1;
    const ranked = cloneTiles(candidates).map((tile) => {
      const trialPlayer = playerAfterDiscard(player, tile);
      return {
        tile,
        shanten: estimateShanten(trialPlayer),
        isolatedPriority: isolatedTileDiscardPriority(tile, player.hand, gameState, playerIndex),
        tieBreaker: random(),
      };
    });

    ranked.sort((left, right) => {
      if (left.shanten !== right.shanten) return left.shanten - right.shanten;
      if (left.isolatedPriority !== right.isolatedPriority) return left.isolatedPriority - right.isolatedPriority;
      return left.tieBreaker - right.tieBreaker;
    });
    return ranked[0]?.tile || candidates[0] || null;
  }

  function chooseMaxAcceptanceDiscard(candidates, player, gameState, random = Math.random) {
    const ranked = cloneTiles(candidates).map((tile) => {
      const trialPlayer = playerAfterDiscard(player, tile);
      return {
        tile,
        shanten: estimateShanten(trialPlayer),
        acceptance: countAcceptanceTilesAfterDiscard(player, tile, gameState),
        edgePriority: edgeDiscardPriority(tile),
        tieBreaker: random(),
      };
    });
    if (ranked.length === 0) return null;
    const minShanten = Math.min(...ranked.map((entry) => entry.shanten));
    const shantenFiltered = ranked.filter((entry) => entry.shanten === minShanten);
    const maxAcceptance = Math.max(...shantenFiltered.map((entry) => entry.acceptance));
    return shantenFiltered
      .filter((entry) => entry.acceptance === maxAcceptance)
      .sort((left, right) => {
        if (left.edgePriority !== right.edgePriority) return left.edgePriority - right.edgePriority;
        return left.tieBreaker - right.tieBreaker;
      })[0]?.tile || null;
  }

  function chooseStandardCpuDiscard(player, gameState, random = Math.random) {
    const candidates = discardCandidatesForPlayer(player, gameState);
    if (candidates.length === 0) return null;
    if (estimateShanten(player) <= 1) {
      return chooseMaxAcceptanceDiscard(candidates, player, gameState, random);
    }
    return chooseLegacyCpuDiscard(candidates, player, gameState, random);
  }

  function discardTilesOf(player) {
    return cloneTiles((player?.discards || []).map(tileFromDiscard));
  }

  function isMiddlePin(tile) {
    return tileSuit(tile) === "pin" && Number(tileNumber(tile)) >= 2 && Number(tileNumber(tile)) <= 8;
  }

  function isMiddleSou(tile) {
    return tileSuit(tile) === "sou" && Number(tileNumber(tile)) >= 2 && Number(tileNumber(tile)) <= 8;
  }

  function isDangerousPlayer(player, gameState) {
    if (!player) return false;
    if (player.isRiichi) return true;
    if (isMenzen(player)) return false;
    const discards = discardTilesOf(player);
    return discards.some(isMiddlePin) && discards.some(isMiddleSou);
  }

  function opponentEntriesFor(player, gameState) {
    const playerIndex = gameState?.players?.indexOf(player) ?? -1;
    return (gameState?.players || [])
      .map((opponent, index) => ({ player: opponent, index }))
      .filter((entry) => entry.player && entry.index !== playerIndex);
  }

  function dangerousOpponentEntriesFor(player, gameState) {
    return opponentEntriesFor(player, gameState).filter((entry) => isDangerousPlayer(entry.player, gameState));
  }

  function shouldUseSpecialCpuMode(player, gameState) {
    const remainingDraws = Number(gameState?.remainingDraws) || 0;
    if (remainingDraws < 30) return true;
    if (remainingDraws <= 45 && dangerousOpponentEntriesFor(player, gameState).length > 0) return true;
    return false;
  }

  function maxCompletedMeldsFromCounts(counts) {
    const memo = new Map();

    function walk(currentCounts) {
      const first = sortedCountBaseIds(currentCounts)[0];
      if (!first) return 0;
      const key = sortedCountBaseIds(currentCounts)
        .map((baseId) => `${baseId}:${currentCounts.get(baseId)}`)
        .join(",");
      if (memo.has(key)) return memo.get(key);

      let best = 0;
      const count = currentCounts.get(first) || 0;
      if (count >= 3) {
        addCount(currentCounts, first, -3);
        best = Math.max(best, 1 + walk(currentCounts));
        addCount(currentCounts, first, 3);
      }
      const sequence = canMakeSequenceFrom(first, currentCounts);
      if (sequence) {
        sequence.forEach((baseId) => addCount(currentCounts, baseId, -1));
        best = Math.max(best, 1 + walk(currentCounts));
        sequence.forEach((baseId) => addCount(currentCounts, baseId, 1));
      }
      addCount(currentCounts, first, -1);
      best = Math.max(best, walk(currentCounts));
      addCount(currentCounts, first, 1);
      memo.set(key, best);
      return best;
    }

    return walk(new Map(counts));
  }

  function countCompletedMeldsInHand(tiles = []) {
    return maxCompletedMeldsFromCounts(countByBaseId(tiles));
  }

  function countCompletedMeldsForCpu(player) {
    return (player?.melds || []).length + countCompletedMeldsInHand(player?.hand || []);
  }

  function isRonDangerTile(tile, player, gameState) {
    return opponentEntriesFor(player, gameState).some((entry) => canRon(entry.player, tile, gameState));
  }

  function removeRonDangerTiles(candidates, player, gameState) {
    return cloneTiles(candidates).filter((tile) => !isRonDangerTile(tile, player, gameState));
  }

  function dangerousGenbutsuCount(tile, player, gameState) {
    const baseId = tileBaseId(tile);
    return dangerousOpponentEntriesFor(player, gameState).filter((entry) =>
      discardTilesOf(entry.player).some((discard) => tileBaseId(discard) === baseId)
    ).length;
  }

  function opponentDiscardedSameHonor(tile, player, gameState) {
    if (tileSuit(tile) !== "honor") return false;
    const baseId = tileBaseId(tile);
    return opponentEntriesFor(player, gameState).some((entry) =>
      discardTilesOf(entry.player).some((discard) => tileBaseId(discard) === baseId)
    );
  }

  function visibleBaseCount(baseId, player, gameState) {
    const visibleTiles = [
      ...cloneTiles(player?.hand || []),
      ...cloneTiles(player?.flowers || []),
      ...meldTiles(player),
      ...cloneTiles(gameState?.doraIndicators || []),
      ...cloneTiles(gameState?.uraDoraIndicators || []),
      ...(gameState?.players || []).flatMap((entry) => [
        ...discardTilesOf(entry),
        ...cloneTiles(entry.flowers || []),
        ...meldTiles(entry),
      ]),
    ];
    return visibleTiles.filter((tile) => tileBaseId(tile) === baseId).length;
  }

  function manyVisibleHonor(tile, player, gameState) {
    return tileSuit(tile) === "honor" && visibleBaseCount(tileBaseId(tile), player, gameState) >= 2;
  }

  function noChanceTile(tile, player, gameState) {
    const suit = tileSuit(tile);
    const number = tileNumber(tile);
    if (!["pin", "sou"].includes(suit) || !Number.isInteger(number)) return false;
    const prefix = suit === "pin" ? "p" : "s";
    const starts = [number - 2, number - 1, number].filter((start) => start >= 1 && start <= 7);
    if (starts.length === 0) return false;
    return starts.every((start) => {
      const sequenceIds = [start, start + 1, start + 2].map((value) => `${prefix}${value}`);
      return sequenceIds
        .filter((baseId) => baseId !== tileBaseId(tile))
        .some((baseId) => visibleBaseCount(baseId, player, gameState) >= 4);
    });
  }

  function isTerminalTile(tile) {
    const suit = tileSuit(tile);
    const number = tileNumber(tile);
    return ["man", "pin", "sou"].includes(suit) && (number === 1 || number === 9);
  }

  function defensivePriority(tile, player, gameState) {
    const genbutsuCount = dangerousGenbutsuCount(tile, player, gameState);
    if (genbutsuCount > 0) return { priority: 1, genbutsuCount };
    if (opponentDiscardedSameHonor(tile, player, gameState) || manyVisibleHonor(tile, player, gameState) || noChanceTile(tile, player, gameState)) {
      return { priority: 2, genbutsuCount: 0 };
    }
    if (isTerminalTile(tile)) return { priority: 3, genbutsuCount: 0 };
    return { priority: 4, genbutsuCount: 0 };
  }

  function chooseByDefensivePriority(candidates, player, gameState, random = Math.random) {
    const ranked = cloneTiles(candidates).map((tile) => {
      const defense = defensivePriority(tile, player, gameState);
      return {
        tile,
        priority: defense.priority,
        genbutsuCount: defense.genbutsuCount,
        acceptance: countAcceptanceTilesAfterDiscard(player, tile, gameState),
        edgePriority: edgeDiscardPriority(tile),
        tieBreaker: random(),
      };
    });
    if (ranked.length === 0) return null;
    const minPriority = Math.min(...ranked.map((entry) => entry.priority));
    const filtered = ranked.filter((entry) => entry.priority === minPriority);
    if (minPriority === 4) {
      return chooseMaxAcceptanceDiscard(filtered.map((entry) => entry.tile), player, gameState, random);
    }
    return filtered.sort((left, right) => {
      if (left.genbutsuCount !== right.genbutsuCount) return right.genbutsuCount - left.genbutsuCount;
      if (left.edgePriority !== right.edgePriority) return left.edgePriority - right.edgePriority;
      if (left.acceptance !== right.acceptance) return right.acceptance - left.acceptance;
      return left.tieBreaker - right.tieBreaker;
    })[0]?.tile || null;
  }

  function chooseDefensiveDiscard(player, gameState, random = Math.random) {
    const allCandidates = discardCandidatesForPlayer(player, gameState);
    if (allCandidates.length === 0) return null;
    const safeCandidates = removeRonDangerTiles(allCandidates, player, gameState);
    const candidates = safeCandidates.length > 0 ? safeCandidates : allCandidates;
    return chooseByDefensivePriority(candidates, player, gameState, random);
  }

  function chooseSpecialCpuDiscard(player, gameState, random = Math.random) {
    const completedMeldCount = countCompletedMeldsForCpu(player);
    if (completedMeldCount <= 1) {
      return chooseDefensiveDiscard(player, gameState, random);
    }
    return chooseMaxAcceptanceDiscard(discardCandidatesForPlayer(player, gameState), player, gameState, random);
  }

  function chooseCpuDiscard(player, gameState, random = Math.random) {
    if (!player || player.hand.length === 0) return null;
    if (shouldUseSpecialCpuMode(player, gameState)) {
      return chooseSpecialCpuDiscard(player, gameState, random);
    }
    return chooseStandardCpuDiscard(player, gameState, random);
  }

  function canRon(player, discardTile, gameState) {
    if (!player || !discardTile || player.seat === gameState.players[gameState.currentPlayerIndex]?.seat) {
      return false;
    }
    if (isFuriten(player, gameState)) return false;
    const evaluator = HandEval();
    if (!evaluator?.evaluateWinningHand) return false;
    const playerIndex = gameState.players.indexOf(player);
    const result = evaluator.evaluateWinningHand([...cloneTiles(player.hand), cloneTile(discardTile)], discardTile, {
      allWinTiles: [...cloneTiles(player.hand), cloneTile(discardTile), ...cloneTiles(player.flowers), ...meldTiles(player)],
      fixedMelds: player.melds || [],
      isTsumo: false,
      isMenzen: isMenzen(player),
      isRiichi: Boolean(player.isRiichi),
      roundWind: gameState.roundWind,
      seatWind: seatWindForIndex(gameState, playerIndex),
      doraIndicators: gameState.doraIndicators,
      uraDoraIndicators: gameState.uraDoraIndicators,
    });
    return Boolean(result.best);
  }

  function canTsumo(player, gameState) {
    if (!player || gameState.players[gameState.currentPlayerIndex] !== player) return false;
    const evaluator = HandEval();
    if (!evaluator?.evaluateWinningHand) return false;
    const playerIndex = gameState.currentPlayerIndex;
    const drawnTile = drawnTileForPlayer(gameState, gameState.currentPlayerIndex);
    const result = evaluator.evaluateWinningHand(cloneTiles(player.hand), drawnTile, {
      allWinTiles: [...cloneTiles(player.hand), ...cloneTiles(player.flowers), ...meldTiles(player)],
      fixedMelds: player.melds || [],
      isTsumo: true,
      isMenzen: isMenzen(player),
      isRiichi: Boolean(player.isRiichi),
      roundWind: gameState.roundWind,
      seatWind: seatWindForIndex(gameState, playerIndex),
      doraIndicators: gameState.doraIndicators,
      uraDoraIndicators: gameState.uraDoraIndicators,
    });
    return Boolean(result.best);
  }

  function canPon(player, discardTile) {
    if (!player || player.isCpu || player.isRiichi || !discardTile) return false;
    return sameBaseTiles(player.hand, tileBaseId(discardTile)).length >= 2;
  }

  function getAnkanCandidates(player, gameState) {
    if (!player || player.isCpu || Number(gameState?.remainingDraws) <= 1) return [];
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
    if (!player || player.isCpu || player.isRiichi || Number(gameState?.remainingDraws) <= 1 || !discardTile) return [];
    const baseId = tileBaseId(discardTile);
    const tiles = sameBaseTiles(player.hand, baseId).slice(0, 3);
    return tiles.length >= 3
      ? [{ type: "minkan", baseId, tiles, claimedTile: cloneTile(discardTile) }]
      : [];
  }

  function getKakanCandidates(player, gameState) {
    if (!player || player.isCpu || player.isRiichi || Number(gameState?.remainingDraws) <= 1) return [];
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
    if (!player || player.isCpu || Number(gameState?.remainingDraws) <= 1) return [];
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
      const waits = getWinningTiles({ ...player, hand: trialHand });
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
    if (!player?.isRiichi || player.isCpu || Number(gameState?.remainingDraws) <= 1) return [];
    const riichiWaits = player.riichiWinningTiles || [];
    return getAnkanCandidates({ ...player, isRiichi: false }, gameState).filter((candidate) => {
      const afterKanHand = cloneTiles(player.hand).filter(
        (tile) => !candidate.tiles.some((kanTile) => kanTile.id === tile.id)
      );
      const afterKanMelds = [
        ...(player.melds || []),
        { type: "ankan", baseId: candidate.baseId, tiles: candidate.tiles },
      ];
      const waits = getWinningTiles({ ...player, hand: afterKanHand, melds: afterKanMelds });
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

  function canDiscardDuringActionPending(gameState) {
    const pending = gameState?.pendingAction;
    const actions = pending?.availableActions || {};
    const player = gameState?.players?.[pending?.playerIndex];
    return (
      gameState?.phase === "actionPending" &&
      pending?.source === "afterDraw" &&
      pending.playerIndex === gameState.currentPlayerIndex &&
      player?.seat === "self" &&
      !actions.canRon &&
      !actions.canTsumo &&
      !actions.canPon &&
      Boolean(actions.canRiichi || actions.canKan)
    );
  }

  function skipOptionalSelfActionsBeforeDiscard(gameState) {
    if (!canDiscardDuringActionPending(gameState)) return gameState;
    const next = cloneGameState(gameState);
    next.pendingAction = null;
    next.phase = "discard";
    return syncDrawWallState(next);
  }

  function isNagashiYakuman(player, gameState) {
    const discards = player?.discards || [];
    if (!player || player.isRiichi || (player.melds || []).length > 0) return false;
    if ((Number(player.calledDiscardCount) || 0) > 0) return false;
    if (discards.some((discard) => discard?.wasCalledByOpponent)) return false;
    return discards.length > 0 && discards.every((discard) => !isTanyaoTile(tileFromDiscard(discard)));
  }

  function nagashiYakumanWinnerIndex(gameState) {
    return (gameState?.players || []).findIndex((player) => isNagashiYakuman(player, gameState));
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
      calledDiscardCount: 0,
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
    if (
      next.riichiDeclaration?.playerIndex === playerIndex &&
      !next.riichiDeclaration.options?.some((option) => option.tileId === tileId)
    ) {
      throw new Error("Riichi declaration discard is not tenpai or is furiten.");
    }
    const [discarded] = player.hand.splice(tileIndex, 1);
    const isRiichiDeclaration =
      next.riichiDeclaration?.playerIndex === playerIndex &&
      riichiDiscardOptions({ ...player, hand: [...player.hand, discarded] }, next).some((option) => option.tileId === tileId);
    const riichiWaits = isRiichiDeclaration ? getWinningTiles(player) : [];
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

  function applyCalledDiscardRecord(discarder, removedDiscard) {
    if (!discarder || !removedDiscard?.removed) return;
    discarder.calledDiscardCount = (Number(discarder.calledDiscardCount) || 0) + 1;
  }

  function callPon(gameState, playerIndex, discardTile = gameState.pendingAction?.discardTile) {
    const next = cloneGameState(gameState);
    const player = next.players[playerIndex];
    const discarder = next.players[next.lastAction?.playerIndex];
    if (!canPon(player, discardTile)) throw new Error("Pon is not available.");
    const baseId = tileBaseId(discardTile);
    const handTiles = sameBaseTiles(player.hand, baseId).slice(0, 2);
    const calledFromIndex = next.lastAction?.playerIndex;
    const calledTile = cloneTile(discardTile);
    const calledFromSeat = calledFromSeatFor(playerIndex, calledFromIndex);
    const removedDiscard = discarder ? removeLastDiscard(discarder, discardTile.id) : { removed: null, discards: [] };
    if (discarder) {
      discarder.discards = removedDiscard.discards;
      applyCalledDiscardRecord(discarder, removedDiscard);
    }
    player.hand = removeTilesById(player.hand, handTiles);
    player.melds.push({
      id: `pon_${baseId}_${player.melds.length + 1}`,
      type: "pon",
      baseId,
      tiles: calledFromSeat === "kamicha" ? [calledTile, ...handTiles] : [...handTiles, calledTile],
      calledTile,
      calledFrom: discarder?.id,
      calledFromSeat,
      fromPlayerIndex: calledFromIndex,
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
      const calledFromIndex = next.lastAction?.playerIndex;
      const calledTile = cloneTile(kan.claimedTile);
      const calledFromSeat = calledFromSeatFor(playerIndex, calledFromIndex);
      if (discarder && kan.claimedTile) {
        const removedDiscard = removeLastDiscard(discarder, kan.claimedTile.id);
        discarder.discards = removedDiscard.discards;
        applyCalledDiscardRecord(discarder, removedDiscard);
      }
      player.hand = removeTilesById(player.hand, kan.tiles);
      player.melds.push({
        id: `minkan_${kan.baseId}_${player.melds.length + 1}`,
        type: "minkan",
        baseId: kan.baseId,
        tiles: calledFromSeat === "kamicha" ? [calledTile, ...cloneTiles(kan.tiles)] : [...cloneTiles(kan.tiles), calledTile],
        calledTile,
        calledFrom: discarder?.id,
        calledFromSeat,
        fromPlayerIndex: calledFromIndex,
      });
    } else if (kan.type === "kakan") {
      const tile = kan.tiles[0];
      player.hand = removeTilesById(player.hand, [tile]);
      const meld = player.melds.find((candidateMeld) => candidateMeld.id === kan.meldId);
      if (meld) {
        meld.type = "kakan";
        meld.tiles = [...cloneTiles(meld.tiles), cloneTile(tile)];
        meld.addedTile = cloneTile(tile);
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

  function evaluateWin(gameState, { winType, winnerIndex, winningTile } = {}) {
    const evaluator = HandEval();
    const winner = gameState.players[winnerIndex];
    if (!evaluator?.evaluateWinningHand || !winner || !winningTile) return null;
    const handTiles =
      winType === "ron"
        ? [...cloneTiles(winner.hand), cloneTile(winningTile)]
        : cloneTiles(winner.hand);
    const allWinTiles =
      winType === "ron"
        ? [...cloneTiles(winner.hand), cloneTile(winningTile), ...cloneTiles(winner.flowers), ...meldTiles(winner)]
        : [...cloneTiles(winner.hand), ...cloneTiles(winner.flowers), ...meldTiles(winner)];
    return evaluator.evaluateWinningHand(handTiles, winningTile, {
      allWinTiles,
      fixedMelds: winner.melds || [],
      isTsumo: winType === "tsumo",
      isMenzen: isMenzen(winner),
      isRiichi: Boolean(winner.isRiichi),
      isDealer: winnerIndex === gameState.dealerIndex,
      roundWind: gameState.roundWind,
      seatWind: seatWindForIndex(gameState, winnerIndex),
      doraIndicators: gameState.doraIndicators,
      uraDoraIndicators: gameState.uraDoraIndicators,
    });
  }

  function nagashiYakumanEvaluation(gameState, winnerIndex) {
    const evaluator = HandEval();
    const yaku = [{ id: "nagashi_yakuman", name: "流し役満", han: 13, yakuman: true, isYakuman: true, yakumanCount: 1 }];
    const points = evaluator?.calculateMarchaoSanmaPoints?.({
      han: 13,
      fu: 30,
      isDealer: winnerIndex === gameState.dealerIndex,
      isTsumo: true,
      yakumanCount: 1,
    }) || null;
    const chips = evaluator?.calculateChipPoints?.([], {
      isTsumo: true,
      winType: "tsumo",
      yakuResults: yaku,
      skipRegularChips: true,
    }) || { totalPoints: 2000, totalChips: 4, yakumanChips: 4 };
    return {
      candidates: [],
      evaluations: [],
      best: {
        valid: true,
        candidate: { type: "nagashi_yakuman", melds: [], pair: null },
        features: {},
        yaku,
        dora: { indicatorHan: 0, uraHan: 0, bonusHan: 0, totalHan: 0, doraBaseIds: [], uraDoraBaseIds: [] },
        chips,
        han: 13,
        fu: 30,
        points,
      },
    };
  }

  function applyWinSettlement(gameState, { winType, winnerIndex, discarderIndex, evaluation } = {}) {
    const pointDeltas = [0, 0, 0];
    const chipDeltas = [0, 0, 0];
    const best = evaluation?.best;
    const honbaPoints = Math.max(0, Math.floor(Number(gameState.honba) || 0)) * 1000;
    const kyotakuBefore = Math.max(0, Math.floor(Number(gameState.kyotaku) || 0));
    const kyotakuPoints = kyotakuBefore * 1000;

    if (best?.points) {
      if (winType === "tsumo") {
        const childPayment = best.points.payments.find((payment) => payment.payer === "child")?.amount || 0;
        const parentPayment = best.points.payments.find((payment) => payment.payer === "parent")?.amount || childPayment;
        gameState.players.forEach((player, playerIndex) => {
          if (playerIndex === winnerIndex) return;
          const baseAmount = playerIndex === gameState.dealerIndex ? parentPayment : childPayment;
          const amount = baseAmount + honbaPoints;
          pointDeltas[playerIndex] -= amount;
          pointDeltas[winnerIndex] += amount;
        });
      } else {
        const baseAmount = best.points.payments[0]?.amount || 0;
        const amount = baseAmount + honbaPoints;
        if (Number.isInteger(discarderIndex)) {
          pointDeltas[discarderIndex] -= amount;
          pointDeltas[winnerIndex] += amount;
        }
      }
    }

    if (kyotakuPoints > 0) {
      pointDeltas[winnerIndex] += kyotakuPoints;
      gameState.kyotaku = 0;
    }

    const chipAmount = Math.max(0, Number(best?.chips?.totalPoints) || 0);
    if (chipAmount > 0) {
      if (winType === "tsumo") {
        gameState.players.forEach((player, playerIndex) => {
          if (playerIndex === winnerIndex) return;
          chipDeltas[playerIndex] -= chipAmount;
          chipDeltas[winnerIndex] += chipAmount;
        });
      } else if (Number.isInteger(discarderIndex)) {
        chipDeltas[discarderIndex] -= chipAmount;
        chipDeltas[winnerIndex] += chipAmount;
      }
    }

    pointDeltas.forEach((delta, index) => {
      gameState.players[index].points += delta;
    });
    chipDeltas.forEach((delta, index) => {
      gameState.players[index].chips += delta;
    });

    return {
      pointDeltas,
      chipDeltas,
      kyotakuBefore,
      kyotakuAfter: gameState.kyotaku,
    };
  }

  function resolveWin(gameState, { winType, winnerIndex, discarderIndex = null } = {}) {
    const next = cloneGameState(gameState);
    const winningTile =
      winType === "tsumo"
        ? drawnTileForPlayer(next, winnerIndex)
        : cloneTile(next.lastAction?.tile);
    const evaluation = evaluateWin(next, { winType, winnerIndex, winningTile });
    const settlement = applyWinSettlement(next, { winType, winnerIndex, discarderIndex, evaluation });
    next.phase = "result";
    next.pendingAction = null;
    next.pendingRiichi = null;
    next.lastAction = {
      type: "win",
      winType,
      winnerIndex,
      discarderIndex,
      winningTile: cloneTile(winningTile),
      evaluation,
      pointDeltas: settlement.pointDeltas,
      chipDeltas: settlement.chipDeltas,
      kyotakuBefore: settlement.kyotakuBefore,
      kyotakuAfter: settlement.kyotakuAfter,
      effect: winType === "tsumo" ? "ツモ" : "ロン",
    };
    next.lastEffect = next.lastAction.effect;
    return syncDrawWallState(next);
  }

  function resolveNagashiYakuman(gameState, winnerIndex) {
    const next = cloneGameState(gameState);
    const evaluation = nagashiYakumanEvaluation(next, winnerIndex);
    const settlement = applyWinSettlement(next, { winType: "tsumo", winnerIndex, evaluation });
    next.phase = "result";
    next.pendingAction = null;
    next.pendingRiichi = null;
    next.lastAction = {
      type: "win",
      winType: "tsumo",
      winnerIndex,
      discarderIndex: null,
      winningTile: null,
      nagashiYakuman: true,
      evaluation,
      pointDeltas: settlement.pointDeltas,
      chipDeltas: settlement.chipDeltas,
      kyotakuBefore: settlement.kyotakuBefore,
      kyotakuAfter: settlement.kyotakuAfter,
      effect: "流し役満",
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
      if (shouldCpuRiichi(player, next)) {
        return startRiichiDeclaration(next, next.currentPlayerIndex);
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
    return chooseCpuDiscard(player, gameState, random);
  }

  function endHandAsRyukyoku(gameState) {
    const next = syncDrawWallState(cloneGameState(gameState));
    const nagashiWinnerIndex = nagashiYakumanWinnerIndex(next);
    if (nagashiWinnerIndex >= 0) {
      return resolveNagashiYakuman(next, nagashiWinnerIndex);
    }
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
    const initialDealerIndex = Number.isInteger(options.initialDealerIndex)
      ? options.initialDealerIndex
      : dealerIndex;
    const wallSections = splitWall(createWall(options.random || Math.random));

    const gameState = {
      dealTiles: wallSections.dealTiles,
      drawWall: wallSections.drawWall,
      wall: wallSections.drawWall.map(cloneTile),
      rinshanTiles: wallSections.rinshanTiles,
      players: createPlayers({ ...options, dealerIndex }),
      currentPlayerIndex: dealerIndex,
      dealerIndex,
      initialDealerIndex,
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
    isNagashiYakuman,
    canDiscardDuringActionPending,
    skipOptionalSelfActionsBeforeDiscard,
    getWinningTiles,
    countWinningTilesInDrawableAndRinshanTiles,
    countWinningTilesInDrawableTiles,
    chooseCpuDiscard,
    shouldUseSpecialCpuMode,
    isDangerousPlayer,
    countCompletedMeldsForCpu,
    chooseStandardCpuDiscard,
    chooseSpecialCpuDiscard,
    chooseDefensiveDiscard,
    removeRonDangerTiles,
    chooseMaxAcceptanceDiscard,
    countAcceptanceTilesAfterDiscard,
    shouldCpuRiichi,
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
