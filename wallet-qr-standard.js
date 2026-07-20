// =========================================================
// DPRO Bakery STEP BAKERY-37-R1
// 会員証QR標準生成修正
//
// 独自QR生成処理を使用せず、qrcode-generator 1.4.4で生成します。
// DEMO会員・本番会員とも、会員コードを同じ形式でQR化します。
// =========================================================

(() => {
  const MAX_BOOT_RETRY = 40;
  let bootRetry = 0;
  let lastRenderedValue = "";

  function clean(value) {
    return String(value || "").trim();
  }

  function canvasElement() {
    return document.getElementById("qrCanvas");
  }

  function memberCodeFromScreen() {
    return clean(document.getElementById("walletMemberCode")?.textContent);
  }

  function drawFallback(canvas, message) {
    if (!canvas) return;
    const context = canvas.getContext("2d");
    canvas.width = 320;
    canvas.height = 320;
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#991b1b";
    context.font = "bold 16px sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(message || "QR生成エラー", 160, 160);
  }

  function drawStandardQr(value) {
    const text = clean(value);
    const canvas = canvasElement();
    if (!canvas) return false;

    if (!text) {
      drawFallback(canvas, "会員コードなし");
      return false;
    }

    if (typeof window.qrcode !== "function") {
      drawFallback(canvas, "QR準備中");
      return false;
    }

    try {
      const qr = window.qrcode(0, "M");
      qr.addData(text, "Byte");
      qr.make();

      const moduleCount = qr.getModuleCount();
      const quietModules = 4;
      const desiredCssSize = 240;
      const cell = Math.max(
        4,
        Math.floor(desiredCssSize / (moduleCount + quietModules * 2))
      );
      const pixelSize = (moduleCount + quietModules * 2) * cell;

      canvas.width = pixelSize;
      canvas.height = pixelSize;
      canvas.style.width = desiredCssSize + "px";
      canvas.style.height = desiredCssSize + "px";
      canvas.style.imageRendering = "pixelated";

      const context = canvas.getContext("2d", {
        alpha: false
      });
      context.imageSmoothingEnabled = false;
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, pixelSize, pixelSize);
      context.fillStyle = "#000000";

      for (let row = 0; row < moduleCount; row += 1) {
        for (let col = 0; col < moduleCount; col += 1) {
          if (!qr.isDark(row, col)) continue;
          context.fillRect(
            (col + quietModules) * cell,
            (row + quietModules) * cell,
            cell,
            cell
          );
        }
      }

      canvas.dataset.qrValue = text;
      canvas.setAttribute(
        "aria-label",
        `会員コード ${text} のQRコード`
      );
      lastRenderedValue = text;
      return true;
    } catch (error) {
      console.error("BAKERY-37-R1 QR generation:", error);
      drawFallback(canvas, "QR生成エラー");
      return false;
    }
  }

  function installOverride() {
    if (typeof window.qrcode !== "function") return false;

    // wallet.html内の既存renderRealQrを標準方式へ置き換えます。
    window.renderRealQr = drawStandardQr;
    window.renderPseudoQr = drawStandardQr;

    const code = memberCodeFromScreen();
    if (code) drawStandardQr(code);
    return true;
  }

  function refreshFromScreen() {
    const code = memberCodeFromScreen();
    if (!code) return;
    if (
      code !== lastRenderedValue ||
      canvasElement()?.dataset.qrValue !== code
    ) {
      drawStandardQr(code);
    }
  }

  function boot() {
    if (installOverride()) {
      refreshFromScreen();
      return;
    }

    bootRetry += 1;
    if (bootRetry < MAX_BOOT_RETRY) {
      setTimeout(boot, 100);
    } else {
      drawFallback(canvasElement(), "QRライブラリ読込失敗");
    }
  }

  document.addEventListener("click", (event) => {
    if (
      event.target.closest?.(
        "#useDemoMemberButton, #registerButton, #reloadMeButton"
      )
    ) {
      setTimeout(refreshFromScreen, 100);
      setTimeout(refreshFromScreen, 400);
      setTimeout(refreshFromScreen, 900);
    }
  }, true);

  window.addEventListener("pageshow", () => {
    setTimeout(refreshFromScreen, 100);
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
