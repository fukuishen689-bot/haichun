'use strict';
/* 住客簿 · 海春暖院 — 单机离线版。数据只存在本机浏览器（localStorage），定期备份。 */
const ROOMS=[['听风','1F · 两张1.5米床',4],['听潮','1F · 两张1.5米床',4],['听雨','1F · 1.8米床',2],['见山','2F · 两张1.2米床',4],['见海','2F · 1.8米床',2],['见云','2F · 2米床·浴缸',2]];
const ROOM_NAMES=ROOMS.map(r=>r[0]);
const CHANNELS=['微信直订','电话直订','老客回头','朋友介绍','到店预订','携程','美团','飞猪','抖音','其他'];
const STATUSES=['已预订','已入住','已退房','已取消','待确认'];
const ACTIVE=['已预订','已入住','已退房'];
const PICKUPS=['待确认','需接船','已安排','已接到','无需接船'];
const TICKETS=['待确认','未购票','已购票','有变动','停航/取消'];
const GUEST_TYPES=['未记录','情侣/夫妻','亲子家庭','朋友同行','独自出行','其他'];
const KEY='haichun.zkb.v2', OLD_KEY='haichun.bookings.v1', BKEY='haichun.zkb.lastBackup', EKEY='haichun.zkb.exp.v1';
const EXP_CATS=['食材早餐','日用品','清洁洗涤','维修五金','交通船票','快递运费','接待招待','其他'];
const EXP_PAY=['微信','支付宝','现金','其他'];
const STATUS_CLS={'已预订':'p-booked','已入住':'p-in','已退房':'p-out','已取消':'p-cancel','待确认':'p-pending'};

const $=(id)=>document.getElementById(id);
const esc=(s)=>String(s??'').replace(/[&<>"']/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad=(n)=>String(n).padStart(2,'0');
function today(){const d=new Date();return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());}
function addDays(s,n){const d=new Date(s+'T00:00:00');d.setDate(d.getDate()+n);return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());}
function days(a,b){return Math.round((Date.parse(b+'T00:00:00Z')-Date.parse(a+'T00:00:00Z'))/864e5);}
function dateOK(v){return typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v+'T00:00:00Z'));}
const WD='日一二三四五六';
function wd(s){return '周'+WD[new Date(s+'T00:00:00').getDay()];}
function cn(s){return s?Number(s.slice(5,7))+'月'+Number(s.slice(8,10))+'日':'';}
function md(s){return s?Number(s.slice(5,7))+'/'+Number(s.slice(8,10)):'';}
const cents=(v)=>v===null||v===undefined||v===''?null:Math.round(Number(v)*100);
function yuan(c){if(c===null||c===undefined)return '—';const n=c/100;return n.toLocaleString('zh-CN',{minimumFractionDigits:Number.isInteger(n)?0:2,maximumFractionDigits:2});}
function moneyIn(v){if(v===''||v===null||v===undefined)return null;const n=Number(v);if(!Number.isFinite(n)||n<0)throw new Error('金额须为非负数');return Math.round(n*100)/100;}
function newId(){return (window.crypto&&crypto.randomUUID)?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2);}
function toast(t){const el=$('toast');el.textContent=t;el.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>{el.hidden=true;},2400);}

/* ---------- 存储 ---------- */
let all=[];
function load(){
 try{const v=JSON.parse(localStorage.getItem(KEY)||'null');if(Array.isArray(v))return v;}catch(e){}
 // 迁移旧版（一条可含多间房）
 try{const old=JSON.parse(localStorage.getItem(OLD_KEY)||'[]');if(Array.isArray(old)&&old.length){const out=[];
  old.forEach((b)=>{const rooms=b.rooms&&b.rooms.length?b.rooms:['听风'];const n=rooms.length;rooms.forEach((rm,i)=>{out.push(blank({id:newId(),name:b.guest||'',phone:b.phone||'',room:rm,checkin:b.checkin,checkout:b.checkout,
   channel:({'微信':'微信直订','电话':'电话直订','老客回头':'老客回头','朋友介绍':'朋友介绍','抖音':'抖音'})[b.channel]||'其他',status:({booked:'已预订',in:'已入住',out:'已退房',cancel:'已取消'})[b.status]||'已预订',
   adults:b.people||2,nightlyRate:b.price||null,amount:b.total!=null?Math.round(b.total/n*100)/100:null,pricingMode:'total',paid:b.received!=null?Math.round(b.received/n*100)/100:null,
   group:n>1?('迁移-'+(b.id||'').slice(0,6)):'',pickup:b.pickup?'需接船':'无需接船',arrival:{date:b.checkin,time:'',port:'',ship:b.ferry||'',ticket:'待确认'},notes:b.note||'',createdAt:b.createdAt||new Date().toISOString(),updatedAt:b.updatedAt||new Date().toISOString()}));});});
  localStorage.setItem(KEY,JSON.stringify(out));return out;}}catch(e){}
 return [];
}
function persist(){try{localStorage.setItem(KEY,JSON.stringify(all));return true;}catch(e){return false;}}
function blank(over){return Object.assign({id:'',name:'',phone:'',room:'',checkin:'',checkout:'',bookingDate:today(),adults:2,children:0,channel:'微信直订',status:'已预订',
 pricingMode:'nightly',nightlyRate:null,amount:null,paid:null,refund:null,reference:'',group:'',origin:'',guestType:'未记录',
 arrival:{date:'',time:'',port:'',ship:'',ticket:'待确认'},departure:{date:'',time:'',port:'',ship:'',ticket:'待确认'},pickup:'需接船',notes:'',tasks:[],deleted:false,deletedAt:'',createdAt:'',updatedAt:''},over||{});}
const live=()=>all.filter((r)=>!r.deleted);
const isActive=(r)=>!r.deleted&&ACTIVE.includes(r.status);
function conflictOf(rec,exceptId){if(!ACTIVE.includes(rec.status)||!rec.room||!dateOK(rec.checkin)||!dateOK(rec.checkout)||rec.checkout<=rec.checkin)return null;
 return all.find((r)=>r.id!==exceptId&&isActive(r)&&r.room===rec.room&&r.checkin<rec.checkout&&rec.checkin<r.checkout)||null;}
const nightsOf=(r)=>dateOK(r.checkin)&&dateOK(r.checkout)?Math.max(0,days(r.checkin,r.checkout)):0;
function netPaid(r){return (cents(r.paid)||0)-(cents(r.refund)||0);}
function owe(r){if(r.amount===null||r.amount===undefined||r.status==='已取消')return null;return cents(r.amount)-netPaid(r);}
function save(rec){const i=all.findIndex((r)=>r.id===rec.id);if(i>=0)all[i]=rec;else all.push(rec);if(!persist()){throw new Error('手机存储空间不足，没能保存。先备份并清理回收站。');}}

/* ---------- 花费小记 ---------- */
let exps=[];
function loadExp(){try{const v=JSON.parse(localStorage.getItem(EKEY)||'[]');return Array.isArray(v)?v:[];}catch(e){return [];}}
function persistExp(){try{localStorage.setItem(EKEY,JSON.stringify(exps));return true;}catch(e){return false;}}
const liveExp=()=>exps.filter((x)=>!x.deleted);
function expSum(list){return list.reduce((a,x)=>a+(cents(x.amount)||0),0);}
let expDel='';

/* ---------- 路由 ---------- */
let tab='today', dayView=today(), calStart=today(), statMonth=today().slice(0,7);
const filt={q:'',status:'',channel:'',month:''};
function setTab(t){tab=t;document.querySelectorAll('#tabs button').forEach((b)=>{if(b.dataset.tab===t)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
 try{history.replaceState(null,'','#'+t);}catch(e){}render();window.scrollTo(0,0);}
document.querySelectorAll('#tabs button').forEach((b)=>b.addEventListener('click',()=>setTab(b.dataset.tab)));
$('newBtn').addEventListener('click',()=>openEditor(null));

function render(){const v=$('view');
 if(tab==='today')v.innerHTML=viewToday();
 else if(tab==='ledger')v.innerHTML=viewLedger();
 else if(tab==='calendar')v.innerHTML=viewCalendar();
 else if(tab==='stats')v.innerHTML=viewStats();
 else v.innerHTML=viewBackup();
 bindView();}

/* ---------- 今日安排 ---------- */
function rowHTML(r,right){const n=nightsOf(r);return `<button type="button" class="row" data-open="${esc(r.id)}"><div class="main"><div class="t">${esc(r.name)}<small>${esc(r.room)} · ${md(r.checkin)}–${md(r.checkout)} · ${n} 晚</small></div>
 <div class="m">${esc(r.channel)}${r.phone?' · '+esc(r.phone):''}${r.pickup==='需接船'||r.pickup==='已安排'?' · <span class="pill p-warn">'+esc(r.pickup)+'</span>':''}</div></div>
 <div class="r">${right||`<span class="pill ${STATUS_CLS[r.status]}">${esc(r.status)}</span>`}</div></button>`;}
function nextOf(r){return live().find((x)=>x.id!==r.id&&ACTIVE.includes(x.status)&&x.room===r.room&&x.checkin===r.checkout)||null;}
function nextHTML(r,d){const n=nextOf(r);if(!n)return '';const l=n.arrival&&n.arrival.date===n.checkin?n.arrival:null;
 const when=n.checkin===d?'本日':cn(n.checkin);
 return `<div class="next">下一位：<button type="button" class="link" data-open="${esc(n.id)}">${esc(n.name)}</button> · ${when}入住 · ${l&&l.time?'来程船 <b>'+esc(l.time)+'</b>'+(l.port?'（'+esc(l.port)+'）':''):'来程船班未填'}</div>`;}
const PICK_NEXT={'待确认':'需接船','需接船':'已安排','已安排':'已接到','已接到':'需接船','无需接船':'需接船'};
function plate(n){return `<span class="plate">${esc(n)}</span>`;}
function tasksHTML(r){const ts=(r.tasks||[]);if(!ts.length)return '';return `<ul class="todo">${ts.map((t,i)=>`<li><label class="chk"><input type="checkbox" data-tdone="${esc(r.id)}" data-ti="${i}"${t.done?' checked':''}><span class="${t.done?'done':''}">${t.priority==='重要'?'<em class="imp">重要</em>':''}${esc(t.text)}${t.due?'<small> · '+md(t.due)+'</small>':''}</span></label></li>`).join('')}</ul>`;}
function noteHTML(r){return r.notes?`<p class="tnote">${esc(r.notes).replace(/\n/g,'<br>')}</p>`:'';}
function routeHTML(l,d){if(!l||l.date!==d||!(l.port||l.time||l.ship))return '';const parts=(l.port||'').split(/\s*(?:→|->|—>|到)\s*/);
 const from=parts[0]||'出发港待补充', to=parts.length>1?parts.slice(1).join(' → '):'';
 const tk=l.ticket&&l.ticket!=='待确认'?` <span class="tk ${l.ticket==='已购票'?'ok':(l.ticket==='有变动'||l.ticket==='停航/取消')?'bad':''}">${esc(l.ticket)}</span>`:'';
 return `<div class="route">${esc(from)}${l.time?' <b>'+esc(l.time)+'</b> 出发':''}${to?' → '+esc(to):''}${l.ship?' · '+esc(l.ship):''}${tk}</div>`;}
function arrivedHTML(r,d){if(r.checkin!==d)return '';
 if(r.status==='已入住'||r.status==='已退房'){const t=r.arrivedAt?new Date(r.arrivedAt):null;const tt=t&&!isNaN(t)?' '+String(t.getHours()).padStart(2,'0')+':'+String(t.getMinutes()).padStart(2,'0'):'';
  return `<span class="arrived">✓ 已到店${tt}</span>${r.status==='已入住'?`<button type="button" class="link undo" data-unarrive="${esc(r.id)}">撤销</button>`:''}`;}
 return `<button type="button" class="sm arrive" data-arrive="${esc(r.id)}">到店</button>`;}
function ticketHTML(r,kind,d){const l=kind==='in'?r.arrival:r.departure;const o=owe(r);
 const route=routeHTML(l,d)||`<div class="route muted">${kind==='in'?'来程船班未填':'返程船班未填'}</div>`;
 const money=kind==='out'?(o>0?`<div class="owe">待收 ${yuan(o)} 元</div>`:''):'';
 return `<article class="ticket${kind==='in'&&(r.status==='已入住'||r.status==='已退房')?' done':''}"><div class="tmain"><div class="thead"><button type="button" class="tname" data-open="${esc(r.id)}">${esc(r.name)}</button>${plate(r.room)}<span class="tmeta">${nightsOf(r)} 晚 · ${r.adults} 大${r.children?' '+r.children+' 小':''}${r.phone?' · '+esc(r.phone):''}</span>${kind==='in'?'<span class="tact">'+arrivedHTML(r,d)+'</span>':''}</div>${route}${noteHTML(r)}${tasksHTML(r)}${money}${nextHTML(r,d)}</div></article>`;}
function viewToday(){const d=dayView, act=live().filter((r)=>ACTIVE.includes(r.status));
 const arr=act.filter((r)=>r.checkin===d).sort((a,b)=>((a.arrival.date===d&&a.arrival.time)||'99').localeCompare((b.arrival.date===d&&b.arrival.time)||'99'));
 const dep=act.filter((r)=>r.checkout===d).sort((a,b)=>((a.departure.date===d&&a.departure.time)||'99').localeCompare((b.departure.date===d&&b.departure.time)||'99'));
 const stay=act.filter((r)=>r.checkin<=d&&r.checkout>d), inHouse=stay.filter((r)=>r.checkin<d);
 const shown=new Set(arr.concat(dep).map((r)=>r.id));
 const pend=live().filter((r)=>r.status==='待确认'&&r.checkin>=d);
 const tasks=[];live().forEach((r)=>{if(shown.has(r.id))return;(r.tasks||[]).forEach((t,i)=>{if(!t.done&&t.due&&t.due<=d)tasks.push({r,t,i});});});
 tasks.sort((a,b)=>(a.t.priority==='重要'?0:1)-(b.t.priority==='重要'?0:1)||a.t.due.localeCompare(b.t.due));
 const isToday=d===today(), dt=new Date(d+'T00:00:00');
 let h=`<section class="hero"><div class="hero-date"><b>${dt.getMonth()+1}月${dt.getDate()}日</b><span>${wd(d)} · 庙子湖${isToday?' · 今天':''}</span></div>
 <div class="hero-sum"><span><b>${arr.filter((r)=>r.status!=='已预订').length}/${arr.length}</b>已到店</span><span><b>${dep.length}</b>离店</span><span><b>${stay.length}</b>/6 在住</span></div>
 <div class="daynav"><button type="button" class="sm" data-day="-1" aria-label="前一天">‹ 前一天</button><input type="date" id="dayPick" value="${esc(d)}" aria-label="安排日期"><button type="button" class="sm" data-day="1" aria-label="后一天">后一天 ›</button>${isToday?'':'<button type="button" class="sm" data-day="0">今天</button>'}</div></section>`;
 h+=`<section class="sec"><div class="sec-h"><h3>当日到店</h3><span>按船班时间排</span></div>${arr.length?'<div class="list">'+arr.map((r)=>ticketHTML(r,'in',d)).join('')+'</div>':'<div class="empty">这一天没有客人到店</div>'}</section>`;
 if(dep.length)h+=`<section class="sec"><div class="sec-h"><h3>当日离店</h3><span>退房 9:30 前</span></div><div class="list">${dep.map((r)=>ticketHTML(r,'out',d)).join('')}</div></section>`;
 const inNotes=inHouse.filter((r)=>r.notes||(r.tasks||[]).some((t)=>!t.done)||nextOf(r));
 if(inNotes.length)h+=`<section class="sec"><div class="sec-h"><h3>在住客人 · 注意事项与换房</h3><span>${inNotes.length} 间</span></div><div class="list">${inNotes.map((r)=>`<article class="card mini"><div class="thead"><button type="button" class="tname" data-open="${esc(r.id)}">${esc(r.name)}</button>${plate(r.room)}<span class="tmeta">住到 ${md(r.checkout)}</span></div>${noteHTML(r)}${tasksHTML(r)}${nextHTML(r,d)}</article>`).join('')}</div></section>`;
 if(tasks.length)h+=`<section class="sec"><div class="sec-h"><h3>其他到期事项</h3><span>含已过期未完成</span></div><div class="list">${tasks.map(({r,t,i})=>`<div class="row"><div class="main"><div class="t">${t.priority==='重要'?'<em class="imp">重要</em>':''}${esc(t.text)}</div><div class="m">${esc(r.name)} · ${esc(r.room)} · ${t.due<d?'已过期 '+md(t.due):'今天'}</div></div><div class="r"><button type="button" class="sm" data-done="${esc(r.id)}" data-ti="${i}">完成</button></div></div>`).join('')}</div></section>`;
 h+=`<section class="sec"><div class="sec-h"><h3>六间房，当晚</h3><button type="button" class="link" data-tab-go="calendar">房态日历 →</button></div><div class="rooms6">${ROOMS.map(([n,desc])=>{const r=stay.find((x)=>x.room===n);return `<div class="rm${r?' occ':''}"${r?` data-open="${esc(r.id)}" role="button" tabindex="0"`:''}><b>${n}</b><div>${r?esc(r.name)+(r.checkin===d?' · 本日入住':'')+' · 至 '+md(r.checkout):'空房'}</div>${r&&r.checkout===addDays(d,1)&&nextOf(r)?`<div class="nx">${cn(r.checkout)}换客${(()=>{const n=nextOf(r);return n.arrival&&n.arrival.date===n.checkin&&n.arrival.time?' · 船 '+esc(n.arrival.time):'';})()}</div>`:''}</div>`;}).join('')}</div></section>`;
 if(pend.length)h+=`<section class="sec"><div class="sec-h"><h3>待确认的预订</h3><span>不占房，确认后改成已预订</span></div><div class="list">${pend.map((r)=>rowHTML(r)).join('')}</div></section>`;
 const dx=liveExp().filter((x)=>x.date===d).sort((a,b)=>(a.createdAt||'').localeCompare(b.createdAt||''));
 h+=`<section class="sec" id="expSec"><div class="sec-h"><h3>本日花费小记</h3><span>${dx.length?dx.length+' 笔 · 合计 '+yuan(expSum(dx))+' 元':'临时小额支出，记在这里'}</span></div>
 ${dx.length?'<div class="list">'+dx.map((x)=>`<div class="row exp${x.settled?' settled':''}"><div class="main"><div class="t">${esc(x.purpose)}<small>${esc(x.category)}</small></div><div class="m">${esc(x.pay)}${x.payer&&x.payer!=='自己'?' · '+esc(x.payer)+'垫付':''}${x.room?' · '+esc(x.room):''}${x.note?' · '+esc(x.note):''} · ${x.settled?'已结算':'待结算'}</div></div><div class="r"><b class="amt">${yuan(cents(x.amount))}</b>${expDel===x.id?`<button type="button" class="sm danger" data-expdel-yes="${esc(x.id)}">删除</button><button type="button" class="sm" data-expdel-no>保留</button>`:`<button type="button" class="link" data-expdel="${esc(x.id)}">删除</button>`}</div></div>`).join('')+'</div>':''}
 <form class="card expform" id="expForm" autocomplete="off"><div class="field-row"><label>花费金额（元） <b>*</b><input id="xAmt" inputmode="decimal" placeholder="如 36.5"></label><label>用途 <b>*</b><input id="xPur" placeholder="如 买鸡蛋、修水龙头"></label></div>
 <div class="field-row"><label>类别<select id="xCat">${EXP_CATS.map((c)=>`<option>${c}</option>`).join('')}</select></label><label>付款方式<select id="xPay">${EXP_PAY.map((c)=>`<option>${c}</option>`).join('')}</select></label></div>
 <div class="field-row"><label>谁垫付<input id="xWho" value="自己" placeholder="自己 / 合伙人姓名"></label><label>关联房间（可选）<select id="xRoom"><option value="">不关联</option>${ROOM_NAMES.map((n)=>`<option>${n}</option>`).join('')}</select></label></div>
 <label>备注（可选）<input id="xNote" placeholder="商家、票据情况等"></label>
 <div class="actions"><button type="submit" class="pri">记一笔</button></div></form></section>`;
 h+='<p class="note">船班只记录客人的出行计划，不代表已核实或保证开航。</p>';
 return h;}

/* ---------- 预订台账 ---------- */
function filtered(){const q=filt.q.trim().toLowerCase();return live().filter((r)=>(!filt.status||r.status===filt.status)&&(!filt.channel||r.channel===filt.channel)&&(!filt.month||r.checkin.slice(0,7)===filt.month)
 &&(!q||[r.name,r.phone,r.reference,r.notes,r.group,r.origin].join(' ').toLowerCase().includes(q))).sort((a,b)=>b.checkin.localeCompare(a.checkin)||a.room.localeCompare(b.room));}
function viewLedger(){const rows=filtered(), months=[...new Set(live().map((r)=>r.checkin.slice(0,7)))].sort().reverse();
 let h=`<h2>每一次预订，都有迹可循。</h2><p class="lede">一条登记对应一间房的一段住宿；多间同行填同一个同行编号。</p>
 <div class="filters"><input id="fq" placeholder="搜称呼、电话、订单号、备注" value="${esc(filt.q)}" aria-label="搜索">
 <select id="fs" aria-label="状态"><option value="">全部状态</option>${STATUSES.map((s)=>`<option${filt.status===s?' selected':''}>${s}</option>`).join('')}</select>
 <select id="fc" aria-label="渠道"><option value="">全部渠道</option>${CHANNELS.map((s)=>`<option${filt.channel===s?' selected':''}>${s}</option>`).join('')}</select>
 <select id="fm" aria-label="入住月份"><option value="">全部月份</option>${months.map((m)=>`<option value="${m}"${filt.month===m?' selected':''}>${m.replace('-','年')}月入住</option>`).join('')}</select></div>
 <p class="muted" style="font-size:13px;margin:0 0 8px">当前 ${rows.length} 条 / 全部 ${live().length} 条</p>`;
 if(!rows.length)return h+(live().length?'<div class="empty"><b>没有符合条件的登记</b>换个搜索词或筛选条件。</div>':'<div class="empty"><b>把每一次预订，认真记下来</b>微信、电话、到店的订单都放在这本台账里。<div class="actions" style="justify-content:center"><button type="button" class="pri" data-new>新建第一条登记</button></div></div>');
 return h+'<div class="list">'+rows.map((r)=>{const o=owe(r);return rowHTML(r,`<span class="pill ${STATUS_CLS[r.status]}">${esc(r.status)}</span><br>${r.amount!=null?yuan(cents(r.amount))+' 元':'<span class="muted">金额待补</span>'}${o>0?`<br><span class="owe">待收 ${yuan(o)}</span>`:''}`);}).join('')+'</div>';}

/* ---------- 房态日历 ---------- */
function viewCalendar(){const ds=[...Array(14)].map((_,i)=>addDays(calStart,i)), t=today();
 let h=`<h2>把接下来十四天，铺开看看。</h2><p class="lede">同一间房日期重叠会拦下；离店当天可以安排下一位入住。</p>
 <div class="daynav"><button type="button" class="sm" data-cal="-7">前一周</button><input type="date" id="calPick" value="${esc(calStart)}" aria-label="起始日期"><button type="button" class="sm" data-cal="7">后一周</button>${calStart===t?'':'<button type="button" class="sm" data-cal="0">从今天看</button>'}</div>
 <div class="cal-wrap"><table class="cal"><thead><tr><th class="room"></th>${ds.map((d)=>{const w=new Date(d+'T00:00:00').getDay();return `<th class="${d===t?'td':(w===0||w===6)?'we':''}">${md(d)}<br>${wd(d).slice(1)}</th>`;}).join('')}</tr></thead><tbody>`;
 ROOMS.forEach(([n])=>{h+=`<tr><th class="room">${n}</th>`;ds.forEach((d,i)=>{const r=live().find((x)=>ACTIVE.includes(x.status)&&x.room===n&&x.checkin<=d&&x.checkout>d);
  if(!r){h+='<td></td>';return;}const first=r.checkin===d||i===0;h+=`<td><button type="button" class="${first?'':'cont'}" data-open="${esc(r.id)}" aria-label="${esc(n+' '+md(d)+' '+r.name)}">${esc(r.name)}</button></td>`;});h+='</tr>';});
 h+=`</tbody></table></div><p class="legend">深色为已登记占房 · 空白不等于 OTA 可售 · 「待确认」和「已取消」不占用日历。手机上可左右滑动。</p>`;
 return h;}

/* ---------- 经营概览 ---------- */
function monthRange(m){const s=m+'-01';const d=new Date(s+'T00:00:00');d.setMonth(d.getMonth()+1);return [s,d.getFullYear()+'-'+pad(d.getMonth()+1)+'-01'];}
function allocated(r,s,e){const n=nightsOf(r);if(!n||r.amount==null)return null;const a=r.checkin>s?r.checkin:s,b=r.checkout<e?r.checkout:e;const k=Math.max(0,days(a,b));return Math.round(cents(r.amount)*k/n);}
function viewStats(){const [s,e]=monthRange(statMonth);const recs=live();
 const act=recs.filter((r)=>ACTIVE.includes(r.status)&&r.checkin<e&&r.checkout>s);
 let nights=0,knownN=0,alloc=0;const byRoom=ROOM_NAMES.map((n)=>({n,v:0}));
 act.forEach((r)=>{const a=r.checkin>s?r.checkin:s,b=r.checkout<e?r.checkout:e,k=days(a,b);nights+=k;byRoom.find((x)=>x.n===r.room).v+=k;const al=allocated(r,s,e);if(al!=null){knownN+=k;alloc+=al;}});
 const booked=recs.filter((r)=>r.bookingDate>=s&&r.bookingDate<e), canc=booked.filter((r)=>r.status==='已取消');
 const lead=booked.filter((r)=>r.status!=='已取消'&&dateOK(r.bookingDate)).map((r)=>days(r.bookingDate,r.checkin));
 const avgLead=lead.length?(lead.reduce((a,b)=>a+b,0)/lead.length):null;
 const ch=CHANNELS.map((c)=>({c,v:booked.filter((r)=>r.channel===c).length})).filter((x)=>x.v);
 const maxR=Math.max(1,...byRoom.map((x)=>x.v)), maxC=Math.max(1,...ch.map((x)=>x.v));
 const months=[...new Set(recs.flatMap((r)=>[r.checkin.slice(0,7),(r.bookingDate||'').slice(0,7)]).filter(Boolean).concat([today().slice(0,7)]))].sort().reverse();
 let h=`<h2>让积累下来的记录，说话。</h2><p class="lede">只统计这本台账里登记过的订单，登记完整，数字才有意义。</p>
 <div class="daynav"><select id="statM" aria-label="统计月份" style="width:auto">${months.map((m)=>`<option value="${m}"${m===statMonth?' selected':''}>${m.replace('-','年')}月</option>`).join('')}</select></div>
 <div class="grid3"><div class="kpi"><div class="l">已登记间夜</div><div class="v">${nights}</div><div class="s">按住宿日 · 不含待确认、取消</div></div>
 <div class="kpi"><div class="l">分摊房费</div><div class="v">${yuan(alloc)}<small>元</small></div><div class="s">${nights?'已知金额覆盖 '+knownN+'/'+nights+' 间夜':'—'}</div></div>
 <div class="kpi"><div class="l">新增预订</div><div class="v">${booked.length}<small>笔</small></div><div class="s">按预订日 · 取消 ${canc.length} 笔${avgLead!=null?' · 平均提前 '+avgLead.toFixed(1)+' 天':''}</div></div></div>
 <section class="sec"><div class="sec-h"><h3>各房间已登记间夜</h3><span>入住日计入，离店日不计</span></div><div class="card bars">${byRoom.map((x)=>`<div class="bar"><span>${x.n}</span><span class="track"><i style="width:${(x.v/maxR*100).toFixed(1)}%"></i></span><span>${x.v} 晚</span></div>`).join('')}</div></section>
 <section class="sec"><div class="sec-h"><h3>新增预订来自哪里</h3><span>按预订日 · 含取消</span></div>${ch.length?`<div class="card bars">${ch.map((x)=>`<div class="bar"><span>${esc(x.c)}</span><span class="track"><i style="width:${(x.v/maxC*100).toFixed(1)}%"></i></span><span>${x.v} 笔</span></div>`).join('')}</div>`:'<div class="empty">这个月还没有新增预订</div>'}</section>
 ${advHTML(s,e)}
 <p class="note">分摊房费 = 整单房费 ÷ 总晚数 × 本月住宿晚数，不是财务收入，不含佣金和退款；金额没填的间夜不按 0 元算。<br>预订日和住宿日口径不同，不能直接相除。没有完整的可售房晚数据，所以不算入住率和 RevPAR。</p>`;
 return h;}

function advHTML(s,e){const mx=liveExp().filter((x)=>x.date>=s&&x.date<e), pendAll=liveExp().filter((x)=>!x.settled).sort((a,b)=>a.date.localeCompare(b.date));
 const mPend=mx.filter((x)=>!x.settled);const cat=EXP_CATS.map((c)=>({c,v:expSum(mx.filter((x)=>x.category===c))})).filter((x)=>x.v);const maxV=Math.max(1,...cat.map((x)=>x.v));
 const who=[...new Set(pendAll.map((x)=>x.payer||'自己'))].map((w)=>({w,v:expSum(pendAll.filter((x)=>(x.payer||'自己')===w))}));
 return `<section class="sec"><div class="sec-h"><h3>垫付总计</h3><span>来自「本日花费小记」</span></div>
 <div class="grid3"><div class="kpi"><div class="l">本月花费</div><div class="v">${yuan(expSum(mx))}<small>元</small></div><div class="s">${mx.length} 笔</div></div>
 <div class="kpi"><div class="l">本月待结算</div><div class="v">${yuan(expSum(mPend))}<small>元</small></div><div class="s">${mPend.length} 笔未结</div></div>
 <div class="kpi"><div class="l">累计待结算</div><div class="v">${yuan(expSum(pendAll))}<small>元</small></div><div class="s">${who.length?who.map((x)=>esc(x.w)+' '+yuan(x.v)).join(' · '):'全部已结清'}</div></div></div>
 ${cat.length?`<div class="card bars" style="margin-top:10px">${cat.map((x)=>`<div class="bar"><span>${esc(x.c)}</span><span class="track"><i style="width:${(x.v/maxV*100).toFixed(1)}%"></i></span><span>${yuan(x.v)}</span></div>`).join('')}</div>`:'<div class="empty">这个月还没有记花费</div>'}
 ${pendAll.length?`<div class="list" style="margin-top:10px">${pendAll.map((x)=>`<div class="row exp"><div class="main"><div class="t">${esc(x.purpose)}<small>${md(x.date)} · ${esc(x.category)}</small></div><div class="m">${esc(x.payer||'自己')}垫付 · ${esc(x.pay)}${x.note?' · '+esc(x.note):''}</div></div><div class="r"><b class="amt">${yuan(cents(x.amount))}</b><button type="button" class="sm" data-settle="${esc(x.id)}">已结</button></div></div>`).join('')}</div>
 <div class="actions"><button type="button" class="sm" id="settleAll">全部标记已结算（${yuan(expSum(pendAll))} 元）</button></div>`:''}
 </section>`;}

/* ---------- 备份与导出 ---------- */
function viewBackup(){let last=null;try{last=localStorage.getItem(BKEY);}catch(e){}const dd=last?Math.floor((Date.now()-Date.parse(last))/864e5):null;
 const trash=all.filter((r)=>r.deleted).sort((a,b)=>(b.deletedAt||'').localeCompare(a.deletedAt||''));
 const months=[...new Set(live().map((r)=>r.checkin.slice(0,7)).concat([today().slice(0,7)]))].sort().reverse();
 let h=`<h2>记录留下来，数据带得走。</h2><p class="lede">所有登记只存在这台手机里。每月结账时备份一次，存到微信文件传输助手或网盘。</p>
 <div class="card"><div class="sec-h"><h3>完整备份</h3><span class="${!last||dd>=30?'owe':''}">${last?'上次备份 '+last.slice(0,10)+(dd>=30?'，已超过 30 天':''):(all.length?'还没备份过':'')}</span></div>
 <p class="muted" style="font-size:13px;margin:0">备份文件包含客人电话，只保存在自己的设备或网盘。换手机时在新手机上「导入备份」即可恢复。</p>
 <div class="actions"><button type="button" class="pri" id="bkBtn">下载完整备份</button><button type="button" id="rsBtn">导入备份</button><input type="file" id="rsFile" accept=".json,application/json" hidden></div></div>
 <div class="card sec"><div class="sec-h"><h3>按月导出对账表</h3><span>CSV，Excel 和 WPS 都能打开</span></div>
 <div class="field-row"><label>月份<select id="exM">${months.map((m)=>`<option value="${m}">${m.replace('-','年')}月</option>`).join('')}</select></label>
 <label>口径<select id="exMode"><option value="checkin">本月入住的订单</option><option value="stay">本月有住宿日（含跨月）</option></select></label></div>
 <div class="actions"><button type="button" id="exBtn">导出本月 CSV</button><button type="button" id="exAll">导出全部登记</button><button type="button" id="exExp">导出本月花费</button></div>
 <p class="note">保留整单金额，另列本月间夜和分摊房费。累计收款没有收款日期，不能当作当月现金收入；精斗云还是按微信、支付宝实际收款入账。</p></div>
 <div class="card sec"><div class="sec-h"><h3>回收站</h3><span>${trash.length} 条</span></div>${trash.length?'<div class="list">'+trash.map((r)=>`<div class="row"><div class="main"><div class="t">${esc(r.name)}<small>${esc(r.room)} · ${md(r.checkin)}–${md(r.checkout)}</small></div><div class="m">删除于 ${esc((r.deletedAt||'').slice(0,10))}</div></div><div class="r"><button type="button" class="sm" data-restore="${esc(r.id)}">恢复</button></div></div>`).join('')+'</div>':'<p class="muted" style="font-size:13px;margin:0">删除的登记会先放在这里，可以恢复。</p>'}
 ${trash.length?(pendingPurge?'<div class="confirm" style="margin-top:10px">清空后无法恢复，确定？<button type="button" class="sm danger" id="purgeYes">清空回收站</button><button type="button" class="sm" id="purgeNo">先不清</button></div>':'<div class="actions"><button type="button" class="sm" id="purgeBtn">清空回收站</button></div>'):''}</div>
 <div class="card sec"><div class="sec-h"><h3>离线与安装</h3><span id="swState">${swReady?'离线页面已就绪':'离线页面准备中'}</span></div>
 <p class="muted" style="font-size:13px;margin:0">iPhone：用 Safari 打开，点分享 →「添加到主屏幕」，以后只从桌面图标打开。桌面图标和 Safari 里的数据是分开的两份。</p>
 <div class="actions"><button type="button" class="sm" id="persistBtn">申请保留本机数据</button></div></div>`;
 return h;}
let pendingPurge=false, swReady=false;

/* ---------- 事件绑定 ---------- */
function bindView(){const v=$('view');
 v.querySelectorAll('[data-open]').forEach((el)=>{el.addEventListener('click',()=>openDetail(el.dataset.open));el.addEventListener('keydown',(e)=>{if(e.key==='Enter')openDetail(el.dataset.open);});});
 v.querySelectorAll('[data-new]').forEach((el)=>el.addEventListener('click',()=>openEditor(null)));
 v.querySelectorAll('[data-tab-go]').forEach((el)=>el.addEventListener('click',()=>setTab(el.dataset.tabGo)));
 v.querySelectorAll('[data-day]').forEach((el)=>el.addEventListener('click',()=>{const n=Number(el.dataset.day);dayView=n===0?today():addDays(dayView,n);render();}));
 const dp=$('dayPick');if(dp)dp.addEventListener('change',()=>{if(dateOK(dp.value)){dayView=dp.value;render();}});
 v.querySelectorAll('[data-cal]').forEach((el)=>el.addEventListener('click',()=>{const n=Number(el.dataset.cal);calStart=n===0?today():addDays(calStart,n);render();}));
 const cp=$('calPick');if(cp)cp.addEventListener('change',()=>{if(dateOK(cp.value)){calStart=cp.value;render();}});
 v.querySelectorAll('[data-pick]').forEach((el)=>el.addEventListener('click',()=>{const r=all.find((x)=>x.id===el.dataset.pick);if(!r)return;r.pickup=PICK_NEXT[r.pickup]||'需接船';r.updatedAt=new Date().toISOString();try{save(r);toast('接船：'+r.pickup);}catch(e){toast(e.message);}render();}));
 v.querySelectorAll('[data-tdone]').forEach((el)=>el.addEventListener('change',()=>{const r=all.find((x)=>x.id===el.dataset.tdone);if(!r)return;const t=r.tasks[Number(el.dataset.ti)];if(!t)return;t.done=el.checked;r.updatedAt=new Date().toISOString();try{save(r);}catch(e){toast(e.message);}render();}));
 v.querySelectorAll('[data-done]').forEach((el)=>el.addEventListener('click',()=>{const r=all.find((x)=>x.id===el.dataset.done);if(!r)return;const t=r.tasks[Number(el.dataset.ti)];if(!t)return;t.done=true;r.updatedAt=new Date().toISOString();try{save(r);toast('事项已完成');}catch(e){toast(e.message);}render();}));
 const fq=$('fq');if(fq){fq.addEventListener('input',()=>{filt.q=fq.value;const pos=fq.selectionStart;render();const n=$('fq');n.focus();try{n.setSelectionRange(pos,pos);}catch(e){}});
  [['fs','status'],['fc','channel'],['fm','month']].forEach(([id,k])=>$(id).addEventListener('change',()=>{filt[k]=$(id).value;render();}));}
 v.querySelectorAll('[data-arrive]').forEach((el)=>el.addEventListener('click',()=>{const r=all.find((x)=>x.id===el.dataset.arrive);if(!r)return;r.status='已入住';r.arrivedAt=new Date().toISOString();if(r.pickup==='需接船'||r.pickup==='已安排')r.pickup='已接到';r.updatedAt=r.arrivedAt;try{save(r);toast(r.name+' 已到店');}catch(e){toast(e.message);}render();}));
 v.querySelectorAll('[data-unarrive]').forEach((el)=>el.addEventListener('click',()=>{const r=all.find((x)=>x.id===el.dataset.unarrive);if(!r)return;r.status='已预订';r.arrivedAt='';r.updatedAt=new Date().toISOString();try{save(r);toast('已撤销到店');}catch(e){toast(e.message);}render();}));
 const xf=$('expForm');if(xf)xf.addEventListener('submit',(e)=>{e.preventDefault();let amt;try{amt=moneyIn($('xAmt').value.trim());}catch(err){toast('金额要填非负数字');return;}
  const pur=$('xPur').value.trim();if(amt==null||amt<=0){toast('先填花费金额');$('xAmt').focus();return;}if(!pur){toast('写一下用途');$('xPur').focus();return;}
  const now=new Date().toISOString();exps.push({id:newId(),date:dayView,amount:amt,purpose:pur.slice(0,60),category:$('xCat').value,pay:$('xPay').value,payer:($('xWho').value.trim()||'自己').slice(0,20),room:$('xRoom').value,note:$('xNote').value.trim().slice(0,100),settled:false,settledAt:'',deleted:false,createdAt:now,updatedAt:now});
  if(!persistExp()){exps.pop();toast('手机存储空间不足，没能保存');return;}toast('已记 '+yuan(Math.round(amt*100))+' 元');render();const sec=$('expSec');if(sec)sec.scrollIntoView({block:'start'});});
 v.querySelectorAll('[data-expdel]').forEach((el)=>el.addEventListener('click',()=>{expDel=el.dataset.expdel;render();}));
 v.querySelectorAll('[data-expdel-no]').forEach((el)=>el.addEventListener('click',()=>{expDel='';render();}));
 v.querySelectorAll('[data-expdel-yes]').forEach((el)=>el.addEventListener('click',()=>{const x=exps.find((y)=>y.id===el.dataset.expdelYes);if(x){x.deleted=true;x.updatedAt=new Date().toISOString();persistExp();toast('已删除');}expDel='';render();}));
 v.querySelectorAll('[data-settle]').forEach((el)=>el.addEventListener('click',()=>{const x=exps.find((y)=>y.id===el.dataset.settle);if(!x)return;x.settled=true;x.settledAt=x.updatedAt=new Date().toISOString();persistExp();toast('已标记结算');render();}));
 if($('settleAll'))$('settleAll').addEventListener('click',()=>{const t=new Date().toISOString();liveExp().forEach((x)=>{if(!x.settled){x.settled=true;x.settledAt=x.updatedAt=t;}});persistExp();toast('全部已结算');render();});
 const sm=$('statM');if(sm)sm.addEventListener('change',()=>{statMonth=sm.value;render();});
 if($('bkBtn')){$('bkBtn').addEventListener('click',backup);$('rsBtn').addEventListener('click',()=>$('rsFile').click());$('rsFile').addEventListener('change',restore);
  $('exBtn').addEventListener('click',()=>exportCSV($('exM').value,$('exMode').value));$('exAll').addEventListener('click',()=>exportCSV('',''));$('exExp').addEventListener('click',()=>exportExp($('exM').value));
  v.querySelectorAll('[data-restore]').forEach((el)=>el.addEventListener('click',()=>{const r=all.find((x)=>x.id===el.dataset.restore);if(!r)return;const c=conflictOf(r,r.id);if(c){toast(r.room+' 这几天已被 '+c.name+' 占用，先改日期或取消那条');return;}r.deleted=false;r.deletedAt='';r.updatedAt=new Date().toISOString();try{save(r);toast('已恢复');}catch(e){toast(e.message);}render();}));
  if($('purgeBtn'))$('purgeBtn').addEventListener('click',()=>{pendingPurge=true;render();});
  if($('purgeYes'))$('purgeYes').addEventListener('click',()=>{all=all.filter((r)=>!r.deleted);persist();pendingPurge=false;toast('回收站已清空');render();});
  if($('purgeNo'))$('purgeNo').addEventListener('click',()=>{pendingPurge=false;render();});
  $('persistBtn').addEventListener('click',async()=>{try{const ok=navigator.storage&&navigator.storage.persist?await navigator.storage.persist():false;toast(ok?'系统已同意保留本机数据':'系统没有承诺保留，请定期备份');}catch(e){toast('系统没有承诺保留，请定期备份');}});}
}

/* ---------- 详情 ---------- */
let detailConfirm=false;
function openDetail(id){const r=all.find((x)=>x.id===id);if(!r)return;detailConfirm=false;drawDetail(r);const d=$('detail');if(!d.open)d.showModal();}
const PORTS=['沈家门','沈家湾','东福山','青浜岛'];
function legTxt(l){if(!l||!(l.date||l.time||l.port||l.ship))return '未填写';return [l.date?md(l.date):'',l.time,l.port,l.ship].filter(Boolean).join(' · ')+'（'+l.ticket+'）';}
function drawDetail(r){const d=$('detail'),n=nightsOf(r),o=owe(r),c=conflictOf(r,r.id);
 d.innerHTML=`<div class="dlg"><div class="dlg-h"><h3>${esc(r.name)} · ${esc(r.room)}</h3><button type="button" class="sm" data-x>关闭</button></div><div class="dlg-b">
 ${c?`<div class="conflict bad">${esc(r.room)} 这几天和 ${esc(c.name)}（${md(c.checkin)}–${md(c.checkout)}）重叠，请核对。</div>`:''}
 <dl class="kv"><dt>住宿</dt><dd>${esc(r.checkin)} → ${esc(r.checkout)} · ${n} 晚</dd><dt>状态</dt><dd><span class="pill ${STATUS_CLS[r.status]}">${esc(r.status)}</span></dd>
 <dt>电话</dt><dd>${r.phone?esc(r.phone):'未记录'}</dd><dt>人数</dt><dd>${r.adults} 大${r.children?' '+r.children+' 小':''}${r.guestType!=='未记录'?' · '+esc(r.guestType):''}</dd>
 <dt>渠道</dt><dd>${esc(r.channel)}${r.reference?' · '+esc(r.reference):''} · 预订日 ${esc(r.bookingDate||'—')}</dd>
 <dt>整单房费</dt><dd>${r.amount!=null?yuan(cents(r.amount))+' 元':'金额待补充'}${r.nightlyRate!=null&&r.pricingMode==='nightly'?'（每晚 '+yuan(cents(r.nightlyRate))+'）':''}</dd>
 <dt>收款</dt><dd>已收 ${yuan(cents(r.paid))}${r.refund?' · 已退 '+yuan(cents(r.refund)):''}${o!=null?(o>0?` · <span class="owe">待收 ${yuan(o)}</span>`:o<0?` · <span class="owe">多收 ${yuan(-o)}，请核对</span>`:' · 已收齐'):''}</dd>
 ${r.group?`<dt>同行编号</dt><dd>${esc(r.group)}</dd>`:''}${r.origin?`<dt>客源地</dt><dd>${esc(r.origin)}</dd>`:''}
 ${(()=>{const n=nextOf(r);if(!n)return '';const l=n.arrival&&n.arrival.date===n.checkin?n.arrival:null;return `<dt>下一位</dt><dd>${esc(n.name)} · ${md(n.checkin)} 入住此房 · ${l&&l.time?'来程船 '+esc(l.time):'船班未填'}</dd>`;})()}<dt>接船</dt><dd>${esc(r.pickup)}</dd><dt>来程</dt><dd>${esc(legTxt(r.arrival))}</dd><dt>返程</dt><dd>${esc(legTxt(r.departure))}</dd>
 <dt>备注</dt><dd>${r.notes?esc(r.notes).replace(/\n/g,'<br>'):'暂无'}</dd>
 <dt>事项</dt><dd>${(r.tasks||[]).length?r.tasks.map((t,i)=>`<label class="chk"><input type="checkbox" data-task="${i}"${t.done?' checked':''}> ${t.priority==='重要'?'<b style="color:var(--bad)">重要</b> ':''}${esc(t.text)}${t.due?' · '+md(t.due):''}</label>`).join(''):'暂无'}</dd></dl>
 <label>修改状态<select id="dStatus">${STATUSES.map((s)=>`<option${s===r.status?' selected':''}>${s}</option>`).join('')}</select></label>
 </div><div class="dlg-f">${detailConfirm?`<span class="confirm">移入回收站？之后可以恢复。<button type="button" class="sm danger" id="dDelYes">移入回收站</button><button type="button" class="sm" id="dDelNo">保留</button></span>`:`<button type="button" class="sm" id="dDel">删除</button>`}
 ${o>0?'<button type="button" class="sm" id="dPaid">尾款已收齐</button>':''}<button type="button" class="pri" id="dEdit">编辑登记</button></div></div>`;
 d.querySelector('[data-x]').onclick=()=>d.close();
 d.querySelectorAll('[data-task]').forEach((el)=>el.onchange=()=>{r.tasks[Number(el.dataset.task)].done=el.checked;r.updatedAt=new Date().toISOString();try{save(r);}catch(e){toast(e.message);}render();});
 $('dStatus').onchange=()=>{const ns=$('dStatus').value;const tmp=Object.assign({},r,{status:ns});const cc=conflictOf(tmp,r.id);if(cc){toast(r.room+' 这几天已被 '+cc.name+' 占用，不能改成'+ns);$('dStatus').value=r.status;return;}
  r.status=ns;r.updatedAt=new Date().toISOString();try{save(r);toast('状态已改为'+ns);}catch(e){toast(e.message);}drawDetail(r);render();};
 if($('dPaid'))$('dPaid').onclick=()=>{r.paid=Math.round((cents(r.amount)+(cents(r.refund)||0)))/100;r.updatedAt=new Date().toISOString();try{save(r);toast('已记为尾款收齐');}catch(e){toast(e.message);}drawDetail(r);render();};
 $('dEdit').onclick=()=>{d.close();openEditor(r.id);};
 if($('dDel'))$('dDel').onclick=()=>{detailConfirm=true;drawDetail(r);};
 if($('dDelNo'))$('dDelNo').onclick=()=>{detailConfirm=false;drawDetail(r);};
 if($('dDelYes'))$('dDelYes').onclick=()=>{r.deleted=true;r.deletedAt=new Date().toISOString();r.updatedAt=r.deletedAt;try{save(r);toast('已移入回收站');}catch(e){toast(e.message);}d.close();render();};}

/* ---------- 新建 / 编辑 ---------- */
let ed=null, edDirty=false;
function openEditor(id){const src=id?all.find((x)=>x.id===id):null;ed=JSON.parse(JSON.stringify(src||blank()));ed._isNew=!src;edDirty=false;edConfirmClose=false;drawEditor();const d=$('editor');if(!d.open)d.showModal();}
let edConfirmClose=false;
function legFields(k,l,label){const full=k!=='arrival';return `<div class="leg"><h4>${label}</h4><div class="field-row"><label>日期${k==='arrival'?'（默认入住当天）':'（默认退房当天）'}<input type="date" data-leg="${k}.date" value="${esc(l.date)}"></label>${full?`<label>出发时间<input type="time" data-leg="${k}.time" value="${esc(l.time)}"></label>`:`<label>船名 / 航次<input data-leg="${k}.ship" value="${esc(l.ship)}" placeholder="可选"></label>`}</div>
 ${full?`<div class="field-row"><label>出发港 → 到达港<input data-leg="${k}.port" value="${esc(l.port)}" placeholder="如 庙子湖 → 沈家门"></label><label>船名 / 航次<input data-leg="${k}.ship" value="${esc(l.ship)}" placeholder="可选"></label></div>`:''}
 <label>船票状态<select data-leg="${k}.ticket">${TICKETS.map((t)=>`<option${t===l.ticket?' selected':''}>${t}</option>`).join('')}</select></label></div>`;}
function drawEditor(){const d=$('editor'),r=ed;
 d.innerHTML=`<form class="dlg" id="edForm" novalidate><div class="dlg-h"><h3>${r._isNew?'新建登记':'编辑登记'}</h3><button type="button" class="sm" id="edClose">关闭</button></div><div class="dlg-b">
 <p class="muted" style="margin:0;font-size:13px">先记住宿和房费，其他资料随时补。</p>
 <div class="field-row"><label>客人称呼 <b>*</b><input id="eName" value="${esc(r.name)}" placeholder="怎样称呼客人" autocomplete="off"></label><label>联系电话<input id="ePhone" type="tel" inputmode="numeric" pattern="1[0-9]{10}" oninput="this.value=this.value.replace(/\\D/g,'').slice(0,11)" value="${esc(r.phone)}" placeholder="11 位手机号，可稍后补充" autocomplete="off"></label></div>
 <div class="field-row"><label>入住日期 <b>*</b><input type="date" id="eIn" value="${esc(r.checkin)}"></label><label>退房日期 <b>*</b><input type="date" id="eOut" value="${esc(r.checkout)}"></label></div>
 <div><label style="margin-bottom:6px">选择房间 <b>*</b></label><div class="roomsel" id="eRooms"></div></div>
 <div id="eConflict"></div>
 <div class="field-row3"><label>每晚房价（元）<input type="number" inputmode="decimal" min="0" step="0.01" id="eRate" value="${r.nightlyRate??''}" placeholder="填后自动算合计"></label>
 <label>房费合计（元）<input type="number" inputmode="decimal" min="0" step="0.01" id="eAmt" value="${r.amount??''}" placeholder="可直接修改"></label>
 <label>已收款（元）<input type="number" inputmode="decimal" min="0" step="0.01" id="ePaid" value="${r.paid??''}" placeholder="未收填 0"></label></div>
 <div class="calc" id="eCalc"></div>
 <div class="field-row"><label>来程船班时间（接船用）<input type="time" id="eArrTime" data-leg="arrival.time" value="${esc(r.arrival.time)}"></label><label>出发港<select data-leg="arrival.port"><option value="">未填</option>${(PORTS.includes(r.arrival.port)||!r.arrival.port?PORTS:PORTS.concat([r.arrival.port])).map((p)=>`<option${p===r.arrival.port?' selected':''}>${esc(p)}</option>`).join('')}</select></label></div>
 <label>备注 / 注意事项（今日安排里会显示）<textarea id="eNotes" placeholder="例如：带儿童、行李较多、对海鲜过敏、需要提前联系">${esc(r.notes)}</textarea></label>
 <details><summary>船票状态、返程船班与接船进度</summary><div class="inner">
  <label>接船进度<select id="ePickup">${PICKUPS.map((p)=>`<option${p===r.pickup?' selected':''}>${p}</option>`).join('')}</select></label>
  ${legFields('arrival',r.arrival,'来程')}${legFields('departure',r.departure,'返程船班')}</div></details>
 <details><summary>人数、渠道与其他资料</summary><div class="inner">
  <div class="field-row"><label>成人数<input type="number" min="1" max="20" step="1" id="eAd" value="${r.adults}"></label><label>儿童数<input type="number" min="0" max="20" step="1" id="eCh" value="${r.children}"></label></div>
  <div class="field-row"><label>预订渠道<select id="eChan">${CHANNELS.map((c)=>`<option${c===r.channel?' selected':''}>${c}</option>`).join('')}</select></label><label>实际预订日<input type="date" id="eBk" value="${esc(r.bookingDate)}"></label></div>
  <div class="field-row"><label>订单号（OTA 选填）<input id="eRef" value="${esc(r.reference)}"></label><label>累计已退款（元）<input type="number" inputmode="decimal" min="0" step="0.01" id="eRefund" value="${r.refund??''}"></label></div>
  <div class="field-row"><label>同行编号（多间房时填）<input id="eGroup" value="${esc(r.group)}" placeholder="如 王女士-0405"></label><label>同行类型<select id="eGT">${GUEST_TYPES.map((g)=>`<option${g===r.guestType?' selected':''}>${g}</option>`).join('')}</select></label></div>
  <label>客源地<input id="eOrigin" value="${esc(r.origin)}" placeholder="如 上海"></label>
  ${r._isNew?'':`<label>订单状态<select id="eStatus">${STATUSES.map((s)=>`<option${s===r.status?' selected':''}>${s}</option>`).join('')}</select></label>`}
 </div></details>
 <details${(r.tasks||[]).length?' open':''}><summary>事项（需要逐项跟进时添加）</summary><div class="inner" id="eTasks"></div><div class="actions"><button type="button" class="sm" id="eAddTask">添加事项</button></div></details>
 </div><div class="dlg-f"><p class="err" id="eErr" role="alert"></p>${edConfirmClose?'<span class="confirm">还没保存，放弃本次修改？<button type="button" class="sm danger" id="edDiscard">放弃</button><button type="button" class="sm" id="edKeep">继续编辑</button></span>':'<button type="button" id="edCancel">取消</button><button type="submit" class="pri">保存登记</button>'}</div></form>`;
 drawRooms();drawTasks();recalc();
 const f=$('edForm');
 f.addEventListener('input',()=>{edDirty=true;$('eErr').textContent='';});
 $('eIn').addEventListener('change',()=>{if(dateOK($('eIn').value)&&(!dateOK($('eOut').value)||$('eOut').value<=$('eIn').value))$('eOut').value=addDays($('eIn').value,1);sync();drawRooms();recalc();});
 $('eOut').addEventListener('change',()=>{sync();drawRooms();recalc();});
 $('eRate').addEventListener('input',()=>{ed.pricingMode='nightly';sync();recalc(true);});
 $('eAmt').addEventListener('input',()=>{ed.pricingMode='total';sync();recalc();});
 $('ePaid').addEventListener('input',()=>{sync();recalc();});
 $('eAddTask').addEventListener('click',()=>{sync();ed.tasks.push({text:'',done:false,due:ed.checkin||today(),priority:'普通'});drawTasks();});
 f.addEventListener('submit',(e)=>{e.preventDefault();submitEditor();});
 {const t=$('eArrTime');if(t){const seed=()=>{if(!t.value)t.value='08:05';};t.addEventListener('pointerdown',seed);t.addEventListener('focus',seed);}}
 const close=()=>{if(edDirty){edConfirmClose=true;sync();drawEditor();}else d.close();};
 $('edClose').onclick=close;if($('edCancel'))$('edCancel').onclick=close;
 if($('edDiscard'))$('edDiscard').onclick=()=>{edDirty=false;d.close();};
 if($('edKeep'))$('edKeep').onclick=()=>{edConfirmClose=false;drawEditor();edDirty=true;};
 d.oncancel=(e)=>{if(edDirty){e.preventDefault();close();}};}
function drawRooms(){const box=$('eRooms');if(!box)return;box.innerHTML='';ROOMS.forEach(([n,desc])=>{const tmp=Object.assign({},ed,{room:n,status:ACTIVE.includes(ed.status)?ed.status:'已预订'});const c=conflictOf(tmp,ed.id);
 const b=document.createElement('button');b.type='button';b.setAttribute('aria-pressed',ed.room===n?'true':'false');if(c)b.className='taken';b.textContent=n;const s=document.createElement('span');s.textContent=c?('已被 '+c.name+' 占用'):desc;b.appendChild(s);
 b.onclick=()=>{sync();ed.room=n;edDirty=true;drawRooms();recalc();};box.appendChild(b);});
 const cf=$('eConflict');const c=conflictOf(ed,ed.id);
 if(!ed.room||!dateOK(ed.checkin)||!dateOK(ed.checkout)){cf.innerHTML='';return;}
 if(ed.checkout<=ed.checkin){cf.innerHTML='<div class="conflict bad">退房日期要晚于入住日期。</div>';return;}
 cf.innerHTML=c?`<div class="conflict bad">${esc(ed.room)} 在 ${md(c.checkin)}–${md(c.checkout)} 已被 ${esc(c.name)} 占用，不能保存。请换房或调整日期。</div>`:`<div class="conflict">${esc(ed.room)} 这几天可登记。退房当天可以安排下一位入住。</div>`;}
function drawTasks(){const box=$('eTasks');if(!box)return;box.innerHTML=ed.tasks.length?'':'<p class="muted" style="margin:0;font-size:13px">例如：确认来程船票、准备儿童用品。</p>';
 ed.tasks.forEach((t,i)=>{const w=document.createElement('div');w.className='task';w.innerHTML=`<input type="checkbox" data-tk="${i}.done"${t.done?' checked':''} aria-label="事项已完成" style="width:auto"><input data-tk="${i}.text" value="${esc(t.text)}" placeholder="事项内容"><button type="button" class="sm" data-tdel="${i}" aria-label="移除事项">移除</button>
  <div class="tsub"><input type="date" data-tk="${i}.due" value="${esc(t.due)}" aria-label="事项日期"><select data-tk="${i}.priority" aria-label="优先级"><option${t.priority==='普通'?' selected':''}>普通</option><option${t.priority==='重要'?' selected':''}>重要</option></select></div>`;box.appendChild(w);});
 box.querySelectorAll('[data-tdel]').forEach((b)=>b.onclick=()=>{sync();ed.tasks.splice(Number(b.dataset.tdel),1);edDirty=true;drawTasks();});}
function sync(){if(!$('edForm'))return;const v=(id)=>$(id)?$(id).value:'';
 ed.name=v('eName').trim();ed.phone=v('ePhone').replace(/\D/g,'');ed.checkin=v('eIn');ed.checkout=v('eOut');ed.notes=v('eNotes').trim();
 ed.nightlyRate=v('eRate')===''?null:Number(v('eRate'));ed.amount=v('eAmt')===''?null:Number(v('eAmt'));ed.paid=v('ePaid')===''?null:Number(v('ePaid'));
 ed.pickup=v('ePickup')||ed.pickup;ed.adults=Number(v('eAd'))||1;ed.children=Number(v('eCh'))||0;ed.channel=v('eChan')||ed.channel;ed.bookingDate=v('eBk');
 ed.reference=v('eRef').trim();ed.refund=v('eRefund')===''?null:Number(v('eRefund'));ed.group=v('eGroup').trim();ed.guestType=v('eGT')||ed.guestType;ed.origin=v('eOrigin').trim();
 if($('eStatus'))ed.status=$('eStatus').value;
 document.querySelectorAll('[data-leg]').forEach((el)=>{const [k,f]=el.dataset.leg.split('.');ed[k][f]=el.value.trim();});
 document.querySelectorAll('[data-tk]').forEach((el)=>{const [i,f]=el.dataset.tk.split('.');const t=ed.tasks[Number(i)];if(!t)return;t[f]=f==='done'?el.checked:el.value.trim();});}
function recalc(fromRate){const n=nightsOf(ed);const box=$('eCalc');if(!box)return;
 if(ed.pricingMode==='nightly'&&ed.nightlyRate!=null&&n){ed.amount=Math.round(cents(ed.nightlyRate)*n)/100;const a=$('eAmt');if(a&&(fromRate||a.value===''||Number(a.value)!==ed.amount))a.value=ed.amount;}
 const amt=cents(ed.amount),net=netPaid(ed);let h=`<span>晚数 <b>${n||'—'}</b></span><span>房费合计 <b>${amt!=null?yuan(amt)+' 元':'未填'}</b></span>`;
 if(amt!=null){const o=amt-net;h+=o>=0?`<span>待收 <b>${yuan(o)} 元</b></span>`:`<span class="bad">已多收 ${yuan(-o)} 元，请核对</span>`;}
 h+=`<span>${ed.pricingMode==='total'&&amt!=null?'已使用手动合计，改日期不会覆盖金额 <button type="button" class="link" id="eRecalc">按每晚房价重算</button>':'合计随晚数和每晚房价自动计算'}</span>`;
 box.innerHTML=h;const rb=$('eRecalc');if(rb)rb.onclick=()=>{if(ed.nightlyRate==null){toast('先填每晚房价');return;}ed.pricingMode='nightly';recalc(true);};}
function submitEditor(){sync();const r=ed,err=(m)=>{$('eErr').textContent=m;};
 if(!r.name)return err('请填写客人称呼。');
 if(!dateOK(r.checkin)||!dateOK(r.checkout))return err('请选择入住和退房日期。');
 if(r.checkout<=r.checkin)return err('退房日期要晚于入住日期。');
 if(days(r.checkin,r.checkout)>366)return err('住宿超过 366 晚，请核对日期。');
 if(!r.room)return err('请选择房间。');
 if(r.phone&&!/^1\d{10}$/.test(r.phone))return err('手机号要 11 位数字，以 1 开头。');
 if(!dateOK(r.bookingDate)||r.bookingDate>r.checkin)r.bookingDate=r.checkin<today()?r.checkin:today();
 if(r.bookingDate>r.checkin)r.bookingDate=r.checkin;
 try{['nightlyRate','amount','paid','refund'].forEach((k)=>{r[k]=moneyIn(r[k]);});}catch(e){return err(e.message);}
 if((r.refund||0)>(r.paid||0))return err('已退款不能超过已收款。');
 const cap=(ROOMS.find((x)=>x[0]===r.room)||[])[2];if(cap&&r.adults>cap)return err(r.room+' 按床位最多住 '+cap+' 位成人，请核实或分房登记。');
 const c=conflictOf(r,r.id);if(c)return err(r.room+' 在 '+md(c.checkin)+'–'+md(c.checkout)+' 已被 '+c.name+' 占用，不能保存。');
 r.tasks=(r.tasks||[]).filter((t)=>t.text);
 if(!r.arrival.date&&(r.arrival.time||r.arrival.port||r.arrival.ship))r.arrival.date=r.checkin;
 if(!r.departure.date&&(r.departure.time||r.departure.port||r.departure.ship))r.departure.date=r.checkout;
 if(r.pickup==='待确认')r.pickup='需接船';
 const now=new Date().toISOString();const isNew=r._isNew;delete r._isNew;if(isNew){r.id=newId();r.createdAt=now;}r.updatedAt=now;
 try{save(r);}catch(e){r._isNew=isNew;return err(e.message);}
 edDirty=false;$('editor').close();toast(isNew?'已保存到本机':'已保存修改');render();}

/* ---------- 导出 / 备份 ---------- */
async function shareOrDownload(name,text,type){const blob=new Blob([text],{type});
 try{const file=new File([blob],name,{type});if(navigator.canShare&&navigator.canShare({files:[file]})){await navigator.share({files:[file],title:name});return 'shared';}}catch(e){if(e&&e.name==='AbortError')return 'cancel';}
 const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},3000);return 'downloaded';}
function csvCell(v){let s=String(v??'');if(/^[=+\-@\t\r]/.test(s))s="'"+s;return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;}
async function exportCSV(m,mode){let rows=live();let s='',e='';
 if(m){[s,e]=monthRange(m);rows=mode==='stay'?rows.filter((r)=>r.checkin<e&&r.checkout>s):rows.filter((r)=>r.checkin.slice(0,7)===m);}
 rows.sort((a,b)=>a.checkin.localeCompare(b.checkin)||a.room.localeCompare(b.room));
 if(!rows.length){toast('这个范围没有登记');return;}
 const H=['入住','退房','晚数','房间','客人','电话','人数','渠道','订单号','预订日','状态','整单房费','已收','已退','待收','同行编号','接船','来程','返程','备注'].concat(m?['本月间夜','本月分摊房费']:[]);
 const lines=[H.join(',')].concat(rows.map((r)=>{const o=owe(r);const base=[r.checkin,r.checkout,nightsOf(r),r.room,r.name,r.phone,r.adults+(r.children?'+'+r.children+'小':''),r.channel,r.reference,r.bookingDate,r.status,
  r.amount??'',r.paid??'',r.refund??'',o==null?'':o/100,r.group,r.pickup,legTxt(r.arrival),legTxt(r.departure),r.notes];
  if(m){const a=r.checkin>s?r.checkin:s,b=r.checkout<e?r.checkout:e,k=ACTIVE.includes(r.status)?Math.max(0,days(a,b)):0;const al=ACTIVE.includes(r.status)?allocated(r,s,e):null;base.push(k,al==null?'':al/100);}
  return base.map(csvCell).join(',');}));
 const name='住客簿_'+(m?m+(mode==='stay'?'_住宿日':'_入住月份'):'全部')+'.csv';
 const res=await shareOrDownload(name,'﻿'+lines.join('\n'),'text/csv');if(res!=='cancel')toast('已导出 '+rows.length+' 条');}
async function exportExp(m){const [s,e]=monthRange(m);const rows=liveExp().filter((x)=>x.date>=s&&x.date<e).sort((a,b)=>a.date.localeCompare(b.date));
 if(!rows.length){toast('这个月没有花费记录');return;}
 const H=['日期','金额','用途','类别','付款方式','垫付人','关联房间','备注','结算状态','结算日期'];
 const lines=[H.join(',')].concat(rows.map((x)=>[x.date,x.amount,x.purpose,x.category,x.pay,x.payer,x.room,x.note,x.settled?'已结算':'待结算',(x.settledAt||'').slice(0,10)].map(csvCell).join(',')));
 lines.push(['合计',expSum(rows)/100].map(csvCell).join(','));
 const res=await shareOrDownload('住客簿_花费_'+m+'.csv','\ufeff'+lines.join('\n'),'text/csv');if(res!=='cancel')toast('已导出 '+rows.length+' 笔');}
async function backup(){const now=new Date();const name='住客簿备份_'+now.toISOString().slice(0,10)+'.json';
 const res=await shareOrDownload(name,JSON.stringify({app:'haichun-zkb',version:3,exportedAt:now.toISOString(),records:all,expenses:exps},null,1),'application/json');
 if(res!=='cancel'){try{localStorage.setItem(BKEY,now.toISOString());}catch(e){}toast('备份已生成，存到微信或网盘');render();}}
async function restore(e){const f=e.target.files&&e.target.files[0];e.target.value='';if(!f)return;if(f.size>5*1024*1024){toast('备份不能超过 5MB');return;}
 try{const d=JSON.parse(await f.text());let list=Array.isArray(d)?d:(d.records||d.bookings);if(!Array.isArray(list))throw 0;
  if(d.app==='haichun-booking'||(list[0]&&list[0].rooms)){localStorage.setItem(OLD_KEY,JSON.stringify(list));const tmp=all;localStorage.removeItem(KEY);list=load();all=tmp;}
  let add=0,upd=0,skip=0;list.forEach((x)=>{if(!x||!x.id||!dateOK(x.checkin))return;const rec=blank(x);const i=all.findIndex((y)=>y.id===rec.id);
   if(i>=0){if((rec.updatedAt||'')>(all[i].updatedAt||'')){all[i]=rec;upd++;}else skip++;}else{all.push(rec);add++;}});
  let xa=0;if(Array.isArray(d.expenses))d.expenses.forEach((x)=>{if(!x||!x.id||!dateOK(x.date))return;const i=exps.findIndex((y)=>y.id===x.id);if(i>=0){if((x.updatedAt||'')>(exps[i].updatedAt||''))exps[i]=x;}else{exps.push(x);xa++;}});
  persist();persistExp();render();toast('已导入：新增 '+add+' 条，更新 '+upd+' 条'+(skip?'，跳过 '+skip+' 条':'')+(xa?'，花费 '+xa+' 笔':''));}catch(err){toast('这个文件不是住客簿的备份');}}

/* ---------- 启动 ---------- */
all=load();exps=loadExp();
const h0=(location.hash||'').slice(1);if(['today','ledger','calendar','stats','backup'].includes(h0))tab=h0;
setTab(tab);
function updateChip(){const c=$('offlineChip');c.textContent=navigator.onLine?'本机保存':'离线使用中';c.className='chip'+(navigator.onLine?'':' warn');}
window.addEventListener('online',updateChip);window.addEventListener('offline',updateChip);updateChip();
if('serviceWorker' in navigator){window.addEventListener('load',()=>{navigator.serviceWorker.register('sw.js').then(()=>navigator.serviceWorker.ready).then(()=>{swReady=true;const s=$('swState');if(s)s.textContent='离线页面已就绪';}).catch(()=>{});});}
