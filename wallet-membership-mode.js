// =========================================================
// DPRO Bakery STEP BAKERY-35
// QR会員証標準化・チャージオプション完全切替
//
// QR会員証は常に残します。
// wallet_charge_enabled=false の店舗では、以下だけを隠します。
// ・残高表示
// ・有償／おまけ残高
// ・チャージ目的
// ・チャージパネル
//
// 既存のQR生成、会員登録、取り置き予約には触れません。
//
// PRODUCT READY PR1 / LINE IDENTITY:
// Version: BAKERY-PR1-20260822
// Production protected customer APIs send a LIFF ID Token to the Worker.
// The Worker verifies it server-side; browser line_user_id is never proof.
// 通常顧客画面では技術・DEMO保守UIを隠します。
// demo=1 / dev=1 / maintenance=1 の明示モードだけ再表示します。
// 既存API入力DOMは削除せず非表示にして、既存動作を維持します。
// DOM変更の常時監視は使用しません。
// =========================================================

(() => {
  const DEFAULT_CATALOG_API = "https://dpro-bakery-catalog-api.dpromstk2000.workers.dev";
  const state = {
    loaded: false,
    chargeEnabled: false,
    shopCode: "",
    catalogApi: "",
    applying: false,
    liffReadyPromise: null
  };

  const cleanBase = (value) => String(value || "").trim().replace(/\/+$/, "");

  function shopCode() {
    const params = new URLSearchParams(location.search);
    return params.get("shop_code")
      || document.getElementById("shopCodeInput")?.value?.trim()
      || "bakery_demo";
  }

  function catalogApi() {
    const params = new URLSearchParams(location.search);
    return cleanBase(params.get("catalog_api") || DEFAULT_CATALOG_API);
  }

  function maintenanceMode() {
    const params = new URLSearchParams(location.search);
    return ["demo", "dev", "maintenance"].some((key) =>
      ["1", "true", "yes", "on"].includes(
        String(params.get(key) || "").toLowerCase()
      )
    );
  }

  const LINE_IDENTITY_VERSION = "BAKERY-PR1-LINE-IDENTITY-20260822";
  const PROTECTED_CUSTOMER_PATHS = new Set([
    "/api/customer/register",
    "/api/customer/me",
    "/api/customer/preorders",
    "/api/preorders/create"
  ]);

  function walletApiBase() {
    const params = new URLSearchParams(location.search);
    return cleanBase(
      params.get("api")
      || document.getElementById("apiBaseInput")?.value
      || "https://dpro-bakery-wallet-api.dpromstk2000.workers.dev"
    );
  }

  function liffId() {
    const params = new URLSearchParams(location.search);
    return String(
      params.get("liff_id")
      || document.getElementById("liffIdInput")?.value
      || ""
    ).trim();
  }

  function canonicalDemoSurface() {
    return shopCode() === "bakery_demo"
      && location.hostname === "dpromstk2000-lab.github.io"
      && location.pathname.startsWith("/bakery-line-system/");
  }

  function explicitDemoTransport() {
    return shopCode() === "bakery_demo"
      && (canonicalDemoSurface() || maintenanceMode());
  }

  async function ensureLiffReady() {
    if (state.liffReadyPromise) return state.liffReadyPromise;
    state.liffReadyPromise = (async () => {
      const configuredLiffId = liffId();
      if (!window.liff) {
        if (!configuredLiffId) return null;
        await new Promise((resolve, reject) => {
          const existing = document.querySelector('script[data-dpro-line-liff-sdk="1"]');
          if (existing) {
            existing.addEventListener("load", resolve, { once: true });
            existing.addEventListener("error", reject, { once: true });
            return;
          }
          const script = document.createElement("script");
          script.src = "https://static.line-scdn.net/liff/edge/2/sdk.js";
          script.async = true;
          script.dataset.dproLineLiffSdk = "1";
          script.addEventListener("load", resolve, { once: true });
          script.addEventListener("error", reject, { once: true });
          document.head.appendChild(script);
        });
      }
      if (!window.liff) return null;
      if (configuredLiffId) {
        try { await window.liff.init({ liffId: configuredLiffId }); }
        catch (error) {
          console.warn("BAKERY PR1 LIFF init:", error);
          return null;
        }
      }
      return window.liff;
    })();
    return state.liffReadyPromise;
  }

  async function currentLiffIdToken() {
    try {
      const liff = await ensureLiffReady();
      if (!liff || typeof liff.getIDToken !== "function") return "";
      return String(liff.getIDToken() || "").trim();
    } catch (error) {
      console.warn("BAKERY PR1 LIFF token:", error);
      return "";
    }
  }

  function requestUrl(input) {
    try {
      if (input instanceof Request) return new URL(input.url, location.href);
      return new URL(String(input), location.href);
    } catch {
      return null;
    }
  }

  function isProtectedWalletRequest(url) {
    if (!url || !PROTECTED_CUSTOMER_PATHS.has(url.pathname)) return false;
    try {
      return url.origin === new URL(walletApiBase()).origin;
    } catch {
      return false;
    }
  }

  function installLineIdentityTransport() {
    if (window.__DPRO_BAKERY_PR1_FETCH_INSTALLED__) return;
    const nativeFetch = window.fetch.bind(window);
    window.fetch = async (input, init = {}) => {
      const url = requestUrl(input);
      if (!isProtectedWalletRequest(url)) {
        return nativeFetch(input, init);
      }

      const inputHeaders = input instanceof Request ? input.headers : undefined;
      const headers = new Headers(inputHeaders || {});
      new Headers(init.headers || {}).forEach((value, key) => headers.set(key, value));

      if (explicitDemoTransport()) {
        headers.set("X-DPRO-Demo", "1");
        headers.delete("Authorization");
        headers.delete("X-Line-ID-Token");
      } else {
        const idToken = await currentLiffIdToken();
        if (idToken) {
          headers.set("Authorization", `Bearer ${idToken}`);
        } else {
          headers.delete("Authorization");
        }
        headers.delete("X-DPRO-Demo");
      }

      return nativeFetch(input, { ...init, headers });
    };
    window.__DPRO_BAKERY_PR1_FETCH_INSTALLED__ = true;
    window.DPRO_BAKERY_LINE_IDENTITY_TRANSPORT = {
      version: LINE_IDENTITY_VERSION,
      protectedPaths: [...PROTECTED_CUSTOMER_PATHS],
      demoMode: explicitDemoTransport(),
      tokenTransport: "Authorization Bearer LIFF ID Token"
    };
  }

  function detailsBySummaryText(text) {
    return [...document.querySelectorAll("details")].find((details) =>
      String(details.querySelector("summary")?.textContent || "").trim() === text
    ) || null;
  }

  function applyCustomerSurfaceGuard() {
    const maintenance = maintenanceMode();
    setHidden(detailsBySummaryText("DEMO・開発設定"), !maintenance);
    setHidden(detailsBySummaryText("確認用URL"), !maintenance);
    setHidden(document.getElementById("useDemoMemberButton"), !maintenance);
    document.documentElement.classList.toggle("dpro-pr1-maintenance", maintenance);
    document.documentElement.classList.toggle("dpro-pr1-customer", !maintenance);
  }

  function setHidden(element, hidden) {
    if (!element) return;
    if (hidden) {
      if (!element.dataset.dpro35Display) {
        element.dataset.dpro35Display = element.style.display || "";
      }
      element.style.display = "none";
      element.setAttribute("aria-hidden", "true");
    } else {
      element.style.display = element.dataset.dpro35Display || "";
      element.removeAttribute("aria-hidden");
    }
  }

  function walletMetaRows() {
    const memberCode = document.getElementById("walletMemberCode");
    const meta = memberCode?.closest(".wallet-meta");
    return meta ? [...meta.children] : [];
  }

  function ensureQrModeBadge() {
    const rank = document.getElementById("walletRank");
    if (!rank?.parentElement) return;
    let badge = document.getElementById("dpro35QrModeBadge");
    if (!badge) {
      badge = document.createElement("div");
      badge.id = "dpro35QrModeBadge";
      badge.className = "badge blue";
      badge.textContent = "QR会員証";
      rank.insertAdjacentElement("beforebegin", badge);
    }
    badge.textContent = state.chargeEnabled ? "QR＋残高" : "QR会員証";
  }

  function applyRegistrationMode() {
    const walletPurpose = document.querySelector('input[name="visitPurpose"][value="wallet"]');
    const preorderPurpose = document.querySelector('input[name="visitPurpose"][value="preorder"]');
    const walletOption = walletPurpose?.closest("label");
    setHidden(walletOption, !state.chargeEnabled);

    if (!state.chargeEnabled && walletPurpose?.checked && preorderPurpose) {
      preorderPurpose.checked = true;
    }
  }

  function applyWalletCardMode() {
    ensureQrModeBadge();

    const balance = document.getElementById("walletBalance");
    setHidden(balance, !state.chargeEnabled);

    const rows = walletMetaRows();
    const balanceRow = rows.find((row) =>
      row.querySelector?.("#walletPaidBalance")
      || row.querySelector?.("#walletBonusBalance")
    );
    setHidden(balanceRow, !state.chargeEnabled);

    const instructionRow = rows.find((row) =>
      String(row.textContent || "").includes("QR")
      || String(row.textContent || "").includes("レジ")
    );
    if (instructionRow) {
      if (!instructionRow.dataset.dpro35OriginalText) {
        instructionRow.dataset.dpro35OriginalText = instructionRow.textContent || "";
      }
      instructionRow.textContent = state.chargeEnabled
        ? instructionRow.dataset.dpro35OriginalText
        : "取り置き商品の受け取り時に、下のQR会員証を見せてください。";
    }

    const reload = document.getElementById("reloadMeButton");
    if (reload) {
      if (!reload.dataset.dpro35OriginalText) {
        reload.dataset.dpro35OriginalText = reload.textContent || "";
      }
      reload.textContent = state.chargeEnabled
        ? reload.dataset.dpro35OriginalText
        : "会員情報を再読込";
    }
  }

  function applyChargePanelMode() {
    const chargePanel = document.getElementById("chargePanel");
    if (!chargePanel) return;

    if (!state.chargeEnabled) {
      chargePanel.style.display = "none";
      chargePanel.setAttribute("aria-hidden", "true");
    } else {
      chargePanel.style.display = "";
      chargePanel.removeAttribute("aria-hidden");
    }
  }

  function applyShopStatusMode() {
    if (state.chargeEnabled) return;
    const status = document.getElementById("shopStatus");
    if (!status) return;
    const current = String(status.textContent || "");
    if (!current) return;
    status.textContent = current.replace(
      /チャージ上乗せ\s*:\s*[^/\n]+/,
      "QR会員証: 標準利用"
    );
  }

  function applyMode() {
    if (!state.loaded || state.applying) return;
    state.applying = true;
    try {
      document.documentElement.classList.toggle("dpro35-charge-enabled", state.chargeEnabled);
      document.documentElement.classList.toggle("dpro35-qr-only", !state.chargeEnabled);
      applyCustomerSurfaceGuard();
      applyRegistrationMode();
      applyWalletCardMode();
      applyChargePanelMode();
      applyShopStatusMode();
    } finally {
      state.applying = false;
    }
  }

  async function loadMode() {
    const nextShop = shopCode();
    const nextApi = catalogApi();
    state.shopCode = nextShop;
    state.catalogApi = nextApi;

    try {
      const url = `${nextApi}/api/public/wallet-mode?shop_code=${encodeURIComponent(nextShop)}`;
      const response = await fetch(url, { headers: { Accept: "application/json" } });
      const text = await response.text();
      let data = {};
      try { data = text ? JSON.parse(text) : {}; }
      catch { data = {}; }

      if (!response.ok || data?.ok === false) {
        throw new Error(data?.error?.message || data?.message || "会員証表示設定を取得できませんでした。");
      }

      state.chargeEnabled = data.wallet_charge_enabled === true;
      state.loaded = true;
      applyMode();
    } catch (error) {
      // 安全側: 設定取得に失敗した場合もチャージを勝手に表示しません。
      console.warn("BAKERY-35 wallet mode:", error);
      state.chargeEnabled = false;
      state.loaded = true;
      applyMode();
    }
  }

  const style = document.createElement("style");
  style.textContent = `
    html.dpro35-qr-only .wallet-card{
      background:linear-gradient(135deg,#2a160d,#54210e 68%,#7c2d12);
    }
    #dpro35QrModeBadge{margin-right:6px}
  `;
  document.head.appendChild(style);

  function start() {
    installLineIdentityTransport();
    loadMode();

    document.addEventListener("click", (event) => {
      if (event.target.closest?.(
        "#registerButton, #useDemoMemberButton, #reloadMeButton, [data-scroll]"
      )) {
        setTimeout(applyMode, 80);
        setTimeout(applyMode, 350);
      }
    }, true);

    document.addEventListener("change", (event) => {
      if (event.target?.id === "shopCodeInput") {
        state.loaded = false;
        loadMode();
      }
    }, true);

    setInterval(() => {
      if (document.visibilityState !== "visible") return;
      const identityChanged = state.shopCode !== shopCode() || state.catalogApi !== catalogApi();
      if (identityChanged) {
        state.loaded = false;
        loadMode();
      } else {
        applyMode();
      }
    }, 1500);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
