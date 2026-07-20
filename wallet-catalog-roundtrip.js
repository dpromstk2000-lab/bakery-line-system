// =========================================================
// DPRO Bakery STEP BAKERY-36
// 会員証 ⇄ 写真付き商品カタログ 往復導線
// ・会員証と取り置き欄にカタログボタンを追加
// ・遷移前の数量、受取日、受取時間を一時保存
// ・カタログから戻ると元の数量を復元し、選択商品を1個追加
// ・既存の上限、在庫、予約処理をそのまま利用
// ・DOM変更の常時監視は使用しません
// =========================================================

(() => {
  const DRAFT_TTL_MS = 30 * 60 * 1000;
  const DEFAULT_CATALOG_API = 'https://dpro-bakery-catalog-api.dpromstk2000.workers.dev';
  const initialParams = new URLSearchParams(location.search);
  const initialShop = initialParams.get('shop_code') || 'bakery_demo';
  const selectionKey = 'dpro_bakery_catalog_selected_' + initialShop;
  const clean = (v) => String(v || '').trim();
  const cleanBase = (v) => clean(v).replace(/\/+$/, '');
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function safeJson(raw) {
    try { return JSON.parse(raw || 'null'); } catch { return null; }
  }

  function captureCatalogSelection() {
    if (initialParams.get('from') !== 'catalog') return null;
    const stored = safeJson(localStorage.getItem(selectionKey));
    const code = clean(initialParams.get('product_code') || stored?.product_code);
    const name = clean(initialParams.get('product_name') || stored?.product_name || code);
    if (!code) return null;

    // 既存bridgeによる二重追加を防ぐため、bridge読込前にfromを除去します。
    const url = new URL(location.href);
    ['from', 'product_code', 'product_name'].forEach((key) => url.searchParams.delete(key));
    history.replaceState({}, '', url.toString());
    return { product_code: code, product_name: name };
  }

  let selectedFromCatalog = captureCatalogSelection();

  function shopCode() {
    const params = new URLSearchParams(location.search);
    return clean(params.get('shop_code') || document.getElementById('shopCodeInput')?.value || initialShop);
  }

  function walletApi() {
    const params = new URLSearchParams(location.search);
    return cleanBase(params.get('api') || document.getElementById('apiBaseInput')?.value || 'https://dpro-bakery-wallet-api.dpromstk2000.workers.dev');
  }

  function catalogApi() {
    const params = new URLSearchParams(location.search);
    return cleanBase(params.get('catalog_api') || DEFAULT_CATALOG_API);
  }

  function draftKey() {
    return 'dpro_bakery_wallet_catalog_draft_v36_' + shopCode();
  }

  function qtyFromButton(button) {
    return Math.max(0, Number(button?.closest('.product-card')?.querySelector('.qty-number')?.textContent || 0));
  }

  function currentItems() {
    const items = {};
    document.querySelectorAll('[data-qty-plus]').forEach((button) => {
      const code = clean(button.getAttribute('data-qty-plus'));
      const qty = qtyFromButton(button);
      if (code && qty > 0) items[code] = qty;
    });
    return items;
  }

  function saveDraft() {
    const draft = {
      saved_at: Date.now(),
      items: currentItems(),
      pickup_date: clean(document.getElementById('pickupDateInput')?.value),
      pickup_time: clean(document.getElementById('pickupTimeInput')?.value)
    };
    try { localStorage.setItem(draftKey(), JSON.stringify(draft)); } catch {}
  }

  function loadDraft() {
    const draft = safeJson(localStorage.getItem(draftKey()));
    if (!draft || Date.now() - Number(draft.saved_at || 0) > DRAFT_TTL_MS) {
      try { localStorage.removeItem(draftKey()); } catch {}
      return null;
    }
    return draft;
  }

  function clearDraft() {
    try {
      localStorage.removeItem(draftKey());
      localStorage.removeItem(selectionKey);
    } catch {}
  }

  function walletReturnUrl() {
    const url = new URL('./wallet.html', location.href);
    url.search = '';
    url.searchParams.set('shop_code', shopCode());
    url.searchParams.set('api', walletApi());
    url.searchParams.set('catalog_api', catalogApi());
    url.searchParams.set('v', '36');
    return url.toString();
  }

  function catalogUrl() {
    const url = new URL('./catalog.html', location.href);
    url.search = '';
    url.searchParams.set('shop_code', shopCode());
    url.searchParams.set('catalog_api', catalogApi());
    url.searchParams.set('api', walletApi());
    url.searchParams.set('wallet_url', walletReturnUrl());
    url.searchParams.set('from', 'wallet');
    url.searchParams.set('v', '36');
    return url.toString();
  }

  function openCatalog() {
    saveDraft();
    location.href = catalogUrl();
  }

  function addButtons() {
    if (!document.getElementById('dpro36HeroCatalogButton')) {
      const row = document.querySelector('.hero .button-row');
      if (row) {
        const button = document.createElement('button');
        button.id = 'dpro36HeroCatalogButton';
        button.type = 'button';
        button.className = 'catalog';
        button.textContent = '写真カタログ';
        button.addEventListener('click', openCatalog);
        row.appendChild(button);
      }
    }

    if (!document.getElementById('dpro36CatalogGuide')) {
      const panel = document.getElementById('preorderPanel');
      const head = panel?.querySelector('.panel-head');
      if (panel && head) {
        const guide = document.createElement('div');
        guide.id = 'dpro36CatalogGuide';
        guide.className = 'dpro36-catalog-guide';
        guide.innerHTML = `
          <div class="dpro36-icon" aria-hidden="true">🥐</div>
          <div class="dpro36-copy">
            <strong>写真を見ながらパンを選べます</strong>
            <span>写真・価格・説明を確認できます。現在の数量と受取日時は一時保存されます。</span>
          </div>
          <button id="dpro36OpenCatalogButton" type="button">写真付きパンカタログを見る</button>`;
        head.insertAdjacentElement('afterend', guide);
        guide.querySelector('#dpro36OpenCatalogButton')?.addEventListener('click', openCatalog);
      }
    }
  }

  function setStatus(message, tone = 'ok') {
    const box = document.getElementById('preorderStatus');
    if (!box) return;
    box.textContent = message;
    box.className = 'status-box ' + tone;
  }

  function plusButton(code) {
    const escaped = window.CSS?.escape ? CSS.escape(code) : String(code).replace(/["\\]/g, '\\$&');
    return document.querySelector(`[data-qty-plus="${escaped}"]`);
  }

  function currentQty(code) {
    return qtyFromButton(plusButton(code));
  }

  async function waitForProducts() {
    for (let count = 0; count < 60; count += 1) {
      if (document.querySelector('[data-qty-plus]')) return true;
      await sleep(150);
    }
    return false;
  }

  async function setQtyAtLeast(code, desired) {
    const target = Math.max(0, Number(desired || 0));
    for (let count = 0; count < 30; count += 1) {
      const button = plusButton(code);
      if (!button) return { completed: false, reason: 'not_found' };
      if (currentQty(code) >= target) return { completed: true };
      if (button.disabled) return { completed: false, reason: 'limit' };
      button.click();
      await sleep(55);
    }
    return { completed: currentQty(code) >= target, reason: 'timeout' };
  }

  async function restorePickup(draft) {
    if (!draft) return;
    const date = document.getElementById('pickupDateInput');
    const time = document.getElementById('pickupTimeInput');
    if (date && draft.pickup_date && date.value !== draft.pickup_date) {
      date.value = draft.pickup_date;
      date.dispatchEvent(new Event('change', { bubbles: true }));
      await sleep(350);
    }
    if (time && draft.pickup_time && [...time.options].some((o) => o.value === draft.pickup_time)) {
      time.value = draft.pickup_time;
      time.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  async function restoreRoundTrip() {
    const draft = loadDraft();
    if (!draft && !selectedFromCatalog) return;
    if (!(await waitForProducts())) {
      setStatus('商品一覧の読み込みに時間がかかっています。画面を再読み込みしてください。', 'warn');
      return;
    }

    await restorePickup(draft);
    const desired = { ...((draft && draft.items) || {}) };
    if (selectedFromCatalog?.product_code) {
      const code = selectedFromCatalog.product_code;
      desired[code] = Number(desired[code] || 0) + 1;
    }

    const results = [];
    for (const [code, qty] of Object.entries(desired)) {
      results.push(await setQtyAtLeast(code, qty));
    }
    const incomplete = results.some((r) => !r.completed);
    const selectedName = selectedFromCatalog?.product_name || selectedFromCatalog?.product_code || '';
    clearDraft();

    if (selectedFromCatalog && !incomplete) {
      setStatus(`カタログから戻りました。元の選択内容を復元し、「${selectedName}」を1個追加しました。受け取り日と時間を確認してください。`, 'ok');
    } else if (selectedFromCatalog) {
      setStatus(`カタログから戻りました。「${selectedName}」を在庫数・お一人様上限の範囲内で追加しました。数量を確認してください。`, 'warn');
    } else {
      setStatus('カタログから戻りました。選択中の商品と受取日時を復元しました。', 'ok');
    }

    document.getElementById('preorderPanel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    selectedFromCatalog = null;
  }

  const style = document.createElement('style');
  style.textContent = `
    .hero .button-row button.catalog{background:linear-gradient(135deg,#a54b10,#d97706);color:#fff}
    .dpro36-catalog-guide{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:12px;margin:12px 0 16px;padding:14px;border-radius:18px;background:linear-gradient(135deg,#fff7ed,#ffedd5);border:1px solid #fdba74;box-shadow:0 10px 28px rgba(154,52,18,.07)}
    .dpro36-icon{width:54px;height:54px;display:grid;place-items:center;border-radius:16px;background:#fff;font-size:30px;border:1px solid #fed7aa}
    .dpro36-copy strong{display:block;color:#7c2d12;font-size:15px;line-height:1.35}
    .dpro36-copy span{display:block;margin-top:3px;color:#78716c;font-size:11px;line-height:1.55;font-weight:800}
    #dpro36OpenCatalogButton{width:auto;min-width:190px;padding:11px 15px;border:0;border-radius:999px;background:#9a3412;color:#fff;font-size:13px;font-weight:950;cursor:pointer}
    @media(max-width:640px){.dpro36-catalog-guide{grid-template-columns:54px minmax(0,1fr)}#dpro36OpenCatalogButton{grid-column:1/-1;width:100%;min-width:0}}
  `;
  document.head.appendChild(style);

  function start() {
    addButtons();
    restoreRoundTrip();
    document.addEventListener('click', (event) => {
      if (event.target.closest?.('#useDemoMemberButton, #registerButton, [data-scroll]')) setTimeout(addButtons, 100);
    }, true);
    window.addEventListener('pageshow', () => {
      addButtons();
      restoreRoundTrip();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
