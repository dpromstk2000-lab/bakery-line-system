// =========================================================
// DPRO Bakery STEP BAKERY-40
// 店舗画面 30秒自動更新・複数端末競合対策
//
// ・30秒ごとの自動更新
// ・画面復帰 / オンライン復帰時の即時更新
// ・新規注文・他端末変更の表示と通知
// ・ステータス変更前の再読込と競合検出
// ・QR処理 / カメラ / 入力中は自動更新を一時停止
// ・最終更新時刻 / 次回更新までの秒数
// =========================================================

(() => {
  const AUTO_REFRESH_MS = 30000;
  const BUSY_RETRY_MS = 5000;
  const ACTION_GUARD_MS = 12000;
  const VERSION = "BAKERY-40-LIVE-SYNC-20260720";

  const state = {
    enabled: true,
    running: false,
    initialized: false,
    timer: null,
    nextAt: 0,
    lastUpdatedAt: 0,
    lastSnapshot: "",
    actionBusyUntil: 0,
    offline: !navigator.onLine,
    audioContext: null
  };

  const byId = (id) => document.getElementById(id);
  const clean = (value) => String(value || "").trim();

  function rows() {
    try {
      return (
        typeof currentRows !== "undefined" &&
        Array.isArray(currentRows)
      ) ? currentRows : [];
    } catch {
      return [];
    }
  }

  function selectedDate() {
    try {
      return typeof targetDate === "function"
        ? targetDate()
        : clean(byId("targetDateInput")?.value);
    } catch {
      return clean(byId("targetDateInput")?.value);
    }
  }

  function hasAdminCode() {
    return !!clean(byId("adminCodeInput")?.value);
  }

  function stableItems(raw) {
    if (Array.isArray(raw)) return raw;
    if (typeof raw === "string") {
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch {}
    }
    return [];
  }

  function snapshotRows(list = rows()) {
    return JSON.stringify(
      [...list]
        .map((row) => ({
          id: String(row.id || ""),
          status: clean(row.status),
          pickup_date: clean(row.pickup_date),
          pickup_time: clean(row.pickup_time),
          customer_name: clean(
            row.customer_name || row.member_code
          ),
          total_amount: Number(row.total_amount || 0),
          arrived_at: clean(row.arrived_at),
          pickup_verified_at: clean(row.pickup_verified_at),
          status_updated_at: clean(
            row.status_updated_at || row.updated_at
          ),
          items: stableItems(row.items).map((item) => ({
            code: clean(
              item.product_code || item.code || item.id
            ),
            name: clean(
              item.product_name || item.name
            ),
            quantity: Number(
              item.quantity || item.qty || 1
            )
          }))
        }))
        .sort((a, b) => a.id.localeCompare(b.id))
    );
  }

  function jstTime(timestamp = Date.now()) {
    return new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    }).format(new Date(timestamp));
  }

  function cameraIsActive() {
    return [...document.querySelectorAll("video")].some((video) => {
      const stream = video.srcObject;
      return !!stream?.getTracks?.().some(
        (track) => track.readyState === "live"
      );
    });
  }

  function qrIsBusy() {
    const text = clean(byId("dpro37Status")?.textContent);
    const badge = byId("dpro38ReaderBadge");
    return (
      text.includes("確認しています") ||
      text.includes("処理中") ||
      text.includes("受け渡し完了を記録") ||
      badge?.classList.contains("processing")
    );
  }

  function activeInput() {
    const element = document.activeElement;
    if (!element) return false;
    const tag = String(element.tagName || "").toLowerCase();
    return (
      tag === "input" ||
      tag === "textarea" ||
      tag === "select" ||
      element.isContentEditable === true
    );
  }

  function existingLoading() {
    try {
      return typeof isLoading !== "undefined" && isLoading;
    } catch {
      return false;
    }
  }

  function busyReason() {
    if (!state.enabled) return "自動更新OFF";
    if (state.offline) return "オフライン";
    if (document.visibilityState !== "visible") return "画面が非表示";
    if (state.running || existingLoading()) return "読み込み中";
    if (Date.now() < state.actionBusyUntil) return "店頭操作中";
    if (cameraIsActive()) return "QRカメラ使用中";
    if (qrIsBusy()) return "QR照合中";
    if (activeInput()) return "入力中";
    return "";
  }

  function setBadge(text, tone = "ready") {
    const badge = byId("dpro40Badge");
    if (!badge) return;
    badge.textContent = text;
    badge.className = "dpro40-badge " + tone;
  }

  function setStatus(message, tone = "ready") {
    const box = byId("dpro40Status");
    if (!box) return;
    box.textContent = message;
    box.className = "dpro40-status " + tone;
  }

  function beep(kind = "change") {
    try {
      const AudioContext =
        window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      if (!state.audioContext) {
        state.audioContext = new AudioContext();
      }

      const context = state.audioContext;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value =
        kind === "conflict" ? 360 : 760;

      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.10,
        context.currentTime + 0.01
      );
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        context.currentTime + 0.13
      );

      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.14);
    } catch {}
  }

  function notifyChange(message) {
    beep("change");
    try {
      navigator.vibrate?.([45, 35, 45]);
    } catch {}

    const panel = byId("dpro40Panel");
    panel?.classList.add("changed");
    setTimeout(() => panel?.classList.remove("changed"), 1800);
    setBadge("変更あり", "change");
    setStatus(message, "change");
  }

  function scheduleNext(delay = AUTO_REFRESH_MS) {
    state.nextAt = Date.now() + delay;
  }

  function afterLocalAction(delay = 900) {
    state.actionBusyUntil = Date.now() + ACTION_GUARD_MS;
    setTimeout(() => {
      state.lastSnapshot = snapshotRows();
      state.lastUpdatedAt = Date.now();
      state.actionBusyUntil = 0;
      scheduleNext();
      updateClock();
    }, delay);
  }

  async function callExistingLoad() {
    if (typeof loadPreorders !== "function") {
      throw new Error("既存の取置き読込機能が見つかりません。");
    }
    await loadPreorders(selectedDate());
  }

  async function syncNow(
    reason = "自動更新",
    options = {}
  ) {
    if (!state.enabled && !options.force) return false;
    if (!hasAdminCode()) {
      setBadge("管理コード待ち", "pause");
      setStatus(
        "管理コードを入力すると自動更新を開始します。",
        "pause"
      );
      scheduleNext(BUSY_RETRY_MS);
      return false;
    }

    const reasonBusy = busyReason();
    if (reasonBusy && !options.force) {
      setBadge("一時停止", "pause");
      setStatus(
        `${reasonBusy}のため自動更新を一時停止しています。`,
        "pause"
      );
      scheduleNext(BUSY_RETRY_MS);
      return false;
    }

    const before = state.lastSnapshot || snapshotRows();
    state.running = true;
    setBadge("更新中", "sync");
    setStatus(`${reason}：最新の取り置きを確認しています。`, "sync");

    try {
      await callExistingLoad();
      const after = snapshotRows();
      const changed =
        state.initialized &&
        before &&
        after !== before;

      state.lastSnapshot = after;
      state.lastUpdatedAt = Date.now();
      state.initialized = true;
      scheduleNext();

      if (changed && !options.silent) {
        notifyChange(
          "新しい予約、または他端末での変更を反映しました。商品・状態を確認してください。"
        );
      } else {
        setBadge("同期済み", "ready");
        setStatus(
          `${jstTime(state.lastUpdatedAt)} に最新状態を確認しました。`,
          "ready"
        );
      }
      return true;
    } catch (error) {
      setBadge("更新失敗", "error");
      setStatus(
        error?.message ||
        "自動更新に失敗しました。通信状態を確認してください。",
        "error"
      );
      scheduleNext(BUSY_RETRY_MS);
      return false;
    } finally {
      state.running = false;
      updateClock();
    }
  }

  async function preflightStatusChange(
    preorderId,
    nextStatus
  ) {
    const beforeRow = rows().find(
      (row) => String(row.id) === String(preorderId)
    );

    if (!beforeRow) {
      setBadge("競合検出", "error");
      setStatus(
        "対象予約が画面上にありません。再読み込みしました。",
        "error"
      );
      await syncNow("競合確認", { force: true, silent: true });
      return;
    }

    const expectedStatus = clean(beforeRow.status);
    state.actionBusyUntil = Date.now() + ACTION_GUARD_MS;
    setBadge("事前確認", "sync");
    setStatus(
      "他端末で状態が変わっていないか確認しています。",
      "sync"
    );

    try {
      await callExistingLoad();
      const latest = rows().find(
        (row) => String(row.id) === String(preorderId)
      );
      const latestStatus = clean(latest?.status);

      if (!latest || latestStatus !== expectedStatus) {
        beep("conflict");
        try {
          navigator.vibrate?.([70, 45, 70]);
        } catch {}

        setBadge("競合検出", "error");
        setStatus(
          latest
            ? `他端末で「${expectedStatus}」から「${latestStatus}」へ変更済みです。最新画面を確認してください。`
            : "他端末で予約が変更または削除されています。最新画面を確認してください。",
          "error"
        );

        const start = byId("startStatus");
        if (start) {
          start.className = "status-box warn";
          start.textContent =
            "他端末で状態が変更されていたため、今回の操作は実行しませんでした。";
        }
        state.lastSnapshot = snapshotRows();
        state.lastUpdatedAt = Date.now();
        return;
      }

      if (typeof changeStatus !== "function") {
        throw new Error("ステータス変更機能が見つかりません。");
      }

      await changeStatus(preorderId, nextStatus);
      afterLocalAction(200);
      setBadge("反映済み", "ready");
      setStatus(
        `${jstTime()} に変更を反映しました。次の自動更新を待っています。`,
        "ready"
      );
    } catch (error) {
      setBadge("操作失敗", "error");
      setStatus(
        error?.message || "状態変更前の確認に失敗しました。",
        "error"
      );
    } finally {
      state.actionBusyUntil = 0;
      state.lastSnapshot = snapshotRows();
      state.lastUpdatedAt = Date.now();
      scheduleNext();
      updateClock();
    }
  }

  function captureStatusButtons(event) {
    const button = event.target.closest?.(
      "[data-status-id][data-status-next]"
    );
    if (!button) return;
    if (button.closest("#dpro37PickupPanel")) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    const preorderId = button.getAttribute("data-status-id");
    const nextStatus = button.getAttribute("data-status-next");
    preflightStatusChange(preorderId, nextStatus);
  }

  function trackQrPickupActions(event) {
    const button = event.target.closest?.(
      "[data-dpro37-complete]"
    );
    if (!button) return;
    state.actionBusyUntil = Date.now() + ACTION_GUARD_MS;
    setTimeout(() => afterLocalAction(0), 1800);
  }

  function updateClock() {
    const last = byId("dpro40Last");
    const next = byId("dpro40Next");
    if (last) {
      last.textContent = state.lastUpdatedAt
        ? jstTime(state.lastUpdatedAt)
        : "未更新";
    }

    if (!next) return;
    if (!state.enabled) {
      next.textContent = "停止中";
      return;
    }

    const reason = busyReason();
    if (reason) {
      next.textContent = reason;
      return;
    }

    const seconds = Math.max(
      0,
      Math.ceil((state.nextAt - Date.now()) / 1000)
    );
    next.textContent = `${seconds}秒後`;
  }

  function tick() {
    updateClock();
    if (
      state.enabled &&
      !state.running &&
      state.nextAt &&
      Date.now() >= state.nextAt
    ) {
      syncNow("30秒自動更新");
    }
  }

  function toggleEnabled(enabled) {
    state.enabled = enabled;
    try {
      localStorage.setItem(
        "dpro_bakery_live_sync_enabled",
        enabled ? "1" : "0"
      );
    } catch {}

    if (enabled) {
      scheduleNext(1500);
      setBadge("待機中", "ready");
      setStatus(
        "30秒ごとに自動更新します。処理中・カメラ使用中・入力中は安全のため一時停止します。",
        "ready"
      );
    } else {
      setBadge("自動更新OFF", "pause");
      setStatus(
        "自動更新を停止しました。手動の再読込は引き続き使えます。",
        "pause"
      );
    }
    updateClock();
  }

  function injectPanel() {
    if (byId("dpro40Panel")) return;
    const summary = byId("summarySection");
    if (!summary) return;

    const panel = document.createElement("div");
    panel.id = "dpro40Panel";
    panel.className = "dpro40-panel";
    panel.innerHTML = `
      <style>
        .dpro40-panel{
          display:grid;grid-template-columns:minmax(0,1fr) auto;
          gap:12px;align-items:center;margin:0 0 14px;
          padding:14px 16px;border:1px solid #bbf7d0;
          border-radius:18px;background:linear-gradient(135deg,#f0fdf4,#fff);
          transition:.25s box-shadow,.25s transform
        }
        .dpro40-panel.changed{
          box-shadow:0 0 0 5px rgba(37,99,235,.18);
          transform:translateY(-1px)
        }
        .dpro40-title{
          display:flex;align-items:center;gap:9px;
          font-size:16px;font-weight:950;color:#166534
        }
        .dpro40-badge{
          display:inline-flex;border-radius:999px;padding:5px 9px;
          font-size:11px;font-weight:950;background:#dcfce7;color:#166534
        }
        .dpro40-badge.sync{background:#dbeafe;color:#1d4ed8}
        .dpro40-badge.change{background:#dbeafe;color:#1d4ed8}
        .dpro40-badge.pause{background:#fef3c7;color:#92400e}
        .dpro40-badge.error{background:#fee2e2;color:#991b1b}
        .dpro40-status{
          margin-top:4px;font-size:12px;font-weight:850;
          line-height:1.55;color:#475569
        }
        .dpro40-status.change{color:#1d4ed8}
        .dpro40-status.pause{color:#92400e}
        .dpro40-status.error{color:#991b1b}
        .dpro40-meta{
          display:flex;gap:12px;flex-wrap:wrap;margin-top:6px;
          font-size:11px;color:#64748b;font-weight:900
        }
        .dpro40-actions{
          display:flex;align-items:center;gap:8px;flex-wrap:wrap;
          justify-content:flex-end
        }
        .dpro40-toggle{
          display:flex;align-items:center;gap:7px;
          white-space:nowrap;font-size:12px;font-weight:950;color:#166534
        }
        .dpro40-toggle input{
          width:23px!important;height:23px!important;margin:0
        }
        .dpro40-manual{
          min-height:40px!important;padding:9px 13px!important;
          box-shadow:none!important
        }
        @media(max-width:720px){
          .dpro40-panel{grid-template-columns:1fr}
          .dpro40-actions{justify-content:flex-start}
        }
      </style>

      <div>
        <div class="dpro40-title">
          複数端末・自動更新
          <span id="dpro40Badge" class="dpro40-badge">待機中</span>
        </div>
        <div id="dpro40Status" class="dpro40-status">
          30秒ごとに最新状態を確認します。
        </div>
        <div class="dpro40-meta">
          <span>最終更新：<b id="dpro40Last">未更新</b></span>
          <span>次回：<b id="dpro40Next">準備中</b></span>
          <span>バージョン：${VERSION}</span>
        </div>
      </div>

      <div class="dpro40-actions">
        <button
          id="dpro40Manual"
          class="ghost dpro40-manual"
          type="button">今すぐ同期</button>
        <label class="dpro40-toggle">
          <input id="dpro40Toggle" type="checkbox" checked>
          自動更新ON
        </label>
      </div>
    `;

    const head = summary.querySelector(".panel-head");
    if (head) {
      head.insertAdjacentElement("afterend", panel);
    } else {
      summary.prepend(panel);
    }

    let saved = "1";
    try {
      saved =
        localStorage.getItem(
          "dpro_bakery_live_sync_enabled"
        ) || "1";
    } catch {}

    state.enabled = saved !== "0";
    byId("dpro40Toggle").checked = state.enabled;

    byId("dpro40Toggle").addEventListener("change", (event) => {
      toggleEnabled(event.currentTarget.checked);
    });

    byId("dpro40Manual").addEventListener("click", () => {
      syncNow("手動同期", { force: true });
    });

    toggleEnabled(state.enabled);
  }

  function bindEvents() {
    document.addEventListener(
      "click",
      captureStatusButtons,
      true
    );
    document.addEventListener(
      "click",
      trackQrPickupActions,
      false
    );

    document.addEventListener("visibilitychange", () => {
      if (
        document.visibilityState === "visible" &&
        state.enabled
      ) {
        scheduleNext(400);
      }
    });

    window.addEventListener("focus", () => {
      if (state.enabled) scheduleNext(500);
    });

    window.addEventListener("online", () => {
      state.offline = false;
      setBadge("オンライン", "ready");
      setStatus(
        "通信が復帰しました。最新状態を確認します。",
        "ready"
      );
      scheduleNext(300);
    });

    window.addEventListener("offline", () => {
      state.offline = true;
      setBadge("オフライン", "error");
      setStatus(
        "通信が切れています。復帰後に自動で再確認します。",
        "error"
      );
    });

    [
      "targetDateInput",
      "shopCodeInput",
      "apiBaseInput",
      "adminCodeInput"
    ].forEach((id) => {
      byId(id)?.addEventListener("change", () => {
        state.initialized = false;
        state.lastSnapshot = "";
        scheduleNext(500);
      });
    });
  }

  function boot() {
    injectPanel();
    bindEvents();

    state.lastSnapshot = snapshotRows();
    state.initialized = rows().length > 0;
    state.lastUpdatedAt = state.initialized
      ? Date.now()
      : 0;
    scheduleNext(state.initialized ? AUTO_REFRESH_MS : 1500);

    state.timer = setInterval(tick, 1000);
    updateClock();

    window.DPRO_BAKERY_LIVE_SYNC = {
      version: VERSION,
      syncNow,
      snapshotRows,
      get lastUpdatedAt() {
        return state.lastUpdatedAt;
      }
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      () => setTimeout(boot, 0),
      { once: true }
    );
  } else {
    setTimeout(boot, 0);
  }
})();
