/* ============================================================================
 * PetLife — main.js
 * Точка входа: запуск кабинета, лендинг-логика (навигация, анимации, счётчики),
 * интерактивные демо (погода + ИИ-анализ фото) и общие действия интерфейса.
 * ==========================================================================*/
(function () {
  "use strict";
  const { $, $$, esc, fmt, toast, modal, Actions, observeOnce, animateNumber, scrollToEl } = window.PL;
  const D = window.PL_DATA;

  /* ------------------------------------------------------------------ лендинг: шапка */
  function initHeader() {
    const header = $("#siteHeader");
    const onScroll = () => header && header.classList.toggle("scrolled", window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    const burger = $("#burger"), nav = $("#mainNav");
    if (burger && nav) {
      burger.addEventListener("click", (e) => {
        e.stopPropagation();
        nav.classList.toggle("open");
      });
      document.addEventListener("click", (e) => {
        if (nav.classList.contains("open") && !nav.contains(e.target) && e.target !== burger) nav.classList.remove("open");
      });
    }
    $$("#mainNav a").forEach((a) => a.addEventListener("click", () => nav && nav.classList.remove("open")));
  }

  /* ------------------------------------------------------------------ плавный скролл */
  function initScroll() {
    document.addEventListener("click", (e) => {
      const el = e.target.closest("[data-scroll]");
      if (!el) return;
      const target = el.getAttribute("data-scroll");
      if (!target || target === "#") return;
      e.preventDefault();
      const node = $(target);
      if (node) scrollToEl(node, target === "#top" ? 200 : 76);
    });
  }

  /* ------------------------------------------------------------------ витрина 42 функций */
  function initFeatureMarquee() {
    const host = $("#featureMarquee");
    if (!host) return;
    host.innerHTML = D.features.map((f) =>
      `<button class="f-chip" data-act="hub.open" data-panel="${f.panel}" title="Открыть в кабинете: ${esc(f.title)}">
        <span>${f.icon}</span><span>${esc(f.title)}</span><span class="n">${f.n}</span>
      </button>`).join("");
  }

  /* ------------------------------------------------------------------ счётчики */
  let countersStarted = false;
  function initCounters() {
    if (countersStarted) return;
    countersStarted = true;
    const mission = $("#missionCounter");
    if (mission) {
      observeOnce($("#mission"), () => {
        const target = window.Store.state.mission.helped || 12847;
        animateNumber(mission, target, { duration: 2200 });
        const pct = Math.min(100, Math.round((target / 20000) * 100));
        const bar = $("#missionProgress"), percent = $("#missionPercent");
        if (bar) bar.style.width = pct + "%";
        if (percent) animateNumber(percent, pct, { duration: 2200, suffix: "%" });
        const adopt = $("#missionAdoptions");
        if (adopt) animateNumber(adopt, (window.Store.state.adoptions || []).length + 3, { duration: 1400 });
        const shel = $("#missionShelters");
        if (shel) animateNumber(shel, window.Store.state.mission.sheltersSupported || 4, { duration: 1400 });
      }, 0.25);
    }
    observeOnce($(".hero-trust"), () => {
      const f = $("#heroStatFeatures"), p = $("#heroStatPets");
      if (f) animateNumber(f, D.features.length, { duration: 1200 });
      if (p) animateNumber(p, window.Store.state.mission.helped || 12847, { duration: 1800 });
    }, 0.4);
  }

  /* ------------------------------------------------------------------ демо: погода */
  function initWeatherDemo() {
    const quick = $("#quickCities");
    if (quick) {
      const cities = ["Москва", "Санкт-Петербург", "Казань", "Сочи", "Дубай"];
      quick.innerHTML = cities.map((c) => `<button class="tag" data-act="weather.quick" data-city="${c}">${c}</button>`).join("");
    }
    const input = $("#cityInput");
    if (input) {
      input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); Actions.run("weather.check", {}, e, input); } });
      const saved = window.Store.state.owner && window.Store.state.owner.city;
      if (saved) input.value = saved;
    }
  }

  function weatherLoading() {
    $("#weatherResult").innerHTML = `<div class="loading-box"><span class="spinner dark"></span> Загружаем погоду…</div>`;
  }

  function renderWeather(data, opts) {
    $("#weatherResult").innerHTML = window.Weather.renderCard(data, opts || {});
    $$("#weatherResult [data-act='walk.route'], #weatherResult [data-act='walk.save'], #weatherResult [data-act='walk.start']").forEach(() => {});
  }

  /* ------------------------------------------------------------------ демо: фото */
  let currentFile = null;

  function setPreview(src, name) {
    const wrap = $("#photoPreviewWrap");
    if (!wrap) return;
    wrap.classList.remove("hidden");
    wrap.innerHTML = `<img src="${src}" alt="Превью питомца" class="photo-preview">
      <div class="muted small center mt-1">${esc(name || "выбранное фото")} · <button class="btn btn-xs btn-ghost" data-act="ai.reset">Убрать</button></div>`;
    const btn = $("#analyzeBtn");
    if (btn) btn.disabled = false;
    const dz = $("#photoDrop");
    if (dz) dz.classList.add("hidden");
  }

  function resetPhoto() {
    currentFile = null;
    const wrap = $("#photoPreviewWrap");
    if (wrap) { wrap.classList.add("hidden"); wrap.innerHTML = ""; }
    const dz = $("#photoDrop");
    if (dz) dz.classList.remove("hidden");
    const btn = $("#analyzeBtn");
    if (btn) btn.disabled = true;
    const res = $("#aiResult");
    if (res) res.innerHTML = "";
    const input = $("#photoInput");
    if (input) input.value = "";
  }

  function initPhotoDemo() {
    const dz = $("#photoDrop"), input = $("#photoInput");
    if (!dz || !input) return;

    dz.addEventListener("click", () => input.click());
    dz.addEventListener("dragover", (e) => { e.preventDefault(); dz.classList.add("drag"); });
    dz.addEventListener("dragleave", () => dz.classList.remove("drag"));
    dz.addEventListener("drop", (e) => {
      e.preventDefault();
      dz.classList.remove("drag");
      const file = e.dataTransfer.files && e.dataTransfer.files[0];
      if (file) handleFile(file);
    });
    input.addEventListener("change", () => {
      const file = input.files && input.files[0];
      if (file) handleFile(file);
    });
  }

  function handleFile(file) {
    if (!/^image\//.test(file.type)) { toast("Загрузите изображение", "error"); return; }
    if (file.size > 5 * 1024 * 1024) { toast("Файл слишком большой (макс. 5 МБ)", "error"); return; }
    currentFile = file;
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result, file.name);
    reader.onerror = () => toast("Не удалось прочитать файл. Попробуйте другое фото.", "error");
    reader.readAsDataURL(file);
  }

  function aiLoading() {
    $("#aiResult").innerHTML = `<div class="loading-box"><span class="spinner dark"></span> Анализируем фото… <span class="muted small">(vision-модель смотрит на снимок)</span></div>`;
  }

  function renderAi(res) {
    const findings = res.findings && res.findings.length
      ? `<div class="metric-grid mt-2">${res.findings.map((f) =>
          `<div class="metric"><span class="m-ico">📊</span><span><span class="m-label">${esc(f.label)}</span><span class="m-value">${f.value}%</span><span class="m-label">${esc(f.hint)}</span></span></div>`).join("")}</div>` : "";
    const sourceBadge = res.source === "openrouter"
      ? window.PL.badge("vision-модель OpenRouter", "violet")
      : window.PL.badge("локальный демо-анализ (без ключа)", "info");
    $("#aiResult").innerHTML = `
      <div class="ai-answer" id="aiAnswerText">${esc(res.text)}</div>
      ${findings}
      <div class="row mt-2" style="gap:8px">
        ${sourceBadge}
        <button class="btn btn-soft btn-sm" data-act="ai.saveSymptom">💾 Сохранить в дневник</button>
        <button class="btn btn-ghost btn-sm" data-act="hub.open" data-panel="ai">🤖 Спросить ИИ-ассистента</button>
      </div>
      <div class="warn-note">⚠️ Это не заменяет консультацию ветеринара. При серьёзных симптомах обратитесь к специалисту.</div>`;
    window.Store.update((s) => { s.lastAiResult = res.text; }, "ai");
  }

  /* ------------------------------------------------------------------ делегирование действий
     Единый обработчик кликов: любая кнопка с data-act="module.action"
     автоматически вызывает зарегистрированный обработчик. */
  function initActions() {
    document.addEventListener("click", (e) => {
      const el = e.target && e.target.closest ? e.target.closest("[data-act]") : null;
      if (!el || el.disabled) return;
      const name = el.getAttribute("data-act");
      if (!name) return;
      if (el.tagName === "A" && (el.getAttribute("href") === "#" || el.getAttribute("href") === "")) e.preventDefault();
      Actions.run(name, Object.assign({}, el.dataset), e, el);
    });

    window.addEventListener("unhandledrejection", (e) => {
      console.error("PetLife: необработанная ошибка", e && e.reason);
      toast("Что-то пошло не так. Попробуйте позже.", "error");
    });
    window.addEventListener("error", (e) => {
      if (e && e.message && /ResizeObserver|Script error/.test(e.message)) return;
      console.error("PetLife: ошибка скрипта", e.message || e);
    });
  }

  /* ------------------------------------------------------------------ загрузка */
  function boot() {
    window.Store.init();
    initActions();
    initHeader();
    initScroll();
    initFeatureMarquee();
    initWeatherDemo();
    initPhotoDemo();
    window.LeadForm.init();
    if (window.Hub) window.Hub.init();
    window.PL.revealInit();

    // Кабинет открывается сразу — сразу же подтягиваем погоду для города владельца,
    // чтобы на дашборде были живые данные, а не «погода не загружена».
    (function autoWeather() {
      const state = window.Store.state;
      if (state.lastWeather) return;
      const city = (state.owner && state.owner.city) || "Москва";
      const pet = window.Store.pet();
      const size = pet.species === "cat" ? "cat" : (pet.size || "medium");
      window.Weather.get(city, { size })
        .then(() => { if (window.Hub) window.Hub.render(); toast("Погода для " + city + " загружена автоматически 🌤", "info", 4200); })
        .catch(() => { /* нет интернета — кабинет работает и без прогноза */ });
    })();

    // Прямая ссылка на раздел презентации (#form, #features…) — открываем её.
    const LANDING_HASHES = ["#top", "#features", "#how", "#try", "#mission", "#form"];
    if (LANDING_HASHES.indexOf(window.location.hash) >= 0) {
      Actions.run("app.landing", { target: window.location.hash });
    }

    // подсказка при первом открытии
    if (!localStorage.getItem("petlife.visited")) {
      localStorage.setItem("petlife.visited", "1");
      setTimeout(() => toast("Это рабочий кабинет PetLife: демо уже заполнено данными Барона и Мурки 🐾 Презентация — кнопка «О проекте»", "ok", 6500), 1200);
    }
  }

  /* ------------------------------------------------------------------ действия */
  Actions.registerAll({
    /* переключение «экосистема ↔ презентация» */
    "app.landing": (ds) => {
      const landing = $("#landing"), hub = $("#hub");
      if (!landing || !hub) return;
      document.body.classList.remove("app-mode");
      landing.classList.remove("hidden");
      hub.classList.add("hidden");
      initCounters();
      window.PL.revealInit();
      const target = ds && ds.target;
      if (target) setTimeout(() => { const node = $(target); if (node) scrollToEl(node, 76); }, 80);
      else window.scrollTo({ top: 0, behavior: "smooth" });
    },
    "app.hub": () => {
      const landing = $("#landing"), hub = $("#hub");
      if (!landing || !hub) return;
      document.body.classList.add("app-mode");
      landing.classList.add("hidden");
      hub.classList.remove("hidden");
      window.scrollTo({ top: 0, behavior: "smooth" });
      if (window.Hub) window.Hub.render();
    },
    "demo.scroll": (ds) => { const n = $("#" + ds.target); if (n) scrollToEl(n, 76); },
    "demo.toast": (ds) => toast(ds.text || "Это демо-ссылка 🐾", "info"),
    "demo.privacy": () => modal({
      title: "Политика конфиденциальности", icon: "🔒", wide: true,
      body: `<p class="muted small">Демонстрационная версия PetLife. Все данные, которые вы вводите, хранятся <b>только в вашем браузере</b> (localStorage) и не отправляются на сторонние серверы, кроме запросов погоды и ИИ-анализа.</p>
        <ul class="list dot">
          <li>Профиль питомца, вес, симптомы, расходы — локально в этом браузере.</li>
          <li>Заявка на ранний доступ сохраняется в файл <code>data/signups.json</code> на вашем компьютере.</li>
          <li>Фото питомца отправляется в OpenRouter только если указан API-ключ; иначе анализируется локально.</li>
          <li>Запросы погоды идут в Open-Meteo (анонимно, без идентификаторов).</li>
          <li>Кнопка «Сбросить данные» в разделе «Данные и настройки» удаляет всё безвозвратно.</li>
        </ul>`
    }),
    "demo.contacts": () => modal({
      title: "Контакты PetLife", icon: "✉️",
      body: `<div class="kv">
        <div class="kv-row"><span class="kv-k">Почта</span><span class="kv-v">hello@petlife.app</span></div>
        <div class="kv-row"><span class="kv-k">Телефон</span><span class="kv-v">+7 495 000-00-00</span></div>
        <div class="kv-row"><span class="kv-k">Город</span><span class="kv-v">Москва</span></div>
        <div class="kv-row"><span class="kv-k">Приюты-партнёры</span><span class="kv-v">4 организации</span></div>
      </div>
      <p class="muted small mt-2">Проект студенческого стартапа. Демонстрационная сборка, контакты вымышленные.</p>`
    }),
    "demo.about": () => modal({
      title: "О проекте PetLife", icon: "🐾", wide: true,
      body: `<p>PetLife — экосистема для владельцев питомцев, объединяющая пять приложений в одном: погода для безопасных прогулок, здоровье с ИИ-анализом, питание, дрессировка и сообщество.</p>
        <div class="kpi-row mt-2">
          ${window.PL.stat({ icon: "🧩", value: D.features.length, label: "функций в MVP" })}
          ${window.PL.stat({ icon: "🐾", value: fmt.int(window.Store.state.mission.helped), label: "питомцев получили помощь", kind: "ok" })}
          ${window.PL.stat({ icon: "🏠", value: D.shelters.length, label: "приюта-партнёра" })}
          ${window.PL.stat({ icon: "🤖", value: 2, label: "ИИ-модуля" })}
        </div>
        <p class="muted small mt-2">Технологии: чистый HTML/CSS/JS без фреймворков, Python-сервер на стандартной библиотеке, открытые API Open-Meteo, опционально OpenWeather и OpenRouter.</p>`
    }),

    /* ---------------- погода на лендинге ---------------- */
    "weather.check": async () => {
      const city = ($("#cityInput") || {}).value ? $("#cityInput").value.trim() : "";
      const size = ($("#petTypeSelect") || {}).value || "medium";
      if (!city) { toast("Введите город", "error"); $("#cityInput").classList.add("invalid"); return; }
      $("#cityInput").classList.remove("invalid");
      weatherLoading();
      try {
        const data = await window.Weather.get(city, { size });
        renderWeather(data);
        window.Store.update((s) => { s.owner.city = data.cityName; }, "owner");
        toast("Погода получена: асфальт " + fmt.temp(data.asphalt), data.asphalt > 40 ? "warn" : "ok");
      } catch (err) {
        const message = (err && err.message) || "Не удалось получить погоду. Попробуйте позже.";
        $("#weatherResult").innerHTML = `<div class="advice danger"><div><div>${esc(message)}</div>
          <small>Проверьте название города или подключение к интернету.</small></div></div>
          <button class="btn btn-ghost btn-block mt-2" data-act="weather.demo" data-city="${esc(city)}">Показать демо-данные</button>`;
        toast(message, "error");
      }
    },
    "weather.quick": (ds) => {
      const input = $("#cityInput");
      if (input) input.value = ds.city;
      Actions.run("weather.check", {}, null, input);
    },
    "weather.demo": (ds) => {
      const size = ($("#petTypeSelect") || {}).value || "medium";
      const data = window.Weather.demo(ds.city || "Москва", size);
      $("#weatherResult").innerHTML = window.Weather.renderCard(data);
      toast("Показаны демонстрационные данные", "warn");
    },

    /* ---------------- ИИ-анализ на лендинге ---------------- */
    "ai.analyze": async () => {
      const res = $("#aiResult");
      aiLoading();
      try {
        const result = currentFile ? await window.AI.analyzeFile(currentFile) : await window.AI.analyzeSample("coat");
        renderAi(result);
        toast(result.source === "openrouter" ? "Готово: анализ vision-модели" : "Готово: локальный анализ фото", "ai");
      } catch (err) {
        const message = (err && err.message) || "Что-то пошло не так. Попробуйте позже.";
        res.innerHTML = `<div class="advice danger"><div><div>${esc(message)}</div><small>Попробуйте другое фото или демо-снимок.</small></div></div>`;
        toast(message, "error");
      }
    },
    "ai.sample": async (ds) => {
      const kind = ds.kind || "coat";
      try {
        const dataUrl = window.AI.sample(kind);
        currentFile = null;
        setPreview(dataUrl, "демо-снимок: " + kind);
        aiLoading();
        const result = await window.AI.analyzeDataUrl(dataUrl);
        renderAi(result);
        toast("Готово: анализ демо-снимка", "ai");
      } catch (err) {
        toast((err && err.message) || "Не удалось проанализировать демо-снимок", "error");
      }
    },
    "ai.reset": () => resetPhoto(),
    /* демо-снимок прямо в разделе «Здоровье → ИИ-фото»:
       генерируем картинку, подставляем её в настоящее поле загрузки и запускаем анализ */
    "health.demoShot": async (ds) => {
      const kind = (ds && ds.kind) || "skin";
      const input = $("#healthPhotoInput");
      if (!input) { toast("Откройте раздел «Здоровье → ИИ-фото»", "warn"); return; }
      try {
        const dataUrl = window.AI.sample(kind);
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], "petlife-demo-" + kind + ".jpg", { type: "image/jpeg" });
        const dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;
        input.dispatchEvent(new Event("change", { bubbles: true }));
        toast("Демо-снимок загружен — анализируем 🤖", "info");
        setTimeout(() => {
          const btn = document.querySelector('[data-act="health.photoAnalyze"]');
          if (btn && !btn.disabled) btn.click();
        }, 400);
      } catch (err) {
        toast("Не удалось подготовить демо-снимок. Загрузите своё фото.", "error");
      }
    },
    "ai.saveSymptom": () => {
      const text = (window.Store.state.lastAiResult || "").slice(0, 400);
      if (!text) { toast("Сначала выполните анализ фото", "warn"); return; }
      const pet = window.Store.pet();
      window.Store.push("symptoms", {
        id: window.Store.uid("s"), date: fmt.today(), type: "ИИ-анализ", severity: 2,
        note: "Анализ фото: " + text.replace(/\n/g, " ")
      }, pet.id);
      toast("Сохранено в дневник симптомов " + pet.name, "ok");
    }
  });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
