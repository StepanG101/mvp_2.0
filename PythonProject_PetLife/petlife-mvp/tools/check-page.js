/* PetLife — tools/check-page.js : проверяет, что сервер отдаёт все блоки лендинга */
"use strict";
const http = require("http");
const NEEDLES = [
  // экосистема открывается сразу
  "id=\"hub\"", "hubRoot", "app-container", "id=\"landing\"", "class=\"hidden\"",
  "data-act=\"hub.open\" data-panel=\"overview\"", "data-act=\"app.landing\"",
  // презентация (внутри скрытого блока)
  "Заботься о питомце", "Что умеет PetLife", "Как это работает", "Попробуйте прямо сейчас",
  "Мы не просто приложение", "Получите ранний доступ", "missionCounter",
  "featureMarquee", "cityInput", "photoInput", "leadForm", "© 2026 PetLife", "data-act=\"weather.check\""
];
const PORT = process.env.PETLIFE_PORT || 8765;
http.get({ host: "127.0.0.1", port: PORT, path: "/" }, (res) => {
  let body = "";
  res.setEncoding("utf8");
  res.on("data", (chunk) => { body += chunk; });
  res.on("end", () => {
    console.log("HTTP " + res.statusCode + ", " + body.length + " символов");
    let bad = 0;
    NEEDLES.forEach((n) => {
      const ok = body.includes(n);
      if (!ok) bad++;
      console.log((ok ? "  ✔ " : "  ✗ ") + n);
    });
    process.exit(bad ? 1 : 0);
  });
}).on("error", (err) => { console.error("Сервер недоступен: " + err.message); process.exit(1); });
