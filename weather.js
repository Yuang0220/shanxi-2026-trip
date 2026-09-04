(() => {
  "use strict";

  const API_URL = "https://api.open-meteo.com/v1/forecast";
  const CACHE_KEY = "shanxi-trip-weather-v1";
  const CACHE_VERSION = "weather-v1";
  const CACHE_TTL = 60 * 60 * 1000;
  const TIME_ZONE = "Asia/Shanghai";
  const REQUEST_TIMEOUT = 10000;

  const LOCATIONS = {
    datong: { name: "大同", latitude: 40.07373, longitude: 113.28356 },
    hunyuan: { name: "浑源", latitude: 39.69825, longitude: 113.69099 },
    xinzhou: { name: "忻州", latitude: 38.4392, longitude: 112.7175 },
    taiyuan: { name: "太原", latitude: 37.87, longitude: 112.5437 },
    pingyao: { name: "平遥", latitude: 37.20169, longitude: 112.17973 },
    xixian: { name: "隰县", latitude: 36.6937, longitude: 110.931 },
    hukou: { name: "吉县 / 壶口附近", latitude: 36.1344, longitude: 110.4488 },
    ruicheng: { name: "芮城", latitude: 34.6967, longitude: 110.6889 },
    yuncheng: { name: "运城", latitude: 35.0276, longitude: 111.0021 }
  };

  const TRIP_DAYS = [
    { date: "2026-09-26", place: "大同", location: "datong" },
    { date: "2026-09-27", place: "大同", location: "datong" },
    { date: "2026-09-28", place: "应县 / 浑源", location: "hunyuan" },
    { date: "2026-09-29", place: "大同 → 忻州", location: "xinzhou" },
    { date: "2026-09-30", place: "忻州 → 太原", location: "taiyuan" },
    { date: "2026-10-01", place: "太原 → 平遥", location: "pingyao" },
    { date: "2026-10-02", place: "平遥 → 洪洞 → 隰县", location: "xixian" },
    { date: "2026-10-03", place: "隰县 → 壶口 → 万荣", location: "hukou" },
    { date: "2026-10-04", place: "万荣 → 芮城 → 运城", location: "ruicheng" },
    { date: "2026-10-05", place: "运城", location: "yuncheng" }
  ];

  const WMO_CODES = {
    0: "晴",
    1: "大部晴朗",
    2: "多云",
    3: "阴",
    45: "雾",
    48: "雾",
    51: "毛毛雨",
    53: "毛毛雨",
    55: "毛毛雨",
    56: "冻毛毛雨",
    57: "冻毛毛雨",
    61: "小雨",
    63: "中雨",
    65: "大雨",
    66: "冻雨",
    67: "冻雨",
    71: "小雪",
    73: "中雪",
    75: "大雪",
    77: "雪粒",
    80: "阵雨",
    81: "阵雨",
    82: "阵雨",
    85: "阵雪",
    86: "阵雪",
    95: "雷雨",
    96: "雷雨伴冰雹",
    99: "雷雨伴冰雹"
  };

  const LOCATION_KEYS = Object.keys(LOCATIONS);

  function finiteNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function weatherCodeToText(code) {
    const number = finiteNumber(code);
    return number !== null && WMO_CODES[Math.round(number)] ? WMO_CODES[Math.round(number)] : "天气待确认";
  }

  function buildForecastUrl() {
    const params = new URLSearchParams({
      latitude: LOCATION_KEYS.map((key) => LOCATIONS[key].latitude).join(","),
      longitude: LOCATION_KEYS.map((key) => LOCATIONS[key].longitude).join(","),
      daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max",
      timezone: TIME_ZONE,
      forecast_days: "16",
      wind_speed_unit: "kmh"
    });
    return `${API_URL}?${params.toString()}`;
  }

  function normalizeDaily(daily) {
    if (!daily || !Array.isArray(daily.time) || daily.time.length === 0) {
      throw new Error("Invalid daily forecast");
    }
    const fields = [
      "weather_code",
      "temperature_2m_max",
      "temperature_2m_min",
      "precipitation_probability_max",
      "wind_speed_10m_max"
    ];
    return daily.time.reduce((result, date, index) => {
      if (typeof date !== "string") return result;
      result[date] = {
        code: finiteNumber(daily.weather_code?.[index]),
        max: finiteNumber(daily.temperature_2m_max?.[index]),
        min: finiteNumber(daily.temperature_2m_min?.[index]),
        precipitation: finiteNumber(daily.precipitation_probability_max?.[index]),
        wind: finiteNumber(daily.wind_speed_10m_max?.[index])
      };
      if (fields.some((field) => !Array.isArray(daily[field]))) {
        throw new Error("Incomplete daily forecast");
      }
      return result;
    }, {});
  }

  function normalizePayload(payload) {
    const responses = Array.isArray(payload) ? payload : [payload];
    if (responses.length !== LOCATION_KEYS.length) throw new Error("Unexpected forecast locations");
    return LOCATION_KEYS.reduce((result, key, index) => {
      result[key] = normalizeDaily(responses[index]?.daily);
      return result;
    }, {});
  }

  async function fetchForecast() {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
    try {
      const response = await window.fetch(buildForecastUrl(), { signal: controller.signal });
      if (!response.ok) throw new Error("Forecast request failed");
      return normalizePayload(await response.json());
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  function readCache() {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(CACHE_KEY) || "null");
      const fetchedAt = finiteNumber(parsed?.fetchedAt);
      if (parsed?.version !== CACHE_VERSION || fetchedAt === null || !Number.isFinite(new Date(fetchedAt).getTime()) || !parsed.weather) return null;
      return { fetchedAt, weather: parsed.weather };
    } catch {
      return null;
    }
  }

  function writeCache(weather, fetchedAt) {
    try {
      window.localStorage.setItem(CACHE_KEY, JSON.stringify({
        version: CACHE_VERSION,
        fetchedAt,
        weather
      }));
    } catch {
      // Storage can be unavailable in private or restricted browser contexts.
    }
  }

  function formatUpdatedAt(timestamp) {
    const parts = new Intl.DateTimeFormat("zh-CN", {
      timeZone: TIME_ZONE,
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      hourCycle: "h23"
    }).formatToParts(new Date(timestamp));
    const value = (type) => parts.find((part) => part.type === type)?.value || "";
    return `更新于 ${value("month")}月${value("day")}日 ${value("hour")}:${value("minute")}`;
  }

  function formatDate(date) {
    const [, month, day] = date.split("-");
    return `${Number(month)}/${Number(day)}`;
  }

  function formatTemperature(data) {
    const min = finiteNumber(data?.min);
    const max = finiteNumber(data?.max);
    if (min === null || max === null) return "—";
    return `${Math.round(Math.min(min, max))}–${Math.round(Math.max(min, max))}℃`;
  }

  function formatPercent(data) {
    const precipitation = finiteNumber(data?.precipitation);
    return precipitation === null ? "—" : `降水 ${Math.round(precipitation)}%`;
  }

  function formatWind(data) {
    const wind = finiteNumber(data?.wind);
    return wind === null ? "—" : `风 ${Math.round(wind)} km/h`;
  }

  function addText(parent, className, text) {
    const element = document.createElement("span");
    element.className = className;
    element.textContent = text;
    parent.appendChild(element);
    return element;
  }

  function render(root, weather, fetchedAt, status, loading) {
    const list = root.querySelector("[data-trip-weather-list]");
    const updated = root.querySelector("[data-trip-weather-updated]");
    const statusElement = root.querySelector("[data-trip-weather-status]");
    if (!list || !updated || !statusElement) return;

    list.replaceChildren();
    TRIP_DAYS.forEach((day) => {
      const data = weather?.[day.location]?.[day.date] || null;
      const row = document.createElement("div");
      row.className = "trip-weather-row";
      row.setAttribute("role", "listitem");
      const primary = document.createElement("div");
      primary.className = "trip-weather-primary";
      addText(primary, "trip-weather-date", formatDate(day.date));
      addText(primary, "trip-weather-separator", "·");
      addText(primary, "trip-weather-place", day.place);
      row.appendChild(primary);
      addText(row, "trip-weather-condition", data ? weatherCodeToText(data.code) : weather ? "暂未进入预报范围" : loading ? "天气待确认" : "天气暂时无法加载");
      addText(row, "trip-weather-temperature", formatTemperature(data));
      const meta = document.createElement("div");
      meta.className = "trip-weather-meta";
      addText(meta, "trip-weather-precipitation", formatPercent(data));
      addText(meta, "trip-weather-wind", formatWind(data));
      row.appendChild(meta);
      list.appendChild(row);
    });

    updated.textContent = fetchedAt ? formatUpdatedAt(fetchedAt) : "";
    statusElement.textContent = status || "";
  }

  async function init() {
    const root = document.querySelector("[data-trip-weather]");
    if (!root) return;

    const cached = readCache();
    const fresh = cached && Date.now() - cached.fetchedAt < CACHE_TTL;
    render(root, cached?.weather || null, cached?.fetchedAt || null, fresh ? "" : "正在更新天气…", true);
    if (fresh) return;

    try {
      const weather = await fetchForecast();
      const fetchedAt = Date.now();
      writeCache(weather, fetchedAt);
      render(root, weather, fetchedAt, "", false);
    } catch {
      render(
        root,
        cached?.weather || null,
        cached?.fetchedAt || null,
        cached ? "天气更新暂时失败，显示最近一次数据" : "天气暂时无法加载",
        false
      );
    }
  }

  const TripWeather = {
    LOCATIONS,
    TRIP_DAYS,
    WMO_CODES,
    CACHE_KEY,
    CACHE_TTL,
    buildForecastUrl,
    weatherCodeToText,
    init
  };

  if (typeof window !== "undefined") {
    window.TripWeather = TripWeather;
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
      init();
    }
  }
})();
