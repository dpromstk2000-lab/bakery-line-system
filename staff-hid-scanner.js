// =========================================================
// DPRO Bakery STEP BAKERY-38
// Bluetooth / USB HID QRリーダー 自動待受モード
//
// 対応:
// ・Bluetooth HIDキーボードモード
// ・USB-C / Lightning接続のキーボード入力型リーダー
// ・末尾 Enter / Tab
//
// 動作:
// QR読取 → 高速入力判定 → 自動検索 → 次の読取を自動待受
//
// カメラ読取・手入力・既存受け渡し処理には触れません。
// =========================================================

(() => {
  const MIN_SCAN_LENGTH = 4;
  const MAX_KEY_INTERVAL_MS = 95;
  const BUFFER_TIMEOUT_MS = 180;
  const DUPLICATE_COOLDOWN_MS = 2500;

  const state = {
    enabled: true,
    buffer: "",
    startedAt: 0,
    lastKeyAt: 0,
    resetTimer: null,
    lastValue: "",
    lastValueAt: 0,
    processing: false,
    audioContext: null
  };

  const clean = (value) => String(value || "").trim();
  const $ = (id) => document.getElementById(id);

  function isEditableTarget(target) {
    if (!target) return false;
    if (target.id === "dpro38ReaderToggle") return false;
    if (target.id === "dpro37MemberInput") return false;

    const tag = String(target.tagName || "").toLowerCase();
    return (
      tag === "input" ||
      tag === "textarea" ||
      tag === "select" ||
      target.isContentEditable === true
    );
  }

  function setReaderStatus(message, tone = "ready") {
    const status = $("dpro38ReaderStatus");
    if (!status) return;
    status.textContent = message;
    status.className = "dpro38-reader-status " + tone;

    const badge = $("dpro38ReaderBadge");
    if (badge) {
      badge.textContent =
        tone === "off" ? "待受OFF" :
        tone === "reading" ? "読取中" :
        tone === "processing" ? "照合中" :
        tone === "ok" ? "読取成功" :
        tone === "warn" ? "確認" :
        "待受中";

      badge.className = "dpro38-reader-badge " + tone;
    }
  }

  function clearBuffer() {
    state.buffer = "";
    state.startedAt = 0;
    state.lastKeyAt = 0;
    if (state.resetTimer) {
      clearTimeout(state.resetTimer);
      state.resetTimer = null;
    }
  }

  function scheduleBufferReset() {
    if (state.resetTimer) clearTimeout(state.resetTimer);
    state.resetTimer = setTimeout(() => {
      clearBuffer();
      if (state.enabled && !state.processing) {
        setReaderStatus(
          "Bluetooth／USBリーダーのQR入力を待っています。入力欄のタップは不要です。",
          "ready"
        );
      }
    }, BUFFER_TIMEOUT_MS);
  }

  function averageInterval() {
    if (state.buffer.length <= 1) return 0;
    return (
      (state.lastKeyAt - state.startedAt) /
      Math.max(1, state.buffer.length - 1)
    );
  }

  function likelyHardwareScan() {
    if (state.buffer.length < MIN_SCAN_LENGTH) return false;
    return averageInterval() <= MAX_KEY_INTERVAL_MS;
  }

  function beep(kind = "ok") {
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
        kind === "ok" ? 880 :
        kind === "warn" ? 520 :
        280;

      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.12,
        context.currentTime + 0.01
      );
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        context.currentTime + 0.11
      );

      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.12);
    } catch {}
  }

  function feedback(kind = "ok") {
    beep(kind);
    try {
      if (navigator.vibrate) {
        navigator.vibrate(
          kind === "ok" ? 45 :
          kind === "warn" ? [35, 45, 35] :
          [60, 50, 60]
        );
      }
    } catch {}
  }

  function normalizeScanValue(value) {
    const raw = clean(value)
      .replace(/[\r\n\t]+/g, "")
      .replace(/^[\u0000-\u001f]+|[\u0000-\u001f]+$/g, "");

    if (!raw) return "";

    try {
      const parsed = JSON.parse(raw);
      return clean(
        parsed.member_code ||
        parsed.customer_key ||
        parsed.line_user_id ||
        parsed.customer_id ||
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

    return raw;
  }

  function isDuplicate(value) {
    return (
      value === state.lastValue &&
      Date.now() - state.lastValueAt < DUPLICATE_COOLDOWN_MS
    );
  }

  function finishProcessingLater(value) {
    const status = $("dpro37Status");
    let checks = 0;

    const timer = setInterval(() => {
      checks += 1;
      const text = clean(status?.textContent);
      const waiting =
        text.includes("確認しています") ||
        text.includes("読み取りました") ||
        text.includes("処理");

      if (!waiting || checks >= 40) {
        clearInterval(timer);
        state.processing = false;

        const success =
          text.includes("来店確認") ||
          text.includes("準備完了") ||
          text.includes("受け渡し済み") ||
          text.includes("予約はありません");

        feedback(success ? "ok" : "warn");

        setReaderStatus(
          success
            ? `「${value}」を読み取りました。次のお客様を待っています。`
            : `「${value}」を読み取りました。画面の案内を確認してください。次の読取も可能です。`,
          success ? "ok" : "warn"
        );

        const input = $("dpro37MemberInput");
        if (input) {
          input.value = "";
          input.blur();
        }

        setTimeout(() => {
          if (state.enabled && !state.processing) {
            setReaderStatus(
              "Bluetooth／USBリーダーのQR入力を待っています。入力欄のタップは不要です。",
              "ready"
            );
          }
        }, 1800);
      }
    }, 150);
  }

  function submitScan(rawValue) {
    const value = normalizeScanValue(rawValue);
    clearBuffer();

    if (!state.enabled || state.processing) return;
    if (!value || value.length < MIN_SCAN_LENGTH) {
      setReaderStatus(
        "読み取り内容が短すぎます。もう一度QRを読んでください。",
        "warn"
      );
      feedback("warn");
      return;
    }

    if (isDuplicate(value)) {
      setReaderStatus(
        "同じQRの連続読取を防止しました。少し待ってから再度読んでください。",
        "warn"
      );
      feedback("warn");
      return;
    }

    state.processing = true;
    state.lastValue = value;
    state.lastValueAt = Date.now();

    const input = $("dpro37MemberInput");
    const button = $("dpro37Lookup");

    if (!input || !button) {
      state.processing = false;
      setReaderStatus(
        "QR受け渡し画面の準備が完了していません。ページを再読み込みしてください。",
        "warn"
      );
      feedback("warn");
      return;
    }

    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.blur();

    setReaderStatus(
      `「${value}」を読み取りました。本日の予約を照合しています。`,
      "processing"
    );
    feedback("ok");
    button.click();
    finishProcessingLater(value);
  }

  function handleGlobalKeydown(event) {
    if (!state.enabled) return;
    if (event.isComposing || event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    if (isEditableTarget(event.target)) return;

    const key = event.key;

    if (key === "Enter" || key === "Tab") {
      if (state.buffer) {
        event.preventDefault();
        if (likelyHardwareScan()) {
          submitScan(state.buffer);
        } else {
          const value = state.buffer;
          clearBuffer();
          setReaderStatus(
            `「${value}」は通常入力と判断しました。リーダーをHIDモード・末尾Enterに設定してください。`,
            "warn"
          );
        }
      }
      return;
    }

    if (key === "Escape") {
      clearBuffer();
      setReaderStatus(
        "読取途中の入力を消しました。次のQRを待っています。",
        "ready"
      );
      return;
    }

    if (key === "Backspace") {
      if (state.buffer) {
        state.buffer = state.buffer.slice(0, -1);
        state.lastKeyAt = performance.now();
        scheduleBufferReset();
      }
      return;
    }

    if (key.length !== 1) return;

    const now = performance.now();

    if (!state.buffer) {
      state.startedAt = now;
      state.lastKeyAt = now;
    } else {
      const interval = now - state.lastKeyAt;
      if (interval > BUFFER_TIMEOUT_MS) {
        clearBuffer();
        state.startedAt = now;
      }
      state.lastKeyAt = now;
    }

    state.buffer += key;
    setReaderStatus(
      "リーダー入力を受信しています…",
      "reading"
    );
    scheduleBufferReset();
  }

  function handleMemberInputKeydown(event) {
    if (event.key !== "Enter" && event.key !== "Tab") return;

    const input = event.currentTarget;
    const value = clean(input.value);
    if (!value) return;

    event.preventDefault();
    submitScan(value);
  }

  function toggleReader(enabled) {
    state.enabled = enabled;
    clearBuffer();

    try {
      localStorage.setItem(
        "dpro_bakery_hid_reader_enabled",
        enabled ? "1" : "0"
      );
    } catch {}

    if (enabled) {
      setReaderStatus(
        "Bluetooth／USBリーダーのQR入力を待っています。入力欄のタップは不要です。",
        "ready"
      );
    } else {
      setReaderStatus(
        "リーダー自動待受を停止しました。カメラまたは手入力は引き続き使えます。",
        "off"
      );
    }
  }

  function createReaderPanel() {
    if ($("dpro38ReaderPanel")) return;

    const pickupPanel = $("dpro37PickupPanel");
    if (!pickupPanel) return;

    const panel = document.createElement("div");
    panel.id = "dpro38ReaderPanel";
    panel.className = "dpro38-reader-panel";
    panel.innerHTML = `
      <style>
        .dpro38-reader-panel{
          display:grid;
          grid-template-columns:minmax(0,1fr) auto;
          gap:12px;
          align-items:center;
          margin:0 0 14px;
          padding:14px 16px;
          border-radius:18px;
          background:linear-gradient(135deg,#eff6ff,#ffffff);
          border:1px solid #93c5fd;
          box-shadow:0 10px 28px rgba(37,99,235,.07)
        }
        .dpro38-reader-title{
          display:flex;align-items:center;gap:9px;
          font-size:16px;font-weight:950;color:#1e3a8a
        }
        .dpro38-reader-badge{
          display:inline-flex;border-radius:999px;
          padding:6px 9px;font-size:11px;font-weight:950
        }
        .dpro38-reader-badge.ready,
        .dpro38-reader-badge.ok{background:#dcfce7;color:#166534}
        .dpro38-reader-badge.reading,
        .dpro38-reader-badge.processing{background:#dbeafe;color:#1d4ed8}
        .dpro38-reader-badge.warn{background:#fef3c7;color:#92400e}
        .dpro38-reader-badge.off{background:#e7e5e4;color:#57534e}
        .dpro38-reader-status{
          margin-top:4px;font-size:12px;line-height:1.55;
          font-weight:850;color:#475569
        }
        .dpro38-reader-status.ok{color:#166534}
        .dpro38-reader-status.warn{color:#92400e}
        .dpro38-reader-status.off{color:#57534e}
        .dpro38-reader-switch{
          display:flex;align-items:center;gap:8px;
          white-space:nowrap;font-size:13px;font-weight:950;color:#1e3a8a
        }
        .dpro38-reader-switch input{
          width:24px!important;height:24px!important;margin:0
        }
        @media(max-width:640px){
          .dpro38-reader-panel{grid-template-columns:1fr}
        }
      </style>

      <div>
        <div class="dpro38-reader-title">
          Bluetooth／USBリーダー
          <span id="dpro38ReaderBadge" class="dpro38-reader-badge ready">
            待受中
          </span>
        </div>
        <div id="dpro38ReaderStatus" class="dpro38-reader-status ready">
          Bluetooth／USBリーダーのQR入力を待っています。入力欄のタップは不要です。
        </div>
      </div>

      <label class="dpro38-reader-switch">
        <input id="dpro38ReaderToggle" type="checkbox" checked>
        自動待受ON
      </label>
    `;

    const head = pickupPanel.querySelector(".dpro37-head");
    if (head) {
      head.insertAdjacentElement("afterend", panel);
    } else {
      pickupPanel.prepend(panel);
    }

    const toggle = $("dpro38ReaderToggle");
    let saved = "1";
    try {
      saved =
        localStorage.getItem("dpro_bakery_hid_reader_enabled") || "1";
    } catch {}

    state.enabled = saved !== "0";
    toggle.checked = state.enabled;
    toggle.addEventListener("change", () => {
      toggleReader(toggle.checked);
    });

    toggleReader(state.enabled);
  }

  function boot() {
    createReaderPanel();

    const input = $("dpro37MemberInput");
    if (input) {
      input.setAttribute(
        "placeholder",
        "QRリーダーは自動待受／手入力も可"
      );
      input.addEventListener(
        "keydown",
        handleMemberInputKeydown,
        true
      );
    }

    document.addEventListener(
      "keydown",
      handleGlobalKeydown,
      true
    );

    window.addEventListener("pageshow", () => {
      clearBuffer();
      if (state.enabled && !state.processing) {
        setReaderStatus(
          "Bluetooth／USBリーダーのQR入力を待っています。入力欄のタップは不要です。",
          "ready"
        );
      }
    });

    document.addEventListener("visibilitychange", () => {
      clearBuffer();
      if (
        document.visibilityState === "visible" &&
        state.enabled &&
        !state.processing
      ) {
        setReaderStatus(
          "Bluetooth／USBリーダーのQR入力を待っています。入力欄のタップは不要です。",
          "ready"
        );
      }
    });
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
