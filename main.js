/* Paushtica — dark cinematic interaction layer
   GSAP + ScrollTrigger + Lenis. Maximal scrubbed motion:
   full-screen poster takeovers, macro hero pull, char-split titles.
   Degrades to a static readable page without GSAP or with reduced motion. */

(function () {
  "use strict";

  /* Full motion by default (the client wants cinema). A calm, static
     version stays available at ?calm=1 for anyone who needs it. */
  var reduceMotion = /[?&]calm=1/.test(window.location.search);
  var gsapReady = typeof window.gsap !== "undefined" && typeof window.ScrollTrigger !== "undefined";
  var finePointer = window.matchMedia("(pointer: fine)").matches;

  var nav = document.getElementById("nav");
  var preloader = document.getElementById("preloader");
  var progress = document.getElementById("progress");

  /* ---------- No-motion / no-GSAP fallback ---------- */
  if (reduceMotion || !gsapReady) {
    document.documentElement.classList.add("no-motion");
    if (preloader) { preloader.remove(); }
    if (progress) { progress.remove(); }
    if (nav) {
      var onScrollBasic = function () {
        nav.classList.toggle("is-scrolled", window.scrollY > 40);
      };
      window.addEventListener("scroll", onScrollBasic, { passive: true });
      onScrollBasic();
    }
    return;
  }

  gsap.registerPlugin(ScrollTrigger);

  /* ---------- Lenis smooth scroll (optional) ---------- */
  if (typeof window.Lenis !== "undefined") {
    var lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 1 });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);
  }

  /* ---------- Nav ---------- */
  var lastY = 0;
  var onScroll = function () {
    var y = window.scrollY;
    if (nav) {
      nav.classList.toggle("is-scrolled", y > 40);
      nav.classList.toggle("is-hidden", y > 600 && y > lastY);
    }
    lastY = y;
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- Scroll progress ---------- */
  if (progress) {
    gsap.to(progress, {
      scaleX: 1,
      ease: "none",
      scrollTrigger: { start: 0, end: "max", scrub: 0.3 }
    });
  }

  /* ---------- Custom cursor ---------- */
  if (finePointer) {
    var dot = document.getElementById("cursor");
    var ring = document.getElementById("cursorRing");
    if (dot && ring) {
      var dotX = gsap.quickTo(dot, "x", { duration: 0.08, ease: "power2.out" });
      var dotY = gsap.quickTo(dot, "y", { duration: 0.08, ease: "power2.out" });
      var ringX = gsap.quickTo(ring, "x", { duration: 0.35, ease: "power2.out" });
      var ringY = gsap.quickTo(ring, "y", { duration: 0.35, ease: "power2.out" });
      dot.style.opacity = "0";
      ring.style.opacity = "0";
      window.addEventListener("mousemove", function (e) {
        dot.style.opacity = "1";
        ring.style.opacity = "1";
        dotX(e.clientX); dotY(e.clientY);
        ringX(e.clientX); ringY(e.clientY);
      }, { passive: true });
      document.querySelectorAll("a, button").forEach(function (el) {
        el.addEventListener("mouseenter", function () { ring.classList.add("is-hover"); });
        el.addEventListener("mouseleave", function () { ring.classList.remove("is-hover"); });
      });
    }
  }

  /* ---------- Magnetic buttons ---------- */
  if (finePointer) {
    document.querySelectorAll(".btn, .nav__cta").forEach(function (btn) {
      var setX = gsap.quickTo(btn, "x", { duration: 0.4, ease: "power3.out" });
      var setY = gsap.quickTo(btn, "y", { duration: 0.4, ease: "power3.out" });
      btn.addEventListener("mousemove", function (e) {
        var r = btn.getBoundingClientRect();
        setX((e.clientX - r.left - r.width / 2) * 0.25);
        setY((e.clientY - r.top - r.height / 2) * 0.35);
      });
      btn.addEventListener("mouseleave", function () { setX(0); setY(0); });
    });
  }

  /* ---------- Character splitter ---------- */
  function splitChars(el, className) {
    var text = el.textContent;
    el.textContent = "";
    el.style.opacity = "1";
    for (var i = 0; i < text.length; i++) {
      var ch = document.createElement("span");
      ch.className = className;
      ch.style.display = "inline-block";
      ch.style.willChange = "transform";
      ch.textContent = text[i] === " " ? " " : text[i];
      el.appendChild(ch);
    }
  }

  document.querySelectorAll(".hero__word").forEach(function (w) { splitChars(w, "hero__char"); });
  document.querySelectorAll("[data-split]").forEach(function (t) { splitChars(t, "char"); });

  /* ---------- Pack tinting ----------
     The listing photos are packs on pure white. Baking a multiply
     composite into a canvas ONCE gives the color-flood poster look with
     zero runtime blend cost (live mix-blend-mode froze Chrome's renderer).
     Falls back to CSS blending if the canvas is tainted. */
  function tintify(el, color) {
    var im = new Image();
    im.crossOrigin = "anonymous";
    im.onload = function () {
      var cv = document.createElement("canvas");
      cv.width = im.naturalWidth;
      cv.height = im.naturalHeight;
      var x = cv.getContext("2d");
      x.fillStyle = color;
      x.fillRect(0, 0, cv.width, cv.height);
      x.globalCompositeOperation = "multiply";
      x.drawImage(im, 0, 0);
      try {
        el.src = cv.toDataURL("image/jpeg", 0.92);
      } catch (e) {
        el.style.mixBlendMode = "multiply";
      }
    };
    im.onerror = function () { el.style.mixBlendMode = "multiply"; };
    im.src = el.src;
  }
  /* Hero only — poster and outro packs stay untinted inside white
     encasings so the product is always clearly visible. */
  var hImg = document.querySelector(".hero__img");
  if (hImg) { tintify(hImg, "#B44A17"); }

  /* ---------- Film grain: tiny pre-rendered noise tile ---------- */
  var grainEl = document.querySelector(".grain");
  if (grainEl) {
    var gcv = document.createElement("canvas");
    gcv.width = 96; gcv.height = 96;
    var gx = gcv.getContext("2d");
    var gd = gx.createImageData(96, 96);
    for (var gi = 0; gi < gd.data.length; gi += 4) {
      var v = (Math.random() * 255) | 0;
      gd.data[gi] = v; gd.data[gi + 1] = v; gd.data[gi + 2] = v; gd.data[gi + 3] = 255;
    }
    gx.putImageData(gd, 0, 0);
    grainEl.style.backgroundImage = "url(" + gcv.toDataURL() + ")";
  }

  /* ---------- Preloader → hero intro ---------- */
  var intro = gsap.timeline({ delay: 0.1 });
  if (preloader) {
    var plWord = preloader.querySelector(".preloader__word");
    intro
      .from(plWord, { yPercent: 120, duration: 0.7, ease: "power4.out" })
      .to(plWord, { yPercent: -120, duration: 0.55, ease: "power4.in", delay: 0.35 })
      .to(preloader, {
        yPercent: -100, duration: 0.75, ease: "power4.inOut",
        onComplete: function () { preloader.remove(); }
      }, "-=0.15");
  }

  gsap.set(".hero__char", { opacity: 0, yPercent: 115, rotate: 4 });
  gsap.set(".hero .reveal-line", { opacity: 0, y: 24 });
  intro
    .to(".hero__char", {
      opacity: 1, yPercent: 0, rotate: 0,
      duration: 1, stagger: 0.02, ease: "power4.out"
    }, preloader ? "-=0.35" : 0)
    .to(".hero .reveal-line", {
      opacity: 1, y: 0,
      duration: 0.9, stagger: 0.12, ease: "power3.out"
    }, "-=0.65");

  /* ---------- Hero: full-bleed macro pull + copy scatter ---------- */
  var heroImg = document.querySelector(".hero__img");
  if (heroImg) {
    gsap.set(heroImg, { scale: 2.6, yPercent: 5 });
    gsap.timeline({
      scrollTrigger: {
        trigger: ".hero__pin",
        start: "top top",
        end: "+=140%",
        scrub: 0.6,
        pin: true,
        anticipatePin: 1
      }
    })
      .to(heroImg, { scale: 1, yPercent: 0, ease: "none" }, 0)
      .to(".hero__copy", { yPercent: -18, opacity: 0.25, ease: "none" }, 0.55)
      .to(".hero__vignette", { opacity: 0.85, ease: "none" }, 0.5);
  }

  /* ---------- Product takeovers ---------- */
  var takes = gsap.utils.toArray("[data-tk]");
  var shades = [];
  takes.forEach(function (tk, i) {
    var wrap = tk.closest(".tk-wrap");
    var img = tk.querySelector(".tk__media img");
    var num = tk.querySelector(".tk__num");
    var chars = tk.querySelectorAll(".tk__title .char");
    var items = tk.querySelectorAll(".tk__index, .tk__sub, .tk__points li, .tk__buy, .tk__variants");

    // Exit dimmer: an opacity-only overlay (a scrubbed brightness() filter
    // on these full-screen layers froze the renderer).
    var shade = document.createElement("div");
    shade.style.cssText = "position:absolute;inset:0;background:#0C0B09;opacity:0;pointer-events:none;z-index:6";
    tk.appendChild(shade);
    shades.push(shade);

    // Entrance: title chars rise, copy staggers in — scrubbed against the wipe
    gsap.set(chars, { yPercent: 120, rotate: 3 });
    gsap.set(items, { opacity: 0, y: 30 });
    gsap.set(img, { yPercent: 10, rotate: -5, scale: 1.12 });

    gsap.timeline({
      scrollTrigger: {
        trigger: wrap,
        start: "top 65%",
        end: "top -5%",
        scrub: 0.5
      }
    })
      .to(chars, { yPercent: 0, rotate: 0, stagger: 0.035, ease: "power3.out" }, 0)
      .to(img, { yPercent: 0, rotate: 0, scale: 1, ease: "power2.out" }, 0)
      .to(items, { opacity: 1, y: 0, stagger: 0.05, ease: "power2.out" }, 0.15);

    // Dwell: numeral drift + slow pack float while stuck
    gsap.timeline({
      scrollTrigger: {
        trigger: wrap,
        start: "top top",
        end: "bottom bottom",
        scrub: 0.8
      }
    })
      .to(num, { yPercent: -22, ease: "none" }, 0)
      .to(img, { yPercent: -6, ease: "none" }, 0);

    // Exit: as the NEXT poster wipes over, this one sinks, shrinks and dims
    if (i < takes.length - 1) {
      var next = takes[i + 1].closest(".tk-wrap");
      gsap.timeline({
        scrollTrigger: {
          trigger: next,
          start: "top bottom",
          end: "top top",
          scrub: 0.5
        }
      })
        .to(tk, { scale: 0.92, yPercent: -4, ease: "none" }, 0)
        .to(shade, { opacity: 0.55, ease: "none" }, 0);
    }
  });

  // Last poster dims as the light "why" section slides over it
  var lastTk = takes[takes.length - 1];
  if (lastTk) {
    gsap.timeline({
      scrollTrigger: {
        trigger: ".why",
        start: "top bottom",
        end: "top top",
        scrub: 0.5
      }
    })
      .to(lastTk, { scale: 0.94, ease: "none" }, 0)
      .to(shades[shades.length - 1], { opacity: 0.55, ease: "none" }, 0);
  }

  /* ---------- Why-seeds ---------- */
  var whyLines = document.querySelectorAll(".why__title .reveal-line");
  if (whyLines.length) {
    gsap.set(whyLines, { opacity: 0, y: 40 });
    gsap.to(whyLines, {
      opacity: 1, y: 0,
      duration: 1, stagger: 0.14, ease: "power4.out",
      scrollTrigger: { trigger: ".why", start: "top 65%", once: true }
    });
  }
  var whyCells = document.querySelectorAll(".why__cell");
  if (whyCells.length) {
    gsap.set(whyCells, { opacity: 0, y: 30 });
    gsap.to(whyCells, {
      opacity: 1, y: 0,
      duration: 0.9, stagger: 0.12, ease: "power3.out",
      scrollTrigger: { trigger: ".why__grid", start: "top 75%", once: true }
    });
  }

  /* ---------- Outro ---------- */
  var outroImg = document.querySelector(".outro__pack img");
  if (outroImg) {
    gsap.fromTo(outroImg,
      { yPercent: -6 },
      {
        yPercent: 2,
        ease: "none",
        scrollTrigger: {
          trigger: ".outro",
          start: "top bottom",
          end: "bottom top",
          scrub: 0.8
        }
      });
  }
  var outroLines = document.querySelectorAll(".outro .reveal-line");
  if (outroLines.length) {
    gsap.set(outroLines, { opacity: 0, y: 44 });
    gsap.to(outroLines, {
      opacity: 1, y: 0,
      duration: 1.1, stagger: 0.15, ease: "power4.out",
      scrollTrigger: { trigger: ".outro", start: "top 60%", once: true }
    });
  }

  /* ---------- Footer watermark rise ---------- */
  var watermark = document.querySelector(".footer__watermark");
  if (watermark) {
    gsap.fromTo(watermark,
      { yPercent: 36 },
      {
        yPercent: 0,
        ease: "none",
        scrollTrigger: {
          trigger: ".footer",
          start: "top bottom",
          end: "bottom bottom",
          scrub: 0.6
        }
      });
  }
})();
