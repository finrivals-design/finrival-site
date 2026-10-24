/* FINRIVAL — shared site behaviour */
(() => {
  const root = document.documentElement;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Intro: CSS runs the animation; JS only lets visitors skip it and cleans up
  const intro = document.querySelector(".intro");
  if (intro && root.classList.contains("intro-play")) {
    const finish = () => {
      root.classList.add("intro-done");
      intro.remove();
    };
    intro.addEventListener("animationend", (e) => {
      if (e.target === intro) finish();
    });
    const skip = () => intro.classList.add("is-skipped");
    intro.addEventListener("click", skip);
    window.addEventListener("keydown", skip, { once: true });
    window.addEventListener("wheel", skip, { once: true, passive: true });
    window.addEventListener("touchmove", skip, { once: true, passive: true });
  } else {
    intro?.remove();
  }

  // Header: solid background once the page scrolls
  const header = document.querySelector(".site-header");
  const onScroll = () => header?.classList.toggle("is-scrolled", window.scrollY > 8);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  // Mobile menu
  const toggle = document.querySelector(".nav__toggle");
  const menu = document.getElementById("mobile-menu");
  const setMenu = (open) => {
    if (!toggle || !menu) return;
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute(
      "aria-label",
      (open ? toggle.dataset.labelClose : toggle.dataset.labelOpen) || (open ? "Close menu" : "Open menu")
    );
    menu.classList.toggle("is-open", open);
    menu.inert = !open;
    header?.classList.toggle("is-open", open);
    root.style.overflow = open ? "hidden" : "";
  };
  if (menu) menu.inert = true;
  toggle?.addEventListener("click", () => setMenu(toggle.getAttribute("aria-expanded") !== "true"));
  menu?.addEventListener("click", (e) => {
    if (e.target.closest("a")) setMenu(false);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") setMenu(false);
  });
  window.matchMedia("(min-width: 1001px)").addEventListener("change", (e) => {
    if (e.matches) setMenu(false);
  });

  // Language picker: dropdown in the header, choice remembered for the next visit
  const lang = document.querySelector(".lang");
  const langBtn = lang?.querySelector(".lang__btn");
  if (lang && langBtn) {
    lang.classList.add("is-ready");
    const setLang = (open) => {
      lang.classList.toggle("is-open", open);
      langBtn.setAttribute("aria-expanded", String(open));
    };
    langBtn.addEventListener("click", () => setLang(!lang.classList.contains("is-open")));
    document.addEventListener("click", (e) => {
      if (!lang.contains(e.target)) setLang(false);
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && lang.classList.contains("is-open")) {
        setLang(false);
        langBtn.focus();
      }
    });
  }
  document.querySelectorAll("[data-lang-pick]").forEach((link) => {
    link.addEventListener("click", () => {
      try {
        localStorage.setItem("fr-lang", link.dataset.langPick);
      } catch (e) {}
    });
  });

  // Hero: side phones drift apart as the page scrolls
  const stage = document.querySelector(".hero__stage");
  if (stage && !reduceMotion) {
    let ticking = false;
    const update = () => {
      ticking = false;
      const p = Math.min(1, Math.max(0, window.scrollY / 700));
      stage.style.setProperty("--spread", p.toFixed(3));
    };
    window.addEventListener(
      "scroll",
      () => {
        if (!ticking) {
          ticking = true;
          requestAnimationFrame(update);
        }
      },
      { passive: true }
    );
  }

  // Product tour: the sticky phone shows the screen of the step in view
  const steps = document.querySelectorAll(".tour__step");
  const screens = document.querySelectorAll(".tour__screens img");
  const bars = document.querySelectorAll(".tour__progress span");
  if (steps.length && "IntersectionObserver" in window) {
    const activate = (step) => {
      const key = step.dataset.screen;
      steps.forEach((s) => s.classList.toggle("is-active", s === step));
      screens.forEach((img) => img.classList.toggle("is-active", img.dataset.screen === key));
      bars.forEach((b, i) => b.classList.toggle("is-active", steps[i] === step));
    };
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && activate(e.target)),
      { rootMargin: "-45% 0px -45% 0px" }
    );
    steps.forEach((s) => io.observe(s));
    activate(steps[0]);
  }

  // Product loop: a rising line drawn through the four step dots, measured from the layout
  const loop = document.querySelector(".loop");
  if (loop) {
    const svg = loop.querySelector(".loop__line");
    const path = loop.querySelector(".loop__path");
    const arrow = loop.querySelector(".loop__arrow");
    const fmt = (p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`;
    const draw = () => {
      if (getComputedStyle(svg).display === "none") return;
      const box = svg.getBoundingClientRect();
      const pts = [...loop.querySelectorAll(".loop__dot")].map((dot) => {
        const r = dot.getBoundingClientRect();
        return [r.left + r.width / 2 - box.left, r.top + r.height / 2 - box.top];
      });
      if (pts.length < 2) return;
      const last = pts[pts.length - 1];
      const prev = pts[pts.length - 2];
      const len = Math.hypot(last[0] - prev[0], last[1] - prev[1]) || 1;
      const ux = (last[0] - prev[0]) / len;
      const uy = (last[1] - prev[1]) / len;
      const start = [pts[0][0] - 70, pts[0][1] + 36];
      const end = [last[0] + ux * 110, last[1] + uy * 110];
      path.setAttribute("d", "M" + [start, ...pts, end].map(fmt).join(" L"));
      const s = 13;
      const tip = [end[0] + ux * s, end[1] + uy * s];
      const left = [end[0] - uy * s * 0.7, end[1] + ux * s * 0.7];
      const right = [end[0] + uy * s * 0.7, end[1] - ux * s * 0.7];
      arrow.setAttribute("d", `M${fmt(tip)} L${fmt(left)} L${fmt(right)} Z`);
    };
    draw();
    new ResizeObserver(draw).observe(loop);
    const reveal = () => requestAnimationFrame(() => loop.classList.add("is-drawn"));
    if ("IntersectionObserver" in window && !reduceMotion) {
      const io = new IntersectionObserver(
        (entries) => {
          if (!entries.some((e) => e.isIntersecting)) return;
          draw();
          reveal();
          io.disconnect();
        },
        { threshold: 0.2 }
      );
      io.observe(loop);
    } else {
      reveal();
    }
  }

  // AI page: replay a real Finrival AI conversation, step by step, in sync with the notes
  const chat = document.querySelector("[data-chat]");
  if (chat) {
    const body = chat.querySelector(".cs-body");
    const scroller = chat.querySelector(".cs-scroll");
    const question = chat.querySelector(".cs-q");
    const steps = [...chat.querySelectorAll(".cs-step")];
    const notes = [...document.querySelectorAll(".demo__notes li")];
    const remaining = chat.querySelector(".cs-remaining");
    const replay = document.querySelector(".demo__replay");
    const timers = [];

    // Keep the newest visible part of the chat in view, like the app scrolling with the answer
    const keepInView = () => {
      const shown = [question, ...steps.filter((s) => s.classList.contains("is-shown"))];
      const last = shown[shown.length - 1];
      const top = last.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
      const overflow = top + last.offsetHeight + 24 - body.clientHeight;
      scroller.style.transform = `translateY(${-Math.max(0, overflow)}px)`;
    };
    const showStep = (n) => {
      steps.forEach((s) => s.classList.toggle("is-shown", Number(s.dataset.step) <= n));
      notes.forEach((li) => {
        const i = Number(li.dataset.note);
        li.classList.toggle("is-on", i <= n);
        li.classList.toggle("is-current", i === n);
      });
      keepInView();
    };
    const finish = () => {
      chat.classList.add("is-q");
      chat.classList.remove("is-thinking");
      remaining.textContent = remaining.dataset.after;
      showStep(5);
    };
    const play = () => {
      timers.splice(0).forEach(clearTimeout);
      if (replay) replay.hidden = true;
      chat.classList.remove("is-q", "is-thinking");
      remaining.textContent = remaining.dataset.before;
      showStep(0);
      const at = (ms, fn) => timers.push(setTimeout(fn, ms));
      at(300, () => chat.classList.add("is-q"));
      at(1000, () => chat.classList.add("is-thinking"));
      at(2800, () => {
        chat.classList.remove("is-thinking");
        remaining.textContent = remaining.dataset.after;
        showStep(1);
      });
      [2, 3, 4, 5].forEach((n, i) => at(5000 + i * 2400, () => showStep(n)));
      at(5000 + 3 * 2400 + 800, () => {
        if (replay) replay.hidden = false;
      });
    };

    replay?.addEventListener("click", play);
    if ("IntersectionObserver" in window && !reduceMotion) {
      showStep(0);
      const io = new IntersectionObserver(
        (entries) => {
          if (!entries.some((e) => e.isIntersecting)) return;
          play();
          io.disconnect();
        },
        { threshold: 0.4 }
      );
      io.observe(chat);
    } else {
      finish();
      if (replay) replay.hidden = false;
    }
  }

  // PRO page: Free / PRO switch. It flips to PRO once on its own, then it's the visitor's
  const flip = document.querySelector("[data-flip]");
  if (flip) {
    const buttons = flip.querySelectorAll("[data-plan]");
    let touched = false;
    const setPlan = (plan) => {
      flip.classList.toggle("is-pro", plan === "pro");
      buttons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.plan === plan)));
    };
    buttons.forEach((b) =>
      b.addEventListener("click", () => {
        touched = true;
        setPlan(b.dataset.plan);
      })
    );
    if ("IntersectionObserver" in window && !reduceMotion) {
      const io = new IntersectionObserver(
        (entries) => {
          if (!entries.some((e) => e.isIntersecting)) return;
          io.disconnect();
          setTimeout(() => !touched && setPlan("pro"), 1400);
        },
        { threshold: 0.45 }
      );
      io.observe(flip);
    }
  }

  // Legal documents: highlight the section being read; close the contents list on phones
  const tocLinks = [...document.querySelectorAll(".doc__toc a")];
  if (tocLinks.length) {
    const heads = [...document.querySelectorAll(".doc__body h2[id]")];
    let ticking = false;
    const spy = () => {
      ticking = false;
      const line = window.innerHeight * 0.3;
      let current = heads[0];
      heads.forEach((h) => {
        if (h.getBoundingClientRect().top <= line) current = h;
      });
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) current = heads[heads.length - 1];
      tocLinks.forEach((a) => a.classList.toggle("is-active", a.getAttribute("href") === "#" + current.id));
    };
    window.addEventListener("scroll", () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(spy);
      }
    }, { passive: true });
    spy();
    const toc = document.querySelector(".doc__toc");
    const narrow = window.matchMedia("(max-width: 900px)");
    if (toc && narrow.matches) toc.open = false;
    tocLinks.forEach((a) => a.addEventListener("click", () => narrow.matches && (toc.open = false)));
  }

  // Support: opening a quick-answer link expands that answer
  document.querySelectorAll('a[href^="#q-"]').forEach((link) => {
    link.addEventListener("click", () => {
      const target = document.querySelector(link.getAttribute("href"));
      if (target && target.tagName === "DETAILS") target.open = true;
    });
  });

  // Reveal on scroll
  const revealables = document.querySelectorAll("[data-reveal]");
  if ("IntersectionObserver" in window && !reduceMotion) {
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.1 }
    );
    revealables.forEach((el) => io.observe(el));
  } else {
    revealables.forEach((el) => el.classList.add("is-visible"));
  }

  // Premium touch, only for a mouse or trackpad and only when motion is welcome
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  if (finePointer && !reduceMotion) {
    // Hero phones lean toward the pointer
    const hero = document.querySelector(".hero");
    if (hero && stage) {
      let frame = 0;
      hero.addEventListener("pointermove", (e) => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          const r = hero.getBoundingClientRect();
          stage.style.setProperty("--tx", ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
          stage.style.setProperty("--ty", ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
        });
      });
      hero.addEventListener("pointerleave", () => {
        stage.style.setProperty("--tx", "0");
        stage.style.setProperty("--ty", "0");
      });
    }

    // Cards light up where the pointer is
    document.querySelectorAll(".feature, .topic").forEach((card) => {
      const glow = document.createElement("span");
      glow.className = "card-glow";
      glow.setAttribute("aria-hidden", "true");
      card.prepend(glow);
      card.addEventListener("pointermove", (e) => {
        const r = card.getBoundingClientRect();
        card.style.setProperty("--mx", `${e.clientX - r.left}px`);
        card.style.setProperty("--my", `${e.clientY - r.top}px`);
      });
    });
  }

  // Swipe rails on phones: page dots that follow the card in view
  document.querySelectorAll(".tour__steps, .features, .modes").forEach((rail) => {
    const cards = [...rail.children];
    const dots = document.createElement("div");
    dots.className = "rail-dots";
    dots.setAttribute("aria-hidden", "true");
    cards.forEach(() => dots.append(document.createElement("span")));
    rail.after(dots);
    let frame = 0;
    const sync = () => {
      const start = rail.getBoundingClientRect().left;
      let on = 0;
      let best = Infinity;
      cards.forEach((card, i) => {
        const d = Math.abs(card.getBoundingClientRect().left - start);
        if (d < best) {
          best = d;
          on = i;
        }
      });
      // The last card can't scroll to the start edge, so the end of the rail counts as the last page
      if (rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 4) on = cards.length - 1;
      [...dots.children].forEach((dot, i) => dot.classList.toggle("is-on", i === on));
    };
    rail.addEventListener("scroll", () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(sync);
    }, { passive: true });
    sync();
  });

  // Home: living phone. The app's own tab bar, its Finrival AI button and the chips below switch the screen
  const phone = document.querySelector("[data-live-phone]");
  if (phone) {
    const order = ["market", "compare", "rival", "ai"];
    const chips = document.querySelectorAll(".live-tabs [data-go]");
    let current = "market";
    let previous = "market";
    phone.dataset.on = current;
    phone.classList.add("is-hinting");
    const show = (name) => {
      if (name === "back") name = previous;
      if (!order.includes(name) || name === current) return;
      const forward = order.indexOf(name) > order.indexOf(current);
      phone.querySelectorAll(".live-phone__screens img").forEach((img) => {
        const leaving = img.dataset.screen === current;
        img.style.setProperty("--from", (forward === leaving ? "-" : "") + "28%");
        img.classList.toggle("is-on", img.dataset.screen === name);
      });
      chips.forEach((chip) => chip.setAttribute("aria-pressed", String(chip.dataset.go === name)));
      if (name !== "ai") previous = name;
      current = name;
      phone.dataset.on = name;
      phone.classList.remove("is-hinting");
    };
    phone.querySelectorAll(".live-phone__hit").forEach((hit) => {
      hit.addEventListener("click", () => {
        if (hit.dataset.go) return show(hit.dataset.go);
        // News and Watchlist have no screenshot yet: a small shake instead of a dead tap
        hit.classList.remove("is-nope");
        void hit.offsetWidth;
        hit.classList.add("is-nope");
      });
    });
    chips.forEach((chip) => chip.addEventListener("click", () => show(chip.dataset.go)));
  }

  // Home: Rival Duel. The cards slide in, the bars race and RC 10,000 counts up, once it is in view
  const duel = document.querySelector("[data-duel]");
  if (duel) {
    const rows = [...duel.querySelectorAll(".duel__row")];
    const totals = [...duel.querySelectorAll(".duel__grow b")];
    const rc = (n) => "RC " + Math.round(n).toLocaleString("en-US");
    const fill = (row, on) => {
      const max = Number(row.dataset.max);
      const [a, b] = row.querySelectorAll(".duel__bar i");
      a.style.setProperty("--fill", on ? (Number(row.dataset.a) / max) * 100 + "%" : "0%");
      b.style.setProperty("--fill", on ? (Number(row.dataset.b) / max) * 100 + "%" : "0%");
    };
    let timers = [];
    const play = () => {
      timers.forEach(clearTimeout);
      timers = [];
      duel.classList.remove("is-on");
      duel.classList.add("is-racing");
      rows.forEach((row) => fill(row, false));
      totals.forEach((el) => (el.textContent = rc(10000)));
      const at = (ms, fn) => timers.push(setTimeout(fn, reduceMotion ? 0 : ms));
      at(60, () => duel.classList.add("is-on"));
      rows.forEach((row, i) => at(900 + i * 350, () => fill(row, true)));
      at(2400, () => duel.classList.remove("is-racing"));
      at(2200, () => totals.forEach((el) => {
        const to = Number(el.dataset.to);
        const start = performance.now();
        const step = (now) => {
          const p = reduceMotion ? 1 : Math.min(1, (now - start) / 1800);
          el.textContent = rc(10000 + (to - 10000) * (1 - Math.pow(1 - p, 3)));
          if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }));
    };
    // Bars start empty so the race has somewhere to go; without IntersectionObserver they just fill
    rows.forEach((row) => fill(row, false));
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          play();
        }
      }, { threshold: 0.35 });
      io.observe(duel);
    } else {
      duel.classList.add("is-on");
      rows.forEach((row) => fill(row, true));
    }
    duel.querySelector("[data-duel-replay]")?.addEventListener("click", play);
  }

  // Home: one Learn question. Answer once, then the app's explanation opens
  const quiz = document.querySelector("[data-quiz]");
  if (quiz) {
    const right = quiz.dataset.correct;
    const options = quiz.querySelectorAll(".quiz__options button");
    const verdict = quiz.querySelector(".quiz__verdict");
    options.forEach((option) => option.addEventListener("click", () => {
      options.forEach((o) => {
        o.disabled = true;
        o.classList.add(o.dataset.i === right ? "is-right" : "is-other");
        if (o.dataset.i === right) o.querySelector("i").textContent = "✓";
      });
      option.classList.add("is-picked");
      option.classList.remove("is-other");
      verdict.textContent = option.dataset.i === right ? verdict.dataset.right : verdict.dataset.wrong;
      quiz.classList.add("is-done");
    }));
  }

  // Footer year
  document.querySelectorAll("[data-year]").forEach((el) => {
    el.textContent = String(new Date().getFullYear());
  });
})();
