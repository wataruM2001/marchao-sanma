(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.MahjongRules = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  const SEATS = ["東", "南", "西"];
  const ROUND_SEQUENCE = [
    { wind: "東", number: 1 },
    { wind: "東", number: 2 },
    { wind: "東", number: 3 },
    { wind: "南", number: 1 },
    { wind: "南", number: 2 },
    { wind: "南", number: 3 },
  ];
  const DEALER_TURNS_PER_HALF = ROUND_SEQUENCE.length;
  const DEFAULT_PLAYERS = [
    { name: "自分", score: 35000, bonus: 0, tobi: 0 },
    { name: "下家", score: 35000, bonus: 0, tobi: 0 },
    { name: "上家", score: 35000, bonus: 0, tobi: 0 },
  ];

  const POINT_TABLES = {
    childRon: [
      1000, 2000, 4000, 8000, 8000, 12000, 12000, 16000, 16000, 16000, 24000, 24000,
      24000,
    ],
    parentRon: [
      2000, 3000, 6000, 12000, 12000, 18000, 18000, 24000, 24000, 24000, 36000,
      36000, 36000,
    ],
    childTsumoChildPays: [
      1000, 1000, 1000, 3000, 3000, 4000, 4000, 6000, 6000, 6000, 8000, 8000, 8000,
    ],
    childTsumoParentPays: [
      1000, 1000, 3000, 5000, 5000, 8000, 8000, 10000, 10000, 10000, 16000, 16000,
      16000,
    ],
    parentTsumoChildPays: [
      1000, 2000, 3000, 6000, 6000, 9000, 9000, 12000, 12000, 12000, 18000, 18000,
      18000,
    ],
  };

  const LIMIT_VALUES = {
    childRon: 32000,
    parentRon: 48000,
    childTsumoChildPays: 12000,
    childTsumoParentPays: 20000,
    parentTsumoChildPays: 24000,
  };

  const TILE_GROUPS = [
    {
      name: "萬子",
      tiles: [
        { label: "1萬", count: 4 },
        { label: "9萬", count: 4 },
      ],
    },
    {
      name: "筒子",
      tiles: [
        { label: "1筒", count: 4 },
        { label: "2筒", count: 4 },
        { label: "3筒", count: 4 },
        { label: "4筒", count: 4 },
        { label: "赤5筒", count: 3, tone: "red" },
        { label: "青5筒", count: 1, tone: "blue" },
        { label: "6筒", count: 4 },
        { label: "7筒", count: 4 },
        { label: "8筒", count: 4 },
        { label: "9筒", count: 4 },
      ],
    },
    {
      name: "索子",
      tiles: [
        { label: "1索", count: 4 },
        { label: "2索", count: 4 },
        { label: "3索", count: 4 },
        { label: "4索", count: 4 },
        { label: "赤5索", count: 3, tone: "red" },
        { label: "青5索", count: 1, tone: "blue" },
        { label: "6索", count: 4 },
        { label: "7索", count: 4 },
        { label: "8索", count: 4 },
        { label: "9索", count: 4 },
      ],
    },
    {
      name: "字牌・華牌",
      tiles: [
        { label: "東", count: 4 },
        { label: "南", count: 4 },
        { label: "西", count: 4 },
        { label: "北", count: 4 },
        { label: "白", count: 4 },
        { label: "發", count: 4 },
        { label: "中", count: 4 },
        { label: "赤華", count: 3, tone: "red flower" },
        { label: "青華", count: 1, tone: "blue flower" },
      ],
    },
  ];

  function clonePlayers(players = DEFAULT_PLAYERS) {
    return players.map((player) => ({ ...player }));
  }

  function numberOrZero(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function formatPlainNumber(value) {
    return String(numberOrZero(value));
  }

  function normalizeKyotaku(value) {
    return Math.max(0, Math.floor(numberOrZero(value) / 1000) * 1000);
  }

  function normalizeRiichi(riichi) {
    if (!Array.isArray(riichi)) {
      return [false, false, false];
    }
    return [0, 1, 2].map((index) => Boolean(riichi[index]));
  }

  function cloneStateForHistory(state) {
    return {
      players: clonePlayers(state.players),
      seatOrder: getSeatOrder(state),
      initialSeatOrder: initialSeatOrderOf(state),
      dealer: dealerOf(state),
      dealerTurns: completedDealerTurns(state),
      gameEnded: Boolean(state.gameEnded),
      endReason: state.endReason || "",
      honba: Math.max(0, Math.floor(numberOrZero(state.honba))),
      kyotaku: normalizeKyotaku(state.kyotaku),
      riichi: normalizeRiichi(state.riichi),
      history: Array.isArray(state.history) ? [...state.history] : [],
    };
  }

  function normalizeHan(han) {
    const parsed = Math.floor(numberOrZero(han));
    return Math.min(Math.max(parsed, 1), 59);
  }

  function tableValue(key, han) {
    const normalized = normalizeHan(han);
    const table = POINT_TABLES[key];
    if (normalized <= table.length) {
      return table[normalized - 1];
    }
    return LIMIT_VALUES[key];
  }

  function otherPlayers(index) {
    return [0, 1, 2].filter((candidate) => candidate !== index);
  }

  function nextPlayer(index) {
    return (index + 1) % 3;
  }

  function randomSeatOrder() {
    const order = [0, 1, 2];
    for (let index = order.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [order[index], order[swapIndex]] = [order[swapIndex], order[index]];
    }
    return order;
  }

  function normalizeSeatOrder(seatOrder, fallbackDealer = 0) {
    if (
      Array.isArray(seatOrder) &&
      seatOrder.length === 3 &&
      new Set(seatOrder.map(Number)).size === 3 &&
      seatOrder.every((index) => [0, 1, 2].includes(Number(index)))
    ) {
      return seatOrder.map(Number);
    }
    const dealer = [0, 1, 2].includes(Number(fallbackDealer)) ? Number(fallbackDealer) : 0;
    return [dealer, nextPlayer(dealer), nextPlayer(nextPlayer(dealer))];
  }

  function getSeatOrder(stateOrOrder) {
    if (Array.isArray(stateOrOrder)) {
      return normalizeSeatOrder(stateOrOrder);
    }
    if (stateOrOrder && Array.isArray(stateOrOrder.seatOrder)) {
      return normalizeSeatOrder(stateOrOrder.seatOrder, stateOrOrder.dealer);
    }
    return normalizeSeatOrder(null, Number(stateOrOrder) || 0);
  }

  function dealerOf(stateOrOrder) {
    return getSeatOrder(stateOrOrder)[0];
  }

  function playerAtSeat(stateOrOrder, seatIndex) {
    return getSeatOrder(stateOrOrder)[seatIndex];
  }

  function rotateSeatOrder(stateOrOrder) {
    const order = getSeatOrder(stateOrOrder);
    return [order[1], order[2], order[0]];
  }

  function seatOrderWithDealer(stateOrOrder, dealer) {
    const order = getSeatOrder(stateOrOrder);
    const dealerIndex = Number(dealer);
    const position = order.indexOf(dealerIndex);
    if (position < 0) {
      return normalizeSeatOrder(null, dealerIndex);
    }
    return [...order.slice(position), ...order.slice(0, position)];
  }

  function seatForPlayer(stateOrOrder, playerIndex) {
    const order = getSeatOrder(stateOrOrder);
    const position = order.indexOf(Number(playerIndex));
    return SEATS[position] || "";
  }

  function seatMap(stateOrOrder) {
    const seats = ["", "", ""];
    getSeatOrder(stateOrOrder).forEach((playerIndex, seatIndex) => {
      seats[playerIndex] = SEATS[seatIndex];
    });
    return seats;
  }

  function upperPlayerOf(stateOrOrder, playerIndex) {
    const order = getSeatOrder(stateOrOrder);
    const position = order.indexOf(Number(playerIndex));
    if (position < 0) {
      return order[0];
    }
    return order[(position + 2) % 3];
  }

  function shimochaOf(stateOrOrder, playerIndex) {
    const order = getSeatOrder(stateOrOrder);
    const position = order.indexOf(Number(playerIndex));
    if (position < 0) {
      return order[1];
    }
    return order[(position + 1) % 3];
  }

  function winnersOf(hand) {
    if (hand.winType === "doubleRon") {
      const explicitWinners = Array.isArray(hand.doubleRonWinners)
        ? hand.doubleRonWinners
        : [hand.winner, hand.secondWinner];
      let winners = explicitWinners.map(Number);
      if (winners.filter((index) => [0, 1, 2].includes(index)).length < 2 && [0, 1, 2].includes(Number(hand.discarder))) {
        winners = [shimochaOf(hand, hand.discarder), upperPlayerOf(hand, hand.discarder)];
      }
      return [...new Set(winners)].filter((index) => [0, 1, 2].includes(index));
    }
    return [Number(hand.winner)].filter((index) => [0, 1, 2].includes(index));
  }

  function doubleRonBasisWinner(hand, stateOrOrder = hand) {
    const winners = winnersOf(hand);
    if (hand.winType !== "doubleRon") {
      return winners[0] ?? null;
    }
    const discarder = Number(hand.discarder);
    const basisWinner = shimochaOf(stateOrOrder || hand, discarder);
    return winners.includes(basisWinner) ? basisWinner : winners[0] ?? null;
  }

  function isParentContinuationWin(hand, stateOrOrder = hand) {
    const dealer = dealerOf(stateOrOrder || hand);
    if (hand.winType === "doubleRon") {
      return doubleRonBasisWinner(hand, stateOrOrder) === dealer;
    }
    return winnersOf(hand).includes(dealer);
  }

  function kyotakuWinnerFor(hand, stateOrOrder) {
    const winners = winnersOf(hand);
    if (winners.length === 0) {
      return null;
    }
    if (hand.winType !== "doubleRon") {
      return winners[0];
    }
    return doubleRonBasisWinner(hand, stateOrOrder);
  }

  function seatOrderFromSeatMap(seats, fallbackDealer = 0) {
    if (!Array.isArray(seats) || seats.length !== 3) {
      return normalizeSeatOrder(null, fallbackDealer);
    }
    const order = [];
    seats.forEach((seat, playerIndex) => {
      const seatIndex = SEATS.indexOf(seat);
      if (seatIndex >= 0) {
        order[seatIndex] = playerIndex;
      }
    });
    return normalizeSeatOrder(order, fallbackDealer);
  }

  function initialSeatOrderOf(state) {
    if (state && Array.isArray(state.initialSeatOrder)) {
      return normalizeSeatOrder(state.initialSeatOrder, state.dealer);
    }
    if (state && Array.isArray(state.history) && state.history[0]?.seats) {
      return seatOrderFromSeatMap(state.history[0].seats, state.history[0].dealer);
    }
    return getSeatOrder(state);
  }

  function completedHands(state) {
    return Array.isArray(state.history) ? state.history.length : 0;
  }

  function completedDealerTurns(state) {
    const parsed = Number(state.dealerTurns);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  }

  function currentRoundIndex(state) {
    return Math.min(completedDealerTurns(state), DEALER_TURNS_PER_HALF - 1);
  }

  function currentRound(state) {
    return ROUND_SEQUENCE[currentRoundIndex(state)];
  }

  function roundLabel(state) {
    const round = currentRound(state);
    return `${round.wind}${round.number}局`;
  }

  function isOorasu(state) {
    return currentRoundIndex(state) === DEALER_TURNS_PER_HALF - 1;
  }

  function isSingleTop(players, playerIndex) {
    const score = players[playerIndex]?.score;
    return Number.isFinite(score) && players.every((player, index) => index === playerIndex || score > player.score);
  }

  function advanceRound(next, reason = "") {
    next.dealerTurns = completedDealerTurns(next) + 1;
    if (next.dealerTurns >= DEALER_TURNS_PER_HALF) {
      next.gameEnded = true;
      next.endReason = reason || "南3局が終了しました";
    }
  }

  function hasBustedPlayer(players) {
    return players.some((player) => player.score <= 0);
  }

  function halfFinishReason(state) {
    if (hasBustedPlayer(state.players)) {
      return "持ち点が0点以下のプレイヤーがいます";
    }
    if (state.gameEnded) {
      return state.endReason || "半荘が終了しました";
    }
    if (completedDealerTurns(state) >= DEALER_TURNS_PER_HALF) {
      return "南3局が終了しました";
    }
    return "";
  }

  function isHalfFinished(state) {
    return halfFinishReason(state) !== "";
  }

  function seatCounts(state) {
    const counts = state.players.map(() => ({ 東: 0, 南: 0, 西: 0 }));
    state.history.forEach((hand) => {
      const seats = hand.seats || seatMap(hand.dealer);
      seats.forEach((seat, playerIndex) => {
        counts[playerIndex][seat] += 1;
      });
    });
    return counts;
  }

  function doubleRonHandFor(hand, winner) {
    if (!hand || !hand.doubleRonHands) {
      return {};
    }
    return hand.doubleRonHands[winner] || hand.doubleRonHands[String(winner)] || {};
  }

  function hanForWinner(hand, winner) {
    if (hand.winType !== "doubleRon") {
      return hand.han;
    }
    return doubleRonHandFor(hand, winner).han ?? hand.han;
  }

  function bonusSourceForWinner(hand, winner) {
    if (hand.winType !== "doubleRon") {
      return hand;
    }
    return {
      ...hand,
      ...doubleRonHandFor(hand, winner),
    };
  }

  function calculatePayment(hand) {
    const { winType, han, honba, winner, discarder, dealer, seatOrder } = hand;
    const winnerIndex = Number(winner);
    const dealerIndex = Number(dealer);
    const honbaValue = Math.max(0, Math.floor(numberOrZero(honba)));
    const winnerIsDealer = winnerIndex === dealerIndex;
    const deltas = [0, 0, 0];
    const payerDetails = [];

    if (winType === "ron" || winType === "doubleRon") {
      const discarderIndex = Number(discarder);
      const winners = winType === "doubleRon" ? winnersOf(hand) : [winnerIndex];
      if (winners.length !== (winType === "doubleRon" ? 2 : 1)) {
        throw new Error("ダブロンのアガリ者を2名選んでください");
      }
      if (winners.includes(discarderIndex)) {
        throw new Error("放銃者とアガリ者が同じです");
      }
      const honbaWinner = winType === "doubleRon" ? doubleRonBasisWinner(hand, { seatOrder, dealer: dealerIndex }) : null;
      winners.forEach((winnerCandidate) => {
        const paymentKey = winnerCandidate === dealerIndex ? "parentRon" : "childRon";
        const winnerHan = hanForWinner(hand, winnerCandidate);
        const base = tableValue(paymentKey, winnerHan);
        const honbaAmount = winType === "doubleRon" ? (winnerCandidate === honbaWinner ? honbaValue * 1000 : 0) : honbaValue * 1000;
        const amount = base + honbaAmount;
        deltas[winnerCandidate] += amount;
        deltas[discarderIndex] -= amount;
        payerDetails.push({ player: discarderIndex, winner: winnerCandidate, amount, base, honba: honbaAmount, han: normalizeHan(winnerHan) });
      });
      return {
        deltas,
        payerDetails,
        label: payerDetails.map((item) => `${formatPlainNumber(item.amount)}点`).join(" / "),
      };
    }

    otherPlayers(winnerIndex).forEach((payer) => {
      let base;
      if (winnerIsDealer) {
        base = tableValue("parentTsumoChildPays", han);
      } else {
        base =
          payer === dealerIndex
            ? tableValue("childTsumoParentPays", han)
            : tableValue("childTsumoChildPays", han);
      }
      const amount = base + honbaValue * 1000;
      deltas[winnerIndex] += amount;
      deltas[payer] -= amount;
      payerDetails.push({ player: payer, amount });
    });

    return {
      deltas,
      payerDetails,
      label: payerDetails.map((item) => `${formatPlainNumber(item.amount)}点`).join(" / "),
    };
  }

  function calculateBonus({ winType, ippatsu, blueSou, bluePin, blueFlower, ura }) {
    const unit = 500;
    const flags = [ippatsu, blueSou, bluePin, blueFlower].filter(Boolean).length;
    const uraCount = Math.max(0, Math.floor(numberOrZero(ura)));
    return (flags + uraCount) * unit;
  }

  function calculateBonusSettlement(hand) {
    const deltas = [0, 0, 0];
    const details = [];
    if (hand.winType === "draw") {
      return { amount: 0, deltas, details, label: "祝儀 0" };
    }
    const winners = winnersOf(hand);
    if (hand.winType === "doubleRon") {
      const payer = Number(hand.discarder);
      let totalAmount = 0;
      winners.forEach((winner) => {
        const amount = calculateBonus(bonusSourceForWinner(hand, winner));
        totalAmount += amount;
        if (amount === 0) return;
        deltas[winner] += amount;
        deltas[payer] -= amount;
        details.push({ payer, winner, amount });
      });
      return {
        amount: totalAmount,
        deltas,
        details,
        label: details.length ? details.map((item) => `${formatPlainNumber(item.amount)}pt`).join(" / ") : "祝儀 0",
      };
    }
    const amount = calculateBonus(hand);
    if (amount === 0) {
      return { amount, deltas, details, label: "祝儀 0" };
    }
    if (hand.winType === "tsumo") {
      const winner = winners[0];
      otherPlayers(winner).forEach((payer) => {
        deltas[winner] += amount;
        deltas[payer] -= amount;
        details.push({ payer, winner, amount });
      });
    } else {
      const payer = Number(hand.discarder);
      winners.forEach((winner) => {
        deltas[winner] += amount;
        deltas[payer] -= amount;
        details.push({ payer, winner, amount });
      });
    }
    return {
      amount,
      deltas,
      details,
      label: details.map((item) => `${formatPlainNumber(item.amount)}pt`).join(" / "),
    };
  }

  function normalizeTenpai(tenpai, fallbackDealerTenpai = false, dealer = 0) {
    if (Array.isArray(tenpai) && tenpai.length === 3) {
      return [0, 1, 2].map((index) => Boolean(tenpai[index]));
    }
    const normalized = [false, false, false];
    normalized[Number(dealer) || 0] = Boolean(fallbackDealerTenpai);
    return normalized;
  }

  function calculateDrawPayment({ tenpai, dealerTenpai, dealer }) {
    const tenpaiFlags = normalizeTenpai(tenpai, dealerTenpai, dealer);
    const tenpaiPlayers = [0, 1, 2].filter((index) => tenpaiFlags[index]);
    const notenPlayers = [0, 1, 2].filter((index) => !tenpaiFlags[index]);
    const deltas = [0, 0, 0];
    const payerDetails = [];
    if (tenpaiPlayers.length === 1) {
      const receiver = tenpaiPlayers[0];
      notenPlayers.forEach((payer) => {
        deltas[receiver] += 1000;
        deltas[payer] -= 1000;
        payerDetails.push({ player: payer, winner: receiver, amount: 1000 });
      });
    } else if (tenpaiPlayers.length === 2) {
      const payer = notenPlayers[0];
      tenpaiPlayers.forEach((receiver) => {
        deltas[receiver] += 1000;
        deltas[payer] -= 1000;
        payerDetails.push({ player: payer, winner: receiver, amount: 1000 });
      });
    }
    return {
      deltas,
      payerDetails,
      tenpai: tenpaiFlags,
      label: payerDetails.length
        ? payerDetails.map((item) => `${formatPlainNumber(item.amount)}点`).join(" / ")
        : "点棒移動なし",
    };
  }

  function applyRiichi(state, playerIndex) {
    const index = Number(playerIndex);
    if (![0, 1, 2].includes(index)) {
      throw new Error("リーチ対象のプレイヤーが不正です");
    }
    const next = {
      ...state,
      kyotaku: normalizeKyotaku(state.kyotaku),
      riichi: normalizeRiichi(state.riichi),
      players: clonePlayers(state.players),
    };
    if (next.riichi[index]) {
      throw new Error("すでにリーチ成立済みです");
    }
    if (next.players[index].score < 1000) {
      throw new Error("リーチに必要な1000点が足りません");
    }
    next.players[index].score -= 1000;
    next.kyotaku += 1000;
    next.riichi[index] = true;
    return next;
  }

  function cancelRiichi(state, playerIndex) {
    const index = Number(playerIndex);
    const next = {
      ...state,
      kyotaku: normalizeKyotaku(state.kyotaku),
      riichi: normalizeRiichi(state.riichi),
      players: clonePlayers(state.players),
    };
    if (!next.riichi[index]) {
      return next;
    }
    next.players[index].score += 1000;
    next.kyotaku = Math.max(0, next.kyotaku - 1000);
    next.riichi[index] = false;
    return next;
  }

  function applyHand(state, hand) {
    if (isHalfFinished(state)) {
      throw new Error("半荘は終了しています");
    }
    const next = {
      ...state,
      seatOrder: getSeatOrder(state),
      initialSeatOrder: initialSeatOrderOf(state),
      dealerTurns: completedDealerTurns(state),
      gameEnded: false,
      endReason: "",
      kyotaku: normalizeKyotaku(state.kyotaku),
      riichi: normalizeRiichi(state.riichi),
      players: clonePlayers(state.players),
      history: [...state.history],
    };
    const dealer = dealerOf(next);
    const honba = Math.max(0, Math.floor(numberOrZero(hand.honba)));
    const seats = seatMap(next);
    const stateBefore = cloneStateForHistory(state);
    const handRoundLabel = roundLabel(state);

    if (hand.winType === "draw") {
      const drawPayment = calculateDrawPayment({ ...hand, dealer });
      const dealerTenpai = drawPayment.tenpai[dealer];
      drawPayment.deltas.forEach((delta, index) => {
        next.players[index].score += delta;
      });
      next.history.push({
        ...hand,
        stateBefore,
        roundLabel: handRoundLabel,
        honba,
        dealer,
        dealerTenpai,
        tenpai: drawPayment.tenpai,
        seats,
        payment: drawPayment,
        bonus: 0,
        bonusSettlement: { amount: 0, deltas: [0, 0, 0], details: [], label: "祝儀 0" },
        kyotakuBefore: stateBefore.kyotaku,
        kyotakuAfter: next.kyotaku,
        scores: next.players.map((player) => player.score),
      });
      next.riichi = [false, false, false];
      next.honba = honba + 1;
      if (!dealerTenpai) {
        next.seatOrder = rotateSeatOrder(next);
        advanceRound(next, isOorasu(state) ? "南3局が終了しました" : "");
      } else if (isOorasu(state)) {
        if (isSingleTop(next.players, dealer)) {
          next.gameEnded = true;
          next.endReason = "オーラス親が単独1位のため終了";
        } else if (hand.oorasuAction === "end") {
          next.gameEnded = true;
          next.endReason = "オーラス親が終了を選択";
        }
      }
      next.dealer = dealerOf(next);
      return next;
    }

    const payment = calculatePayment({ ...hand, dealer, seatOrder: next.seatOrder });
    const bonusSettlement = calculateBonusSettlement({ ...hand, dealer });
    const bonus = bonusSettlement.amount;
    const winners = winnersOf(hand);
    const winner = Number(hand.winner);
    const parentWon = isParentContinuationWin({ ...hand, dealer, seatOrder: next.seatOrder }, next);
    const kyotakuWinner = kyotakuWinnerFor({ ...hand, dealer }, next);

    payment.deltas.forEach((delta, index) => {
      next.players[index].score += delta;
    });
    bonusSettlement.deltas.forEach((delta, index) => {
      next.players[index].bonus += delta;
    });
    if (kyotakuWinner !== null && next.kyotaku > 0) {
      next.players[kyotakuWinner].score += next.kyotaku;
    }

    next.history.push({
      ...hand,
      stateBefore,
      roundLabel: handRoundLabel,
      honba,
      dealer,
      seats,
      payment,
      bonus,
      bonusSettlement,
      kyotakuBefore: stateBefore.kyotaku,
      kyotakuWinner,
      kyotakuAfter: 0,
      scores: next.players.map((player) => player.score),
    });

    next.kyotaku = 0;
    next.riichi = [false, false, false];

    if (parentWon) {
      next.honba = honba + 1;
      if (isOorasu(state)) {
        if (isSingleTop(next.players, dealer)) {
          next.gameEnded = true;
          next.endReason = "オーラス親が単独1位のため終了";
        } else if (hand.oorasuAction === "end") {
          next.gameEnded = true;
          next.endReason = "オーラス親が終了を選択";
        }
      }
    } else {
      next.seatOrder = rotateSeatOrder(next);
      advanceRound(next, isOorasu(state) ? "南3局が終了しました" : "");
      next.honba = 0;
    }
    next.dealer = dealerOf(next);

    return next;
  }

  function inferFinishContext(state) {
    const hand = Array.isArray(state.history) ? state.history[state.history.length - 1] : null;
    if (!hand) {
      return { finishType: "", representative: null, hand: null, seatOrder: getSeatOrder(state) };
    }
    if (hand.winType === "tsumo") {
      return { finishType: "singleTsumo", representative: Number(hand.winner), hand, seatOrder: getSeatOrder(hand) };
    }
    if (hand.winType === "ron") {
      return { finishType: "singleRon", representative: Number(hand.winner), hand, seatOrder: getSeatOrder(hand) };
    }
    if (hand.winType === "doubleRon") {
      return {
        finishType: "doubleRon",
        representative: doubleRonBasisWinner(hand, hand),
        hand,
        seatOrder: getSeatOrder(hand),
      };
    }
    if (hand.winType === "draw") {
      const tenpai = normalizeTenpai(hand.tenpai, hand.dealerTenpai, hand.dealer);
      const tenpaiPlayers = [0, 1, 2].filter((index) => tenpai[index]);
      if (tenpaiPlayers.length === 1) {
        return { finishType: "oneTenpai", representative: tenpaiPlayers[0], hand, seatOrder: getSeatOrder(hand) };
      }
      if (tenpaiPlayers.length === 2) {
        return { finishType: "twoTenpai", representative: tenpaiPlayers[0], hand, seatOrder: getSeatOrder(hand) };
      }
    }
    return { finishType: "", representative: null, hand, seatOrder: getSeatOrder(hand) };
  }

  function calculateTobiBonuses({ players, finishType, representative, hand, seatOrder }) {
    const tobi = [0, 0, 0];
    const busted = players
      .map((player, index) => ({ player, index }))
      .filter(({ player }) => player.score <= 0)
      .map(({ index }) => index);
    const rep = Number(representative);

    if (busted.length === 0) {
      return tobi;
    }

    if (finishType === "singleTsumo") {
      const award = busted.length >= 2 ? 2000 : 1000;
      tobi[rep] += award;
      busted.forEach((index) => {
        tobi[index] -= 1000;
      });
      return tobi;
    }

    if (finishType === "singleRon" || finishType === "oneTenpai") {
      const target = busted[0];
      tobi[rep] += 1000;
      tobi[target] -= 1000;
      return tobi;
    }

    if (finishType === "doubleRon" || finishType === "twoTenpai") {
      const target = busted[0];
      const awardTarget =
        finishType === "doubleRon" && hand
          ? doubleRonBasisWinner(hand, { seatOrder: seatOrder || getSeatOrder(hand), dealer: hand.dealer })
          : shimochaOf(seatOrder || hand || target, target);
      tobi[awardTarget] += 1000;
      tobi[target] -= 1000;
    }

    return tobi;
  }

  function rankPlayers(players, initialSeatOrder = [0, 1, 2]) {
    const order = normalizeSeatOrder(initialSeatOrder);
    const priority = new Map(order.map((playerIndex, index) => [playerIndex, index]));
    return players
      .map((player, index) => ({ ...player, index }))
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return (priority.get(a.index) ?? a.index) - (priority.get(b.index) ?? b.index);
      })
      .map((player, order) => ({ ...player, rank: order + 1 }));
  }

  function rankPointFor(rank, score) {
    const base = [-1200, -4500, -6500][rank - 1] || 0;
    return base + score / 10;
  }

  function settleHalf(state, finishType, representative) {
    const kyotaku = normalizeKyotaku(state.kyotaku);
    const settlementPlayers = clonePlayers(state.players);
    const initialOrder = initialSeatOrderOf(state);
    const finishContext = finishType
      ? { finishType, representative: Number(representative), hand: Array.isArray(state.history) ? state.history[state.history.length - 1] : null, seatOrder: getSeatOrder(state) }
      : inferFinishContext(state);
    const topBeforeKyotaku = rankPlayers(settlementPlayers, initialOrder)[0];
    if (topBeforeKyotaku && kyotaku > 0) {
      settlementPlayers[topBeforeKyotaku.index].score += kyotaku;
    }
    const liveTobi = calculateTobiBonuses({
      players: settlementPlayers,
      finishType: finishContext.finishType,
      representative: finishContext.representative,
      hand: finishContext.hand,
      seatOrder: finishContext.seatOrder,
    });
    const ranked = rankPlayers(settlementPlayers, initialOrder);
    return ranked.map((player) => {
      const rankPoint = rankPointFor(player.rank, player.score);
      const tobi = player.tobi + liveTobi[player.index];
      const total = rankPoint + player.bonus + tobi;
      return {
        index: player.index,
        name: player.name,
        score: player.score,
        rank: player.rank,
        rankPoint,
        bonus: player.bonus,
        tobi,
        kyotakuRecovery: topBeforeKyotaku?.index === player.index ? kyotaku : 0,
        total,
      };
    });
  }

  function tileTotal() {
    return TILE_GROUPS.flatMap((group) => group.tiles).reduce((sum, tile) => sum + tile.count, 0);
  }

  function createInitialState(options = {}) {
    const seatOrder = options.seatOrder
      ? normalizeSeatOrder(options.seatOrder)
      : options.randomizeSeats === false
        ? [0, 1, 2]
        : randomSeatOrder();
    return {
      players: clonePlayers(),
      seatOrder,
      initialSeatOrder: [...seatOrder],
      dealer: seatOrder[0],
      dealerTurns: 0,
      gameEnded: false,
      endReason: "",
      honba: 0,
      kyotaku: 0,
      riichi: [false, false, false],
      history: [],
    };
  }

  return {
    SEATS,
    ROUND_SEQUENCE,
    DEALER_TURNS_PER_HALF,
    TILE_GROUPS,
    createInitialState,
    clonePlayers,
    normalizeSeatOrder,
    randomSeatOrder,
    getSeatOrder,
    dealerOf,
    playerAtSeat,
    rotateSeatOrder,
    seatOrderWithDealer,
    seatOrderFromSeatMap,
    initialSeatOrderOf,
    upperPlayerOf,
    shimochaOf,
    seatForPlayer,
    seatMap,
    winnersOf,
    doubleRonBasisWinner,
    isParentContinuationWin,
    kyotakuWinnerFor,
    completedHands,
    completedDealerTurns,
    currentRoundIndex,
    currentRound,
    roundLabel,
    isOorasu,
    isSingleTop,
    halfFinishReason,
    isHalfFinished,
    seatCounts,
    calculatePayment,
    calculateBonus,
    calculateBonusSettlement,
    calculateDrawPayment,
    normalizeTenpai,
    applyRiichi,
    cancelRiichi,
    applyHand,
    calculateTobiBonuses,
    inferFinishContext,
    rankPlayers,
    settleHalf,
    tileTotal,
    tableValue,
  };
});
