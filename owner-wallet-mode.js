// =========================================================
// DPRO Bakery STEP BAKERY-35-R2
// オーナー用：QR会員証・チャージオプション設定
//
// QR会員証は常にON。
// チャージOFF時はオーナー画面でも
// チャージ操作、決済履歴、残高集計を非表示にします。
// =========================================================

(() => {
  const DEFAULT_CATALOG_API = "https://dpro-bakery-catalog-api.dpromstk2000.workers.dev";
  const state = {
    chargeEnabled: null,
    loaded: false,
    applying: false,
    toggleDirty: false
  };

  const clean = (value) => String(value || "").trim();
  const cleanBase = (value) => clean(value).replace(/\/+$/, "");

  function shopCode() {
    const params = new URLSearchParams(location.search);
    return clean(
      document.getElementById("quickShopCodeInput")?.value
      || document.getElementById("shopCodeInput")?.value
      || params.get("shop_code")
      || "bakery_demo"
    );
  }

  function adminCode() {
    return clean(
      document.getElementById("quickAdminCodeInput")?.value
      || document.getElementById("adminCodeInput")?.value
      || (shopCode() === "bakery_demo" ? "1234" : "")
    );
  }

  function catalogApi() {
    const params = new URLSearchParams(location.search);
    return cleanBase(
      document.getElementById("dpro35CatalogApiInput")?.value
      || params.get("catalog_api")
      || DEFAULT_CATALOG_API
    );
  }

  async function post(path, body = {}) {
    const response = await fetch(catalogApi() + path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({
        shop_code: shopCode(),
        admin_code: adminCode(),
        ...body
      })
    });
    const text = await response.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; }
    catch { data = { ok: false, message: text }; }

    if (!response.ok || data?.ok === false) {
      throw new Error(data?.error?.message || data?.message || "設定処理に失敗しました。");
    }
    return data;
  }

  function setStatus(message, tone = "info") {
    const box = document.getElementById("dpro35WalletModeStatus");
    if (!box) return;
    box.textContent = message;
    box.className = "dpro35-status " + tone;
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

  function closestCardById(id) {
    return document.getElementById(id)?.closest(".card") || null;
  }

  function applyOwnerMode() {
    if (!state.loaded || state.applying) return;
    state.applying = true;
    try {
      const off = state.chargeEnabled !== true;

      setHidden(document.getElementById("chargeSection"), off);
      setHidden(document.getElementById("transactionsSection"), off);

      document.querySelectorAll(
        'a[href="#chargeSection"], a[href="#transactionsSection"]'
      ).forEach((link) => setHidden(link, off));

      ["cardCharge", "cardPayment", "cardBalance"].forEach((id) => {
        setHidden(closestCardById(id), off);
      });

      document.querySelectorAll("[data-member-charge]").forEach((button) => {
        setHidden(button, off);
      });

      const toggle = document.getElementById("dpro35ChargeToggle");
      if (toggle && !state.toggleDirty) {
        toggle.checked = state.chargeEnabled === true;
      }

      const badge = document.getElementById("dpro35ModeBadge");
      if (badge) {
        badge.textContent = state.chargeEnabled ? "QR＋チャージ" : "QR会員証のみ";
        badge.className = "dpro35-badge " + (state.chargeEnabled ? "on" : "off");
      }
    } finally {
      state.applying = false;
    }
  }

  async function loadMode(showMessage = true) {
    if (!adminCode()) {
      setStatus("管理コードを入力してから設定を読み込んでください。DEMOは1234です。", "warn");
      return;
    }

    try {
      setStatus("会員証表示設定を読み込んでいます。", "info");
      const data = await post("/api/admin/wallet-mode/get");
      state.chargeEnabled = data.settings?.wallet_charge_enabled === true;
      state.loaded = true;
      state.toggleDirty = false;
      applyOwnerMode();
      if (showMessage) {
        setStatus(
          state.chargeEnabled
            ? "現在はQR会員証と残高・チャージ機能を表示しています。"
            : "現在はQR会員証だけを表示し、残高・チャージ機能は非表示です。",
          "ok"
        );
      }
    } catch (error) {
      setStatus(error.message || "設定を読み込めませんでした。", "ng");
    }
  }

  async function saveMode() {
    if (!adminCode()) {
      setStatus("管理コードを入力してください。DEMOは1234です。", "warn");
      return;
    }

    const enabled = document.getElementById("dpro35ChargeToggle")?.checked === true;
    try {
      setStatus("設定を保存しています。", "info");
      const data = await post("/api/admin/wallet-mode/save", {
        wallet_charge_enabled: enabled
      });
      state.chargeEnabled = data.settings?.wallet_charge_enabled === true;
      state.loaded = true;
      state.toggleDirty = false;
      applyOwnerMode();
      setStatus(
        data.message + " お客様画面を再読み込みすると反映されます。",
        "ok"
      );
    } catch (error) {
      setStatus(error.message || "設定を保存できませんでした。", "ng");
    }
  }

  function createPanel() {
    if (document.getElementById("dpro35WalletModePanel")) return;

    const params = new URLSearchParams(location.search);
    const section = document.createElement("section");
    section.id = "dpro35WalletModePanel";
    section.innerHTML = `
      <style>
        #dpro35WalletModePanel{
          background:linear-gradient(135deg,#fff,#eff6ff);
          border:1px solid #bfdbfe;border-radius:24px;padding:20px;
          margin:16px 0;box-shadow:0 16px 44px rgba(30,64,175,.08)
        }
        #dpro35WalletModePanel .dpro35-head{
          display:flex;justify-content:space-between;gap:12px;
          align-items:flex-start;flex-wrap:wrap
        }
        #dpro35WalletModePanel h2{font-size:24px;margin:0 0 5px;color:#1c1917}
        #dpro35WalletModePanel p{margin:0;color:#57534e;font-size:13px;font-weight:850}
        #dpro35WalletModePanel .dpro35-setting{
          display:grid;grid-template-columns:1fr auto;gap:14px;align-items:center;
          margin-top:14px;padding:15px;border-radius:17px;background:#fff;
          border:1px solid #dbeafe
        }
        #dpro35WalletModePanel .dpro35-switch{
          display:flex;align-items:center;gap:9px;font-weight:950;color:#1e3a8a
        }
        #dpro35WalletModePanel .dpro35-switch input{width:22px;height:22px}
        #dpro35WalletModePanel .dpro35-actions{
          display:flex;gap:9px;flex-wrap:wrap;margin-top:14px
        }
        #dpro35WalletModePanel button{
          border:0;border-radius:999px;padding:11px 15px;
          font-size:14px;font-weight:950;cursor:pointer
        }
        #dpro35WalletModePanel .save{background:#1d4ed8;color:#fff}
        #dpro35WalletModePanel .load{background:#fff;color:#1d4ed8;border:1px solid #93c5fd}
        #dpro35WalletModePanel input[type="url"]{
          width:100%;margin-top:12px;border:1px solid #bfdbfe;
          border-radius:13px;padding:10px 12px;font-size:12px
        }
        #dpro35WalletModePanel .dpro35-badge{
          border-radius:999px;padding:7px 11px;font-size:12px;font-weight:950
        }
        #dpro35WalletModePanel .dpro35-badge.on{background:#dcfce7;color:#166534}
        #dpro35WalletModePanel .dpro35-badge.off{background:#dbeafe;color:#1d4ed8}
        #dpro35WalletModePanel .dpro35-status{
          margin-top:12px;padding:11px 13px;border-radius:14px;
          font-size:12px;font-weight:850;white-space:pre-wrap
        }
        #dpro35WalletModePanel .dpro35-status.info{background:#eff6ff;color:#1d4ed8}
        #dpro35WalletModePanel .dpro35-status.ok{background:#f0fdf4;color:#166534}
        #dpro35WalletModePanel .dpro35-status.warn{background:#fffbeb;color:#92400e}
        #dpro35WalletModePanel .dpro35-status.ng{background:#fef2f2;color:#991b1b}
        @media(max-width:600px){
          #dpro35WalletModePanel .dpro35-setting{grid-template-columns:1fr}
        }
      </style>
      <div class="dpro35-head">
        <div>
          <h2>QR会員証・チャージ表示設定</h2>
          <p>QR会員証は標準機能です。残高・チャージだけを店舗オプションとして切り替えます。</p>
        </div>
        <span id="dpro35ModeBadge" class="dpro35-badge off">未読込</span>
      </div>
      <div class="dpro35-setting">
        <div>
          <strong>残高・チャージ機能を使用する</strong>
          <p>OFFでは、お客様にはQR会員証・取り置き・いつものパン・ECO通知だけを表示します。</p>
        </div>
        <label class="dpro35-switch">
          <input id="dpro35ChargeToggle" type="checkbox">
          使用する
        </label>
      </div>
      <input id="dpro35CatalogApiInput" type="url"
        value="${params.get("catalog_api") || DEFAULT_CATALOG_API}"
        aria-label="カタログWorker URL">
      <div class="dpro35-actions">
        <button class="save" id="dpro35SaveMode" type="button">表示設定を保存</button>
        <button class="load" id="dpro35LoadMode" type="button">現在設定を読み込む</button>
      </div>
      <div id="dpro35WalletModeStatus" class="dpro35-status info">
        管理コードを保存後、現在設定を読み込みます。QR会員証はOFFにはなりません。
      </div>
    `;

    const catalogPanel = document.getElementById("dproBakeryCatalogLinks");
    const hero = document.querySelector(".hero");
    if (catalogPanel) catalogPanel.insertAdjacentElement("afterend", section);
    else if (hero) hero.insertAdjacentElement("afterend", section);
    else document.body.prepend(section);

    section.querySelector("#dpro35SaveMode")?.addEventListener("click", saveMode);
    section.querySelector("#dpro35LoadMode")?.addEventListener("click", () => loadMode(true));
    section.querySelector("#dpro35ChargeToggle")?.addEventListener("change", (event) => {
      state.toggleDirty = true;
      setStatus(
        event.target.checked
          ? "チャージ機能をONに変更しました。まだ保存されていません。"
          : "チャージ機能をOFFに変更しました。まだ保存されていません。",
        "warn"
      );
    });
  }

  function start() {
    createPanel();

    ["saveQuickAdminButton", "quickStartButton", "loadAllButton"].forEach((id) => {
      document.getElementById(id)?.addEventListener("click", () => {
        setTimeout(() => loadMode(false), 500);
      });
    });

    setTimeout(() => {
      if (adminCode()) loadMode(false);
    }, 450);

    setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (state.loaded) applyOwnerMode();
    }, 1500);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
