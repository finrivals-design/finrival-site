/* FINRIVAL — home page live touches (loaded only on the home pages)
   1. Every dot is one company: last close of the Finrival catalogue drawn behind the hero
   2. World market clock in the visitor's own time zone (regular hours, no holiday calendar)
   3. Ask Finrival AI: rotating example questions; the question opens in the Terminal */
(() => {
  const lang = document.documentElement.lang || "en";
  const num = new Intl.NumberFormat(lang, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const pctOf = (p) => (p > 0 ? "+" : p < 0 ? "−" : "") + num.format(Math.abs(p)) + "%";
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- 1. Dot field ---------- */
  const field = document.querySelector("[data-dotfield]");
  const caption = document.querySelector("[data-dotfield-caption]");

  const hash = (s) => {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return h >>> 0;
  };

  // Groups on the background. Giants is a fixed list of very large, widely known companies
  // (the data has no market value); Future themes is defined by sector, not a recommendation.
  const GIANTS = new Set("AAPL MSFT NVDA GOOGL GOOG AMZN META TSLA AVGO BRK.B JPM V MA LLY WMT XOM ORCL COST NFLX UNH JNJ HD PG BAC".split(" "));
  const FUTURE = new Set(["cat_ai", "cat_semi", "cat_ev", "cat_biotech"]);
  const groupOf = (r) => (GIANTS.has(r.symbol) ? "giant" : r.price >= 1 && r.price <= 10 ? "under10" : FUTURE.has(r.category) ? "future" : "rest");

  function startField(rows, dataDate, assets = []) {
    const extra = Object.fromEntries(assets.map((a) => [a.symbol, a]));
    const canvas = field.querySelector("canvas");
    const tip = field.querySelector(".dotfield__tip");
    const ctx = canvas.getContext("2d");
    // A stable scatter: the same company keeps its place every day
    const dots = rows
      .map((r) => ({ s: r.symbol, n: r.name || r.symbol, p: Number(r.changePercent), g: groupOf(r), price: Number(r.price), prev: Number(r.previousSessionClose), vol: Number(extra[r.symbol]?.volume), traded: Number(extra[r.symbol]?.turnover), spark: extra[r.symbol]?.multiDaySparkline }))
      .filter((d) => Number.isFinite(d.p))
      .sort((a, b) => hash(a.s) - hash(b.s));
    if (dots.length < 50) return;
    field.dots = dots; // read-only handle for testing

    let labels = [], focus = null;
    let w = 0, h = 0, dpr = 1, step = 20, cx = -9999, cy = -9999, hover = null, t0 = performance.now(), raf = 0;
    const small = () => w < 700;

    // Text and buttons the dots must never sit behind (measured relative to the field)
    const blockers = () => {
      const box = field.getBoundingClientRect(), pad = small() ? 10 : 16;
      return [...document.querySelectorAll(".hero__badge, .hero h1 .mask-line > span, .hero .lead, .hero .getapp > *, .pulse__dots, .groups, .groups__desc, .tiles, .clock__item, .site-header, .hero__stage .device, .live-tabs__row")]
        .map((el) => el.getBoundingClientRect())
        .filter((r) => r.width && r.height)
        .map((r) => ({ l: r.left - box.left - pad, t: r.top - box.top - pad, r: r.right - box.left + pad, b: r.bottom - box.top + pad }));
    };

    function layout() {
      const box = field.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = box.width; h = box.height;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      const blocked = blockers();
      const free = (x, y) => !blocked.some((r) => x > r.l && x < r.r && y > r.t && y < r.b);
      // Shrink the grid until every company has a free spot around the text
      step = small() ? 30 : 40;
      let cells = [];
      for (let tries = 0; tries < 40; tries++) {
        cells = [];
        const cols = Math.floor((w - step) / step) + 1, ox = (w - (cols - 1) * step) / 2;
        for (let y = step * 0.8; y < h - step * 0.5; y += step)
          for (let c = 0; c < cols; c++) { const x = ox + c * step; if (free(x, y)) cells.push({ x, y }); }
        if (cells.length >= dots.length || step <= (small() ? 13 : 16)) break;
        step -= 1;
      }
      // Labelled groups claim the free cells nearest their corner; the rest hug the headline
      const anchors = small()
        ? { giant: [0.18, 0.6], future: [0.82, 0.6], under10: [0.5, 0.92] }
        : { giant: [0.1, 0.42], future: [0.9, 0.42], under10: [0.1, 0.8] };
      const take = (n, ax, ay, sy = 1) => {
        cells.sort((a, b) => Math.hypot(a.x - ax, (a.y - ay) * sy) - Math.hypot(b.x - ax, (b.y - ay) * sy));
        return cells.splice(0, n).sort((a, b) => a.y - b.y || a.x - b.x);
      };
      labels = [];
      for (const g of ["giant", "under10", "future"]) {
        const members = dots.filter((d) => d.g === g);
        const spots = take(members.length, anchors[g][0] * w, anchors[g][1] * h);
        members.forEach((d, i) => { d.x = spots[i]?.x ?? -99; d.y = spots[i]?.y ?? -99; });
        const placed = members.filter((d) => d.x > 0);
        if (placed.length) {
          const top = Math.min(...placed.map((d) => d.y)), xs = placed.map((d) => d.x);
          // Label above the group, or below it if text, buttons or the header are in the way
          const bottom = Math.max(...placed.map((d) => d.y));
          const lx = Math.min(Math.max((Math.min(...xs) + Math.max(...xs)) / 2, 70), w - 70);
          let ly = top - step * 0.62;
          if (ly < 70 || !free(lx, ly) || !free(lx - 50, ly) || !free(lx + 50, ly)) ly = bottom + step * 0.62;
          labels.push({ g, n: placed.length, x: lx, y: ly, box: { l: Math.min(...xs) - step * 0.5, r: Math.max(...xs) + step * 0.5, t: top - step * 0.5, b: bottom + step * 0.5 } });
        }
      }
      const rest = dots.filter((d) => d.g === "rest");
      const spots = take(rest.length, w / 2, h * 0.32, 1.6);
      rest.forEach((d, i) => { d.x = spots[i]?.x ?? -99; d.y = spots[i]?.y ?? -99; });
      dots.forEach((d) => {
        d.delay = Math.hypot(d.x - w / 2, d.y - h * 0.35) * 1.6; // wave from the centre
        d.phase = (hash(d.s) % 628) / 100;
      });
    }

    // Logos appear only around the cursor or finger (a lens), loaded on demand and cached
    const LOGO = "https://us-central1-finrival-dc2a7.cloudfunctions.net/getAssetLogo?symbol=";
    const logos = new Map();
    const logoFor = (d) => {
      let img = logos.get(d.s);
      if (!img) {
        img = new Image();
        img.decoding = "async";
        img.onload = () => restart();
        img.onerror = () => { img.failed = true; };
        img.src = LOGO + encodeURIComponent(d.s);
        logos.set(d.s, img);
      }
      return img.complete && !img.failed && img.naturalWidth ? img : null;
    };
    const LENS = () => (small() ? 64 : 92);

    function draw(now) {
      const t = now - t0;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const base = step * 0.095;
      const lensed = [];
      // Faint area behind each labelled group
      for (const l of []) {
        const b = l.box, gold = l.g !== "future";
        ctx.fillStyle = gold ? "rgba(216,191,131,0.045)" : "rgba(31,181,198,0.05)";
        ctx.strokeStyle = gold ? "rgba(216,191,131,0.16)" : "rgba(31,181,198,0.2)";
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect(b.l, b.t, b.r - b.l, b.b - b.t, Math.min(18, step * 0.6)); ctx.fill(); ctx.stroke();
      }
      for (const d of dots) {
        const k = reduceMotion ? 1 : Math.min(1, Math.max(0, (t - d.delay) / 600));
        if (k <= 0) continue;
        const mag = Math.min(Math.abs(d.p) / 4, 1);
        const up = d.p > 0;
        const tw = reduceMotion || small() ? 1 : 0.86 + 0.14 * Math.sin(t / 900 + d.phase);
        const dist = Math.hypot(d.x - cx, d.y - cy);
        if (k === 1 && (dist < LENS() || d === hover)) { lensed.push([d, dist]); continue; }
        const near = Math.max(0, 1 - dist / (LENS() * 1.6));
        const dim = focus && d.g !== focus ? 0.18 : 1, boost = focus && d.g === focus ? 1.6 : 1;
        const r = (base + mag * step * 0.1) * (d.g === "giant" ? 1.5 : 1) * boost * (1 + near * 0.5) * k;
        const a = ((up ? 0.26 + mag * 0.6 : 0.07 + mag * 0.16) * tw * k + near * 0.2) * dim * (focus && d.g === focus ? 1.5 : 1);
        ctx.fillStyle = up ? `rgba(216,191,131,${Math.min(a, 1)})` : `rgba(167,177,189,${Math.min(a, 0.8)})`;
        ctx.beginPath();
        ctx.arc(d.x, d.y, Math.max(r, 0.6), 0, Math.PI * 2);
        ctx.fill();
      }
      // Group labels above each cluster
      const names = (field.dataset.groups || "").split("|").reduce((o, x) => { const [k, v] = x.split("="); o[k] = v; return o; }, {});
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.font = `700 ${small() ? 10.5 : 12}px Inter, system-ui, sans-serif`;
      for (const l of []) {
        const text = ((names[l.g] || l.g) + "  " + l.n).toUpperCase();
        const tw = ctx.measureText(text).width + 22, th = small() ? 20 : 24;
        ctx.fillStyle = "rgba(10,14,19,0.85)";
        ctx.strokeStyle = l.g === "future" ? "rgba(31,181,198,0.55)" : "rgba(216,191,131,0.5)";
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect(l.x - tw / 2, l.y - th / 2, tw, th, th / 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = l.g === "future" ? "#7fd8e2" : "#e6d09b";
        ctx.fillText(text, l.x, l.y + 0.5);
      }
      // Lens: nearest companies become logo bubbles with a gold (rose) or grey (fell) ring
      lensed.sort((a, b) => b[1] - a[1]).slice(-16).forEach(([d, dist]) => {
        const grow = d === hover ? 1 : Math.max(0.55, 1 - dist / (LENS() * 1.4));
        const R = step * 0.46 * grow * (d === hover ? 1.25 : 1);
        const img = logoFor(d);
        ctx.save();
        ctx.beginPath();
        ctx.arc(d.x, d.y, R, 0, Math.PI * 2);
        ctx.fillStyle = "#f4f6f8";
        ctx.fill();
        if (img) { ctx.clip(); ctx.drawImage(img, d.x - R * 0.82, d.y - R * 0.82, R * 1.64, R * 1.64); }
        else { ctx.fillStyle = "#0d131a"; ctx.font = `700 ${Math.max(8, R * 0.62)}px Inter, system-ui, sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(d.s.slice(0, 4), d.x, d.y + 0.5); }
        ctx.restore();
        ctx.beginPath();
        ctx.arc(d.x, d.y, R + 1.5, 0, Math.PI * 2);
        ctx.lineWidth = d === hover ? 2.5 : 1.5;
        ctx.strokeStyle = d.p > 0 ? "rgba(216,191,131,0.95)" : "rgba(167,177,189,0.7)";
        ctx.stroke();
      });
      // Phones and reduced motion: draw the entry wave, then stop to save battery
      const settled = t > 600 + Math.max(...dots.map((d) => d.delay));
      if (!reduceMotion && (!small() || !settled) && !document.hidden) raf = requestAnimationFrame(draw);
    }

    const restart = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); };

    field.addEventListener("pointermove", (e) => {
      const box = field.getBoundingClientRect();
      cx = e.clientX - box.left; cy = e.clientY - box.top;
      let best = null, bd = step * 0.6;
      for (const d of dots) {
        const dd = Math.hypot(d.x - cx, d.y - cy);
        if (dd < bd) { bd = dd; best = d; }
      }
      hover = best;
      if (best) {
        const sign = best.p > 0 ? "+" : "";
        tip.innerHTML = `${best.s}<b class="${best.p > 0 ? "up" : "down"}">${pctOf(best.p)}</b>`;
        tip.title = best.n;
        tip.style.left = best.x + "px";
        tip.style.top = best.y + "px";
        tip.classList.add("is-on");
      } else tip.classList.remove("is-on");
      if (reduceMotion || small()) restart();
    });
    // Click or tap a dot: company card with Compare and Ask links into the Terminal
    const card = document.querySelector("[data-dotcard]");
    // Page level: the hero uses 3D perspective, which would trap a fixed-position card inside it
    if (card) document.body.appendChild(card);
    const sectors = Object.fromEntries((card?.dataset.sectors || "").split("|").map((x) => x.split("=")));
    const meta = Object.fromEntries(rows.map((r) => [r.symbol, r]));
    // Company card, opened from a dot (desktop) or a tile (phones)
    function openCard(d) {
      const r = meta[d.s] || {};
      const pct = pctOf(d.p);
      const set = (k, v) => { const el = card.querySelector(`[data-f="${k}"]`); if (el) el.textContent = v; return el; };
      set("s", d.s);
      const lg = card.querySelector("[data-f=logo]"); if (lg) { lg.hidden = false; lg.onerror = () => { lg.hidden = true; }; lg.src = LOGO + encodeURIComponent(d.s); }
      set("chg", pct).className = "dotcard__chg " + (d.p > 0 ? "up" : "down");
      set("name", d.n);
      set("meta", [sectors[r.category], (d.p > 0 ? card.dataset.rose : card.dataset.fell).replace("{p}", pct.replace(/^[+−]/, ""))].filter(Boolean).join(" · "));
      // Group, prices, volume and a 5-session trail
      const gn = Object.fromEntries((card.dataset.groupNames || "").split("|").map((x) => x.split("=")));
      const metaEl = card.querySelector("[data-f=meta]");
      if (gn[d.g]) metaEl.innerHTML = `<span class="dotcard__group dotcard__group--${d.g}">${gn[d.g]}</span>` + metaEl.innerHTML;
      const usd = (v) => new Intl.NumberFormat(lang, { style: "currency", currency: "USD", maximumFractionDigits: v < 10 ? 3 : 2 }).format(v);
      const compact = (v, cur) => new Intl.NumberFormat(lang, { notation: "compact", maximumFractionDigits: 1, ...(cur ? { style: "currency", currency: "USD" } : {}) }).format(v);
      const facts = [
        [card.dataset.lclose, Number.isFinite(d.price) && usd(d.price)],
        [card.dataset.lprev, Number.isFinite(d.prev) && usd(d.prev)],
        [card.dataset.lvol, Number.isFinite(d.vol) && compact(d.vol)],
        [card.dataset.ltraded, Number.isFinite(d.traded) && compact(d.traded, true)],
      ].filter(([, v]) => v);
      card.querySelector("[data-f=facts]").innerHTML = facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("");
      const sp = (Array.isArray(d.spark) ? d.spark : []).map(Number).filter(Number.isFinite);
      const sbox = card.querySelector("[data-f=sparkbox]");
      sbox.hidden = sp.length < 3;
      if (sp.length >= 3) {
        const lo = Math.min(...sp), hi = Math.max(...sp), span = hi - lo || 1;
        card.querySelector("[data-f=spark]").setAttribute("d", sp.map((v, i) => `${i ? "L" : "M"}${(i / (sp.length - 1)) * 120},${27 - ((v - lo) / span) * 24}`).join(" "));
        sbox.className = "dotcard__spark " + (sp[sp.length - 1] >= sp[0] ? "up" : "down");
        card.querySelector("[data-f=sparklabel]").textContent = card.dataset.l5d;
      }
      card.querySelector("[data-f=compare]").href = "/terminal/?compare=" + encodeURIComponent(d.s);
      card.querySelector("[data-f=ask]").href = "/terminal/?ask=" + encodeURIComponent(card.dataset.askQ.replace("{name}", d.n).replace("{s}", d.s));
      card.hidden = false;
      const left = Math.min(Math.max(d.x - 170, 16), w - 356);
      const fb = field.getBoundingClientRect();
      card.style.left = (fb.left + window.scrollX + left) + "px";
      card.style.top = (fb.top + window.scrollY + d.y + 18) + "px";
      hover = d; restart();
    }
    let down = null;
    field.addEventListener("pointerdown", (e) => { down = { x: e.clientX, y: e.clientY }; });
    field.addEventListener("pointerup", (e) => {
      if (!card || !down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 10) return;
      const box = field.getBoundingClientRect();
      const px = e.clientX - box.left, py = e.clientY - box.top;
      let best = null, bd = step * 0.9;
      for (const d of dots) { const dd = Math.hypot(d.x - px, d.y - py); if (dd < bd) { bd = dd; best = d; } }
      if (!best) { card.hidden = true; return; }
      openCard(best);
    });
    card?.querySelector("[data-dotcard-close]")?.addEventListener("click", () => { card.hidden = true; });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && card) card.hidden = true; });
    field.addEventListener("pointerleave", () => { cx = cy = -9999; hover = null; tip.classList.remove("is-on"); if (reduceMotion || small()) restart(); });
    document.addEventListener("visibilitychange", () => { if (!document.hidden) restart(); });
    let rt;
    window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => { layout(); t0 = performance.now() - 5000; restart(); }, 150); });

    const legend = document.querySelector("[data-groups-legend]");
    if (legend) {
      const names = Object.fromEntries((field.dataset.groups || "").split("|").map((x) => x.split("=")));
      const desc = Object.fromEntries((field.dataset.groupDesc || "").split("|").map((x) => x.split("=")));
      legend.innerHTML = ["giant", "under10", "future"].map((g) => `<button type="button" class="groups__chip groups__chip--${g}" data-g="${g}" aria-pressed="false">${names[g] || g}</button>`).join("");
      const descEl = document.querySelector("[data-groups-desc]");
      legend.hidden = false;
      // Phones: the chosen group as big tiles (ticker + move), biggest moves first; Giants to start
      const tiles = document.querySelector("[data-tiles]");
      const renderTiles = () => {
        if (!tiles) return;
        const on = small();
        tiles.hidden = !on;
        if (!on) return;
        const list = dots.filter((d) => d.g === (focus || "giant")).sort((a, b) => Math.abs(b.p) - Math.abs(a.p)).slice(0, 12);
        tiles.innerHTML = list.map((d, i) => `<button type="button" class="tile ${d.p > 0 ? "up" : "down"}" data-i="${i}"><b>${d.s}</b><small>${d.n.replace(/,? (Inc|Corp|Corporation|Co|Ltd|plc|Holdings|Group)\.?$/i, "")}</small><span>${pctOf(d.p)}</span></button>`).join("");
        tiles.onclick = (e) => { const t = e.target.closest("[data-i]"); if (t) openCard(list[Number(t.dataset.i)]); };
      };
      if (small()) {
        focus = "giant";
        legend.querySelector("[data-g=giant]")?.setAttribute("aria-pressed", "true");
        if (descEl) descEl.textContent = desc.giant || "";
      }
      renderTiles();
      window.addEventListener("resize", renderTiles);
      legend.addEventListener("click", (e) => {
        const b = e.target.closest("[data-g]"); if (!b) return;
        focus = small() ? b.dataset.g : focus === b.dataset.g ? null : b.dataset.g;
        renderTiles();
        legend.querySelectorAll("[data-g]").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.g === focus)));
        if (descEl) descEl.textContent = focus ? desc[focus] || "" : descEl.dataset.hint || "";
        restart();
      });
    }
    layout();
    setTimeout(() => { layout(); restart(); }, 1600);
    field.classList.add("is-ready");
    restart();

    if (caption) {
      const up = dots.filter((d) => d.p > 0).length;
      let date = dataDate || "";
      try { date = new Intl.DateTimeFormat(lang, { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(dataDate + "T12:00:00Z")); } catch (e) {}
      const down = dots.filter((d) => d.p < 0).length;
      caption.innerHTML = `<span class="lg lg--up"><i></i>${caption.dataset.up.replace("{n}", up)}</span><span class="lg lg--down"><i></i>${caption.dataset.down.replace("{n}", down)}</span>`;
      const hintEl = document.querySelector("[data-groups-desc]");
      if (hintEl) { hintEl.dataset.hint = caption.dataset.tpl; if (!focus) hintEl.textContent = caption.dataset.tpl; }
      caption.hidden = false;
    }
  }

  if (field) {
    const load = () =>
      fetch(field.dataset.api, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
        .then((j) => {
          const rows = j?.eodRanking?.rows?.length ? j.eodRanking.rows : j?.data || [];
          startField(rows, j?.eodRanking?.dataDate || j?.eodTargetDate, j?.completedSessionCatalog?.assets || []);
        })
        .catch(() => field.remove());
    // After the page itself has loaded, so the hero never waits for market data
    if (document.readyState === "complete") setTimeout(load, 200);
    else window.addEventListener("load", () => setTimeout(load, 200), { once: true });
  }

  /* ---------- 2. World market clock ---------- */
  const clock = document.querySelector("[data-clock]");
  if (clock) {
    const names = {
      en: { ny: "New York", ldn: "London", waw: "Warsaw", ist: "Istanbul" },
      tr: { ny: "New York", ldn: "Londra", waw: "Varşova", ist: "İstanbul" },
      pl: { ny: "Nowy Jork", ldn: "Londyn", waw: "Warszawa", ist: "Stambuł" },
    }[lang] || {};
    const units = { en: ["h", "m"], tr: [" sa", " dk"], pl: [" godz.", " min"] }[lang] || ["h", "m"];
    const markets = [
      { id: "ny", tz: "America/New_York", open: 570, close: 960 },
      { id: "ldn", tz: "Europe/London", open: 480, close: 990 },
      { id: "waw", tz: "Europe/Warsaw", open: 540, close: 1020 },
      { id: "ist", tz: "Europe/Istanbul", open: 600, close: 1080 },
    ];
    // The visitor's own market first
    // (Turkish: Istanbul, New York, London, Warsaw · Polish: Warsaw, New York, London, Istanbul)
    if (lang === "tr") markets.unshift(markets.splice(3, 1)[0]);
    if (lang === "pl") { const waw = markets.splice(2, 1)[0]; markets.unshift(waw); }

    const local = (tz) => {
      const p = Object.fromEntries(
        new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", hour: "numeric", minute: "numeric", hourCycle: "h23" })
          .formatToParts(new Date()).map((x) => [x.type, x.value])
      );
      return { day: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday), min: Number(p.hour) * 60 + Number(p.minute) };
    };
    const dur = (m) => {
      const hh = Math.floor(m / 60), mm = m % 60;
      if (hh >= 24) return Math.round(hh / 24) + (lang === "tr" ? " gün" : lang === "pl" ? " d" : "d");
      return (hh ? hh + units[0] + " " : "") + mm + units[1];
    };

    const render = () => {
      clock.innerHTML = markets.slice(0, clock.hasAttribute("data-badge") ? 1 : markets.length).map((m) => {
        const { day, min } = local(m.tz);
        const weekday = day >= 1 && day <= 5;
        const isOpen = weekday && min >= m.open && min < m.close;
        let text;
        if (isOpen) text = clock.dataset.closes.replace("{t}", dur(m.close - min));
        else {
          let wait = 0, d = day, now = min;
          if (!(weekday && now < m.open)) { wait += 1440 - now; now = 0; d = (d + 1) % 7; while (d === 0 || d === 6) { wait += 1440; d = (d + 1) % 7; } }
          wait += m.open - now;
          text = clock.dataset.opens.replace("{t}", dur(wait));
        }
        const state = isOpen ? clock.dataset.open : clock.dataset.closed;
        if (clock.hasAttribute("data-badge")) { clock.classList.toggle("is-open", isOpen); return `<i></i><b>${names[m.id]}</b>&nbsp;${state} · ${text}`; }
        return `<span class="clock__item${isOpen ? " is-open" : ""}"><i></i><b>${names[m.id]}</b>${state} · ${text}</span>`;
      }).join("");
    };
    render();
    setInterval(render, 30000);
  }

  /* ---------- Get the app: straight to the App Store on iPhone ---------- */
  const store = document.querySelector("a.store[href*=\"apps.apple.com\"]");
  if (store && /iPhone|iPod/.test(navigator.userAgent)) document.querySelectorAll("[data-app-link]").forEach((a) => { a.href = store.href; });

  /* ---------- 3. Ask Finrival AI ---------- */
  const ask = document.querySelector("[data-ask]");
  if (ask) {
    const input = ask.querySelector("input");
    const examples = (input.dataset.askExamples || "").split("|").filter(Boolean);
    let i = 0;
    if (examples.length > 1 && !reduceMotion) {
      setInterval(() => {
        if (document.activeElement === input || input.value) return;
        i = (i + 1) % examples.length;
        input.placeholder = examples[i];
      }, 3200);
    }
    ask.querySelectorAll("[data-ask-chip]").forEach((b) =>
      b.addEventListener("click", () => { input.value = b.textContent.trim(); ask.requestSubmit ? ask.requestSubmit() : ask.submit(); })
    );
    ask.addEventListener("submit", (e) => {
      // An empty box asks the example on screen
      if (!input.value.trim()) input.value = input.placeholder;
    });
  }
})();
