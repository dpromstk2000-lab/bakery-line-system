// DPRO Bakery STEP BAKERY-32
// catalog.html から wallet.html へ商品を引き継ぐ小さな橋渡しスクリプト。
// wallet.html の </body> 直前に次の1行を追加してください。
// <script src="./wallet-catalog-bridge.js?v=32"></script>

(() => {
  const params = new URLSearchParams(location.search);
  const shopCode = params.get("shop_code") || "bakery_demo";
  const storageKey = "dpro_bakery_catalog_selected_" + shopCode;
  let targetCode = params.get("product_code") || "";
  let targetName = params.get("product_name") || "";
  let applied = false;

  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
    if (!targetCode && saved?.product_code) targetCode = String(saved.product_code);
    if (!targetName && saved?.product_name) targetName = String(saved.product_name);
  } catch {}

  if (!targetCode || params.get("from") !== "catalog") return;

  function cssEscape(value) {
    if (window.CSS?.escape) return CSS.escape(value);
    return String(value).replace(/["\\]/g, "\\$&");
  }

  function setMessage(text) {
    const box = document.getElementById("preorderStatus");
    if (box) {
      box.textContent = text;
      box.className = "status-box ok";
    }
  }

  function tryApply() {
    if (applied) return true;
    const selector = `[data-qty-plus="${cssEscape(targetCode)}"]`;
    const button = document.querySelector(selector);
    if (!button || button.disabled) return false;

    button.click();
    applied = true;
    localStorage.removeItem(storageKey);
    setMessage(`カタログで選んだ「${targetName || targetCode}」を1個追加しました。受け取り日と時間を確認してください。`);
    const panel = document.getElementById("preorderPanel") || button.closest("section");
    panel?.scrollIntoView({ behavior: "smooth", block: "start" });
    return true;
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (tryApply()) return;
    const observer = new MutationObserver(() => {
      if (tryApply()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    let count = 0;
    const timer = setInterval(() => {
      count++;
      if (tryApply() || count > 40) {
        clearInterval(timer);
        observer.disconnect();
      }
    }, 500);
  });
})();
