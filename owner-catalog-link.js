// DPRO Bakery STEP BAKERY-32
// owner.html にカタログ管理・公開URLを表示する補助スクリプト。
// owner.html の </body> 直前に次の1行を追加してください。
// <script src="./owner-catalog-link.js?v=32"></script>

(() => {
  function init() {
    if (document.getElementById("dproBakeryCatalogLinks")) return;

    const params = new URLSearchParams(location.search);
    const shopCode = params.get("shop_code") || "bakery_demo";
    const reservationApi = params.get("api") || "https://dpro-bakery-wallet-api.dpromstk2000.workers.dev";
    const catalogApi = params.get("catalog_api") || "https://dpro-bakery-catalog-api.dpromstk2000.workers.dev";

    const adminUrl = new URL("./catalog-admin.html", location.href);
    adminUrl.searchParams.set("shop_code", shopCode);
    adminUrl.searchParams.set("catalog_api", catalogApi);

    const publicUrl = new URL("./catalog.html", location.href);
    publicUrl.searchParams.set("shop_code", shopCode);
    publicUrl.searchParams.set("catalog_api", catalogApi);
    publicUrl.searchParams.set("api", reservationApi);

    const section = document.createElement("section");
    section.id = "dproBakeryCatalogLinks";
    section.innerHTML = `
      <style>
        #dproBakeryCatalogLinks{background:linear-gradient(135deg,#fff,#fff4e3);border:1px solid #fed7aa;border-radius:24px;padding:20px;margin:16px 0;box-shadow:0 16px 44px rgba(120,53,15,.09)}
        #dproBakeryCatalogLinks .dpro32-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap}
        #dproBakeryCatalogLinks h2{font-size:24px;margin:0 0 5px;color:#292524}
        #dproBakeryCatalogLinks p{margin:0;color:#78716c;font-size:14px;font-weight:800}
        #dproBakeryCatalogLinks .dpro32-actions{display:flex;gap:9px;flex-wrap:wrap;margin-top:14px}
        #dproBakeryCatalogLinks a,#dproBakeryCatalogLinks button{border:0;border-radius:999px;padding:11px 15px;font-size:14px;font-weight:950;text-decoration:none;cursor:pointer;display:inline-flex;align-items:center;justify-content:center}
        #dproBakeryCatalogLinks .dpro32-main{background:#9a4e16;color:#fff}
        #dproBakeryCatalogLinks .dpro32-green{background:#16704b;color:#fff}
        #dproBakeryCatalogLinks .dpro32-ghost{background:#fff;color:#8b4513;border:1px solid #fdba74}
        #dproBakeryCatalogLinks .dpro32-url{margin-top:12px;padding:10px 12px;border-radius:13px;background:#fff;border:1px solid #fed7aa;color:#57534e;font-size:11px;word-break:break-all}
      </style>
      <div class="dpro32-head">
        <div>
          <h2>写真付き商品カタログ</h2>
          <p>パンの写真・価格・説明・売り切れ・取り置き可否を管理します。</p>
        </div>
        <span style="background:#ffedd5;color:#9a3412;border-radius:999px;padding:6px 10px;font-size:12px;font-weight:950">STEP BAKERY-32</span>
      </div>
      <div class="dpro32-actions">
        <a class="dpro32-main" href="${adminUrl}" target="_blank" rel="noopener">商品・写真を管理</a>
        <a class="dpro32-green" href="${publicUrl}" target="_blank" rel="noopener">公開カタログを開く</a>
        <button class="dpro32-ghost" type="button" id="dpro32CopyCatalog">カタログURLをコピー</button>
      </div>
      <div class="dpro32-url">${publicUrl}</div>
    `;

    const hero = document.querySelector(".hero");
    if (hero) hero.insertAdjacentElement("afterend", section);
    else document.body.prepend(section);

    section.querySelector("#dpro32CopyCatalog")?.addEventListener("click", async (event) => {
      try {
        await navigator.clipboard.writeText(publicUrl.toString());
        event.currentTarget.textContent = "コピーしました";
        setTimeout(() => event.currentTarget.textContent = "カタログURLをコピー", 1600);
      } catch {
        prompt("このURLをコピーしてください。", publicUrl.toString());
      }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
