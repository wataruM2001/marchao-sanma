(function () {
  "use strict";

  const root = typeof window !== "undefined" ? window : globalThis;

  const DEFAULT_SUPABASE_CONFIG = Object.freeze({
    url: "https://mrmgcaxymsribyusfely.supabase.co",
    publishableKey: "sb_publishable_4BIoZK2R5RvVzjgzHp-m4g_tZcuKaUZ",
    sharedPaifusTable: "shared_paifus",
    hanchanStatsTable: "hanchan_stats",
    shareUrlBase: "https://watarum2001.github.io/marchao-sanma/",
  });

  function readLocalSetting(key) {
    try {
      return root.localStorage?.getItem(key) || "";
    } catch {
      return "";
    }
  }

  const runtimeConfig = root.MARCHAO_SUPABASE_CONFIG || {};
  const supabaseConfig = Object.freeze({
    ...DEFAULT_SUPABASE_CONFIG,
    ...runtimeConfig,
    url:
      runtimeConfig.url ||
      readLocalSetting("marchao-supabase-url") ||
      DEFAULT_SUPABASE_CONFIG.url,
    publishableKey:
      runtimeConfig.publishableKey ||
      readLocalSetting("marchao-supabase-publishable-key") ||
      DEFAULT_SUPABASE_CONFIG.publishableKey,
  });

  let cachedClient = null;

  function hasSuspiciousFrontendKey(key) {
    const text = String(key || "").toLowerCase();
    return text.includes("service_role") || text.includes("secret");
  }

  function isConfigured() {
    return Boolean(
      supabaseConfig.url &&
        supabaseConfig.publishableKey &&
        !hasSuspiciousFrontendKey(supabaseConfig.publishableKey)
    );
  }

  function unavailableResult(action) {
    return {
      ok: false,
      skipped: true,
      action,
      reason: "Supabase URL または publishable key が未設定です",
    };
  }

  function getSupabaseFactory() {
    return root.supabase?.createClient || root.supabaseJs?.createClient || null;
  }

  function getSupabaseClient() {
    if (!isConfigured()) return null;
    if (cachedClient) return cachedClient;
    const createClient = getSupabaseFactory();
    if (!createClient) return null;
    cachedClient = createClient(supabaseConfig.url, supabaseConfig.publishableKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        flowType: "pkce",
      },
    });
    return cachedClient;
  }

  function authRedirectUrl() {
    const fallback = supabaseConfig.shareUrlBase || root.location?.origin || "";
    try {
      const url = new URL(root.location?.href || fallback);
      url.search = "";
      url.hash = "";
      return url.toString();
    } catch {
      return fallback;
    }
  }

  function cloneJson(value) {
    if (typeof structuredClone === "function") return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  function createShareId() {
    if (root.crypto?.randomUUID) {
      return root.crypto.randomUUID().replace(/-/g, "").slice(0, 20);
    }
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).slice(2, 14);
    return `${timestamp}${random}`.slice(0, 20);
  }

  function buildPaifuShareUrl(shareId) {
    const url = new URL(supabaseConfig.shareUrlBase);
    url.searchParams.set("paifu", shareId);
    return url.toString();
  }

  function normalizeShareRow({ shareId, title, paifu, settlement, isPublic, rulesVersion, appVersion }) {
    const normalizedShareId = shareId || createShareId();
    const sharedUrl = buildPaifuShareUrl(normalizedShareId);
    const paifuJson = cloneJson(paifu || null);
    if (paifuJson && typeof paifuJson === "object" && !Array.isArray(paifuJson)) {
      paifuJson.shareId = normalizedShareId;
      paifuJson.sharedUrl = sharedUrl;
    }
    return {
      share_id: normalizedShareId,
      created_at: new Date().toISOString(),
      rules_version: rulesVersion || "marchao-sanma-v1",
      app_version: appVersion || "browser-static-v1",
      title: title || "マーチャオサンマ牌譜",
      paifu_json: paifuJson,
      settlement_json: cloneJson(settlement || null),
      is_public: isPublic !== false,
    };
  }

  const paifuShareApi = {
    isConfigured,
    buildShareUrl: buildPaifuShareUrl,
    getSharedUrl: buildPaifuShareUrl,

    async createSharedPaifu(options = {}, maybeSettlementResult = null) {
      if (options?.hands) {
        options = {
          paifuReplay: options,
          settlementResult: maybeSettlementResult,
        };
      }
      const {
        title,
        paifu,
        paifuReplay,
        settlement,
        settlementResult,
        isPublic = true,
        shareId = "",
        rulesVersion = "marchao-sanma-v1",
        appVersion = "browser-static-v1",
      } = options || {};
      const client = getSupabaseClient();
      if (!client) return unavailableResult("createSharedPaifu");

      const row = normalizeShareRow({
        shareId,
        title,
        paifu: paifuReplay || paifu,
        settlement: settlementResult || settlement,
        isPublic,
        rulesVersion,
        appVersion,
      });
      const { data, error } = await client
        .from(supabaseConfig.sharedPaifusTable)
        .insert(row)
        .select("share_id,created_at,rules_version,app_version,title,is_public")
        .single();

      if (error) {
        return { ok: false, error, reason: error.message || "牌譜共有の保存に失敗しました" };
      }

      const savedShareId = data?.share_id || row.share_id;
      return {
        ok: true,
        shareId: savedShareId,
        url: buildPaifuShareUrl(savedShareId),
        data,
      };
    },

    async loadSharedPaifu(shareId) {
      const client = getSupabaseClient();
      if (!client) return unavailableResult("loadSharedPaifu");
      if (!shareId) return { ok: false, reason: "shareId が空です" };

      const { data, error } = await client
        .from(supabaseConfig.sharedPaifusTable)
        .select("share_id,created_at,rules_version,app_version,title,paifu_json,settlement_json,is_public")
        .eq("share_id", shareId)
        .eq("is_public", true)
        .single();

      if (error) {
        return { ok: false, error, reason: error.message || "共有牌譜の読み込みに失敗しました" };
      }

      return {
        ok: true,
        shareId: data.share_id,
        createdAt: data.created_at,
        rulesVersion: data.rules_version,
        appVersion: data.app_version,
        title: data.title,
        paifu: data.paifu_json,
        paifuReplay: data.paifu_json,
        settlement: data.settlement_json,
        settlementResult: data.settlement_json,
        data,
      };
    },

    async getSharedPaifu(input) {
      const shareId = typeof input === "string" ? input : input?.shareId;
      return this.loadSharedPaifu(shareId);
    },
  };

  const statsApi = {
    isConfigured,

    async saveHanchanStats(rows) {
      const client = getSupabaseClient();
      if (!client) return unavailableResult("saveHanchanStats");

      const statsRows = Array.isArray(rows) ? rows : [rows].filter(Boolean);
      if (!statsRows.length) {
        return { ok: false, reason: "保存する成績がありません" };
      }

      const { data, error } = await client
        .from(supabaseConfig.hanchanStatsTable)
        .insert(cloneJson(statsRows))
        .select("hanchan_id,rank,settlement_point,chip_count,total_hands,win_count,deal_in_count");

      if (error) {
        return { ok: false, error, reason: error.message || "半荘成績の保存に失敗しました" };
      }

      return { ok: true, data };
    },
  };

  const authApi = {
    isConfigured,

    async getSession() {
      const client = getSupabaseClient();
      if (!client) return unavailableResult("getSession");
      const { data, error } = await client.auth.getSession();
      if (error) return { ok: false, error, reason: error.message || "セッションを取得できませんでした" };
      return { ok: true, session: data?.session || null, user: data?.session?.user || null };
    },

    async getUser() {
      const client = getSupabaseClient();
      if (!client) return unavailableResult("getUser");
      const { data, error } = await client.auth.getUser();
      if (error) return { ok: false, error, reason: error.message || "ユーザー情報を取得できませんでした" };
      return { ok: true, user: data?.user || null };
    },

    async signInWithEmail(email) {
      const client = getSupabaseClient();
      if (!client) return unavailableResult("signInWithEmail");
      const normalizedEmail = String(email || "").trim();
      if (!normalizedEmail) return { ok: false, reason: "メールアドレスを入力してください" };
      const { data, error } = await client.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          emailRedirectTo: authRedirectUrl(),
        },
      });
      if (error) return { ok: false, error, reason: error.message || "ログインメールを送信できませんでした" };
      return { ok: true, data };
    },

    async signOut() {
      const client = getSupabaseClient();
      if (!client) return unavailableResult("signOut");
      const { error } = await client.auth.signOut();
      if (error) return { ok: false, error, reason: error.message || "ログアウトできませんでした" };
      return { ok: true };
    },

    onAuthStateChange(callback) {
      const client = getSupabaseClient();
      if (!client || !callback) return null;
      const { data } = client.auth.onAuthStateChange((event, session) => {
        callback(event, session);
      });
      return data?.subscription || null;
    },
  };

  root.MarchaoSupabase = {
    config: supabaseConfig,
    getClient: getSupabaseClient,
    isConfigured,
  };
  root.authApi = authApi;
  root.paifuShareApi = paifuShareApi;
  root.statsApi = statsApi;
})();
