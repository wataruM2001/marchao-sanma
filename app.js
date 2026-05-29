(function () {
  "use strict";

  const Rules = window.MahjongRules;
  const Tiles = window.MahjongTiles;
  const Game = window.MahjongGame;
  const STORAGE_KEY = "marchao-sanma-score-table-v1";
  const BATTLE_EFFECT_DURATION_MS = 1200;
  const YAKUMAN_EFFECT_DURATION_MS = 1500;
  const RESULT_TRANSITION_DELAY_MS = YAKUMAN_EFFECT_DURATION_MS;
  const EFFECT_SCREEN_MARGIN = 16;
  const EFFECT_PANEL_MARGIN = 16;
  const AUTO_DISCARD_DELAY_MS = 1300;
  const CPU_DISCARD_DELAY_MS = 1500;
  const RIICHI_AUTO_DISCARD_DELAY_MS = AUTO_DISCARD_DELAY_MS;
  const AFTER_DISCARD_REACTION_DELAY_MS = 50;
  const PAIFU_REPLAY_INTERVAL_MS = 1000;
  const PAIFU_STORAGE_KEY = "marchao-sanma-last-paifu-v1";
  const STATS_STORAGE_KEY = "marchaoSanmaStatsV1";
  const IN_PROGRESS_STORAGE_KEY = "marchaoSanmaInProgressV1";
  const SOUND_SETTINGS_STORAGE_KEY = "marchaoSanmaSoundSettingsV1";
  const SOUND_FILES = {
    startGame: "./sounds/button_decide.mp3",
    discard: "./sounds/discard.mp3",
    skipPrompt: "./sounds/button_cancel.mp3",
    screenTransition: "./sounds/button_decide.mp3",
    riichi: "./sounds/riichi.mp3",
    pon: "./sounds/pon.mp3",
    kan: "./sounds/kan.mp3",
    tsumo: "./sounds/tsumo.mp3",
    ron: "./sounds/ron.mp3",
  };
  const SOUND_VOLUME = {
    startGame: 0.55,
    discard: 0.225,
    skipPrompt: 0.45,
    screenTransition: 0.45,
    riichi: 0.6,
    pon: 0.6,
    kan: 0.6,
    tsumo: 0.975,
    ron: 0.975,
  };
  const SOUND_CATEGORY = {
    startGame: "soundEffect",
    discard: "soundEffect",
    skipPrompt: "soundEffect",
    screenTransition: "soundEffect",
    riichi: "voice",
    pon: "voice",
    kan: "voice",
    tsumo: "voice",
    ron: "voice",
  };
  const STATS_HISTORY_PAGE_SIZE = 10;
  const STATS_RANKING_LIMIT = 10;
  const STATS_RANKING_METRICS = {
    hanchan_count: { label: "\u534a\u8358\u6570", format: "plain", direction: "desc" },
    average_settlement_point: { label: "\u5e73\u5747\u53ce\u652f", format: "signed", direction: "desc" },
    average_rank: { label: "\u5e73\u5747\u7740\u9806", format: "rank", direction: "asc" },
    average_final_raw_score: { label: "\u5e73\u5747\u7d20\u70b9", format: "plain", direction: "desc" },
    average_chip_count: { label: "\u5e73\u5747\u795d\u5100", format: "signed", direction: "desc" },
    win_rate: { label: "\u548c\u4e86\u7387", format: "percent", direction: "desc" },
  };
  const APP_VERSION = "shared-paifu-url-v1";
  const RULES_VERSION = "marchao-sanma-v1";
  const RESULT_YAKU_NAME_MAP = {
    riichi: "立直",
    double_riichi: "ダブル立直",
    ippatsu: "一発",
    rinshan_kaihou: "嶺上開花",
    rinshan: "嶺上開花",
    chankan: "槍槓",
    haitei: "海底撈月",
    houtei: "河底撈魚",
    menzen_tsumo: "ツモ",
    tanyao: "断么九",
    pinfu: "平和",
    iipeiko: "一盃口",
    iipeikou: "一盃口",
    ryanpeiko: "二盃口",
    ryanpeikou: "二盃口",
    yakuhai_white: "役牌 白",
    yakuhai_green: "役牌 發",
    yakuhai_red: "役牌 中",
    yakuhai_north: "役牌 北",
    yakuhai_east: "役牌 東",
    yakuhai_south: "役牌 南",
    yakuhai_west: "役牌 西",
    round_wind: "場風牌",
    seat_wind: "自風牌",
    toitoi: "対対和",
    sananko: "三暗刻",
    sanankou: "三暗刻",
    sanshoku_doko: "三色同刻",
    sanshoku_doukou: "三色同刻",
    sankantsu: "三槓子",
    shosangen: "小三元",
    shousangen: "小三元",
    honroto: "混老頭",
    honroutou: "混老頭",
    chiitoitsu: "七対子",
    chanta: "混全帯么九",
    junchan: "純全帯么九",
    ittsu: "一気通貫",
    ittsuu: "一気通貫",
    honitsu: "混一色",
    chinitsu: "清一色",
    kokushi: "国士無双",
    churen: "九連宝燈",
    suanko: "四暗刻",
    suuanko: "四暗刻",
    daisangen: "大三元",
    shosushi: "小四喜",
    daisushi: "大四喜",
    tsuiso: "字一色",
    chinroto: "清老頭",
    ryuiso: "緑一色",
    sukantsu: "四槓子",
    manhon: "萬混",
    daisharin: "大車輪",
    nagashi_yakuman: "流し役満",
    kazoe_yakuman: "数え役満",
  };
  let state = loadState();
  let battleState = null;
  let appScreen = "start";
  let soundEnabled = false;
  let soundSettings = loadSoundSettings();
  let lastSoundScreen = "start";
  let suppressNextScreenTransitionSound = false;
  let lastSkipPromptSoundSignature = "";
  let lastHandResult = null;
  let battleSettlement = null;
  let cpuTurnTimer = 0;
  let pendingCpuDiscard = null;
  let riichiAutoDiscardTimer = 0;
  let afterDiscardTimer = 0;
  let resultTransitionTimer = 0;
  let battleEffectTimer = 0;
  let activeBattleEffect = null;
  let battleEffectQueue = [];
  let lastBattleEffectSignature = "";
  let settlementBreakdownVisible = false;
  let resultTransparent = false;
  let lastLandscapeBlankTapTime = 0;
  let paifuReplay = null;
  let paifuHandIndex = 0;
  let paifuStepIndex = 0;
  let paifuReplayTimer = 0;
  let showPaifuOpponentHands = false;
  let lastPaifuSnapshotSignature = "";
  let lastSavedStatsHanchanId = "";
  let statsRecentCount = 10;
  let statsHistoryPage = 1;
  let statsResetConfirmVisible = false;
  let statsSelectedYear = new Date().getFullYear();
  let statsSelectedMonth = new Date().getMonth() + 1;
  let statsSupabaseRecords = [];
  let statsSupabaseLoadState = "idle";
  let statsSupabaseStatusText = "読み込み前";
  let statsDataSourceStatusText = "表示中：端末内成績";
  let statsRankingRows = [];
  let statsRankingStatusText = "読み込み前";
  let statsRankingKind = "average_settlement_point";
  let statsRankingMinHanchanCount = 1;
  let statsPaifuUrlByHanchanId = {};
  let statsPaifuCopyStatusText = "";
  let statsPaifuCopyStatusIsError = false;
  let statsOnlineLoadToken = 0;
  let isViewingSharedPaifu = false;
  let currentSharedPaifuUrl = "";
  let isSettlementPreview = false;
  let isFuroDebugScenario = false;
  let authSession = null;
  let authUser = null;
  let authMessageText = "";
  let authMessageIsError = false;
  let authSubscription = null;
  let settingsDisplayName = "";
  let settingsMessageText = "";
  let settingsMessageIsError = false;
  let settingsSaveInProgress = false;

  const els = {
    undoButton: document.getElementById("undoButton"),
    resetButton: document.getElementById("resetButton"),
    authPanel: document.getElementById("authPanel"),
    authStatus: document.getElementById("authStatus"),
    authForm: document.getElementById("authForm"),
    authEmailInput: document.getElementById("authEmailInput"),
    authLoginButton: document.getElementById("authLoginButton"),
    authLogoutButton: document.getElementById("authLogoutButton"),
    authMessage: document.getElementById("authMessage"),
    battleTable: document.getElementById("battleTable"),
    battleSurface: document.querySelector(".battle-surface"),
    battleEffect: document.getElementById("battleEffect"),
    battleResultPanel: document.getElementById("battleResultPanel"),
    battleResultTitle: document.getElementById("battleResultTitle"),
    battleResultBody: document.getElementById("battleResultBody"),
    battleConfirmButton: document.getElementById("battleConfirmButton"),
    battleContinueButton: document.getElementById("battleContinueButton"),
    battleEndButton: document.getElementById("battleEndButton"),
    battleTransparentButton: document.getElementById("battleTransparentButton"),
    battleSettlementPanel: document.getElementById("battleSettlementPanel"),
    battleSettlementBody: document.getElementById("battleSettlementBody"),
    battleSettlementDetailButton: document.getElementById("battleSettlementDetailButton"),
    battlePaifuButton: document.getElementById("battlePaifuButton"),
    battleSharePaifuButton: document.getElementById("battleSharePaifuButton"),
    battleCopyPaifuUrlButton: document.getElementById("battleCopyPaifuUrlButton"),
    battleSharePaifuStatus: document.getElementById("battleSharePaifuStatus"),
    battleRestartButton: document.getElementById("battleRestartButton"),
    paifuPanel: document.getElementById("paifuPanel"),
    paifuTitle: document.getElementById("paifuTitle"),
    paifuStepLabel: document.getElementById("paifuStepLabel"),
    paifuActionText: document.getElementById("paifuActionText"),
    paifuPrevHandButton: document.getElementById("paifuPrevHandButton"),
    paifuPrevSelfDrawButton: document.getElementById("paifuPrevSelfDrawButton"),
    paifuPrevButton: document.getElementById("paifuPrevButton"),
    paifuNextButton: document.getElementById("paifuNextButton"),
    paifuNextSelfDrawButton: document.getElementById("paifuNextSelfDrawButton"),
    paifuNextHandButton: document.getElementById("paifuNextHandButton"),
    paifuToggleHandsButton: document.getElementById("paifuToggleHandsButton"),
    paifuBackButton: document.getElementById("paifuBackButton"),
    rulesScreen: document.getElementById("rulesScreen"),
    rulesBackButton: document.getElementById("rulesBackButton"),
    startRulesButton: document.getElementById("startRulesButton"),
    startStatsButton: document.getElementById("startStatsButton"),
    startSettingsButton: document.getElementById("startSettingsButton"),
    statsScreen: document.getElementById("statsScreen"),
    statsBackButton: document.getElementById("statsBackButton"),
    statsEmptyMessage: document.getElementById("statsEmptyMessage"),
    statsContent: document.getElementById("statsContent"),
    statsRecentCountInput: document.getElementById("statsRecentCountInput"),
    statsYearSelect: document.getElementById("statsYearSelect"),
    statsMonthSelect: document.getElementById("statsMonthSelect"),
    statsDataSourceStatus: document.getElementById("statsDataSourceStatus"),
    statsSummaryTable: document.getElementById("statsSummaryTable"),
    statsHistoryTable: document.getElementById("statsHistoryTable"),
    statsPaifuCopyStatus: document.getElementById("statsPaifuCopyStatus"),
    statsSupabaseStatus: document.getElementById("statsSupabaseStatus"),
    statsSupabaseTable: document.getElementById("statsSupabaseTable"),
    statsRankingStatus: document.getElementById("statsRankingStatus"),
    statsRankingKindSelect: document.getElementById("statsRankingKindSelect"),
    statsRankingMinInput: document.getElementById("statsRankingMinInput"),
    statsRankingTable: document.getElementById("statsRankingTable"),
    statsPrevPageButton: document.getElementById("statsPrevPageButton"),
    statsNextPageButton: document.getElementById("statsNextPageButton"),
    statsPageLabel: document.getElementById("statsPageLabel"),
    statsResetButton: document.getElementById("statsResetButton"),
    statsResetConfirm: document.getElementById("statsResetConfirm"),
    statsResetCancelButton: document.getElementById("statsResetCancelButton"),
    statsResetConfirmButton: document.getElementById("statsResetConfirmButton"),
    settingsScreen: document.getElementById("settingsScreen"),
    settingsBackButton: document.getElementById("settingsBackButton"),
    settingsDisplayNameInput: document.getElementById("settingsDisplayNameInput"),
    settingsSaveNameButton: document.getElementById("settingsSaveNameButton"),
    settingsMessage: document.getElementById("settingsMessage"),
    soundSettingButtons: Array.from(document.querySelectorAll("[data-sound-setting]")),
    resumeRequiredScreen: document.getElementById("resumeRequiredScreen"),
    resumeRequiredButton: document.getElementById("resumeRequiredButton"),
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
    battleLandscapeRoundInfo: document.getElementById("battleLandscapeRoundInfo"),
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
    initializeAuth();
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("preview") === "settlement") {
      setupSettlementPreview();
    } else if (urlParams.get("paifu")) {
      loadSharedPaifuFromUrl();
    } else if (urlParams.get("debug") === "furo-test-2meld") {
      setupFuroTestScenario();
    } else if (urlParams.get("debug") === "kakan-test-1each") {
      setupKakanTestScenario();
    } else if (urlParams.get("debug") === "kamicha-kakan-test") {
      setupKamichaKakanTestScenario();
    } else if (urlParams.get("debug") === "self-kakan-test") {
      setupSelfKakanTestScenario();
    } else if (hasInProgressHanchanSave()) {
      appScreen = "resume";
    }
    render();
  }

  function setupSettlementPreview() {
    if (!Game) return;
    isFuroDebugScenario = false;
    isSettlementPreview = true;
    isViewingSharedPaifu = false;
    currentSharedPaifuUrl = "";
    appScreen = "settlement";
    lastHandResult = null;
    settlementBreakdownVisible = false;
    resultTransparent = false;
    clearCpuTurnTimer();
    clearRiichiAutoDiscardTimer();
    clearAfterDiscardTimer();
    clearResultTransitionTimer();
    resetBattleEffectState();
    const startedAt = new Date().toISOString();
    paifuReplay = {
      ...createPaifuReplay(),
      id: "settlement_preview",
      startedAt,
      endedAt: startedAt,
    };
    paifuHandIndex = 0;
    paifuStepIndex = 0;
    lastPaifuSnapshotSignature = "";
    battleState = createBattleHand({
      dealerIndex: 0,
      initialDealerIndex: 0,
      roundWind: "east",
      handNumber: 1,
      honba: 0,
      kyotaku: 1,
    });
    normalizeHanchanTimingFields(battleState, startedAt);
    recordPaifuSnapshot(battleState, "deal", "Settlement preview");
    battleSettlement = [
      {
        index: 0,
        name: "player1",
        rank: 1,
        points: 52300,
        basePointScore: 12.3,
        uma: 20,
        oka: 15,
        specialAdjustment: -7,
        tobi: 0,
        chipScore: 20,
        internalFinalPoint: 60.3,
        displayFinalPoint: 6030,
        kyotakuRecovery: 1000,
      },
      {
        index: 1,
        name: "player2",
        rank: 2,
        points: 31800,
        basePointScore: -8.2,
        uma: 0,
        oka: 0,
        specialAdjustment: -5,
        tobi: 0,
        chipScore: -10,
        internalFinalPoint: -23.2,
        displayFinalPoint: -2320,
        kyotakuRecovery: 0,
      },
      {
        index: 2,
        name: "player3",
        rank: 3,
        points: 20900,
        basePointScore: -19.1,
        uma: -20,
        oka: 0,
        specialAdjustment: -5,
        tobi: 0,
        chipScore: -10,
        internalFinalPoint: -54.1,
        displayFinalPoint: -5410,
        kyotakuRecovery: 0,
      },
    ];
  }

  function setupFuroTestScenario() {
    if (!Game || !Tiles?.createTiles) return;
    isFuroDebugScenario = true;
    isSettlementPreview = false;
    isViewingSharedPaifu = false;
    currentSharedPaifuUrl = "";
    appScreen = "playing";
    lastHandResult = null;
    battleSettlement = null;
    settlementBreakdownVisible = false;
    resultTransparent = false;
    clearCpuTurnTimer();
    clearRiichiAutoDiscardTimer();
    clearAfterDiscardTimer();
    clearResultTransitionTimer();
    resetBattleEffectState();

    const pool = Tiles.createTiles().map((tile) => ({ ...tile }));
    const takeTile = (kindId) => {
      const index = pool.findIndex((tile) => Tiles.tileKindId(tile) === kindId);
      if (index < 0) throw new Error(`Debug tile not found: ${kindId}`);
      return pool.splice(index, 1)[0];
    };
    const takeTiles = (kindIds) => kindIds.map(takeTile);
    const calledFromSeatForDebug = (playerIndex, fromPlayerIndex) => {
      if (fromPlayerIndex === (playerIndex + 2) % 3) return "kamicha";
      if (fromPlayerIndex === (playerIndex + 1) % 3) return "shimocha";
      return "toimen";
    };
    const makePonMeld = (playerIndex, fromPlayerIndex, kindId, suffix) => {
      const calledTile = takeTile(kindId);
      const handTiles = takeTiles([kindId, kindId]);
      const calledFromSeat = calledFromSeatForDebug(playerIndex, fromPlayerIndex);
      return {
        id: `debug_pon_${kindId}_${suffix}`,
        type: "pon",
        baseId: calledTile.baseId,
        tiles: calledFromSeat === "kamicha" ? [calledTile, ...handTiles] : [...handTiles, calledTile],
        calledTile,
        calledFrom: Game.PLAYER_SEATS?.[fromPlayerIndex] || "",
        calledFromSeat,
        fromPlayerIndex,
      };
    };

    const startedAt = new Date().toISOString();
    paifuReplay = {
      ...createPaifuReplay(),
      id: "furo_test_2meld",
      startedAt,
      endedAt: "",
    };
    paifuHandIndex = 0;
    paifuStepIndex = 0;
    lastPaifuSnapshotSignature = "";

    battleState = Game.startNewHand({
      playerNames: battlePlayerNames(),
      dealerIndex: 0,
      initialDealerIndex: 0,
      roundWind: "east",
      handNumber: 1,
      honba: 0,
      kyotaku: 0,
    });

    const self = battleState.players[0];
    const shimocha = battleState.players[1];
    const kamicha = battleState.players[2];

    self.hand = takeTiles(["m1", "p1", "p2", "p4", "p5_red", "p5_blue", "p6", "p7", "p9", "s1", "s2", "s3", "east", "white"]);
    shimocha.hand = takeTiles(["m9", "p6", "p7", "s1", "s2", "north", "green"]);
    kamicha.hand = takeTiles(["m1", "p2", "p4", "s4", "s6", "west", "red"]);

    self.discards = takeTiles(["s8", "south", "p8", "s9", "north", "p1"]).map((tile) => ({ tile }));
    shimocha.discards = takeTiles(["p2", "s2", "m9", "white", "p7", "s1"]).map((tile) => ({ tile }));
    kamicha.discards = takeTiles(["s3", "p4", "east", "green", "p9", "s7"]).map((tile) => ({ tile }));

    shimocha.melds = [
      makePonMeld(1, 0, "p3", "from_self"),
      makePonMeld(1, 2, "s7", "from_kamicha"),
    ];
    kamicha.melds = [
      makePonMeld(2, 0, "south", "from_self"),
      makePonMeld(2, 1, "p8", "from_shimocha"),
    ];
    self.melds = [];

    battleState.dealTiles = [];
    battleState.doraIndicators = [takeTile("red")];
    battleState.uraDoraIndicators = [takeTile("white")];
    battleState.rinshanTiles = takeTiles(["flower_red", "flower_blue", "p9", "s9"]);
    battleState.drawWall = pool;
    battleState.wall = pool.map((tile) => ({ ...tile }));
    battleState.remainingDraws = battleState.drawWall.length;
    battleState.currentPlayerIndex = 0;
    battleState.phase = "discard";
    battleState.lastAction = {
      type: "draw",
      playerIndex: 0,
      tileId: self.hand[self.hand.length - 1]?.id || "",
    };
    battleState.lastEffect = "";
    battleState.pendingAction = null;
    battleState.pendingRiichi = null;
    battleState.debugScenario = "furo-test-2meld";
    normalizeHanchanTimingFields(battleState, startedAt);
  }

  function setupKakanTestScenario() {
    if (!Game || !Tiles?.createTiles) return;
    isFuroDebugScenario = true;
    isSettlementPreview = false;
    isViewingSharedPaifu = false;
    currentSharedPaifuUrl = "";
    appScreen = "playing";
    lastHandResult = null;
    battleSettlement = null;
    settlementBreakdownVisible = false;
    resultTransparent = false;
    clearCpuTurnTimer();
    clearRiichiAutoDiscardTimer();
    clearAfterDiscardTimer();
    clearResultTransitionTimer();
    resetBattleEffectState();

    const pool = Tiles.createTiles().map((tile) => ({ ...tile }));
    const takeTile = (kindId) => {
      const index = pool.findIndex((tile) => Tiles.tileKindId(tile) === kindId);
      if (index < 0) throw new Error(`Debug tile not found: ${kindId}`);
      return pool.splice(index, 1)[0];
    };
    const takeTiles = (kindIds) => kindIds.map(takeTile);
    const calledFromSeatForDebug = (playerIndex, fromPlayerIndex) => {
      if (fromPlayerIndex === (playerIndex + 2) % 3) return "kamicha";
      if (fromPlayerIndex === (playerIndex + 1) % 3) return "shimocha";
      return "toimen";
    };
    const makeKakanMeld = (playerIndex, fromPlayerIndex, kindId, suffix) => {
      const calledTile = takeTile(kindId);
      const handTiles = takeTiles([kindId, kindId]);
      const addedTile = takeTile(kindId);
      const calledFromSeat = calledFromSeatForDebug(playerIndex, fromPlayerIndex);
      const ponTiles = calledFromSeat === "kamicha"
        ? [calledTile, ...handTiles]
        : [...handTiles, calledTile];
      return {
        id: `debug_kakan_${kindId}_${suffix}`,
        type: "kakan",
        baseId: calledTile.baseId,
        tiles: [...ponTiles, addedTile],
        calledTile,
        addedTile,
        calledFrom: Game.PLAYER_SEATS?.[fromPlayerIndex] || "",
        calledFromSeat,
        fromPlayerIndex,
      };
    };

    const startedAt = new Date().toISOString();
    paifuReplay = {
      ...createPaifuReplay(),
      id: "kakan_test_1each",
      startedAt,
      endedAt: "",
    };
    paifuHandIndex = 0;
    paifuStepIndex = 0;
    lastPaifuSnapshotSignature = "";

    battleState = Game.startNewHand({
      playerNames: battlePlayerNames(),
      dealerIndex: 0,
      initialDealerIndex: 0,
      roundWind: "east",
      handNumber: 1,
      honba: 0,
      kyotaku: 0,
    });

    const self = battleState.players[0];
    const shimocha = battleState.players[1];
    const kamicha = battleState.players[2];

    self.hand = takeTiles(["m1", "m9", "p1", "p4", "p5_red", "p5_blue", "p6", "s1", "s2", "s3", "east"]);
    shimocha.hand = takeTiles(["p8", "p3", "p7", "s1", "s2", "s6", "north", "white", "green"]);
    kamicha.hand = takeTiles(["p1", "p6", "p9", "s2", "s3", "s7", "west", "red", "north"]);

    self.discards = takeTiles(["s8", "p3", "p8", "s9", "white", "p7"]).map((tile) => ({ tile }));
    shimocha.discards = takeTiles(["p3", "s5_red", "m9", "green", "p9", "s1"]).map((tile) => ({ tile }));
    kamicha.discards = takeTiles(["s6", "p4", "east", "m9", "m1", "s7"]).map((tile) => ({ tile }));

    self.melds = [
      makeKakanMeld(0, 1, "p2", "self_from_shimocha"),
    ];
    shimocha.melds = [
      makeKakanMeld(1, 0, "s4", "shimocha_from_self"),
    ];
    kamicha.melds = [
      makeKakanMeld(2, 1, "south", "kamicha_from_shimocha"),
    ];

    battleState.dealTiles = [];
    battleState.doraIndicators = [takeTile("red")];
    battleState.uraDoraIndicators = [takeTile("white")];
    battleState.rinshanTiles = takeTiles(["flower_red", "flower_blue", "p9", "s9"]);
    battleState.drawWall = pool;
    battleState.wall = pool.map((tile) => ({ ...tile }));
    battleState.remainingDraws = battleState.drawWall.length;
    battleState.currentPlayerIndex = 0;
    battleState.phase = "discard";
    battleState.lastAction = {
      type: "draw",
      playerIndex: 0,
      tileId: self.hand[self.hand.length - 1]?.id || "",
    };
    battleState.lastEffect = "";
    battleState.pendingAction = null;
    battleState.pendingRiichi = null;
    battleState.debugScenario = "kakan-test-1each";
    normalizeHanchanTimingFields(battleState, startedAt);
  }

  function setupSelfKakanTestScenario() {
    if (!Game || !Tiles?.createTiles) return;
    isFuroDebugScenario = true;
    isSettlementPreview = false;
    isViewingSharedPaifu = false;
    currentSharedPaifuUrl = "";
    appScreen = "playing";
    lastHandResult = null;
    battleSettlement = null;
    settlementBreakdownVisible = false;
    resultTransparent = false;
    clearCpuTurnTimer();
    clearRiichiAutoDiscardTimer();
    clearAfterDiscardTimer();
    clearResultTransitionTimer();
    resetBattleEffectState();

    const pool = Tiles.createTiles().map((tile) => ({ ...tile }));
    const takeTile = (kindId) => {
      const index = pool.findIndex((tile) => Tiles.tileKindId(tile) === kindId);
      if (index < 0) throw new Error(`Debug tile not found: ${kindId}`);
      return pool.splice(index, 1)[0];
    };
    const takeTiles = (kindIds) => kindIds.map(takeTile);
    const calledFromSeatForDebug = (playerIndex, fromPlayerIndex) => {
      if (fromPlayerIndex === (playerIndex + 2) % 3) return "kamicha";
      if (fromPlayerIndex === (playerIndex + 1) % 3) return "shimocha";
      return "toimen";
    };
    const makeKakanMeld = (playerIndex, fromPlayerIndex, kindId, suffix) => {
      const calledTile = takeTile(kindId);
      const handTiles = takeTiles([kindId, kindId]);
      const addedTile = takeTile(kindId);
      const calledFromSeat = calledFromSeatForDebug(playerIndex, fromPlayerIndex);
      const ponTiles = calledFromSeat === "kamicha"
        ? [calledTile, ...handTiles]
        : [...handTiles, calledTile];
      return {
        id: `debug_self_kakan_${kindId}_${suffix}`,
        type: "kakan",
        baseId: calledTile.baseId,
        tiles: [...ponTiles, addedTile],
        calledTile,
        addedTile,
        calledFrom: Game.PLAYER_SEATS?.[fromPlayerIndex] || "",
        calledFromSeat,
        fromPlayerIndex,
      };
    };

    const startedAt = new Date().toISOString();
    paifuReplay = {
      ...createPaifuReplay(),
      id: "self_kakan_test",
      startedAt,
      endedAt: "",
    };
    paifuHandIndex = 0;
    paifuStepIndex = 0;
    lastPaifuSnapshotSignature = "";

    battleState = Game.startNewHand({
      playerNames: battlePlayerNames(),
      dealerIndex: 0,
      initialDealerIndex: 0,
      roundWind: "east",
      handNumber: 1,
      honba: 0,
      kyotaku: 0,
    });

    const self = battleState.players[0];
    const shimocha = battleState.players[1];
    const kamicha = battleState.players[2];

    self.hand = takeTiles(["m1", "m9", "p1", "p4", "p5_red", "p5_blue", "p6", "s1", "s2", "s3", "east"]);
    shimocha.hand = takeTiles(["p8", "p3", "p7", "s1", "s2", "s6", "north", "white", "green", "red", "west", "m1", "p9"]);
    kamicha.hand = takeTiles(["p1", "p6", "p9", "s2", "s3", "s7", "west", "red", "north", "south", "green", "m9", "p8"]);

    self.discards = takeTiles(["s8", "p3", "p8", "s9", "white", "p7"]).map((tile) => ({ tile }));
    shimocha.discards = takeTiles(["p3", "s5_red", "m9", "green", "p9", "s1"]).map((tile) => ({ tile }));
    kamicha.discards = takeTiles(["s6", "p4", "east", "m9", "m1", "s7"]).map((tile) => ({ tile }));

    self.melds = [
      makeKakanMeld(0, 1, "p2", "from_shimocha"),
    ];
    shimocha.melds = [];
    kamicha.melds = [];

    battleState.dealTiles = [];
    battleState.doraIndicators = [takeTile("red")];
    battleState.uraDoraIndicators = [takeTile("white")];
    battleState.rinshanTiles = takeTiles(["flower_red", "flower_blue", "p9", "s9"]);
    battleState.drawWall = pool;
    battleState.wall = pool.map((tile) => ({ ...tile }));
    battleState.remainingDraws = battleState.drawWall.length;
    battleState.currentPlayerIndex = 0;
    battleState.phase = "discard";
    battleState.lastAction = {
      type: "draw",
      playerIndex: 0,
      tileId: self.hand[self.hand.length - 1]?.id || "",
    };
    battleState.lastEffect = "";
    battleState.pendingAction = null;
    battleState.pendingRiichi = null;
    battleState.debugScenario = "self-kakan-test";
    normalizeHanchanTimingFields(battleState, startedAt);
  }

  function setupKamichaKakanTestScenario() {
    setupKakanTestScenario();
    if (!battleState?.players) return;
    battleState.players[0].melds = [];
    battleState.players[1].melds = [];
    battleState.debugScenario = "kamicha-kakan-test";
    if (paifuReplay) {
      paifuReplay.id = "kamicha_kakan_test";
    }
  }

  async function initializeAuth() {
    renderAuthPanel();
    const api = window.authApi;
    if (!api?.isConfigured?.()) {
      authMessageText = "Supabase Auth未設定";
      authMessageIsError = true;
      renderAuthPanel();
      return;
    }
    try {
      const result = await api.ensureSupabaseUser?.() || await api.getSession();
      if (result?.ok) {
        authSession = result.session || null;
        authUser = result.user || authSession?.user || null;
        if (authUser?.id) {
          api.ensureUserProfile?.(authUser).catch((error) => {
            console.error("Supabase profile creation failed", error);
          });
        }
        if (result.anonymousCreated) {
          authMessageText = "匿名ユーザーでランキング参加中";
          authMessageIsError = false;
        }
      } else if (result) {
        authMessageText = result.reason || "匿名ログインに失敗しました";
        authMessageIsError = true;
      }
    } catch (error) {
      authMessageText = "Auth状態を取得できませんでした";
      authMessageIsError = true;
    }
    if (!authSubscription) {
      authSubscription = api.onAuthStateChange?.((event, session) => {
        authSession = session || null;
        authUser = session?.user || null;
        if (event === "SIGNED_IN" && authUser?.id) {
          api.ensureUserProfile?.(authUser).catch((error) => {
            console.error("Supabase profile creation failed", error);
          });
        }
        if (event === "SIGNED_IN") {
          authMessageText = "ログインしました";
          authMessageIsError = false;
        } else if (event === "SIGNED_OUT") {
          authMessageText = "ログアウトしました";
          authMessageIsError = false;
        }
        renderAuthPanel();
      }) || null;
    }
    renderAuthPanel();
  }

  function authUserEmail() {
    return authUser?.email || authSession?.user?.email || "";
  }

  function authUserDisplayName() {
    const email = authUserEmail();
    if (email) return email;
    const userId = authUser?.id || authSession?.user?.id || "";
    if (userId) return `匿名ユーザー${String(userId).slice(-4)}`;
    return "未ログイン";
  }

  function renderAuthPanel() {
    if (!els.authPanel) return;
    const email = authUserEmail();
    const isSignedIn = Boolean(authUser?.id || authSession?.user?.id);
    setTextIfChanged(els.authStatus, isSignedIn ? email : "未ログイン");
    setTextIfChanged(els.authStatus, authUserDisplayName());
    setHiddenIfChanged(els.authForm, isSignedIn);
    setHiddenIfChanged(els.authLogoutButton, !isSignedIn);
    if (els.authLoginButton) els.authLoginButton.disabled = false;
    if (els.authEmailInput && !isSignedIn) els.authEmailInput.disabled = false;
    if (els.authMessage) {
      setTextIfChanged(els.authMessage, authMessageText);
      els.authMessage.classList.toggle("is-error", Boolean(authMessageIsError));
      setHiddenIfChanged(els.authMessage, !authMessageText);
    }
  }

  async function handleAuthLogin() {
    const api = window.authApi;
    if (!api?.signInWithEmail) {
      authMessageText = "Supabase Authを読み込めませんでした";
      authMessageIsError = true;
      renderAuthPanel();
      return;
    }
    const email = els.authEmailInput?.value || "";
    if (els.authLoginButton) els.authLoginButton.disabled = true;
    if (els.authEmailInput) els.authEmailInput.disabled = true;
    authMessageText = "ログインメールを送信中...";
    authMessageIsError = false;
    renderAuthPanel();
    const result = await api.signInWithEmail(email);
    if (result?.ok) {
      authMessageText = "ログイン用メールを送信しました";
      authMessageIsError = false;
    } else {
      authMessageText = result?.reason || "ログインメールを送信できませんでした";
      authMessageIsError = true;
    }
    if (els.authLoginButton) els.authLoginButton.disabled = false;
    if (els.authEmailInput) els.authEmailInput.disabled = false;
    renderAuthPanel();
  }

  async function handleAuthLogout() {
    const api = window.authApi;
    if (!api?.signOut) return;
    if (els.authLogoutButton) els.authLogoutButton.disabled = true;
    const result = await api.signOut();
    if (!result?.ok) {
      authMessageText = result?.reason || "ログアウトできませんでした";
      authMessageIsError = true;
    } else {
      authSession = null;
      authUser = null;
      authMessageText = "ログアウトしました";
      authMessageIsError = false;
    }
    if (els.authLogoutButton) els.authLogoutButton.disabled = false;
    renderAuthPanel();
  }

  function defaultDisplayNameForUser(user = authUser || authSession?.user || null) {
    const userId = user?.id || "";
    return userId ? `\u533f\u540d\u30e6\u30fc\u30b6\u30fc${String(userId).slice(-4)}` : "\u533f\u540d\u30e6\u30fc\u30b6\u30fc";
  }

  function defaultSoundSettings() {
    return {
      soundEffectsEnabled: true,
      voiceEffectsEnabled: true,
    };
  }

  function loadSoundSettings() {
    try {
      const raw = localStorage.getItem(SOUND_SETTINGS_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      return {
        soundEffectsEnabled: parsed?.soundEffectsEnabled !== false,
        voiceEffectsEnabled: parsed?.voiceEffectsEnabled !== false,
      };
    } catch (error) {
      console.warn("sound settings load failed", error);
      return defaultSoundSettings();
    }
  }

  function saveSoundSettings() {
    try {
      localStorage.setItem(SOUND_SETTINGS_STORAGE_KEY, JSON.stringify(soundSettings));
    } catch (error) {
      console.warn("sound settings save failed", error);
    }
  }

  function updateSoundSetting(key, enabled) {
    if (!Object.prototype.hasOwnProperty.call(defaultSoundSettings(), key)) return;
    soundSettings = {
      ...soundSettings,
      [key]: Boolean(enabled),
    };
    saveSoundSettings();
    renderSettingsScreen();
  }

  function renderSoundSettingButtons() {
    els.soundSettingButtons.forEach((button) => {
      const key = button.dataset.soundSetting;
      const value = button.dataset.soundValue === "true";
      const isActive = Boolean(soundSettings?.[key]) === value;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    });
  }

  function renderSettingsScreen() {
    if (els.settingsDisplayNameInput && document.activeElement !== els.settingsDisplayNameInput) {
      els.settingsDisplayNameInput.value = settingsDisplayName || "";
    }
    renderSoundSettingButtons();
    if (els.settingsSaveNameButton) {
      els.settingsSaveNameButton.disabled = Boolean(settingsSaveInProgress);
    }
    if (els.settingsMessage) {
      setTextIfChanged(els.settingsMessage, settingsMessageText);
      els.settingsMessage.classList.toggle("is-error", Boolean(settingsMessageIsError));
      setHiddenIfChanged(els.settingsMessage, !settingsMessageText);
    }
  }

  async function loadSettingsProfile() {
    const api = window.authApi;
    if (!api?.getUserProfile) {
      settingsMessageText = "Supabase Authを読み込めませんでした";
      settingsMessageIsError = true;
      renderSettingsScreen();
      return;
    }
    settingsMessageText = "ユーザー情報を読み込み中...";
    settingsMessageIsError = false;
    renderSettingsScreen();
    const result = await api.getUserProfile();
    if (result?.ok) {
      authUser = result.user || authUser;
      settingsDisplayName = result.data?.display_name || defaultDisplayNameForUser(result.user);
      settingsMessageText = "";
      settingsMessageIsError = false;
    } else {
      settingsDisplayName = defaultDisplayNameForUser();
      settingsMessageText = result?.reason || "ユーザー情報を取得できませんでした";
      settingsMessageIsError = true;
    }
    renderSettingsScreen();
    renderAuthPanel();
  }

  function openSettingsScreen() {
    settingsMessageText = "";
    settingsMessageIsError = false;
    settingsSaveInProgress = false;
    appScreen = "settings";
    renderBattleTable();
    loadSettingsProfile();
  }

  async function handleSaveSettingsDisplayName() {
    const api = window.authApi;
    const rawName = els.settingsDisplayNameInput?.value || "";
    const trimmed = rawName.trim();
    if (!trimmed) {
      settingsMessageText = "ユーザー名を入力してください";
      settingsMessageIsError = true;
      renderSettingsScreen();
      return;
    }
    if ([...trimmed].length > 8) {
      settingsMessageText = "ユーザー名は8文字以内にしてください";
      settingsMessageIsError = true;
      renderSettingsScreen();
      return;
    }
    if (!api?.updateProfileDisplayName) {
      settingsMessageText = "Supabase Authを読み込めませんでした";
      settingsMessageIsError = true;
      renderSettingsScreen();
      return;
    }
    settingsSaveInProgress = true;
    settingsMessageText = "保存中...";
    settingsMessageIsError = false;
    renderSettingsScreen();
    const result = await api.updateProfileDisplayName(trimmed);
    settingsSaveInProgress = false;
    if (result?.ok) {
      authUser = result.user || authUser;
      settingsDisplayName = result.data?.display_name || trimmed;
      settingsMessageText = "ユーザー名を保存しました";
      settingsMessageIsError = false;
      statsOnlineLoadToken += 1;
      statsRankingRows = [];
    } else {
      settingsMessageText = result?.reason || "ユーザー名の保存に失敗しました";
      settingsMessageIsError = true;
    }
    renderSettingsScreen();
    renderAuthPanel();
  }

  function resetBattleEffectState() {
    window.clearTimeout(battleEffectTimer);
    activeBattleEffect = null;
    battleEffectQueue = [];
    lastBattleEffectSignature = "";
    renderActiveBattleEffect();
  }

  function clearResultTransitionTimer() {
    window.clearTimeout(resultTransitionTimer);
    resultTransitionTimer = 0;
  }

  function clearCpuTurnTimer() {
    window.clearTimeout(cpuTurnTimer);
    cpuTurnTimer = 0;
    pendingCpuDiscard = null;
  }

  function clearRiichiAutoDiscardTimer() {
    window.clearTimeout(riichiAutoDiscardTimer);
    riichiAutoDiscardTimer = 0;
  }

  function clearAfterDiscardTimer() {
    window.clearTimeout(afterDiscardTimer);
    afterDiscardTimer = 0;
  }

  function enableSoundFromUserGesture() {
    soundEnabled = true;
  }

  function playSound(name) {
    if (!soundEnabled) return;
    const src = SOUND_FILES[name];
    if (!src) return;
    const category = SOUND_CATEGORY[name];
    if (category === "soundEffect" && !soundSettings.soundEffectsEnabled) return;
    if (category === "voice" && !soundSettings.voiceEffectsEnabled) return;
    try {
      const audio = new Audio(src);
      audio.volume = SOUND_VOLUME[name] ?? 0.5;
      audio.play().catch(() => {});
    } catch (error) {
      console.warn("sound failed", name, error);
    }
  }

  function soundNameForBattleEffect(effect) {
    const classes = String(effect?.classes || "");
    if (classes.includes("effect-riichi")) return "riichi";
    if (classes.includes("effect-pon")) return "pon";
    if (classes.includes("effect-kan")) return "kan";
    if (classes.includes("effect-tsumo")) return "tsumo";
    if (classes.includes("effect-ron")) return "ron";
    return "";
  }

  function playBattleEffectSound(effect) {
    const soundName = soundNameForBattleEffect(effect);
    if (soundName) playSound(soundName);
  }

  function discardSoundSignature(gameState) {
    const action = gameState?.lastAction;
    if (action?.type !== "discard") return "";
    return [
      action.playerIndex ?? "",
      action.tileId || "",
      action.isTsumogiri ? "tsumogiri" : "hand",
      action.isRiichiDeclaration ? "riichi" : "",
      (gameState?.players?.[action.playerIndex]?.discards || []).length,
    ].join(":");
  }

  function playDiscardSoundIfNew(previousGameState, nextGameState) {
    const nextSignature = discardSoundSignature(nextGameState);
    if (!nextSignature) return;
    if (nextSignature === discardSoundSignature(previousGameState)) return;
    playSound("discard");
  }

  function skipPromptSoundSignature(gameState) {
    if (appScreen !== "playing" || gameState?.phase !== "actionPending") return "";
    const pending = gameState.pendingAction;
    if (!pending?.availableActions?.canSkip) return "";
    const action = gameState.lastAction || {};
    return [
      pending.playerIndex ?? "",
      pending.source || "",
      action.type || "",
      action.playerIndex ?? "",
      action.tileId || "",
      Object.entries(pending.availableActions || {})
        .filter(([, enabled]) => Boolean(enabled))
        .map(([key]) => key)
        .sort()
        .join("|"),
    ].join(":");
  }

  function maybePlaySkipPromptSound(gameState) {
    const signature = skipPromptSoundSignature(gameState);
    if (!signature) {
      lastSkipPromptSoundSignature = "";
      return;
    }
    if (signature === lastSkipPromptSoundSignature) return;
    lastSkipPromptSoundSignature = signature;
    playSound("skipPrompt");
  }

  function maybePlayScreenTransitionSound() {
    if (appScreen === lastSoundScreen) return;
    const previousScreen = lastSoundScreen;
    const nextScreen = appScreen;
    const shouldSuppress = suppressNextScreenTransitionSound;
    suppressNextScreenTransitionSound = false;
    lastSoundScreen = nextScreen;
    if (shouldSuppress) return;
    const shouldPlayDecideTransition =
      (previousScreen === "playing" && nextScreen === "result") ||
      (previousScreen === "result" && nextScreen === "settlement");
    if (shouldPlayDecideTransition) {
      playSound("screenTransition");
    }
  }

  function clearPaifuReplayTimer() {
    window.clearInterval(paifuReplayTimer);
    paifuReplayTimer = 0;
  }

  function cloneStorageData(value) {
    if (value == null) return value;
    try {
      return typeof structuredClone === "function"
        ? structuredClone(value)
        : JSON.parse(JSON.stringify(value));
    } catch (error) {
      return JSON.parse(JSON.stringify(value));
    }
  }

  function loadInProgressHanchanSave() {
    try {
      const parsed = JSON.parse(localStorage.getItem(IN_PROGRESS_STORAGE_KEY) || "null");
      if (!parsed || !parsed.battleState || parsed.completed) return null;
      return parsed;
    } catch (error) {
      return null;
    }
  }

  function hasInProgressHanchanSave() {
    return Boolean(loadInProgressHanchanSave());
  }

  function clearInProgressHanchanSave() {
    localStorage.removeItem(IN_PROGRESS_STORAGE_KEY);
  }

  function normalizeHanchanTimingFields(gameState, fallbackStartedAt = "") {
    if (!gameState) return null;
    const startedAt = String(gameState.hanchanStartedAt || fallbackStartedAt || paifuReplay?.startedAt || new Date().toISOString());
    const totalPausedSeconds = Math.max(0, Math.floor(Number(gameState.totalPausedSeconds) || 0));
    const disconnectedAt = gameState.disconnectedAt ? String(gameState.disconnectedAt) : null;
    gameState.hanchanStartedAt = startedAt;
    gameState.totalPausedSeconds = totalPausedSeconds;
    gameState.disconnectedAt = disconnectedAt;
    return { hanchanStartedAt: startedAt, totalPausedSeconds, disconnectedAt };
  }

  function saveInProgressHanchan(options = {}) {
    if (!battleState || isViewingSharedPaifu || !["playing", "result"].includes(appScreen)) return;
    const markDisconnected = Boolean(options.markDisconnected);
    const nowIso = new Date().toISOString();
    normalizeHanchanTimingFields(battleState);
    const battleStateForSave = cloneStorageData(battleState);
    normalizeHanchanTimingFields(battleStateForSave);
    if (markDisconnected && !battleStateForSave.disconnectedAt) {
      battleStateForSave.disconnectedAt = nowIso;
      battleState.disconnectedAt = nowIso;
    }
    const payload = {
      version: 1,
      savedAt: nowIso,
      appScreen,
      hanchanStartedAt: battleStateForSave.hanchanStartedAt,
      disconnectedAt: battleStateForSave.disconnectedAt || null,
      totalPausedSeconds: Math.max(0, Math.floor(Number(battleStateForSave.totalPausedSeconds) || 0)),
      battleState: battleStateForSave,
      lastHandResult: cloneStorageData(lastHandResult),
      paifuReplay: cloneStorageData(paifuReplay),
      paifuHandIndex,
      paifuStepIndex,
      lastPaifuSnapshotSignature,
      resultTransparent,
    };
    try {
      localStorage.setItem(IN_PROGRESS_STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
      // Progress save is best-effort; gameplay should continue even if storage is full.
    }
  }

  function saveInProgressHanchanBeforeDisconnect() {
    saveInProgressHanchan({ markDisconnected: true });
  }

  function applyResumePausedTime(save) {
    if (!save?.battleState) return save;
    const next = cloneStorageData(save);
    const battleSave = next.battleState;
    const timing = normalizeHanchanTimingFields(
      battleSave,
      next.hanchanStartedAt || next.paifuReplay?.startedAt || ""
    );
    const disconnectedAt = next.disconnectedAt || timing?.disconnectedAt || battleSave.disconnectedAt;
    let totalPausedSeconds = Math.max(
      0,
      Math.floor(Number(next.totalPausedSeconds ?? battleSave.totalPausedSeconds) || 0)
    );
    if (disconnectedAt) {
      const disconnectedMs = new Date(disconnectedAt).getTime();
      const resumedMs = Date.now();
      if (Number.isFinite(disconnectedMs) && Number.isFinite(resumedMs)) {
        totalPausedSeconds += Math.max(0, Math.floor((resumedMs - disconnectedMs) / 1000));
      }
    }
    battleSave.hanchanStartedAt = timing?.hanchanStartedAt || next.hanchanStartedAt || next.paifuReplay?.startedAt || "";
    battleSave.totalPausedSeconds = totalPausedSeconds;
    battleSave.disconnectedAt = null;
    next.hanchanStartedAt = battleSave.hanchanStartedAt;
    next.totalPausedSeconds = totalPausedSeconds;
    next.disconnectedAt = null;
    return next;
  }

  function resumeInProgressHanchan() {
    const save = applyResumePausedTime(loadInProgressHanchanSave());
    if (!save) {
      appScreen = "start";
      renderBattleTable();
      return;
    }
    clearCpuTurnTimer();
    clearRiichiAutoDiscardTimer();
    clearAfterDiscardTimer();
    clearResultTransitionTimer();
    stopPaifuPlayback();
    resetBattleEffectState();
    battleState = cloneStorageData(save.battleState);
    normalizeHanchanTimingFields(battleState, save.hanchanStartedAt || save.paifuReplay?.startedAt || "");
    lastHandResult = cloneStorageData(save.lastHandResult) || null;
    battleSettlement = null;
    paifuReplay = cloneStorageData(save.paifuReplay) || createPaifuReplay();
    paifuHandIndex = Math.max(0, Number(save.paifuHandIndex) || 0);
    paifuStepIndex = Math.max(0, Number(save.paifuStepIndex) || 0);
    lastPaifuSnapshotSignature = String(save.lastPaifuSnapshotSignature || "");
    resultTransparent = Boolean(save.resultTransparent);
    isViewingSharedPaifu = false;
    currentSharedPaifuUrl = "";
    settlementBreakdownVisible = false;
    appScreen = save.appScreen === "result" && lastHandResult ? "result" : "playing";
    renderBattleTable();
    if (appScreen === "playing") {
      if (isVisibleDiscardState(battleState)) {
        scheduleAfterVisibleDiscard();
      } else {
        scheduleSelfRiichiAutoDiscard();
        scheduleCpuTurn();
      }
    }
    saveInProgressHanchan();
  }

  function updateResultPanelBounds() {
    if (!els.battleResultPanel || appScreen !== "result" || resultTransparent) return;
    const surface = els.battleSurface;
    const centerPanel = surface?.querySelector(".center-tableau");
    const selfHand = els.battleSelfHand;
    if (!surface || !centerPanel || !selfHand) {
      els.battleResultPanel.style.removeProperty("--result-panel-top");
      els.battleResultPanel.style.removeProperty("--result-panel-height");
      return;
    }
    const surfaceRect = surface.getBoundingClientRect();
    const centerRect = centerPanel.getBoundingClientRect();
    const handRect = selfHand.getBoundingClientRect();
    if (
      surfaceRect.height <= 0 ||
      centerRect.height <= 0 ||
      handRect.height <= 0 ||
      centerRect.bottom <= surfaceRect.top ||
      handRect.top >= surfaceRect.bottom
    ) {
      return;
    }
    const margin = 8;
    const top = clampNumber(centerRect.top - surfaceRect.top, margin, Math.max(margin, surfaceRect.height - margin * 2));
    const bottom = clampNumber(handRect.bottom - surfaceRect.top, top + 160, surfaceRect.height - margin);
    els.battleResultPanel.style.setProperty("--result-panel-top", `${Math.round(top)}px`);
    els.battleResultPanel.style.setProperty("--result-panel-height", `${Math.round(bottom - top)}px`);
  }

  function bindEvents() {
    document.addEventListener("pointerdown", enableSoundFromUserGesture, { capture: true });
    document.addEventListener("keydown", enableSoundFromUserGesture, { capture: true });
    els.battleStartButton?.addEventListener("click", () => {
      if (hasInProgressHanchanSave()) {
        appScreen = "resume";
        renderBattleTable();
        return;
      }
      startBattleHanchan();
    });
    els.resumeRequiredButton?.addEventListener("click", () => {
      resumeInProgressHanchan();
    });
    els.startRulesButton?.addEventListener("click", () => {
      appScreen = "rules";
      renderBattleTable();
    });
    els.startStatsButton?.addEventListener("click", () => {
      statsHistoryPage = 1;
      statsResetConfirmVisible = false;
      statsSupabaseRecords = [];
      statsSupabaseLoadState = "loading";
      statsRankingRows = [];
      statsPaifuUrlByHanchanId = {};
      statsPaifuCopyStatusText = "";
      statsPaifuCopyStatusIsError = false;
      statsSupabaseStatusText = "Supabase成績を読み込み中...";
      statsDataSourceStatusText = "";
      statsRankingStatusText = "\u30e9\u30f3\u30ad\u30f3\u30b0\u3092\u8aad\u307f\u8fbc\u307f\u4e2d\u2026";
      appScreen = "stats";
      renderBattleTable();
      loadStatsOnlineData();
    });
    els.startSettingsButton?.addEventListener("click", () => {
      openSettingsScreen();
    });
    els.rulesBackButton?.addEventListener("click", () => {
      appScreen = "start";
      renderBattleTable();
    });
    els.statsBackButton?.addEventListener("click", () => {
      appScreen = "start";
      renderBattleTable();
    });
    els.settingsBackButton?.addEventListener("click", () => {
      appScreen = "start";
      renderBattleTable();
    });
    els.settingsSaveNameButton?.addEventListener("click", () => {
      handleSaveSettingsDisplayName();
    });
    els.settingsDisplayNameInput?.addEventListener("input", () => {
      settingsDisplayName = els.settingsDisplayNameInput.value.slice(0, 8);
    });
    els.soundSettingButtons.forEach((button) => {
      button.addEventListener("click", () => {
        updateSoundSetting(button.dataset.soundSetting, button.dataset.soundValue === "true");
      });
    });
    els.statsRecentCountInput?.addEventListener("input", () => {
      const records = currentStatsDisplayRecords();
      statsRecentCount = normalizeRecentStatsCount(els.statsRecentCountInput.value, records.length);
      renderStatsScreen();
    });
    els.statsYearSelect?.addEventListener("change", () => {
      const year = Number(els.statsYearSelect.value);
      if (Number.isFinite(year)) {
        statsSelectedYear = Math.floor(year);
      }
      renderStatsScreen();
    });
    els.statsMonthSelect?.addEventListener("change", () => {
      const month = Number(els.statsMonthSelect.value);
      if (Number.isFinite(month)) {
        statsSelectedMonth = clampNumber(Math.floor(month), 1, 12);
      }
      renderStatsScreen();
    });
    els.statsRankingKindSelect?.addEventListener("change", () => {
      if (STATS_RANKING_METRICS[els.statsRankingKindSelect.value]) {
        statsRankingKind = els.statsRankingKindSelect.value;
      }
      renderStatsScreen();
    });
    els.statsRankingMinInput?.addEventListener("input", () => {
      statsRankingMinHanchanCount = normalizeRankingMinHanchanCount(els.statsRankingMinInput.value);
      renderStatsScreen();
    });
    els.statsPrevPageButton?.addEventListener("click", () => {
      statsHistoryPage = Math.max(1, statsHistoryPage - 1);
      renderStatsScreen();
    });
    els.statsNextPageButton?.addEventListener("click", () => {
      const totalPages = Math.max(1, Math.ceil(currentStatsDisplayRecords().length / STATS_HISTORY_PAGE_SIZE));
      statsHistoryPage = Math.min(totalPages, statsHistoryPage + 1);
      renderStatsScreen();
    });
    els.statsResetButton?.addEventListener("click", () => {
      statsResetConfirmVisible = true;
      renderStatsScreen();
    });
    els.statsResetCancelButton?.addEventListener("click", () => {
      statsResetConfirmVisible = false;
      renderStatsScreen();
    });
    els.statsResetConfirmButton?.addEventListener("click", async () => {
      await resetAllStatsForCurrentUser();
    });
    els.statsHistoryTable?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-copy-paifu-url]");
      if (!button || button.disabled) return;
      copyStatsPaifuUrl(button.dataset.copyPaifuUrl || "");
    });
    els.authForm?.addEventListener("submit", (event) => {
      event.preventDefault();
      handleAuthLogin();
    });
    els.authLogoutButton?.addEventListener("click", () => {
      handleAuthLogout();
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
    els.battleTransparentButton?.addEventListener("click", () => {
      resultTransparent = true;
      renderBattleScreenPanels();
    });
    els.battleRestartButton?.addEventListener("click", () => {
      settlementBreakdownVisible = false;
      appScreen = "start";
      renderBattleTable();
    });
    els.battlePaifuButton?.addEventListener("click", () => {
      openPaifuScreen();
    });
    els.battleSharePaifuButton?.addEventListener("click", () => {
      handleSharePaifu();
    });
    els.battleCopyPaifuUrlButton?.addEventListener("click", () => {
      copySharedPaifuUrl();
    });
    els.battleSettlementDetailButton?.addEventListener("click", () => {
      settlementBreakdownVisible = !settlementBreakdownVisible;
      renderBattleSettlementPanel();
    });
    els.paifuPrevHandButton?.addEventListener("click", () => {
      stopPaifuPlayback();
      movePaifuHand(-1);
    });
    els.paifuPrevSelfDrawButton?.addEventListener("click", () => {
      stopPaifuPlayback();
      movePaifuSelfDraw(-1);
    });
    els.paifuPrevButton?.addEventListener("click", () => {
      stopPaifuPlayback();
      movePaifuStep(-1);
    });
    els.paifuNextButton?.addEventListener("click", handlePaifuNextButton);
    els.paifuNextSelfDrawButton?.addEventListener("click", () => {
      stopPaifuPlayback();
      movePaifuSelfDraw(1);
    });
    els.paifuNextHandButton?.addEventListener("click", () => {
      stopPaifuPlayback();
      movePaifuHand(1);
    });
    els.paifuToggleHandsButton?.addEventListener("click", () => {
      stopPaifuPlayback();
      showPaifuOpponentHands = !showPaifuOpponentHands;
      renderBattleTable();
    });
    els.paifuBackButton?.addEventListener("click", () => {
      stopPaifuPlayback();
      resetBattleEffectState();
      appScreen = isViewingSharedPaifu ? "start" : "settlement";
      renderBattleTable();
    });
    els.battleSelfHand?.addEventListener("click", (event) => {
      const tileImage = event.target.closest("[data-discard-tile-id]");
      if (!tileImage) return;
      handleHumanDiscard(tileImage.dataset.discardTileId);
    });
    document.addEventListener("contextmenu", handleContextMenuTsumogiri);
    els.battleSurface?.addEventListener("pointerup", handleLandscapeBlankDoubleTap);
    els.battleSurface?.addEventListener("pointerup", handlePaifuBlankTap);
    window.addEventListener("pagehide", saveInProgressHanchanBeforeDisconnect);
    window.addEventListener("beforeunload", saveInProgressHanchanBeforeDisconnect);
    window.addEventListener("resize", () => {
      if (appScreen === "result") updateResultPanelBounds();
    });

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
            name: displayPlayerNameForValue(player.name, index),
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
      document.getElementById(`playerName${index}`).value = displayPlayerNameByIndex(index);
      document.getElementById(`playerScore${index}`).value = player.score;
      document.getElementById(`bonus${index}`).textContent = formatSigned(player.bonus);
      document.getElementById(`tobi${index}`).textContent = formatSigned(player.tobi);
      document.querySelector(`[data-player-card="${index}"]`).classList.toggle("is-dealer", index === Rules.dealerOf(state));
      document.getElementById(`tenpaiLabel${index}`).textContent = `${displayPlayerNameByIndex(index)} 聴牌`;
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
    clearCpuTurnTimer();
    clearRiichiAutoDiscardTimer();
    clearAfterDiscardTimer();
    clearResultTransitionTimer();
    resetBattleEffectState();
    syncPlayersFromInputs();
    const initialDealerIndex = randomBattleDealerIndex();
    battleState = Game.startNewHand({
      playerNames: [
        displayPlayerNameByIndex(0),
        displayPlayerNameByIndex(1),
        displayPlayerNameByIndex(2),
      ],
      dealerIndex: initialDealerIndex,
      initialDealerIndex,
      roundWind: "east",
      handNumber: 1,
      honba: state.honba || 0,
      kyotaku: Math.floor((Number(state.kyotaku) || 0) / 1000),
    });
    battleState = Game.afterPlayerDraw(battleState);
    renderBattleTable();
    scheduleCpuTurn();
  }

  function startBattleHanchan() {
    if (!Game) {
      els.battleStatus.textContent = "対局ロジックを読み込めませんでした";
      return;
    }
    clearCpuTurnTimer();
    clearRiichiAutoDiscardTimer();
    clearAfterDiscardTimer();
    clearResultTransitionTimer();
    resetBattleEffectState();
    syncPlayersFromInputs();
    playSound("startGame");
    isFuroDebugScenario = false;
    suppressNextScreenTransitionSound = true;
    appScreen = "playing";
    lastHandResult = null;
    battleSettlement = null;
    isSettlementPreview = false;
    isViewingSharedPaifu = false;
    currentSharedPaifuUrl = "";
    paifuReplay = createPaifuReplay();
    paifuHandIndex = 0;
    paifuStepIndex = 0;
    lastPaifuSnapshotSignature = "";
    lastSavedStatsHanchanId = "";
    settlementBreakdownVisible = false;
    const initialDealerIndex = randomBattleDealerIndex();
    battleState = createBattleHand({
      dealerIndex: initialDealerIndex,
      initialDealerIndex,
      roundWind: "east",
      handNumber: 1,
      honba: 0,
      kyotaku: 0,
    });
    normalizeHanchanTimingFields(battleState, paifuReplay.startedAt);
    recordPaifuSnapshot(battleState, "deal", `${battleRoundText(battleState)}${battleState.honba}本場 開始`);
    enterResultIfHandEnded();
    renderBattleTable();
    scheduleCpuTurn();
  }

  function battlePlayerNames() {
    return [
      displayPlayerNameByIndex(0),
      displayPlayerNameByIndex(1),
      displayPlayerNameByIndex(2),
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
    if (currentPlayer?.isRiichi && !battleState.riichiDeclaration) return;
    const selectedTile = currentPlayer?.hand?.find((tile) => tile.id === tileId);
    if (isDisabledBattleDiscardTile(selectedTile, battleState.currentPlayerIndex)) return;
    try {
      const previousBattleState = battleState;
      battleState = Game.discardTile(battleState, battleState.currentPlayerIndex, tileId);
      playDiscardSoundIfNew(previousBattleState, battleState);
      renderBattleStateAndScheduleNext();
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

  function runRightClickEquivalentAction() {
    if (!battleState) return;
    if (isSelfPonOrKanActionPending()) {
      handleBattleAction("skip");
      return;
    }
    if (battleState.phase === "actionPending" && !Game.canDiscardDuringActionPending?.(battleState)) return;
    if (battleState.phase !== "discard" && battleState.phase !== "actionPending") return;
    discardDrawnTileAsTsumogiri();
  }

  function handleContextMenuTsumogiri(event) {
    if (appScreen !== "playing") return;
    event.preventDefault();
    runRightClickEquivalentAction();
  }

  function isSmartphoneLandscapeViewport() {
    return window.matchMedia?.("(max-width: 950px) and (max-height: 520px) and (orientation: landscape)")?.matches;
  }

  function isLandscapeBlankTapTarget(target) {
    if (!target || !els.battleSurface?.contains(target)) return false;
    return !target.closest(
      [
        ".table-tile-img",
        ".tile",
        "button",
        "input",
        "select",
        "textarea",
        "a",
        ".center-tableau",
        ".center-table-layout",
        ".dora-indicator-row",
        ".discard-river",
        ".self-hand",
        ".self-hand-area",
        ".opponent-hand",
        ".meld-area",
        ".self-meld-lane",
        ".side-meld-lane",
        ".self-flower-lane",
        ".side-flower-lane",
        ".battle-action-buttons",
        ".battle-result-panel",
        ".battle-settlement-panel",
        ".paifu-panel",
        ".rules-screen",
        ".stats-screen",
        ".settings-screen",
      ].join(", ")
    );
  }

  function isTouchLikePointerEvent(event) {
    return event?.pointerType === "touch" || event?.pointerType === "pen";
  }

  function isPaifuBlankTapTarget(target) {
    if (!target || !els.battleSurface?.contains(target)) return false;
    return !target.closest(
      [
        ".table-tile-img",
        ".tile",
        "[data-discard-tile-id]",
        "button",
        "input",
        "select",
        "textarea",
        "label",
        "a",
        "[role='button']",
        ".center-tableau",
        ".center-table-layout",
        ".dora-indicator-row",
        ".discard-river",
        ".self-hand",
        ".self-hand-area",
        ".opponent-hand",
        ".opponent-name",
        ".self-name",
        ".meld-area",
        ".self-meld-lane",
        ".side-meld-lane",
        ".self-flower-lane",
        ".side-flower-lane",
        ".battle-action-buttons",
        ".battle-result-panel",
        ".battle-settlement-panel",
        ".paifu-panel",
        ".rules-screen",
        ".stats-screen",
        ".settings-screen",
        ".battle-effect",
      ].join(", ")
    );
  }

  function handlePaifuBlankTap(event) {
    if (appScreen !== "paifu") return;
    if (!isTouchLikePointerEvent(event)) return;
    if (event.isPrimary === false) return;
    if (!isPaifuBlankTapTarget(event.target)) return;
    if (isPaifuAtLast()) return;
    event.preventDefault();
    handlePaifuNextButton();
  }

  function handleLandscapeBlankDoubleTap(event) {
    if (appScreen !== "playing" || !isSmartphoneLandscapeViewport()) return;
    if (event.pointerType && event.pointerType !== "touch") return;
    if (!isLandscapeBlankTapTarget(event.target)) {
      lastLandscapeBlankTapTime = 0;
      return;
    }
    const now = Date.now();
    if (now - lastLandscapeBlankTapTime <= 300) {
      event.preventDefault();
      runRightClickEquivalentAction();
      lastLandscapeBlankTapTime = 0;
      return;
    }
    lastLandscapeBlankTapTime = now;
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

  function handleBattleAction(action) {
    if (!battleState || appScreen !== "playing" || battleState.phase !== "actionPending") return;
    try {
      const previousBattleState = battleState;
      battleState = Game.performPendingAction(battleState, action);
      playDiscardSoundIfNew(previousBattleState, battleState);
      queueRiichiEffectIfJustFinalized(previousBattleState, battleState);
      renderBattleStateAndScheduleNext();
    } catch (error) {
      els.battleStatus.textContent = error.message;
    }
  }

  function isVisibleDiscardState(gameState) {
    return gameState?.phase === "draw" && gameState?.lastAction?.type === "discard";
  }

  function renderBattleStateAndScheduleNext() {
    const ended = enterResultIfHandEnded();
    recordPaifuSnapshot(battleState);
    renderBattleTable();
    if (ended) return;
    if (isVisibleDiscardState(battleState)) {
      scheduleAfterVisibleDiscard();
      return;
    }
    scheduleSelfRiichiAutoDiscard();
    scheduleCpuTurn();
  }

  function scheduleAfterVisibleDiscard() {
    clearAfterDiscardTimer();
    if (!battleState || appScreen !== "playing" || !isVisibleDiscardState(battleState)) return;
    afterDiscardTimer = window.setTimeout(() => {
      afterDiscardTimer = 0;
      if (!battleState || appScreen !== "playing" || !isVisibleDiscardState(battleState)) return;
      const previousBattleState = battleState;
      battleState = Game.afterPlayerDiscard(battleState);
      queueRiichiEffectIfJustFinalized(previousBattleState, battleState);
      renderBattleStateAndScheduleNext();
    }, AFTER_DISCARD_REACTION_DELAY_MS);
  }

  function scheduleCpuTurn() {
    clearCpuTurnTimer();
    if (!battleState || appScreen !== "playing" || battleState.phase !== "discard") return;
    const currentPlayer = battleState.players[battleState.currentPlayerIndex];
    if (!currentPlayer?.isCpu) return;
    const startedAt = performance.now();
    pendingCpuDiscard = {
      playerIndex: battleState.currentPlayerIndex,
      playerId: currentPlayer.id,
      stateId: battleState.hanchanId,
      phase: battleState.phase,
      tileId: null,
      isRiichiAutoDiscard: Boolean(currentPlayer.isRiichi),
      shouldEndRyukyoku: false,
    };

    if (!currentPlayer.isRiichi) {
      const discard = Game.decideCpuDiscard(currentPlayer, battleState);
      if (discard) {
        pendingCpuDiscard.tileId = discard.id;
      } else {
        pendingCpuDiscard.shouldEndRyukyoku = true;
      }
    }

    const elapsed = performance.now() - startedAt;
    const waitMs = Math.max(0, CPU_DISCARD_DELAY_MS - elapsed);
    cpuTurnTimer = window.setTimeout(runCpuTurn, waitMs);
  }

  function isSelfRiichiAutoDiscardTurn(gameState) {
    if (!gameState || appScreen !== "playing" || gameState.phase !== "discard") return false;
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    return Boolean(currentPlayer?.seat === "self" && currentPlayer.isRiichi && !gameState.pendingAction);
  }

  function scheduleSelfRiichiAutoDiscard() {
    clearRiichiAutoDiscardTimer();
    if (!isSelfRiichiAutoDiscardTurn(battleState)) return;
    riichiAutoDiscardTimer = window.setTimeout(runSelfRiichiAutoDiscard, RIICHI_AUTO_DISCARD_DELAY_MS);
  }

  function runSelfRiichiAutoDiscard() {
    riichiAutoDiscardTimer = 0;
    if (!isSelfRiichiAutoDiscardTurn(battleState)) return;
    const currentPlayer = battleState.players[battleState.currentPlayerIndex];
    const previousBattleState = battleState;
    battleState = Game.handleRiichiDraw(currentPlayer, battleState);
    playDiscardSoundIfNew(previousBattleState, battleState);
    renderBattleStateAndScheduleNext();
  }

  function runCpuTurn() {
    cpuTurnTimer = 0;
    if (!battleState || appScreen !== "playing" || battleState.phase !== "discard") return;
    const currentPlayer = battleState.players[battleState.currentPlayerIndex];
    if (!currentPlayer?.isCpu) return;
    const pending = pendingCpuDiscard;
    pendingCpuDiscard = null;
    if (
      !pending ||
      pending.playerIndex !== battleState.currentPlayerIndex ||
      pending.playerId !== currentPlayer.id ||
      pending.stateId !== battleState.hanchanId ||
      pending.phase !== battleState.phase
    ) {
      return;
    }
    if (pending.isRiichiAutoDiscard) {
      const previousBattleState = battleState;
      battleState = Game.handleRiichiDraw(currentPlayer, battleState);
      playDiscardSoundIfNew(previousBattleState, battleState);
      renderBattleStateAndScheduleNext();
      return;
    }
    if (pending.shouldEndRyukyoku || !pending.tileId) {
      battleState = Game.endHandAsRyukyoku(battleState);
      enterResultIfHandEnded();
      recordPaifuSnapshot(battleState, "ryukyoku", "流局");
      renderBattleTable();
      return;
    }
    const previousBattleState = battleState;
    battleState = Game.discardTile(battleState, battleState.currentPlayerIndex, pending.tileId);
    playDiscardSoundIfNew(previousBattleState, battleState);
    renderBattleStateAndScheduleNext();
  }

  function enterResultIfHandEnded() {
    if (!battleState || !["result", "ryukyoku"].includes(battleState.phase)) return false;
    clearCpuTurnTimer();
    clearRiichiAutoDiscardTimer();
    clearAfterDiscardTimer();
    if (appScreen === "result") return true;
    if (battleState.phase === "ryukyoku") {
      clearResultTransitionTimer();
      battleState = applyBattleRyukyokuSettlement(battleState);
      lastHandResult = buildBattleHandResult(battleState);
      attachPaifuHandResult(lastHandResult);
      resultTransparent = false;
      appScreen = "result";
      return true;
    }
    if (resultTransitionTimer) return true;
    resultTransitionTimer = window.setTimeout(() => {
      resultTransitionTimer = 0;
      if (!battleState || battleState.phase !== "result" || appScreen !== "playing") return;
      lastHandResult = buildBattleHandResult(battleState);
      attachPaifuHandResult(lastHandResult);
      recordPaifuSnapshot(battleState, "result", paifuActionTextForState(battleState, "result"));
      resultTransparent = false;
      appScreen = "result";
      renderBattleTable();
    }, RESULT_TRANSITION_DELAY_MS);
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

  function displayPlayerNameByIndex(playerIndex) {
    if (playerIndex === null || playerIndex === undefined || playerIndex === "") return "";
    return ["自分", "下家", "上家"][Number(playerIndex)] || "";
  }

  function displayPlayerNameForValue(value, playerIndex = null) {
    const indexedName = displayPlayerNameByIndex(playerIndex);
    if (indexedName) return indexedName;
    const text = String(value ?? "").trim();
    const legacyNumber = text.match(/^Player\s*([123])$/i)?.[1];
    if (legacyNumber) return displayPlayerNameByIndex(Number(legacyNumber) - 1);
    const legacyCpuSeat = text.match(/^CPU\s+(Shimocha|Kamicha)$/i)?.[1]?.toLowerCase();
    if (legacyCpuSeat === "shimocha") return "下家";
    if (legacyCpuSeat === "kamicha") return "上家";
    if (text === "player1" || text === "0") return "自分";
    if (text === "player2" || text === "1") return "下家";
    if (text === "player3" || text === "2") return "上家";
    return text;
  }

  function battlePlayerName(gameState, playerIndex) {
    return displayPlayerNameByIndex(playerIndex) || displayPlayerNameForValue(gameState.players[playerIndex]?.name);
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

  function battleSettlementChipScore(chipPoints) {
    return roundBattleScore((Number(chipPoints) || 0) / 100);
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

  function removeOneTileById(tiles = [], tileId = "") {
    const next = [...tiles];
    const index = next.findIndex((tile) => tile.id === tileId);
    if (index >= 0) next.splice(index, 1);
    return next;
  }

  function formatPlainNumber(value) {
    return String(Number(value) || 0);
  }

  function formatResultPointNumber(value) {
    return formatPlainNumber(value);
  }

  function hasExplicitYakuman(best) {
    return (best?.yaku || []).some((yaku) => (yaku?.yakuman || yaku?.isYakuman) && !yaku?.isKazoeYakuman);
  }

  function getLimitName(evaluation) {
    const best = evaluation?.best || evaluation;
    if (!best) return "";
    if (hasExplicitYakuman(best)) return "役満";
    const han = Number(best.han) || Number(best.points?.han) || 0;
    if (han >= 14) return "数え役満";
    if (han >= 11) return "三倍満";
    if (han >= 8) return "倍満";
    if (han >= 6) return "跳満";
    if (han >= 4) return "満貫";
    return "";
  }

  function getLimitNameClass(limitName) {
    switch (limitName) {
      case "跳満":
        return "limit-haneman";
      case "倍満":
        return "limit-baiman";
      case "三倍満":
        return "limit-sanbaiman";
      case "数え役満":
        return "limit-kazoe";
      case "役満":
        return "limit-yakuman";
      default:
        return "";
    }
  }

  function formatLimitNamePrefix(limitName) {
    if (!limitName) return "";
    const limitClass = getLimitNameClass(limitName);
    if (!limitClass) return `${escapeHtml(limitName)} `;
    return `<span class="limit-name ${limitClass}">${escapeHtml(limitName)}</span> `;
  }

  function formatWinPointText(evaluation, winType) {
    const points = evaluation?.best?.points;
    if (!points) return "点数：-";
    const limitName = getLimitName(evaluation);
    const prefix = formatLimitNamePrefix(limitName);
    if (points.isTsumo || winType === "tsumo") {
      const parentPayment = points.payments?.find((payment) => payment.payer === "parent")?.amount;
      const childPayment = points.payments?.find((payment) => payment.payer === "child")?.amount;
      if (points.isDealer || Number(parentPayment) === Number(childPayment)) {
        return `点数：${prefix}${formatResultPointNumber(childPayment || parentPayment)}ALL`;
      }
      return `点数：${prefix}${formatResultPointNumber(childPayment)}/${formatResultPointNumber(parentPayment)}`;
    }
    const amount = points.payments?.[0]?.amount || points.total || 0;
    return `点数：${prefix}${formatResultPointNumber(amount)}`;
  }

  function formatResultYakuName(yaku) {
    const rawName = String(yaku?.displayName || yaku?.label || yaku?.name || yaku?.id || "").trim();
    if (!rawName) return "";
    const normalized = rawName.toLowerCase();
    return RESULT_YAKU_NAME_MAP[normalized] || RESULT_YAKU_NAME_MAP[rawName] || rawName;
  }

  function formatWinYakuText(evaluation) {
    const best = evaluation?.best;
    const yakuNames = (best?.yaku || []).map(formatResultYakuName).filter(Boolean);
    const doraHan = Number(best?.dora?.totalHan) || 0;
    if (doraHan > 0) yakuNames.push(`ドラ${doraHan}`);
    return `役：${yakuNames.length ? yakuNames.join("/") : "なし"}`;
  }

  function winDisplayTitle(player) {
    if (player?.seat === "self") return "自分のアガリ";
    if (player?.seat === "shimocha") return "下家のアガリ";
    if (player?.seat === "kamicha") return "上家のアガリ";
    return "アガリ";
  }

  function buildResultOpponentHands(gameState, winnerIndex, winnerIndexes = [winnerIndex]) {
    return (gameState.players || [])
      .map((player, playerIndex) => ({
        playerIndex,
        seat: player.seat,
        label: playerPositionLabel(player.seat),
        handTiles: sortedBattleTiles(player.hand || []),
        revealHand: true,
        melds: player.melds || [],
        flowerTiles: player.flowers || [],
      }))
      .filter((entry) => entry.playerIndex !== winnerIndex);
  }

  function buildWinDisplayInfo(gameState, winnerIndex, action, winnerIndexes = [winnerIndex]) {
    const winner = gameState.players[winnerIndex];
    if (!winner || !action?.evaluation) return null;
    const winningTile = action.winningTile || null;
    const isRon = action.winType === "ron";
    const handTiles = sortedBattleTiles(isRon
      ? [...(winner.hand || [])]
      : removeOneTileById(winner.hand || [], winningTile?.id));
    return {
      winnerId: winner.id,
      title: winDisplayTitle(winner),
      winType: action.winType,
      isRiichi: Boolean(winner.isRiichi),
      yakuText: action.nagashiYakuman ? "役：流し役満" : formatWinYakuText(action.evaluation),
      pointText: formatWinPointText(action.evaluation, action.winType),
      handTiles,
      winningTile,
      melds: winner.melds || [],
      flowerTiles: winner.flowers || [],
      doraIndicators: gameState.doraIndicators || [],
      uraDoraIndicators: winner.isRiichi ? gameState.uraDoraIndicators || [] : [],
      isNagashiYakuman: Boolean(action.nagashiYakuman),
      opponentHands: buildResultOpponentHands(gameState, winnerIndex, winnerIndexes),
    };
  }

  function buildBattleWinDisplayInfos(gameState, action) {
    if (!action || action.type !== "win") return [];
    if (Array.isArray(action.winnerIndexes)) {
      return action.winnerIndexes
        .map((winnerIndex) => buildWinDisplayInfo(gameState, winnerIndex, action, action.winnerIndexes))
        .filter(Boolean);
    }
    if (Number.isInteger(action.winnerIndex)) {
      const info = buildWinDisplayInfo(gameState, action.winnerIndex, action, [action.winnerIndex]);
      return info ? [info] : [];
    }
    return [];
  }

  function cloneResultTileSnapshot(tile) {
    return tile ? { ...tile } : null;
  }

  function cloneResultTilesSnapshot(tiles = []) {
    return (tiles || [])
      .filter((tile) => tile && !tile.isFlower)
      .map(cloneResultTileSnapshot);
  }

  function cloneResultVisibleTilesSnapshot(tiles = []) {
    return (tiles || []).filter(Boolean).map(cloneResultTileSnapshot);
  }

  function cloneResultMeldSnapshot(meld) {
    if (!meld) return null;
    return {
      ...meld,
      tiles: cloneResultTilesSnapshot(meld.tiles || []),
      calledTile: cloneResultTileSnapshot(meld.calledTile),
      addedTile: cloneResultTileSnapshot(meld.addedTile),
    };
  }

  function cloneResultMeldsSnapshot(melds = []) {
    return (melds || []).map(cloneResultMeldSnapshot).filter(Boolean);
  }

  function baseIdSortValueForDisplay(baseId) {
    const text = String(baseId || "");
    const honorOrder = { east: 1, south: 2, west: 3, north: 4, white: 5, green: 6, red: 7 };
    if (text.startsWith("p")) return Number(text.slice(1)) || 99;
    if (text.startsWith("s")) return 100 + (Number(text.slice(1)) || 99);
    if (honorOrder[text]) return 200 + honorOrder[text];
    if (text.startsWith("m")) return 300 + (Number(text.slice(1)) || 99);
    return 999;
  }

  function baseIdDisplayName(baseId) {
    const text = String(baseId || "");
    const honorNames = {
      east: "東",
      south: "南",
      west: "西",
      north: "北",
      white: "白",
      green: "發",
      red: "中",
    };
    if (honorNames[text]) return honorNames[text];
    const number = Number(text.slice(1));
    if (text.startsWith("p") && number) return `${number}筒`;
    if (text.startsWith("s") && number) return `${number}索`;
    if (text.startsWith("m") && number) return `${number}萬`;
    return text;
  }

  function formatWinningTileNames(baseIds = []) {
    return [...new Set(baseIds || [])]
      .sort((left, right) => baseIdSortValueForDisplay(left) - baseIdSortValueForDisplay(right))
      .map(baseIdDisplayName)
      .join(" / ");
  }

  function buildRyukyokuHandsSnapshot(gameState) {
    const playersBySeat = new Map((gameState.players || []).map((player, index) => [player.seat, { player, index }]));
    return ["self", "shimocha", "kamicha"]
      .map((seat) => {
        const entry = playersBySeat.get(seat);
        const player = entry?.player;
        if (!player) return null;
        const winningTiles = Game.getWinningTiles(player) || [];
        return {
          playerId: player.id,
          playerIndex: entry.index,
          seat,
          displayName: playerPositionLabel(seat),
          isTenpai: winningTiles.length > 0,
          winningTiles: [...winningTiles],
          handTiles: sortedBattleTiles(cloneResultTilesSnapshot(player.hand || [])),
          melds: cloneResultMeldsSnapshot(player.melds || []),
        };
      })
      .filter(Boolean);
  }

  function battleResultWinnerIndexes(action = {}) {
    if (Array.isArray(action.winnerIndexes)) {
      return action.winnerIndexes.filter((index) => Number.isInteger(index));
    }
    return Number.isInteger(action.winnerIndex) ? [action.winnerIndex] : [];
  }

  function resultDrawnTileForPlayer(gameState, playerIndex, winnerIndexes) {
    const action = gameState?.lastAction || {};
    if (action.type === "win" && action.winType === "tsumo" && winnerIndexes.includes(playerIndex)) {
      return cloneResultTileSnapshot(action.winningTile);
    }
    return null;
  }

  function buildResultPlayerHandSnapshots(gameState) {
    const action = gameState?.lastAction || {};
    const winnerIndexes = battleResultWinnerIndexes(action);
    const playersBySeat = new Map((gameState.players || []).map((player, index) => [player.seat, { player, index }]));
    return ["self", "shimocha", "kamicha"]
      .map((seat) => {
        const entry = playersBySeat.get(seat);
        const player = entry?.player;
        if (!player) return null;
        const drawnTile = resultDrawnTileForPlayer(gameState, entry.index, winnerIndexes);
        const handSource = drawnTile ? removeOneTileById(player.hand || [], drawnTile.id) : player.hand || [];
        const winningTiles = gameState?.phase === "ryukyoku" || action.type === "ryukyoku"
          ? Game.getWinningTiles(player) || []
          : [];
        return {
          playerId: player.id,
          playerIndex: entry.index,
          seat,
          displayName: playerPositionLabel(seat),
          isWinner: winnerIndexes.includes(entry.index),
          isTenpai: winningTiles.length > 0,
          winningTiles: [...winningTiles],
          points: Number(player.points) || 0,
          chips: Number(player.chips) || 0,
          handTiles: sortedBattleTiles(cloneResultTilesSnapshot(handSource)),
          drawnTile,
          melds: cloneResultMeldsSnapshot(player.melds || []),
          flowerTiles: cloneResultVisibleTilesSnapshot(player.flowers || []),
        };
      })
      .filter(Boolean);
  }

  function buildBattleHandResult(gameState) {
    const action = gameState.lastAction || {};
    const isRyukyoku = gameState.phase === "ryukyoku" || action.type === "ryukyoku";
    const type = isRyukyoku ? "ryukyoku" : action.winType === "tsumo" ? "tsumo" : "ron";
    const winnerIndexes = battleResultWinnerIndexes(action);
    const winnerIds = winnerIndexes.map((index) => gameState.players[index]?.id).filter(Boolean);
    const pointDeltas = action.pointDeltas || [0, 0, 0];
    const chipDeltas = action.chipDeltas || [0, 0, 0];
    const dealerContinue = isRyukyoku
      ? Boolean(action.dealerTenpai)
      : winnerIndexes.includes(gameState.dealerIndex);
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
      doraIndicators: gameState.doraIndicators || [],
      uraDoraIndicators: gameState.uraDoraIndicators || [],
      wins: isRyukyoku ? [] : buildBattleWinDisplayInfos(gameState, action),
      playerHandSnapshots: buildResultPlayerHandSnapshots(gameState),
      ryukyokuHands: isRyukyoku ? buildRyukyokuHandsSnapshot(gameState) : [],
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
      finalizePaifuReplay();
      saveCurrentHanchanStatsIfConfigured();
      clearInProgressHanchanSave();
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

  function shouldAutoContinueCpuOorasu(result = lastHandResult) {
    if (!result?.requiresOorasuDealerChoice || result.cpuAutoContinueQueued) return false;
    const dealer = battleState?.players?.[battleState.dealerIndex];
    return Boolean(dealer?.isCpu);
  }

  function queueCpuOorasuContinueIfNeeded() {
    if (!shouldAutoContinueCpuOorasu()) return;
    lastHandResult = {
      ...lastHandResult,
      cpuAutoContinueQueued: true,
    };
    window.setTimeout(() => {
      if (shouldAutoContinueCpuOorasu({ ...lastHandResult, cpuAutoContinueQueued: false })) {
        handleContinueOorasu();
      }
    }, 300);
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
    finalizePaifuReplay();
    saveCurrentHanchanStatsIfConfigured();
    clearInProgressHanchanSave();
    settlementBreakdownVisible = false;
    appScreen = "settlement";
    renderBattleTable();
  }

  function startNextBattleHand(nextRound) {
    clearCpuTurnTimer();
    clearRiichiAutoDiscardTimer();
    clearAfterDiscardTimer();
    clearResultTransitionTimer();
    resetBattleEffectState();
    const previousPlayers = battleState.players.map((player) => ({
      name: player.name,
      points: player.points,
      chips: player.chips,
    }));
    const hanchanTiming = normalizeHanchanTimingFields(battleState);
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
    if (hanchanTiming) {
      battleState.hanchanStartedAt = hanchanTiming.hanchanStartedAt;
      battleState.totalPausedSeconds = hanchanTiming.totalPausedSeconds;
      battleState.disconnectedAt = null;
    }
    recordPaifuSnapshot(battleState, "deal", `${battleRoundText(battleState)}${battleState.honba}本場 開始`);
    enterResultIfHandEnded();
    renderBattleTable();
    scheduleCpuTurn();
  }

  function createPaifuReplay() {
    return {
      id: `paifu_${Date.now()}`,
      startedAt: new Date().toISOString(),
      endedAt: "",
      hands: [],
    };
  }

  function clonePaifuData(value) {
    if (typeof structuredClone === "function") {
      return structuredClone(value);
    }
    return JSON.parse(JSON.stringify(value));
  }

  function paifuRoundKey(gameState) {
    return [
      gameState?.roundWind || "",
      gameState?.handNumber ?? "",
      gameState?.honba ?? "",
      gameState?.dealerIndex ?? "",
    ].join(":");
  }

  function ensurePaifuHand(gameState) {
    if (!paifuReplay || !gameState) return null;
    const key = paifuRoundKey(gameState);
    let hand = paifuReplay.hands[paifuReplay.hands.length - 1];
    if (!hand || hand.key !== key) {
      hand = {
        key,
        roundLabel: battleRoundText(gameState),
        honba: Number(gameState.honba) || 0,
        kyotaku: Math.max(0, Math.floor(Number(gameState.kyotaku) || 0)),
        snapshots: [],
        result: null,
      };
      paifuReplay.hands.push(hand);
    }
    return hand;
  }

  function paifuTileLabel(tile) {
    return tile?.name || tile?.baseId || tile?.id || "牌";
  }

  function paifuActionTypeForState(gameState) {
    const action = gameState?.lastAction || {};
    if (gameState?.phase === "ryukyoku" || action.type === "ryukyoku") return "ryukyoku";
    if (gameState?.phase === "result" && action.type === "win") return action.winType === "tsumo" ? "tsumo" : "ron";
    if (action.type === "win") return action.winType === "tsumo" ? "tsumo" : "ron";
    if (action.type === "riichi" || action.type === "riichiDeclaration") return "riichi";
    if (action.type === "flower") return "flower";
    if (action.type === "pon") return "pon";
    if (action.type === "kan" || action.type === "ankan" || action.type === "kakan") return "kan";
    if (action.type === "discard") return "discard";
    if (action.type === "draw") return "draw";
    return action.type || "result";
  }

  function paifuActionTextForState(gameState, forcedType = "") {
    const action = gameState?.lastAction || {};
    const type = forcedType || paifuActionTypeForState(gameState);
    const playerIndex = Number.isInteger(action.winnerIndex)
      ? action.winnerIndex
      : Number.isInteger(action.playerIndex)
        ? action.playerIndex
        : Number.isInteger(gameState?.currentPlayerIndex)
          ? gameState.currentPlayerIndex
          : null;
    const playerName = Number.isInteger(playerIndex) ? battlePlayerName(gameState, playerIndex) : "";
    const tileText = action.tile ? paifuTileLabel(action.tile) : action.tileId ? paifuTileLabel(Tiles.getTileDefinition?.(action.tileId)) : "";
    if (type === "deal") return `${battleRoundText(gameState)}${gameState.honba}本場 開始`;
    if (type === "draw") return `${playerName}がツモ`;
    if (type === "discard") return `${playerName}が${tileText}を打牌`;
    if (type === "flower") return `${playerName}が華牌を公開`;
    if (type === "pon") return `${playerName}がポン`;
    if (type === "kan") return `${playerName}がカン`;
    if (type === "riichi") return `${playerName}がリーチ`;
    if (type === "ron") return `${playerName}がロンアガリ`;
    if (type === "tsumo") return `${playerName}がツモアガリ`;
    if (type === "ryukyoku") return "流局";
    if (type === "result") return "局結果確定";
    return playerName ? `${playerName}の操作` : "牌譜";
  }

  function paifuPlayerSnapshot(player, index, gameState) {
    return {
      id: player.id,
      index,
      seat: playerDisplaySeat(player, index),
      displayName: displayPlayerNameByIndex(index),
      points: Number(player.points) || 0,
      chips: Number(player.chips) || 0,
      hand: sortedBattleTiles(clonePaifuData(player.hand || [])),
      discards: clonePaifuData(player.discards || []),
      flowers: clonePaifuData(player.flowers || []),
      melds: clonePaifuData(player.melds || []),
      isDealer: index === gameState.dealerIndex,
      isRiichi: Boolean(player.isRiichi),
    };
  }

  function createPaifuSnapshot(gameState, actionType, actionText, hand, stepIndex) {
    const action = gameState.lastAction || {};
    const currentPlayerIndex = Number.isInteger(gameState.currentPlayerIndex) ? gameState.currentPlayerIndex : null;
    const dealerIndex = Number.isInteger(gameState.dealerIndex) ? gameState.dealerIndex : 0;
    const actionPlayerIndex = Number.isInteger(action.winnerIndex)
      ? action.winnerIndex
      : Number.isInteger(action.playerIndex)
        ? action.playerIndex
        : currentPlayerIndex;
    return clonePaifuData({
      snapshotId: `${Date.now()}_${hand.snapshots.length}_${Math.random().toString(36).slice(2, 8)}`,
      handIndex: paifuReplay.hands.indexOf(hand),
      stepIndex,
      roundLabel: battleRoundText(gameState),
      roundWind: gameState.roundWind,
      handNumber: gameState.handNumber,
      honba: Number(gameState.honba) || 0,
      kyotaku: Math.max(0, Math.floor(Number(gameState.kyotaku) || 0)),
      remainingDraws: Math.max(0, Number(gameState.remainingDraws) || 0),
      currentPlayerIndex,
      currentPlayerId: Number.isInteger(currentPlayerIndex) ? gameState.players[currentPlayerIndex]?.id || null : null,
      dealerIndex,
      dealerId: gameState.players[dealerIndex]?.id || null,
      actionPlayerIndex: Number.isInteger(actionPlayerIndex) ? actionPlayerIndex : null,
      actionPlayerId: Number.isInteger(actionPlayerIndex) ? gameState.players[actionPlayerIndex]?.id || null : null,
      actionType,
      actionText,
      players: gameState.players.map((player, index) => paifuPlayerSnapshot(player, index, gameState)),
      doraIndicators: clonePaifuData(gameState.doraIndicators || []),
      uraDoraIndicators: clonePaifuData(gameState.uraDoraIndicators || []),
    });
  }

  function paifuSnapshotSignature(gameState, actionType, actionText) {
    if (!gameState) return "";
    const action = gameState.lastAction || {};
    return JSON.stringify({
      phase: gameState.phase,
      round: paifuRoundKey(gameState),
      currentPlayerIndex: gameState.currentPlayerIndex,
      remainingDraws: gameState.remainingDraws,
      actionType,
      actionText,
      action: {
        type: action.type,
        playerIndex: action.playerIndex,
        winnerIndex: action.winnerIndex,
        tileId: action.tileId,
        effect: action.effect,
      },
      players: gameState.players.map((player) => ({
        points: player.points,
        chips: player.chips,
        isRiichi: player.isRiichi,
        hand: (player.hand || []).map((tile) => tile.id),
        discards: (player.discards || []).map((discard) => discardTileOf(discard)?.id || ""),
        flowers: (player.flowers || []).map((tile) => tile.id),
        melds: (player.melds || []).map((meld) => `${meld.type}:${meld.id}:${(meld.tiles || []).map((tile) => tile.id).join(",")}`),
      })),
    });
  }

  function recordPaifuSnapshot(gameState, forcedType = "", forcedText = "") {
    if (!paifuReplay || !gameState || appScreen === "paifu") return;
    const hand = ensurePaifuHand(gameState);
    if (!hand) return;
    const actionType = forcedType || paifuActionTypeForState(gameState);
    const actionText = forcedText || paifuActionTextForState(gameState, actionType);
    const signature = paifuSnapshotSignature(gameState, actionType, actionText);
    if (signature && signature === lastPaifuSnapshotSignature) return;
    lastPaifuSnapshotSignature = signature;
    hand.snapshots.push(createPaifuSnapshot(gameState, actionType, actionText, hand, hand.snapshots.length));
  }

  function attachPaifuHandResult(result) {
    if (!paifuReplay || !result || !battleState) return;
    const hand = ensurePaifuHand(battleState);
    if (hand) hand.result = clonePaifuData(result);
  }

  function finalizePaifuReplay() {
    if (!paifuReplay) return;
    paifuReplay.endedAt = new Date().toISOString();
    try {
      localStorage.setItem(PAIFU_STORAGE_KEY, JSON.stringify(paifuReplay));
    } catch (error) {
      console.warn("牌譜を保存できませんでした", error);
    }
  }

  function parseMaybeJson(value) {
    if (typeof value !== "string") return value;
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  function showBattleShareStatus(message, isError = false) {
    if (!els.battleSharePaifuStatus) return;
    els.battleSharePaifuStatus.textContent = message || "";
    els.battleSharePaifuStatus.classList.toggle("is-error", Boolean(isError));
    setHiddenIfChanged(els.battleSharePaifuStatus, !message);
  }

  function updateSharedPaifuUrlUi(url = "") {
    currentSharedPaifuUrl = url || "";
    if (els.battleCopyPaifuUrlButton) {
      setHiddenIfChanged(els.battleCopyPaifuUrlButton, !currentSharedPaifuUrl);
      els.battleCopyPaifuUrlButton.disabled = !currentSharedPaifuUrl;
    }
  }

  async function copySharedPaifuUrl() {
    if (!currentSharedPaifuUrl) return;
    try {
      await navigator.clipboard?.writeText(currentSharedPaifuUrl);
      showBattleShareStatus(`コピーしました: ${currentSharedPaifuUrl}`);
    } catch {
      showBattleShareStatus(`URLを選択してコピーしてください: ${currentSharedPaifuUrl}`, true);
    }
  }

  function buildPaifuUrlFromShareId(shareId) {
    if (!shareId) return "";
    const api = window.paifuShareApi;
    if (api?.buildShareUrl) return api.buildShareUrl(shareId);
    if (api?.getSharedUrl) return api.getSharedUrl(shareId);
    try {
      const url = new URL(window.location.href);
      url.search = "";
      url.hash = "";
      url.searchParams.set("paifu", shareId);
      return url.toString();
    } catch {
      return `${window.location.origin}${window.location.pathname}?paifu=${encodeURIComponent(shareId)}`;
    }
  }

  function paifuUrlFromStoredReplay(recordId) {
    if (!recordId) return "";
    try {
      const replay = JSON.parse(localStorage.getItem(PAIFU_STORAGE_KEY) || "null");
      if (!replay || String(replay.id || "") !== String(recordId)) return "";
      return replay.sharedUrl || buildPaifuUrlFromShareId(replay.shareId);
    } catch {
      return "";
    }
  }

  function statsPaifuUrlForRecord(record = {}) {
    const id = String(record.id || record.hanchanId || record.hanchan_id || "");
    return (
      record.paifuUrl ||
      record.sharedUrl ||
      (record.shareId ? buildPaifuUrlFromShareId(record.shareId) : "") ||
      (id ? statsPaifuUrlByHanchanId[id] : "") ||
      paifuUrlFromStoredReplay(id)
    );
  }

  function renderStatsPaifuUrlCell(record = {}) {
    const url = statsPaifuUrlForRecord(record);
    if (!url) {
      return `<button class="mini-button stats-paifu-copy-button" type="button" disabled>コピー不可</button>`;
    }
    return `<button class="mini-button stats-paifu-copy-button" type="button" data-copy-paifu-url="${escapeHtml(url)}">コピー</button>`;
  }

  async function copyStatsPaifuUrl(url) {
    if (!url) return;
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard API unavailable");
      }
      await navigator.clipboard.writeText(url);
      statsPaifuCopyStatusText = "コピーしました";
      statsPaifuCopyStatusIsError = false;
    } catch (error) {
      console.error("Failed to copy paifu URL", error);
      statsPaifuCopyStatusText = "コピーに失敗しました";
      statsPaifuCopyStatusIsError = true;
    }
    renderStatsScreen();
  }

  async function loadSharedPaifuFromUrl() {
    const shareId = new URLSearchParams(window.location.search).get("paifu");
    if (!shareId) return;
    const api = window.paifuShareApi;
    if (!api?.loadSharedPaifu) {
      setTextIfChanged(els.battleStatus, "共有牌譜APIを読み込めませんでした");
      return;
    }
    clearCpuTurnTimer();
    clearRiichiAutoDiscardTimer();
    clearAfterDiscardTimer();
    clearResultTransitionTimer();
    resetBattleEffectState();
    stopPaifuPlayback();
    setTextIfChanged(els.battleStatus, "牌譜を読み込み中です…");
    const result = await api.loadSharedPaifu(shareId);
    if (!result.ok) {
      appScreen = "start";
      isViewingSharedPaifu = false;
      setTextIfChanged(
        els.battleStatus,
        "牌譜が見つかりませんでした。URLが間違っているか、牌譜が削除された可能性があります。"
      );
      renderBattleTable();
      return;
    }
    paifuReplay = parseMaybeJson(result.paifu);
    const loadedSettlement = parseMaybeJson(result.settlement);
    battleSettlement = Array.isArray(loadedSettlement) ? loadedSettlement : null;
    if (paifuReplay && typeof paifuReplay === "object") {
      paifuReplay.shareId = result.shareId;
      paifuReplay.sharedUrl = api.buildShareUrl?.(result.shareId) || api.getSharedUrl?.(result.shareId) || "";
    }
    currentSharedPaifuUrl = paifuReplay?.sharedUrl || "";
    isViewingSharedPaifu = true;
    isSettlementPreview = false;
    battleState = null;
    lastHandResult = null;
    paifuHandIndex = 0;
    paifuStepIndex = 0;
    showPaifuOpponentHands = false;
    appScreen = "paifu";
    renderBattleTable();
  }

  function buildPaifuShareTitle() {
    const firstHand = paifuReplay?.hands?.[0];
    const lastHand = paifuReplay?.hands?.[paifuReplay.hands.length - 1];
    const range = firstHand && lastHand
      ? `${firstHand.roundLabel}${firstHand.honba}本場-${lastHand.roundLabel}${lastHand.honba}本場`
      : "半荘牌譜";
    return `マーチャオサンマ ${range}`;
  }

  async function handleSharePaifu() {
    if (!hasPaifuSnapshots()) {
      showBattleShareStatus("共有できる牌譜がありません", true);
      return;
    }
    const api = window.paifuShareApi;
    if (!api?.createSharedPaifu) {
      showBattleShareStatus("共有APIを読み込めませんでした", true);
      return;
    }
    if (paifuReplay?.shareId) {
      const url = paifuReplay.sharedUrl || api.buildShareUrl?.(paifuReplay.shareId) || api.getSharedUrl?.(paifuReplay.shareId);
      updateSharedPaifuUrlUi(url);
      showBattleShareStatus(`すでに作成済みです: ${url}`);
      return;
    }
    showBattleShareStatus("共有URLを作成中...");
    const settlement = battleSettlement || (battleState ? buildBattleSettlement(battleState) : null);
    const result = await api.createSharedPaifu({
      title: buildPaifuShareTitle(),
      paifuReplay,
      settlementResult: settlement,
      rulesVersion: RULES_VERSION,
      appVersion: APP_VERSION,
      isPublic: true,
    });
    if (!result.ok) {
      showBattleShareStatus(result.reason || "共有URLを作成できませんでした", true);
      return;
    }
    paifuReplay.shareId = result.shareId;
    paifuReplay.sharedUrl = result.url;
    finalizePaifuReplay();
    updateSharedPaifuUrlUi(result.url);
    showBattleShareStatus(`牌譜URLを作成しました: ${result.url}`);
  }

  function selfPlayerIdFromReplay() {
    const snapshot = paifuReplay?.hands?.[0]?.snapshots?.[0];
    return snapshot?.players?.find((player) => player?.index === 0 || player?.seat === "self")?.id || battleState?.players?.[0]?.id || "";
  }

  function countSelfWinAndDealIn(selfPlayerId) {
    const counts = { winCount: 0, dealInCount: 0 };
    if (!selfPlayerId) return counts;
    (paifuReplay?.hands || []).forEach((hand) => {
      const result = hand?.result || {};
      const winnerIds = Array.isArray(result.winnerIds)
        ? result.winnerIds
        : (result.wins || []).map((win) => win?.winnerId).filter(Boolean);
      if (winnerIds.includes(selfPlayerId)) counts.winCount += 1;
      if ((result.type === "ron" || winnerIds.length > 0) && result.loserId === selfPlayerId) {
        counts.dealInCount += 1;
      }
    });
    return counts;
  }

  function loadStatsStorage() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STATS_STORAGE_KEY) || "null");
      const records = Array.isArray(parsed?.records) ? parsed.records.map(normalizeHanchanStatRecord).filter(Boolean) : [];
      return { version: 1, records };
    } catch (error) {
      console.warn("成績データを読み込めませんでした", error);
      return { version: 1, records: [] };
    }
  }

  async function resetAllStatsForCurrentUser() {
    localStorage.removeItem(STATS_STORAGE_KEY);
    statsHistoryPage = 1;
    statsResetConfirmVisible = false;

    if (window.statsApi?.isConfigured?.() && window.statsApi?.deleteOwnHanchanStats) {
      const result = await window.statsApi.deleteOwnHanchanStats();
      if (!result?.ok && !result?.skipped) {
        console.error("Supabase stats delete failed", result?.error || result?.reason || result);
        statsSupabaseStatusText = "成績の削除に失敗しました。時間をおいて再度お試しください。";
        renderStatsScreen();
        return;
      }
    }

    statsSupabaseRecords = [];
    statsRankingRows = [];
    statsPaifuUrlByHanchanId = {};
    statsPaifuCopyStatusText = "";
    statsPaifuCopyStatusIsError = false;
    statsSupabaseLoadState = window.statsApi?.isConfigured?.() ? "success" : "unavailable";
    statsSupabaseStatusText = "";
    statsRankingStatusText = "";
    statsDataSourceStatusText = "";
    renderStatsScreen();
    if (window.statsApi?.isConfigured?.()) {
      loadStatsOnlineData();
    }
  }

  function saveStatsStorage(storage) {
    try {
      const records = Array.isArray(storage?.records) ? storage.records.map(normalizeHanchanStatRecord).filter(Boolean) : [];
      localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify({ version: 1, records }));
    } catch (error) {
      console.warn("成績データを保存できませんでした", error);
    }
  }

  function normalizeHanchanStatRecord(record) {
    if (!record || typeof record !== "object") return null;
    const id = String(record.id || record.hanchan_id || record.hanchanId || "");
    const startedAt = String(record.startedAt || record.started_at || "");
    const endedAt = String(record.endedAt || record.ended_at || record.created_at || "");
    if (!id || !endedAt) return null;
    const rawDuration = Number(record.durationSeconds ?? record.duration_seconds);
    const durationExcludesPaused = record.durationExcludesPaused === true || record.duration_excludes_paused === true;
    const durationSeconds = durationExcludesPaused && Number.isFinite(rawDuration)
      ? Math.max(0, Math.floor(rawDuration))
      : null;
    return {
      id,
      startedAt,
      endedAt,
      rank: clampNumber(Math.round(Number(record.rank) || 0), 1, 3),
      finalRawScore: Math.round(Number(record.finalRawScore ?? record.final_raw_score ?? record.rawScore ?? 0) || 0),
      settlementPoint: Math.round(Number(record.settlementPoint ?? record.settlement_point ?? record.finalScore ?? 0) || 0),
      chipCount: Math.round(Number(record.chipCount ?? record.chip_count ?? 0) || 0),
      totalHands: Math.max(0, Math.round(Number(record.totalHands ?? record.total_hands ?? 0) || 0)),
      winCount: Math.max(0, Math.round(Number(record.winCount ?? record.win_count ?? 0) || 0)),
      dealInCount: Math.max(0, Math.round(Number(record.dealInCount ?? record.deal_in_count ?? 0) || 0)),
      riichiCount: Math.max(0, Math.round(Number(record.riichiCount ?? record.riichi_count ?? 0) || 0)),
      calledHandCount: Math.max(0, Math.round(Number(record.calledHandCount ?? record.called_hand_count ?? 0) || 0)),
      shareId: String(record.shareId || record.share_id || ""),
      sharedUrl: String(record.sharedUrl || record.shared_url || record.paifuUrl || record.paifu_url || ""),
      durationSeconds,
      durationExcludesPaused,
    };
  }

  function saveHanchanStatRecord(record) {
    const normalized = normalizeHanchanStatRecord(record);
    if (!normalized) return;
    const storage = loadStatsStorage();
    const existingIndex = storage.records.findIndex((entry) => entry.id === normalized.id);
    if (existingIndex >= 0) {
      storage.records[existingIndex] = normalized;
    } else {
      storage.records.push(normalized);
    }
    saveStatsStorage(storage);
  }

  function countSelfReplayStats(selfPlayerId) {
    const counts = { winCount: 0, dealInCount: 0, riichiCount: 0, calledHandCount: 0 };
    if (!selfPlayerId) return counts;
    (paifuReplay?.hands || []).forEach((hand) => {
      const result = hand?.result || {};
      const snapshots = Array.isArray(hand?.snapshots) ? hand.snapshots : [];
      const winnerIds = Array.isArray(result.winnerIds)
        ? result.winnerIds
        : (result.wins || []).map((win) => win?.winnerId).filter(Boolean);
      if (winnerIds.includes(selfPlayerId)) counts.winCount += 1;
      if ((result.type === "ron" || winnerIds.length > 0) && result.loserId === selfPlayerId) {
        counts.dealInCount += 1;
      }
      const hasSelfRiichi = snapshots.some((snapshot) => {
        if (snapshot.actionType === "riichi" && snapshot.actionPlayerId === selfPlayerId) return true;
        return (snapshot.players || []).some((player) => player.id === selfPlayerId && player.isRiichi);
      });
      if (hasSelfRiichi) counts.riichiCount += 1;
      const hasSelfCall = snapshots.some((snapshot) => {
        const self = (snapshot.players || []).find((player) => player.id === selfPlayerId);
        return (self?.melds || []).some((meld) => meld?.type !== "ankan");
      });
      if (hasSelfCall) counts.calledHandCount += 1;
    });
    return counts;
  }

  function calculateHanchanDurationSeconds(startedAt, endedAt, pausedSeconds = 0) {
    const startedMs = new Date(startedAt).getTime();
    const endedMs = new Date(endedAt).getTime();
    if (!Number.isFinite(startedMs) || !Number.isFinite(endedMs)) return null;
    const rawSeconds = Math.max(0, Math.floor((endedMs - startedMs) / 1000));
    const safePausedSeconds = Math.max(0, Math.floor(Number(pausedSeconds) || 0));
    return Math.max(0, rawSeconds - safePausedSeconds);
  }

  function buildHanchanStatRecord(settlement) {
    const selfSettlement = (settlement || []).find((item) => item.index === 0) || null;
    if (!selfSettlement || !paifuReplay?.id) return null;
    const selfPlayerId = selfPlayerIdFromReplay();
    const counts = countSelfReplayStats(selfPlayerId);
    const timing = normalizeHanchanTimingFields(battleState, paifuReplay.startedAt);
    const startedAt = timing?.hanchanStartedAt || paifuReplay.startedAt || "";
    const endedAt = paifuReplay.endedAt || new Date().toISOString();
    const durationSeconds = calculateHanchanDurationSeconds(startedAt, endedAt, timing?.totalPausedSeconds || 0);
    return {
      id: paifuReplay.id,
      startedAt,
      endedAt,
      rank: Number(selfSettlement.rank) || 0,
      finalRawScore: Math.round(Number(selfSettlement.points) || 0),
      settlementPoint: Number(selfSettlement.displayFinalPoint ?? selfSettlement.finalScore) || 0,
      chipCount: Math.round((Number(selfSettlement.chips) || 0) / 500),
      totalHands: paifuReplay.hands?.length || 0,
      winCount: counts.winCount,
      dealInCount: counts.dealInCount,
      riichiCount: counts.riichiCount,
      calledHandCount: counts.calledHandCount,
      durationSeconds,
      durationExcludesPaused: true,
    };
  }

  function buildHanchanStatsRow(settlement) {
    const record = buildHanchanStatRecord(settlement);
    if (!record) return null;
    return {
      hanchan_id: record.id,
      ended_at: record.endedAt,
      rank: record.rank,
      final_raw_score: record.finalRawScore,
      settlement_point: record.settlementPoint,
      chip_count: record.chipCount,
      total_hands: record.totalHands,
      win_count: record.winCount,
      deal_in_count: record.dealInCount,
      riichi_count: record.riichiCount,
      called_hand_count: record.calledHandCount,
      duration_seconds: record.durationSeconds,
    };
  }

  function saveCurrentHanchanStatsIfConfigured() {
    if (!battleSettlement || !paifuReplay?.id || lastSavedStatsHanchanId === paifuReplay.id) return;
    const record = buildHanchanStatRecord(battleSettlement);
    if (!record) return;
    saveHanchanStatRecord(record);
    lastSavedStatsHanchanId = paifuReplay.id;
    if (!window.statsApi?.saveHanchanStats || !window.statsApi.isConfigured?.()) return;
    const row = buildHanchanStatsRow(battleSettlement);
    if (!row) return;
    window.statsApi.saveHanchanStats(row).then((result) => {
      if (result?.skipped) {
        console.info("Supabase stats save skipped", result.reason || "Not logged in.");
        return;
      }
      if (result?.duplicate) {
        console.warn("Supabase stats already saved for this hanchan.", { hanchanId: row.hanchan_id });
        return;
      }
      if (!result.ok) {
        lastSavedStatsHanchanId = "";
        console.error("Supabase stats save failed", result.reason || result.error);
        return;
      }
      console.log("Supabase stats saved", row);
    });
  }

  function sortStatsRecordsNewest(records = []) {
    return [...records].sort((left, right) => new Date(right.endedAt).getTime() - new Date(left.endedAt).getTime());
  }

  function filterThisMonthRecords(records = []) {
    const now = new Date();
    return records.filter((record) => {
      const endedAt = new Date(record.endedAt);
      return endedAt.getFullYear() === now.getFullYear() && endedAt.getMonth() === now.getMonth();
    });
  }

  function isSameYearMonth(record, year, month) {
    const endedAt = new Date(record?.endedAt);
    return (
      Number.isFinite(endedAt.getTime()) &&
      endedAt.getFullYear() === Number(year) &&
      endedAt.getMonth() + 1 === Number(month)
    );
  }

  function filterYearMonthRecords(records = [], year = statsSelectedYear, month = statsSelectedMonth) {
    return records.filter((record) => isSameYearMonth(record, year, month));
  }

  function statsYearMonthLabel(year = statsSelectedYear, month = statsSelectedMonth) {
    return `${year}/${String(month).padStart(2, "0")}`;
  }

  function statsAvailableYears(records = []) {
    const currentYear = new Date().getFullYear();
    const years = new Set([currentYear, statsSelectedYear]);
    records.forEach((record) => {
      const endedAt = new Date(record.endedAt);
      if (Number.isFinite(endedAt.getTime())) {
        years.add(endedAt.getFullYear());
      }
    });
    return [...years].sort((left, right) => right - left);
  }

  function renderStatsMonthControls(records = []) {
    const years = statsAvailableYears(records);
    if (!years.includes(statsSelectedYear)) {
      statsSelectedYear = years[0] || new Date().getFullYear();
    }
    statsSelectedMonth = clampNumber(statsSelectedMonth, 1, 12);
    if (els.statsYearSelect) {
      const yearHtml = years.map((year) => `<option value="${year}">${year}</option>`).join("");
      setHtmlIfChanged(els.statsYearSelect, yearHtml);
      if (String(els.statsYearSelect.value) !== String(statsSelectedYear)) {
        els.statsYearSelect.value = String(statsSelectedYear);
      }
    }
    if (els.statsMonthSelect) {
      const monthHtml = Array.from({ length: 12 }, (_, index) => {
        const month = index + 1;
        return `<option value="${month}">${month}</option>`;
      }).join("");
      setHtmlIfChanged(els.statsMonthSelect, monthHtml);
      if (String(els.statsMonthSelect.value) !== String(statsSelectedMonth)) {
        els.statsMonthSelect.value = String(statsSelectedMonth);
      }
    }
  }

  function getRecentRecords(records = [], count = 10) {
    const limit = normalizeRecentStatsCount(count, records.length);
    return sortStatsRecordsNewest(records).slice(0, limit);
  }

  function normalizeRecentStatsCount(value, totalCount = 0) {
    const fallback = 10;
    const parsed = Math.floor(Number(value));
    const safe = Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
    const max = Math.max(1, Number(totalCount) || 1);
    return clampNumber(safe, 1, max);
  }

  function calculateStatsSummary(records = []) {
    const count = records.length;
    if (!count) return null;
    const totalHands = records.reduce((sum, record) => sum + (Number(record.totalHands) || 0), 0);
    const sum = (key) => records.reduce((total, record) => total + (Number(record[key]) || 0), 0);
    const rawProfit = records.reduce((total, record) => total + ((Number(record.finalRawScore) || 0) - 35000), 0);
    const durationRecords = records.filter((record) => typeof record.durationSeconds === "number" && Number.isFinite(record.durationSeconds));
    const averageDurationSeconds = durationRecords.length
      ? durationRecords.reduce((total, record) => total + record.durationSeconds, 0) / durationRecords.length
      : null;
    return {
      hanchanCount: count,
      totalHands,
      averageDurationSeconds,
      averageRank: sum("rank") / count,
      averageSettlementPoint: sum("settlementPoint") / count,
      totalSettlementPoint: sum("settlementPoint"),
      averageChipCount: sum("chipCount") / count,
      roundProfit: totalHands > 0 ? rawProfit / totalHands : 0,
      winRate: totalHands > 0 ? (sum("winCount") / totalHands) * 100 : 0,
      dealInRate: totalHands > 0 ? (sum("dealInCount") / totalHands) * 100 : 0,
      riichiRate: totalHands > 0 ? (sum("riichiCount") / totalHands) * 100 : 0,
      calledRate: totalHands > 0 ? (sum("calledHandCount") / totalHands) * 100 : 0,
    };
  }

  function formatSignedNumber(value, digits = 0) {
    const number = Number(value) || 0;
    const rounded = digits > 0 ? Math.round(number * (10 ** digits)) / (10 ** digits) : Math.round(number);
    const text = digits > 0 ? rounded.toFixed(digits) : String(rounded);
    if (rounded > 0) return `+${text}`;
    if (rounded < 0) return text;
    return digits > 0 ? (0).toFixed(digits) : "0";
  }

  function formatPercent(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "-";
    return `${number.toFixed(1)}%`;
  }

  function formatDuration(seconds) {
    const number = Number(seconds);
    if (seconds == null || !Number.isFinite(number)) return "-";
    const totalSeconds = Math.max(0, Math.floor(number));
    const minutes = Math.floor(totalSeconds / 60);
    const restSeconds = totalSeconds % 60;
    return `${minutes}m${String(restSeconds).padStart(2, "0")}s`;
  }

  function formatStatsDate(value) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return "-";
    const pad = (number) => String(number).padStart(2, "0");
    return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function renderStatsSummaryCells(summary) {
    if (!summary) {
      return `
        <td>-</td>
        <td>-</td>
        <td>-</td>
        <td>-</td>
        <td>-</td>
        <td>-</td>
        <td>-</td>
        <td>-</td>
        <td>-</td>
      `;
    }
    return `
      <td>${formatDuration(summary.averageDurationSeconds)}</td>
      <td>${summary.averageRank.toFixed(2)}</td>
      <td>${formatSignedNumber(summary.averageSettlementPoint)}</td>
      <td>${formatSignedNumber(summary.totalSettlementPoint)}</td>
      <td>${formatSignedNumber(summary.averageChipCount, 1)}</td>
      <td>${formatPercent(summary.winRate)}</td>
      <td>${formatPercent(summary.dealInRate)}</td>
      <td>${formatPercent(summary.riichiRate)}</td>
      <td>${formatPercent(summary.calledRate)}</td>
    `;
  }

  function renderStatsSummaryTable(records = [], recentCount = 10) {
    const allSummary = calculateStatsSummary(records);
    const monthSummary = calculateStatsSummary(filterYearMonthRecords(records, statsSelectedYear, statsSelectedMonth));
    const recentRecords = getRecentRecords(records, recentCount);
    const recentSummary = calculateStatsSummary(recentRecords);
    const recentLabel = `\u76f4\u8fd1${recentRecords.length || normalizeRecentStatsCount(recentCount, records.length)}\u6226`;
    return `
      <table class="stats-table stats-summary-table">
        <thead>
          <tr>
            <th>\u5bfe\u8c61</th>
            <th>\u5e73\u5747\u6642\u9593</th>
            <th>\u5e73\u5747\u7740\u9806</th>
            <th>\u5e73\u5747\u53ce\u652f</th>
            <th>\u5408\u8a08\u53ce\u652f</th>
            <th>\u5e73\u5747\u795d\u5100</th>
            <th>\u548c\u4e86\u7387</th>
            <th>\u653e\u9283\u7387</th>
            <th>\u7acb\u76f4\u7387</th>
            <th>\u526f\u9732\u7387</th>
          </tr>
        </thead>
        <tbody>
          <tr><th>\u901a\u7b97</th>${renderStatsSummaryCells(allSummary)}</tr>
          <tr><th>${escapeHtml(statsYearMonthLabel())}</th>${renderStatsSummaryCells(monthSummary)}</tr>
          <tr><th>${escapeHtml(recentLabel)}</th>${renderStatsSummaryCells(recentSummary)}</tr>
        </tbody>
      </table>
    `;
  }

  function renderHanchanHistoryTable(records = [], page = 1) {
    const sorted = sortStatsRecordsNewest(records);
    const totalPages = Math.max(1, Math.ceil(sorted.length / STATS_HISTORY_PAGE_SIZE));
    const currentPage = clampNumber(page, 1, totalPages);
    const start = (currentPage - 1) * STATS_HISTORY_PAGE_SIZE;
    const pageRecords = sorted.slice(start, start + STATS_HISTORY_PAGE_SIZE);
    const header = `
      <thead>
        <tr>
          <th>\u65e5\u6642</th>
          <th>\u6642\u9593</th>
          <th>\u7740\u9806</th>
          <th>\u7d20\u70b9</th>
          <th>\u53ce\u652f</th>
          <th>\u795d\u5100</th>
          <th>\u7dcf\u5c40\u6570</th>
          <th>\u548c\u4e86</th>
          <th>\u653e\u9283</th>
          <th>\u7acb\u76f4</th>
          <th>\u526f\u9732</th>
          <th>\u724c\u8b5cURL</th>
        </tr>
      </thead>
    `;
    if (!pageRecords.length) {
      return `
        <table class="stats-table stats-history-table">
          ${header}
          <tbody><tr><td colspan="12">\u5c65\u6b74\u306f\u3042\u308a\u307e\u305b\u3093</td></tr></tbody>
        </table>
      `;
    }
    return `
      <table class="stats-table stats-history-table">
        ${header}
        <tbody>
          ${pageRecords.map((record) => `
            <tr>
              <td>${escapeHtml(formatStatsDate(record.endedAt))}</td>
              <td>${escapeHtml(formatDuration(record.durationSeconds))}</td>
              <td>${escapeHtml(`${record.rank}\u4f4d`)}</td>
              <td>${formatPlainNumber(record.finalRawScore)}</td>
              <td>${formatSignedNumber(record.settlementPoint)}</td>
              <td>${formatSignedNumber(record.chipCount)}</td>
              <td>${formatPlainNumber(record.totalHands)}</td>
              <td>${formatPlainNumber(record.winCount)}</td>
              <td>${formatPlainNumber(record.dealInCount)}</td>
              <td>${formatPlainNumber(record.riichiCount)}</td>
              <td>${formatPlainNumber(record.calledHandCount)}</td>
              <td>${renderStatsPaifuUrlCell(record)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
  }

  function supabaseStatRowToRecord(row = {}) {
    return {
      id: row.hanchan_id || "",
      endedAt: row.ended_at || "",
      rank: Number(row.rank) || 0,
      finalRawScore: Number(row.final_raw_score) || 0,
      settlementPoint: Number(row.settlement_point) || 0,
      chipCount: Number(row.chip_count) || 0,
      totalHands: Number(row.total_hands) || 0,
      winCount: Number(row.win_count) || 0,
      dealInCount: Number(row.deal_in_count) || 0,
      riichiCount: Number(row.riichi_count) || 0,
      calledHandCount: Number(row.called_hand_count) || 0,
      durationSeconds: typeof row.duration_seconds === "number" ? row.duration_seconds : null,
    };
  }

  async function refreshStatsPaifuUrlMap(records = []) {
    const ids = [...new Set((records || []).map((record) => String(record?.id || "")).filter(Boolean))];
    const localMap = {};
    ids.forEach((id) => {
      const url = paifuUrlFromStoredReplay(id);
      if (url) localMap[id] = url;
    });
    statsPaifuUrlByHanchanId = localMap;
    const api = window.paifuShareApi;
    if (!ids.length || !api?.loadSharedPaifuUrlMap) return;
    const result = await api.loadSharedPaifuUrlMap(ids);
    if (result?.ok) {
      statsPaifuUrlByHanchanId = {
        ...localMap,
        ...(result.data || {}),
      };
    }
  }

  async function loadStatsOnlineData() {
    const token = statsOnlineLoadToken + 1;
    statsOnlineLoadToken = token;
    if (!window.statsApi?.isConfigured?.()) {
      statsSupabaseLoadState = "unavailable";
      statsSupabaseStatusText = "Supabaseが未設定です";
      statsDataSourceStatusText = "表示中：端末内成績";
      statsRankingStatusText = "Supabase\u304c\u672a\u8a2d\u5b9a\u3067\u3059";
      statsPaifuUrlByHanchanId = {};
      renderStatsScreen();
      return;
    }

    statsSupabaseLoadState = "loading";
    statsSupabaseStatusText = "Supabase成績を読み込み中...";
    statsDataSourceStatusText = "";
    statsRankingStatusText = "\u30e9\u30f3\u30ad\u30f3\u30b0\u3092\u8aad\u307f\u8fbc\u307f\u4e2d\u2026";
    renderStatsScreen();

    const [ownResult, rankingResult] = await Promise.allSettled([
      window.statsApi.loadOwnHanchanStats?.(),
      window.statsApi.loadRankingSummary?.(500),
    ]);
    if (token !== statsOnlineLoadToken) return;

    const ownValue = ownResult.status === "fulfilled" ? ownResult.value : null;
    if (ownValue?.ok) {
      statsSupabaseRecords = (ownValue.data || []).map(supabaseStatRowToRecord);
      await refreshStatsPaifuUrlMap(statsSupabaseRecords);
      if (token !== statsOnlineLoadToken) return;
      statsSupabaseLoadState = "success";
      statsSupabaseStatusText = `Supabase保存済み: ${statsSupabaseRecords.length}件`;
      statsDataSourceStatusText = "";
    } else {
      statsSupabaseRecords = [];
      statsPaifuUrlByHanchanId = {};
      statsSupabaseLoadState = "error";
      statsSupabaseStatusText = ownValue?.reason || ownResult.reason?.message || "Supabase成績を読み込めませんでした";
      statsDataSourceStatusText = "表示中：端末内成績（Supabase取得失敗）";
    }

    const rankingValue = rankingResult.status === "fulfilled" ? rankingResult.value : null;
    if (rankingValue?.ok) {
      statsRankingRows = rankingValue.data || [];
      statsRankingStatusText = "";
    } else {
      statsRankingRows = [];
      statsRankingStatusText = rankingValue?.reason || rankingResult.reason?.message || "\u30e9\u30f3\u30ad\u30f3\u30b0\u3092\u53d6\u5f97\u3067\u304d\u307e\u305b\u3093\u3067\u3057\u305f\u3002";
    }

    if (appScreen === "stats") renderStatsScreen();
  }

  function renderSupabaseStatsTable(records = []) {
    if (!records.length) {
      return `
        <table class="stats-table stats-history-table">
          <thead>
            <tr>
              <th>終了日時</th>
              <th>時間</th>
              <th>着順</th>
              <th>最終素点</th>
              <th>収支</th>
              <th>祝儀枚数</th>
            </tr>
          </thead>
          <tbody><tr><td colspan="6">Supabaseに保存された自分の成績はまだありません</td></tr></tbody>
        </table>
      `;
    }
    const rows = sortStatsRecordsNewest(records).slice(0, 20);
    return `
      <table class="stats-table stats-history-table">
        <thead>
          <tr>
            <th>終了日時</th>
            <th>時間</th>
            <th>着順</th>
            <th>最終素点</th>
            <th>収支</th>
            <th>祝儀枚数</th>
            <th>総局数</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((record) => `
            <tr>
              <td>${escapeHtml(formatStatsDate(record.endedAt))}</td>
              <td>${escapeHtml(formatDuration(record.durationSeconds))}</td>
              <td>${escapeHtml(`${record.rank}位`)}</td>
              <td>${formatPlainNumber(record.finalRawScore)}</td>
              <td>${formatSignedNumber(record.settlementPoint)}</td>
      <td>${formatSignedNumber(record.chipCount)}</td>
      <td>${formatPlainNumber(record.totalHands)}</td>
    </tr>
  `).join("")}
        </tbody>
      </table>
    `;
  }

  function normalizeRankingMinHanchanCount(value) {
    const parsed = Math.floor(Number(value));
    return Number.isFinite(parsed) && parsed > 0 ? clampNumber(parsed, 1, 999) : 1;
  }

  function normalizeRankingNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function rankingMetricRawValue(row, metricKey = statsRankingKind) {
    if (metricKey === "hanchan_count") {
      return normalizeRankingNumber(row?.hanchan_count);
    }
    if (metricKey === "average_chip_count") {
      const hanchanCount = normalizeRankingNumber(row?.hanchan_count);
      return hanchanCount > 0 ? normalizeRankingNumber(row?.total_chip_count) / hanchanCount : 0;
    }
    return row?.[metricKey];
  }

  function rankingMetricValue(row, metricKey = statsRankingKind) {
    return normalizeRankingNumber(rankingMetricRawValue(row, metricKey), 0);
  }

  function formatRankingValue(row, metricKey = statsRankingKind) {
    const metric = STATS_RANKING_METRICS[metricKey] || STATS_RANKING_METRICS.average_settlement_point;
    const value = rankingMetricRawValue(row, metricKey);
    if (metric.format === "duration") return formatDuration(value);
    if (metric.format === "percent") return formatPercent(value);
    if (metric.format === "rank") return Number(value || 0).toFixed(2);
    if (metric.format === "plain") return formatPlainNumber(value);
    return formatSignedNumber(value, metricKey === "average_chip_count" ? 1 : 0);
  }

  function sortedRankingRows(rows = [], metricKey = statsRankingKind) {
    const metric = STATS_RANKING_METRICS[metricKey] || STATS_RANKING_METRICS.average_settlement_point;
    const direction = metric.direction === "asc" ? 1 : -1;
    return [...rows]
      .filter((row) => normalizeRankingNumber(row?.hanchan_count) >= statsRankingMinHanchanCount)
      .sort((left, right) => {
        const diff = rankingMetricValue(left, metricKey) - rankingMetricValue(right, metricKey);
        if (diff !== 0) return diff * direction;
        const settlementDiff = normalizeRankingNumber(right?.total_settlement_point) - normalizeRankingNumber(left?.total_settlement_point);
        if (settlementDiff !== 0) return settlementDiff;
        return normalizeRankingNumber(right?.hanchan_count) - normalizeRankingNumber(left?.hanchan_count);
      })
      .slice(0, STATS_RANKING_LIMIT);
  }

  function renderRankingTable(rows = []) {
    const rankedRows = sortedRankingRows(rows, statsRankingKind);
    const metricOrder = Object.keys(STATS_RANKING_METRICS);
    const selectedMetricKey = STATS_RANKING_METRICS[statsRankingKind] ? statsRankingKind : "average_settlement_point";
    const rankingColumns = [
      selectedMetricKey,
      ...metricOrder.filter((metricKey) => metricKey !== selectedMetricKey),
    ];
    const header = `
      <thead>
        <tr>
          <th>\u9806\u4f4d</th>
          <th>\u30e6\u30fc\u30b6\u30fc\u540d</th>
          ${rankingColumns.map((metricKey) => `<th>${escapeHtml(STATS_RANKING_METRICS[metricKey].label)}</th>`).join("")}
        </tr>
      </thead>
    `;
    if (!rankedRows.length) {
      return `
        <table class="stats-table stats-ranking-table">
          ${header}
          <tbody><tr><td colspan="${rankingColumns.length + 2}">\u30e9\u30f3\u30ad\u30f3\u30b0\u30c7\u30fc\u30bf\u306f\u307e\u3060\u3042\u308a\u307e\u305b\u3093</td></tr></tbody>
        </table>
      `;
    }
    return `
      <table class="stats-table stats-ranking-table">
        ${header}
        <tbody>
          ${rankedRows.map((row, index) => `
            <tr>
              <td>${index + 1}</td>
              <td>${escapeHtml(row.display_name || "\u533f\u540d\u30e6\u30fc\u30b6\u30fc")}</td>
              ${rankingColumns.map((metricKey) => `<td>${escapeHtml(formatRankingValue(row, metricKey))}</td>`).join("")}
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
  }

  function getStatsDisplayRecords(localRecords = []) {
    if (statsSupabaseLoadState === "success") {
      return {
        records: statsSupabaseRecords,
        source: "supabase",
      };
    }
    return {
      records: localRecords,
      source: "local",
    };
  }

  function currentStatsDisplayRecords() {
    return getStatsDisplayRecords(loadStatsStorage().records).records;
  }

  function statsEmptyMessageText(source, hasLocalRecords) {
    if (statsSupabaseLoadState === "loading") return "\u6210\u7e3e\u3092\u8aad\u307f\u8fbc\u307f\u4e2d\u2026";
    if (statsSupabaseLoadState === "error" && hasLocalRecords) {
      return "Supabase\u6210\u7e3e\u3092\u53d6\u5f97\u3067\u304d\u307e\u305b\u3093\u3067\u3057\u305f\u3002\n\u7aef\u672b\u5185\u6210\u7e3e\u3092\u8868\u793a\u3057\u307e\u3059\u3002";
    }
    return "\u534a\u8358\u30921\u56de\u7d42\u4e86\u3059\u308b\u3068\u3001\u3053\u3053\u306b\u6210\u7e3e\u304c\u8a18\u9332\u3055\u308c\u307e\u3059\u3002";
  }

  function renderStatsRankingControls() {
    if (!els.statsRankingKindSelect) return;
    const options = Object.entries(STATS_RANKING_METRICS)
      .map(([key, metric]) => `<option value="${escapeHtml(key)}">${escapeHtml(metric.label)}\u30e9\u30f3\u30ad\u30f3\u30b0</option>`)
      .join("");
    setHtmlIfChanged(els.statsRankingKindSelect, options);
    if (!STATS_RANKING_METRICS[statsRankingKind]) {
      statsRankingKind = "average_settlement_point";
    }
    if (els.statsRankingKindSelect.value !== statsRankingKind) {
      els.statsRankingKindSelect.value = statsRankingKind;
    }
    if (els.statsRankingMinInput) {
      statsRankingMinHanchanCount = normalizeRankingMinHanchanCount(statsRankingMinHanchanCount);
      if (String(els.statsRankingMinInput.value) !== String(statsRankingMinHanchanCount)) {
        els.statsRankingMinInput.value = String(statsRankingMinHanchanCount);
      }
    }
  }

  function renderStatsScreen() {
    const storage = loadStatsStorage();
    const localRecords = storage.records;
    const displayData = getStatsDisplayRecords(localRecords);
    const records = displayData.records;
    const hasRecords = records.length > 0;
    if (!hasRecords) statsResetConfirmVisible = false;
    setHiddenIfChanged(els.statsResetConfirm, !statsResetConfirmVisible);
    renderStatsMonthControls(records);
    renderStatsRankingControls();
    statsRecentCount = normalizeRecentStatsCount(statsRecentCount, records.length);
    const totalPages = Math.max(1, Math.ceil(records.length / STATS_HISTORY_PAGE_SIZE));
    statsHistoryPage = clampNumber(statsHistoryPage, 1, totalPages);

    setHiddenIfChanged(els.statsEmptyMessage, hasRecords);
    if (els.statsEmptyMessage) setTextIfChanged(els.statsEmptyMessage, statsEmptyMessageText(displayData.source, localRecords.length > 0));
    setHiddenIfChanged(els.statsContent, !hasRecords);
    setHiddenIfChanged(els.statsDataSourceStatus, true);
    if (els.statsSupabaseStatus) setTextIfChanged(els.statsSupabaseStatus, statsSupabaseStatusText);
    if (els.statsRankingStatus) setTextIfChanged(els.statsRankingStatus, statsRankingStatusText);
    if (els.statsSupabaseTable) setHtmlIfChanged(els.statsSupabaseTable, renderSupabaseStatsTable(statsSupabaseRecords));
    if (els.statsRankingTable) setHtmlIfChanged(els.statsRankingTable, renderRankingTable(statsRankingRows));
    if (els.statsPaifuCopyStatus) {
      setTextIfChanged(els.statsPaifuCopyStatus, statsPaifuCopyStatusText || "");
      els.statsPaifuCopyStatus.classList.toggle("is-error", statsPaifuCopyStatusIsError);
      setHiddenIfChanged(els.statsPaifuCopyStatus, !statsPaifuCopyStatusText);
    }
    setHiddenIfChanged(els.statsResetButton, !hasRecords);
    if (els.statsRecentCountInput) {
      els.statsRecentCountInput.max = String(Math.max(1, records.length));
      if (String(els.statsRecentCountInput.value) !== String(statsRecentCount)) {
        els.statsRecentCountInput.value = String(statsRecentCount);
      }
    }
    if (!hasRecords) {
      setHtmlIfChanged(els.statsSummaryTable, renderStatsSummaryTable([], statsRecentCount));
      setHtmlIfChanged(els.statsHistoryTable, renderHanchanHistoryTable([], 1));
      if (els.statsPageLabel) setTextIfChanged(els.statsPageLabel, "1 / 1");
      if (els.statsPrevPageButton) els.statsPrevPageButton.disabled = true;
      if (els.statsNextPageButton) els.statsNextPageButton.disabled = true;
      return;
    }
    setHtmlIfChanged(els.statsSummaryTable, renderStatsSummaryTable(records, statsRecentCount));
    setHtmlIfChanged(els.statsHistoryTable, renderHanchanHistoryTable(records, statsHistoryPage));
    if (els.statsPageLabel) setTextIfChanged(els.statsPageLabel, `${statsHistoryPage} / ${totalPages}`);
    if (els.statsPrevPageButton) els.statsPrevPageButton.disabled = statsHistoryPage <= 1;
    if (els.statsNextPageButton) els.statsNextPageButton.disabled = statsHistoryPage >= totalPages;
  }

  function hasPaifuSnapshots() {
    return Boolean(paifuReplay?.hands?.some((hand) => hand.snapshots?.length));
  }

  function currentPaifuHand() {
    return paifuReplay?.hands?.[paifuHandIndex] || null;
  }

  function currentPaifuSnapshot() {
    const hand = currentPaifuHand();
    return hand?.snapshots?.[paifuStepIndex] || null;
  }

  function setPaifuPosition(handIndex, stepIndex) {
    if (!hasPaifuSnapshots()) return;
    paifuHandIndex = clampNumber(Math.floor(Number(handIndex) || 0), 0, paifuReplay.hands.length - 1);
    const hand = currentPaifuHand();
    paifuStepIndex = clampNumber(Math.floor(Number(stepIndex) || 0), 0, Math.max(0, (hand?.snapshots?.length || 1) - 1));
    renderBattleTable();
  }

  function flattenPaifuSnapshots() {
    if (!hasPaifuSnapshots()) return [];
    return paifuReplay.hands.flatMap((hand, handIndex) =>
      (hand.snapshots || []).map((snapshot, stepIndex) => ({
        handIndex,
        stepIndex,
        snapshot,
      }))
    );
  }

  function currentPaifuFlatIndex(flatSnapshots = flattenPaifuSnapshots()) {
    return flatSnapshots.findIndex((entry) => entry.handIndex === paifuHandIndex && entry.stepIndex === paifuStepIndex);
  }

  function setPaifuFlatIndex(flatIndex) {
    const flatSnapshots = flattenPaifuSnapshots();
    const entry = flatSnapshots[flatIndex];
    if (!entry) return;
    setPaifuPosition(entry.handIndex, entry.stepIndex);
  }

  function movePaifuHand(offset) {
    if (!hasPaifuSnapshots()) return;
    const nextHandIndex = paifuHandIndex + offset;
    if (nextHandIndex < 0 || nextHandIndex >= paifuReplay.hands.length) return;
    setPaifuPosition(nextHandIndex, 0);
  }

  function isSelfDrawSnapshot(snapshot) {
    if (snapshot?.actionType !== "draw") return false;
    const actionIndex = Number.isInteger(snapshot.actionPlayerIndex) ? snapshot.actionPlayerIndex : snapshot.currentPlayerIndex;
    if (actionIndex === 0) return true;
    const actionPlayerId = snapshot.actionPlayerId || snapshot.currentPlayerId;
    const selfPlayerId = (snapshot.players || []).find((player) => player?.seat === "self" || player?.index === 0)?.id;
    return Boolean(actionPlayerId && selfPlayerId && actionPlayerId === selfPlayerId);
  }

  function findPaifuSelfDrawFlatIndex(direction) {
    const flatSnapshots = flattenPaifuSnapshots();
    const currentFlatIndex = currentPaifuFlatIndex(flatSnapshots);
    if (currentFlatIndex < 0) return -1;
    for (let index = currentFlatIndex + direction; index >= 0 && index < flatSnapshots.length; index += direction) {
      if (isSelfDrawSnapshot(flatSnapshots[index]?.snapshot)) return index;
    }
    return -1;
  }

  function movePaifuSelfDraw(direction) {
    const targetIndex = findPaifuSelfDrawFlatIndex(direction);
    if (targetIndex < 0) return;
    setPaifuFlatIndex(targetIndex);
  }

  function movePaifuStep(offset) {
    if (!hasPaifuSnapshots()) return;
    const hand = currentPaifuHand();
    const nextStep = paifuStepIndex + offset;
    if (nextStep >= 0 && nextStep < hand.snapshots.length) {
      setPaifuPosition(paifuHandIndex, nextStep);
      return;
    }
    if (offset > 0 && paifuHandIndex < paifuReplay.hands.length - 1) {
      setPaifuPosition(paifuHandIndex + 1, 0);
      return;
    }
    if (offset < 0 && paifuHandIndex > 0) {
      const previousHand = paifuReplay.hands[paifuHandIndex - 1];
      setPaifuPosition(paifuHandIndex - 1, Math.max(0, previousHand.snapshots.length - 1));
    }
  }

  function handlePaifuNextButton() {
    stopPaifuPlayback();
    movePaifuStep(1);
  }

  function movePaifuToLast() {
    if (!hasPaifuSnapshots()) return;
    const handIndex = Math.max(0, paifuReplay.hands.length - 1);
    const hand = paifuReplay.hands[handIndex];
    setPaifuPosition(handIndex, Math.max(0, (hand?.snapshots?.length || 1) - 1));
  }

  function isPaifuAtLast() {
    const hand = currentPaifuHand();
    return paifuHandIndex >= (paifuReplay?.hands?.length || 1) - 1 && paifuStepIndex >= (hand?.snapshots?.length || 1) - 1;
  }

  function startPaifuPlayback() {
    if (!hasPaifuSnapshots()) return;
    clearPaifuReplayTimer();
    paifuReplayTimer = window.setInterval(() => {
      if (isPaifuAtLast()) {
        stopPaifuPlayback();
        return;
      }
      movePaifuStep(1);
    }, PAIFU_REPLAY_INTERVAL_MS);
  }

  function stopPaifuPlayback() {
    clearPaifuReplayTimer();
  }

  function openPaifuScreen() {
    if (!hasPaifuSnapshots()) return;
    clearCpuTurnTimer();
    clearRiichiAutoDiscardTimer();
    clearAfterDiscardTimer();
    clearResultTransitionTimer();
    resetBattleEffectState();
    stopPaifuPlayback();
    showPaifuOpponentHands = false;
    paifuHandIndex = clampNumber(paifuHandIndex, 0, paifuReplay.hands.length - 1);
    paifuStepIndex = clampNumber(paifuStepIndex, 0, Math.max(0, (currentPaifuHand()?.snapshots?.length || 1) - 1));
    appScreen = "paifu";
    renderBattleTable();
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
      const chipScore = battleSettlementChipScore(player.chips);
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
    return "";
  }

  function currentSeatWind(playerIndex, dealerIndex) {
    const winds = ["\u6771", "\u5357", "\u897f"];
    return winds[(playerIndex - dealerIndex + 3) % 3] || "\u897f";
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
    if (value < 0) return `${value}`;
    return "0";
  }

  function formatScoreDisplay(wind, points, chipPoints) {
    return `${wind} ${formatDisplayPoints(points)} ${formatDisplayChipPoints(chipPoints)}`;
  }

  function renderCenterScoreDisplay(players = [], dealerIndex = null) {
    const bySeat = {};
    players.forEach((player, index) => {
      bySeat[playerDisplaySeat(player, index)] = { player, index };
    });
    return ["kamicha", "shimocha", "self"]
      .map((seat) => {
        const entry = bySeat[seat];
        const player = entry?.player;
        const wind = Number.isInteger(entry?.index) ? currentSeatWind(entry.index, dealerIndex) : "";
        const text = formatScoreDisplay(wind, playerDisplayPoints(player), playerDisplayChipPoints(player));
        const isDealer = player?.isDealer || entry?.index === dealerIndex;
        const classes = ["score-display", `${seat}-score`, isDealer ? "is-dealer" : ""].filter(Boolean).join(" ");
        return `<div class="${classes}">${escapeHtml(text)}</div>`;
      })
      .join("");
  }

  function setTextIfChanged(element, text) {
    if (element && element.textContent !== text) element.textContent = text;
  }

  function setHtmlIfChanged(element, html) {
    if (element && element.innerHTML !== html) element.innerHTML = html;
  }

  function setHiddenIfChanged(element, hidden) {
    if (element && element.hidden !== hidden) element.hidden = hidden;
  }

  function toggleClassIfChanged(element, className, enabled) {
    if (!element || element.classList.contains(className) === enabled) return;
    element.classList.toggle(className, enabled);
  }

  function renderCentralInfoPanel(gameState) {
    if (!gameState) return;
    const kyotakuCount = Math.max(0, Math.floor(Number(gameState.kyotaku) || 0));
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    const dealerPlayer = gameState.players[gameState.dealerIndex];
    const roundLabel = `${windText(gameState.roundWind)}${gameState.handNumber}局`;

    setTextIfChanged(els.battleRoundLabel, roundLabel);
    if (els.battleHonbaKyotakuLabel) {
      setTextIfChanged(els.battleHonbaKyotakuLabel, `${gameState.honba}本場 供託${kyotakuCount} 残${gameState.remainingDraws}`);
    }
    if (els.battleLandscapeRoundInfo) {
      setHtmlIfChanged(
        els.battleLandscapeRoundInfo,
        `<span class="landscape-round-line-main">${escapeHtml(roundLabel)}</span><span class="landscape-round-line-sub">${escapeHtml(`${gameState.honba}本場 供託${kyotakuCount}`)}</span><span class="landscape-round-line-remaining">残${escapeHtml(String(gameState.remainingDraws))}</span>`
      );
    }
    setTextIfChanged(els.battleRemainingDraws, `残 ${gameState.remainingDraws}`);
    setTextIfChanged(els.battleDealerLabel, `親 ${playerPositionLabel(dealerPlayer?.seat)}`);
    setTextIfChanged(els.battleKyotakuLabel, `手番 ${playerPositionLabel(currentPlayer?.seat)}`);
    setHtmlIfChanged(els.battleDoraIndicators, renderDoraIndicatorRow(gameState.doraIndicators));
    if (els.battlePlayerScores) {
      setHtmlIfChanged(els.battlePlayerScores, renderCenterScoreDisplay(gameState.players, gameState.dealerIndex));
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

  function formatBattleDelta(value, suffix = "") {
    const number = Number(value) || 0;
    if (number > 0) return `+${formatPlainNumber(number)}${suffix}`;
    if (number < 0) return `${formatPlainNumber(number)}${suffix}`;
    return `0${suffix}`;
  }

  function formatBattlePointDelta(value) {
    const number = roundBattleScore(value);
    const text = number.toFixed(1);
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
        return `<li>${escapeHtml(playerPositionLabel(seat))} ${escapeHtml(formatBattleDelta(record[seat], suffix))}</li>`;
      })
      .join("");
  }

  function formatResultPointDelta(value) {
    const number = Number(value) || 0;
    return `${number >= 0 ? "+" : ""}${formatPlainNumber(number)}点`;
  }

  function resultChipPointsToCount(value) {
    return Math.round((Number(value) || 0) / 500);
  }

  function formatResultChipDelta(value) {
    const number = resultChipPointsToCount(value);
    return `${number >= 0 ? "+" : ""}${formatPlainNumber(number)}枚`;
  }

  function formatResultChipCount(value) {
    const number = resultChipPointsToCount(value);
    if (number > 0) return `+${formatPlainNumber(number)}`;
    return formatPlainNumber(number);
  }

  function formatResultPointBefore(value) {
    return formatPlainNumber(Number(value) || 0);
  }

  function resultDeltaClass(value) {
    const number = Number(value) || 0;
    if (number > 0) return "result-delta-plus";
    if (number < 0) return "result-delta-minus";
    return "result-delta-zero";
  }

  function renderSimpleBattleResultRows(result) {
    const seats = [
      ["self", "自分"],
      ["shimocha", "下家"],
      ["kamicha", "上家"],
    ];
    const snapshotsBySeat = new Map((result.playerHandSnapshots || []).map((entry) => [entry.seat, entry]));
    const rows = seats
      .map(([seat, label]) => {
        const snapshot = snapshotsBySeat.get(seat);
        const pointValue = Number(result.pointChanges?.[seat]) || 0;
        const chipValue = Number(result.chipChanges?.[seat]) || 0;
        const pointsBeforeResult = (Number(snapshot?.points) || 0) - pointValue;
        const chipsBeforeResult = (Number(snapshot?.chips) || 0) - chipValue;
        const currentPointText = formatResultPointBefore(pointsBeforeResult);
        const currentChipText = formatResultChipCount(chipsBeforeResult);
        const pointText = formatResultPointDelta(pointValue);
        const chipText = formatResultChipDelta(chipValue);
        return `<div class="result-player-row">${escapeHtml(label)} ${escapeHtml(currentPointText)} <span class="${resultDeltaClass(pointValue)}">${escapeHtml(pointText)}</span>, ${escapeHtml(currentChipText)} <span class="${resultDeltaClass(chipValue)}">${escapeHtml(chipText)}</span></div>`;
      })
      .join("");
    return `<div class="result-player-rows">${rows}</div>`;
  }

  function renderResultTile(tile, modifier = "") {
    if (!tile) return "";
    const label = tile.name || tile.baseId || tile.id;
    return `<img class="result-tile-img ${modifier}" src="${escapeHtml(tile.image)}" alt="${escapeHtml(label)}" loading="lazy" />`;
  }

  function renderResultBackTile() {
    return `<img class="result-tile-img result-back-tile" src="${escapeHtml(Tiles.tileImagePath("blue_back"))}" alt="背面牌" loading="lazy" />`;
  }

  function renderFiveResultIndicatorSlots(indicators = [], shouldReveal = true) {
    return Array.from({ length: 5 }, (_, index) => {
      const tile = indicators?.[index];
      return shouldReveal && tile ? renderResultTile(tile) : renderResultBackTile();
    }).join("");
  }

  function renderResultDoraIndicatorRow(win, result) {
    if (win.isNagashiYakuman) return "";
    const doraIndicators = win.doraIndicators || result.doraIndicators || [];
    const uraDoraIndicators = win.uraDoraIndicators || result.uraDoraIndicators || [];
    const hasRiichiWinner = Boolean(result.wins?.some((entry) => entry.isRiichi) || win.isRiichi);
    return `
      <div class="result-dora-row" aria-label="表ドラと裏ドラ">
        <span class="result-dora-label">表ドラ：</span>
        <div class="result-dora-group">${renderFiveResultIndicatorSlots(doraIndicators, true)}</div>
        <div class="result-dora-spacer" aria-hidden="true"></div>
        <span class="result-dora-label">裏ドラ：</span>
        <div class="result-dora-group">${renderFiveResultIndicatorSlots(uraDoraIndicators, hasRiichiWinner)}</div>
      </div>
    `;
  }

  function renderResultTileRow(label, tiles = []) {
    if (label === "ドラ表示牌" || label === "裏ドラ表示牌") return "";
    if (!tiles.length) return "";
    return `
      <div class="result-detail-row">
        <span>${escapeHtml(label)}：</span>
        <div class="result-tile-row">${tiles.map((tile) => renderResultTile(tile)).join("")}</div>
      </div>
    `;
  }

  function renderResultHandTiles(win) {
    if (win.isNagashiYakuman) return "";
    return `
      <div class="result-detail-row result-hand-row">
        <span>手牌：</span>
        <div class="result-tile-row">
          ${(win.handTiles || []).map((tile) => renderResultTile(tile)).join("")}
          ${win.winningTile ? renderResultTile(win.winningTile, "winning-tile") : ""}
        </div>
      </div>
    `;
  }

  function renderResultMelds(win) {
    if (!win.melds?.length || win.isNagashiYakuman) return "";
    return `
      <div class="result-detail-row">
        <span>副露：</span>
        <div class="result-meld-row">${win.melds.map(renderMeld).join("")}</div>
      </div>
    `;
  }

  function renderResultFlowers(win) {
    if (!win.flowerTiles?.length || win.isNagashiYakuman) return "";
    return renderResultTileRow("華牌", win.flowerTiles);
  }

  function renderResultCompactHandLine(win) {
    if (win.isNagashiYakuman) return "";
    const handTiles = (win.handTiles || []).map((tile) => renderResultTile(tile)).join("");
    const winningTile = win.winningTile ? renderResultTile(win.winningTile, "winning-tile") : "";
    const meldTiles = (win.melds || []).map(renderMeld).join("");
    const flowerTiles = (win.flowerTiles || []).map((tile) => renderResultTile(tile)).join("");
    if (!handTiles && !winningTile && !meldTiles && !flowerTiles) return "";
    return `
      <div class="result-compact-hand-line">
        <span>手牌：</span>
        <div class="result-compact-hand-scroll">
          ${handTiles}
          ${winningTile}
          ${meldTiles}
          ${flowerTiles}
        </div>
      </div>
    `;
  }

  function renderResultOpponentHands(win) {
    const opponents = win.opponentHands || [];
    if (!opponents.length || win.isNagashiYakuman) return "";
    return `
      <div class="result-opponent-hands">
        ${opponents
          .map(
            (opponent) => `
              <div class="result-detail-row result-hand-row">
                <span>${escapeHtml(opponent.label)}手牌：</span>
                <div class="result-tile-row">${
                  opponent.revealHand
                    ? (opponent.handTiles || []).map((tile) => renderResultTile(tile)).join("")
                    : (opponent.handTiles || []).map(() => renderResultBackTile()).join("")
                }</div>
              </div>
            `
          )
          .join("")}
      </div>
    `;
  }

  function renderResultPlayerHandSnapshots(result) {
    const hands = result.playerHandSnapshots || [];
    if (!hands.length || result.type !== "ryukyoku") return "";
    return `
      <div class="result-ryukyoku-hands result-ryukyoku-status-list">
        ${hands
          .map((entry) => {
            const waitText = result.type === "ryukyoku"
              ? entry.isTenpai
                ? `テンパイ：${formatWinningTileNames(entry.winningTiles) || "-"}`
                : "ノーテン"
              : "";
            return `
              <article class="result-ryukyoku-player result-all-player-hand">
                <div class="result-ryukyoku-player-title">
                  ${escapeHtml(entry.displayName)}${waitText ? `　${escapeHtml(waitText)}` : ""}
                </div>
                <div class="result-ryukyoku-tile-row">
                  ${(entry.handTiles || []).map((tile) => renderResultTile(tile)).join("")}
                  ${entry.drawnTile ? renderResultTile(entry.drawnTile, "winning-tile") : ""}
                  ${(entry.melds || []).map(renderMeld).join("")}
                  ${(entry.flowerTiles || []).map((tile) => renderResultTile(tile)).join("")}
                </div>
              </article>
            `;
          })
          .join("")}
      </div>
    `;
  }

  function renderRyukyokuHandsIfNeeded(result) {
    const hands = result.ryukyokuHands || [];
    if (!["draw", "ryukyoku"].includes(result.type) || hands.length === 0) return "";
    return `
      <div class="result-ryukyoku-hands">
        ${hands
          .map((entry) => {
            const waitText = entry.isTenpai
              ? `テンパイ：${formatWinningTileNames(entry.winningTiles) || "-"}`
              : "ノーテン";
            return `
              <article class="result-ryukyoku-player">
                <div class="result-ryukyoku-player-title">${escapeHtml(entry.displayName)}　${escapeHtml(waitText)}</div>
                <div class="result-ryukyoku-tile-row">
                  ${(entry.handTiles || []).map((tile) => renderResultTile(tile)).join("")}
                  ${(entry.melds || []).map(renderMeld).join("")}
                </div>
              </article>
            `;
          })
          .join("")}
      </div>
    `;
  }

  function renderWinDetailIfNeeded(result) {
    const wins = result.wins || [];
    if (result.type === "ryukyoku" || wins.length === 0) return "";
    return `
      <div class="result-win-details">
        ${wins
          .map(
            (win) => `
              <article class="result-win-detail">
                ${wins.length > 1 ? `<strong>${escapeHtml(win.title)}</strong>` : ""}
                ${renderResultDoraIndicatorRow(win, result)}
                <div class="result-yaku-point-row">
                  <div class="result-detail-text result-yaku-text">${escapeHtml(win.yakuText)}</div>
                  <div class="result-detail-text result-point-text">${win.pointText}</div>
                </div>
                ${renderResultCompactHandLine(win)}
                ${renderResultHandTiles(win)}
                ${renderResultMelds(win)}
                ${renderResultFlowers(win)}
              </article>
            `
          )
          .join("")}
      </div>
    `;
  }

  function renderBattleResultPanel() {
    if (!els.battleResultPanel || !lastHandResult) return;
    const result = lastHandResult;
    els.battleResultTitle.textContent = `${result.roundLabel}${result.honbaBefore}本場 供託${result.kyotakuBefore}`;
    els.battleResultBody.innerHTML = `
      <div class="result-simple">
        ${renderWinDetailIfNeeded(result)}
        ${renderResultPlayerHandSnapshots(result)}
        ${renderSimpleBattleResultRows(result)}
      </div>
    `;
    const autoContinueCpuOorasu = shouldAutoContinueCpuOorasu(result);
    els.battleConfirmButton.hidden = result.requiresOorasuDealerChoice;
    els.battleContinueButton.hidden = !result.requiresOorasuDealerChoice || autoContinueCpuOorasu;
    els.battleEndButton.hidden = !result.requiresOorasuDealerChoice || autoContinueCpuOorasu;
    queueCpuOorasuContinueIfNeeded();
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
            <strong>${item.rank}位：${escapeHtml(displayPlayerNameForValue(item.name, item.index))}</strong>
            <span>最終持ち点：${formatPlainNumber(item.points)}</span>
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
    if (els.battlePaifuButton) {
      const hasReplay = hasPaifuSnapshots();
      els.battlePaifuButton.textContent = "牌譜参照";
      els.battlePaifuButton.disabled = !hasReplay;
      els.battlePaifuButton.title = hasReplay ? "" : "牌譜データがありません";
      setHiddenIfChanged(els.battlePaifuButton, false);
    }
    if (els.battleRestartButton) {
      els.battleRestartButton.textContent = "終了";
      els.battleRestartButton.disabled = false;
      els.battleRestartButton.title = "";
      setHiddenIfChanged(els.battleRestartButton, false);
    }
    if (els.battleSharePaifuButton) {
      const hasReplay = hasPaifuSnapshots();
      els.battleSharePaifuButton.textContent = paifuReplay?.shareId ? "牌譜URLを表示" : "牌譜URLを作成";
      els.battleSharePaifuButton.disabled = !hasReplay;
      els.battleSharePaifuButton.title = hasReplay ? "" : "牌譜データがありません";
      setHiddenIfChanged(els.battleSharePaifuButton, false);
    }
    if (els.battleCopyPaifuUrlButton) {
      const sharedUrl = paifuReplay?.sharedUrl || currentSharedPaifuUrl || "";
      setHiddenIfChanged(els.battleCopyPaifuUrlButton, !sharedUrl);
      els.battleCopyPaifuUrlButton.disabled = !sharedUrl;
    }
    if (els.battleSharePaifuStatus) {
      const sharedUrl = paifuReplay?.sharedUrl || currentSharedPaifuUrl || "";
      els.battleSharePaifuStatus.textContent = sharedUrl ? `共有URL: ${sharedUrl}` : "";
      els.battleSharePaifuStatus.classList.remove("is-error");
      setHiddenIfChanged(els.battleSharePaifuStatus, !sharedUrl);
    }
  }

  function renderBattleScreenPanels() {
    maybePlayScreenTransitionSound();
    const isResult = appScreen === "result";
    const isSettlement = appScreen === "settlement";
    const isRules = appScreen === "rules";
    const isStats = appScreen === "stats";
    const isSettings = appScreen === "settings";
    const isPaifu = appScreen === "paifu";
    const isResume = appScreen === "resume";
    toggleClassIfChanged(els.battleSurface, "is-start-screen", appScreen === "start");
    toggleClassIfChanged(els.battleSurface, "is-rules-screen", isRules);
    toggleClassIfChanged(els.battleSurface, "is-stats-screen", isStats);
    toggleClassIfChanged(els.battleSurface, "is-settings-screen", isSettings);
    toggleClassIfChanged(els.battleSurface, "is-paifu-screen", isPaifu);
    toggleClassIfChanged(els.battleSurface, "is-resume-screen", isResume);
    setHiddenIfChanged(els.battleResultPanel, !isResult);
    setHiddenIfChanged(els.battleSettlementPanel, !isSettlement);
    setHiddenIfChanged(els.paifuPanel, !isPaifu);
    setHiddenIfChanged(els.rulesScreen, !isRules);
    setHiddenIfChanged(els.statsScreen, !isStats);
    setHiddenIfChanged(els.settingsScreen, !isSettings);
    setHiddenIfChanged(els.resumeRequiredScreen, !isResume);
    setHiddenIfChanged(els.battleStartButton, appScreen !== "start");
    setHiddenIfChanged(els.battleActionButtons, appScreen !== "playing");
    toggleClassIfChanged(els.battleResultPanel, "result-transparent", isResult && resultTransparent);
    if (isResult) renderBattleResultPanel();
    if (isResult) updateResultPanelBounds();
    if (isSettlement) renderBattleSettlementPanel();
    if (isStats) renderStatsScreen();
    if (isSettings) renderSettingsScreen();
    if (isPaifu) renderPaifuPanel();
    if (isFuroDebugScenario) {
      // Display-only debug scene; never overwrite a resumable hanchan save.
    } else if (isSettlement && !isSettlementPreview) {
      clearInProgressHanchanSave();
    } else if (appScreen === "playing" || appScreen === "result") {
      saveInProgressHanchan();
    }
  }

  function battleEffectSignature(gameState) {
    const action = gameState?.lastAction;
    if (!action) return "";
    return [
      action.type || "",
      action.playerIndex ?? "",
      action.winnerIndex ?? "",
      action.discarderIndex ?? "",
      action.tileId || "",
      action.effect || "",
      (action.flowers || []).join("|"),
      gameState.phase || "",
    ].join(":");
  }

  function flowerEffectTone(tileId) {
    const definition = Tiles.getTileDefinition?.(tileId);
    if (definition?.color === "blue" || String(tileId).includes("flower_blue")) return "flower-blue";
    return "flower-red";
  }

  function battleEffectPlayerIndex(gameState, action) {
    if (Number.isInteger(action?.winnerIndex)) return action.winnerIndex;
    if (Number.isInteger(action?.playerIndex)) return action.playerIndex;
    return Number.isInteger(gameState?.currentPlayerIndex) ? gameState.currentPlayerIndex : 0;
  }

  function battleEffectClassForAction(action, effectText = "") {
    const text = String(effectText || "");
    if (action?.nagashiYakuman || hasExplicitYakuman(action?.evaluation) || text.includes("役満")) return "effect-yakuman";
    if (action?.type === "win") return action.winType === "tsumo" ? "effect-tsumo" : "effect-ron";
    if (text === "リーチ") return "effect-riichi";
    if (action?.type === "riichi" || action?.type === "riichiDeclaration") return "effect-riichi";
    if (action?.type === "pon") return "effect-pon";
    if (action?.type === "kan" || action?.afterKan) return "effect-kan";
    if (action?.type === "ryukyoku") return "effect-ryukyoku";
    return "effect-standard";
  }

  function battleEffectDurationMsForClasses(classes = "") {
    return String(classes).includes("effect-yakuman") ? YAKUMAN_EFFECT_DURATION_MS : BATTLE_EFFECT_DURATION_MS;
  }

  function battleEffectItemsForAction(gameState) {
    const action = gameState?.lastAction;
    if (!action) return [];
    const playerIndex = action.type === "ryukyoku" ? null : battleEffectPlayerIndex(gameState, action);
    const flowers = Array.isArray(action.flowers) ? action.flowers : [];
    const flowerItems = flowers.map((tileId) => ({
      text: "マーチャオ",
      playerIndex,
      classes: `marchao ${flowerEffectTone(tileId)}`,
    }));
    if (action.type === "flower" && action.tileId) {
      flowerItems.push({
        text: "マーチャオ",
        playerIndex,
        classes: `marchao ${flowerEffectTone(action.tileId)}`,
      });
    }
    const effectText = action.effect || (action.afterKan ? gameState.lastEffect : "") || (action.type === "ryukyoku" ? "流局" : "");
    const actionEffect = effectText
      ? [{ text: effectText, playerIndex, classes: battleEffectClassForAction(action, effectText) }]
      : [];
    return [...flowerItems, ...actionEffect];
  }

  function clampNumber(value, min, max) {
    if (min > max) return (min + max) / 2;
    return Math.min(max, Math.max(min, value));
  }

  function effectRectFromCenter(size, x, y) {
    return {
      left: x - size.width / 2,
      right: x + size.width / 2,
      top: y - size.height / 2,
      bottom: y + size.height / 2,
    };
  }

  function expandRect(rect, margin) {
    return {
      left: rect.left - margin,
      right: rect.right + margin,
      top: rect.top - margin,
      bottom: rect.bottom + margin,
    };
  }

  function rectsOverlap(first, second) {
    return first.left < second.right && first.right > second.left && first.top < second.bottom && first.bottom > second.top;
  }

  function overlapArea(first, second) {
    if (!rectsOverlap(first, second)) return 0;
    return Math.max(0, Math.min(first.right, second.right) - Math.max(first.left, second.left)) *
      Math.max(0, Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top));
  }

  function clampEffectPoint(point, size, bounds, margin) {
    return {
      x: clampNumber(point.x, bounds.left + margin + size.width / 2, bounds.right - margin - size.width / 2),
      y: clampNumber(point.y, bounds.top + margin + size.height / 2, bounds.bottom - margin - size.height / 2),
    };
  }

  function isRectInsideBounds(rect, bounds, margin) {
    return (
      rect.left >= bounds.left + margin &&
      rect.right <= bounds.right - margin &&
      rect.top >= bounds.top + margin &&
      rect.bottom <= bounds.bottom - margin
    );
  }

  function battleEffectMeasuredSize(effectEl) {
    const scale = effectEl.classList.contains("effect-yakuman") ? 1.28 : 1.18;
    return {
      width: Math.max(1, effectEl.offsetWidth) * scale + 32,
      height: Math.max(1, effectEl.offsetHeight) * scale + 32,
    };
  }

  function visibleCenterPanelRect() {
    const panel = els.battleSurface?.querySelector(".center-tableau") || document.querySelector(".center-tableau");
    if (!panel || panel.closest("[hidden]")) return null;
    const rect = panel.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    return rect;
  }

  function battleEffectSeat(gameState, playerIndex) {
    if (!Number.isInteger(playerIndex)) return "self";
    return gameState?.players?.[playerIndex]?.seat || "self";
  }

  function fitSideBattleEffect(effectEl, seat, panelRect, viewportWidth) {
    effectEl.style.removeProperty("font-size");
    let size = battleEffectMeasuredSize(effectEl);
    if (effectEl.classList.contains("effect-riichi")) return size;
    if (seat !== "shimocha" && seat !== "kamicha") return size;

    const sideWidth = seat === "shimocha"
      ? viewportWidth - panelRect.right - EFFECT_PANEL_MARGIN - EFFECT_SCREEN_MARGIN
      : panelRect.left - EFFECT_PANEL_MARGIN - EFFECT_SCREEN_MARGIN;
    if (sideWidth <= 0 || size.width <= sideWidth) return size;

    const currentFontSize = parseFloat(window.getComputedStyle(effectEl).fontSize) || 64;
    const nextFontSize = Math.max(28, currentFontSize * Math.min(1, sideWidth / size.width));
    if (nextFontSize < currentFontSize) {
      effectEl.style.fontSize = `${nextFontSize}px`;
      size = battleEffectMeasuredSize(effectEl);
    }
    return size;
  }

  function positionSideBattleEffect(effectEl, seat, panelRect, bounds, viewportWidth, viewportHeight) {
    const size = fitSideBattleEffect(effectEl, seat, panelRect, viewportWidth);
    const panelCenterY = panelRect.top + panelRect.height / 2;
    const point = {
      x:
        seat === "shimocha"
          ? panelRect.right + size.width / 2 + EFFECT_PANEL_MARGIN
          : panelRect.left - size.width / 2 - EFFECT_PANEL_MARGIN,
      y: panelCenterY,
    };
    const clamped = clampEffectPoint(point, size, bounds, EFFECT_SCREEN_MARGIN);
    effectEl.style.left = `${clamped.x}px`;
    effectEl.style.top = `${clamped.y}px`;
  }

  function battleEffectPanelCandidates(seat, panelRect, size, viewportWidth, viewportHeight) {
    const panelCenter = {
      x: panelRect.left + panelRect.width / 2,
      y: panelRect.top + panelRect.height / 2,
    };
    const below = {
      x: panelCenter.x,
      y: panelRect.bottom + size.height / 2 + EFFECT_PANEL_MARGIN,
    };
    const above = {
      x: panelCenter.x,
      y: panelRect.top - size.height / 2 - EFFECT_PANEL_MARGIN,
    };
    const right = {
      x: panelRect.right + size.width / 2 + EFFECT_PANEL_MARGIN,
      y: panelCenter.y,
    };
    const left = {
      x: panelRect.left - size.width / 2 - EFFECT_PANEL_MARGIN,
      y: panelCenter.y,
    };
    const rightBelow = {
      x: right.x,
      y: panelRect.bottom + size.height / 2 + EFFECT_PANEL_MARGIN,
    };
    const rightAbove = {
      x: right.x,
      y: panelRect.top - size.height / 2 - EFFECT_PANEL_MARGIN,
    };
    const leftBelow = {
      x: left.x,
      y: panelRect.bottom + size.height / 2 + EFFECT_PANEL_MARGIN,
    };
    const leftAbove = {
      x: left.x,
      y: panelRect.top - size.height / 2 - EFFECT_PANEL_MARGIN,
    };
    const lowerCenter = { x: viewportWidth / 2, y: viewportHeight * 0.72 };
    const upperCenter = { x: viewportWidth / 2, y: viewportHeight * 0.25 };
    const screenCenter = { x: viewportWidth / 2, y: viewportHeight * 0.5 };

    if (seat === "shimocha") return [right, rightBelow, rightAbove, below, above, left, lowerCenter, upperCenter, screenCenter];
    if (seat === "kamicha") return [left, leftBelow, leftAbove, below, above, right, lowerCenter, upperCenter, screenCenter];
    return [below, above, right, left, lowerCenter, upperCenter, screenCenter];
  }

  function positionBattleEffect(gameState, playerIndex) {
    if (!els.battleEffect) return;
    const effectEl = els.battleEffect;
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 1;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 1;
    const bounds = { left: 0, top: 0, right: viewportWidth, bottom: viewportHeight };
    const panelRect = visibleCenterPanelRect();
    if (!panelRect) {
      const size = battleEffectMeasuredSize(effectEl);
      const point = clampEffectPoint({ x: viewportWidth / 2, y: viewportHeight * 0.5 }, size, bounds, EFFECT_SCREEN_MARGIN);
      effectEl.style.left = `${point.x}px`;
      effectEl.style.top = `${point.y}px`;
      return;
    }
    const seat = battleEffectSeat(gameState, playerIndex);
    if (seat === "shimocha" || seat === "kamicha") {
      positionSideBattleEffect(effectEl, seat, panelRect, bounds, viewportWidth, viewportHeight);
      return;
    }
    effectEl.style.removeProperty("font-size");
    const size = battleEffectMeasuredSize(effectEl);
    const protectedPanelRect = expandRect(panelRect, EFFECT_PANEL_MARGIN);
    const candidates = battleEffectPanelCandidates(seat, panelRect, size, viewportWidth, viewportHeight);
    const normalizedCandidates = candidates.map((candidate) => {
      const point = clampEffectPoint(candidate, size, bounds, EFFECT_SCREEN_MARGIN);
      return { point, rect: effectRectFromCenter(size, point.x, point.y) };
    });
    const valid = normalizedCandidates.find(({ rect }) => {
      return isRectInsideBounds(rect, bounds, EFFECT_SCREEN_MARGIN) && (!protectedPanelRect || !rectsOverlap(rect, protectedPanelRect));
    });
    const fallback = normalizedCandidates.reduce((best, current) => {
      if (!protectedPanelRect) return best;
      return overlapArea(current.rect, protectedPanelRect) < overlapArea(best.rect, protectedPanelRect) ? current : best;
    }, normalizedCandidates[0]);
    const chosen = valid || fallback;
    effectEl.style.left = `${chosen.point.x}px`;
    effectEl.style.top = `${chosen.point.y}px`;
  }

  function renderActiveBattleEffect() {
    if (!els.battleEffect) return;
    if (!activeBattleEffect) {
      els.battleEffect.textContent = "";
      els.battleEffect.hidden = true;
      els.battleEffect.className = "battle-effect";
      els.battleEffect.style.removeProperty("font-size");
      return;
    }
    els.battleEffect.textContent = activeBattleEffect.text;
    els.battleEffect.className = `battle-effect is-active ${activeBattleEffect.classes || ""}`.trim();
    els.battleEffect.hidden = false;
    positionBattleEffect(battleState, activeBattleEffect.playerIndex);
  }

  function playNextBattleEffect() {
    window.clearTimeout(battleEffectTimer);
    activeBattleEffect = battleEffectQueue.shift() || null;
    renderActiveBattleEffect();
    if (!activeBattleEffect) return;
    playBattleEffectSound(activeBattleEffect);
    battleEffectTimer = window.setTimeout(() => {
      activeBattleEffect = null;
      renderActiveBattleEffect();
      playNextBattleEffect();
    }, battleEffectDurationMsForClasses(activeBattleEffect.classes));
  }

  function pushBattleEffectItem(item) {
    if (!item?.text) return;
    battleEffectQueue.push(item);
    if (!activeBattleEffect) playNextBattleEffect();
  }

  function queueRiichiEffectIfJustFinalized(previousGameState, nextGameState) {
    const pending = previousGameState?.pendingRiichi;
    if (!pending || !Number.isInteger(pending.playerIndex)) return;
    const beforePlayer = previousGameState?.players?.[pending.playerIndex];
    const afterPlayer = nextGameState?.players?.[pending.playerIndex];
    if (!afterPlayer?.isRiichi || beforePlayer?.isRiichi) return;
    if (nextGameState?.lastAction?.type === "riichi" && nextGameState.lastAction.playerIndex === pending.playerIndex) {
      return;
    }
    pushBattleEffectItem({
      text: "リーチ",
      playerIndex: pending.playerIndex,
      classes: "effect-riichi",
    });
  }

  function queueBattleEffects(gameState) {
    const signature = battleEffectSignature(gameState);
    if (!signature || signature === lastBattleEffectSignature) return;
    lastBattleEffectSignature = signature;
    const items = battleEffectItemsForAction(gameState);
    if (items.length === 0) return;
    battleEffectQueue.push(...items);
    if (!activeBattleEffect) playNextBattleEffect();
  }

  function renderBattleEffect(gameState) {
    if (!els.battleEffect) return;
    if (appScreen !== "playing") {
      window.clearTimeout(battleEffectTimer);
      activeBattleEffect = null;
      battleEffectQueue = [];
      renderActiveBattleEffect();
      return;
    }
    queueBattleEffects(gameState);
    renderActiveBattleEffect();
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

  function sortedBattleTilesForSeat(tiles, seat) {
    const sorted = sortedBattleTiles(tiles);
    return seat === "shimocha" ? sorted.reverse() : sorted;
  }

  function battleWinActionWinnerIndexes(gameState = battleState) {
    const action = gameState?.lastAction || {};
    if (action.type !== "win") return [];
    if (Array.isArray(action.winnerIndexes)) return action.winnerIndexes.filter(Number.isInteger);
    if (Number.isInteger(action.winnerIndex)) return [action.winnerIndex];
    return [];
  }

  function isBattleWinPlayerIndex(playerIndex, gameState = battleState) {
    return battleWinActionWinnerIndexes(gameState).includes(playerIndex);
  }

  function battleTileBaseId(tile) {
    if (!tile) return "";
    return tile.baseId || Tiles.getTileDefinition?.(tile)?.baseId || Tiles.getTileDefinition?.(tile.id)?.baseId || tile.id || "";
  }

  function isPonDiscardRestrictedTile(tile, playerIndex) {
    const restriction = battleState?.ponDiscardRestriction;
    if (!restriction || battleState?.phase !== "discard") return false;
    if (restriction.playerIndex !== playerIndex) return false;
    const player = battleState.players?.[playerIndex];
    if (player?.seat !== "self") return false;
    return battleTileBaseId(tile) === restriction.baseTileId;
  }

  function isInitialFlowerDiscardRestrictedTile(tile, playerIndex) {
    if (!tile?.isFlower || battleState?.phase !== "discard") return false;
    const player = battleState?.players?.[playerIndex];
    if (player?.seat !== "self") return false;
    return player.hasHadFirstDrawTurnThisHand === false;
  }

  function isDisabledBattleDiscardTile(tile, playerIndex) {
    return isPonDiscardRestrictedTile(tile, playerIndex) || isInitialFlowerDiscardRestrictedTile(tile, playerIndex);
  }

  function shouldRevealTenpaiHandInRyukyoku(gameState, playerIndex) {
    if (!gameState || gameState.phase !== "ryukyoku") return false;
    const player = gameState.players?.[playerIndex];
    if (!player || player.seat === "self") return false;
    const tenpaiIndexes = gameState.lastAction?.tenpaiPlayerIndexes || [];
    return tenpaiIndexes.includes(playerIndex);
  }

  function drawnTileIdForPlayer(playerIndex) {
    if (
      battleState?.lastAction?.type === "win" &&
      battleState.lastAction.winType === "tsumo" &&
      isBattleWinPlayerIndex(playerIndex, battleState)
    ) {
      return battleState.lastAction.winningTile?.id || "";
    }
    if (
      (battleState?.phase === "discard" || battleState?.phase === "actionPending") &&
      (battleState.lastAction?.type === "draw" || battleState.lastAction?.type === "riichiDeclaration") &&
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
      if (!drawnTile && isTrackedDraw) {
        drawnTile = tile;
      } else {
        concealed.push(tile);
      }
    });

    return {
      concealed: sortedBattleTilesForSeat(concealed, playerDisplaySeat(player, playerIndex)),
      drawnTile,
    };
  }

  function renderSelfHand(player, playerIndex, canDiscard) {
    const display = splitHandForDisplay(player, playerIndex);
    const normalTiles = display.concealed
      .map((tile) => {
        const canDiscardTile = canDiscard && canSelectBattleDiscard(tile, playerIndex);
        const restrictedClass = isDisabledBattleDiscardTile(tile, playerIndex) ? " is-disabled-discard" : "";
        return renderBattleTile(tile, canDiscardTile ? "discardable" : `discard-disabled${restrictedClass}`, canDiscardTile);
      })
      .join("");
    const canDiscardDrawnTile = display.drawnTile && canDiscard && canSelectBattleDiscard(display.drawnTile, playerIndex);
    const drawnRestrictedClass = display.drawnTile && isDisabledBattleDiscardTile(display.drawnTile, playerIndex)
      ? " is-disabled-discard"
      : "";
    const drawnTile = display.drawnTile
      ? renderBattleTile(
          display.drawnTile,
          canDiscardDrawnTile
            ? "discardable drawn"
            : `drawn discard-disabled${drawnRestrictedClass}`,
          canDiscardDrawnTile
        )
      : "";
    return normalTiles + drawnTile;
  }

  function renderOpenBattleHand(player, playerIndex, modifier = "") {
    const display = splitHandForDisplay(player, playerIndex);
    const classPrefix = modifier ? `${modifier} ` : "";
    const normalTiles = display.concealed
      .map((tile) => renderBattleTile(tile, `${classPrefix}discard-disabled`.trim()))
      .join("");
    const drawnTile = display.drawnTile
      ? renderBattleTile(display.drawnTile, `${classPrefix}drawn discard-disabled`.trim())
      : "";
    return playerDisplaySeat(player, playerIndex) === "shimocha"
      ? drawnTile + normalTiles
      : normalTiles + drawnTile;
  }

  function canSelectBattleDiscard(tile, playerIndex) {
    if (isDisabledBattleDiscardTile(tile, playerIndex)) return false;
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
    if (meld.calledFromSeat === "toimen") return Math.floor(tiles.length / 2);
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
    if (meld.calledFromSeat === "toimen") {
      const middleIndex = Math.min(1, handTiles.length);
      return [...handTiles.slice(0, middleIndex), calledTile, ...handTiles.slice(middleIndex)];
    }
    if (meld.calledFromSeat === "shimocha") return [...handTiles, calledTile];
    return tiles;
  }

  function arrangeShimochaCalledMeldTiles(meld) {
    const tiles = meldBaseTiles(meld);
    if (meld?.type === "ankan" || !meld?.calledTile) return tiles;
    const calledTile = meld.calledTile;
    const handTiles = tiles.filter((tile) => tile.id !== calledTile.id);
    if (meld.calledFromSeat === "shimocha") return [calledTile, ...handTiles];
    if (meld.calledFromSeat === "toimen") {
      const middleIndex = Math.min(1, handTiles.length);
      return [...handTiles.slice(0, middleIndex), calledTile, ...handTiles.slice(middleIndex)];
    }
    if (meld.calledFromSeat === "kamicha") return [...handTiles, calledTile];
    return tiles;
  }

  function calledTileIndexInArrangedMeld(meld, tiles) {
    if (!meld || meld.type === "ankan" || !meld.calledTile) return null;
    const index = tiles.findIndex((tile) => tile.id === meld.calledTile.id);
    return index >= 0 ? index : null;
  }

  function renderMeldTileImage(tile, classes = "", useBack = false) {
    if (!tile && !useBack) return "";
    const src = useBack ? Tiles.tileImagePath("blue_back") : tile.image;
    const label = useBack ? "裏向き牌" : tile.name || tile.baseId || tile.id;
    return `<img class="table-tile-img meld-tile ${classes}" src="${escapeHtml(src)}" alt="${escapeHtml(label)}" loading="lazy" />`;
  }

  function renderMeldTile(tile, classes = "", useBack = false) {
    const slotClasses = [
      "meld-tile-slot",
      classes.includes("called-tile") ? "is-horizontal" : "is-vertical",
      useBack ? "is-back" : "",
    ]
      .filter(Boolean)
      .join(" ");
    return `<span class="${slotClasses}">${renderMeldTileImage(tile, classes, useBack)}</span>`;
  }

  function renderKamichaMeldTile(tile, orientation = "vertical", classes = "", useBack = false) {
    const slotClasses = [
      "meld-tile-slot",
      orientation === "horizontal" ? "is-horizontal" : "is-vertical",
      useBack ? "is-back" : "",
    ]
      .filter(Boolean)
      .join(" ");
    return `<span class="${slotClasses}">${renderMeldTileImage(tile, classes, useBack)}</span>`;
  }

  function renderKamichaKakanPair(calledTile, addedTile) {
    return `
      <span class="kamicha-kakan-pair">
        ${renderKamichaMeldTile(calledTile, "vertical", "called-tile")}
        ${renderKamichaMeldTile(addedTile, "vertical", "added-kan-tile")}
      </span>
    `;
  }

  function renderKamichaMeld(meld) {
    if (!meld) return "";
    if (meld.type === "ankan") {
      const tiles = meldBaseTiles(meld);
      return `
        <div class="meld-group kamicha-meld ankan">
          ${renderKamichaMeldTile(tiles[0], "horizontal", "", true)}
          ${renderKamichaMeldTile(tiles[1], "horizontal")}
          ${renderKamichaMeldTile(tiles[2], "horizontal")}
          ${renderKamichaMeldTile(tiles[3], "horizontal", "", true)}
        </div>
      `;
    }

    const tiles = arrangeCalledMeldTiles(meld);
    const calledIndex = calledTileIndexForMeld(meld, tiles);
    return `
      <div class="meld-group kamicha-meld ${escapeHtml(meld.type || "")}">
        ${tiles
          .map((tile, index) => {
            const isCalled = index === calledIndex;
            if (meld.type === "kakan" && isCalled && meld.addedTile) {
              return renderKamichaKakanPair(tile, meld.addedTile);
            }
            return renderKamichaMeldTile(tile, isCalled ? "vertical" : "horizontal", isCalled ? "called-tile" : "");
          })
          .join("")}
      </div>
    `;
  }

  function renderShimochaMeldTile(tile, orientation = "vertical", classes = "", useBack = false) {
    const slotClasses = [
      "meld-tile-slot",
      orientation === "horizontal" ? "is-horizontal" : "is-vertical",
      useBack ? "is-back" : "",
    ]
      .filter(Boolean)
      .join(" ");
    return `<span class="${slotClasses}">${renderMeldTileImage(tile, classes, useBack)}</span>`;
  }

  function renderShimochaKakanPair(calledTile, addedTile) {
    return `
      <span class="shimocha-kakan-pair">
        ${renderShimochaMeldTile(addedTile, "vertical", "added-kan-tile")}
        ${renderShimochaMeldTile(calledTile, "vertical", "called-tile")}
      </span>
    `;
  }

  function renderShimochaMeld(meld) {
    if (!meld) return "";
    if (meld.type === "ankan") {
      const tiles = meldBaseTiles(meld);
      return `
        <div class="meld-group shimocha-meld ankan">
          ${renderShimochaMeldTile(tiles[0], "horizontal", "", true)}
          ${renderShimochaMeldTile(tiles[1], "horizontal")}
          ${renderShimochaMeldTile(tiles[2], "horizontal")}
          ${renderShimochaMeldTile(tiles[3], "horizontal", "", true)}
        </div>
      `;
    }

    const tiles = arrangeShimochaCalledMeldTiles(meld);
    const calledIndex = calledTileIndexInArrangedMeld(meld, tiles);
    return `
      <div class="meld-group shimocha-meld ${escapeHtml(meld.type || "")}">
        ${tiles
          .map((tile, index) => {
            const isCalled = index === calledIndex;
            if (meld.type === "kakan" && isCalled && meld.addedTile) {
              return renderShimochaKakanPair(tile, meld.addedTile);
            }
            return renderShimochaMeldTile(tile, isCalled ? "vertical" : "horizontal", isCalled ? "called-tile" : "");
          })
          .join("")}
      </div>
    `;
  }

  function renderMeld(meld, seat = "") {
    if (!meld) return "";
    if (seat === "kamicha") {
      return renderKamichaMeld(meld);
    }
    if (seat === "shimocha") {
      return renderShimochaMeld(meld);
    }
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
                <span class="meld-tile-slot is-horizontal is-kakan-stack">
                  <span class="called-tile-stack">
                    ${renderMeldTileImage(tile, "kakan-stack-tile")}
                    ${renderMeldTileImage(meld.addedTile, "kakan-stack-tile added-kan-tile")}
                  </span>
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
    return [...(player?.melds || [])].reverse().map((meld) => renderMeld(meld, player?.seat)).join("");
  }

  function orderDiscardsForRiver(player) {
    return [...(player?.discards || [])];
  }

  function isRiichiDiscardMarker(discard) {
    return Boolean(discard?.isRiichiDeclaration || discard?.isRiichiMarkerReplacement);
  }

  function chunkRiverDiscards(discards, size = 6) {
    const chunks = [];
    for (let index = 0; index < discards.length; index += size) {
      chunks.push(discards.slice(index, index + size));
    }
    return chunks;
  }

  function renderDiscardTileSlot(player, discard, extraAttributes = "") {
    const tile = discardTileOf(discard);
    if (!tile) return "";
    const seat = player?.seat || "self";
    const rotationClass = tileRotationClassForSeat(seat);
    const isRiichiMarker = isRiichiDiscardMarker(discard);
    const tileClasses = [
      "river-tile",
      rotationClass,
      discard?.isTsumogiri ? "tsumogiri" : "",
      isRiichiMarker ? "riichi-discard" : "",
      discard?.isRiichiMarkerReplacement ? "riichi-marker-replacement" : "",
    ]
      .filter(Boolean)
      .join(" ");
    const slotClasses = [
      "river-tile-slot",
      `river-slot-${seat}`,
      isRiichiMarker ? "is-riichi-marker" : "is-normal",
    ]
      .filter(Boolean)
      .join(" ");
    const attributes = extraAttributes ? ` ${extraAttributes}` : "";
    return `<span class="${slotClasses}"${attributes}>${renderBattleTile(tile, tileClasses)}</span>`;
  }

  function renderDiscardRiver(player) {
    const seat = player?.seat || "self";
    const discards = orderDiscardsForRiver(player);
    const groups = chunkRiverDiscards(discards);
    if (seat === "self") {
      return groups
        .map((row) => `<div class="river-line river-line-self">${row.map((discard) => renderDiscardTileSlot(player, discard)).join("")}</div>`)
        .join("");
    }
    const columnClass = seat === "kamicha" ? "river-column-kamicha" : "river-column-shimocha";
    return groups
      .map((column) => {
        const riichiClass = column.some(isRiichiDiscardMarker) ? "has-riichi-discard" : "no-riichi-discard";
        return `<div class="river-column ${columnClass} ${riichiClass}">${column.map((discard) => renderDiscardTileSlot(player, discard)).join("")}</div>`;
      })
      .join("");
  }

  function paifuSnapshotToGameState(snapshot) {
    if (!snapshot) return null;
    return {
      roundWind: snapshot.roundWind,
      handNumber: snapshot.handNumber,
      honba: Number(snapshot.honba) || 0,
      kyotaku: Math.max(0, Math.floor(Number(snapshot.kyotaku) || 0)),
      remainingDraws: Math.max(0, Number(snapshot.remainingDraws) || 0),
      currentPlayerIndex: Number.isInteger(snapshot.currentPlayerIndex) ? snapshot.currentPlayerIndex : 0,
      dealerIndex: Number.isInteger(snapshot.dealerIndex) ? snapshot.dealerIndex : 0,
      players: clonePaifuData(snapshot.players || []).map((player, index) => ({
        ...player,
        name: displayPlayerNameByIndex(index),
        seat: player.seat || playerDisplaySeat(player, index),
        isDealer: index === snapshot.dealerIndex,
        isCpu: index !== 0,
      })),
      doraIndicators: clonePaifuData(snapshot.doraIndicators || []),
      uraDoraIndicators: clonePaifuData(snapshot.uraDoraIndicators || []),
      phase: "paifu",
      lastAction: null,
    };
  }

  function renderPaifuOpenHand(player, modifier = "") {
    return sortedBattleTiles(player?.hand || [])
      .map((tile) => renderBattleTile(tile, ["paifu-tile", modifier].filter(Boolean).join(" ")))
      .join("");
  }

  function renderPaifuSideHand(player) {
    if (!showPaifuOpponentHands) {
      return renderBackTiles(player?.hand?.length || 0, `side ${tileRotationClassForSeat(player?.seat)}`);
    }
    const rotationClass = tileRotationClassForSeat(player?.seat);
    return renderPaifuOpenHand(player, `side ${rotationClass}`);
  }

  function renderPaifuPanel() {
    if (!els.paifuPanel) return;
    const snapshot = currentPaifuSnapshot();
    const hand = currentPaifuHand();
    if (!snapshot || !hand) {
      setTextIfChanged(els.paifuTitle, "牌譜");
      setTextIfChanged(els.paifuStepLabel, "牌譜がありません");
      setTextIfChanged(els.paifuActionText, "-");
      return;
    }
    setTextIfChanged(els.paifuTitle, `${snapshot.roundLabel}${snapshot.honba}本場`);
    setTextIfChanged(
      els.paifuStepLabel,
      `${paifuHandIndex + 1}/${paifuReplay.hands.length}局  ${paifuStepIndex + 1}/${hand.snapshots.length}手`
    );
    setTextIfChanged(els.paifuActionText, paifuDisplayActionText(snapshot, hand));
    const flatSnapshots = flattenPaifuSnapshots();
    const currentFlatIndex = currentPaifuFlatIndex(flatSnapshots);
    const firstDisabled = currentFlatIndex <= 0;
    const lastDisabled = currentFlatIndex < 0 || currentFlatIndex >= flatSnapshots.length - 1;
    if (els.paifuPrevHandButton) els.paifuPrevHandButton.disabled = paifuHandIndex <= 0;
    if (els.paifuPrevSelfDrawButton) els.paifuPrevSelfDrawButton.disabled = findPaifuSelfDrawFlatIndex(-1) < 0;
    if (els.paifuPrevButton) els.paifuPrevButton.disabled = firstDisabled;
    if (els.paifuNextButton) els.paifuNextButton.disabled = lastDisabled;
    if (els.paifuNextSelfDrawButton) els.paifuNextSelfDrawButton.disabled = findPaifuSelfDrawFlatIndex(1) < 0;
    if (els.paifuNextHandButton) els.paifuNextHandButton.disabled = paifuHandIndex >= paifuReplay.hands.length - 1;
    if (els.paifuToggleHandsButton) {
      els.paifuToggleHandsButton.disabled = false;
      els.paifuToggleHandsButton.classList.toggle("is-active", showPaifuOpponentHands);
      els.paifuToggleHandsButton.setAttribute("aria-pressed", String(showPaifuOpponentHands));
      els.paifuToggleHandsButton.title = showPaifuOpponentHands ? "相手手牌を裏向きにする" : "相手手牌を表向きにする";
    }
  }

  function paifuDisplayActionText(snapshot, hand) {
    const base = snapshot?.actionText || "-";
    const isLastStep = hand?.snapshots?.length && snapshot?.stepIndex === hand.snapshots.length - 1;
    if (!isLastStep || !hand?.result) return base;
    const result = hand.result;
    if (result.type === "ryukyoku" || result.type === "draw") return `${base} / 流局`;
    const wins = result.wins || [];
    if (!wins.length) return base;
    const summary = wins
      .map((win) => {
        const score = win.pointText ? ` ${win.pointText}` : "";
        const yaku = win.yakuText ? ` ${win.yakuText}` : "";
        return `${win.label || ""}${score}${yaku}`.trim();
      })
      .filter(Boolean)
      .join(" / ");
    return summary ? `${base} / ${summary}` : base;
  }

  function renderPaifuTable() {
    const snapshot = currentPaifuSnapshot();
    if (!snapshot) {
      renderEmptyBattleTable();
      renderBattleScreenPanels();
      return;
    }
    const paifuState = paifuSnapshotToGameState(snapshot);
    const selfPlayer = paifuState.players.find((player) => player.seat === "self");
    const rightPlayer = paifuState.players.find((player) => player.seat === "shimocha");
    const leftPlayer = paifuState.players.find((player) => player.seat === "kamicha");
    const openFlowers = paifuState.players.flatMap((player) => player.flowers || []);

    setTextIfChanged(els.battleSelfName, displayPlayerNameByIndex(0));
    setTextIfChanged(els.battleRightName, displayPlayerNameByIndex(1));
    setTextIfChanged(els.battleLeftName, displayPlayerNameByIndex(2));
    renderCentralInfoPanel(paifuState);
    resetBattleEffectState();
    if (els.battleActionButtons) setHtmlIfChanged(els.battleActionButtons, "");
    maybePlaySkipPromptSound(null);
    setTextIfChanged(els.battleStatus, snapshot.actionText || "牌譜再生中");
    setTextIfChanged(els.battleStartButton, "対局開始");

    setHtmlIfChanged(els.battleSelfHand, renderPaifuOpenHand(selfPlayer, "discard-disabled"));
    setHtmlIfChanged(els.battleSelfMelds, renderPlayerMelds(selfPlayer));
    setHtmlIfChanged(els.battleLeftMelds, renderPlayerMelds(leftPlayer));
    setHtmlIfChanged(els.battleRightMelds, renderPlayerMelds(rightPlayer));
    setHtmlIfChanged(els.battleSelfFlowers, (selfPlayer?.flowers || [])
      .map((tile) => renderBattleTile(tile, "flower-open self-flower-tile tile-no-rotate"))
      .join(""));
    setHtmlIfChanged(els.battleLeftFlowers, (leftPlayer?.flowers || [])
      .map((tile) => renderBattleTile(tile, `flower-open side-flower ${tileRotationClassForSeat(leftPlayer?.seat)}`))
      .join(""));
    setHtmlIfChanged(els.battleRightFlowers, (rightPlayer?.flowers || [])
      .map((tile) => renderBattleTile(tile, `flower-open side-flower ${tileRotationClassForSeat(rightPlayer?.seat)}`))
      .join(""));
    setHtmlIfChanged(els.battleFlowerTiles, openFlowers.map((tile) => renderBattleTile(tile, "mini")).join(""));
    setHtmlIfChanged(els.battleSelfRiver, renderDiscardRiver(selfPlayer));
    setHtmlIfChanged(els.battleLeftRiver, renderDiscardRiver(leftPlayer));
    setHtmlIfChanged(els.battleRightRiver, renderDiscardRiver(rightPlayer));
    setHtmlIfChanged(els.battleLeftHand, renderPaifuSideHand(leftPlayer));
    setHtmlIfChanged(els.battleRightHand, renderPaifuSideHand(rightPlayer));
    renderBattleScreenPanels();
  }

  function renderBattleTable() {
    if (!els.battleTable || !Tiles?.createTiles) return;
    if (appScreen === "paifu") {
      renderPaifuTable();
      return;
    }
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
      (!currentPlayer?.isRiichi || Boolean(battleState.riichiDeclaration)) &&
      (!battleState.riichiDeclaration ||
        battleState.riichiDeclaration.playerIndex === battleState.currentPlayerIndex);

    setTextIfChanged(els.battleSelfName, displayPlayerNameByIndex(0));
    setTextIfChanged(els.battleRightName, displayPlayerNameByIndex(1));
    setTextIfChanged(els.battleLeftName, displayPlayerNameByIndex(2));
    renderCentralInfoPanel(battleState);
    renderBattleEffect(battleState);
    if (els.battleActionButtons) {
      setHtmlIfChanged(els.battleActionButtons, renderBattleActionButtons(battleState));
    }
    maybePlaySkipPromptSound(battleState);
    setTextIfChanged(els.battleStatus, battleStatusText());
    setTextIfChanged(els.battleStartButton, battleState.phase === "ryukyoku" ? "もう一局" : "対局開始");

    setHtmlIfChanged(els.battleSelfHand, renderSelfHand(selfPlayer, battleState.players.indexOf(selfPlayer), canDiscard));
    setHtmlIfChanged(els.battleSelfMelds, renderPlayerMelds(selfPlayer));
    setHtmlIfChanged(els.battleLeftMelds, renderPlayerMelds(leftPlayer));
    setHtmlIfChanged(els.battleRightMelds, renderPlayerMelds(rightPlayer));
    setHtmlIfChanged(els.battleSelfFlowers, (selfPlayer?.flowers || [])
      .map((tile) => renderBattleTile(tile, "flower-open self-flower-tile tile-no-rotate"))
      .join(""));
    setHtmlIfChanged(els.battleLeftFlowers, (leftPlayer?.flowers || [])
      .map((tile) => renderBattleTile(tile, `flower-open side-flower ${tileRotationClassForSeat(leftPlayer?.seat)}`))
      .join(""));
    setHtmlIfChanged(els.battleRightFlowers, (rightPlayer?.flowers || [])
      .map((tile) => renderBattleTile(tile, `flower-open side-flower ${tileRotationClassForSeat(rightPlayer?.seat)}`))
      .join(""));
    setHtmlIfChanged(els.battleFlowerTiles, openFlowers.map((tile) => renderBattleTile(tile, "mini")).join(""));
    setHtmlIfChanged(els.battleSelfRiver, renderDiscardRiver(selfPlayer));
    setHtmlIfChanged(els.battleLeftRiver, renderDiscardRiver(leftPlayer));
    setHtmlIfChanged(els.battleRightRiver, renderDiscardRiver(rightPlayer));
    const leftIndex = battleState.players.indexOf(leftPlayer);
    const rightIndex = battleState.players.indexOf(rightPlayer);
    setHtmlIfChanged(
      els.battleLeftHand,
      isBattleWinPlayerIndex(leftIndex) || shouldRevealTenpaiHandInRyukyoku(battleState, leftIndex)
        ? renderOpenBattleHand(leftPlayer, leftIndex, "side")
        : renderSideBackHand(leftPlayer, leftIndex)
    );
    setHtmlIfChanged(
      els.battleRightHand,
      isBattleWinPlayerIndex(rightIndex) || shouldRevealTenpaiHandInRyukyoku(battleState, rightIndex)
        ? renderOpenBattleHand(rightPlayer, rightIndex, "side")
        : renderSideBackHand(rightPlayer, rightIndex)
    );
    renderBattleScreenPanels();
  }

  function renderEmptyBattleTable() {
    const ownPlayer = state.players[0];
    const rightPlayer = state.players[1];
    const leftPlayer = state.players[2];
    const dealer = Rules.dealerOf(state);
    const kyotakuCount = Math.floor((Number(state.kyotaku) || 0) / 1000);
    setTextIfChanged(els.battleSelfName, displayPlayerNameByIndex(0));
    setTextIfChanged(els.battleRightName, displayPlayerNameByIndex(1));
    setTextIfChanged(els.battleLeftName, displayPlayerNameByIndex(2));
    setTextIfChanged(els.battleRoundLabel, Rules.roundLabel(state));
    if (els.battleHonbaKyotakuLabel) {
      setTextIfChanged(els.battleHonbaKyotakuLabel, `${state.honba || 0}本場 供託${kyotakuCount} 残--`);
    }
    if (els.battleLandscapeRoundInfo) {
      setHtmlIfChanged(
        els.battleLandscapeRoundInfo,
        `<span class="landscape-round-line-main">${escapeHtml(Rules.roundLabel(state))}</span><span class="landscape-round-line-sub">${escapeHtml(`${state.honba || 0}本場 供託${kyotakuCount}`)}</span><span class="landscape-round-line-remaining">残--</span>`
      );
    }
    setTextIfChanged(els.battleRemainingDraws, "残りツモ --");
    setTextIfChanged(els.battleDealerLabel, `親 ${displayPlayerNameByIndex(dealer)}`);
    setTextIfChanged(els.battleKyotakuLabel, `供託${kyotakuCount}`);
    setTextIfChanged(els.battleStatus, "待機中");
    setTextIfChanged(els.battleStartButton, "対局開始");
    setHtmlIfChanged(els.battleSelfHand, "");
    setHtmlIfChanged(els.battleSelfMelds, "");
    setHtmlIfChanged(els.battleLeftMelds, "");
    setHtmlIfChanged(els.battleRightMelds, "");
    setHtmlIfChanged(els.battleSelfFlowers, "");
    setHtmlIfChanged(els.battleLeftFlowers, "");
    setHtmlIfChanged(els.battleRightFlowers, "");
    setHtmlIfChanged(els.battleDoraIndicators, "");
    renderBattleEffect(null);
    if (els.battleActionButtons) setHtmlIfChanged(els.battleActionButtons, "");
    maybePlaySkipPromptSound(null);
    if (els.battlePlayerScores) setHtmlIfChanged(els.battlePlayerScores, renderCenterScoreDisplay(state.players, dealer));
    setHtmlIfChanged(els.battleFlowerTiles, "");
    setHtmlIfChanged(els.battleSelfRiver, "");
    setHtmlIfChanged(els.battleLeftRiver, "");
    setHtmlIfChanged(els.battleRightRiver, "");
    setHtmlIfChanged(els.battleLeftHand, renderBackTiles(13));
    setHtmlIfChanged(els.battleRightHand, renderBackTiles(13));
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

  function renderSideBackHand(player, playerIndex) {
    const count = player?.hand?.length || 0;
    const drawnTileId = drawnTileIdForPlayer(playerIndex);
    if (!drawnTileId || count <= 0) return renderBackTiles(count, "side");
    const renderBack = (index, isDrawn = false) => {
      const classes = ["table-back", "side", isDrawn ? "drawn" : ""].filter(Boolean).join(" ");
      return `<img class="table-tile-img ${classes}" src="${escapeHtml(Tiles.tileImagePath("blue_back"))}" alt="opponent tile ${index + 1}" loading="lazy" />`;
    };
    const normalTiles = Array.from({ length: Math.max(0, count - 1) }, (_, index) => renderBack(index)).join("");
    const drawnTile = renderBack(count - 1, true);
    return playerDisplaySeat(player, playerIndex) === "shimocha"
      ? drawnTile + normalTiles
      : normalTiles + drawnTile;
  }

  function populatePlayerSelects() {
    state.seatOrder = Rules.normalizeSeatOrder(state.seatOrder, state.dealer);
    const optionHtml = state.seatOrder
      .map((playerIndex) => {
        return `<option value="${playerIndex}">${escapeHtml(displayPlayerNameByIndex(playerIndex))}</option>`;
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
      player.name = displayPlayerNameByIndex(index);
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
    return displayPlayerNameByIndex(playerIndex);
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
        const parentText = `${displayPlayerNameByIndex(dealer)} 親${drawPayment.tenpai[dealer] ? "聴牌" : "ノーテン"}`;
        const nextText = drawPayment.tenpai[dealer]
          ? oorasuPreviewText(hand, true)
          : Rules.isOorasu(state)
            ? "南3局終了"
            : `${displayPlayerNameByIndex(south)} が次の東家`;
        const paymentText = drawPayment.payerDetails.length
          ? drawPayment.payerDetails.map((item) => `${displayPlayerNameByIndex(item.player)}→${displayPlayerNameByIndex(item.winner)} ${formatPlainNumber(item.amount)}`).join(" / ")
          : "点棒移動なし";
        els.paymentPreview.textContent = `${paymentText} / ${parentText} / ${nextText} / 本場 +1 / 供託 ${formatPlainNumber(Number(state.kyotaku) || 0)}点持ち越し`;
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
          const winnerText = item.winner !== undefined ? `→${displayPlayerNameByIndex(item.winner)}` : "";
          return `${displayPlayerNameByIndex(item.player)}${winnerText} ${formatPlainNumber(item.amount)}`;
        })
        .join(" / ");
      const kyotakuWinner = Rules.kyotakuWinnerFor(hand, state);
      const kyotakuText =
        (Number(state.kyotaku) || 0) > 0 && kyotakuWinner !== null
          ? ` / 供託 ${formatPlainNumber(Number(state.kyotaku) || 0)}点→${displayPlayerNameByIndex(kyotakuWinner)}`
          : "";
      const nextText =
        Rules.isParentContinuationWin(hand, state)
          ? oorasuPreviewText(hand, true)
          : Rules.isOorasu(state)
            ? "南3局終了"
            : `${displayPlayerNameByIndex(Rules.playerAtSeat(state, 1))} が次の東家・本場 0`;
      const bonusText = bonusSettlement.details.length
        ? bonusSettlement.details.map((item) => `${displayPlayerNameByIndex(item.payer)}→${displayPlayerNameByIndex(item.winner)} ${formatPlainNumber(item.amount)}pt`).join(" / ")
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
              <span>${item.rank}位 / ${formatPlainNumber(item.score)}点</span>
              <strong class="rank-name">${escapeHtml(displayPlayerNameForValue(item.name, item.index))}</strong>
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
        const scoreText = hand.scores.map((score, index) => `${displayPlayerNameByIndex(index)}: ${formatPlainNumber(score)}`).join(" / ");
        if (hand.winType === "draw") {
          const dealerName = displayPlayerNameByIndex(hand.dealer);
          const nextText = hand.dealerTenpai ? "親継続" : "南家へ親移動";
          const paymentText = hand.payment?.payerDetails?.length
            ? hand.payment.payerDetails.map((item) => `${displayPlayerNameByIndex(item.player)}→${displayPlayerNameByIndex(item.winner)} ${formatPlainNumber(item.amount)}点`).join(" / ")
            : "点棒移動なし";
          return `
          <li>
            ${number}. ${escapeHtml(hand.roundLabel || "")}${Number.isFinite(Number(hand.honba)) ? `${hand.honba}本場 ` : ""}流局 ${escapeHtml(paymentText)} / 親 ${escapeHtml(dealerName)} ${hand.dealerTenpai ? "聴牌" : "ノーテン"} ${nextText} / 供託 ${formatPlainNumber(Number(hand.kyotakuAfter) || 0)}点持ち越し
            <small>${escapeHtml(scoreText)}</small>
          </li>
        `;
        }
        const winnerSeat = hand.seats?.[hand.winner] || Rules.seatForPlayer(hand.dealer, hand.winner);
        const winnerName = displayPlayerNameByIndex(hand.winner);
        const secondWinnerText =
          hand.winType === "doubleRon"
            ? `・${displayPlayerNameByIndex(hand.secondWinner)}`
            : "";
        const winLabel = hand.winType === "tsumo" ? "ツモ" : hand.winType === "doubleRon" ? "ダブロン" : "ロン";
        const hanText =
          hand.winType === "doubleRon"
            ? Rules.winnersOf(hand)
                .map((winnerIndex) => {
                  const seat = hand.seats?.[winnerIndex] || Rules.seatForPlayer(hand.dealer, winnerIndex);
                  const name = displayPlayerNameByIndex(winnerIndex);
                  const han = hand.doubleRonHands?.[winnerIndex]?.han ?? hand.doubleRonHands?.[String(winnerIndex)]?.han ?? hand.han;
                  return `${seat} ${name} ${han}ハン`;
                })
                .join(" / ")
            : `${hand.han}ハン`;
        const kyotakuText =
          Number(hand.kyotakuBefore) > 0 && hand.kyotakuWinner !== null
            ? ` / 供託 ${formatPlainNumber(Number(hand.kyotakuBefore) || 0)}点→${displayPlayerNameByIndex(hand.kyotakuWinner)}`
            : "";
        const bonusText =
          hand.bonusSettlement?.details?.length
            ? ` / 祝儀 ${hand.bonusSettlement.details.map((item) => `${displayPlayerNameByIndex(item.payer)}→${displayPlayerNameByIndex(item.winner)} ${formatPlainNumber(item.amount)}pt`).join(" / ")}`
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
    const body = String(rounded);
    return rounded > 0 ? `+${body}` : body;
  }

  function formatSeatCounts(counts) {
    return counts
      .map((count, index) => `${displayPlayerNameByIndex(index)} ${count.東}/${count.南}/${count.西}`)
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
