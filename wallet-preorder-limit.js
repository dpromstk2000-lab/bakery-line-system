// =========================================================
// DPRO Bakery STEP BAKERY-33-R1
// お一人様取り置き上限・累計予約ガード（会員証画面補助）
//
// 役割:
// - 商品ごとの per_customer_daily_limit を読み込む
// - 同じ受取日の既存予約を合算
// - 「＋」ボタン、前回と同じ、いつものパンからの数量投入を画面で制限
//
// 最終的な強制判定はSupabaseの
// bakery_preorders_limit_guard_trigger が行います。
// =========================================================

(() => {
  const HIDDEN_STATUSES = new Set(["cancelled", "canceled", "no_show"]);
  const state = {
    products: new Map(),
    reserved: new Map(),
    lastCustomerKey: "",
    lastPickupDate: "",
    refreshing: false,
    enforcing: false
  };

  const cleanBase = (value) => String(value || "").trim().replace(/\/+$/, "");

  function shopCode() {
    const params = new URLSearchParams(location.search);
    return params.get("shop_code")
      || document.getElementById("shopCodeInput")?.value?.trim()
      || "bakery_demo";
  }

  function apiBase() {
    const params = new URLSearchParams(location.search);
    return cleanBase(
      params.get("api")
      || document.getElementById("apiBaseInput")?.value
      || "https://dpro-bakery-wallet-api.dpromstk2000.workers.dev"
    );
  }

  function apiUrl(path) {
    const connector = path.includes("?") ? "&" : "?";
    return `${apiBase()}${path}${connector}shop_code=${encodeURIComponent(shopCode())}`;
  }

  function customerKey() {
    return String(document.getElementById("walletMemberCode")?.textContent || "").trim();
  }

  function pickupDate() {
    return String(document.getElementById("pickupDateInput")?.value || "").trim();
  }

  function productCode(item = {}) {
    return String(item.product_code || item.code || item.id || item.product_id || "").trim();
  }

  function quantity(item = {}) {
    const value = Number(item.quantity ?? item.qty ?? 0);
    return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
  }

  function limitOf(code) {
    const product = state.products.get(String(code));
    const value = Number(product?.per_customer_daily_limit || 0);
    return Number.isFinite(value) && value > 0 ? Math.round(value) : null;
  }

  function productName(code) {
    return state.products.get(String(code))?.product_name || "この商品";
  }

  function reservedQty(code) {
    return Number(state.reserved.get(String(code)) || 0);
  }

  function currentQty(button) {
    return Number(button.closest(".product-card")?.querySelector(".qty-number")?.textContent || 0);
  }

  function remainingForCustomer(code) {
    const limit = limitOf(code);
    if (!limit) return null;
    return Math.max(0, limit - reservedQty(code));
  }

  function statusMessage(code) {
    const limit = limitOf(code);
    if (!limit) return "";
    const already = reservedQty(code);
    const remaining = Math.max(0, limit - already);
    if (already > 0) {
      return `${productName(code)}はお一人様1日${limit}個までです。すでに${already}個予約済みのため、本日はあと${remaining}個まで追加できます。`;
    }
    return `${productName(code)}はお一人様1日${limit}個までです。`;
  }

  function showStatus(message, kind = "warn") {
    const box = document.getElementById("preorderStatus");
    if (!box) return;
    box.textContent = message;
    box.className = `status-box ${kind}`;
  }

  async function getJson(path) {
    const response = await fetch(apiUrl(path), {
      headers: { Accept: "application/json" }
    });
    const text = await response.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; }
    catch { data = { ok: false, message: text }; }
    if (!response.ok || data?.ok === false) {
      throw new Error(data?.message || data?.error || "上限情報を取得できませんでした。");
    }
    return data;
  }

  async function loadProducts() {
    const data = await getJson("/api/public/products");
    const rows = Array.isArray(data.products) ? data.products : [];
    state.products = new Map(rows.map((row) => [productCode(row), row]).filter(([code]) => code));
  }

  async function loadReserved() {
    const key = customerKey();
    const date = pickupDate();
    state.reserved = new Map();

    if (!key || !date) return;

    const data = await getJson(`/api/customer/preorders?customer_key=${encodeURIComponent(key)}`);
    const rows = Array.isArray(data.recent_preorders) ? data.recent_preorders : [];
    const seen = new Set();

    rows.forEach((row) => {
      const rowKey = row.id || `${row.pickup_date}_${row.pickup_time}_${JSON.stringify(row.items || [])}`;
      if (seen.has(rowKey)) return;
      seen.add(rowKey);
      if (String(row.pickup_date || "") !== date) return;
      if (HIDDEN_STATUSES.has(String(row.status || "").toLowerCase())) return;

      (Array.isArray(row.items) ? row.items : []).forEach((item) => {
        const code = productCode(item);
        if (!code) return;
        state.reserved.set(code, reservedQty(code) + quantity(item));
      });
    });
  }

  function annotateCards() {
    document.querySelectorAll("[data-qty-plus]").forEach((plus) => {
      const code = String(plus.getAttribute("data-qty-plus") || "");
      const limit = limitOf(code);
      if (!limit) return;

      const card = plus.closest(".product-card");
      if (!card) return;

      let note = card.querySelector(".dpro-customer-limit-note");
      if (!note) {
        note = document.createElement("span");
        note.className = "dpro-customer-limit-note";
        const qtyRow = card.querySelector(".qty-row");
        if (qtyRow) card.insertBefore(note, qtyRow);
        else card.appendChild(note);
      }

      const already = reservedQty(code);
      const remaining = Math.max(0, limit - already);
      note.textContent = already > 0
        ? `お一人様1日${limit}個まで／予約済み${already}個／あと${remaining}個`
        : `お一人様1日${limit}個まで`;

      const selected = currentQty(plus);
      const product = state.products.get(String(code)) || {};
      const stockRemaining = product.remaining_preorder_quantity;
      const soldOut = product.preorder_sold_out === true
        || (stockRemaining !== null && stockRemaining !== undefined && Number(stockRemaining) <= 0);
      const customerLimitReached = remaining <= selected;
      plus.disabled = soldOut || customerLimitReached;
      plus.title = customerLimitReached ? statusMessage(code) : "";
    });
  }

  function enforceRenderedQuantities() {
    if (state.enforcing) return;
    state.enforcing = true;
    try {
      document.querySelectorAll("[data-qty-plus]").forEach((plus) => {
        const code = String(plus.getAttribute("data-qty-plus") || "");
        const allowed = remainingForCustomer(code);
        if (allowed === null) return;

        let qty = currentQty(plus);
        const minus = plus.closest(".product-card")?.querySelector(`[data-qty-minus="${CSS.escape(code)}"]`);
        while (minus && qty > allowed) {
          minus.click();
          qty -= 1;
        }
      });
      annotateCards();
    } finally {
      state.enforcing = false;
    }
  }

  async function refresh(reason = "") {
    if (state.refreshing) return;
    state.refreshing = true;
    try {
      if (!state.products.size) await loadProducts();
      await loadReserved();
      enforceRenderedQuantities();
      if (reason) annotateCards();
    } catch (error) {
      console.warn("BAKERY-33 limit refresh:", error);
    } finally {
      state.refreshing = false;
    }
  }

  document.addEventListener("click", (event) => {
    const plus = event.target.closest?.("[data-qty-plus]");
    if (plus) {
      const code = String(plus.getAttribute("data-qty-plus") || "");
      const allowed = remainingForCustomer(code);
      if (allowed !== null && currentQty(plus) >= allowed) {
        event.preventDefault();
        event.stopImmediatePropagation();
        showStatus(statusMessage(code), "warn");
        return;
      }
      setTimeout(annotateCards, 30);
    }

    if (event.target.closest?.("#repeatLastButton, #applyFavoriteButton")) {
      setTimeout(() => {
        enforceRenderedQuantities();
        showStatus("お一人様上限を適用して商品数量を調整しました。受け取り日と数量を確認してください。", "info");
      }, 80);
    }
  }, true);

  document.addEventListener("change", (event) => {
    if (event.target?.id === "pickupDateInput") {
      setTimeout(() => refresh("pickup-date"), 80);
    }
  }, true);

  const style = document.createElement("style");
  style.textContent = `
    .dpro-customer-limit-note{
      display:block;
      margin-top:6px;
      padding:7px 9px;
      border-radius:11px;
      background:#fff4e5;
      border:1px solid #f2c38e;
      color:#8b4513;
      font-size:11px;
      line-height:1.45;
      font-weight:900;
    }
  `;
  document.head.appendChild(style);

  function start() {
    refresh("start");

    setInterval(() => {
      const key = customerKey();
      const date = pickupDate();
      if (key !== state.lastCustomerKey || date !== state.lastPickupDate) {
        state.lastCustomerKey = key;
        state.lastPickupDate = date;
        refresh("poll");
      } else {
        enforceRenderedQuantities();
      }
    }, 1500);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
