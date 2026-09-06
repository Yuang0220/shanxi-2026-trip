(() => {
  const API='https://api.open-meteo.com/v1/forecast';
  const TZ='Asia/Shanghai';
  const locations={
    datong:[40.07373,113.28356], hunyuan:[39.69825,113.69099], xinzhou:[38.4392,112.7175],
    taiyuan:[37.87,112.5437], pingyao:[37.20169,112.17973], xixian:[36.6937,110.931],
    hukou:[36.1344,110.4488], ruicheng:[34.6967,110.6889], yuncheng:[35.0276,111.0021]
  };
  const days=[
    ['2026-09-26','datong'],['2026-09-27','datong'],['2026-09-28','hunyuan'],['2026-09-29','xinzhou'],['2026-09-30','taiyuan'],
    ['2026-10-01','pingyao'],['2026-10-02','xixian'],['2026-10-03','hukou'],['2026-10-04','ruicheng'],['2026-10-05','yuncheng']
  ];
  const WMO={0:'晴',1:'大部晴朗',2:'多云',3:'阴',45:'雾',48:'雾',51:'毛毛雨',53:'毛毛雨',55:'毛毛雨',61:'小雨',63:'中雨',65:'大雨',71:'小雪',73:'中雪',75:'大雪',80:'阵雨',81:'阵雨',82:'强阵雨',95:'雷雨',96:'雷雨伴冰雹',99:'雷雨伴冰雹'};
  const keys=Object.keys(locations);
  function rows(){
    const grid=document.querySelector('#weather .weather-grid'); if(!grid) return [];
    const cells=[...grid.children].slice(4); const result=[];
    for(let i=0;i<cells.length;i+=4) result.push(cells.slice(i,i+4));
    return result;
  }
  async function run(){
    const qs=new URLSearchParams({
      latitude:keys.map(k=>locations[k][0]).join(','), longitude:keys.map(k=>locations[k][1]).join(','),
      daily:'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max',
      timezone:TZ, forecast_days:'16', wind_speed_unit:'kmh'
    });
    try{
      const r=await fetch(`${API}?${qs}`); if(!r.ok) return; const data=await r.json(); const arr=Array.isArray(data)?data:[data];
      const byKey={}; keys.forEach((k,idx)=>{const d=arr[idx]?.daily;if(!d)return;byKey[k]={};d.time.forEach((date,i)=>byKey[k][date]={code:d.weather_code[i],max:d.temperature_2m_max[i],min:d.temperature_2m_min[i],p:d.precipitation_probability_max[i],w:d.wind_speed_10m_max[i]});});
      let changed=false; const rs=rows();
      days.forEach(([date,key],i)=>{const f=byKey[key]?.[date]; if(!f||!rs[i]) return; const [,wx,temp,pw]=rs[i]; wx.textContent=WMO[Math.round(f.code)]||'逐日预报'; wx.classList.remove('muted'); temp.textContent=`${Math.round(f.min)}–${Math.round(f.max)}℃`; pw.textContent=`降水 ${Math.round(f.p ?? 0)}% · 风 ${Math.round(f.w ?? 0)} km/h`; pw.classList.remove('muted'); changed=true;});
      if(changed){const u=document.querySelector('#weather .updated'); if(u){const now=new Date();u.textContent=`实时更新 ${now.toLocaleString('zh-CN',{timeZone:TZ,month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false})}`;}}
    }catch(e){}
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',run,{once:true}); else run();
})();