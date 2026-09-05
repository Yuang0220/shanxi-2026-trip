(() => {
  "use strict";

  const API_URL = "https://api.open-meteo.com/v1/forecast";
  const CACHE_KEY = "shanxi-trip-weather-v2";
  const CACHE_VERSION = "weather-v2";
  const CACHE_TTL = 60 * 60 * 1000;
  const TIME_ZONE = "Asia/Shanghai";
  const REQUEST_TIMEOUT = 10000;

  const LOCATIONS = {
    datong:{latitude:40.07373,longitude:113.28356}, hunyuan:{latitude:39.69825,longitude:113.69099},
    xinzhou:{latitude:38.4392,longitude:112.7175}, taiyuan:{latitude:37.87,longitude:112.5437},
    pingyao:{latitude:37.20169,longitude:112.17973}, xixian:{latitude:36.6937,longitude:110.931},
    hukou:{latitude:36.1344,longitude:110.4488}, ruicheng:{latitude:34.6967,longitude:110.6889},
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
  const WMO={0:"晴",1:"大部晴朗",2:"多云",3:"阴",45:"雾",48:"雾",51:"毛毛雨",53:"毛毛雨",55:"毛毛雨",56:"冻毛毛雨",57:"冻毛毛雨",61:"小雨",63:"中雨",65:"大雨",66:"冻雨",67:"冻雨",71:"小雪",73:"中雪",75:"大雪",77:"雪粒",80:"阵雨",81:"阵雨",82:"阵雨",85:"阵雪",86:"阵雪",95:"雷雨",96:"雷雨伴冰雹",99:"雷雨伴冰雹"};
  const KEYS=Object.keys(LOCATIONS);
  const num=v=>Number.isFinite(Number(v))?Number(v):null;
  const weatherText=c=>WMO[Math.round(num(c))]||"天气待确认";

  function buildUrl(){const p=new URLSearchParams({latitude:KEYS.map(k=>LOCATIONS[k].latitude).join(","),longitude:KEYS.map(k=>LOCATIONS[k].longitude).join(","),daily:"weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max",timezone:TIME_ZONE,forecast_days:"16",wind_speed_unit:"kmh"});return `${API_URL}?${p}`;}
  function daily(d){if(!d||!Array.isArray(d.time))throw Error("invalid forecast");return d.time.reduce((o,date,i)=>(o[date]={code:num(d.weather_code?.[i]),max:num(d.temperature_2m_max?.[i]),min:num(d.temperature_2m_min?.[i]),precipitation:num(d.precipitation_probability_max?.[i]),wind:num(d.wind_speed_10m_max?.[i])},o),{});}
  function normalize(p){const r=Array.isArray(p)?p:[p];if(r.length!==KEYS.length)throw Error("location mismatch");return KEYS.reduce((o,k,i)=>(o[k]=daily(r[i]?.daily),o),{});}
  async function fetchWeather(){const c=new AbortController(),t=setTimeout(()=>c.abort(),REQUEST_TIMEOUT);try{const r=await fetch(buildUrl(),{signal:c.signal});if(!r.ok)throw Error("forecast failed");return normalize(await r.json());}finally{clearTimeout(t)}}
  function readCache(){try{const x=JSON.parse(localStorage.getItem(CACHE_KEY)||"null"),f=num(x?.fetchedAt);return x?.version===CACHE_VERSION&&f!==null&&x.weather?{fetchedAt:f,weather:x.weather}:null}catch{return null}}
  function writeCache(weather,fetchedAt){try{localStorage.setItem(CACHE_KEY,JSON.stringify({version:CACHE_VERSION,fetchedAt,weather}))}catch{}}
  function updatedAt(ts){const ps=new Intl.DateTimeFormat("zh-CN",{timeZone:TIME_ZONE,month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit",hour12:false}).formatToParts(new Date(ts));const v=t=>ps.find(p=>p.type===t)?.value||"";return `更新于 ${v("month")}月${v("day")}日 ${v("hour")}:${v("minute")}`}
  function dateLabel(d){const[,m,day]=d.split("-");return `${+m}/${+day}`}
  function add(p,c,t){const e=document.createElement("span");e.className=c;e.textContent=t;p.append(e);return e}
  function render(root,weather,ts,status){const list=root.querySelector("[data-trip-weather-list]"),up=root.querySelector("[data-trip-weather-updated]"),st=root.querySelector("[data-trip-weather-status]");if(!list||!up||!st)return;list.replaceChildren();TRIP_DAYS.forEach(day=>{const d=weather?.[day.location]?.[day.date]||null,row=document.createElement("div");row.className="trip-weather-row"+(d?"":" is-reference");row.setAttribute("role","listitem");const pr=document.createElement("div");pr.className="trip-weather-primary";add(pr,"trip-weather-date",dateLabel(day.date));add(pr,"trip-weather-separator","·");add(pr,"trip-weather-place",day.place);row.append(pr);add(row,"trip-weather-condition",d?weatherText(d.code):"远期参考");const mn=d?num(d.min):day.fallback[0],mx=d?num(d.max):day.fallback[1];add(row,"trip-weather-temperature",`${Math.round(Math.min(mn,mx))}–${Math.round(Math.max(mn,mx))}℃`);const meta=document.createElement("div");meta.className="trip-weather-meta";add(meta,"trip-weather-precipitation",d&&num(d.precipitation)!==null?`降水 ${Math.round(d.precipitation)}%`:"—");add(meta,"trip-weather-wind",d&&num(d.wind)!==null?`风 ${Math.round(d.wind)} km/h`:"—");row.append(meta);list.append(row)});up.textContent=ts?updatedAt(ts):"";st.textContent=status||""}

  const replacements=new Map([
    ["02｜天气与装备","02｜天气与体感"],["区域体感与装备","区域体感"],
    ["03｜逐日执行手册","03｜逐日执行手册"],
    ["动态风险矩阵","每日节奏"],["执行总原则：","行程安排："],["第一机动项","优先删减"],
    ["古城只散步，不“清单化”","古城只散步"],["不夜游","到店后休息"],["不加大型景点","只休息和会合"],
    ["全程最容易超负荷的一天","行程最满的一天"],["最容易超负荷","行程最满"],
    ["洪洞大槐树是Bonus，不是KPI。","洪洞大槐树放在最后，时间不够就取消。"],
    ["全程最需要纪律的一天｜约291km表内里程","这一天路程和步行都比较多｜约291km表内里程"],
    ["全程最高负荷","行程最满"],["高负荷日","行程较满"],["高客流日","客流较大"],
    ["机动调整","时间不够时"],["可调整项","备选"],
    ["路线整体由北向南，空间顺序合理。核心景点优先，国庆期间通过机动项吸收交通和排队波动。","路线从大同一路向南到运城，整体顺路。国庆期间给拥堵、排队和停车留出余量，重点景点按原计划走。"],
    ["路线空间合理度","自驾安排"],
    ["核心景点优先；遇拥堵、降雨或状态下降时，取消机动项。","先保留重点景点；遇到拥堵、下雨或当天状态一般时，再按顺序删减。"],
    ["路线从大同向南至运城，固定酒店不变。9/26与9/30以转场和会合为主，10/1-10/4自驾。10/2、10/3预留更多交通缓冲。","路线从大同一路向南到运城，酒店按现有订单不变。9/26和9/30以转场、会合为主，10/1–10/4自驾；10/2、10/3多留一些路上时间。"],
    ["9月下旬至10月初昼夜温差明显；出发前7-10天更新逐日天气。","9月下旬到10月初昼夜温差较大，逐日天气会自动更新。"],
    ["穿衣出片：","穿衣："],["壶口黑科技：","壶口："],
    ["房型必须再确认：","房型再确认："],["必须先锁的预约","提前确认的预约"],
    ["手机里只记住这 8 条","行程重点"]
  ]);
  function replaceText(){const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);const nodes=[];while(w.nextNode())nodes.push(w.currentNode);nodes.forEach(n=>{let s=n.nodeValue;for(const[a,b]of replacements)s=s.split(a).join(b);n.nodeValue=s});}
  function removePhotography(){document.querySelector("section#photo")?.remove();document.querySelectorAll(".photo-tip").forEach(e=>e.remove());document.querySelectorAll(".check").forEach(e=>{if(/^摄影/.test(e.textContent.trim()))e.remove()});const phrases=["出片位：","木塔拍摄：","平遥拍照：","穿衣出片：","壶口黑科技："];document.querySelectorAll(".callout").forEach(e=>{if(phrases.some(p=>e.textContent.includes(p)))e.remove()});document.querySelectorAll("p,li,div,span").forEach(e=>{if(e.children.length)return;let t=e.textContent.trim();if(/镜头布|三脚架|Live Photo|连拍|低机位|构图|拍照|摄影|机位/.test(t)&&e.closest("figure")==null){if(t.length<100)e.remove()}});}
  function polishCaptions(){const m={"应县木塔":"木塔层檐与斗拱层次清晰，普通游客目前只参观一层。","悬空寺":"寺院依崖而建，山体与建筑关系很直观。","华严寺":"院落、木构和塔体层次丰富。","晋祠":"建筑、彩塑、水系、古树和碑刻都值得慢慢看。","平遥古城":"灰瓦院落与街巷层次丰富，傍晚适合慢慢逛。","壶口瀑布":"黄河在峡谷间跌落，水势和声量都很强。","永乐宫":"核心是元代壁画，建筑本身也值得细看。","解州关帝庙":"中轴建筑、牌坊与琉璃屋顶层次丰富。","山西面食":"刀削面等面食可按当天行程和口味就近选择。"};document.querySelectorAll("figcaption").forEach(c=>{const b=c.querySelector("b"),s=c.querySelector("span");if(b&&s&&m[b.textContent.trim()])s.textContent=m[b.textContent.trim()]});}
  function removeDisclaimers(){document.querySelectorAll("p,.cover-meta,.fine,footer").forEach(e=>{const t=e.textContent;if(t.includes("整理日期：2026-09-04")||t.includes("本文按截至")||t.includes("给奶奶留出休息余量"))e.remove()});}
  function renumber(){const map={"07｜驾驶与体力管理":"06｜驾驶与休息","08｜随车与随身清单":"07｜随车与随身","09｜临行前动态终审：只更新会改变决策的信息":"08｜临行前核对","10｜信息源与可靠性说明":"09｜信息来源"};document.querySelectorAll("h2").forEach(h=>{const t=h.textContent.trim();if(map[t])h.textContent=map[t]});}
  function style(){const s=document.createElement("style");s.textContent=`
    .date,.big-note,.overview-balance .fact strong{font-family:"Microsoft YaHei","PingFang SC","Noto Sans CJK SC",Arial,sans-serif!important;font-variant-numeric:tabular-nums}
    .overview-balance{grid-template-columns:repeat(4,minmax(0,1fr))!important;align-items:stretch!important}.overview-actions,.facts{display:contents!important}.overview-action,.overview-balance .fact{min-width:0!important;min-height:118px!important;height:100%!important;padding:14px 16px!important}
    .day{border-radius:8px!important;box-shadow:0 2px 10px rgba(50,40,25,.035)!important}.photo{border:0!important;border-radius:8px!important;background:transparent!important;min-height:0!important}.photo img,.photo.wide img{height:auto!important;max-height:560px!important;object-fit:contain!important;background:#f2eee7!important}.photo figcaption{background:transparent!important;padding:8px 2px 2px!important}.callout{border-radius:0 7px 7px 0!important}.trip-weather{border-radius:8px!important}
    @media(max-width:760px){.overview-balance{grid-template-columns:repeat(2,minmax(0,1fr))!important}.overview-action,.overview-balance .fact{min-height:100px!important}.photo img,.photo.wide img{max-height:none!important}.day{border-radius:6px!important}}
  `;document.head.append(s)}
  function polish(){removePhotography();removeDisclaimers();replaceText();polishCaptions();renumber();style();const facts=[...document.querySelectorAll(".fact")];facts.forEach(f=>{const b=f.querySelector("strong"),sm=f.querySelector("small");if(b?.textContent.trim()==="9/10"){b.textContent="4天";if(sm)sm.textContent="10/1–10/4 自驾"}});}

  async function init(){polish();const root=document.querySelector("[data-trip-weather]");if(!root)return;const cached=readCache(),fresh=cached&&Date.now()-cached.fetchedAt<CACHE_TTL;render(root,cached?.weather||null,cached?.fetchedAt||null,fresh?"":"正在更新天气…");if(fresh)return;try{const weather=await fetchWeather(),ts=Date.now();writeCache(weather,ts);render(root,weather,ts,"")}catch{render(root,cached?.weather||null,cached?.fetchedAt||null,cached?"天气更新暂时失败，显示最近一次数据":"天气更新暂时失败")}}
  window.TripWeather={LOCATIONS,TRIP_DAYS,CACHE_KEY,CACHE_TTL,init};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();
