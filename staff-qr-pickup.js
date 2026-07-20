// =========================================================
// DPRO Bakery STEP BAKERY-37
// 店舗iPad：QR来店確認・受け渡し完了
//
// QRを読んだだけでは受け渡し済みにしません。
// 1. QR読取で「来店確認」
// 2. 本日の予約と準備状態を表示
// 3. 商品を確認して明示的に「受け渡し完了」
// =========================================================

(() => {
  const DEFAULT_PICKUP_API =
    "https://dpro-bakery-catalog-api.dpromstk2000.workers.dev";
  const JSQR_LOCAL = "./vendor/jsQR-1.4.0.js";
  const JSQR_CDN =
    "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js";

  const state = {
    stream: null,
    scanTimer: null,
    detector: null,
    canvas: null,
    context: null,
    selectedCustomerKey: "",
    lastResult: null,
    jsQrLoading: null
  };

  const clean = (value) => String(value || "").trim();
  const $ = (id) => document.getElementById(id);

  function shopCode() {
    const params = new URLSearchParams(location.search);
    return clean(
      $("shopCodeInput")?.value ||
      params.get("shop_code") ||
      "bakery_demo"
    );
  }

  function adminCode() {
    return clean($("adminCodeInput")?.value || "");
  }

  function pickupApi() {
    const params = new URLSearchParams(location.search);
    return clean(
      $("dpro37PickupApiInput")?.value ||
      params.get("pickup_api") ||
      params.get("catalog_api") ||
      DEFAULT_PICKUP_API
    ).replace(/\/+$/, "");
  }

  function staffName() {
    return clean($("dpro37StaffNameInput")?.value || "スタッフ") || "スタッフ";
  }

  function todayJst() {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(new Date());
  }

  function normalizePhone(value) {
    let text = clean(value)
      .normalize("NFKC")
      .replace(/[^0-9+]/g, "");
    if (text.startsWith("+81")) text = "0" + text.slice(3);
    return text.replace(/[^0-9]/g, "");
  }

  function parseQrValue(value) {
    const raw = clean(value);
    if (!raw) return "";

    try {
      const obj = JSON.parse(raw);
      return clean(
        obj.member_code ||
        obj.customer_key ||
        obj.line_user_id ||
        obj.customer_id ||
        raw
      );
    } catch {}

    try {
      const url = new URL(raw);
      return clean(
        url.searchParams.get("member_code") ||
        url.searchParams.get("customer_key") ||
        url.searchParams.get("line_user_id") ||
        url.searchParams.get("customer_id") ||
        raw
      );
    } catch {}

    if (raw.includes("member_code=") || raw.includes("customer_key=")) {
      const params = new URLSearchParams(raw.split("?").pop());
      return clean(
        params.get("member_code") ||
        params.get("customer_key") ||
        raw
      );
    }

    const phone = normalizePhone(raw);
    return phone.length >= 10 ? phone : raw;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function setStatus(message, tone = "info") {
    const box = $("dpro37Status");
    if (!box) return;
    box.className = "dpro37-status " + tone;
    box.textContent = message;
  }

  async function post(path, body = {}) {
    const response = await fetch(pickupApi() + path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      cache: "no-store",
      body: JSON.stringify({
        shop_code: shopCode(),
        admin_code: adminCode(),
        staff_name: staffName(),
        ...body
      })
    });

    const text = await response.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { ok: false, message: text };
    }

    if (!response.ok || data?.ok === false) {
      const error = new Error(
        data?.error?.message ||
        data?.message ||
        "処理に失敗しました。"
      );
      error.code = data?.error?.code || data?.code || "";
      error.detail = data?.error?.detail || data?.detail;
      throw error;
    }

    return data;
  }

  function parseItems(row) {
    if (Array.isArray(row?.items)) return row.items;
    if (typeof row?.items === "string") {
      try {
        const parsed = JSON.parse(row.items);
        if (Array.isArray(parsed)) return parsed;
      } catch {}
    }
    return [];
  }

  function itemText(row) {
    const items = parseItems(row);
    if (!items.length) return "商品情報なし";
    return items
      .map((item) => {
        const name =
          item.product_name ||
          item.name ||
          item.product_code ||
          "商品";
        const quantity = Number(item.quantity || item.qty || 1);
        return `${name} × ${quantity}`;
      })
      .join("\n");
  }

  function statusTone(status) {
    if (status === "ready") return "ready";
    if (status === "picked_up") return "done";
    if (status === "pending" || status === "preparing") return "wait";
    return "stop";
  }

  function pickupButton(row) {
    const status = clean(row.status);
    const id = escapeHtml(row.id);

    if (status === "ready") {
      return `
        <button
          class="dpro37-complete"
          type="button"
          data-dpro37-complete="${id}">
          商品を確認して受け渡し完了
        </button>
      `;
    }

    if (status === "picked_up") {
      const when =
        row.pickup_verified_at ||
        row.picked_up_at ||
        row.status_updated_at ||
        "";
      return `
        <div class="dpro37-completed">
          ✅ 受け渡し済み
          ${when ? `<span>${escapeHtml(when)}</span>` : ""}
        </div>
      `;
    }

    if (status === "pending" || status === "preparing") {
      return `
        <div class="dpro37-not-ready">
          ⚠️ まだ準備できていません。商品を確認してからお渡しください。
        </div>
      `;
    }

    return `
      <div class="dpro37-not-ready">
        この予約は受け渡し対象外です。
      </div>
    `;
  }

  function renderResult(data) {
    state.lastResult = data;
    const customer = data.customer || {};
    const rows = Array.isArray(data.preorders) ? data.preorders : [];

    $("dpro37Customer").innerHTML = `
      <div class="dpro37-arrival-badge">来店確認済み</div>
      <div class="dpro37-customer-name">
        ${escapeHtml(customer.customer_name || "お客様")} 様
      </div>
      <div class="dpro37-customer-meta">
        会員コード：${escapeHtml(customer.member_code || state.selectedCustomerKey || "-")}
        ／ 本日の予約：${rows.length}件
      </div>
    `;

    if (!rows.length) {
      $("dpro37Preorders").innerHTML = `
        <div class="dpro37-empty">
          本日の取り置き予約は見つかりませんでした。
          日付と会員コードを確認してください。
        </div>
      `;
      setStatus(
        "来店は確認しましたが、本日の取り置き予約はありません。",
        "warn"
      );
      return;
    }

    $("dpro37Preorders").innerHTML = rows.map((row) => `
      <article class="dpro37-order ${statusTone(clean(row.status))}">
        <div class="dpro37-order-head">
          <div>
            <div class="dpro37-time">${escapeHtml(row.pickup_time || "--:--")}</div>
            <div class="dpro37-date">${escapeHtml(row.pickup_date || data.pickup_date || "")}</div>
          </div>
          <span class="dpro37-pill ${statusTone(clean(row.status))}">
            ${escapeHtml(row.status_label || row.status || "受付済み")}
          </span>
        </div>
        <div class="dpro37-items">${escapeHtml(itemText(row))}</div>
        <div class="dpro37-order-meta">
          予約番号：${escapeHtml(String(row.id || "").slice(0, 12))}
          ${row.arrived_at ? ` ／ 来店確認：${escapeHtml(row.arrived_at)}` : ""}
        </div>
        ${pickupButton(row)}
      </article>
    `).join("");

    bindCompleteButtons();

    const ready = Number(data.counts?.ready || 0);
    const waiting =
      Number(data.counts?.pending || 0) +
      Number(data.counts?.preparing || 0);
    const done = Number(data.counts?.picked_up || 0);

    if (ready > 0) {
      setStatus(
        `QRを読み取り、来店確認を記録しました。準備完了 ${ready}件の商品内容を確認してください。`,
        "ok"
      );
    } else if (waiting > 0) {
      setStatus(
        `QRを読み取り、来店確認を記録しました。まだ準備中の予約が ${waiting}件あります。`,
        "warn"
      );
    } else if (done > 0) {
      setStatus(
        "このお客様の本日の予約は、すでに受け渡し済みです。",
        "info"
      );
    }
  }

  async function lookupCustomer(rawValue, method = "qr") {
    if (!adminCode()) {
      setStatus("管理コードを入力してください。DEMOは1234です。", "warn");
      $("adminCodeInput")?.focus();
      return;
    }

    const key = parseQrValue(rawValue);
    if (!key) {
      setStatus("会員コードを読み取るか入力してください。", "warn");
      return;
    }

    state.selectedCustomerKey = key;
    $("dpro37MemberInput").value = key;
    setStatus("本日の取り置き予約を確認しています。", "info");

    try {
      const data = await post("/api/admin/pickup/lookup", {
        customer_key: key,
        pickup_date: todayJst(),
        method
      });
      renderResult(data);
      document
        .getElementById("dpro37PickupPanel")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      $("dpro37Customer").innerHTML = "";
      $("dpro37Preorders").innerHTML = "";
      setStatus(error.message || "会員・予約の確認に失敗しました。", "ng");
    }
  }

  async function completePickup(preorderId) {
    const row = (state.lastResult?.preorders || []).find(
      (item) => String(item.id) === String(preorderId)
    );
    if (!row) return;

    const customer =
      state.lastResult?.customer?.customer_name ||
      state.lastResult?.customer?.member_code ||
      "お客様";

    const ok = confirm(
      `${customer}様の次の商品を確認しましたか？\n\n` +
      `${itemText(row)}\n\n` +
      `受け渡し完了を記録します。`
    );
    if (!ok) return;

    setStatus("受け渡し完了を記録しています。", "info");

    try {
      const data = await post("/api/admin/pickup/complete", {
        preorder_id: preorderId,
        method: "qr",
        confirmed: true
      });

      setStatus(data.message || "受け渡し完了を記録しました。", "ok");
      await lookupCustomer(state.selectedCustomerKey, "qr");

      // 既存スタッフ一覧も再読込して、完了件数へ即時反映します。
      setTimeout(() => {
        const reload = $("reloadButton");
        if (reload && !reload.disabled) reload.click();
      }, 150);
    } catch (error) {
      const tone =
        ["ALREADY_PICKED_UP", "PREORDER_NOT_READY", "PICKUP_CONFLICT"]
          .includes(error.code)
          ? "warn"
          : "ng";
      setStatus(error.message || "受け渡し完了を記録できませんでした。", tone);
      await lookupCustomer(state.selectedCustomerKey, "qr").catch(() => {});
    }
  }

  function bindCompleteButtons() {
    document
      .querySelectorAll("[data-dpro37-complete]")
      .forEach((button) => {
        button.addEventListener("click", () => {
          completePickup(
            button.getAttribute("data-dpro37-complete")
          );
        });
      });
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = [...document.scripts].find(
        (script) => script.src === new URL(src, location.href).href
      );
      if (existing) {
        if (window.jsQR) resolve(window.jsQR);
        else existing.addEventListener("load", () => resolve(window.jsQR), { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.onload = () => resolve(window.jsQR);
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  async function ensureJsQr() {
    if (window.jsQR) return window.jsQR;
    if (state.jsQrLoading) return state.jsQrLoading;

    state.jsQrLoading = (async () => {
      try {
        await loadScript(JSQR_LOCAL);
      } catch {
        await loadScript(JSQR_CDN);
      }
      if (typeof window.jsQR !== "function") {
        throw new Error("QR読取ライブラリを読み込めませんでした。");
      }
      return window.jsQR;
    })();

    return state.jsQrLoading;
  }

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus(
        "このブラウザではカメラを起動できません。会員コードを手入力してください。",
        "warn"
      );
      return;
    }

    try {
      stopCamera(false);
      state.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });

      const video = $("dpro37Video");
      video.srcObject = state.stream;
      await video.play();

      $("dpro37Scanner").classList.add("active");
      setStatus("カメラ起動中です。会員証QRを枠内へかざしてください。", "ok");

      if ("BarcodeDetector" in window) {
        try {
          state.detector = new BarcodeDetector({ formats: ["qr_code"] });
        } catch {
          state.detector = null;
        }
      }

      if (!state.detector) {
        await ensureJsQr();
        state.canvas = document.createElement("canvas");
        state.context = state.canvas.getContext("2d", {
          willReadFrequently: true
        });
      }

      state.scanTimer = setInterval(scanFrame, state.detector ? 500 : 260);
    } catch (error) {
      stopCamera(false);
      setStatus(
        "カメラを起動できませんでした。iPadの設定でカメラ許可を確認するか、会員コードを手入力してください。\n" +
        (error.message || ""),
        "warn"
      );
    }
  }

  async function scanFrame() {
    const video = $("dpro37Video");
    if (!video || video.readyState < 2) return;

    try {
      let raw = "";

      if (state.detector) {
        const codes = await state.detector.detect(video);
        raw = codes?.[0]?.rawValue || "";
      } else if (window.jsQR && state.context) {
        const maxWidth = 720;
        const ratio = Math.min(1, maxWidth / video.videoWidth);
        const width = Math.max(1, Math.round(video.videoWidth * ratio));
        const height = Math.max(1, Math.round(video.videoHeight * ratio));
        state.canvas.width = width;
        state.canvas.height = height;
        state.context.drawImage(video, 0, 0, width, height);
        const image = state.context.getImageData(0, 0, width, height);
        raw = window.jsQR(
          image.data,
          width,
          height,
          { inversionAttempts: "attemptBoth" }
        )?.data || "";
      }

      if (!raw) return;
      stopCamera(false);
      setStatus("QRを読み取りました。来店予約を確認します。", "ok");
      await lookupCustomer(raw, "qr");
    } catch {
      // 一時的なフレーム読取エラーではカメラを止めません。
    }
  }

  function stopCamera(showMessage = true) {
    if (state.scanTimer) {
      clearInterval(state.scanTimer);
      state.scanTimer = null;
    }

    if (state.stream) {
      state.stream.getTracks().forEach((track) => track.stop());
      state.stream = null;
    }

    const video = $("dpro37Video");
    if (video) video.srcObject = null;
    $("dpro37Scanner")?.classList.remove("active");

    if (showMessage) {
      setStatus("カメラを停止しました。", "info");
    }
  }

  function createPanel() {
    if ($("dpro37PickupPanel")) return;

    const panel = document.createElement("section");
    panel.id = "dpro37PickupPanel";
    panel.className = "panel dpro37-panel";
    panel.innerHTML = `
      <style>
        .dpro37-panel{
          border:2px solid #86efac!important;
          background:linear-gradient(135deg,#f0fdf4,#ffffff)!important;
        }
        .dpro37-panel .dpro37-head{
          display:flex;justify-content:space-between;gap:12px;
          align-items:flex-start;flex-wrap:wrap;margin-bottom:14px
        }
        .dpro37-panel h2{font-size:clamp(25px,3vw,36px);margin:0}
        .dpro37-panel .dpro37-lead{
          color:#166534;font-weight:850;font-size:13px;line-height:1.7
        }
        .dpro37-layout{
          display:grid;grid-template-columns:minmax(280px,.8fr) minmax(0,1.2fr);
          gap:14px;align-items:start
        }
        .dpro37-scanner{
          min-height:280px;border-radius:22px;overflow:hidden;
          background:#1c1917;display:grid;place-items:center;
          position:relative;color:#fff7ed;border:1px solid #14532d
        }
        .dpro37-scanner video{
          width:100%;min-height:280px;max-height:420px;
          object-fit:cover;display:none
        }
        .dpro37-scanner.active video{display:block}
        .dpro37-scanner.active .dpro37-placeholder{display:none}
        .dpro37-placeholder{text-align:center;padding:24px;font-weight:950}
        .dpro37-placeholder b{display:block;font-size:54px;line-height:1}
        .dpro37-scan-line{
          position:absolute;left:10%;right:10%;top:50%;
          height:3px;background:#22c55e;
          box-shadow:0 0 20px rgba(34,197,94,.85);display:none
        }
        .dpro37-scanner.active .dpro37-scan-line{display:block}
        .dpro37-form{display:grid;gap:10px}
        .dpro37-form input{
          width:100%;border:1px solid #86efac;border-radius:14px;
          padding:13px 14px;font-size:16px;font-weight:850;background:#fff
        }
        .dpro37-buttons{display:flex;gap:8px;flex-wrap:wrap}
        .dpro37-buttons button{
          width:auto;min-width:130px;border-radius:999px;
          min-height:46px;font-weight:950
        }
        .dpro37-start{background:#16a34a!important;color:#fff}
        .dpro37-stop{background:#fff!important;color:#166534!important;border:1px solid #86efac!important}
        .dpro37-lookup{background:#2563eb!important;color:#fff}
        .dpro37-status{
          margin-top:12px;padding:12px 14px;border-radius:16px;
          font-weight:850;font-size:13px;white-space:pre-wrap
        }
        .dpro37-status.info{background:#eff6ff;color:#1e3a8a;border:1px solid #bfdbfe}
        .dpro37-status.ok{background:#ecfdf5;color:#166534;border:1px solid #86efac}
        .dpro37-status.warn{background:#fffbeb;color:#92400e;border:1px solid #fde68a}
        .dpro37-status.ng{background:#fef2f2;color:#991b1b;border:1px solid #fecaca}
        #dpro37Customer{margin-top:14px}
        .dpro37-arrival-badge{
          display:inline-flex;border-radius:999px;padding:7px 11px;
          background:#16a34a;color:#fff;font-size:12px;font-weight:950
        }
        .dpro37-customer-name{font-size:28px;font-weight:950;margin-top:8px}
        .dpro37-customer-meta{color:#57534e;font-weight:850;font-size:12px}
        #dpro37Preorders{display:grid;gap:10px;margin-top:12px}
        .dpro37-order{
          background:#fff;border-radius:20px;padding:14px;
          border:1px solid #d6d3d1;display:grid;gap:10px
        }
        .dpro37-order.ready{border:2px solid #22c55e;background:#f0fdf4}
        .dpro37-order.wait{border-color:#fbbf24;background:#fffbeb}
        .dpro37-order.done{border-color:#d6d3d1;background:#f5f5f4}
        .dpro37-order.stop{border-color:#fecaca;background:#fef2f2}
        .dpro37-order-head{
          display:flex;justify-content:space-between;gap:10px;align-items:start
        }
        .dpro37-time{font-size:28px;font-weight:950;line-height:1}
        .dpro37-date{font-size:11px;color:#78716c;font-weight:850;margin-top:4px}
        .dpro37-pill{
          border-radius:999px;padding:7px 10px;font-size:12px;font-weight:950
        }
        .dpro37-pill.ready{background:#dcfce7;color:#166534}
        .dpro37-pill.wait{background:#fef3c7;color:#92400e}
        .dpro37-pill.done{background:#e7e5e4;color:#44403c}
        .dpro37-pill.stop{background:#fee2e2;color:#991b1b}
        .dpro37-items{
          white-space:pre-wrap;background:#fff7ed;border-radius:14px;
          padding:12px;font-size:17px;font-weight:950
        }
        .dpro37-order-meta{font-size:11px;color:#78716c;font-weight:800}
        .dpro37-complete{
          width:100%!important;min-height:62px!important;border-radius:18px!important;
          background:#16a34a!important;color:#fff!important;font-size:17px!important
        }
        .dpro37-not-ready{
          padding:12px;border-radius:14px;background:#fffbeb;
          color:#92400e;font-weight:950
        }
        .dpro37-completed{
          padding:12px;border-radius:14px;background:#f5f5f4;
          color:#44403c;font-weight:950
        }
        .dpro37-completed span{display:block;font-size:11px;margin-top:4px}
        .dpro37-empty{
          padding:16px;border:1px dashed #86efac;border-radius:18px;
          background:#fff;color:#166534;font-weight:950
        }
        .dpro37-connection{
          margin-top:10px;padding-top:10px;border-top:1px dashed #86efac
        }
        .dpro37-connection summary{cursor:pointer;font-weight:950;color:#166534}
        @media(max-width:850px){
          .dpro37-layout{grid-template-columns:1fr}
        }
        @media(max-width:640px){
          .dpro37-buttons button{width:100%}
        }
      </style>

      <div class="dpro37-head">
        <div>
          <h2>QR来店・受け渡し確認</h2>
          <div class="dpro37-lead">
            QRを読んだ時点では「来店確認」です。
            商品を確認してから受け渡し完了を押します。
          </div>
        </div>
        <span class="badge green">STEP BAKERY-37</span>
      </div>

      <div class="dpro37-layout">
        <div>
          <div class="dpro37-scanner" id="dpro37Scanner">
            <video id="dpro37Video" playsinline muted></video>
            <div class="dpro37-scan-line"></div>
            <div class="dpro37-placeholder">
              <b>▣</b>
              カメラを起動して<br>お客様の会員証QRを読み取ります
            </div>
          </div>
          <div class="dpro37-buttons" style="margin-top:10px">
            <button class="dpro37-start" id="dpro37StartCamera" type="button">QRカメラ起動</button>
            <button class="dpro37-stop" id="dpro37StopCamera" type="button">カメラ停止</button>
          </div>
        </div>

        <div class="dpro37-form">
          <label for="dpro37StaffNameInput">担当スタッフ名</label>
          <input id="dpro37StaffNameInput" value="スタッフ" autocomplete="name">

          <label for="dpro37MemberInput">会員コード・QR内容</label>
          <input id="dpro37MemberInput" placeholder="例：DEMO-BK-001" autocomplete="off">

          <button class="dpro37-lookup" id="dpro37Lookup" type="button">
            会員と本日の予約を確認
          </button>

          <details class="dpro37-connection">
            <summary>受け渡しAPI設定</summary>
            <label for="dpro37PickupApiInput" style="margin-top:10px">Pickup API URL</label>
            <input
              id="dpro37PickupApiInput"
              value="${escapeHtml(
                new URLSearchParams(location.search).get("pickup_api") ||
                new URLSearchParams(location.search).get("catalog_api") ||
                DEFAULT_PICKUP_API
              )}"
              autocomplete="off">
          </details>
        </div>
      </div>

      <div id="dpro37Status" class="dpro37-status info">
        管理コードを確認し、QRカメラを起動してください。
      </div>
      <div id="dpro37Customer"></div>
      <div id="dpro37Preorders"></div>
    `;

    const summary = $("summarySection");
    if (summary) {
      summary.insertAdjacentElement("afterend", panel);
    } else {
      document.querySelector("main")?.prepend(panel);
    }

    $("dpro37StartCamera")?.addEventListener("click", startCamera);
    $("dpro37StopCamera")?.addEventListener("click", () => stopCamera(true));
    $("dpro37Lookup")?.addEventListener("click", () => {
      lookupCustomer($("dpro37MemberInput")?.value || "", "manual");
    });
    $("dpro37MemberInput")?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        lookupCustomer(event.target.value, "manual");
      }
    });
  }

  function start() {
    createPanel();
    window.addEventListener("pagehide", () => stopCamera(false));
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState !== "visible") stopCamera(false);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
