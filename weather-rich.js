(() => {
  "use strict";

  const API_URL = "https://api.open-meteo.com/v1/forecast";
  const CACHE_KEY = "shanxi-trip-weather-v2";
  const CACHE_VERSION = "weather-v2";
  const CACHE_TTL = 60 * 60 * 1000;
  const TIME_ZONE = "Asia/Shanghai";
  const REQUEST_TIMEOUT = 10000;

  const LOCATIONS = {
    datong:{latitude:40.07373,longitude:113.28356},
    hunyuan:{latitude:39.69825,longitude:113.69099},
    xinzhou:{latitude:38.4392,longitude:112.7175},
    taiyuan:{latitude:37.87,longitude:112.5437},
    pingyao:{latitude:37.20169,longitude:112.17973},
    xixian:{latitude:36.6937,longitude:110.931},
    hukou:{latitude:36.1344,longitude:110.4488},
    ruicheng:{latitude:34.6967,longitude:110.6889},
    yuncheng:{latitude:35.0276,longitude:111.0021}
  };

  const TRIP_DAYS = [
    {date:"2026-09-26",place:"大同",location:"datong",fallback:[4,16]},
    {date:"2026-09-27",place:"大同",location:"datong",fallback:[5,16]},
    {date:"2026-09-28",place:"应县 / 浑源",location:"hunyuan",fallback:[9,21]},
    {date:"2026-09-29",place:"大同 → 忻州",location:"xinzhou",fallback:[9,19]},
    {date:"2026-09-30",place:"忻州 → 太原",location:"taiyuan",fallback:[9,21]},
    {date:"2026-10-01",place:"太原 → 平遥",location:"pingyao",fallback:[9,23]},
    {date:"2026-10-02",place:"平遥 → 洪洞 → 隰县",location:"xixian",fallback:[7,25]},
    {date:"2026-10-03",place:"隰县 → 壶口 → 万荣",location:"hukou",fallback:[7,19]},
    {date:"2026-10-04",place:"万荣 → 芮城 → 运城",location:"ruicheng",fallback:[13,22]},
    {date:"2026-10-05",place:"运城",location:"yuncheng",fallback:[10,23]}
  ];

  const WMO = {0:"晴",1:"大部晴朗",2:"多云",3:"阴",45:"雾",48:"雾",51:"毛毛雨",53:"毛毛雨",55:"毛毛雨",56:"冻毛毛雨",57:"冻毛毛雨",61:"小雨",63:"中雨",65:"大雨",66:"冻雨",67:"冻雨",71:"小雪",73:"中雪",75:"大雪",77:"雪粒",80:"阵雨",81:"阵雨",82:"阵雨",85:"阵雪",86:"阵雪",95:"雷雨",96:"雷雨伴冰雹",99:"雷雨伴冰雹"};
  const KEYS = Object.keys(LOCATIONS);
  const number = value => Number.isFinite(Number(value)) ? Number(value) : null;

  function buildUrl() {
    const params = new URLSearchParams({
      latitude: KEYS.map(key => LOCATIONS[key].latitude).join(","),
      longitude: KEYS.map(key => LOCATIONS[key].longitude).join(","),
      daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max",
      timezone: TIME_ZONE,
      forecast_days: "16",
      wind_speed_unit: "kmh"
    });
    return `${API_URL}?${params}`;
  }

  function normalizeDaily(daily) {
    if (!daily || !Array.isArray(daily.time)) throw new Error("invalid forecast");
    return daily.time.reduce((result, date, index) => {
      result[date] = {
        code: number(daily.weather_code?.[index]),
        max: number(daily.temperature_2m_max?.[index]),
        min: number(daily.temperature_2m_min?.[index]),
        precipitation: number(daily.precipitation_probability_max?.[index]),
        wind: number(daily.wind_speed_10m_max?.[index])
      };
      return result;
    }, {});
  }

  function normalize(payload) {
    const rows = Array.isArray(payload) ? payload : [payload];
    if (rows.length !== KEYS.length) throw new Error("location mismatch");
    return KEYS.reduce((result, key, index) => {
      result[key] = normalizeDaily(rows[index]?.daily);
      return result;
    }, {});
  }

  async function fetchWeather() {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
    try {
      const response = await fetch(buildUrl(), {signal: controller.signal});
      if (!response.ok) throw new Error("forecast failed");
      return normalize(await response.json());
    } finally {
      clearTimeout(timeout);
    }
  }

  function readCache() {
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
      const fetchedAt = number(cached?.fetchedAt);
      return cached?.version === CACHE_VERSION && fetchedAt !== null && cached.weather
        ? {fetchedAt, weather: cached.weather}
        : null;
    } catch {
      return null;
    }
  }

  function writeCache(weather, fetchedAt) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({version:CACHE_VERSION,fetchedAt,weather}));
    } catch {}
  }

  function updatedAt(timestamp) {
    const parts = new Intl.DateTimeFormat("zh-CN", {
      timeZone: TIME_ZONE, month:"numeric", day:"numeric", hour:"2-digit", minute:"2-digit", hour12:false
    }).formatToParts(new Date(timestamp));
    const get = type => parts.find(part => part.type === type)?.value || "";
    return `更新于 ${get("month")}月${get("day")}日 ${get("hour")}:${get("minute")}`;
  }

  function dateLabel(date) {
    const [, month, day] = date.split("-");
    return `${Number(month)}/${Number(day)}`;
  }

  function add(parent, className, text) {
    const element = document.createElement("span");
    element.className = className;
    element.textContent = text;
    parent.append(element);
  }

  function render(root, weather, timestamp, status) {
    const list = root.querySelector("[data-trip-weather-list]");
    const updated = root.querySelector("[data-trip-weather-updated]");
    const state = root.querySelector("[data-trip-weather-status]");
    if (!list || !updated || !state) return;

    list.replaceChildren();
    TRIP_DAYS.forEach(day => {
      const forecast = weather?.[day.location]?.[day.date] || null;
      const row = document.createElement("div");
      row.className = `trip-weather-row${forecast ? "" : " is-reference"}`;
      row.setAttribute("role", "listitem");

      const primary = document.createElement("div");
      primary.className = "trip-weather-primary";
      add(primary, "trip-weather-date", dateLabel(day.date));
      add(primary, "trip-weather-separator", "·");
      add(primary, "trip-weather-place", day.place);
      row.append(primary);

      const condition = forecast && WMO[Math.round(number(forecast.code))]
        ? WMO[Math.round(number(forecast.code))]
        : "远期参考";
      add(row, "trip-weather-condition", condition);

      const min = forecast && number(forecast.min) !== null ? number(forecast.min) : day.fallback[0];
      const max = forecast && number(forecast.max) !== null ? number(forecast.max) : day.fallback[1];
      add(row, "trip-weather-temperature", `${Math.round(Math.min(min,max))}–${Math.round(Math.max(min,max))}℃`);

      const meta = document.createElement("div");
      meta.className = "trip-weather-meta";
      add(meta, "trip-weather-precipitation", forecast && number(forecast.precipitation) !== null ? `降水 ${Math.round(forecast.precipitation)}%` : "—");
      add(meta, "trip-weather-wind", forecast && number(forecast.wind) !== null ? `风 ${Math.round(forecast.wind)} km/h` : "—");
      row.append(meta);
      list.append(row);
    });

    updated.textContent = timestamp ? updatedAt(timestamp) : "";
    state.textContent = status || "";
  }

  async function init() {
    const roots = [...document.querySelectorAll("[data-trip-weather]")];
    if (!roots.length) return;

    const cached = readCache();
    const now = Date.now();
    if (cached) roots.forEach(root => render(root, cached.weather, cached.fetchedAt, ""));
    else roots.forEach(root => render(root, null, null, ""));

    if (cached && now - cached.fetchedAt < CACHE_TTL) return;

    try {
      const weather = await fetchWeather();
      const fetchedAt = Date.now();
      writeCache(weather, fetchedAt);
      roots.forEach(root => render(root, weather, fetchedAt, ""));
    } catch {
      if (cached) roots.forEach(root => render(root, cached.weather, cached.fetchedAt, "使用最近一次数据"));
      else roots.forEach(root => render(root, null, null, "天气暂时无法加载"));
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, {once:true});
  else init();
})();
