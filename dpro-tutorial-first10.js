// DPRO TUTORIAL BAKERY R3 / STANDARD V1.1 / exactly-10 / UI-only / business mutation 0
(() => {
  "use strict";

  const TUTORIAL_VERSION = "BAKERY-FIRST10-R3-V1.1-20260828";
  const STORAGE_KEY = "DPRO_BAKERY_FIRST10_V1";

  const FIRST10 = Object.freeze([
    Object.freeze({id:"F10-001",chapter:"1/6 Start",title:"オーナー画面が毎日の開始地点",target:"bakery.owner.start",route:"owner",mode:"READ",body:"毎日の開始地点はオーナー画面です。「今日の管理を開始」から、その日の状況を確認します。"}),
    Object.freeze({id:"F10-002",chapter:"1/6 Start",title:"管理コードを保存して今日の状況を読む",target:"bakery.owner.start_read",route:"owner",mode:"ACTION_USER_ONLY",body:"DEMOでは管理コード1234を使えます。保存・読込は利用者自身が実行します。ガイドはボタンを自動で押しません。"}),
    Object.freeze({id:"F10-003",chapter:"2/6 Today",title:"今日やることを確認",target:"bakery.owner.todo",route:"owner",mode:"READ",body:"未確認・準備中・受け渡し待ち・今日の合計・ECO確認目安と、優先タスクを確認します。0件は正常な状態です。"}),
    Object.freeze({id:"F10-004",chapter:"3/6 Preorders",title:"未完了の取り置きに絞って流れを理解",target:"bakery.owner.preorders",route:"owner",mode:"READ",body:"未完了だけに絞ると対応対象が分かりやすくなります。状態は「受付済み→準備中→準備完了→受け渡し済み」の順で進みます。"}),
    Object.freeze({id:"F10-005",chapter:"3/6 Preorders",title:"状態変更は必要な注文だけ自分で行う",target:"bakery.owner.preorders",route:"owner",mode:"ACTION_USER_ONLY",body:"状態変更は実業務です。必要な注文だけ店舗側で操作してください。ガイドは状態変更を自動実行しません。"}),
    Object.freeze({id:"F10-006",chapter:"4/6 Staff",title:"スタッフ画面の役割を確認",target:"bakery.owner.staff",route:"owner",mode:"READ",body:"現場スタッフには設定を見せず、取り置き対応に絞ったstaff.htmlを使います。オーナー画面と役割を分けます。"}),
    Object.freeze({id:"F10-007",chapter:"4/6 Staff",title:"staff.htmlで準備と受け渡しを確認",target:"bakery.staff.start",route:"staff",mode:"READ",body:"スタッフ画面では、誰が・何時に・何を受け取るかを確認し、準備と受け渡しに集中します。このガイド表示中は状態変更を自動実行しません。"}),
    Object.freeze({id:"F10-008",chapter:"5/6 ECO",title:"ECOレスキュー文面を確認",target:"bakery.owner.eco",route:"owner",mode:"READ",body:"対象・商品・数量・価格・テンプレートを確認してECOレスキュー文面を準備します。作成・コピー・送信は必要に応じて利用者自身が判断します。"}),
    Object.freeze({id:"F10-009",chapter:"5/6 Limits",title:"商品の受付ON/OFF・1日上限と顧客確認",target:"bakery.owner.products",route:"owner",mode:"READ",body:"人気パンの受けすぎ防止として、受付ON/OFFと1日上限を確認します。顧客一覧は確認用途から始め、保存操作はガイドが自動実行しません。"}),
    Object.freeze({id:"F10-010",chapter:"6/6 Help",title:"操作ガイド・再開・再実行",target:"bakery.tutorial.guide_center",route:"tutorial",mode:"READ",body:"分からない操作は「操作ガイド」で検索できます。途中で閉じても再開でき、完了後も「最初から」で何度でも再実行できます。"})
  ]);

  // R4 Guide Center consumes the very same canonical data/order.
  window.DPRO_TUTORIAL_BAKERY_FIRST10 = FIRST10;
  window.DPRO_TUTORIAL_BAKERY_FIRST10_VERSION = TUTORIAL_VERSION;

  // On guide.html we expose the canonical data only; the Guide Center owns its UI.
  if (document.body?.dataset?.dproGuideCenter === "1" || /(?:^|\/)guide\.html$/i.test(location.pathname)) {
    return;
  }

  const OWNER_BINDINGS = Object.freeze({
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
  });

  let overlay = null;
  let activeIndex = 0;
  let activeTarget = null;
  let frameWrap = null;
  let dragState = null;
  let lastFocus = null;
  let resizeBound = false;

  function safeParse(raw) {
    try { return JSON.parse(raw); } catch { return null; }
  }

  function defaultState() {
    return {version:TUTORIAL_VERSION,status:"NOT_STARTED",index:0,updated_at:new Date().toISOString()};
  }

  function readState() {
    try {
      const parsed = safeParse(localStorage.getItem(STORAGE_KEY) || "");
      if (!parsed || parsed.version !== TUTORIAL_VERSION) return defaultState();
      const index = Number.isInteger(parsed.index) ? Math.max(0, Math.min(FIRST10.length - 1, parsed.index)) : 0;
      return {...defaultState(), ...parsed, index};
    } catch {
      return defaultState();
    }
  }

  function writeState(patch) {
    const next = {...readState(), ...patch, version:TUTORIAL_VERSION, updated_at:new Date().toISOString()};
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
    refreshLauncher();
    return next;
  }

  function bindOwnerTargets() {
    Object.entries(OWNER_BINDINGS).forEach(([id, selector]) => {
      const el = document.querySelector(selector);
      if (el) el.setAttribute("data-dpro-guide-id", id);
    });
  }

  function injectStyles() {
    if (document.getElementById("dproTutorialR3Styles")) return;
    const style = document.createElement("style");
    style.id = "dproTutorialR3Styles";
    style.textContent = `
      [data-dpro-guide-id].dpro-guide-highlight{
        position:relative!important;z-index:2147482000!important;
        outline:4px solid #f59e0b!important;outline-offset:4px!important;
        box-shadow:0 0 0 9999px rgba(28,25,23,.34),0 0 0 9px rgba(245,158,11,.22)!important;
        border-radius:16px!important;scroll-margin:120px!important
      }
      #dproTutorialLauncher{
        position:fixed;right:16px;bottom:16px;z-index:2147483000;
        display:grid;gap:8px;justify-items:end;
        font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",sans-serif
      }
      #dproTutorialLauncher .dpro-guide-main,
      #dproTutorialLauncher .dpro-guide-sub a,
      #dproTutorialLauncher .dpro-guide-sub button{
        font:inherit;cursor:pointer;min-height:42px
      }
      #dproTutorialLauncher .dpro-guide-main{
        border:0;border-radius:999px;padding:12px 16px;background:#292524;color:#fff;
        font-weight:950;box-shadow:0 14px 38px rgba(0,0,0,.22)
      }
      #dproTutorialLauncher .dpro-guide-sub{display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end}
      #dproTutorialLauncher .dpro-guide-sub a,
      #dproTutorialLauncher .dpro-guide-sub button{
        border:1px solid #fdba74;border-radius:999px;padding:9px 12px;background:#fff;color:#9a3412;
        font-weight:900;text-decoration:none
      }
      #dproTutorialLauncher :focus-visible,
      #dproTutorialOverlay :focus-visible{
        outline:3px solid #2563eb!important;outline-offset:3px!important
      }
      #dproTutorialOverlay{
        position:fixed;inset:0;z-index:2147482500;pointer-events:none;
        font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",sans-serif
      }
      #dproTutorialOverlay .dpro-tour-card{
        box-sizing:border-box;position:absolute;left:50%;bottom:18px;transform:translateX(-50%);
        width:min(720px,calc(100% - 24px));max-height:min(58vh,590px);overflow:auto;pointer-events:auto;
        background:#fff;border:1px solid #fdba74;border-radius:24px;padding:18px;
        box-shadow:0 24px 90px rgba(0,0,0,.32);color:#292524;overscroll-behavior:contain
      }
      #dproTutorialOverlay .dpro-tour-card.dpro-dragging{box-shadow:0 28px 100px rgba(0,0,0,.38)}
      #dproTutorialOverlay .dpro-tour-top{
        display:grid;grid-template-columns:minmax(0,1fr) auto auto;align-items:start;gap:10px
      }
      #dproTutorialOverlay .dpro-tour-drag-handle{
        align-self:start;display:inline-flex;align-items:center;justify-content:center;min-height:36px;
        padding:7px 10px;border:1px dashed #fb923c;border-radius:999px;background:#fff7ed;color:#9a3412;
        font-size:12px;font-weight:950;line-height:1;cursor:grab;user-select:none;-webkit-user-select:none;touch-action:none
      }
      #dproTutorialOverlay .dpro-tour-card.dpro-dragging .dpro-tour-drag-handle{cursor:grabbing;background:#ffedd5}
      #dproTutorialOverlay .dpro-tour-kicker{font-size:11px;font-weight:950;color:#9a3412;letter-spacing:.05em}
      #dproTutorialOverlay .dpro-tour-title{font-size:23px;font-weight:950;line-height:1.25;margin:5px 0 0}
      #dproTutorialOverlay .dpro-tour-close{
        border:1px solid #e7e5e4;background:#fff;color:#44403c;border-radius:999px;width:42px;height:42px;
        cursor:pointer;font-size:20px;flex:0 0 auto
      }
      #dproTutorialOverlay .dpro-tour-body{font-size:14px;line-height:1.75;color:#57534e;font-weight:800;margin:12px 0}
      #dproTutorialOverlay .dpro-tour-note{
        font-size:12px;line-height:1.6;padding:10px 12px;border-radius:14px;background:#fff7ed;
        border:1px solid #fed7aa;color:#7c2d12;font-weight:850
      }
      #dproTutorialOverlay .dpro-tour-fallback{
        margin-top:8px;padding:9px 11px;border-radius:12px;background:#fffbeb;border:1px solid #fde68a;
        color:#92400e;font-size:11px;font-weight:850
      }
      #dproTutorialOverlay .dpro-tour-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}
      #dproTutorialOverlay .dpro-tour-actions button{
        border:0;border-radius:999px;padding:10px 14px;font-weight:950;cursor:pointer;min-height:42px
      }
      #dproTutorialOverlay .dpro-prev{background:#f5f5f4;color:#44403c}
      #dproTutorialOverlay .dpro-next{background:#16a34a;color:#fff}
      #dproTutorialOverlay .dpro-skip{background:#fff;color:#9a3412;border:1px solid #fdba74!important}
      #dproTutorialOverlay .dpro-progress{
        height:7px;background:#f5f5f4;border-radius:999px;overflow:hidden;margin:12px 0 2px
      }
      #dproTutorialOverlay .dpro-progress>span{display:block;height:100%;background:#ea580c}
      #dproTutorialFrameWrap{
        position:fixed;inset:10px 10px 245px;z-index:2147482100;background:#fff;border:2px solid #fdba74;
        border-radius:24px;overflow:hidden;box-shadow:0 24px 90px rgba(0,0,0,.28)
      }
      #dproTutorialFrameWrap iframe{width:100%;height:100%;border:0;background:#fff}
      #dproTutorialFrameWrap .dpro-frame-label{
        position:absolute;top:9px;left:9px;z-index:3;background:#292524;color:#fff;padding:7px 10px;
        border-radius:999px;font-size:11px;font-weight:950;pointer-events:none
      }
      @media(max-width:560px){
        #dproTutorialLauncher{right:8px;bottom:8px}
        #dproTutorialLauncher .dpro-guide-sub{display:none}
        #dproTutorialOverlay .dpro-tour-card{
          bottom:8px;width:calc(100% - 16px);max-height:60vh;padding:15px;border-radius:20px
        }
        #dproTutorialOverlay .dpro-tour-top{grid-template-columns:minmax(0,1fr) auto}
        #dproTutorialOverlay .dpro-tour-drag-handle{
          grid-column:1/-1;grid-row:1;justify-self:end;margin-bottom:2px
        }
        #dproTutorialOverlay .dpro-tour-top>div:first-child{grid-column:1;grid-row:2}
        #dproTutorialOverlay .dpro-tour-close{grid-column:2;grid-row:2}
        #dproTutorialOverlay .dpro-tour-title{font-size:19px}
        #dproTutorialFrameWrap{inset:6px 6px 318px;border-radius:18px}
        #dproTutorialOverlay .dpro-tour-actions button{flex:1 1 44%}
      }
      @media(max-width:340px){
        #dproTutorialOverlay .dpro-tour-card{width:calc(100% - 10px);padding:12px}
        #dproTutorialOverlay .dpro-tour-actions{gap:6px}
        #dproTutorialOverlay .dpro-tour-actions button{padding:9px 10px;font-size:12px}
        #dproTutorialFrameWrap{inset:4px 4px 320px}
      }
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
      <button type="button" class="dpro-guide-main" id="dproTutorialStart">はじめての方：最初の10分</button>
    `;
    document.body.appendChild(launcher);
    launcher.querySelector("#dproTutorialStart")?.addEventListener("click", () => start(false));
    launcher.querySelector("#dproTutorialReplay")?.addEventListener("click", () => start(true));
    refreshLauncher();
  }

  function refreshLauncher() {
    const button = document.getElementById("dproTutorialStart");
    if (!button) return;
    const state = readState();
    if (state.status === "NOT_STARTED") button.textContent = "はじめての方：最初の10分";
    else if (state.status === "IN_PROGRESS") button.textContent = `10分ガイドを再開 ${Math.min((state.index || 0) + 1, FIRST10.length)}/${FIRST10.length}`;
    else if (state.status === "COMPLETED") button.textContent = "？ 操作ガイド（完了済み）";
    else if (state.status === "SKIPPED") button.textContent = "？ 操作ガイド（スキップ済み・再開可）";
    else button.textContent = "？ 操作ガイド";
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

  function highlightStaff() {
    clearHighlight();
    frameWrap = document.createElement("div");
    frameWrap.id = "dproTutorialFrameWrap";
    frameWrap.innerHTML = `<div class="dpro-frame-label">スタッフ実画面（確認用・自動更新のみ）</div><iframe title="スタッフ画面の操作ガイド"></iframe>`;
    document.body.appendChild(frameWrap);
    const iframe = frameWrap.querySelector("iframe");
    iframe.addEventListener("load", () => {
      try {
        const doc = iframe.contentDocument;
        const el = doc?.querySelector("#startSection");
        if (!el) return;
        el.setAttribute("data-dpro-guide-id","bakery.staff.start");
        const style = doc.createElement("style");
        style.textContent = `[data-dpro-guide-id="bakery.staff.start"]{outline:4px solid #f59e0b!important;outline-offset:4px!important;box-shadow:0 0 0 8px rgba(245,158,11,.22)!important;border-radius:16px!important;scroll-margin:90px!important}`;
        doc.head.appendChild(style);
        el.scrollIntoView({block:"center"});
      } catch (error) {
        console.warn("DPRO tutorial: staff target fallback", error);
      }
    }, {once:true});
    iframe.src = staffUrl();
    return {found:true,fallback:false,iframe:true};
  }

  function highlightTutorial(targetId) {
    clearHighlight();
    const el = document.querySelector(`[data-dpro-guide-id="${CSS.escape(targetId)}"]`);
    if (!el) return {found:false,fallback:true};
    activeTarget = el;
    el.classList.add("dpro-guide-highlight");
    el.scrollIntoView({block:"nearest"});
    return {found:true,fallback:false};
  }

  function clampDragPosition(card, left, top) {
    const margin = window.innerWidth <= 560 ? 8 : 10;
    const rect = card.getBoundingClientRect();
    const maxLeft = Math.max(margin, window.innerWidth - rect.width - margin);
    const maxTop = Math.max(margin, window.innerHeight - rect.height - margin);
    return {
      left: Math.min(Math.max(left, margin), maxLeft),
      top: Math.min(Math.max(top, margin), maxTop)
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
      dragState = {pointerId:event.pointerId,offsetX:event.clientX-start.left,offsetY:event.clientY-start.top};
      card.classList.add("dpro-dragging");
      try { handle.setPointerCapture(event.pointerId); } catch {}
      event.preventDefault();
    });

    handle.addEventListener("pointermove", (event) => {
      if (!dragState || dragState.pointerId !== event.pointerId) return;
      placeDraggedCard(card,event.clientX-dragState.offsetX,event.clientY-dragState.offsetY);
      event.preventDefault();
    });

    const finish = (event) => {
      if (!dragState || dragState.pointerId !== event.pointerId) return;
      try { if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId); } catch {}
      dragState = null;
      card.classList.remove("dpro-dragging");
      clampCurrentCard();
      event.preventDefault();
    };
    handle.addEventListener("pointerup", finish);
    handle.addEventListener("pointercancel", finish);

    // Keyboard move keeps the card recoverable without a pointer.
    handle.addEventListener("keydown", (event) => {
      const delta = event.shiftKey ? 40 : 12;
      const directions = {
        ArrowLeft:[-delta,0], ArrowRight:[delta,0], ArrowUp:[0,-delta], ArrowDown:[0,delta]
      };
      const move = directions[event.key];
      if (!move) return;
      const rect = card.getBoundingClientRect();
      placeDraggedCard(card, rect.left + move[0], rect.top + move[1]);
      event.preventDefault();
    });

    if (!resizeBound) {
      resizeBound = true;
      window.addEventListener("resize", () => requestAnimationFrame(clampCurrentCard), {passive:true});
    }
  }

  function renderCard(index) {
    if (!overlay) return;
    activeIndex = Math.max(0, Math.min(FIRST10.length - 1, index));
    const item = FIRST10[activeIndex];
    let targetResult = {found:true,fallback:false};

    if (item.route === "owner") targetResult = highlightOwner(item.target);
    else if (item.route === "staff") targetResult = highlightStaff(item.target);
    else targetResult = highlightTutorial(item.target);

    const modeNote = item.mode === "ACTION_USER_ONLY"
      ? "この項目の保存・更新・送信・状態変更は、内容を確認した利用者自身が操作します。ガイドは自動実行しません。"
      : "この項目は画面の確認だけです。ガイドから業務データを書き換えません。";

    overlay.innerHTML = `
      <div class="dpro-tour-card" role="dialog" aria-modal="false" aria-labelledby="dproTourTitle" aria-describedby="dproTourBody">
        <div class="dpro-tour-top">
          <div>
            <div class="dpro-tour-kicker">${item.id} ・ ${item.chapter} ・ ${activeIndex + 1}/${FIRST10.length}</div>
            <div class="dpro-tour-title" id="dproTourTitle">${item.title}</div>
          </div>
          <button type="button" class="dpro-tour-drag-handle" aria-label="ガイドカードを移動。矢印キーでも移動できます">↕ カードを移動</button>
          <button type="button" class="dpro-tour-close" aria-label="ガイドを閉じる">×</button>
        </div>
        <div class="dpro-progress" aria-hidden="true"><span style="width:${((activeIndex + 1) / FIRST10.length) * 100}%"></span></div>
        <div class="dpro-tour-body" id="dproTourBody">${item.body}</div>
        <div class="dpro-tour-note">${modeNote}</div>
        ${targetResult.fallback ? `<div class="dpro-tour-fallback">対象箇所を特定できなかったため、説明カードのみ表示しています。画面の更新操作は行っていません。</div>` : ""}
        <div class="dpro-tour-actions">
          <button type="button" class="dpro-prev" ${activeIndex === 0 ? "disabled" : ""}>戻る</button>
          <button type="button" class="dpro-next">${activeIndex === FIRST10.length - 1 ? "完了" : "次へ"}</button>
          <button type="button" class="dpro-skip">スキップ</button>
        </div>
      </div>
    `;

    const card = overlay.querySelector(".dpro-tour-card");
    if (card) card.dataset.stepId = item.id;
    installCardDrag();

    overlay.querySelector(".dpro-tour-close")?.addEventListener("click", closeGuide);
    overlay.querySelector(".dpro-prev")?.addEventListener("click", () => moveTo(activeIndex - 1));
    overlay.querySelector(".dpro-next")?.addEventListener("click", () => {
      if (activeIndex === FIRST10.length - 1) completeGuide();
      else moveTo(activeIndex + 1);
    });
    overlay.querySelector(".dpro-skip")?.addEventListener("click", skipGuide);

    requestAnimationFrame(() => overlay?.querySelector(".dpro-tour-close")?.focus({preventScroll:true}));
  }

  function moveTo(index) {
    const next = Math.max(0, Math.min(FIRST10.length - 1, index));
    writeState({status:"IN_PROGRESS",index:next});
    renderCard(next);
  }

  function createOverlay() {
    if (overlay) return;
    lastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    overlay = document.createElement("div");
    overlay.id = "dproTutorialOverlay";
    document.body.appendChild(overlay);
  }

  function start(replay = false) {
    createOverlay();
    if (replay) writeState({status:"IN_PROGRESS",index:0});
    const state = readState();
    const index = replay ? 0 : (state.status === "IN_PROGRESS" || state.status === "SKIPPED" ? state.index : 0);
    writeState({status:"IN_PROGRESS",index});
    renderCard(index);
  }

  function restoreFocus() {
    const target = lastFocus && document.contains(lastFocus) ? lastFocus : document.getElementById("dproTutorialStart");
    requestAnimationFrame(() => target?.focus?.({preventScroll:true}));
  }

  function closeGuide() {
    if (!overlay) return;
    writeState({status:"IN_PROGRESS",index:activeIndex});
    clearHighlight();
    overlay.remove();
    overlay = null;
    restoreFocus();
  }

  function skipGuide() {
    writeState({status:"SKIPPED",index:activeIndex});
    clearHighlight();
    overlay?.remove();
    overlay = null;
    restoreFocus();
  }

  function completeGuide() {
    writeState({status:"COMPLETED",index:FIRST10.length - 1,completed_at:new Date().toISOString()});
    clearHighlight();
    overlay?.remove();
    overlay = null;
    restoreFocus();
  }

  function bindKeyboard() {
    document.addEventListener("keydown", (event) => {
      if (!overlay) return;
      if (event.key === "Escape") {
        event.preventDefault();
        closeGuide();
      }
    });
  }

  function boot() {
    bindOwnerTargets();
    injectStyles();
    makeLauncher();
    bindKeyboard();

    const params = new URLSearchParams(location.search);
    if (params.get("tutorial") === "replay") {
      setTimeout(() => start(true), 80);
    } else if (params.get("tutorial") === "resume") {
      setTimeout(() => start(false), 80);
    }

    window.DPRO_BAKERY_TUTORIAL = Object.freeze({
      version:TUTORIAL_VERSION,
      stepCount:FIRST10.length,
      get state(){ return readState(); },
      start:() => start(false),
      replay:() => start(true),
      close:closeGuide
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, {once:true});
  } else {
    boot();
  }
})();