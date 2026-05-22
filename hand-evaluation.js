(function (root, factory) {
  const api = factory(root);
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.MahjongHandEvaluation = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (root) {
  "use strict";

  const Tiles =
    root.MahjongTiles ||
    (typeof require === "function" ? require("./tiles.js") : null);
  const Rules =
    root.MahjongRules ||
    (typeof require === "function" ? require("./rules.js") : null);

  const NUMBERED_SUIT_PREFIX = { man: "m", pin: "p", sou: "s" };
  const WIND_ORDER = ["east", "south", "west", "north"];
  const DRAGON_ORDER = ["white", "green", "red"];
  const HONOR_ORDER = {
    east: 1,
    south: 2,
    west: 3,
    north: 4,
    white: 5,
    green: 6,
    red: 7,
  };
  const KOKUSHI_BASE_IDS = new Set([
    "m1",
    "m9",
    "p1",
    "p9",
    "s1",
    "s9",
    "east",
    "south",
    "west",
    "north",
    "white",
    "green",
    "red",
  ]);
  const MAX_STANDARD_MELDS = 4;
  const MAX_DORA_INDICATORS = 5;

  function cloneTile(tile) {
    return tile ? { ...tile } : null;
  }

  function tileKindId(tileOrId) {
    if (Tiles?.tileKindId) return Tiles.tileKindId(tileOrId);
    const id = typeof tileOrId === "string" ? tileOrId : tileOrId?.id;
    return id ? String(id).replace(/_\d+$/, "") : "";
  }

  function tileDefinition(tileOrId) {
    if (!Tiles?.getTileDefinition) return null;
    return Tiles.getTileDefinition(tileOrId);
  }

  function tileBaseId(tileOrId) {
    if (tileOrId && typeof tileOrId === "object" && tileOrId.baseId) {
      return tileOrId.baseId;
    }
    const definition = tileDefinition(tileOrId);
    return definition?.baseId || tileKindId(tileOrId);
  }

  function definitionForBaseId(baseId, samples = []) {
    const sample = samples.find((tile) => tileBaseId(tile) === baseId);
    if (sample) return sample;
    return (Tiles?.TILE_DEFINITIONS || []).find((definition) => definition.baseId === baseId) || null;
  }

  function baseSuit(baseId, samples = []) {
    const definition = definitionForBaseId(baseId, samples);
    if (definition?.suit) return definition.suit;
    if (/^m\d$/.test(baseId)) return "man";
    if (/^p\d$/.test(baseId)) return "pin";
    if (/^s\d$/.test(baseId)) return "sou";
    if (HONOR_ORDER[baseId]) return "honor";
    if (baseId === "flower") return "flower";
    return "";
  }

  function baseNumber(baseId, samples = []) {
    const definition = definitionForBaseId(baseId, samples);
    if (Number.isInteger(definition?.number)) return definition.number;
    const match = String(baseId).match(/^[mps](\d)$/);
    return match ? Number(match[1]) : null;
  }

  function virtualTile(baseId, samples = []) {
    const definition = definitionForBaseId(baseId, samples);
    return {
      id: definition?.id || baseId,
      baseId,
      suit: definition?.suit || baseSuit(baseId, samples),
      number: Number.isInteger(definition?.number) ? definition.number : baseNumber(baseId, samples),
      name: definition?.name || baseId,
      color: definition?.color || "normal",
      isFlower: Boolean(definition?.isFlower || baseId === "flower"),
      bonusHan: Number(definition?.bonusHan) || 0,
      image: definition?.image || Tiles?.tileImagePath?.(baseId) || "",
    };
  }

  function shapeTiles(tiles) {
    return Array.isArray(tiles) ? tiles.filter((tile) => tile && !tile.isFlower && tileBaseId(tile) !== "flower") : [];
  }

  function countByBaseId(tiles) {
    return tiles.reduce((counts, tile) => {
      const baseId = tileBaseId(tile);
      counts.set(baseId, (counts.get(baseId) || 0) + 1);
      return counts;
    }, new Map());
  }

  function sortedBaseIds(baseIds, samples = []) {
    return [...baseIds].sort((left, right) => baseSortValue(left, samples) - baseSortValue(right, samples));
  }

  function baseSortValue(baseId, samples = []) {
    const suit = baseSuit(baseId, samples);
    const suitOrder = { man: 0, pin: 1, sou: 2, honor: 3, flower: 4 };
    const number = suit === "honor" ? HONOR_ORDER[baseId] || 99 : baseNumber(baseId, samples) || 99;
    return (suitOrder[suit] ?? 9) * 100 + number;
  }

  function tileGroup(kind, baseIds, samples = []) {
    return {
      type: kind,
      baseIds: [...baseIds],
      tiles: baseIds.map((baseId) => virtualTile(baseId, samples)),
      baseId: baseIds[0],
    };
  }

  function cloneGroup(group) {
    return group
      ? {
          ...group,
          baseIds: [...(group.baseIds || [])],
          tiles: (group.tiles || []).map(cloneTile).filter(Boolean),
        }
      : null;
  }

  function cloneMelds(melds) {
    return (melds || []).map(cloneGroup).filter(Boolean);
  }

  function canSequence(baseId, counts, samples = []) {
    const suit = baseSuit(baseId, samples);
    const number = baseNumber(baseId, samples);
    if (!NUMBERED_SUIT_PREFIX[suit] || !Number.isInteger(number)) return null;
    if (suit === "man") return null;
    if (number > 7) return null;
    const prefix = NUMBERED_SUIT_PREFIX[suit];
    const second = `${prefix}${number + 1}`;
    const third = `${prefix}${number + 2}`;
    return (counts.get(second) || 0) > 0 && (counts.get(third) || 0) > 0
      ? [baseId, second, third]
      : null;
  }

  function firstRemainingBaseId(counts, samples = []) {
    return sortedBaseIds([...counts.keys()].filter((baseId) => (counts.get(baseId) || 0) > 0), samples)[0] || "";
  }

  function addCount(counts, baseId, amount) {
    counts.set(baseId, (counts.get(baseId) || 0) + amount);
  }

  function enumerateStandardMelds(counts, samples = [], current = [], requiredMeldCount = MAX_STANDARD_MELDS) {
    const first = firstRemainingBaseId(counts, samples);
    if (!first) return current.length === requiredMeldCount ? [cloneMelds(current)] : [];
    if (current.length >= requiredMeldCount) return [];

    const results = [];
    if ((counts.get(first) || 0) >= 3) {
      addCount(counts, first, -3);
      results.push(
        ...enumerateStandardMelds(counts, samples, [
          ...current,
          tileGroup("triplet", [first, first, first], samples),
        ],
          requiredMeldCount
        )
      );
      addCount(counts, first, 3);
    }

    const sequence = canSequence(first, counts, samples);
    if (sequence) {
      sequence.forEach((baseId) => addCount(counts, baseId, -1));
      results.push(
        ...enumerateStandardMelds(counts, samples, [
          ...current,
          tileGroup("sequence", sequence, samples),
        ],
          requiredMeldCount
        )
      );
      sequence.forEach((baseId) => addCount(counts, baseId, 1));
    }

    return results;
  }

  function sequenceWaitType(meld, winningBaseId) {
    const numbers = (meld.baseIds || []).map((baseId) => baseNumber(baseId, meld.tiles)).sort((a, b) => a - b);
    const winningNumber = baseNumber(winningBaseId, meld.tiles);
    if (!Number.isInteger(winningNumber) || numbers.length !== 3) return "unknown";
    if (winningNumber === numbers[1]) return "kanchan";
    if (numbers[0] === 1 && winningNumber === 3) return "penchan";
    if (numbers[0] === 7 && winningNumber === 7) return "penchan";
    return "ryanmen";
  }

  function candidatePositionVariants(baseCandidate, winningTile) {
    const winningBaseId = tileBaseId(winningTile);
    const positions = [];

    (baseCandidate.melds || []).forEach((meld, meldIndex) => {
      if (meld.fixed) return;
      if (!(meld.baseIds || []).includes(winningBaseId)) return;
      if (meld.type === "sequence") {
        positions.push({
          usage: "sequence",
          meldIndex,
          waitType: sequenceWaitType(meld, winningBaseId),
        });
      } else if (meld.type === "triplet" || meld.type === "quad") {
        positions.push({ usage: "triplet", meldIndex, waitType: "shanpon" });
      }
    });

    if ((baseCandidate.pair?.baseIds || []).includes(winningBaseId)) {
      positions.push({ usage: "pair", waitType: "tanki" });
    }

    if (positions.length === 0) {
      positions.push({ usage: baseCandidate.type, waitType: "unknown" });
    }

    return positions.map((winningTilePosition) => ({
      ...baseCandidate,
      melds: cloneMelds(baseCandidate.melds),
      pair: cloneGroup(baseCandidate.pair),
      winningTile: cloneTile(winningTile),
      winningTilePosition,
    }));
  }

  function getStandardWinningCandidates(tiles, winningTile) {
    const normalTiles = shapeTiles(tiles);
    if (normalTiles.length !== 14) return [];
    const samples = normalTiles;
    const counts = countByBaseId(normalTiles);
    const results = [];

    sortedBaseIds([...counts.keys()], samples).forEach((pairBaseId) => {
      if ((counts.get(pairBaseId) || 0) < 2) return;
      addCount(counts, pairBaseId, -2);
      enumerateStandardMelds(counts, samples).forEach((melds) => {
        const candidate = {
          type: "standard",
          melds,
          pair: tileGroup("pair", [pairBaseId, pairBaseId], samples),
          winningTile: cloneTile(winningTile),
          winningTilePosition: { usage: "standard", waitType: "unknown" },
        };
        results.push(...candidatePositionVariants(candidate, winningTile));
      });
      addCount(counts, pairBaseId, 2);
    });

    return results;
  }

  function isSequenceBaseIds(baseIds, samples = []) {
    if (baseIds.length !== 3) return false;
    const sorted = sortedBaseIds(baseIds, samples);
    const suit = baseSuit(sorted[0], samples);
    if (!NUMBERED_SUIT_PREFIX[suit] || suit === "man") return false;
    const numbers = sorted.map((baseId) => baseNumber(baseId, samples));
    return numbers.every(Number.isInteger) && numbers[1] === numbers[0] + 1 && numbers[2] === numbers[1] + 1;
  }

  function fixedMeldGroup(meld, samples = []) {
    const tiles = shapeTiles(meld?.tiles || []);
    const baseIds = tiles.map(tileBaseId).filter(Boolean);
    if (baseIds.length < 3) return null;
    const isSequence = meld?.type === "chi" || meld?.type === "sequence" || isSequenceBaseIds(baseIds, samples);
    const type = isSequence ? "sequence" : baseIds.length >= 4 ? "quad" : "triplet";
    const orderedBaseIds = isSequence ? sortedBaseIds(baseIds, samples) : baseIds;
    return {
      type,
      baseIds: orderedBaseIds,
      tiles: tiles.map(cloneTile),
      baseId: orderedBaseIds[0],
      fixed: true,
      sourceType: meld?.type,
    };
  }

  function normalizeFixedMelds(melds, samples = []) {
    return (Array.isArray(melds) ? melds : []).map((meld) => fixedMeldGroup(meld, samples)).filter(Boolean);
  }

  function getStandardWinningCandidatesWithMelds(tiles, fixedMelds, winningTile) {
    const normalTiles = shapeTiles(tiles);
    const fixedGroups = normalizeFixedMelds(fixedMelds, normalTiles);
    const requiredMeldCount = MAX_STANDARD_MELDS - fixedGroups.length;
    if (requiredMeldCount < 0) return [];
    if (normalTiles.length !== requiredMeldCount * 3 + 2) return [];

    const samples = [...normalTiles, ...fixedGroups.flatMap((meld) => meld.tiles || [])];
    const counts = countByBaseId(normalTiles);
    const results = [];

    sortedBaseIds([...counts.keys()], samples).forEach((pairBaseId) => {
      if ((counts.get(pairBaseId) || 0) < 2) return;
      addCount(counts, pairBaseId, -2);
      enumerateStandardMelds(counts, samples, [], requiredMeldCount).forEach((melds) => {
        const candidate = {
          type: "standard",
          melds: [...fixedGroups.map(cloneGroup), ...melds],
          pair: tileGroup("pair", [pairBaseId, pairBaseId], samples),
          winningTile: cloneTile(winningTile),
          winningTilePosition: { usage: "standard", waitType: "unknown" },
        };
        results.push(...candidatePositionVariants(candidate, winningTile));
      });
      addCount(counts, pairBaseId, 2);
    });

    return results;
  }

  function getChiitoitsuCandidates(tiles, winningTile) {
    const normalTiles = shapeTiles(tiles);
    if (normalTiles.length !== 14) return [];
    const samples = normalTiles;
    const counts = countByBaseId(normalTiles);
    const pairGroups = [];

    for (const baseId of sortedBaseIds([...counts.keys()], samples)) {
      const count = counts.get(baseId) || 0;
      if (count % 2 !== 0) return [];
      for (let index = 0; index < count / 2; index += 1) {
        pairGroups.push(tileGroup("pair", [baseId, baseId], samples));
      }
    }

    if (pairGroups.length !== 7) return [];
    return [
      {
        type: "chiitoitsu",
        melds: pairGroups,
        pair: null,
        winningTile: cloneTile(winningTile),
        winningTilePosition: { usage: "chiitoitsu", waitType: "tanki" },
      },
    ];
  }

  function getKokushiCandidates(tiles, winningTile) {
    const normalTiles = shapeTiles(tiles);
    if (normalTiles.length !== 14) return [];
    const samples = normalTiles;
    const counts = countByBaseId(normalTiles);
    let pairBaseId = "";

    for (const baseId of counts.keys()) {
      if (!KOKUSHI_BASE_IDS.has(baseId)) return [];
      const count = counts.get(baseId) || 0;
      if (count > 2) return [];
      if (count === 2) {
        if (pairBaseId) return [];
        pairBaseId = baseId;
      }
    }

    for (const baseId of KOKUSHI_BASE_IDS) {
      if ((counts.get(baseId) || 0) < 1) return [];
    }
    if (!pairBaseId) return [];

    return [
      {
        type: "kokushi",
        melds: [],
        pair: tileGroup("pair", [pairBaseId, pairBaseId], samples),
        winningTile: cloneTile(winningTile),
        winningTilePosition: {
          usage: "kokushi",
          waitType: tileBaseId(winningTile) === pairBaseId ? "tanki" : "unknown",
        },
      },
    ];
  }

  function getWinningCandidates(tiles, winningTile, context = {}) {
    const tile = winningTile || shapeTiles(tiles).at(-1) || null;
    if (!tile) return [];
    const fixedMelds = context.fixedMelds || context.melds || context.openMelds || [];
    if (fixedMelds.length > 0) {
      return getStandardWinningCandidatesWithMelds(tiles, fixedMelds, tile);
    }
    return [
      ...getStandardWinningCandidates(tiles, tile),
      ...getChiitoitsuCandidates(tiles, tile),
      ...getKokushiCandidates(tiles, tile),
    ];
  }

  function isTerminalOrHonorBase(baseId, samples = []) {
    const suit = baseSuit(baseId, samples);
    if (suit === "honor") return true;
    const number = baseNumber(baseId, samples);
    return number === 1 || number === 9;
  }

  function isSimpleBase(baseId, samples = []) {
    const suit = baseSuit(baseId, samples);
    const number = baseNumber(baseId, samples);
    return ["man", "pin", "sou"].includes(suit) && number >= 2 && number <= 8;
  }

  function candidateBaseIds(candidate) {
    const meldBaseIds = (candidate.melds || []).flatMap((group) => group.baseIds || []);
    const pairBaseIds = candidate.pair?.baseIds || [];
    return [...meldBaseIds, ...pairBaseIds];
  }

  function analyzeHandFeatures(candidate, context = {}) {
    const allBaseIds = candidateBaseIds(candidate);
    const samples = [...(context.allWinTiles || []), ...(candidate.melds || []).flatMap((meld) => meld.tiles || [])];
    const sequenceCount = (candidate.melds || []).filter((meld) => meld.type === "sequence").length;
    const tripletCount = (candidate.melds || []).filter((meld) => meld.type === "triplet").length;
    const quadCount = (candidate.melds || []).filter((meld) => meld.type === "quad").length;
    const pairCount = candidate.type === "chiitoitsu" ? 7 : candidate.pair ? 1 : 0;
    const suitTypes = [
      ...new Set(
        allBaseIds
          .map((baseId) => baseSuit(baseId, samples))
          .filter((suit) => ["man", "pin", "sou"].includes(suit))
      ),
    ];
    const hasHonor = allBaseIds.some((baseId) => baseSuit(baseId, samples) === "honor");
    const openMeldCount =
      Number(context.openMeldCount) ||
      (Array.isArray(context.openMelds) ? context.openMelds.length : 0) ||
      0;
    const isMenzen = context.isMenzen ?? (!context.isOpen && openMeldCount === 0);

    return {
      candidateType: candidate.type,
      isMenzen: Boolean(isMenzen),
      isTsumo: Boolean(context.isTsumo || context.winType === "tsumo"),
      sequenceCount,
      tripletCount,
      quadCount,
      pairCount,
      concealedTripletCount: isMenzen ? tripletCount : 0,
      openMeldCount,
      hasTerminalOrHonor: allBaseIds.some((baseId) => isTerminalOrHonorBase(baseId, samples)),
      allSimples: allBaseIds.length > 0 && allBaseIds.every((baseId) => isSimpleBase(baseId, samples)),
      allTriplets: candidate.type === "standard" && sequenceCount === 0 && tripletCount + quadCount === 4,
      allSequences: candidate.type === "standard" && sequenceCount === 4,
      suitTypes,
      hasHonor,
      waitType: candidate.winningTilePosition?.waitType || "unknown",
      pairBaseId: candidate.pair?.baseId || candidate.pair?.baseIds?.[0],
    };
  }

  function isValuePair(pairBaseId, context = {}) {
    if (["white", "green", "red"].includes(pairBaseId)) return true;
    return pairBaseId === context.roundWind || pairBaseId === context.seatWind;
  }

  function yakuhaiForTriplet(baseId, context = {}) {
    const yaku = [];
    if (["white", "green", "red"].includes(baseId)) {
      yaku.push({ id: `yakuhai_${baseId}`, name: `yakuhai_${baseId}`, han: 1 });
    }
    if (baseId === context.roundWind) {
      yaku.push({ id: "round_wind", name: "round_wind", han: 1 });
    }
    if (baseId === context.seatWind) {
      yaku.push({ id: "seat_wind", name: "seat_wind", han: 1 });
    }
    return yaku;
  }

  function sequenceSignature(meld) {
    return (meld.baseIds || []).join("-");
  }

  function detectYaku(candidate, features, context = {}) {
    if (candidate.type === "kokushi") {
      return [{ id: "kokushi", name: "kokushi", han: 13, yakuman: true, yakumanCount: 1 }];
    }

    const yaku = [];
    if (context.isRiichi) yaku.push({ id: "riichi", name: "riichi", han: 1 });
    if (context.isIppatsu) yaku.push({ id: "ippatsu", name: "ippatsu", han: 1 });
    if (features.isMenzen && features.isTsumo) yaku.push({ id: "menzen_tsumo", name: "menzen_tsumo", han: 1 });
    if (features.allSimples) yaku.push({ id: "tanyao", name: "tanyao", han: 1 });

    if (candidate.type === "chiitoitsu") {
      yaku.push({ id: "chiitoitsu", name: "chiitoitsu", han: 2 });
    }

    if (candidate.type === "standard") {
      if (features.allSequences && features.isMenzen && features.waitType === "ryanmen" && !isValuePair(features.pairBaseId, context)) {
        yaku.push({ id: "pinfu", name: "pinfu", han: 1 });
      }
      (candidate.melds || [])
        .filter((meld) => meld.type === "triplet" || meld.type === "quad")
        .forEach((meld) => {
          yaku.push(...yakuhaiForTriplet(meld.baseId, context));
        });
      if (features.allTriplets) yaku.push({ id: "toitoi", name: "toitoi", han: 2 });

      if (features.isMenzen) {
        const sequenceCounts = (candidate.melds || [])
          .filter((meld) => meld.type === "sequence")
          .reduce((counts, meld) => {
            const signature = sequenceSignature(meld);
            counts[signature] = (counts[signature] || 0) + 1;
            return counts;
          }, {});
        const pairSequenceCount = Object.values(sequenceCounts).filter((count) => count >= 2).length;
        if (pairSequenceCount >= 2) {
          yaku.push({ id: "ryanpeikou", name: "ryanpeikou", han: 3 });
        } else if (pairSequenceCount === 1) {
          yaku.push({ id: "iipeikou", name: "iipeikou", han: 1 });
        }
      }
    }

    if (candidate.type === "standard") {
      const sequences = (candidate.melds || []).filter((meld) => meld.type === "sequence");
      ["pin", "sou"].forEach((suit) => {
        const prefix = NUMBERED_SUIT_PREFIX[suit];
        const hasIttsu = ["1", "4", "7"].every((start) =>
          sequences.some((meld) => sequenceSignature(meld) === `${prefix}${start}-${prefix}${Number(start) + 1}-${prefix}${Number(start) + 2}`)
        );
        if (hasIttsu) yaku.push({ id: "ittsuu", name: "ittsuu", han: features.isMenzen ? 2 : 1 });
      });

      const groups = [...(candidate.melds || []), candidate.pair].filter(Boolean);
      const everyGroupHasTerminalOrHonor = groups.every((group) =>
        (group.baseIds || []).some((baseId) => isTerminalOrHonorBase(baseId, context.allWinTiles || []))
      );
      const everyGroupHasTerminal = groups.every((group) =>
        (group.baseIds || []).some((baseId) => {
          const suit = baseSuit(baseId, context.allWinTiles || []);
          const number = baseNumber(baseId, context.allWinTiles || []);
          return ["man", "pin", "sou"].includes(suit) && (number === 1 || number === 9);
        })
      );
      if (everyGroupHasTerminal && features.sequenceCount > 0) {
        yaku.push({ id: "junchan", name: "junchan", han: features.isMenzen ? 3 : 2 });
      } else if (everyGroupHasTerminalOrHonor && features.sequenceCount > 0) {
        yaku.push({ id: "chanta", name: "chanta", han: features.isMenzen ? 2 : 1 });
      }
    }

    if (features.suitTypes.length === 1) {
      if (features.hasHonor) {
        yaku.push({ id: "honitsu", name: "honitsu", han: features.isMenzen ? 3 : 2 });
      } else {
        yaku.push({ id: "chinitsu", name: "chinitsu", han: features.isMenzen ? 6 : 5 });
      }
    }

    if (
      candidate.type !== "kokushi" &&
      candidateBaseIds(candidate).length > 0 &&
      candidateBaseIds(candidate).every((baseId) => isTerminalOrHonorBase(baseId, context.allWinTiles || [])) &&
      features.sequenceCount === 0
    ) {
      yaku.push({ id: "honroutou", name: "honroutou", han: 2 });
    }

    return yaku;
  }

  function nextDoraBaseId(indicator) {
    const baseId = tileBaseId(indicator);
    const suit = baseSuit(baseId, [indicator]);
    const number = baseNumber(baseId, [indicator]);

    if (suit === "pin" || suit === "sou") {
      const prefix = NUMBERED_SUIT_PREFIX[suit];
      return `${prefix}${number === 9 ? 1 : number + 1}`;
    }
    if (suit === "man") {
      return number === 1 ? "m9" : "m1";
    }
    const windIndex = WIND_ORDER.indexOf(baseId);
    if (windIndex >= 0) return WIND_ORDER[(windIndex + 1) % WIND_ORDER.length];
    const dragonIndex = DRAGON_ORDER.indexOf(baseId);
    if (dragonIndex >= 0) return DRAGON_ORDER[(dragonIndex + 1) % DRAGON_ORDER.length];
    return "";
  }

  function countDoraFromIndicators(allTiles, indicators = []) {
    const doraBaseIds = indicators.slice(0, MAX_DORA_INDICATORS).map(nextDoraBaseId).filter(Boolean);
    const han = shapeTiles(allTiles).reduce((sum, tile) => sum + doraBaseIds.filter((baseId) => tileBaseId(tile) === baseId).length, 0);
    return {
      han,
      doraBaseIds,
    };
  }

  function calculateDoraHan(allTiles, doraIndicators = [], uraDoraIndicators = [], context = {}) {
    const tiles = Array.isArray(allTiles) ? allTiles : [];
    const indicatorDora = countDoraFromIndicators(tiles, doraIndicators);
    const uraDora =
      context.isRiichi || context.includeUraDora
        ? countDoraFromIndicators(tiles, uraDoraIndicators)
        : { han: 0, doraBaseIds: [] };
    const bonusHan = tiles.reduce((sum, tile) => sum + (Number(tile?.bonusHan) || 0), 0);

    return {
      indicatorHan: indicatorDora.han,
      uraHan: uraDora.han,
      bonusHan,
      totalHan: indicatorDora.han + uraDora.han + bonusHan,
      doraBaseIds: indicatorDora.doraBaseIds,
      uraDoraBaseIds: uraDora.doraBaseIds,
    };
  }

  function calculateChipPoints(allTiles, context = {}) {
    const tiles = Array.isArray(allTiles) ? allTiles : [];
    const tileChips = tiles.filter((tile) => {
      const kindId = tileKindId(tile);
      return tile?.color === "blue" && (kindId === "p5_blue" || kindId === "s5_blue" || kindId === "flower_blue");
    }).length;
    const ippatsuChips = context.isIppatsu ? 1 : 0;
    const uraDoraHan =
      context.uraDoraHan ??
      ((context.isRiichi || context.includeUraDora)
        ? countDoraFromIndicators(tiles, context.uraDoraIndicators).han
        : 0);
    const uraChips = Math.max(0, Math.floor(Number(uraDoraHan)));
    const totalChips = tileChips + ippatsuChips + uraChips;

    return {
      tileChips,
      ippatsuChips,
      uraChips,
      totalChips,
      totalPoints: totalChips * 500,
    };
  }

  function rulesTableValue(key, han) {
    if (Rules?.tableValue) return Rules.tableValue(key, han);
    return null;
  }

  function fallbackTableValue(key, han) {
    const normalizedHan = Math.max(1, Math.floor(Number(han) || 1));
    const base = 30 * 2 ** (normalizedHan + 2);
    if (normalizedHan >= 13) {
      return key.includes("parent") ? 48000 : 32000;
    }
    if (normalizedHan >= 11) return key.includes("parent") ? 36000 : 24000;
    if (normalizedHan >= 8) return key.includes("parent") ? 24000 : 16000;
    if (normalizedHan >= 6) return key.includes("parent") ? 18000 : 12000;
    if (normalizedHan >= 5) return key.includes("parent") ? 12000 : 8000;
    const multiplier = key === "parentRon" ? 6 : key === "childRon" ? 4 : key === "parentTsumoChildPays" ? 2 : 1;
    return Math.ceil((base * multiplier) / 100) * 100;
  }

  function tableValue(key, han, yakumanCount = 0) {
    if (yakumanCount > 0) {
      const values = {
        childRon: 32000,
        parentRon: 48000,
        childTsumoChildPays: 12000,
        childTsumoParentPays: 20000,
        parentTsumoChildPays: 24000,
      };
      return (values[key] || 0) * yakumanCount;
    }
    return rulesTableValue(key, han) ?? fallbackTableValue(key, han);
  }

  function calculateMarchaoSanmaPoints({ han, fu = 30, isDealer = false, isTsumo = false, yakumanCount = 0 } = {}) {
    const normalizedHan = Math.max(1, Math.floor(Number(han) || 1));
    if (isTsumo) {
      if (isDealer) {
        const childPays = tableValue("parentTsumoChildPays", normalizedHan, yakumanCount);
        return {
          fu,
          han: normalizedHan,
          isDealer: true,
          isTsumo: true,
          payments: [
            { payer: "child", amount: childPays },
            { payer: "child", amount: childPays },
          ],
          total: childPays * 2,
        };
      }
      const childPays = tableValue("childTsumoChildPays", normalizedHan, yakumanCount);
      const parentPays = tableValue("childTsumoParentPays", normalizedHan, yakumanCount);
      return {
        fu,
        han: normalizedHan,
        isDealer: false,
        isTsumo: true,
        payments: [
          { payer: "parent", amount: parentPays },
          { payer: "child", amount: childPays },
        ],
        total: childPays + parentPays,
      };
    }

    const amount = tableValue(isDealer ? "parentRon" : "childRon", normalizedHan, yakumanCount);
    return {
      fu,
      han: normalizedHan,
      isDealer: Boolean(isDealer),
      isTsumo: false,
      payments: [{ payer: "discarder", amount }],
      total: amount,
    };
  }

  function yakuHan(yaku) {
    return (yaku || []).reduce((sum, item) => sum + (Number(item.han) || 0), 0);
  }

  function yakumanCount(yaku) {
    return (yaku || []).reduce((sum, item) => sum + (item.yakuman ? Number(item.yakumanCount || 1) : 0), 0);
  }

  function evaluateWinningCandidate(candidate, context = {}) {
    const features = analyzeHandFeatures(candidate, context);
    const yaku = detectYaku(candidate, features, context);
    const countedYakuman = yakumanCount(yaku);

    if (yaku.length === 0) {
      return {
        valid: false,
        candidate,
        features,
        yaku,
        reason: "no_yaku",
      };
    }

    const allWinTiles = context.allWinTiles || context.tiles || candidateBaseIds(candidate).map((baseId) => virtualTile(baseId));
    const dora = countedYakuman > 0
      ? { indicatorHan: 0, uraHan: 0, bonusHan: 0, totalHan: 0, doraBaseIds: [], uraDoraBaseIds: [] }
      : calculateDoraHan(allWinTiles, context.doraIndicators, context.uraDoraIndicators, context);
    const chips = calculateChipPoints(allWinTiles, { ...context, uraDoraHan: dora.uraHan });
    const han = countedYakuman > 0 ? 13 * countedYakuman : yakuHan(yaku) + dora.totalHan;
    const points = calculateMarchaoSanmaPoints({
      han,
      fu: 30,
      isDealer: Boolean(context.isDealer),
      isTsumo: Boolean(context.isTsumo || context.winType === "tsumo"),
      yakumanCount: countedYakuman,
    });

    return {
      valid: true,
      candidate,
      features,
      yaku,
      dora,
      chips,
      han,
      fu: 30,
      points,
    };
  }

  function compareByPointsHanYakuCount(left, right) {
    if ((right.points?.total || 0) !== (left.points?.total || 0)) {
      return (right.points?.total || 0) - (left.points?.total || 0);
    }
    if ((right.han || 0) !== (left.han || 0)) return (right.han || 0) - (left.han || 0);
    if ((right.yaku?.length || 0) !== (left.yaku?.length || 0)) return (right.yaku?.length || 0) - (left.yaku?.length || 0);
    return candidateTypeOrder(left.candidate?.type) - candidateTypeOrder(right.candidate?.type);
  }

  function candidateTypeOrder(type) {
    return { standard: 0, chiitoitsu: 1, kokushi: 2 }[type] ?? 9;
  }

  function chooseBestEvaluation(evaluations) {
    return [...(evaluations || [])].filter((evaluation) => evaluation.valid).sort(compareByPointsHanYakuCount)[0] || null;
  }

  function evaluateWinningHand(tiles, winningTile, context = {}) {
    const tile = winningTile || shapeTiles(tiles).at(-1) || null;
    const candidates = getWinningCandidates(tiles, tile, context);
    const evaluations = candidates.map((candidate) =>
      evaluateWinningCandidate(candidate, {
        ...context,
        allWinTiles: context.allWinTiles || tiles,
        winningTile: tile,
      })
    );
    return {
      candidates,
      evaluations,
      best: chooseBestEvaluation(evaluations),
    };
  }

  return {
    getWinningCandidates,
    getStandardWinningCandidates,
    getStandardWinningCandidatesWithMelds,
    getChiitoitsuCandidates,
    getKokushiCandidates,
    analyzeHandFeatures,
    detectYaku,
    nextDoraBaseId,
    calculateDoraHan,
    calculateChipPoints,
    calculateMarchaoSanmaPoints,
    evaluateWinningCandidate,
    evaluateWinningHand,
    chooseBestEvaluation,
    compareByPointsHanYakuCount,
  };
});
