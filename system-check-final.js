// =========================================================
// DPRO Bakery STEP BAKERY-39
// 最終統合 system-check
//
// 従来のウォレットWorker確認に加え、次を一括検査します。
// ・カタログWorker / 写真付き商品
// ・QR来店確認 / 二段階受け渡し / 二重受け渡し防止
// ・会員証QRの生成→復号ラウンドトリップ
// ・iPadカメラ利用条件 / jsQRフォールバック
// ・Bluetooth HID自動待受
// ・STEP BAKERY-40 複数端末ライブ同期
// ・GitHub Pages必須ファイル
// =========================================================

(() => {
  const VERSION = "BAKERY-39-FINAL-SYSTEM-CHECK-20260720";
  const DEFAULT_CATALOG_API =
    "https://dpro-bakery-catalog-api.dpromstk2000.workers.dev";
  const QR_TEST_VALUE = "DEMO-BK-001";
  const FETCH_TIMEOUT_MS = 12000;

  const state = {
    running: false,
    result: null,
    catalogData: null,
    catalogHealth: null,
    assetTexts: new Map()
  };

  const byId = (id) => document.getElementById(id);
  const clean = (value) => String(value || "").trim();
  const cleanBase = (value) => clean(value).replace(/\/+$/, "");
  const escapeHtmlSafe = (value) =>
    String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  function currentShopCode() {
    return clean(byId("shopCodeInput")?.value || "bakery_demo");
  }

  function walletApi() {
    return cleanBase(
      byId("apiBaseInput")?.value ||
      "https://dpro-bakery-wallet-api.dpromstk2000.workers.dev"
    );
  }

  function catalogApi() {
    const params = new URLSearchParams(location.search);
    return cleanBase(
      byId("finalCatalogApiInput")?.value ||
      params.get("catalog_api") ||
      DEFAULT_CATALOG_API
    );
  }

  function currentAdminCode() {
    return clean(byId("adminCodeInput")?.value);
  }

  function basePageUrl() {
    return new URL("./", location.href);
  }

  function assetUrl(path) {
    return new URL(path, basePageUrl()).toString();
  }

  function jstNow() {
    return new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    }).format(new Date());
  }

  async function withTimeout(promise, timeoutMs = FETCH_TIMEOUT_MS) {
    let timer;
    try {
      return await Promise.race([
        promise,
        new Promise((_, reject) => {
          timer = setTimeout(
            () => reject(new Error("確認がタイムアウトしました。")),
            timeoutMs
          );
        })
      ]);
    } finally {
      clearTimeout(timer);
    }
  }

  async function fetchJson(url, options = {}) {
    const response = await withTimeout(fetch(url, {
      cache: "no-store",
      ...options,
      headers: {
        Accept: "application/json",
        ...(options.headers || {})
      }
    }));

    const text = await response.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      throw new Error("JSONではない応答です。HTTP " + response.status);
    }

    if (!response.ok || data?.ok === false) {
      throw new Error(
        data?.error?.message ||
        data?.message ||
        data?.error ||
        "HTTP " + response.status
      );
    }
    return data;
  }

  async function fetchText(path) {
    const url = assetUrl(path);
    const response = await withTimeout(fetch(url, {
      cache: "no-store",
      headers: { Accept: "text/plain,*/*" }
    }));
    if (!response.ok) {
      throw new Error(`${path}: HTTP ${response.status}`);
    }
    const text = await response.text();
    if (!text || text.length < 20) {
      throw new Error(`${path}: ファイル内容が空です。`);
    }
    state.assetTexts.set(path, text);
    return text;
  }

  async function imageLoads(url) {
    if (!url) throw new Error("商品画像URLがありません。");
    return withTimeout(new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve({
        width: image.naturalWidth,
        height: image.naturalHeight
      });
      image.onerror = () => reject(
        new Error("商品画像を読み込めませんでした。")
      );
      image.src =
        url + (url.includes("?") ? "&" : "?") +
        "dpro_check=" + Date.now();
    }), 15000);
  }

  function qrRoundTrip() {
    if (typeof window.qrcode !== "function") {
      throw new Error("qrcode-generatorが読み込まれていません。");
    }
    if (typeof window.jsQR !== "function") {
      throw new Error("jsQRが読み込まれていません。");
    }

    const qr = window.qrcode(0, "M");
    qr.addData(QR_TEST_VALUE, "Byte");
    qr.make();

    const moduleCount = qr.getModuleCount();
    const quiet = 4;
    const cell = 10;
    const size = (moduleCount + quiet * 2) * cell;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;

    const context = canvas.getContext("2d", { alpha: false });
    context.imageSmoothingEnabled = false;
    context.fillStyle = "#fff";
    context.fillRect(0, 0, size, size);
    context.fillStyle = "#000";

    for (let row = 0; row < moduleCount; row += 1) {
      for (let col = 0; col < moduleCount; col += 1) {
        if (!qr.isDark(row, col)) continue;
        context.fillRect(
          (col + quiet) * cell,
          (row + quiet) * cell,
          cell,
          cell
        );
      }
    }

    const image = context.getImageData(0, 0, size, size);
    const decoded = window.jsQR(
      image.data,
      image.width,
      image.height,
      { inversionAttempts: "dontInvert" }
    );

    if (decoded?.data !== QR_TEST_VALUE) {
      throw new Error(
        `QR復号結果が不一致です: ${decoded?.data || "未検出"}`
      );
    }

    return {
      encoded: QR_TEST_VALUE,
      decoded: decoded.data,
      modules: moduleCount
    };
  }

  function item(key, label, ok, detail, data = null) {
    return {
      key,
      label,
      ok: !!ok,
      detail: clean(detail),
      ...(data ? { data } : {})
    };
  }

  async function check(
    items,
    key,
    label,
    runner
  ) {
    try {
      const result = await runner();
      const detail =
        typeof result === "string"
          ? result
          : result?.detail || "正常です。";
      items.push(item(key, label, true, detail, result?.data || null));
      return result;
    } catch (error) {
      items.push(item(
        key,
        label,
        false,
        error?.message || "確認に失敗しました。"
      ));
      return null;
    }
  }

  function renderItems(items) {
    const box = byId("finalCheckItems");
    if (!box) return;
    box.innerHTML = items.map((entry) => `
      <div class="dpro39-check-item">
        <span class="dpro39-pill ${entry.ok ? "pass" : "fail"}">
          ${entry.ok ? "PASS" : "FAIL"}
        </span>
        <b>${escapeHtmlSafe(entry.label)}</b>
        <span>${escapeHtmlSafe(entry.detail)}</span>
      </div>
    `).join("");
  }

  function renderSummary(result) {
    const passed = result.passed;
    const failed = result.failed;

    byId("finalPass").textContent = String(passed);
    byId("finalFail").textContent = String(failed);
    byId("finalTotal").textContent = String(result.total);
    byId("finalAllOk").textContent =
      result.all_ok ? "ALL OK" : "要修正";

    byId("finalAllOk").className =
      "dpro39-metric-value " + (result.all_ok ? "pass" : "fail");

    const status = byId("finalCheckStatus");
    status.className =
      "dpro39-status " + (result.all_ok ? "ok" : "ng");
    status.textContent = result.all_ok
      ? "全機能の最終チェックが完了しました。販売・導入前の検査はALL OKです。"
      : `最終チェックで ${failed} 件の修正・確認が必要です。`;

    const output = byId("finalJsonOutput");
    output.value = JSON.stringify(result, null, 2);

    const legacyTotal = byId("sumTotal");
    if (legacyTotal) {
      legacyTotal.textContent = result.all_ok ? "ALL OK" : "NG";
      legacyTotal.closest(".summary-card")?.classList.remove(
        "pass", "warn", "fail", "info"
      );
      legacyTotal.closest(".summary-card")?.classList.add(
        result.all_ok ? "pass" : "fail"
      );
    }

    renderItems(result.items);
  }

  function setRunning(running) {
    state.running = running;
    const buttons = [
      byId("runAllButton"),
      byId("finalRunButton")
    ].filter(Boolean);

    buttons.forEach((button) => {
      button.disabled = running;
      button.textContent = running
        ? "全機能を確認中…"
        : "全機能を一括チェック";
    });

    if (running) {
      const status = byId("finalCheckStatus");
      status.className = "dpro39-status info";
      status.textContent =
        "ウォレット、カタログ、写真、QR、カメラ、HID、ライブ同期を確認しています。";
    }
  }

  async function independentChecks() {
    const items = [];
    let walletHealth = null;
    let walletSettings = null;
    let catalogHealth = null;
    let catalogData = null;

    walletHealth = await check(
      items,
      "wallet_api",
      "ウォレットWorker API",
      async () => {
        const data = await fetchJson(walletApi() + "/api/health");
        if (data?.ok !== true) throw new Error("ok=trueではありません。");
        return {
          detail: data.version || "Worker起動OK",
          data: {
            version: data.version || "",
            service: data.service || ""
          }
        };
      }
    );

    walletSettings = await check(
      items,
      "wallet_supabase",
      "ウォレット・Supabase接続",
      async () => {
        const url = new URL(walletApi() + "/api/public/settings");
        url.searchParams.set("shop_code", currentShopCode());
        const data = await fetchJson(url.toString());
        const shop = data.shop || data.settings || {};
        return {
          detail:
            `${shop.shop_name || currentShopCode()} の店舗設定を取得しました。`,
          data: {
            shop_code: currentShopCode(),
            shop_name: shop.shop_name || ""
          }
        };
      }
    );

    catalogHealth = await check(
      items,
      "catalog_api",
      "カタログWorker API",
      async () => {
        const data = await fetchJson(catalogApi() + "/api/health");
        state.catalogHealth = data;
        if (data?.ok !== true) throw new Error("ok=trueではありません。");
        return {
          detail: data.version || "カタログWorker起動OK",
          data: {
            version: data.version || "",
            storage_bucket: data.storage_bucket || ""
          }
        };
      }
    );

    catalogData = await check(
      items,
      "catalog_products",
      "写真付き商品カタログ",
      async () => {
        const url = new URL(catalogApi() + "/api/public/catalog");
        url.searchParams.set("shop_code", currentShopCode());
        const data = await fetchJson(url.toString());
        state.catalogData = data;
        const products = Array.isArray(data.products) ? data.products : [];
        if (!products.length) {
          throw new Error("カタログ商品が0件です。");
        }
        const photos = products.filter((p) => clean(p.image_url)).length;
        return {
          detail:
            `商品 ${products.length}件／写真 ${photos}件を取得しました。`,
          data: {
            product_count: products.length,
            photo_count: photos,
            category_count: Array.isArray(data.categories)
              ? data.categories.length
              : 0
          }
        };
      }
    );

    await check(
      items,
      "product_image_storage",
      "商品画像Storage",
      async () => {
        const products =
          state.catalogData?.products ||
          catalogData?.data?.products ||
          [];
        const photo = products.find((p) => clean(p.image_url));
        if (!photo) {
          throw new Error("画像付き商品がありません。");
        }
        const size = await imageLoads(photo.image_url);
        return {
          detail:
            `${photo.product_name || "商品画像"}を ${size.width}×${size.height}px で読み込みました。`
        };
      }
    );

    await check(
      items,
      "pickup_protection",
      "QR来店・二段階受け渡し保護",
      async () => {
        const features = state.catalogHealth?.features || {};
        const required = [
          "ipad_qr_arrival",
          "two_step_pickup_confirmation",
          "double_pickup_guard"
        ];
        const missing = required.filter((key) => features[key] !== true);
        if (missing.length) {
          throw new Error(
            "不足機能: " + missing.join(", ")
          );
        }
        return {
          detail:
            "QR来店確認、明示的な受け渡し完了、二重受け渡し防止が有効です。"
        };
      }
    );

    const assets = [
      {
        path: "wallet.html",
        label: "お客様会員証画面",
        marker: "wallet-qr-standard.js"
      },
      {
        path: "catalog.html",
        label: "公開写真カタログ",
        marker: "/api/public/catalog"
      },
      {
        path: "staff.html",
        label: "店舗iPad画面",
        marker: "staff-live-sync.js?v=40"
      },
      {
        path: "wallet-qr-standard.js",
        label: "標準QR生成",
        marker: "STEP BAKERY-37-R1"
      },
      {
        path: "staff-qr-pickup.js",
        label: "QR来店・受け渡し",
        marker: "/api/admin/pickup/lookup"
      },
      {
        path: "staff-hid-scanner.js",
        label: "Bluetooth HID待受",
        marker: "handleGlobalKeydown"
      },
      {
        path: "staff-live-sync.js",
        label: "複数端末ライブ同期",
        marker: "STEP BAKERY-40"
      },
      {
        path: "vendor/qrcode-generator-1.4.4.js",
        label: "QR生成ライブラリ",
        marker: "var qrcode"
      },
      {
        path: "vendor/jsQR-1.4.0.js",
        label: "QR復号ライブラリ",
        marker: "webpackUniversalModuleDefinition"
      }
    ];

    for (const asset of assets) {
      await check(
        items,
        "asset_" + asset.path.replace(/[^a-z0-9]+/gi, "_"),
        asset.label,
        async () => {
          const text = await fetchText(asset.path);
          if (!text.includes(asset.marker)) {
            throw new Error(
              `${asset.path}に必要な識別子がありません。`
            );
          }
          return {
            detail:
              `${asset.path} / ${(text.length / 1024).toFixed(1)}KB`
          };
        }
      );
    }

    await check(
      items,
      "qr_roundtrip",
      "会員証QR生成・復号",
      async () => {
        const result = qrRoundTrip();
        return {
          detail:
            `${result.encoded}を生成し、同じ値へ復号しました。`,
          data: result
        };
      }
    );

    await check(
      items,
      "camera_ready",
      "iPadカメラ利用条件",
      async () => {
        if (!window.isSecureContext) {
          throw new Error("HTTPSの安全な接続ではありません。");
        }
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("カメラAPIを利用できないブラウザです。");
        }
        if (
          typeof window.BarcodeDetector !== "function" &&
          typeof window.jsQR !== "function"
        ) {
          throw new Error("QR読み取り手段がありません。");
        }
        return {
          detail:
            typeof window.BarcodeDetector === "function"
              ? "HTTPS・カメラAPI・BarcodeDetectorを利用できます。"
              : "HTTPS・カメラAPI・jsQRフォールバックを利用できます。"
        };
      }
    );

    await check(
      items,
      "hid_reader_ready",
      "Bluetooth／USB HID自動待受",
      async () => {
        const text =
          state.assetTexts.get("staff-hid-scanner.js") ||
          await fetchText("staff-hid-scanner.js");
        const required = [
          "handleGlobalKeydown",
          "DUPLICATE_COOLDOWN_MS",
          'key === "Enter"',
          'key === "Tab"'
        ];
        const missing = required.filter((marker) => !text.includes(marker));
        if (typeof KeyboardEvent !== "function" || missing.length) {
          throw new Error(
            "HID待受要件不足: " + missing.join(", ")
          );
        }
        return {
          detail:
            "高速キーボード入力、Enter／Tab、連続読取防止を確認しました。"
        };
      }
    );

    await check(
      items,
      "live_sync_ready",
      "複数端末・自動更新",
      async () => {
        const text =
          state.assetTexts.get("staff-live-sync.js") ||
          await fetchText("staff-live-sync.js");
        const required = [
          "AUTO_REFRESH_MS",
          "visibilitychange",
          "preflightStatusChange",
          "lastUpdatedAt"
        ];
        const missing = required.filter((marker) => !text.includes(marker));
        if (missing.length) {
          throw new Error(
            "ライブ同期要件不足: " + missing.join(", ")
          );
        }
        return {
          detail:
            "30秒更新、画面復帰更新、競合事前確認、最終更新時刻を確認しました。"
        };
      }
    );

    items.push(item(
      "admin_code",
      "管理コード",
      !!currentAdminCode(),
      currentAdminCode()
        ? "管理コードが入力されています。"
        : "管理コードが未入力です。"
    ));

    return items;
  }

  async function runIntegratedCheck() {
    if (state.running) return;
    setRunning(true);

    try {
      if (
        currentShopCode() === "bakery_demo" &&
        !currentAdminCode() &&
        byId("adminCodeInput")
      ) {
        byId("adminCodeInput").value = "1234";
      }

      const legacyRunner =
        typeof runAllChecks === "function"
          ? runAllChecks
          : null;

      if (legacyRunner) {
        await legacyRunner();
      }

      const items = await independentChecks();
      const legacyOk =
        clean(byId("sumTotal")?.textContent) === "OK" ||
        clean(byId("sumTotal")?.textContent) === "ALL OK";

      items.push(item(
        "legacy_system_check",
        "従来system-check",
        legacyOk,
        legacyOk
          ? "Worker、認証、DEMOガード、管理データの従来チェックはOKです。"
          : "従来チェックにNGがあります。上部の結果を確認してください。"
      ));

      const passed = items.filter((entry) => entry.ok).length;
      const failed = items.length - passed;
      const result = {
        ok: failed === 0,
        service: "DPRO Bakery Final System Check",
        version: VERSION,
        time: new Date().toISOString(),
        jst_checked_at: jstNow(),
        shop_code: currentShopCode(),
        wallet_api: walletApi(),
        catalog_api: catalogApi(),
        all_ok: failed === 0,
        passed,
        failed,
        total: items.length,
        items
      };

      state.result = result;
      window.DPRO_BAKERY_FINAL_SYSTEM_CHECK = result;
      renderSummary(result);

      try {
        if (typeof log === "function") {
          log(
            result.all_ok
              ? "STEP BAKERY-39 最終チェック ALL OK"
              : "STEP BAKERY-39 最終チェック NG",
            result
          );
        }
      } catch {}
    } catch (error) {
      const result = {
        ok: false,
        service: "DPRO Bakery Final System Check",
        version: VERSION,
        time: new Date().toISOString(),
        shop_code: currentShopCode(),
        all_ok: false,
        passed: 0,
        failed: 1,
        total: 1,
        items: [
          item(
            "unexpected_error",
            "最終チェック実行",
            false,
            error?.message || "予期しないエラーです。"
          )
        ]
      };
      state.result = result;
      window.DPRO_BAKERY_FINAL_SYSTEM_CHECK = result;
      renderSummary(result);
    } finally {
      setRunning(false);
    }
  }

  async function copyFinalJson() {
    const text = byId("finalJsonOutput")?.value || "";
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      const status = byId("finalCheckStatus");
      status.textContent =
        "最終チェックJSONをコピーしました。";
    } catch {
      window.prompt("コピーしてください", text);
    }
  }

  function injectCatalogInput() {
    if (byId("finalCatalogApiInput")) return;
    const setup = document.querySelector(".setup-grid");
    if (!setup) return;

    const params = new URLSearchParams(location.search);
    const wrap = document.createElement("div");
    wrap.innerHTML = `
      <label for="finalCatalogApiInput">カタログWorker API URL</label>
      <input
        id="finalCatalogApiInput"
        value="${escapeHtmlSafe(
          params.get("catalog_api") || DEFAULT_CATALOG_API
        )}"
        autocomplete="off">
    `;
    setup.appendChild(wrap);
  }

  function injectPanel() {
    if (byId("finalSystemPanel")) return;

    const panel = document.createElement("section");
    panel.className = "panel";
    panel.id = "finalSystemPanel";
    panel.innerHTML = `
      <style>
        .dpro39-head{
          display:flex;justify-content:space-between;
          gap:14px;align-items:flex-start;margin-bottom:14px
        }
        .dpro39-badge{
          display:inline-flex;border-radius:999px;
          padding:6px 11px;background:#1c1917;color:#fff7ed;
          font-size:12px;font-weight:950
        }
        .dpro39-metrics{
          display:grid;grid-template-columns:repeat(4,minmax(0,1fr));
          gap:10px;margin:12px 0
        }
        .dpro39-metric{
          border:1px solid #fed7aa;background:#fff;
          border-radius:17px;padding:13px
        }
        .dpro39-metric span{
          display:block;color:#78716c;font-size:11px;font-weight:950
        }
        .dpro39-metric-value{
          font-size:23px;font-weight:950;margin-top:3px
        }
        .dpro39-metric-value.pass{color:#166534}
        .dpro39-metric-value.fail{color:#991b1b}
        .dpro39-status{
          border:1px solid #bfdbfe;background:#eff6ff;color:#1e3a8a;
          border-radius:16px;padding:13px 14px;font-weight:900;
          white-space:pre-wrap
        }
        .dpro39-status.ok{
          border-color:#bbf7d0;background:#f0fdf4;color:#166534
        }
        .dpro39-status.ng{
          border-color:#fecaca;background:#fef2f2;color:#991b1b
        }
        .dpro39-check-list{
          display:grid;gap:8px;margin-top:12px
        }
        .dpro39-check-item{
          display:grid;grid-template-columns:72px 210px minmax(0,1fr);
          gap:10px;align-items:start;border:1px solid #fed7aa;
          border-radius:14px;background:#fff;padding:10px 12px;
          font-size:13px
        }
        .dpro39-pill{
          display:inline-flex;justify-content:center;border-radius:999px;
          padding:5px 9px;font-size:11px;font-weight:950
        }
        .dpro39-pill.pass{background:#dcfce7;color:#166534}
        .dpro39-pill.fail{background:#fee2e2;color:#991b1b}
        .dpro39-output{
          width:100%;min-height:240px;margin-top:12px;
          border:0;border-radius:16px;padding:14px;
          background:#1c1917;color:#ffedd5;
          font-family:ui-monospace,SFMono-Regular,Menlo,monospace;
          font-size:12px;line-height:1.55
        }
        @media(max-width:820px){
          .dpro39-head{display:block}
          .dpro39-metrics{grid-template-columns:1fr 1fr}
          .dpro39-check-item{grid-template-columns:1fr}
        }
        @media(max-width:520px){
          .dpro39-metrics{grid-template-columns:1fr}
        }
      </style>

      <div class="dpro39-head">
        <div>
          <span class="dpro39-badge">STEP BAKERY-39 / FINAL CHECK</span>
          <h2 style="margin-top:10px;">全機能・販売前最終チェック</h2>
          <div class="small">
            ウォレット、写真カタログ、会員QR、iPadカメラ、HIDリーダー、
            二重受け渡し防止、複数端末同期を一括確認します。
          </div>
        </div>
        <div class="button-row" style="margin:0;">
          <button class="green" id="finalRunButton" type="button">
            全機能を一括チェック
          </button>
          <button class="ghost" id="finalCopyButton" type="button">
            JSONをコピー
          </button>
        </div>
      </div>

      <div class="dpro39-metrics">
        <div class="dpro39-metric">
          <span>PASS</span>
          <div class="dpro39-metric-value pass" id="finalPass">-</div>
        </div>
        <div class="dpro39-metric">
          <span>FAIL</span>
          <div class="dpro39-metric-value fail" id="finalFail">-</div>
        </div>
        <div class="dpro39-metric">
          <span>総チェック数</span>
          <div class="dpro39-metric-value" id="finalTotal">-</div>
        </div>
        <div class="dpro39-metric">
          <span>最終判定</span>
          <div class="dpro39-metric-value" id="finalAllOk">未確認</div>
        </div>
      </div>

      <div id="finalCheckStatus" class="dpro39-status info">
        「全機能を一括チェック」を押してください。DEMO店舗は管理コード1234を自動設定します。
      </div>

      <details open style="margin-top:14px;">
        <summary>最終チェック結果</summary>
        <div class="detail-body">
          <div id="finalCheckItems" class="dpro39-check-list">
            <div class="dpro39-status info">まだ実行していません。</div>
          </div>
        </div>
      </details>

      <details>
        <summary>system-check JSON</summary>
        <div class="detail-body">
          <textarea
            id="finalJsonOutput"
            class="dpro39-output"
            readonly>まだ実行していません。</textarea>
        </div>
      </details>
    `;

    const summary = document.querySelector(".summary-grid");
    if (summary) {
      summary.insertAdjacentElement("afterend", panel);
    } else {
      document.querySelector(".wrap")?.appendChild(panel);
    }

    byId("finalRunButton")?.addEventListener(
      "click",
      runIntegratedCheck
    );
    byId("finalCopyButton")?.addEventListener(
      "click",
      copyFinalJson
    );
  }

  function replaceLegacyRunButton() {
    const oldButton = byId("runAllButton");
    if (!oldButton || oldButton.dataset.dpro39 === "1") return;

    const replacement = oldButton.cloneNode(true);
    replacement.dataset.dpro39 = "1";
    replacement.textContent = "全機能を一括チェック";
    oldButton.replaceWith(replacement);
    replacement.addEventListener("click", runIntegratedCheck);
  }

  function boot() {
    injectCatalogInput();
    injectPanel();
    replaceLegacyRunButton();

    if (
      currentShopCode() === "bakery_demo" &&
      !currentAdminCode() &&
      byId("adminCodeInput")
    ) {
      byId("adminCodeInput").value = "1234";
    }

    const params = new URLSearchParams(location.search);
    const shouldAutoRun =
      params.get("autorun") === "1" ||
      params.get("auto") === "1";
    if (shouldAutoRun) {
      setTimeout(runIntegratedCheck, 300);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      boot,
      { once: true }
    );
  } else {
    boot();
  }
})();
