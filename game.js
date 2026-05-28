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
  const DEFAULT_PLAYER_NAMES = ["自分", "下家", "上家"];
  const ACTIONS = ["ron", "tsumo", "pon", "kan", "riichi", "skip"];
  const DRAGON_BASE_IDS = ["white", "green", "red"];

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
      isRiichiMarkerReplacement: Boolean(discard?.isRiichiMarkerReplacement),
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
      ponDiscardRestriction: gameState.ponDiscardRestriction ? { ...gameState.ponDiscardRestriction } : null,
      forcedCpuDiscard: gameState.forcedCpuDiscard ? { ...gameState.forcedCpuDiscard } : null,
      paoState: gameState.paoState ? { ...gameState.paoState } : null,
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

  function isDragonBaseId(baseId) {
    return DRAGON_BASE_IDS.includes(baseId);
  }

  function dragonMeldBaseIds(melds = []) {
    return [
      ...new Set(
        (melds || [])
          .filter((meld) => ["pon", "minkan", "ankan", "kakan"].includes(meld?.type))
          .map((meld) => meld.baseId || tileBaseId(meld.tiles?.[0]))
          .filter(isDragonBaseId)
      ),
    ];
  }

  function checkDaisangenPaoAfterCall(caller, calledTile, discarderId, gameState) {
    const calledBaseId = tileBaseId(calledTile);
    if (!caller || !gameState || !isDragonBaseId(calledBaseId) || !discarderId) return null;
    if (gameState.paoState?.yakumanType === "daisangen" && gameState.paoState.targetPlayerId === caller.id) {
      return gameState.paoState;
    }
    const targetPlayerIndex = gameState.players.findIndex((player) => player.id === caller.id);
    const responsiblePlayerIndex = gameState.players.findIndex((player) => player.id === discarderId);
    if (targetPlayerIndex < 0 || responsiblePlayerIndex < 0 || targetPlayerIndex === responsiblePlayerIndex) return null;
    if (dragonMeldBaseIds(caller.melds).length !== DRAGON_BASE_IDS.length) return null;
    gameState.paoState = {
      yakumanType: "daisangen",
      targetPlayerId: caller.id,
      targetPlayerIndex,
      responsiblePlayerId: discarderId,
      responsiblePlayerIndex,
    };
    return gameState.paoState;
  }

  function clearIppatsuChances(gameState) {
    (gameState?.players || []).forEach((player) => {
      player.isIppatsuChance = false;
    });
    return gameState;
  }

  function clearRiichiMarkerReplacementFlags(gameState) {
    (gameState?.players || []).forEach((player) => {
      player.needsRiichiMarkerOnNextDiscard = false;
    });
    return gameState;
  }

  function breakDoubleRiichiRound(gameState) {
    (gameState?.players || []).forEach((player) => {
      player.isDoubleRiichiEligible = false;
    });
    return gameState;
  }

  function isHaiteiContext(gameState) {
    return Number(gameState?.remainingDraws) === 0 && gameState?.lastDrawSource === "normal";
  }

  function isHouteiContext(gameState) {
    return Number(gameState?.remainingDraws) === 0 && gameState?.lastAction?.type === "discard";
  }

  function isChankanContext(gameState, explicit = false) {
    return Boolean(
      explicit ||
      gameState?.pendingAction?.source === "chankan" ||
      gameState?.lastAction?.type === "chankan" ||
      gameState?.lastAction?.isChankan
    );
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

  function playerIndexForAcceptance(player, gameState) {
    const players = gameState?.players || [];
    const directIndex = players.indexOf(player);
    if (directIndex >= 0) return directIndex;
    return players.findIndex((entry) => entry?.id && player?.id && entry.id === player.id);
  }

  function tilesBaseKey(tiles = []) {
    return cloneTiles(tiles).map(tileBaseId).sort().join(",");
  }

  function playerShantenCacheKey(player) {
    const meldCount = (player?.melds || []).length;
    return `${meldCount}|${tilesBaseKey(player?.hand || [])}`;
  }

  function cpuTimingDebugEnabled() {
    try {
      return root.localStorage?.getItem("marchaoCpuTimingDebug") === "1";
    } catch {
      return false;
    }
  }

  function buildAcceptanceSourceTilesForPlayer(player, gameState) {
    const playerIndex = playerIndexForAcceptance(player, gameState);
    const otherPlayersHandTiles = (gameState?.players || []).flatMap((entry, index) => {
      if (index === playerIndex) return [];
      if (playerIndex < 0 && entry?.id && player?.id && entry.id === player.id) return [];
      return cloneTiles(entry?.hand || []);
    });
    return [
      ...drawableAndRinshanTiles(gameState),
      ...otherPlayersHandTiles,
      ...cloneTiles(gameState?.uraDoraIndicators || []),
    ];
  }

  function buildVisibleBaseCounts(player, gameState) {
    const counts = new Map();
    const addTiles = (tiles = []) => {
      cloneTiles(tiles).forEach((tile) => {
        const baseId = tileBaseId(tile);
        if (baseId) counts.set(baseId, (counts.get(baseId) || 0) + 1);
      });
    };
    addTiles(player?.hand || []);
    addTiles(player?.flowers || []);
    addTiles(meldTiles(player));
    addTiles(gameState?.doraIndicators || []);
    addTiles(gameState?.uraDoraIndicators || []);
    (gameState?.players || []).forEach((entry) => {
      addTiles(discardTilesOf(entry));
      addTiles(entry?.flowers || []);
      addTiles(meldTiles(entry));
    });
    return counts;
  }

  function createCpuCalculationContext(player, gameState) {
    const acceptanceSourceTiles = buildAcceptanceSourceTilesForPlayer(player, gameState);
    return {
      playerId: player?.id || "",
      shantenCache: new Map(),
      acceptanceCache: new Map(),
      completedMeldCache: new Map(),
      doraPriorityCache: new Map(),
      discardBaseIdSetCache: new Map(),
      visibleBaseCounts: null,
      acceptanceSourceTiles,
      acceptanceSourceKey: tilesBaseKey(acceptanceSourceTiles),
    };
  }

  function estimateShantenCached(player, context = null) {
    if (!context) return estimateShanten(player);
    const key = playerShantenCacheKey(player);
    if (context.shantenCache.has(key)) return context.shantenCache.get(key);
    const value = estimateShanten(player);
    context.shantenCache.set(key, value);
    return value;
  }

  function acceptanceSourceTilesForPlayer(player, gameState, context = null) {
    if (context?.playerId && player?.id && context.playerId === player.id) {
      return context.acceptanceSourceTiles || [];
    }
    return buildAcceptanceSourceTilesForPlayer(player, gameState);
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

  function acceptanceTilesForPlayerState(player, gameState, context = null) {
    const handKey = playerShantenCacheKey(player);
    const canUseContextSource = Boolean(context?.playerId && player?.id && context.playerId === player.id);
    const sourceKey = canUseContextSource
      ? context.acceptanceSourceKey
      : tilesBaseKey(acceptanceSourceTilesForPlayer(player, gameState));
    const cacheKey = `${handKey}|${sourceKey}`;
    if (context?.acceptanceCache?.has(cacheKey)) return context.acceptanceCache.get(cacheKey);
    const shanten = estimateShantenCached(player, context);
    const sourceTiles = acceptanceSourceTilesForPlayer(player, gameState, context);
    const result = sourceTiles.filter((drawTileCandidate) => {
      const afterDraw = {
        ...player,
        hand: [...cloneTiles(player?.hand || []), cloneTile(drawTileCandidate)],
      };
      return estimateShantenCached(afterDraw, context) === shanten - 1;
    });
    if (context?.acceptanceCache) context.acceptanceCache.set(cacheKey, result);
    return result;
  }

  function isMiddlePinSou456(tile) {
    const suit = tileSuit(tile);
    const number = tileNumber(tile);
    return (suit === "pin" || suit === "sou") && number >= 4 && number <= 6;
  }

  function isTerminalOrHonor(tile) {
    const suit = tileSuit(tile);
    const number = tileNumber(tile);
    return suit === "honor" || (["man", "pin", "sou"].includes(suit) && (number === 1 || number === 9));
  }

  function hasYakuWithoutRiichi(player, gameState, acceptanceTiles = acceptanceTilesForPlayerState(player, gameState)) {
    const evaluator = HandEval();
    if (!evaluator?.evaluateWinningHand) return false;
    const playerIndex = playerIndexForAcceptance(player, gameState);
    return acceptanceTiles.some((winningTile) => {
      const tile = cloneTile(winningTile);
      const result = evaluator.evaluateWinningHand([...cloneTiles(player?.hand || []), tile], tile, {
        allWinTiles: [
          ...cloneTiles(player?.hand || []),
          tile,
          ...cloneTiles(player?.flowers || []),
          ...meldTiles(player),
        ],
        fixedMelds: player?.melds || [],
        isTsumo: false,
        isMenzen: isMenzen(player),
        isRiichi: false,
        isDoubleRiichi: false,
        isIppatsu: false,
        isChankan: false,
        isHaitei: false,
        isHoutei: false,
        roundWind: gameState?.roundWind,
        seatWind: seatWindForIndex(gameState, playerIndex),
        doraIndicators: [],
        uraDoraIndicators: [],
      });
      return Boolean(result?.best);
    });
  }

  function allShapeTiles(player) {
    return [
      ...cloneTiles(player?.hand || []),
      ...meldTiles(player),
    ];
  }

  function allShapeTilesAreTanyao(player) {
    const tiles = allShapeTiles(player);
    return tiles.length > 0 && tiles.every(isTanyaoTile);
  }

  function allShapeTilesAreSuitOrHonor(player, suit) {
    const tiles = allShapeTiles(player);
    return tiles.length > 0 && tiles.every((tile) => {
      const tileSuitName = tileSuit(tile);
      return tileSuitName === suit || tileSuitName === "honor";
    });
  }

  function doraHanInCpuShape(player, gameState) {
    const evaluator = HandEval();
    const dora = evaluator?.calculateDoraHan?.(
      [...allShapeTiles(player), ...cloneTiles(player?.flowers || [])],
      gameState?.doraIndicators || [],
      [],
      { includeUraDora: false }
    );
    return Number(dora?.totalHan) || 0;
  }

  function hasYakuhaiCompletedMeld(player, gameState) {
    const playerIndex = playerIndexForAcceptance(player, gameState);
    return (player?.melds || []).some((meld) =>
      ["pon", "minkan", "ankan", "kakan"].includes(meld?.type) &&
      isYakuhaiBaseId(meld.baseId || tileBaseId(meld.tiles?.[0]), gameState, playerIndex)
    );
  }

  function hasPairAfterRemovingCompletedMelds(tiles = []) {
    function walk(counts) {
      let triedRemoval = false;
      const baseIds = sortedCountBaseIds(counts);
      for (const baseId of baseIds) {
        if ((counts.get(baseId) || 0) >= 3) {
          triedRemoval = true;
          addCount(counts, baseId, -3);
          if (walk(counts)) {
            addCount(counts, baseId, 3);
            return true;
          }
          addCount(counts, baseId, 3);
        }
        const sequence = canMakeSequenceFrom(baseId, counts);
        if (sequence) {
          triedRemoval = true;
          sequence.forEach((sequenceBaseId) => addCount(counts, sequenceBaseId, -1));
          if (walk(counts)) {
            sequence.forEach((sequenceBaseId) => addCount(counts, sequenceBaseId, 1));
            return true;
          }
          sequence.forEach((sequenceBaseId) => addCount(counts, sequenceBaseId, 1));
        }
      }
      return !triedRemoval && [...counts.values()].some((count) => count >= 2);
    }
    return walk(countByBaseId(tiles));
  }

  function everyAcceptanceTileHasYakuWithoutRiichi(player, gameState, acceptanceTiles) {
    const evaluator = HandEval();
    if (!evaluator?.evaluateWinningHand || !acceptanceTiles?.length) return false;
    const playerIndex = playerIndexForAcceptance(player, gameState);
    return acceptanceTiles.every((winningTile) => {
      const tile = cloneTile(winningTile);
      const result = evaluator.evaluateWinningHand([...cloneTiles(player?.hand || []), tile], tile, {
        allWinTiles: [
          ...cloneTiles(player?.hand || []),
          tile,
          ...cloneTiles(player?.flowers || []),
          ...meldTiles(player),
        ],
        fixedMelds: player?.melds || [],
        isTsumo: false,
        isMenzen: isMenzen(player),
        isRiichi: false,
        isDoubleRiichi: false,
        isIppatsu: false,
        isChankan: false,
        isHaitei: false,
        isHoutei: false,
        roundWind: gameState?.roundWind,
        seatWind: seatWindForIndex(gameState, playerIndex),
        doraIndicators: [],
        uraDoraIndicators: [],
      });
      return Boolean(result?.best);
    });
  }

  function cpuRiichiOptionMatchesNewCriteria(player, gameState, option, context = null) {
    const discardTile = (player?.hand || []).find((tile) => tile.id === option?.tileId);
    if (!discardTile) return false;
    const afterDiscard = playerAfterDiscard(player, discardTile);
    const acceptanceTiles = acceptanceTilesForPlayerState(afterDiscard, gameState, context);
    const totalAcceptanceCount = acceptanceTiles.length;
    const nonMiddleAcceptanceCount = acceptanceTiles.filter((tile) => !isMiddlePinSou456(tile)).length;
    const terminalHonorAcceptanceCount = acceptanceTiles.filter(isTerminalOrHonor).length;
    const completedMeldCount = countCompletedMeldsForCpu(afterDiscard, context);
    const hasYaku = hasYakuWithoutRiichi(afterDiscard, gameState, acceptanceTiles);

    if (
      completedMeldCount === 3 &&
      totalAcceptanceCount === 3 &&
      nonMiddleAcceptanceCount >= 1 &&
      !hasYaku
    ) {
      return true;
    }

    if (
      completedMeldCount === 3 &&
      totalAcceptanceCount >= 4 &&
      nonMiddleAcceptanceCount >= 1
    ) {
      return true;
    }

    return completedMeldCount !== 3 && terminalHonorAcceptanceCount >= 2;
  }

  function cpuRiichiOptions(player, gameState, context = null) {
    if (!player?.isCpu || !canRiichi(player, gameState)) return [];
    const activeContext = context || createCpuCalculationContext(player, gameState);
    return riichiDiscardOptions(player, gameState).filter((option) =>
      cpuRiichiOptionMatchesNewCriteria(player, gameState, option, activeContext)
    );
  }

  function shouldCpuRiichi(player, gameState) {
    return cpuRiichiOptions(player, gameState).length > 0;
  }

  function discardCandidatesForPlayer(player, gameState) {
    if (!player || player.hand.length === 0) return [];
    const playerIndex = gameState?.players?.indexOf(player) ?? -1;
    const ponRestriction = gameState?.ponDiscardRestriction;
    const baseCandidates = cloneTiles(player.hand).filter((tile) => {
      if (tile.isFlower && player.hasHadFirstDrawTurnThisHand === false) return false;
      if (
        ponRestriction &&
        ponRestriction.playerId === player.id &&
        tileBaseId(tile) === ponRestriction.baseTileId
      ) {
        return false;
      }
      return true;
    });
    const riichiOptions =
      gameState?.riichiDeclaration?.playerIndex === playerIndex
        ? gameState.riichiDeclaration.options || []
        : null;
    if (!riichiOptions) return baseCandidates;
    if (gameState?.riichiDeclaration?.isCpu) {
      const legalTileIds = new Set(riichiOptions.map((option) => option.tileId));
      return baseCandidates.filter((tile) => legalTileIds.has(tile.id));
    }
    const eligibleRiichiOptions = riichiOptions.filter(
      (option) => riichiOptionRemainingWinningTileCount(option, gameState) >= 2
    );
    const legalTileIds = new Set(
      (eligibleRiichiOptions.length > 0 ? eligibleRiichiOptions : riichiOptions).map((option) => option.tileId)
    );
    return baseCandidates.filter((tile) => legalTileIds.has(tile.id));
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

  function doraDiscardPriority(tile, gameState, context = null) {
    if (!tile) return 0;
    if (tile.isFlower || Number(tile.bonusHan) > 0) return 1;
    const cacheKey = `${tileBaseId(tile)}:${tile.color || ""}:${Number(tile.bonusHan) || 0}`;
    if (context?.doraPriorityCache?.has(cacheKey)) return context.doraPriorityCache.get(cacheKey);
    const evaluator = HandEval();
    const dora = evaluator?.calculateDoraHan?.([tile], gameState?.doraIndicators || [], gameState?.uraDoraIndicators || [], {
      includeUraDora: true,
    });
    const value = Number(dora?.totalHan) > 0 ? 1 : 0;
    if (context?.doraPriorityCache) context.doraPriorityCache.set(cacheKey, value);
    return value;
  }

  function countAcceptanceTilesAfterDiscard(player, discardTile, gameState, context = null) {
    const afterDiscard = playerAfterDiscard(player, discardTile);
    return acceptanceTilesForPlayerState(afterDiscard, gameState, context).length;
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

  function chooseMaxAcceptanceDiscard(candidates, player, gameState, random = Math.random, context = null) {
    const ranked = cloneTiles(candidates).map((tile) => {
      const trialPlayer = playerAfterDiscard(player, tile);
      return {
        tile,
        shanten: estimateShantenCached(trialPlayer, context),
        acceptance: countAcceptanceTilesAfterDiscard(player, tile, gameState, context),
        edgePriority: edgeDiscardPriority(tile),
        doraPriority: doraDiscardPriority(tile, gameState, context),
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
        if (left.doraPriority !== right.doraPriority) return left.doraPriority - right.doraPriority;
        return left.tieBreaker - right.tieBreaker;
      })[0]?.tile || null;
  }

  function chooseStandardCpuDiscard(player, gameState, random = Math.random, context = null) {
    const candidates = discardCandidatesForPlayer(player, gameState);
    if (candidates.length === 0) return null;
    return chooseMaxAcceptanceDiscard(candidates, player, gameState, random, context);
  }

  function discardTilesOf(player) {
    return cloneTiles((player?.discards || []).map(tileFromDiscard));
  }

  function discardBaseIdSetOf(player, context = null) {
    const key = player?.id || player?.seat || "";
    if (context?.discardBaseIdSetCache && key && context.discardBaseIdSetCache.has(key)) {
      return context.discardBaseIdSetCache.get(key);
    }
    const set = new Set(discardTilesOf(player).map(tileBaseId).filter(Boolean));
    if (context?.discardBaseIdSetCache && key) context.discardBaseIdSetCache.set(key, set);
    return set;
  }

  function baseIdIsMiddlePin(baseId) {
    return /^p[2-8]$/.test(baseId);
  }

  function baseIdIsMiddleSou(baseId) {
    return /^s[2-8]$/.test(baseId);
  }

  function isMiddlePin(tile) {
    return tileSuit(tile) === "pin" && Number(tileNumber(tile)) >= 2 && Number(tileNumber(tile)) <= 8;
  }

  function isMiddleSou(tile) {
    return tileSuit(tile) === "sou" && Number(tileNumber(tile)) >= 2 && Number(tileNumber(tile)) <= 8;
  }

  function isDangerousPlayer(player, gameState, context = null) {
    if (!player) return false;
    if (player.isRiichi) return true;
    if (Number(gameState?.remainingDraws) > 45) return false;
    if (isMenzen(player)) return false;
    const discardBaseIds = discardBaseIdSetOf(player, context);
    return [...discardBaseIds].some(baseIdIsMiddlePin) && [...discardBaseIds].some(baseIdIsMiddleSou);
  }

  function opponentEntriesFor(player, gameState) {
    const playerIndex = gameState?.players?.indexOf(player) ?? -1;
    return (gameState?.players || [])
      .map((opponent, index) => ({ player: opponent, index }))
      .filter((entry) => entry.player && entry.index !== playerIndex);
  }

  function relativeOpponentEntryFor(player, gameState, offset) {
    const playerIndex = gameState?.players?.indexOf(player) ?? -1;
    if (playerIndex < 0) return null;
    const index = (playerIndex + offset + 3) % 3;
    const opponent = gameState?.players?.[index] || null;
    return opponent ? { player: opponent, index } : null;
  }

  function shimochaEntryFor(player, gameState) {
    return relativeOpponentEntryFor(player, gameState, 1);
  }

  function kamichaEntryFor(player, gameState) {
    return relativeOpponentEntryFor(player, gameState, 2);
  }

  function dealerEntryFor(gameState) {
    const index = Number.isInteger(gameState?.dealerIndex) ? gameState.dealerIndex : -1;
    const player = index >= 0 ? gameState?.players?.[index] : null;
    return player ? { player, index } : null;
  }

  function dangerousOpponentEntriesFor(player, gameState, context = null) {
    return opponentEntriesFor(player, gameState).filter((entry) => isDangerousPlayer(entry.player, gameState, context));
  }

  function shouldUseSpecialCpuMode(player, gameState, context = null) {
    const completedMeldCount = countCompletedMeldsForCpu(player, context);
    const shanten = estimateShantenCached(player, context);
    const isFarFromReady = completedMeldCount <= 1 || shanten >= 2;
    return isFarFromReady && dangerousOpponentEntriesFor(player, gameState, context).length > 0;
  }

  function shouldUseUltraSpecialCpuMode(player, gameState, context = null) {
    const playerIndex = gameState?.players?.indexOf(player) ?? -1;
    if (playerIndex < 0 || playerIndex === gameState?.dealerIndex) return false;
    const completedMeldCount = countCompletedMeldsForCpu(player, context);
    const shanten = estimateShantenCached(player, context);
    if (completedMeldCount < 2 || shanten > 1) return false;
    const kamicha = kamichaEntryFor(player, gameState)?.player;
    const shimocha = shimochaEntryFor(player, gameState)?.player;
    return Boolean(
      kamicha &&
      shimocha &&
      isDangerousPlayer(kamicha, gameState, context) &&
      isDangerousPlayer(shimocha, gameState, context)
    );
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

  function countCompletedMeldsForCpu(player, context = null) {
    const key = playerShantenCacheKey(player);
    if (context?.completedMeldCache?.has(key)) return context.completedMeldCache.get(key);
    const value = (player?.melds || []).length + countCompletedMeldsInHand(player?.hand || []);
    if (context?.completedMeldCache) context.completedMeldCache.set(key, value);
    return value;
  }

  function isRonDangerTile(tile, player, gameState) {
    return opponentEntriesFor(player, gameState).some((entry) => canRon(entry.player, tile, gameState));
  }

  function removeRonDangerTiles(candidates, player, gameState) {
    return cloneTiles(candidates).filter((tile) => !isRonDangerTile(tile, player, gameState));
  }

  function dangerousGenbutsuCount(tile, player, gameState, context = null) {
    const baseId = tileBaseId(tile);
    return dangerousOpponentEntriesFor(player, gameState, context).filter((entry) =>
      discardBaseIdSetOf(entry.player, context).has(baseId)
    ).length;
  }

  function hasSameBaseTileInRiver(tile, player, context = null) {
    const baseId = tileBaseId(tile);
    return discardBaseIdSetOf(player, context).has(baseId);
  }

  function opponentDiscardedSameHonor(tile, player, gameState, context = null) {
    if (tileSuit(tile) !== "honor") return false;
    const baseId = tileBaseId(tile);
    return opponentEntriesFor(player, gameState).some((entry) =>
      discardBaseIdSetOf(entry.player, context).has(baseId)
    );
  }

  function visibleBaseCount(baseId, player, gameState, context = null) {
    if (context?.playerId && player?.id && context.playerId === player.id) {
      if (!context.visibleBaseCounts) context.visibleBaseCounts = buildVisibleBaseCounts(player, gameState);
      return context.visibleBaseCounts.get(baseId) || 0;
    }
    return buildVisibleBaseCounts(player, gameState).get(baseId) || 0;
  }

  function manyVisibleHonor(tile, player, gameState, context = null) {
    return tileSuit(tile) === "honor" && visibleBaseCount(tileBaseId(tile), player, gameState, context) >= 2;
  }

  function noChanceTile(tile, player, gameState, context = null) {
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
        .some((baseId) => visibleBaseCount(baseId, player, gameState, context) >= 4);
    });
  }

  function isTerminalTile(tile) {
    const suit = tileSuit(tile);
    const number = tileNumber(tile);
    return ["man", "pin", "sou"].includes(suit) && (number === 1 || number === 9);
  }

  function isTwoOrEightTile(tile) {
    const suit = tileSuit(tile);
    const number = tileNumber(tile);
    return (suit === "pin" || suit === "sou") && (number === 2 || number === 8);
  }

  function defensivePriority(tile, player, gameState, context = null) {
    const genbutsuCount = dangerousGenbutsuCount(tile, player, gameState, context);
    if (genbutsuCount > 0) return { priority: 1, genbutsuCount };
    if (tileSuit(tile) === "honor" || noChanceTile(tile, player, gameState, context)) {
      return { priority: 2, genbutsuCount: 0 };
    }
    if (isTerminalTile(tile)) return { priority: 3, genbutsuCount: 0 };
    if (isTwoOrEightTile(tile)) return { priority: 4, genbutsuCount: 0 };
    return { priority: 5, genbutsuCount: 0 };
  }

  function chooseByDefensivePriority(candidates, player, gameState, random = Math.random, context = null) {
    const ranked = cloneTiles(candidates).map((tile) => {
      const defense = defensivePriority(tile, player, gameState, context);
      return {
        tile,
        priority: defense.priority,
        genbutsuCount: defense.genbutsuCount,
        acceptance: countAcceptanceTilesAfterDiscard(player, tile, gameState, context),
        edgePriority: edgeDiscardPriority(tile),
        doraPriority: doraDiscardPriority(tile, gameState, context),
        tieBreaker: random(),
      };
    });
    if (ranked.length === 0) return null;
    const minPriority = Math.min(...ranked.map((entry) => entry.priority));
    const filtered = ranked.filter((entry) => entry.priority === minPriority);
    if (minPriority === 5) {
      return chooseMaxAcceptanceDiscard(filtered.map((entry) => entry.tile), player, gameState, random, context);
    }
    return filtered.sort((left, right) => {
      if (left.genbutsuCount !== right.genbutsuCount) return right.genbutsuCount - left.genbutsuCount;
      if (left.edgePriority !== right.edgePriority) return left.edgePriority - right.edgePriority;
      if (left.doraPriority !== right.doraPriority) return left.doraPriority - right.doraPriority;
      if (left.acceptance !== right.acceptance) return right.acceptance - left.acceptance;
      return left.tieBreaker - right.tieBreaker;
    })[0]?.tile || null;
  }

  function chooseUltraSpecialTieBreaker(candidates, player, gameState, random = Math.random, context = null) {
    const ranked = cloneTiles(candidates).map((tile) => ({
      tile,
      acceptance: countAcceptanceTilesAfterDiscard(player, tile, gameState, context),
      edgePriority: edgeDiscardPriority(tile),
      doraPriority: doraDiscardPriority(tile, gameState, context),
      tieBreaker: random(),
    }));
    return ranked.sort((left, right) => {
      if (left.edgePriority !== right.edgePriority) return left.edgePriority - right.edgePriority;
      if (left.doraPriority !== right.doraPriority) return left.doraPriority - right.doraPriority;
      if (left.acceptance !== right.acceptance) return right.acceptance - left.acceptance;
      return left.tieBreaker - right.tieBreaker;
    })[0]?.tile || null;
  }

  function chooseTenpaiKeepingMaxAcceptanceDiscard(candidates, player, gameState, random = Math.random, context = null) {
    const tenpaiCandidates = cloneTiles(candidates).filter((tile) =>
      estimateShantenCached(playerAfterDiscard(player, tile), context) === 0
    );
    return chooseMaxAcceptanceDiscard(
      tenpaiCandidates.length > 0 ? tenpaiCandidates : candidates,
      player,
      gameState,
      random,
      context
    );
  }

  function chooseDefensiveDiscard(player, gameState, random = Math.random, context = null) {
    const allCandidates = discardCandidatesForPlayer(player, gameState);
    if (allCandidates.length === 0) return null;
    const safeCandidates = removeRonDangerTiles(allCandidates, player, gameState);
    const candidates = safeCandidates.length > 0 ? safeCandidates : allCandidates;
    return chooseByDefensivePriority(candidates, player, gameState, random, context);
  }

  function chooseSpecialCpuDiscard(player, gameState, random = Math.random, context = null) {
    return chooseDefensiveDiscard(player, gameState, random, context);
  }

  function chooseUltraSpecialCpuDiscard(player, gameState, random = Math.random, context = null) {
    const candidates = discardCandidatesForPlayer(player, gameState);
    if (candidates.length === 0) return null;
    const shanten = estimateShantenCached(player, context);
    const acceptanceCount = acceptanceTilesForPlayerState(player, gameState, context).length;
    if (shanten === 0 && acceptanceCount >= 4) {
      return chooseTenpaiKeepingMaxAcceptanceDiscard(candidates, player, gameState, random, context);
    }

    const kamicha = kamichaEntryFor(player, gameState);
    const shimocha = shimochaEntryFor(player, gameState);
    const opponents = [kamicha, shimocha].filter(Boolean);
    const bothRiverTiles = candidates.filter((tile) =>
      opponents.length === 2 &&
      opponents.every((entry) => hasSameBaseTileInRiver(tile, entry.player, context))
    );
    if (bothRiverTiles.length > 0) {
      return chooseUltraSpecialTieBreaker(bothRiverTiles, player, gameState, random, context);
    }

    const honorOrNoChanceTiles = candidates.filter((tile) =>
      (
        tileSuit(tile) === "honor" &&
        opponents.some((entry) => hasSameBaseTileInRiver(tile, entry.player, context))
      ) ||
      noChanceTile(tile, player, gameState, context)
    );
    if (honorOrNoChanceTiles.length > 0) {
      return chooseUltraSpecialTieBreaker(honorOrNoChanceTiles, player, gameState, random, context);
    }

    const dealer = dealerEntryFor(gameState);
    const dealerRiverTiles = dealer && dealer.player !== player
      ? candidates.filter((tile) => hasSameBaseTileInRiver(tile, dealer.player, context))
      : [];
    if (dealerRiverTiles.length > 0) {
      return chooseUltraSpecialTieBreaker(dealerRiverTiles, player, gameState, random, context);
    }

    const childOpponent = opponents.find((entry) => entry.index !== dealer?.index);
    const childRiverTiles = childOpponent
      ? candidates.filter((tile) => hasSameBaseTileInRiver(tile, childOpponent.player, context))
      : [];
    if (childRiverTiles.length > 0) {
      return chooseUltraSpecialTieBreaker(childRiverTiles, player, gameState, random, context);
    }

    return chooseStandardCpuDiscard(player, gameState, random, context);
  }

  function buildCpuPonVirtualPlayer(player, gameState, playerIndex, discardTile) {
    const baseId = tileBaseId(discardTile);
    const handTiles = sameBaseTiles(player.hand, baseId).slice(0, 2);
    const calledFromIndex = gameState?.lastAction?.playerIndex;
    const calledTile = cloneTile(discardTile);
    const calledFromSeat = calledFromSeatFor(playerIndex, calledFromIndex);
    return {
      ...player,
      hand: removeTilesById(player.hand, handTiles),
      melds: [
        ...(player.melds || []).map(cloneMeld).filter(Boolean),
        {
          id: `cpu_pon_${baseId}`,
          type: "pon",
          baseId,
          tiles: calledFromSeat === "kamicha" ? [calledTile, ...handTiles] : [...handTiles, calledTile],
          calledTile,
          calledFrom: gameState?.players?.[calledFromIndex]?.id,
          calledFromSeat,
          fromPlayerIndex: calledFromIndex,
        },
      ],
    };
  }

  function cpuPonVirtualState(gameState, playerIndex, virtualPlayer, calledBaseId) {
    return {
      ...gameState,
      players: (gameState?.players || []).map((player, index) => index === playerIndex ? virtualPlayer : player),
      ponDiscardRestriction: {
        playerId: virtualPlayer.id,
        playerIndex,
        baseTileId: calledBaseId,
      },
    };
  }

  function cpuPonEntryMatchesConditions(entry, beforeAcceptanceCount, gameState) {
    const { afterDiscard, shanten, acceptance, acceptanceTiles } = entry;
    if (
      shanten === 1 &&
      allShapeTilesAreTanyao(afterDiscard) &&
      doraHanInCpuShape(afterDiscard, gameState) >= 3 &&
      acceptance >= 7
    ) {
      return true;
    }
    if (shanten === 1 && allShapeTilesAreSuitOrHonor(afterDiscard, "pin") && acceptance >= 7) {
      return true;
    }
    if (shanten === 1 && allShapeTilesAreSuitOrHonor(afterDiscard, "sou") && acceptance >= 7) {
      return true;
    }
    if (
      shanten === 1 &&
      hasYakuhaiCompletedMeld(afterDiscard, gameState) &&
      hasPairAfterRemovingCompletedMelds(afterDiscard.hand) &&
      acceptance >= 7
    ) {
      return true;
    }
    return (
      beforeAcceptanceCount <= 14 &&
      shanten === 0 &&
      acceptance >= 3 &&
      everyAcceptanceTileHasYakuWithoutRiichi(afterDiscard, gameState, acceptanceTiles)
    );
  }

  function chooseCpuPonReaction(player, playerIndex, gameState, discardTile, random = Math.random) {
    if (!player?.isCpu || !canPon(player, discardTile)) return null;
    const context = createCpuCalculationContext(player, gameState);
    const beforeShanten = estimateShantenCached(player, context);
    const beforeAcceptanceCount = acceptanceTilesForPlayerState(player, gameState, context).length;
    const calledBaseId = tileBaseId(discardTile);
    const virtualPlayer = buildCpuPonVirtualPlayer(player, gameState, playerIndex, discardTile);
    const virtualState = cpuPonVirtualState(gameState, playerIndex, virtualPlayer, calledBaseId);
    const virtualContext = createCpuCalculationContext(virtualPlayer, virtualState);
    const candidates = discardCandidatesForPlayer(virtualPlayer, virtualState);
    const entries = candidates.map((tile) => {
      const afterDiscard = playerAfterDiscard(virtualPlayer, tile);
      const acceptanceTiles = acceptanceTilesForPlayerState(afterDiscard, virtualState, virtualContext);
      return {
        tile,
        afterDiscard,
        shanten: estimateShantenCached(afterDiscard, virtualContext),
        acceptance: acceptanceTiles.length,
        acceptanceTiles,
        edgePriority: edgeDiscardPriority(tile),
        doraPriority: doraDiscardPriority(tile, virtualState, virtualContext),
        tieBreaker: random(),
      };
    }).filter((entry) => entry.shanten === beforeShanten - 1);
    const matched = entries.filter((entry) =>
      cpuPonEntryMatchesConditions(entry, beforeAcceptanceCount, virtualState)
    );
    if (matched.length === 0) return null;
    matched.sort((left, right) => {
      if (left.shanten !== right.shanten) return left.shanten - right.shanten;
      if (left.acceptance !== right.acceptance) return right.acceptance - left.acceptance;
      if (left.edgePriority !== right.edgePriority) return left.edgePriority - right.edgePriority;
      if (left.doraPriority !== right.doraPriority) return left.doraPriority - right.doraPriority;
      return left.tieBreaker - right.tieBreaker;
    });
    const selectedTile = preferRedFiveDiscard(matched[0].tile, virtualPlayer, virtualState);
    return { discardTileId: selectedTile?.id || matched[0].tile.id };
  }

  function playerAfterKakanCandidate(player, candidate) {
    const tile = candidate?.tiles?.[0];
    return {
      ...player,
      hand: removeTilesById(player?.hand || [], tile ? [tile] : []),
      melds: (player?.melds || []).map((meld) => {
        if (meld.id !== candidate?.meldId) return cloneMeld(meld);
        return {
          ...cloneMeld(meld),
          type: "kakan",
          tiles: [...cloneTiles(meld.tiles || []), cloneTile(tile)],
          addedTile: cloneTile(tile),
        };
      }).filter(Boolean),
    };
  }

  function chooseCpuKakanCandidate(player, gameState, random = Math.random) {
    if (!player?.isCpu || player.isRiichi) return null;
    const kamicha = kamichaEntryFor(player, gameState)?.player;
    const shimocha = shimochaEntryFor(player, gameState)?.player;
    if (kamicha?.isRiichi || shimocha?.isRiichi) return null;
    const candidates = getKakanCandidates(player, gameState);
    const context = createCpuCalculationContext(player, gameState);
    const matched = candidates.map((candidate) => {
      const afterKan = playerAfterKakanCandidate(player, candidate);
      const acceptance = acceptanceTilesForPlayerState(afterKan, gameState, context).length;
      return {
        candidate,
        shanten: estimateShantenCached(afterKan, context),
        acceptance,
        tieBreaker: random(),
      };
    }).filter((entry) =>
      (entry.shanten === 0 && entry.acceptance >= 4) ||
      (entry.shanten === 1 && entry.acceptance >= 15)
    );
    return matched.sort((left, right) => {
      if (left.shanten !== right.shanten) return left.shanten - right.shanten;
      if (left.acceptance !== right.acceptance) return right.acceptance - left.acceptance;
      return left.tieBreaker - right.tieBreaker;
    })[0]?.candidate || null;
  }

  function preferRedFiveDiscard(tile, player, gameState) {
    const baseId = tileBaseId(tile);
    if (!["p5", "s5"].includes(baseId) || tile?.color === "red") return tile;
    const redFive = discardCandidatesForPlayer(player, gameState).find(
      (candidate) => tileBaseId(candidate) === baseId && candidate.color === "red"
    );
    return redFive || tile;
  }

  function chooseCpuDiscard(player, gameState, random = Math.random) {
    if (!player || player.hand.length === 0) return null;
    const debugTiming = cpuTimingDebugEnabled();
    const startedAt = debugTiming && typeof performance !== "undefined" ? performance.now() : 0;
    const forced = gameState?.forcedCpuDiscard;
    if (forced?.playerId === player.id) {
      const forcedTile = discardCandidatesForPlayer(player, gameState).find((tile) => tile.id === forced.tileId);
      if (forcedTile) return forcedTile;
    }
    const context = createCpuCalculationContext(player, gameState);
    let selected = null;
    if (shouldUseUltraSpecialCpuMode(player, gameState, context)) {
      selected = chooseUltraSpecialCpuDiscard(player, gameState, random, context);
    } else if (shouldUseSpecialCpuMode(player, gameState, context)) {
      selected = chooseSpecialCpuDiscard(player, gameState, random, context);
    } else {
      selected = chooseStandardCpuDiscard(player, gameState, random, context);
    }
    if (debugTiming && typeof performance !== "undefined") {
      const elapsed = performance.now() - startedAt;
      console.log("CPU discard calculation ms:", Math.round(elapsed * 10) / 10, {
        shantenCache: context.shantenCache.size,
        acceptanceCache: context.acceptanceCache.size,
      });
    }
    return preferRedFiveDiscard(selected, player, gameState);
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
      isDoubleRiichi: player.riichiType === "double",
      isIppatsu: Boolean(player.isRiichi && player.isIppatsuChance),
      isChankan: isChankanContext(gameState),
      isHoutei: isHouteiContext(gameState) && !isChankanContext(gameState),
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
      isDoubleRiichi: player.riichiType === "double",
      isIppatsu: Boolean(player.isRiichi && player.isIppatsuChance),
      isRinshan: gameState.lastDrawSource === "rinshanAfterKan",
      isHaitei: isHaiteiContext(gameState),
      roundWind: gameState.roundWind,
      seatWind: seatWindForIndex(gameState, playerIndex),
      doraIndicators: gameState.doraIndicators,
      uraDoraIndicators: gameState.uraDoraIndicators,
    });
    return Boolean(result.best);
  }

  function canChankan(player, kanTile, gameState, kanPlayerIndex) {
    if (!player || !kanTile || gameState?.players?.[kanPlayerIndex] === player) return false;
    if (isFuriten(player, gameState)) return false;
    const evaluator = HandEval();
    if (!evaluator?.evaluateWinningHand) return false;
    const playerIndex = gameState.players.indexOf(player);
    const result = evaluator.evaluateWinningHand([...cloneTiles(player.hand), cloneTile(kanTile)], kanTile, {
      allWinTiles: [...cloneTiles(player.hand), cloneTile(kanTile), ...cloneTiles(player.flowers), ...meldTiles(player)],
      fixedMelds: player.melds || [],
      isTsumo: false,
      isMenzen: isMenzen(player),
      isRiichi: Boolean(player.isRiichi),
      isDoubleRiichi: player.riichiType === "double",
      isIppatsu: Boolean(player.isRiichi && player.isIppatsuChance),
      isChankan: true,
      roundWind: gameState.roundWind,
      seatWind: seatWindForIndex(gameState, playerIndex),
      doraIndicators: gameState.doraIndicators,
      uraDoraIndicators: gameState.uraDoraIndicators,
    });
    return Boolean(result.best);
  }

  function findChankanWinner(gameState, kanPlayerIndex, kanTile) {
    return (gameState?.players || [])
      .map((player, playerIndex) => ({ player, playerIndex }))
      .filter(({ playerIndex }) => playerIndex !== kanPlayerIndex)
      .find(({ player }) => canChankan(player, kanTile, gameState, kanPlayerIndex)) || null;
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
    if (!player || player.isCpu || player.isRiichi || Number(gameState?.remainingDraws) <= 1 || !discardTile) return [];
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
    if (!player?.isRiichi || Number(gameState?.remainingDraws) <= 1) return [];
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
      riichiType: "",
      needsRiichiMarkerOnNextDiscard: false,
      riichiWinningTiles: [],
      hasDiscardedThisHand: false,
      hasHadFirstDrawTurnThisHand: false,
      isDoubleRiichiEligible: true,
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

  function drawRinshanReplacement(gameState, playerIndex, flowers = [], drawSource = "rinshanAfterFlower") {
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
      next.lastDrawSource = drawSource;
      return { state: syncDrawWallState(next), tile: drawn.tile, flowers };
    }

    return { state: endHandAsRyukyoku(syncDrawWallState(next)), tile: null, flowers };
  }

  function revealInitialFlowerTilesIfNeeded(gameState, playerIndex) {
    let next = cloneGameState(gameState);
    const flowers = [];
    const player = next.players[playerIndex];

    if (!player || player.hasHadFirstDrawTurnThisHand) {
      return { state: syncDrawWallState(next), flowers };
    }

    player.hasHadFirstDrawTurnThisHand = true;

    while (next.players[playerIndex]?.hand.some((tile) => tile.isFlower)) {
      const currentPlayer = next.players[playerIndex];
      const flowerIndex = currentPlayer.hand.findIndex((tile) => tile.isFlower);
      const [flowerTile] = currentPlayer.hand.splice(flowerIndex, 1);
      next = flowerAsAir(next, playerIndex, flowerTile);
      flowers.push(flowerTile);
      const replacement = drawRinshanReplacement(next, playerIndex, flowers, "rinshanAfterFlower");
      next = replacement.state;
      if (next.phase === "ryukyoku") break;
    }

    return { state: syncDrawWallState(next), flowers };
  }

  function beginPlayerDrawTurn(gameState, playerIndex) {
    const initialFlowers = revealInitialFlowerTilesIfNeeded(gameState, playerIndex);
    if (initialFlowers.state.phase === "ryukyoku" || initialFlowers.state.phase === "ended") {
      return { state: initialFlowers.state, tile: null, flowers: initialFlowers.flowers };
    }
    return drawNonFlowerTileWithFlowerReplacement(initialFlowers.state, playerIndex, initialFlowers.flowers);
  }

  function drawNonFlowerTileWithFlowerReplacement(gameState, playerIndex = gameState.currentPlayerIndex, existingFlowers = []) {
    let next = cloneGameState(gameState);
    const flowers = cloneTiles(existingFlowers);

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
        const replacement = drawRinshanReplacement(next, playerIndex, flowers, "rinshanAfterFlower");
        next = replacement.state;
        if (replacement.tile) {
          next.lastAction = {
            type: "draw",
            playerIndex,
            tileId: replacement.tile.id,
            flowers: flowers.map((tile) => tile.id),
            drawSource: next.lastDrawSource,
          };
          return { state: next, tile: replacement.tile, flowers };
        }
        return { state: next, tile: null, flowers };
      }

      next.players[playerIndex].hand.push(drawn.tile);
      next.lastDrawSource = "normal";
      next.lastAction = {
        type: "draw",
        playerIndex,
        tileId: drawn.tile.id,
        flowers: flowers.map((tile) => tile.id),
        drawSource: next.lastDrawSource,
      };
      return { state: syncDrawWallState(next), tile: drawn.tile, flowers };
    }

    return { state: endHandAsRyukyoku(syncDrawWallState(next)), tile: null, flowers };
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

    next.currentPlayerIndex = next.dealerIndex;
    next.phase = "draw";
    next = beginPlayerDrawTurn(next, next.dealerIndex).state;
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
    if (player.hasHadFirstDrawTurnThisHand === false && player.hand[tileIndex]?.isFlower) {
      throw new Error("Flower tiles cannot be discarded before the first draw turn.");
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
    const isDoubleRiichiCandidate =
      isRiichiDeclaration &&
      player.isDoubleRiichiEligible === true &&
      player.hasDiscardedThisHand !== true &&
      isMenzen(player);
    const riichiWaits = isRiichiDeclaration ? getWinningTiles(player) : [];
    const isRiichiMarkerReplacement = Boolean(player.needsRiichiMarkerOnNextDiscard && !isRiichiDeclaration);
    const isTsumogiri =
      isRiichiMarkerReplacement ||
      next.lastAction?.type === "draw" &&
      next.lastAction.playerIndex === playerIndex &&
      next.lastAction.tileId === tileId;
    player.discards.push({
      tile: discarded,
      isRiichiDeclaration,
      isRiichiMarkerReplacement,
      isTsumogiri,
    });
    player.hasDiscardedThisHand = true;
    player.isDoubleRiichiEligible = false;
    next.ponDiscardRestriction = null;
    next.forcedCpuDiscard = null;
    if (isRiichiMarkerReplacement) {
      player.needsRiichiMarkerOnNextDiscard = false;
    }
    if (player.isRiichi && !isRiichiDeclaration) {
      player.isIppatsuChance = false;
    }
    next.phase = "draw";
    next.pendingAction = null;
    next.riichiDeclaration = null;
    next.pendingRiichi = isRiichiDeclaration
      ? {
          playerIndex,
          riichiWinningTiles: riichiWaits,
          discardTileId: tileId,
          isDoubleRiichiCandidate,
        }
      : null;
    next.lastAction = {
      type: "discard",
      playerIndex,
      tileId,
      tile: cloneTile(discarded),
      isTsumogiri,
      isRiichiDeclaration,
      isRiichiMarkerReplacement,
    };
    next.lastDrawSource = "normal";
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

  function startRiichiDeclaration(gameState, playerIndex, optionsOverride = null) {
    const next = cloneGameState(gameState);
    const player = next.players[playerIndex];
    const riichiCheckState = { ...next, phase: "discard" };
    if (!canRiichi(player, riichiCheckState)) {
      throw new Error("Riichi is not available.");
    }
    const options = Array.isArray(optionsOverride) && optionsOverride.length > 0
      ? optionsOverride
      : riichiDiscardOptions(player, riichiCheckState);
    next.pendingAction = null;
    next.riichiDeclaration = {
      playerIndex,
      isCpu: Boolean(player?.isCpu),
      options,
    };
    next.phase = "discard";
    next.lastAction = {
      ...(next.lastAction || {}),
      type: "riichiDeclaration",
      playerIndex,
    };
    return syncDrawWallState(next);
  }

  function commitRiichiIfPending(gameState) {
    const next = cloneGameState(gameState);
    const pending = next.pendingRiichi;
    if (!pending) return syncDrawWallState(next);
    const player = next.players[pending.playerIndex];
    if (player && !player.isRiichi) {
      const isDoubleRiichi = Boolean(pending.isDoubleRiichiCandidate && isMenzen(player));
      player.isRiichi = true;
      player.riichiType = isDoubleRiichi ? "double" : "normal";
      player.isIppatsuChance = true;
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

  function hasRiichiMarkerInRiver(player) {
    return (player?.discards || []).some(
      (discard) => discard?.isRiichiDeclaration || discard?.isRiichiMarkerReplacement
    );
  }

  function markRiichiReplacementAfterCalledDeclaration(discarder, removedDiscard) {
    const removed = removedDiscard?.removed;
    const removedRiichiMarker = removed?.isRiichiDeclaration || removed?.isRiichiMarkerReplacement;
    if (!discarder || !removedRiichiMarker || !discarder.isRiichi) return;
    if (hasRiichiMarkerInRiver(discarder)) return;
    discarder.needsRiichiMarkerOnNextDiscard = true;
  }

  function commitRiichiBeforeCallIfNeeded(gameState) {
    const pending = gameState?.pendingRiichi;
    if (!pending || pending.playerIndex !== gameState?.lastAction?.playerIndex) {
      return cloneGameState(gameState);
    }
    return commitRiichiIfPending(gameState);
  }

  function callPon(gameState, playerIndex, discardTile = gameState.pendingAction?.discardTile, forcedDiscardTileId = "") {
    const next = commitRiichiBeforeCallIfNeeded(gameState);
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
      markRiichiReplacementAfterCalledDeclaration(discarder, removedDiscard);
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
    checkDaisangenPaoAfterCall(player, calledTile, discarder?.id, next);
    breakDoubleRiichiRound(next);
    clearIppatsuChances(next);
    next.currentPlayerIndex = playerIndex;
    next.pendingAction = null;
    next.pendingRiichi = null;
    next.ponDiscardRestriction = {
      playerId: player.id,
      playerIndex,
      baseTileId: baseId,
    };
    next.forcedCpuDiscard = player.isCpu && forcedDiscardTileId
      ? {
          playerId: player.id,
          playerIndex,
          tileId: forcedDiscardTileId,
        }
      : null;
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
    const replacement = drawRinshanReplacement(next, playerIndex, [], "rinshanAfterKan");
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
        drawSource: next.lastDrawSource,
      };
    }
    return next;
  }

  function callKan(gameState, playerIndex, candidate = null) {
    let next = commitRiichiBeforeCallIfNeeded(gameState);
    const player = next.players[playerIndex];
    const candidates = candidate ? [candidate] : getKanCandidates(player, next);
    const kan = candidates[0];
    if (!kan || Number(next.remainingDraws) <= 1) throw new Error("Kan is not available.");

    if (kan.type === "kakan") {
      const chankanWinner = findChankanWinner(next, playerIndex, kan.tiles?.[0]);
      if (chankanWinner) {
        return resolveWin(next, {
          winType: "ron",
          winnerIndex: chankanWinner.playerIndex,
          discarderIndex: playerIndex,
          winningTile: kan.tiles[0],
          isChankan: true,
        });
      }
    }

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
        markRiichiReplacementAfterCalledDeclaration(discarder, removedDiscard);
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
      checkDaisangenPaoAfterCall(player, calledTile, discarder?.id, next);
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

    breakDoubleRiichiRound(next);
    next.pendingAction = null;
    next.pendingRiichi = null;
    clearIppatsuChances(next);
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

  function evaluateWin(gameState, { winType, winnerIndex, winningTile, isChankan = false } = {}) {
    const evaluator = HandEval();
    const winner = gameState.players[winnerIndex];
    if (!evaluator?.evaluateWinningHand || !winner || !winningTile) return null;
    const chankan = isChankanContext(gameState, isChankan);
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
      isDoubleRiichi: winner.riichiType === "double",
      isIppatsu: Boolean(winner.isRiichi && winner.isIppatsuChance),
      isRinshan: winType === "tsumo" && gameState.lastDrawSource === "rinshanAfterKan",
      isChankan: winType === "ron" && chankan,
      isHaitei: winType === "tsumo" && isHaiteiContext(gameState),
      isHoutei: winType === "ron" && isHouteiContext(gameState) && !chankan,
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

  function yakuResultsFromWinResult(winResult) {
    return (
      winResult?.evaluation?.best?.yaku ||
      winResult?.best?.yaku ||
      winResult?.yaku ||
      []
    );
  }

  function hasDaisangenYakuman(winResult) {
    return yakuResultsFromWinResult(winResult).some((yaku) => {
      const id = String(yaku?.id || "").toLowerCase();
      const name = String(yaku?.name || yaku?.displayName || "");
      return (yaku?.yakuman || yaku?.isYakuman) && (id === "daisangen" || name === "大三元");
    });
  }

  function paoStateForWinResult(winResult, gameState) {
    const paoState = gameState?.paoState;
    if (!paoState || paoState.yakumanType !== "daisangen") return null;
    const winnerIndex = Number.isInteger(winResult?.winnerIndex)
      ? winResult.winnerIndex
      : gameState.players.findIndex((player) => player.id === winResult?.winnerId);
    const winnerId = gameState.players[winnerIndex]?.id || winResult?.winnerId;
    if (winnerId !== paoState.targetPlayerId) return null;
    const responsiblePlayerIndex = Number.isInteger(paoState.responsiblePlayerIndex)
      ? paoState.responsiblePlayerIndex
      : gameState.players.findIndex((player) => player.id === paoState.responsiblePlayerId);
    if (winnerIndex < 0 || responsiblePlayerIndex < 0 || winnerIndex === responsiblePlayerIndex) return null;
    return { ...paoState, winnerIndex, responsiblePlayerIndex };
  }

  function shouldApplyDaisangenPao(winResult, gameState) {
    return Boolean(paoStateForWinResult(winResult, gameState) && hasDaisangenYakuman(winResult));
  }

  function applyDaisangenPaoPayment(winResult, gameState) {
    const paoState = paoStateForWinResult(winResult, gameState);
    if (!paoState || !hasDaisangenYakuman(winResult)) return null;
    const pointDeltas = [...(winResult.pointDeltas || [0, 0, 0])];
    const chipDeltas = [...(winResult.chipDeltas || [0, 0, 0])];
    const winnerPointGain = Math.max(0, Number(pointDeltas[paoState.winnerIndex]) || 0);
    const winnerChipGain = Math.max(0, Number(chipDeltas[paoState.winnerIndex]) || 0);
    const adjustedPointDeltas = [0, 0, 0];
    const adjustedChipDeltas = [0, 0, 0];
    adjustedPointDeltas[paoState.winnerIndex] = winnerPointGain;
    adjustedPointDeltas[paoState.responsiblePlayerIndex] = -winnerPointGain;
    adjustedChipDeltas[paoState.winnerIndex] = winnerChipGain;
    adjustedChipDeltas[paoState.responsiblePlayerIndex] = -winnerChipGain;
    return {
      type: "daisangen",
      targetPlayerId: paoState.targetPlayerId,
      targetPlayerIndex: paoState.winnerIndex,
      responsiblePlayerId: paoState.responsiblePlayerId,
      responsiblePlayerIndex: paoState.responsiblePlayerIndex,
      pointDeltas: adjustedPointDeltas,
      chipDeltas: adjustedChipDeltas,
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

    const paoPayment = shouldApplyDaisangenPao({ evaluation, winnerIndex, pointDeltas, chipDeltas }, gameState)
      ? applyDaisangenPaoPayment({ evaluation, winnerIndex, pointDeltas, chipDeltas }, gameState)
      : null;
    if (paoPayment) {
      paoPayment.pointDeltas.forEach((delta, index) => {
        pointDeltas[index] = delta;
      });
      paoPayment.chipDeltas.forEach((delta, index) => {
        chipDeltas[index] = delta;
      });
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
      paoPayment,
    };
  }

  function resolveWin(gameState, { winType, winnerIndex, discarderIndex = null, winningTile: suppliedWinningTile = null, isChankan = false } = {}) {
    const next = cloneGameState(gameState);
    const winningTile =
      suppliedWinningTile
        ? cloneTile(suppliedWinningTile)
        : winType === "tsumo"
        ? drawnTileForPlayer(next, winnerIndex)
        : cloneTile(next.lastAction?.tile);
    const evaluation = evaluateWin(next, { winType, winnerIndex, winningTile, isChankan });
    const settlement = applyWinSettlement(next, { winType, winnerIndex, discarderIndex, evaluation });
    next.phase = "result";
    next.pendingAction = null;
    next.pendingRiichi = null;
    clearRiichiMarkerReplacementFlags(next);
    next.lastAction = {
      type: "win",
      winType,
      winnerIndex,
      discarderIndex,
      winningTile: cloneTile(winningTile),
      isChankan: Boolean(isChankan),
      evaluation,
      pointDeltas: settlement.pointDeltas,
      chipDeltas: settlement.chipDeltas,
      kyotakuBefore: settlement.kyotakuBefore,
      kyotakuAfter: settlement.kyotakuAfter,
      paoState: next.paoState ? { ...next.paoState } : null,
      paoPayment: settlement.paoPayment,
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
    clearRiichiMarkerReplacementFlags(next);
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
      if (player.isCpu) {
        const afterKan = callKan(gameState, playerIndex, candidates[0]);
        if (afterKan.phase === "result") return afterKan;
        return handleRiichiDraw(afterKan.players[playerIndex], afterKan);
      }
      return setPendingAction(gameState, {
        playerId: player.id,
        playerIndex,
        source: "afterDraw",
        availableActions: availableActionState({ kan: true, skip: true }),
        candidates,
        reason: "riichiAnkan",
      });
    }
    return discardDrawnTile(gameState, playerIndex);
  }

  function afterPlayerDraw(gameState) {
    const next = cloneGameState(gameState);
    if (next.phase !== "discard") return syncDrawWallState(next);
    const player = next.players[next.currentPlayerIndex];
    if (!player) return syncDrawWallState(next);

    if (player.isRiichi) {
      return syncDrawWallState(next);
    }
    if (player.isCpu) {
      if (canTsumo(player, next)) {
        return resolveWin(next, { winType: "tsumo", winnerIndex: next.currentPlayerIndex });
      }
      const cpuKakan = chooseCpuKakanCandidate(player, next);
      if (cpuKakan) {
        const afterKan = callKan(next, next.currentPlayerIndex, cpuKakan);
        return afterKan.phase === "result" ? afterKan : afterPlayerDraw(afterKan);
      }
      const cpuOptions = cpuRiichiOptions(player, next);
      if (cpuOptions.length > 0) {
        return startRiichiDeclaration(next, next.currentPlayerIndex, cpuOptions);
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
      if (!humanReaction.actions?.canRon) {
        next = commitRiichiIfPending(next);
      }
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

    const cpuPon = reactionPlayers
      .filter(({ player }) => player.isCpu)
      .map(({ player, playerIndex }) => ({
        player,
        playerIndex,
        decision: chooseCpuPonReaction(player, playerIndex, next, discardTile),
      }))
      .find(({ decision }) => Boolean(decision));
    if (cpuPon) {
      next = commitRiichiIfPending(next);
      return callPon(next, cpuPon.playerIndex, discardTile, cpuPon.decision.discardTileId);
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
          return discardDrawnTile(gameState, playerIndex);
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

  function hasUnresolvedDraw(gameState) {
    return gameState?.phase === "discard";
  }

  function nextTurn(gameState) {
    let next = syncDrawWallState(cloneGameState(gameState));
    if (next.phase === "actionPending" || next.phase === "ryukyoku" || next.phase === "ended" || next.phase === "result") {
      return next;
    }
    if (hasUnresolvedDraw(next)) {
      return next;
    }
    if (next.drawWall.length <= 0) {
      return endHandAsRyukyoku(next);
    }

    const playerIndex = nextPlayerIndex(next.currentPlayerIndex);
    next.currentPlayerIndex = playerIndex;
    next.phase = "draw";
    next = beginPlayerDrawTurn(next, playerIndex).state;
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
    clearRiichiMarkerReplacementFlags(next);
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
      lastDrawSource: "normal",
      paoState: null,
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
    checkDaisangenPaoAfterCall,
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
    shouldUseUltraSpecialCpuMode,
    shouldUseSpecialCpuMode,
    isDangerousPlayer,
    countCompletedMeldsForCpu,
    chooseCpuPonReaction,
    chooseCpuKakanCandidate,
    chooseStandardCpuDiscard,
    chooseUltraSpecialCpuDiscard,
    chooseSpecialCpuDiscard,
    chooseDefensiveDiscard,
    removeRonDangerTiles,
    chooseMaxAcceptanceDiscard,
    countAcceptanceTilesAfterDiscard,
    shouldCpuRiichi,
    getAvailableActions,
    shouldAutoTsumogiriAfterRiichi,
    hasDaisangenYakuman,
    shouldApplyDaisangenPao,
    applyDaisangenPaoPayment,
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
