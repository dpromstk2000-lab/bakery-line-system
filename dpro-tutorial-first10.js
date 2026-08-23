// DPRO TUTORIAL BAKERY R3 First10 V1.0 / UI-only / no automatic business mutation
(() => {
  const TUTORIAL_VERSION = "BAKERY-FIRST10-R3-V1.0-20260822";
  const PATCH_VERSION = "BAKERY-FIRST10-V1.1-DRAG-CARD-20260823";
  const STORAGE_KEY = "DPRO_BAKERY_FIRST10_V1";
  const FIRST10 = [
    {id:"F10-001",chapter:"1/7 最初の入口",title:"オーナー画面が毎日の開始地点",target:"bakery.owner.start",route:"owner",mode:"READ",body:"毎日の開始地点はオーナー画面です。まず「今日の管理を開始」から、その日の状況を確認します。"},
    {id:"F10-002",chapter:"1/7 最初の入口",title:"管理コードを保存して今日の状況を読む",target:"bakery.owner.start_read",route:"owner",mode:"ACTION_USER_ONLY",body:"管理コードを入力して保存すると今日の状況を読み込めます。ガイドはボタンを自動では押しません。必要なときだけ、ご自身で操作してください。"},
    {id:"F10-003",chapter:"2/7 今日やること",title:"未確認・準備中・受け渡し待ちを見る",target:"bakery.owner.todo",route:"owner",mode:"READ",body:"「今日やること」で未確認、準備中、受け渡し待ちをまとめて確認します。0件は正常な状態です。"},
    {id:"F10-004",chapter:"2/7 今日やること",title:"優先タスクと次に押す場所を確認",target:"bakery.owner.todo",route:"owner",mode:"READ",body:"件数だけでなく、優先タスクと次の操作候補を確認すると迷いにくくなります。"},
    {id:"F10-005",chapter:"3/7 今日の取り置き",title:"未完了だけ表示して対応対象を絞る",target:"bakery.owner.preorders",route:"owner",mode:"READ",body:"まず未完了だけを見ると、今対応が必要な取り置きに集中できます。"},
    {id:"F10-006",chapter:"3/7 今日の取り置き",title:"状態の流れを理解する",target:"bakery.owner.preorders",route:"owner",mode:"READ",body:"取り置きは受付済み→準備中→準備完了→受け渡し済みの順で進みます。"},
    {id:"F10-007",chapter:"3/7 今日の取り置き",title:"状態変更は必要な注文だけ自分で押す",target:"bakery.owner.preorders",route:"owner",mode:"ACTION_USER_ONLY",body:"状態変更は実業務です。ガイドは自動変更せず、必要な注文だけ店舗側で押します。"},
    {id:"F10-008",chapter:"4/7 スタッフ/iPadへつなぐ",title:"スタッフ画面の役割を確認",target:"bakery.owner.staff",route:"owner",mode:"READ",body:"現場スタッフには設定を見せず、取り置き対応に絞ったstaff.htmlを使います。"},
    {id:"F10-009",chapter:"4/7 スタッフ/iPadへつなぐ",title:"現場ではstaff.htmlだけで取り置き対応",target:"bakery.staff.start",route:"staff",mode:"READ",body:"スタッフ画面では誰が・何時に・何を受け取るかを確認し、準備と受け渡しに集中します。表示だけを確認し、ガイドは状態変更を行いません。"},
    {id:"F10-010",chapter:"5/7 夕方のECOレスキュー",title:"ECO文面の対象と商品を確認",target:"bakery.owner.eco",route:"owner",mode:"READ",body:"夕方に余りそうなパンがある時は、対象・商品・数量・価格を確認してECO文面を作ります。"},
    {id:"F10-011",chapter:"5/7 夕方のECOレスキュー",title:"文面作成・コピー後の送信は自分で判断",target:"bakery.owner.eco",route:"owner",mode:"ACTION_USER_ONLY",body:"文面の作成やコピーは補助機能です。LINE送信は店舗側が内容を確認して判断します。ガイドは送信しません。"},
    {id:"F10-012",chapter:"6/7 受けすぎ防止と顧客確認",title:"商品ごとの受付ON/OFF・1日上限を確認",target:"bakery.owner.products",route:"owner",mode:"READ",body:"人気パンは受付ON/OFFと1日上限を確認し、受けすぎを防ぎます。保存操作はガイドが自動実行しません。"},
    {id:"F10-013",chapter:"6/7 受けすぎ防止と顧客確認",title:"顧客一覧は確認用途から始める",target:"bakery.owner.customers",route:"owner",mode:"READ",body:"顧客一覧では会員・ECO希望などをまず確認します。実顧客情報を教材として表示・保存することはありません。"},
    {id:"F10-014",chapter:"7/7 困ったとき",title:"操作ガイドを開く",target:"bakery.tutorial.guide_center",route:"tutorial",mode:"READ",body:"詳しい使い方は常設の「操作ガイド」から確認できます。R4 Guide Center公開後は検索・カテゴリ・FAQから探せます。"},
    {id:"F10-015",chapter:"7/7 困ったとき",title:"最初の10分ガイドはいつでも再実行できる",target:"bakery.tutorial.launcher",route:"tutorial",mode:"READ",body:"途中で閉じても続きから再開できます。完了後も「？操作ガイド」からいつでも最初から再実行できます。"}
  ];

  const OWNER_BINDINGS = {
    "bakery.owner.start":"#startSection",
    "bakery.owner.admin_code":"#quickAdminCodeInput",
    "bakery.owner.start_read":"#saveQuickAdminButton",
    "bakery.owner.todo":"#todoSection",
    "bakery.owner.preorders":"#preordersSection",
    "bakery.owner.staff":"#staffSection",
    "bakery.owner.eco":"#ecoSection",
    "bakery.owner.products":"#productsSection",
    "bakery.owner.customers":"#customersSection",
    "bakery.owner.pickup":"#pickupSection",
    "bakery.owner.charge":"#chargeSection",
    "bakery.owner.transactions":"#transactionsSection",
    "bakery.owner.demo":"#demoSection",
    "bakery.owner.connection":"#connectionSection",
    "bakery.owner.logs":"#logsSection"
  };

  let activeIndex = 0;
  let activeTarget = null;
  let lastFocus = null;
  let overlay = null;
  let frameWrap = null;
  let dragState = null;
  let dragResizeBound = false;

  function readState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!parsed || parsed.version !== TUTORIAL_VERSION) throw new Error("reset");
      return parsed;
    } catch {
      return {version:TUTORIAL_VERSION,status:"NOT_STARTED",index:0,updated_at:new Date().toISOString()};
    }
  }

  function writeState(patch) {
    const next = {...readState(),...patch,version:TUTORIAL_VERSION,updated_at:new Date().toISOString()};
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    refreshLauncher();
    return next;
  }

  function bindOwnerTargets() {
    const result = [];
    Object.entries(OWNER_BINDINGS).forEach(([id, selector]) => {
      const el = document.querySelector(selector);
      if (el) el.setAttribute("data-dpro-guide-id", id);
      result.push({target_id:id,selector,found:!!el});
    });
    return result;
  }

  function injectStyles() {
    if (document.getElementById("dproTutorialR3Styles")) return;
    const style = document.createElement("style");
    style.id = "dproTutorialR3Styles";
    style.textContent = `
      [data-dpro-guide-id].dpro-guide-highlight{position:relative!important;z-index:2147482000!important;outline:4px solid #f59e0b!important;outline-offset:4px!important;box-shadow:0 0 0 9999px rgba(28,25,23,.34),0 0 0 9px rgba(245,158,11,.22)!important;border-radius:16px!important;scroll-margin:120px!important}
      #dproTutorialLauncher{position:fixed;right:16px;bottom:16px;z-index:2147483000;display:grid;gap:8px;justify-items:end;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
      #dproTutorialLauncher .dpro-guide-main{border:0;border-radius:999px;padding:12px 16px;background:#292524;color:#fff;font-weight:950;box-shadow:0 14px 38px rgba(0,0,0,.22);cursor:pointer;min-height:46px}
      #dproTutorialLauncher .dpro-guide-sub{display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end}
      #dproTutorialLauncher .dpro-guide-sub a,#dproTutorialLauncher .dpro-guide-sub button{border:1px solid #fdba74;border-radius:999px;padding:9px 12px;background:#fff;color:#9a3412;font-weight:900;text-decoration:none;cursor:pointer;min-height:40px}
      #dproTutorialOverlay{position:fixed;inset:0;z-index:2147482500;pointer-events:none;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
      #dproTutorialOverlay .dpro-tour-card{box-sizing:border-box;position:absolute;left:50%;bottom:18px;transform:translateX(-50%);width:min(720px,calc(100% - 24px));max-height:min(54vh,560px);overflow:auto;pointer-events:auto;background:#fff;border:1px solid #fdba74;border-radius:24px;padding:18px;box-shadow:0 24px 90px rgba(0,0,0,.32);color:#292524}
      #dproTutorialOverlay .dpro-tour-card.dpro-dragging{box-shadow:0 28px 100px rgba(0,0,0,.38)}
      #dproTutorialOverlay .dpro-tour-top{display:grid;grid-template-columns:minmax(0,1fr) auto auto;align-items:start;gap:10px}
      #dproTutorialOverlay .dpro-tour-drag-handle{align-self:start;display:inline-flex;align-items:center;justify-content:center;min-height:36px;padding:7px 10px;border:1px dashed #fb923c;border-radius:999px;background:#fff7ed;color:#9a3412;font-size:12px;font-weight:950;line-height:1;cursor:grab;user-select:none;-webkit-user-select:none;touch-action:none}
      #dproTutorialOverlay .dpro-tour-card.dpro-dragging .dpro-tour-drag-handle{cursor:grabbing;background:#ffedd5}
      #dproTutorialOverlay .dpro-tour-kicker{font-size:11px;font-weight:950;color:#9a3412;letter-spacing:.05em}
      #dproTutorialOverlay .dpro-tour-title{font-size:23px;font-weight:950;line-height:1.25;margin:5px 0 0}
      #dproTutorialOverlay .dpro-tour-close{border:1px solid #e7e5e4;background:#fff;color:#44403c;border-radius:999px;width:42px;height:42px;cursor:pointer;font-size:20px;flex:0 0 auto}
      #dproTutorialOverlay .dpro-tour-body{font-size:14px;line-height:1.75;color:#57534e;font-weight:800;margin:12px 0}
      #dproTutorialOverlay .dpro-tour-note{font-size:12px;line-height:1.6;padding:10px 12px;border-radius:14px;background:#fff7ed;border:1px solid #fed7aa;color:#7c2d12;font-weight:850}
      #dproTutorialOverlay .dpro-tour-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}
      #dproTutorialOverlay .dpro-tour-actions button{border:0;border-radius:999px;padding:10px 14px;font-weight:950;cursor:pointer;min-height:42px}
      #dproTutorialOverlay .dpro-prev{background:#f5f5f4;color:#44403c}.dpro-next{background:#16a34a;color:#fff}.dpro-skip{background:#fff;color:#9a3412;border:1px solid #fdba74!important}
      #dproTutorialOverlay .dpro-progress{height:7px;background:#f5f5f4;border-radius:999px;overflow:hidden;margin:12px 0 2px}#dproTutorialOverlay .dpro-progress>span{display:block;height:100%;background:#ea580c}
      #dproTutorialFrameWrap{position:fixed;inset:10px 10px 235px;z-index:2147482100;background:#fff;border:2px solid #fdba74;border-radius:24px;overflow:hidden;box-shadow:0 24px 90px rgba(0,0,0,.28)}
      #dproTutorialFrameWrap iframe{width:100%;height:100%;border:0;background:#fff}
      #dproTutorialFrameWrap .dpro-frame-label{position:absolute;top:9px;left:9px;z-index:3;background:#292524;color:#fff;padding:7px 10px;border-radius:999px;font-size:11px;font-weight:950;pointer-events:none}
      @media(max-width:560px){#dproTutorialLauncher{right:8px;bottom:8px}#dproTutorialLauncher .dpro-guide-sub{display:none}#dproTutorialOverlay .dpro-tour-card{bottom:8px;width:calc(100% - 16px);max-height:58vh;padding:15px;border-radius:20px}#dproTutorialOverlay .dpro-tour-top{grid-template-columns:minmax(0,1fr) auto}#dproTutorialOverlay .dpro-tour-drag-handle{grid-column:1/-1;grid-row:1;justify-self:end;margin-bottom:2px}#dproTutorialOverlay .dpro-tour-top>div:first-child{grid-column:1;grid-row:2}#dproTutorialOverlay .dpro-tour-close{grid-column:2;grid-row:2}#dproTutorialOverlay .dpro-tour-title{font-size:19px}#dproTutorialFrameWrap{inset:6px 6px 310px;border-radius:18px}#dproTutorialOverlay .dpro-tour-actions button{flex:1 1 44%}}
    `;
    document.head.appendChild(style);
  }

  function makeLauncher() {
    if (document.getElementById("dproTutorialLauncher")) return;
    const launcher = document.createElement("div");
    launcher.id = "dproTutorialLauncher";
    launcher.setAttribute("data-dpro-guide-id","bakery.tutorial.launcher");
    launcher.innerHTML = `
      <div class="dpro-guide-sub">
        <a href="./guide.html" data-dpro-guide-id="bakery.tutorial.guide_center">操作ガイド</a>
        <button type="button" id="dproTutorialReplay">最初から</button>
      </div>
      <button type="button" class="dpro-guide-main" id="dproTutorialStart">？ 操作ガイド</button>
    `;
    document.body.appendChild(launcher);
    launcher.querySelector("#dproTutorialStart").addEventListener("click", () => start(false));
    launcher.querySelector("#dproTutorialReplay").addEventListener("click", () => start(true));
    refreshLauncher();
  }

  function refreshLauncher() {
    const button = document.getElementById("dproTutorialStart");
    if (!button) return;
    const state = readState();
    if (state.status === "NOT_STARTED") button.textContent = "はじめての方：最初の10分";
    else if (state.status === "IN_PROGRESS") button.textContent = `10分ガイドを再開 ${Math.min((state.index||0)+1,15)}/15`;
    else if (state.status === "COMPLETED") button.textContent = "？ 操作ガイド（完了済み）";
    else button.textContent = "？ 操作ガイド（再実行可）";
  }

  function clearHighlight() {
    if (activeTarget) activeTarget.classList?.remove("dpro-guide-highlight");
    activeTarget = null;
    if (frameWrap) { frameWrap.remove(); frameWrap = null; }
  }

  function ensureDetailsOpen(el) {
    if (!el) return;
    if (el.tagName === "DETAILS") el.open = true;
    const details = el.closest?.("details");
    if (details) details.open = true;
  }

  function highlightOwner(targetId) {
    clearHighlight();
    const el = document.querySelector(`[data-dpro-guide-id="${CSS.escape(targetId)}"]`);
    if (!el) return {found:false,fallback:true};
    ensureDetailsOpen(el);
    activeTarget = el;
    el.classList.add("dpro-guide-highlight");
    el.scrollIntoView({behavior:"smooth",block:"center",inline:"nearest"});
    return {found:true,fallback:false};
  }

  function staffUrl() {
    const url = new URL("./staff.html", location.href);
    const params = new URLSearchParams(location.search);
    ["shop_code","api"].forEach((key) => { if (params.get(key)) url.searchParams.set(key, params.get(key)); });
    url.searchParams.set("tutorial_view","1");
    return url.toString();
  }

  function highlightStaff(targetId) {
    clearHighlight();
    frameWrap = document.createElement("div");
    frameWrap.id = "dproTutorialFrameWrap";
    frameWrap.innerHTML = `<div class="dpro-frame-label">スタッフ実画面（ガイド表示のみ）</div><iframe title="スタッフ画面の操作ガイド"></iframe>`;
    document.body.appendChild(frameWrap);
    const iframe = frameWrap.querySelector("iframe");
    iframe.addEventListener("load", () => {
      try {
        const doc = iframe.contentDocument;
        const el = doc?.querySelector("#startSection");
        if (el) {
          el.setAttribute("data-dpro-guide-id","bakery.staff.start");
          const style = doc.createElement("style");
          style.textContent = `[data-dpro-guide-id="bakery.staff.start"]{outline:4px solid #f59e0b!important;outline-offset:4px!important;box-shadow:0 0 0 8px rgba(245,158,11,.22)!important;border-radius:16px!important;scroll-margin:90px!important}`;
          doc.head.appendChild(style);
          el.scrollIntoView({block:"center"});
        }
      } catch (error) {
        console.warn("DPRO tutorial staff target fallback", error);
      }
    });
    iframe.src = staffUrl();
    return {found:true,fallback:false,iframe:true};
  }

  function clampDragPosition(card, left, top) {
    const margin = window.innerWidth <= 560 ? 8 : 10;
    const rect = card.getBoundingClientRect();
    const maxLeft = Math.max(margin, window.innerWidth - rect.width - margin);
    const maxTop = Math.max(margin, window.innerHeight - rect.height - margin);
    return {
      left:Math.min(Math.max(left, margin), maxLeft),
      top:Math.min(Math.max(top, margin), maxTop)
    };
  }

  function placeDraggedCard(card, left, top) {
    const next = clampDragPosition(card, left, top);
    card.style.left = `${Math.round(next.left)}px`;
    card.style.top = `${Math.round(next.top)}px`;
    card.style.right = "auto";
    card.style.bottom = "auto";
    card.style.transform = "none";
    card.dataset.dproDragged = "1";
    return next;
  }

  function clampCurrentCard() {
    const card = overlay?.querySelector(".dpro-tour-card");
    if (!card || card.dataset.dproDragged !== "1") return;
    const rect = card.getBoundingClientRect();
    placeDraggedCard(card, rect.left, rect.top);
  }

  function installCardDrag() {
    const card = overlay?.querySelector(".dpro-tour-card");
    const handle = overlay?.querySelector(".dpro-tour-drag-handle");
    if (!card || !handle || handle.dataset.dproDragReady === "1") return;
    handle.dataset.dproDragReady = "1";

    handle.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      const rect = card.getBoundingClientRect();
      const start = placeDraggedCard(card, rect.left, rect.top);
      dragState = {
        pointerId:event.pointerId,
        offsetX:event.clientX - start.left,
        offsetY:event.clientY - start.top
      };
      card.classList.add("dpro-dragging");
      try { handle.setPointerCapture(event.pointerId); } catch {}
      event.preventDefault();
    });

    handle.addEventListener("pointermove", (event) => {
      if (!dragState || dragState.pointerId !== event.pointerId) return;
      placeDraggedCard(card, event.clientX - dragState.offsetX, event.clientY - dragState.offsetY);
      event.preventDefault();
    });

    const finishDrag = (event) => {
      if (!dragState || dragState.pointerId !== event.pointerId) return;
      try { if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId); } catch {}
      dragState = null;
      card.classList.remove("dpro-dragging");
      clampCurrentCard();
      event.preventDefault();
    };
    handle.addEventListener("pointerup", finishDrag);
    handle.addEventListener("pointercancel", finishDrag);

    if (!dragResizeBound) {
      dragResizeBound = true;
      window.addEventListener("resize", () => requestAnimationFrame(clampCurrentCard), {passive:true});
    }
  }

  function renderCard(index) {
    if (!overlay) return;
    activeIndex = Math.max(0, Math.min(FIRST10.length - 1, index));
    const card = FIRST10[activeIndex];
    let targetResult = {found:true,fallback:false};
    if (card.route === "owner") targetResult = highlightOwner(card.target);
    else if (card.route === "staff") targetResult = highlightStaff(card.target);
    else {
      clearHighlight();
      const el = document.querySelector(`[data-dpro-guide-id="${CSS.escape(card.target)}"]`);
      if (el) { activeTarget = el; el.classList.add("dpro-guide-highlight"); }
      else targetResult = {found:false,fallback:true};
    }

    const percent = Math.round(((activeIndex + 1) / FIRST10.length) * 100);
    const modeText = card.mode === "ACTION_USER_ONLY"
      ? "このカードは操作箇所を示すだけです。保存・更新・送信・決済・状態変更を自動実行しません。"
      : "見る場所を案内するカードです。業務データは変更しません。";
    const fallbackText = targetResult.fallback ? "対象箇所が見つからないため安全なフォールバック表示です。画面操作は自動実行しません。" : modeText;
    overlay.querySelector(".dpro-tour-kicker").textContent = `${card.chapter} / ${card.id} / ${activeIndex + 1} of ${FIRST10.length}`;
    overlay.querySelector(".dpro-tour-title").textContent = card.title;
    overlay.querySelector(".dpro-tour-body").textContent = card.body;
    overlay.querySelector(".dpro-tour-note").textContent = fallbackText;
    overlay.querySelector(".dpro-progress>span").style.width = `${percent}%`;
    const prev = overlay.querySelector(".dpro-prev");
    const next = overlay.querySelector(".dpro-next");
    prev.disabled = activeIndex === 0;
    next.textContent = activeIndex === FIRST10.length - 1 ? "完了" : "次へ";
    writeState({status:"IN_PROGRESS",index:activeIndex});
    requestAnimationFrame(clampCurrentCard);
    queueMicrotask(() => next.focus({preventScroll:true}));
  }

  function close({skip=false,complete=false}={}) {
    clearHighlight();
    dragState = null;
    overlay?.remove();
    overlay = null;
    if (complete) writeState({status:"COMPLETED",index:FIRST10.length - 1,completed_at:new Date().toISOString()});
    else if (skip) writeState({status:"SKIPPED",index:activeIndex});
    else writeState({status:"IN_PROGRESS",index:activeIndex});
    if (lastFocus?.focus) lastFocus.focus({preventScroll:true});
  }

  function focusables(root) {
    return [...root.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')]
      .filter((el) => !el.hidden && getComputedStyle(el).visibility !== "hidden");
  }

  function keyHandler(event) {
    if (!overlay) return;
    if (event.key === "Escape") { event.preventDefault(); close(); return; }
    if (event.key !== "Tab") return;
    const list = focusables(overlay);
    if (!list.length) return;
    const first = list[0], last = list[list.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  function start(replay=false) {
    lastFocus = document.activeElement;
    if (replay) writeState({status:"NOT_STARTED",index:0,completed_at:null});
    if (overlay) overlay.remove();
    overlay = document.createElement("div");
    overlay.id = "dproTutorialOverlay";
    overlay.innerHTML = `
      <div class="dpro-tour-card" role="dialog" aria-modal="true" aria-label="DPROベーカリー 最初の10分ガイド">
        <div class="dpro-tour-top"><div><div class="dpro-tour-kicker"></div><div class="dpro-tour-title"></div></div><div class="dpro-tour-drag-handle" title="ドラッグして移動">↕ 移動</div><button type="button" class="dpro-tour-close" aria-label="ガイドを閉じる">×</button></div>
        <div class="dpro-progress" aria-hidden="true"><span></span></div>
        <div class="dpro-tour-body"></div>
        <div class="dpro-tour-note"></div>
        <div class="dpro-tour-actions"><button type="button" class="dpro-prev">戻る</button><button type="button" class="dpro-next">次へ</button><button type="button" class="dpro-skip">スキップ</button></div>
      </div>`;
    document.body.appendChild(overlay);
    installCardDrag();
    overlay.querySelector(".dpro-tour-close").addEventListener("click", () => close());
    overlay.querySelector(".dpro-prev").addEventListener("click", () => renderCard(activeIndex - 1));
    overlay.querySelector(".dpro-next").addEventListener("click", () => {
      if (activeIndex >= FIRST10.length - 1) close({complete:true});
      else renderCard(activeIndex + 1);
    });
    overlay.querySelector(".dpro-skip").addEventListener("click", () => close({skip:true}));
    const state = readState();
    renderCard(replay ? 0 : Math.max(0, Math.min(FIRST10.length - 1, Number(state.index) || 0)));
  }

  function auditBindings() {
    const owner = bindOwnerTargets();
    const first10Targets = [...new Set(FIRST10.map((c) => c.target))];
    const virtual = new Set(["bakery.staff.start","bakery.tutorial.guide_center","bakery.tutorial.launcher"]);
    const rows = first10Targets.map((id) => {
      if (virtual.has(id)) return {target_id:id,found:true,binding:id === "bakery.staff.start" ? "same-origin staff iframe" : "tutorial runtime UI"};
      return {target_id:id,found:!!document.querySelector(`[data-dpro-guide-id="${CSS.escape(id)}"]`),binding:"owner DOM"};
    });
    return {
      version:TUTORIAL_VERSION,
      chapter_count:7,
      card_count:FIRST10.length,
      unique_target_count:first10Targets.length,
      missing_first10_targets:rows.filter((r)=>!r.found),
      owner_bindings:owner,
      mutation_shield:true,
      rows
    };
  }

  function initTutorial() {
    injectStyles();
    bindOwnerTargets();
    makeLauncher();
    document.addEventListener("keydown", keyHandler, true);
    window.DPROBakeryTutorial = Object.freeze({
      version:TUTORIAL_VERSION,
      patchVersion:PATCH_VERSION,
      cards:FIRST10.map((item)=>({...item})),
      start:()=>start(false),
      replay:()=>start(true),
      getState:()=>({...readState()}),
      auditBindings
    });
    const mode = new URLSearchParams(location.search).get("tutorial");
    if (mode === "1" || mode === "resume") setTimeout(() => start(false), 50);
    if (mode === "replay") setTimeout(() => start(true), 50);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initTutorial, {once:true});
  else initTutorial();
})();
