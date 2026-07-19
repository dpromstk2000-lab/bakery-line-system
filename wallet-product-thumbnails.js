// =========================================================
// DPRO Bakery STEP BAKERY-34
// 取り置き予約欄：軽量商品サムネイル
//
// - カタログに登録済みのWebP商品写真を再利用
// - loading="lazy" / decoding="async" / fetchpriority="low"
// - 写真未登録時は絵文字プレースホルダー（通信なし）
// - DOM変更の常時監視は不使用。既存予約処理には触れません。
// =========================================================

(() => {
  const CACHE_MINUTES = 10;
  const CHECK_INTERVAL_MS = 1200;
  const FALLBACK_CATALOG_API = "https://dpro-bakery-catalog-api.dpromstk2000.workers.dev";

  const state = {
    shopCode: "",
    catalogApi: "",
    products: new Map(),
    loading: false,
    failedImages: new Set()
  };

  const cleanBase = (value) => String(value || "").trim().replace(/\/+$/, "");

  function currentShopCode() {
    const params = new URLSearchParams(location.search);
    return params.get("shop_code")
      || document.getElementById("shopCodeInput")?.value?.trim()
      || "bakery_demo";
  }

  function currentCatalogApi() {
    const params = new URLSearchParams(location.search);
    return cleanBase(params.get("catalog_api") || FALLBACK_CATALOG_API);
  }

  function productCode(product = {}) {
    return String(product.product_code || product.code || product.id || "").trim();
  }

  function cacheKey(shopCode, catalogApi) {
    return `dpro_bakery_thumb_v34_${shopCode}_${catalogApi}`;
  }

  function readCache(shopCode, catalogApi) {
    try {
      const raw = sessionStorage.getItem(cacheKey(shopCode, catalogApi));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const age = Date.now() - Number(parsed.saved_at || 0);
      if (age > CACHE_MINUTES * 60 * 1000) return null;
      return Array.isArray(parsed.products) ? parsed.products : null;
    } catch {
      return null;
    }
  }

  function writeCache(shopCode, catalogApi, products) {
    try {
      const lightweight = products.map((product) => ({
        product_code: productCode(product),
        product_name: String(product.product_name || "商品"),
        image_url: String(product.image_url || "")
      }));
      sessionStorage.setItem(cacheKey(shopCode, catalogApi), JSON.stringify({
        saved_at: Date.now(),
        products: lightweight
      }));
    } catch {}
  }

  function setProducts(rows) {
    state.products = new Map(
      rows
        .map((row) => [productCode(row), row])
        .filter(([code]) => code)
    );
  }

  async function loadProducts() {
    const shopCode = currentShopCode();
    const catalogApi = currentCatalogApi();
    const identity = `${shopCode}|${catalogApi}`;

    if (state.loading) return;
    if (`${state.shopCode}|${state.catalogApi}` === identity && state.products.size) {
      decorateCards();
      return;
    }

    state.loading = true;
    state.shopCode = shopCode;
    state.catalogApi = catalogApi;
    state.failedImages.clear();

    try {
      const cached = readCache(shopCode, catalogApi);
      if (cached) {
        setProducts(cached);
        decorateCards();
        return;
      }

      const url = `${catalogApi}/api/public/catalog?shop_code=${encodeURIComponent(shopCode)}`;
      const response = await fetch(url, { headers: { Accept: "application/json" } });
      const text = await response.text();
      let data = {};
      try { data = text ? JSON.parse(text) : {}; }
      catch { data = { ok: false, message: text }; }

      if (!response.ok || data?.ok === false) {
        throw new Error(data?.message || data?.error?.message || "商品写真を取得できませんでした。");
      }

      const rows = Array.isArray(data.products) ? data.products : [];
      setProducts(rows);
      writeCache(shopCode, catalogApi, rows);
      decorateCards();
    } catch (error) {
      console.warn("BAKERY-34 thumbnail load:", error);
    } finally {
      state.loading = false;
    }
  }

  function makePlaceholder(name) {
    const placeholder = document.createElement("span");
    placeholder.className = "dpro-product-thumb-placeholder";
    placeholder.setAttribute("aria-label", `${name} 写真未登録`);
    placeholder.textContent = "🥖";
    return placeholder;
  }

  function makeThumbnail(product, code) {
    const name = String(product?.product_name || "商品");
    const imageUrl = String(product?.image_url || "").trim();
    const box = document.createElement("div");
    box.className = "dpro-product-thumb";
    box.dataset.productCode = code;
    box.dataset.imageUrl = imageUrl;

    if (!imageUrl || state.failedImages.has(imageUrl)) {
      box.appendChild(makePlaceholder(name));
      return box;
    }

    const image = document.createElement("img");
    image.src = imageUrl;
    image.alt = `${name}の商品写真`;
    image.loading = "lazy";
    image.decoding = "async";
    image.width = 76;
    image.height = 76;
    image.setAttribute("fetchpriority", "low");
    image.addEventListener("error", () => {
      state.failedImages.add(imageUrl);
      box.replaceChildren(makePlaceholder(name));
    }, { once: true });
    box.appendChild(image);
    return box;
  }

  function decorateCard(plusButton) {
    const code = String(plusButton.getAttribute("data-qty-plus") || "").trim();
    if (!code) return;

    const card = plusButton.closest(".product-card");
    if (!card) return;

    const product = state.products.get(code) || {};
    const desiredImage = String(product.image_url || "").trim();
    const existing = card.querySelector(":scope > .dpro-product-thumb");

    card.classList.add("dpro-thumb-card");

    if (existing
        && existing.dataset.productCode === code
        && existing.dataset.imageUrl === desiredImage) {
      return;
    }

    existing?.remove();
    card.insertBefore(makeThumbnail(product, code), card.firstChild);
  }

  function decorateCards() {
    if (!state.products.size) return;
    document.querySelectorAll("[data-qty-plus]").forEach(decorateCard);
  }

  function scheduleDecorate() {
    setTimeout(decorateCards, 40);
    setTimeout(decorateCards, 220);
  }

  document.addEventListener("click", (event) => {
    if (event.target.closest?.(
      "[data-qty-plus], [data-qty-minus], #repeatLastButton, #applyFavoriteButton, #clearPreorderButton"
    )) {
      scheduleDecorate();
    }
  }, true);

  document.addEventListener("change", (event) => {
    if (event.target?.id === "shopCodeInput") {
      state.products.clear();
      loadProducts();
    }
  }, true);

  const style = document.createElement("style");
  style.textContent = `
    .product-card.dpro-thumb-card{
      display:grid!important;
      grid-template-columns:76px minmax(0,1fr);
      column-gap:12px;
      align-items:start;
    }
    .product-card.dpro-thumb-card > .dpro-product-thumb{
      grid-column:1;
      grid-row:1 / span 5;
    }
    .product-card.dpro-thumb-card > strong,
    .product-card.dpro-thumb-card > span,
    .product-card.dpro-thumb-card > .dpro-customer-limit-note{
      grid-column:2;
      min-width:0;
    }
    .product-card.dpro-thumb-card > .qty-row{
      grid-column:1 / -1;
      margin-top:9px;
    }
    .dpro-product-thumb{
      width:76px;
      height:76px;
      overflow:hidden;
      border-radius:15px;
      background:linear-gradient(135deg,#f9e2c5,#fff4e5);
      border:1px solid rgba(190,116,49,.22);
      contain:content;
    }
    .dpro-product-thumb img{
      display:block;
      width:100%;
      height:100%;
      object-fit:cover;
    }
    .dpro-product-thumb-placeholder{
      display:grid;
      place-items:center;
      width:100%;
      height:100%;
      font-size:30px;
      line-height:1;
    }
    @media(max-width:480px){
      .product-card.dpro-thumb-card{
        grid-template-columns:64px minmax(0,1fr);
        column-gap:10px;
      }
      .dpro-product-thumb{
        width:64px;
        height:64px;
        border-radius:13px;
      }
      .dpro-product-thumb-placeholder{font-size:27px}
    }
  `;
  document.head.appendChild(style);

  function start() {
    loadProducts();
    setInterval(() => {
      if (document.visibilityState !== "visible") return;
      const identity = `${currentShopCode()}|${currentCatalogApi()}`;
      if (`${state.shopCode}|${state.catalogApi}` !== identity || !state.products.size) {
        loadProducts();
      } else {
        decorateCards();
      }
    }, CHECK_INTERVAL_MS);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
