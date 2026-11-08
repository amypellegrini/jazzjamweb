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
  const ghost = (el, fadeOver = 0.6, r = rect(el)) => {
    const g = el.cloneNode(true);
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
      el.innerHTML = `<div class="title"></div><div class="sub"></div><div class="note"></div>`;
      el.querySelector(".title").textContent = spec.text; el.querySelector(".sub").textContent = spec.sub || "";
      el.querySelector(".note").textContent = spec.note || "";
      return el;
    },
    score(spec) {
      const el = document.createElement("div"); el.className = "wrap";
      el.innerHTML = spec.svg;
      const svg = el.querySelector("svg"); svg.removeAttribute("width"); svg.removeAttribute("height");
      return el;
    },
    // A key word: the newest is in its accent colour, the others settle to ink.
    word(spec) {
      const el = document.createElement("div"); el.className = "kw"; el.textContent = spec.text;
      el.style.setProperty("--accent", spec.accent); return el;
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

  // Which staff an element sits on: every system is a grand staff (right hand above, left below),
  // so staves alternate right, left, right, ... down the page. A one-staff score is all right hand.
  const staves = (svg) => {
    if (svg._staves) return svg._staves;
    const ys = [...svg.querySelectorAll(".StaffLines")].map((l) => { const b = l.getBBox(); return b.y + b.height / 2; })
      .sort((a, b) => a - b);
    const out = [];
    for (let i = 0; i + 4 < ys.length; i += 5) out.push({ top: ys[i], bottom: ys[i + 4] });
    return (svg._staves = out);
  };
  const isLeft = (svg, e) => {
    const st = staves(svg);
    if (st.length < 2) return false;
    const b = e.getBBox(), y = b.y + b.height / 2;
    const gap = (s) => (y < s.top ? s.top - y : y > s.bottom ? y - s.bottom : 0);
    let best = 0;
    st.forEach((s, i) => { if (gap(s) < gap(st[best])) best = i; });
    return best % 2 === 1;
  };
  // Picking out part of a score while the sentence names it: the left hand's notes or the right
  // hand's rests, in the explanation's orange (playback lights notes blue, so the two never mix).
  const EXPLAIN = "#E8590C";
  const MARK = { lh: { sel: "path.Note", left: true, fill: EXPLAIN }, rests: { sel: ".Rest", left: false, fill: EXPLAIN } };
  const mark = (wrap, which) => {
    const svg = wrap.querySelector("svg");
    for (const [name, m] of Object.entries(MARK)) {
      for (const e of svg.querySelectorAll(m.sel)) {
        if (isLeft(svg, e) !== m.left) continue;
        const on = which === name, was = e.style.fill !== "";
        if (on === was) continue;
        const from = getComputedStyle(e).fill;
        e.style.fill = on ? m.fill : "";
        animate(e, [{ fill: from }, { fill: getComputedStyle(e).fill }]);
      }
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
      const ACCENTS = ["#2563EB", "#2F9E44", "#C2255C", "#7048E8"];
      (spec.words || []).forEach((text, i) => want.push([`word:${text}`, { text, accent: ACCENTS[i % ACCENTS.length],
        newest: i === spec.words.length - 1 }]));
      const before = new Map([...nodes].map(([id, el]) => [id, rect(el)]));
      const personBefore = new Map([...vis.querySelectorAll(".person")].map((p) => [p.dataset.id, rect(p)]));

      // Leaving: fade out where they are.
      // (All are measured first: removing one would reflow the others before they are pinned.)
      const leaving = [...nodes].filter(([id]) => !want.some(([w]) => w === id));
      for (const [id, el] of leaving) ghost(el, 0.6, before.get(id));
      for (const [id, el] of leaving) { el.remove(); nodes.delete(id); }
      // Arriving or staying, in layout order.
      const fresh = new Set();
      for (const [id, s] of want) {
        let el = nodes.get(id);
        if (!el) { el = build[id.split(":")[0]](s); nodes.set(id, el); fresh.add(id); }
        else if (id === "keys") recolourKeys(el, s.svg);
        vis.append(el);
        if (id.startsWith("score:")) {
          el.classList.toggle("example", !!s.example);
          if (s.height) el.querySelector("svg").style.height = s.height + "px";
        }
        if (id.startsWith("word:")) {
          const was = el.classList.contains("newest");
          el.classList.toggle("newest", s.newest);
          if (was && !s.newest) animate(el, [{ color: s.accent }, { color: "#142030" }]);
        }
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
      for (const [id, s] of want) if (id.startsWith("score:")) {
        reveal(nodes.get(id), s.reveal, !fresh.has(id));
        mark(nodes.get(id), s.mark || null);
      }

      // Now everything is in its final place: animate from where it was.
      // (The photo row itself is not flipped: each photo flips on its own, from its own old box.)
      for (const [id, el] of nodes) fresh.has(id) ? enter(el, id.startsWith("word:") ? "translateY(40px) scale(.8)" : undefined)
        : id !== "people" && flip(el, before.get(id));
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
    // Playback lighting. Both kinds of score end up with heads[k] (chord k's noteheads) and an
    // optional keyboard per chord; window.light(k) lights chord k on both, or clears them (k < 0).
    // An article example: its cursor gives each chord's x and line.
    prepareExample(id, events, keys) {
      const wrap = nodes.get(`score:${id}`), svg = wrap.querySelector("svg"), box = svg.viewBox.baseVal;
      const heads = events.map(() => []);
      // Match each notehead to a chord on its own line (the cursor's top/bottom band), then by x:
      // on a two-line score the second line's x positions repeat the first line's.
      for (const h of svg.querySelectorAll("path.Note")) {
        const [hx, hy] = h.getAttribute("d").slice(1).split(/[ ,]/).map(parseFloat);
        const x = ((hx + 54) / box.width) * 100, y = (hy / box.height) * 100;
        const gap = (e) => (y < e.top ? e.top - y : y > e.bottom ? y - e.bottom : 0);
        let best = 0;
        events.forEach((e, k) => {
          const b = events[best], d = gap(e) - gap(b);
          if (d < 0 || (d === 0 && Math.abs(e.x - x) < Math.abs(b.x - x))) best = k;
        });
        heads[best].push(h);
      }
      lights(wrap, heads, keys);
    },
    // A storyboard snippet: the bars being played (from bar `from`, counts[i] chords in each); in
    // each bar the heads split into its chords at the widest gaps between them.
    prepareMusic(id, from, counts, keys) {
      const wrap = nodes.get(`score:${id}`), heads = [];
      const cx = (e) => { const b = e.getBBox(); return b.x + b.width / 2; };
      counts.forEach((n, i) => {
        const hs = indexBars(wrap).filter(({ e, bar }) => bar === from + i && e.matches("path.Note"))
          .map(({ e }) => ({ e, x: cx(e) })).sort((a, b) => a.x - b.x);
        const cuts = hs.slice(1).map((h, j) => ({ j: j + 1, gap: h.x - hs[j].x }))
          .sort((a, b) => b.gap - a.gap).slice(0, n - 1).map((c) => c.j).sort((a, b) => a - b);
        [0, ...cuts].forEach((c, k) => heads.push(hs.slice(c, k + 1 < n ? cuts[k] : hs.length).map((h) => h.e)));
      });
      lights(wrap, heads, keys);
    },
  };

  // Recolour the keyboard at once (playback, not a transition).
  const setKeys = (svg) => {
    const kb = nodes.get("keys");
    if (!kb) return;
    const tmp = document.createElement("div"); tmp.innerHTML = svg;
    const next = [...tmp.querySelectorAll("rect")];
    kb.querySelectorAll("rect").forEach((r, i) => { r.style.fill = next[i].style.fill; });
  };
  const lights = (wrap, heads, keys) => {
    const svg = wrap.querySelector("svg");
    heads.flat().forEach((h) => h.classList.toggle("lh", isLeft(svg, h)));
    // k: a chord, a list of chords, or -1 for none. An entry [chord, "rh"] lights only its right
    // hand, [chord, [i, ...]] only those notes (top down). cls: "sounding" for playback, "lit"
    // for the chords an explanation names.
    const top = (h) => { const b = h.getBBox(); return b.y + b.height / 2; };
    window.light = (k, cls = "sounding") => {
      const ks = [].concat(k).filter((e) => Array.isArray(e) || e >= 0);
      wrap.querySelectorAll(".sounding, .lit").forEach((h) => h.classList.remove("sounding", "lit"));
      for (const e of ks) {
        const [i, which] = Array.isArray(e) ? e : [e, null];
        let hs = [...(heads[i] || [])].sort((a, b) => top(a) - top(b));
        if (which === "rh") hs = hs.filter((h) => !h.classList.contains("lh"));
        else if (Array.isArray(which)) hs = which.map((j) => hs[j]).filter(Boolean);
        hs.forEach((h) => h.classList.add(cls));
      }
      if (keys) setKeys(ks.length === 1 && !Array.isArray(ks[0]) && keys.play[ks[0]] ? keys.play[ks[0]] : keys.blank);
    };
    window.light(-1);
  };
})();
