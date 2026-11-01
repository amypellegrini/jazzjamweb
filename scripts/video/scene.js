// In-page scene for the block chords video (loaded by make-video.mjs into a 1920x1080 page).
//
// The page keeps one persistent element per thing on screen: the photos, a title, a score, the
// keyboard, the subtitle and the section label. scene.apply(spec) moves the page to the next
// storyboard frame by animating, not swapping:
//   - an element that stays slides/resizes from where it was to where it now sits (FLIP);
//   - a new element fades and slides in; one that leaves fades out where it was;
//   - the keyboard (one key range for the whole video) keeps its keys and recolours them;
//   - a score that stays reveals its next bars in place; a different score crossfades;
//   - subtitle and section label crossfade when their text changes.
// All animations are created paused; the caller steps them with scene.seek(ms) and screenshots
// each step, so the result is frame-exact and deterministic. scene.settle() ends the transition.
(() => {
  const EASE = "cubic-bezier(.22,.7,.2,1)";
  const KEEP = new Set(["", "StaffLines", "BarLine", "Bracket", "Clef", "TimeSig", "KeySig"]);
  const $ = (s) => document.querySelector(s);
  let anims = [], ghosts = [], duration = 0;
  const nodes = new Map(); // id -> element in .vis

  const animate = (el, frames, opts = {}) => {
    const a = el.animate(frames, { duration, easing: EASE, fill: "both", ...opts });
    a.pause(); anims.push(a); return a;
  };
  const rect = (el) => el.getBoundingClientRect();

  // A copy of an element, pinned where it is now, to fade out while the real one goes.
  const ghost = (el, fadeOver = 0.6) => {
    const r = rect(el), g = el.cloneNode(true);
    Object.assign(g.style, { position: "absolute", left: r.left + "px", top: r.top + "px",
      width: r.width + "px", height: r.height + "px", margin: "0", transform: "none" });
    g.querySelectorAll("svg").forEach((s) => Object.assign(s.style, { width: "100%", height: "100%" }));
    $(".ghosts").append(g); ghosts.push(g);
    animate(g, [{ opacity: 1 }, { opacity: 0 }], { duration: duration * fadeOver });
    return g;
  };

  // FLIP: animate from the old box to the new one.
  const flip = (el, before) => {
    const after = rect(el);
    if (!before || !after.width) return;
    const dx = before.left - after.left, dy = before.top - after.top;
    const sx = before.width / after.width, sy = before.height / after.height;
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 && Math.abs(sx - 1) < 0.002 && Math.abs(sy - 1) < 0.002) return;
    el.style.transformOrigin = "0 0";
    animate(el, [{ transform: `translate(${dx}px,${dy}px) scale(${sx},${sy})` }, { transform: "none" }]);
  };
  const enter = (el, from = "translateY(28px)") =>
    animate(el, [{ opacity: 0, transform: from }, { opacity: 1, transform: "none" }], { delay: duration * 0.25, duration: duration * 0.75 });

  const textSwap = (sel, text, cls) => {
    const el = $(sel);
    if (el.textContent === (text || "") && el.className === cls) return;
    if (el.textContent) ghost(el, 0.45);
    el.textContent = text || ""; el.className = cls;
    if (text) animate(el, [{ opacity: 0 }, { opacity: 1 }], { delay: duration * 0.35, duration: duration * 0.65 });
  };

  // ---- elements ---------------------------------------------------------------------------
  const build = {
    people(spec) {
      const el = document.createElement("div"); el.className = "people"; return el;
    },
    title(spec) {
      const el = document.createElement("div"); el.className = "titlebox";
      el.innerHTML = `<div class="title"></div><div class="sub"></div>`;
      el.querySelector(".title").textContent = spec.text; el.querySelector(".sub").textContent = spec.sub || "";
      return el;
    },
    score(spec) {
      const el = document.createElement("div"); el.className = "wrap";
      el.innerHTML = spec.svg + `<div class="cursor"></div>`;
      const svg = el.querySelector("svg"); svg.removeAttribute("width"); svg.removeAttribute("height");
      return el;
    },
    keys(spec) {
      const el = document.createElement("div"); el.className = "kb"; el.innerHTML = spec.svg;
      const svg = el.querySelector("svg"); svg.removeAttribute("width"); svg.removeAttribute("height");
      return el;
    },
  };

  // Which bar each score element belongs to, from the bar lines' positions.
  const indexBars = (wrap) => {
    if (wrap._bars) return wrap._bars;
    const svg = wrap.querySelector("svg");
    const cx = (e) => { const b = e.getBBox(); return b.x + b.width / 2; };
    const clefX = Math.min(...[...svg.querySelectorAll(".Clef")].map(cx));
    const xs = [...new Set([...svg.querySelectorAll(".BarLine")].map((b) => Math.round(cx(b))))]
      .sort((a, b) => a - b).filter((x) => x > clefX);
    const merged = xs.filter((x, i) => i === 0 || x - xs[i - 1] > 20);
    wrap._bars = [...svg.querySelectorAll("[class]")].filter((e) => !KEEP.has(e.getAttribute("class")))
      .map((e) => ({ e, bar: merged.filter((x) => x < cx(e)).length }));
    return wrap._bars;
  };
  const reveal = (wrap, n, animateIn) => {
    for (const { e, bar } of indexBars(wrap)) {
      const show = n == null || bar < n, shown = e.style.opacity !== "0";
      if (show && !shown) {
        e.style.opacity = "";
        if (animateIn) animate(e, [{ opacity: 0 }, { opacity: 1 }], { delay: duration * 0.2, duration: duration * 0.8 });
      } else if (!show) e.style.opacity = "0";
    }
  };

  const recolourKeys = (oldEl, newSvg) => {
    const tmp = document.createElement("div"); tmp.innerHTML = newSvg;
    const next = [...tmp.querySelectorAll("rect")], rects = [...oldEl.querySelectorAll("rect")];
    rects.forEach((r, i) => {
      const from = getComputedStyle(r).fill, to = next[i].style.fill;
      r.style.fill = to;
      if (from !== getComputedStyle(r).fill) animate(r, [{ fill: from }, { fill: to }]);
    });
  };

  // ---- the transition ---------------------------------------------------------------------
  window.scene = {
    apply(spec, ms) {
      duration = ms;
      const vis = $(".vis");
      const want = [];
      if (spec.photos) want.push(["people", spec.photos]);
      if (spec.title) want.push([`title:${spec.title.text}|${spec.title.sub || ""}`, spec.title]);
      if (spec.score) want.push([`score:${spec.score.id}`, spec.score]);
      if (spec.keys) want.push(["keys", spec.keys]);
      const before = new Map([...nodes].map(([id, el]) => [id, rect(el)]));
      const personBefore = new Map([...vis.querySelectorAll(".person")].map((p) => [p.dataset.id, rect(p)]));

      // Leaving: fade out where they are.
      for (const [id, el] of [...nodes]) {
        if (!want.some(([w]) => w === id)) { ghost(el); el.remove(); nodes.delete(id); }
      }
      // Arriving or staying, in layout order.
      const fresh = new Set();
      for (const [id, s] of want) {
        let el = nodes.get(id);
        if (!el) { el = build[id.split(":")[0]](s); nodes.set(id, el); fresh.add(id); }
        else if (id === "keys") recolourKeys(el, s.svg);
        vis.append(el);
        if (id.startsWith("score:")) el.classList.toggle("example", !!s.example);
      }
      // Photos: reconcile the people inside the row.
      const people = nodes.get("people");
      if (people) {
        const ids = spec.photos.map((p) => p.id);
        for (const p of [...people.children]) if (!ids.includes(p.dataset.id)) { ghost(p); p.remove(); }
        for (const p of spec.photos) {
          let el = people.querySelector(`[data-id="${p.id}"]`);
          if (!el) {
            el = document.createElement("div"); el.className = "person"; el.dataset.id = p.id;
            el.innerHTML = `<img src="${p.src}"><div class="pname"></div>${p.credit ? '<div class="credit"></div>' : ""}`;
            el.querySelector(".pname").textContent = p.name;
            if (p.credit) el.querySelector(".credit").textContent = p.credit;
          }
          people.append(el);
        }
      }
      // Scores: reveal state.
      for (const [id, s] of want) if (id.startsWith("score:")) reveal(nodes.get(id), s.reveal, !fresh.has(id));

      // Now everything is in its final place: animate from where it was.
      // (The photo row itself is not flipped: each photo flips on its own, from its own old box.)
      for (const [id, el] of nodes) fresh.has(id) ? enter(el) : id !== "people" && flip(el, before.get(id));
      if (people) for (const p of people.children) {
        personBefore.has(p.dataset.id) && !fresh.has("people") ? flip(p, personBefore.get(p.dataset.id)) : enter(p, "translateX(60px)");
      }
      textSwap(".subs", spec.subs ? spec.subs.text : "", spec.subs && spec.subs.caption ? "subs caption" : "subs");
      textSwap(".kicker", spec.kicker || "", "kicker");
      return anims.length;
    },
    seek(ms) { for (const a of anims) a.currentTime = ms; },
    settle() {
      for (const a of anims) a.cancel();
      for (const g of ghosts) g.remove();
      anims = []; ghosts = [];
      for (const el of document.querySelectorAll("[style]")) if (el.style.transformOrigin) el.style.transformOrigin = "";
    },
    // Chord spellings: light the first `upto`+1 spelled notes on the score and keyboard (or none).
    // A chord's noteheads, lowest on the page first, are its pitches lowest first: across the two
    // staves and within each, a lower note always sits lower.
    spell(l) {
      document.querySelectorAll(".vis .spelled").forEach((e) => e.classList.remove("spelled"));
      document.querySelectorAll(".vis .kb rect[data-fill]").forEach((r) => { r.style.fill = r.dataset.fill; delete r.dataset.fill; });
      if (!l) return;
      const wrap = $(".vis .wrap");
      if (l.score && wrap) {
        const heads = indexBars(wrap).filter(({ e, bar }) => bar === l.score.bar && e.getAttribute("class") === "Note")
          .map(({ e }) => ({ e, b: e.getBBox() })).sort((p, q) => p.b.x - q.b.x);
        const chords = [];
        for (const h of heads) {
          const last = chords.at(-1);
          last && h.b.x - last.at(-1).b.x < 150 ? last.push(h) : chords.push([h]);
        }
        const chord = chords[l.score.chord];
        if (chord && chord.length === l.score.size) {
          const low = chord.sort((p, q) => (q.b.y + q.b.height / 2) - (p.b.y + p.b.height / 2)).map((h) => h.e);
          l.score.idx.slice(0, l.upto + 1).forEach((i) => low[i].classList.add("spelled"));
        } else console.warn("spell: chord shape does not match", l.score, chord && chord.length);
      }
      if (l.keys) {
        const rects = [...document.querySelectorAll(".vis .kb rect")];
        l.keys.slice(0, l.upto + 1).forEach((i) => {
          const r = rects[i]; if (!r) return;
          if (r.dataset.fill === undefined) r.dataset.fill = r.style.fill;
          r.style.fill = "#E8955A";
        });
      }
    },
    // Examples: light the chord sounding at event k (or none).
    prepareExample(id, events) {
      const wrap = nodes.get(`score:${id}`), svg = wrap.querySelector("svg"), width = svg.viewBox.baseVal.width;
      const heads = events.map(() => []);
      for (const h of svg.querySelectorAll("path.Note")) {
        const x = ((parseFloat(h.getAttribute("d").slice(1)) + 54) / width) * 100;
        let best = 0;
        events.forEach((e, k) => { if (Math.abs(e.x - x) < Math.abs(events[best].x - x)) best = k; });
        heads[best].push(h);
      }
      window.light = (k) => {
        wrap.querySelectorAll(".sounding").forEach((h) => h.classList.remove("sounding"));
        const c = wrap.querySelector(".cursor");
        if (k < 0) return (c.style.display = "none");
        heads[k].forEach((h) => h.classList.add("sounding"));
        c.style.display = "block"; c.style.left = events[k].x + "%";
      };
      window.light(-1);
    },
  };
})();
