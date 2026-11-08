'use strict';
/* 住客簿 · 海春暖院 — 单机离线版。数据只存在这台手机的浏览器里（localStorage），不会自动同步，请定期备份。 */
const ROOMS=[['听风','1F · 两张1.5米床',4],['听潮','1F · 两张1.5米床',4],['听雨','1F · 1.8米床',2],['见山','2F · 两张1.2米床',4],['见海','2F · 1.8米床',2],['见云','2F · 2米床·浴缸',2]];
const ROOM_NAMES=ROOMS.map(r=>r[0]);
const roomIdx=(n)=>{const i=ROOM_NAMES.indexOf(n);return i<0?99:i;};
const CHANNELS=['微信直订','电话直订','老客回头','朋友介绍','到店预订','携程','美团','飞猪','抖音','其他'];
const STATUSES=['已预订','已入住','已退房','已取消','待确认'];
const ACTIVE=['已预订','已入住','已退房'];
const PICKUPS=['需接船','无需接船','待确认','已安排','已接到'];
const TICKETS=['待确认','未购票','已购票','有变动','停航/取消'];
const GUEST_TYPES=['未记录','情侣/夫妻','亲子家庭','朋友同行','独自出行','其他'];
const PORTS=['半升洞','沈家湾','东福山','青浜岛'];
const KEY='haichun.zkb.v2', OLD_KEY='haichun.bookings.v1', BKEY='haichun.zkb.lastBackup', EKEY='haichun.zkb.exp.v1';
const EXP_CATS=['早餐食材','员工菜钱','员工餐费','维修五金','水','饮料','接待招待','客人代买','其他'];
const EXP_PAY=['微信','支付宝','现金','其他'];
const STATUS_CLS={'已预订':'p-booked','已入住':'p-in','已退房':'p-out','已取消':'p-cancel','待确认':'p-pending'};
const BACKUP_DAYS=7;

const $=(id)=>document.getElementById(id);
const esc=(s)=>String(s??'').replace(/[&<>"']/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad=(n)=>String(n).padStart(2,'0');
function today(){const d=new Date();return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());}
function addDays(s,n){const d=new Date(s+'T00:00:00');d.setDate(d.getDate()+n);return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());}
function days(a,b){return Math.round((Date.parse(b+'T00:00:00Z')-Date.parse(a+'T00:00:00Z'))/864e5);}
function dateOK(v){return typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v+'T00:00:00Z'));}
const WD='日一二三四五六';
function wd(s){return '周'+WD[new Date(s+'T00:00:00').getDay()];}
function cn(s){return dateOK(s)?Number(s.slice(5,7))+'月'+Number(s.slice(8,10))+'日':'';}
const md=cn;
function hm(iso){const t=iso?new Date(iso):null;return t&&!isNaN(t)?pad(t.getHours())+':'+pad(t.getMinutes()):'';}
const cents=(v)=>v===null||v===undefined||v===''?null:Math.round(Number(v)*100);
function yuan(c){if(c===null||c===undefined)return '—';const n=c/100;return n.toLocaleString('zh-CN',{minimumFractionDigits:Number.isInteger(n)?0:2,maximumFractionDigits:2});}
function moneyIn(v){if(v===''||v===null||v===undefined)return null;const n=Number(v);if(!Number.isFinite(n)||n<0)throw new Error('金额须为非负数');return Math.round(n*100)/100;}
function newId(){return (window.crypto&&crypto.randomUUID)?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2);}
function toast(t){const el=$('toast');el.textContent=t;el.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>{el.hidden=true;},Math.max(2600,String(t).length*110));}
const nowISO=()=>new Date().toISOString();

/* ---------- 存储 ---------- */
let all=[], exps=[];
function blank(over){const b=Object.assign({id:'',order:'',name:'',phone:'',room:'',checkin:'',checkout:'',bookingDate:today(),adults:2,children:0,channel:'微信直订',status:'已预订',
 pricingMode:'nightly',nightlyRate:null,amount:null,paid:null,refund:null,reference:'',group:'',origin:'',guestType:'未记录',
 arrival:{date:'',time:'',port:'',ship:'',ticket:'待确认'},departure:{date:'',time:'',port:'',ship:'',ticket:'待确认'},pickup:'需接船',arrivedAt:'',notes:'',tasks:[],deleted:false,deletedAt:'',createdAt:'',updatedAt:''},over||{});
 b.arrival=Object.assign({date:'',time:'',port:'',ship:'',ticket:'待确认'},b.arrival||{});b.departure=Object.assign({date:'',time:'',port:'',ship:'',ticket:'待确认'},b.departure||{});
 if(!Array.isArray(b.tasks))b.tasks=[];return b;}
/* 旧版（一条含多间房）→ 新版，纯函数，不碰存储 */
function migrateOld(old){const out=[];(old||[]).forEach((b)=>{if(!b)return;const rooms=b.rooms&&b.rooms.length?b.rooms:['听风'];const n=rooms.length;const oid=n>1?newId():'';
 rooms.forEach((rm)=>{out.push(blank({id:newId(),order:oid,name:b.guest||'',phone:b.phone||'',room:rm,checkin:b.checkin,checkout:b.checkout,
  channel:({'微信':'微信直订','电话':'电话直订','老客回头':'老客回头','朋友介绍':'朋友介绍','抖音':'抖音'})[b.channel]||'其他',status:({booked:'已预订',in:'已入住',out:'已退房',cancel:'已取消'})[b.status]||'已预订',
  adults:b.people||2,nightlyRate:b.price||null,amount:b.total!=null?Math.round(b.total/n*100)/100:null,pricingMode:'total',paid:b.received!=null?Math.round(b.received/n*100)/100:null,
  pickup:b.pickup?'需接船':'无需接船',arrival:{date:b.checkin,time:'',port:'',ship:b.ferry||'',ticket:'待确认'},notes:b.note||'',createdAt:b.createdAt||nowISO(),updatedAt:b.updatedAt||nowISO()}));});});
 return out;}
function load(){
 try{const v=JSON.parse(localStorage.getItem(KEY)||'null');if(Array.isArray(v))return v.map((x)=>blank(x));}catch(e){}
 try{const old=JSON.parse(localStorage.getItem(OLD_KEY)||'[]');if(Array.isArray(old)&&old.length){const out=migrateOld(old);try{localStorage.setItem(KEY,JSON.stringify(out));}catch(e){}return out;}}catch(e){}
 return [];}
function loadExp(){try{const v=JSON.parse(localStorage.getItem(EKEY)||'[]');return Array.isArray(v)?v:[];}catch(e){return [];}}
const FULL='手机存储空间不足，没能保存，内容已恢复到修改前。请先备份，再清理回收站。';
function persist(){try{localStorage.setItem(KEY,JSON.stringify(all));return true;}catch(e){return false;}}
function persistExp(){try{localStorage.setItem(EKEY,JSON.stringify(exps));return true;}catch(e){return false;}}
/* 事务：先快照，改完写入；写入失败就整体回滚，页面和存储保持一致 */
function tx(fn,opts){const o=opts||{};const sa=JSON.stringify(all),se=JSON.stringify(exps);
 try{const r=fn();if(r===false)throw new Error('');if(o.recs!==false&&!persist())throw new Error(FULL);if(o.exp&&!persistExp())throw new Error(FULL);return true;}
 catch(e){all=JSON.parse(sa);exps=JSON.parse(se);try{if(o.recs!==false)localStorage.setItem(KEY,sa);if(o.exp)localStorage.setItem(EKEY,se);}catch(_){}
  if(e&&e.message)toast(e.message);return false;}}
const txExp=(fn)=>tx(fn,{recs:false,exp:true});

const live=()=>all.filter((r)=>!r.deleted);
const isActive=(r)=>!r.deleted&&ACTIVE.includes(r.status);
const okey=(r)=>r.order||r.id;
function orderOf(r){const k=okey(r);return live().filter((x)=>okey(x)===k).sort((a,b)=>roomIdx(a.room)-roomIdx(b.room));}
function groupOrders(list){const m=new Map();list.forEach((r)=>{const k=okey(r);if(!m.has(k))m.set(k,[]);m.get(k).push(r);});return [...m.values()].map((g)=>g.sort((a,b)=>roomIdx(a.room)-roomIdx(b.room)));}
function overlap(a,b){return a.room===b.room&&a.checkin<b.checkout&&b.checkin<a.checkout;}
function conflictOf(rec,exceptIds,pool){const ex=exceptIds instanceof Set?exceptIds:new Set([exceptIds]);
 if(!ACTIVE.includes(rec.status)||!rec.room||!dateOK(rec.checkin)||!dateOK(rec.checkout)||rec.checkout<=rec.checkin)return null;
 return (pool||all).find((r)=>!ex.has(r.id)&&r.id!==rec.id&&isActive(r)&&overlap(r,rec))||null;}
const nightsOf=(r)=>dateOK(r.checkin)&&dateOK(r.checkout)?Math.max(0,days(r.checkin,r.checkout)):0;
function netPaid(r){return (cents(r.paid)||0)-(cents(r.refund)||0);}
function owe(r){if(r.amount===null||r.amount===undefined||r.status==='已取消')return null;return cents(r.amount)-netPaid(r);}
/* 订单汇总：多间房只算一次收款 */
function sumOrder(g){const live_=g.filter((r)=>r.status!=='已取消');const missing=live_.some((r)=>r.amount==null);
 const amount=live_.reduce((a,r)=>a+(cents(r.amount)||0),0), paid=g.reduce((a,r)=>a+(cents(r.paid)||0),0), refund=g.reduce((a,r)=>a+(cents(r.refund)||0),0);
 const net=paid-refund, n=nightsOf(g[0]);return {rooms:g.length,nights:n,roomNights:n*g.length,amount:missing?null:amount,known:amount,paid,refund,net,owe:missing?null:amount-net,missing};}
function payState(s,status){if(status==='已取消')return s.net>0?['待退款核对','p-bad']:['已取消','p-cancel'];
 if(s.missing)return ['金额待补','p-pending'];if(s.owe<0)return ['待核对','p-bad'];if(s.net<=0&&s.amount>0)return ['未收','p-warn'];if(s.owe>0)return ['部分已收','p-warn'];return ['已收齐','p-out'];}
function pickTxt(r){if(r.pickup==='无需接船')return '无需接船';const l=r.arrival||{};const t=l.date&&l.date!==r.checkin?cn(l.date)+' ':'';
 return (r.pickup==='待确认'?'接船待确认':r.pickup)+' · '+(l.port||'出发港待确认')+' · '+(l.time?t+l.time+' 出发':'时间待确认');}

/* ---------- 路由 ---------- */
let tab='today', dayView=today(), calStart=today(), statMonth=today().slice(0,7);
const filt={q:'',status:'',channel:'',month:''};
let expOpen=false, expEdit='', expDel='', settleAsk='', pendingPurge=false, swReady=false, detailConfirm=false;
function setTab(t){tab=t;document.querySelectorAll('#tabs button').forEach((b)=>{if(b.dataset.tab===t)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
 try{history.replaceState(null,'','#'+t);}catch(e){}render();window.scrollTo(0,0);}
document.querySelectorAll('#tabs button').forEach((b)=>b.addEventListener('click',()=>setTab(b.dataset.tab)));
$('newBtn').addEventListener('click',()=>openEditor(null));
function render(){const v=$('view');
 if(tab==='today')v.innerHTML=viewToday();else if(tab==='ledger')v.innerHTML=viewLedger();else if(tab==='calendar')v.innerHTML=viewCalendar();else if(tab==='stats')v.innerHTML=viewStats();else v.innerHTML=viewBackup();
 bindView();}

/* ---------- 今日安排 ---------- */
function lastBackup(){try{return localStorage.getItem(BKEY);}catch(e){return null;}}
function backupBanner(){if(!all.length)return '';const l=lastBackup();const dd=l?Math.floor((Date.now()-Date.parse(l))/864e5):null;if(l&&dd<BACKUP_DAYS)return '';
 return `<div class="banner"><div><b>${l?'已经 '+dd+' 天没备份':'还没有备份过'}</b>数据只存在这台手机里，不会自动同步。手机丢失、清理浏览器数据都会丢。</div><button type="button" class="sm pri" data-tab-go="backup">去备份</button></div>`;}
function plates(g){return g.map((r)=>`<span class="plate">${esc(r.room)}</span>`).join('');}
function nextOf(r){return live().find((x)=>x.id!==r.id&&okey(x)!==okey(r)&&ACTIVE.includes(x.status)&&x.room===r.room&&x.checkin===r.checkout)||null;}
function nextHTML(g,d){if(g[0].checkout>addDays(d,1))return '';const out=[];g.forEach((r)=>{const n=nextOf(r);if(!n)return;const l=n.arrival&&(!n.arrival.date||n.arrival.date===n.checkin)?n.arrival:null;
 out.push(`<div class="next"><b>${esc(r.room)}</b> ${n.checkin===d?'本日':cn(n.checkin)}换客：<button type="button" class="link" data-open="${esc(n.id)}">${esc(n.name)}</button> · ${l&&l.time?'船 <b>'+esc(l.time)+'</b>'+(l.port?' '+esc(l.port):''):'船班时间待确认'}</div>`);});return out.join('');}
function tasksHTML(r){const ts=(r.tasks||[]);if(!ts.length)return '';return `<ul class="todo">${ts.map((t,i)=>`<li><label class="chk"><input type="checkbox" data-tdone="${esc(r.id)}" data-ti="${i}"${t.done?' checked':''}><span class="${t.done?'done':''}">${t.priority==='重要'?'<em class="imp">重要</em>':''}${esc(t.text)}${t.due?'<small> · '+cn(t.due)+'</small>':''}</span></label></li>`).join('')}</ul>`;}
function noteHTML(r){return r.notes?`<p class="tnote">${esc(r.notes).replace(/\n/g,'<br>')}</p>`:'';}
function routeIn(r){if(r.pickup==='无需接船')return '<div class="route muted">无需接船</div>';const l=r.arrival||{};const other=l.date&&l.date!==r.checkin;
 return `<div class="route">${esc(l.port||'出发港待确认')} ${l.time?'<b>'+esc(l.time)+'</b> 出发':'<span class="warnTxt">时间待确认</span>'}${other?' <span class="warnTxt">（船班日期 '+cn(l.date)+'，请核对）</span>':''}${l.ship?' · '+esc(l.ship):''}${r.pickup==='已安排'||r.pickup==='已接到'||r.pickup==='待确认'?' · '+esc(r.pickup==='待确认'?'接船待确认':r.pickup):''}</div>`;}
function routeOut(r){const l=r.departure||{};if(!(l.time||l.port||l.ship))return '<div class="route muted">返程船班未填</div>';return `<div class="route">${esc(l.port||'')} ${l.time?'<b>'+esc(l.time)+'</b>':''}${l.ship?' · '+esc(l.ship):''}</div>`;}
function arriveCtl(g,d){const r=g[0];const ids=g.map((x)=>x.id).join(',');
 if(g.every((x)=>x.status==='已入住'||x.status==='已退房'))return `<span class="arrived">✓ 已到店${r.arrivedAt?' '+hm(r.arrivedAt):''}</span>${g.some((x)=>x.status==='已入住')?`<button type="button" class="link undo" data-unarrive="${esc(ids)}">撤销</button>`:''}`;
 if(d>today())return '<span class="pill p-pending">待到店</span>';
 return `<button type="button" class="arrive" data-arrive="${esc(ids)}">到店</button>`;}
function orderCard(g,kind,d){const r=g[0],s=sumOrder(g),done=kind==='in'&&g.every((x)=>x.status!=='已预订');const adults=g.reduce((a,x)=>a+(Number(x.adults)||0),0),kids=g.reduce((a,x)=>a+(Number(x.children)||0),0);
 const money=s.owe>0?`<div class="owe big">待收 ${yuan(s.owe)} 元</div>`:(s.missing?'<div class="muted small">房费金额待补</div>':'');
 return `<article class="ticket t-${kind}${done?' done':''}"><div class="thead"><button type="button" class="tname" data-open="${esc(r.id)}">${esc(r.name)}</button>${plates(g)}${kind==='in'?'<span class="tact">'+arriveCtl(g,d)+'</span>':''}</div>
 <div class="tmeta">${kind==='in'?cn(r.checkout)+'离店':cn(r.checkin)+'入住'} · ${s.nights} 晚${g.length>1?' · '+g.length+' 间':''} · ${adults} 位成人${kids?' '+kids+' 位儿童':''}${r.phone?' · '+esc(r.phone):''}</div>
 ${kind==='in'?routeIn(r):routeOut(r)}${noteHTML(r)}${tasksHTML(r)}${money}${nextHTML(g,d)}</article>`;}
function viewToday(){const d=dayView,isToday=d===today(),act=live().filter((r)=>ACTIVE.includes(r.status));
 const arrR=act.filter((r)=>r.checkin===d), depR=act.filter((r)=>r.checkout===d), stay=act.filter((r)=>r.checkin<=d&&r.checkout>d);
 const tkey=(g)=>(g[0].arrival&&g[0].arrival.time)||'99';
 const arr=groupOrders(arrR).sort((a,b)=>(a.every((x)=>x.status!=='已预订')?1:0)-(b.every((x)=>x.status!=='已预订')?1:0)||tkey(a).localeCompare(tkey(b)));
 const dep=groupOrders(depR).sort((a,b)=>((a[0].departure.time)||'99').localeCompare((b[0].departure.time)||'99'));
 const inHouse=groupOrders(stay.filter((r)=>r.checkin<d)).filter((g)=>g.some((r)=>r.notes||(r.tasks||[]).some((t)=>!t.done))||(g[0].checkout===addDays(d,1)&&g.some((r)=>nextOf(r))));
 const arrived=arrR.filter((r)=>r.status!=='已预订').length, checkedIn=stay.filter((r)=>r.status==='已入住').length;
 const shown=new Set(arrR.concat(depR).map((r)=>r.id));
 const pend=groupOrders(live().filter((r)=>r.status==='待确认'&&r.checkout>d));
 const tasks=[];live().forEach((r)=>{if(shown.has(r.id))return;(r.tasks||[]).forEach((t,i)=>{if(!t.done&&t.due&&t.due<=d)tasks.push({r,t,i});});});
 tasks.sort((a,b)=>(a.t.priority==='重要'?0:1)-(b.t.priority==='重要'?0:1)||a.t.due.localeCompare(b.t.due));
 let h=backupBanner()+`<section class="hero"><div class="hero-date"><b>${cn(d)}</b><span>${wd(d)} · 庙子湖${isToday?' · 今天':''}</span></div>
 <div class="hero-sum"><span><b>${arrived}<small>/${arrR.length} 间</small></b>已到店</span><span><b>${depR.length}<small> 间</small></b>当日离店</span><span><b>${stay.length}<small>/6 间</small></b>当晚占房${stay.length?'<i>已住 '+checkedIn+' · 待到 '+(stay.length-checkedIn)+'</i>':''}</span></div>
 <div class="daynav"><button type="button" class="sm" data-day="-1">‹ 前一天</button><input type="date" id="dayPick" value="${esc(d)}" aria-label="安排日期"><button type="button" class="sm" data-day="1">后一天 ›</button>${isToday?'':'<button type="button" class="sm" data-day="0">回到今天</button>'}</div></section>`;
 h+=`<section class="sec"><div class="sec-h"><h3>当日到店</h3><span>${arr.length?arr.length+' 单 · 按船班时间':''}</span></div>${arr.length?'<div class="list">'+arr.map((g)=>orderCard(g,'in',d)).join('')+'</div>':'<div class="empty">这一天没有客人到店</div>'}</section>`;
 if(dep.length)h+=`<section class="sec"><div class="sec-h"><h3>当日离店</h3><span>${dep.length} 单 · 退房 9:30 前</span></div><div class="list">${dep.map((g)=>orderCard(g,'out',d)).join('')}</div></section>`;
 if(inHouse.length)h+=`<section class="sec"><div class="sec-h"><h3>在住客人 · 注意事项</h3><span>${inHouse.length} 单</span></div><div class="list">${inHouse.map((g)=>`<article class="ticket mini"><div class="thead"><button type="button" class="tname" data-open="${esc(g[0].id)}">${esc(g[0].name)}</button>${plates(g)}<span class="tact muted small">${cn(g[0].checkout)}离店</span></div>${noteHTML(g[0])}${tasksHTML(g[0])}${nextHTML(g,d)}</article>`).join('')}</div></section>`;
 if(tasks.length)h+=`<section class="sec"><div class="sec-h"><h3>其他到期事项</h3><span>含过期未完成</span></div><div class="list">${tasks.map(({r,t,i})=>`<div class="row"><div class="main"><div class="t">${t.priority==='重要'?'<em class="imp">重要</em>':''}${esc(t.text)}</div><div class="m">${esc(r.name)} · ${esc(r.room)} · ${t.due<d?'已过期 '+cn(t.due):'当日'}</div></div><div class="r"><button type="button" class="sm" data-done="${esc(r.id)}" data-ti="${i}">完成</button></div></div>`).join('')}</div></section>`;
 if(pend.length)h+=`<section class="sec"><div class="sec-h"><h3>待确认的预订</h3><span>不占房，确认后改成已预订</span></div><div class="list">${pend.map((g)=>ledgerRow(g)).join('')}</div></section>`;
 h+=`<section class="sec"><div class="sec-h"><h3>六间房 · 当晚</h3><button type="button" class="link" data-tab-go="calendar">房态日历 →</button></div><div class="rooms6">${ROOMS.map(([n])=>{const r=stay.find((x)=>x.room===n);
  if(!r)return `<div class="rm"><b>${n}</b><div class="gs">空房</div></div>`;
  const st=r.status==='已入住'?'<span class="ok">已入住</span>':`<span>${r.checkin===today()?'本日入住':cn(r.checkin)+'入住'}</span><span class="warnTxt">待到店</span>`;
  const nx=r.checkout===addDays(d,1)?nextOf(r):null;
  return `<div class="rm occ${r.status==='已入住'?'':' wait'}" data-open="${esc(r.id)}" role="button" tabindex="0"><b>${n}</b><div class="gn">${esc(r.name)}</div><div class="gs">${st}<span>${cn(r.checkout)}离店</span></div>${nx?`<div class="nx">次日换客${nx.arrival&&nx.arrival.time?' · 船 '+esc(nx.arrival.time):''}</div>`:''}</div>`;}).join('')}</div></section>`;
 h+=expSection(d);
 return h;}

/* ---------- 花费小记 ---------- */
const liveExp=()=>exps.filter((x)=>!x.deleted);
function expSum(list){return list.reduce((a,x)=>a+(cents(x.amount)||0),0);}
function expRow(x,withDate){return `<div class="row exp${x.settled?' settled':''}"><button type="button" class="main plain" data-expedit="${esc(x.id)}"><div class="t">${esc(x.purpose)}<small>${withDate?cn(x.date)+' · ':''}${esc(x.category)}</small></div><div class="m">${esc(x.pay)}${x.payer&&x.payer!=='自己'?' · '+esc(x.payer)+'垫付':''}${x.room?' · '+esc(x.room):''}${x.note?' · '+esc(x.note):''} · ${x.settled?'已结算':'待结算'}</div></button><div class="r"><b class="amt">${yuan(cents(x.amount))}</b></div></div>`;}
function expForm(x){const v=x||{category:EXP_CATS[0],pay:EXP_PAY[0],payer:'自己',room:'',note:'',purpose:'',amount:''};
 return `<form class="card expform" id="expForm" autocomplete="off"><div class="sec-h" style="margin:0"><h3>${x?'修改这笔花费':'记一笔'}</h3>${x?`<span>${cn(x.date)}</span>`:''}</div>
 <div class="field-row"><label>花费金额（元） <b>*</b><input id="xAmt" inputmode="decimal" value="${esc(v.amount??'')}" placeholder="如 36.5"></label><label>用途 <b>*</b><input id="xPur" value="${esc(v.purpose)}" placeholder="如 买鸡蛋、修水龙头"></label></div>
 <div class="field-row"><label>类别<select id="xCat">${[...new Set(EXP_CATS.concat([v.category]))].map((c)=>`<option${c===v.category?' selected':''}>${esc(c)}</option>`).join('')}</select></label><label>付款方式<select id="xPay">${EXP_PAY.map((c)=>`<option${c===v.pay?' selected':''}>${c}</option>`).join('')}</select></label></div>
 <div class="field-row"><label>谁垫付<input id="xWho" value="${esc(v.payer||'自己')}" placeholder="自己 / 合伙人姓名"></label><label>关联房间（可选）<select id="xRoom"><option value="">不关联</option>${ROOM_NAMES.map((n)=>`<option${n===v.room?' selected':''}>${n}</option>`).join('')}</select></label></div>
 <label>备注（可选）<input id="xNote" value="${esc(v.note||'')}" placeholder="商家、票据情况等"></label>
 ${x?`<label class="chk"><input type="checkbox" id="xSettled"${x.settled?' checked':''}> 已结算${x.settled&&x.settledAt?'（'+cn(x.settledAt.slice(0,10))+'）':''}</label>`:''}
 <div class="actions">${x?(expDel===x.id?`<span class="confirm">删除这笔？<button type="button" class="sm danger" id="xDelYes">删除</button><button type="button" class="sm" id="xDelNo">保留</button></span>`:'<button type="button" class="sm" id="xDel">删除</button>'):''}<span style="flex:1"></span><button type="button" id="xCancel">取消</button><button type="submit" class="pri">${x?'保存修改':'记下'}</button></div></form>`;}
function expSection(d){const dx=liveExp().filter((x)=>x.date===d).sort((a,b)=>(a.createdAt||'').localeCompare(b.createdAt||''));const ex=expEdit?exps.find((x)=>x.id===expEdit):null;
 return `<section class="sec" id="expSec"><div class="sec-h"><h3>当日花费</h3><span>${dx.length?dx.length+' 笔 · 合计 <b class="ink">'+yuan(expSum(dx))+' 元</b>':'还没有记录'}</span></div>
 ${dx.length?'<div class="list">'+dx.map((x)=>expRow(x)).join('')+'</div>':''}
 ${ex||expOpen?expForm(ex):'<div class="actions"><button type="button" class="pri" id="expNew">记一笔</button></div>'}</section>`;}

/* ---------- 预订台账 ---------- */
function ledgerRow(g){const r=g[0],s=sumOrder(g),[ps,pc]=payState(s,r.status);
 return `<button type="button" class="row lrow" data-open="${esc(r.id)}"><div class="main"><div class="t">${esc(r.name)} ${plates(g)}</div>
 <div class="m ink">${cn(r.checkin)} 入住 → ${cn(r.checkout)} 离店 · ${s.nights} 晚${g.length>1?' · '+g.length+' 间 · '+s.roomNights+' 间夜':''}</div>
 <div class="m">${esc(pickTxt(r))}</div><div class="m">${esc(r.channel)}${r.phone?' · '+esc(r.phone):''}</div></div>
 <div class="r"><span class="pill ${STATUS_CLS[r.status]}">${esc(r.status)}</span><br><span class="pill ${pc}">${ps}</span>
 <div class="money">${s.amount!=null?'房费 '+yuan(s.amount):'房费待补'}<br>已收 ${yuan(s.net)}${s.owe>0?`<br><b class="owe">待收 ${yuan(s.owe)}</b>`:''}</div></div></button>`;}
function filtered(){const q=filt.q.trim().toLowerCase();return live().filter((r)=>(!filt.status||r.status===filt.status)&&(!filt.channel||r.channel===filt.channel)&&(!filt.month||r.checkin.slice(0,7)===filt.month)
 &&(!q||[r.name,r.phone,r.reference,r.notes,r.group,r.origin,r.room].join(' ').toLowerCase().includes(q)));}
function viewLedger(){const rows=filtered(),months=[...new Set(live().map((r)=>r.checkin.slice(0,7)))].sort().reverse();
 const orders=groupOrders(rows).sort((a,b)=>b[0].checkin.localeCompare(a[0].checkin)||roomIdx(a[0].room)-roomIdx(b[0].room));
 let h=`<h2>预订台账</h2><p class="lede">一单可以包含多间房；收款按整单记，不会重复计算。</p>
 <div class="filters"><input id="fq" placeholder="搜称呼、电话、房间、订单号、备注" value="${esc(filt.q)}" aria-label="搜索">
 <select id="fs" aria-label="状态"><option value="">全部状态</option>${STATUSES.map((s)=>`<option${filt.status===s?' selected':''}>${s}</option>`).join('')}</select>
 <select id="fc" aria-label="渠道"><option value="">全部渠道</option>${CHANNELS.map((s)=>`<option${filt.channel===s?' selected':''}>${s}</option>`).join('')}</select>
 <select id="fm" aria-label="入住月份"><option value="">全部月份</option>${months.map((m)=>`<option value="${m}"${filt.month===m?' selected':''}>${Number(m.slice(5))}月入住（${m.slice(0,4)}）</option>`).join('')}</select></div>
 <p class="muted small" style="margin:0 0 8px">当前 ${orders.length} 单 · ${rows.length} 间房记录</p>`;
 if(!orders.length)return h+(live().length?'<div class="empty"><b>没有符合条件的登记</b>换个搜索词或筛选条件。</div>':'<div class="empty"><b>还没有登记</b>微信、电话、到店的预订都记在这里。<div class="actions" style="justify-content:center"><button type="button" class="pri" data-new>新建第一条登记</button></div></div>');
 return h+'<div class="list">'+orders.map((g)=>ledgerRow(g)).join('')+'</div>';}

/* ---------- 房态日历 ---------- */
function viewCalendar(){const ds=[...Array(14)].map((_,i)=>addDays(calStart,i)),t=today();
 let h=`<h2>房态日历</h2><p class="lede">同一间房日期重叠会拦下；离店当天可以安排下一位入住。</p>
 <div class="daynav"><button type="button" class="sm" data-cal="-7">前一周</button><input type="date" id="calPick" value="${esc(calStart)}" aria-label="起始日期"><button type="button" class="sm" data-cal="7">后一周</button>${calStart===t?'':'<button type="button" class="sm" data-cal="0">从今天看</button>'}</div>
 <div class="cal-wrap"><table class="cal"><thead><tr><th class="room"></th>${ds.map((d,i)=>{const w=new Date(d+'T00:00:00').getDay();return `<th class="${d===t?'td':(w===0||w===6)?'we':''}">${i===0||d.slice(8)==='01'?Number(d.slice(5,7))+'月':''}${Number(d.slice(8))}日<br>${wd(d).slice(1)}</th>`;}).join('')}</tr></thead><tbody>`;
 ROOMS.forEach(([n])=>{h+=`<tr><th class="room">${n}</th>`;ds.forEach((d,i)=>{const r=live().find((x)=>ACTIVE.includes(x.status)&&x.room===n&&x.checkin<=d&&x.checkout>d);
  if(!r){h+='<td></td>';return;}const first=r.checkin===d||i===0;h+=`<td><button type="button" class="${first?'':'cont'}${r.status==='已预订'?' wait':''}" data-open="${esc(r.id)}" aria-label="${esc(n+' '+cn(d)+' '+r.name)}">${esc(r.name)}</button></td>`;});h+='</tr>';});
 return h+`</tbody></table></div><p class="legend">深色为已入住或已退房，浅色为已预订待到店 · 「待确认」「已取消」不占房 · 手机上可左右滑动。</p>`;}

/* ---------- 经营概览 ---------- */
function monthRange(m){const s=m+'-01';const d=new Date(s+'T00:00:00');d.setMonth(d.getMonth()+1);return [s,d.getFullYear()+'-'+pad(d.getMonth()+1)+'-01'];}
function allocated(r,s,e){const n=nightsOf(r);if(!n||r.amount==null)return null;const a=r.checkin>s?r.checkin:s,b=r.checkout<e?r.checkout:e;const k=Math.max(0,days(a,b));return Math.round(cents(r.amount)*k/n);}
function mlabel(m){return m.slice(0,4)+'年'+Number(m.slice(5))+'月';}
function viewStats(){const [s,e]=monthRange(statMonth);const recs=live();
 const act=recs.filter((r)=>ACTIVE.includes(r.status)&&r.checkin<e&&r.checkout>s);
 let nights=0,knownN=0,alloc=0;const byRoom=ROOM_NAMES.map((n)=>({n,v:0}));
 act.forEach((r)=>{const a=r.checkin>s?r.checkin:s,b=r.checkout<e?r.checkout:e,k=days(a,b);nights+=k;const br=byRoom.find((x)=>x.n===r.room);if(br)br.v+=k;const al=allocated(r,s,e);if(al!=null){knownN+=k;alloc+=al;}});
 const bookedR=recs.filter((r)=>r.bookingDate>=s&&r.bookingDate<e),booked=groupOrders(bookedR),canc=booked.filter((g)=>g[0].status==='已取消');
 const lead=booked.filter((g)=>g[0].status!=='已取消'&&dateOK(g[0].bookingDate)).map((g)=>days(g[0].bookingDate,g[0].checkin));
 const avgLead=lead.length?(lead.reduce((a,b)=>a+b,0)/lead.length):null;
 const ch=CHANNELS.map((c)=>({c,v:booked.filter((g)=>g[0].channel===c).length})).filter((x)=>x.v);
 const maxR=Math.max(1,...byRoom.map((x)=>x.v)),maxC=Math.max(1,...ch.map((x)=>x.v));
 const months=[...new Set(recs.flatMap((r)=>[r.checkin.slice(0,7),(r.bookingDate||'').slice(0,7)]).concat(liveExp().map((x)=>x.date.slice(0,7))).filter(Boolean).concat([today().slice(0,7)]))].sort().reverse();
 return `<h2>经营概览</h2><p class="lede">只统计这本台账里登记过的订单。</p>
 <div class="daynav"><select id="statM" aria-label="统计月份" style="width:auto">${months.map((m)=>`<option value="${m}"${m===statMonth?' selected':''}>${mlabel(m)}</option>`).join('')}</select></div>
 <div class="grid3"><div class="kpi"><div class="l">已登记间夜</div><div class="v">${nights}<small>间夜</small></div><div class="s">按住宿日 · 不含待确认、取消</div></div>
 <div class="kpi"><div class="l">分摊房费</div><div class="v">${yuan(alloc)}<small>元</small></div><div class="s">${nights?'有金额的 '+knownN+'/'+nights+' 间夜':'—'}</div></div>
 <div class="kpi"><div class="l">新增预订</div><div class="v">${booked.length}<small>单</small></div><div class="s">${bookedR.length} 间房记录 · 取消 ${canc.length} 单${avgLead!=null?' · 平均提前 '+avgLead.toFixed(1)+' 天':''}</div></div></div>
 <section class="sec"><div class="sec-h"><h3>各房间已登记间夜</h3><span>入住日计入，离店日不计</span></div><div class="card bars">${byRoom.map((x)=>`<div class="bar"><span>${x.n}</span><span class="track"><i style="width:${(x.v/maxR*100).toFixed(1)}%"></i></span><span>${x.v} 间夜</span></div>`).join('')}</div></section>
 <section class="sec"><div class="sec-h"><h3>新增预订来自哪里</h3><span>按预订日 · 按单计 · 含取消</span></div>${ch.length?`<div class="card bars">${ch.map((x)=>`<div class="bar"><span>${esc(x.c)}</span><span class="track"><i style="width:${(x.v/maxC*100).toFixed(1)}%"></i></span><span>${x.v} 单</span></div>`).join('')}</div>`:'<div class="empty">这个月还没有新增预订</div>'}</section>
 ${advHTML(s,e)}
 <p class="note">分摊房费 = 每间房房费 ÷ 总晚数 × 本月住宿晚数，不是财务收入，不含佣金和退款；金额没填的间夜不按 0 元算。没有完整的可售房晚数据，所以不算入住率和 RevPAR。</p>`;}
function rangeTxt(list){if(!list.length)return '';const ds=list.map((x)=>x.date).sort();return ds[0]===ds[ds.length-1]?cn(ds[0]):cn(ds[0])+'–'+cn(ds[ds.length-1]);}
function advHTML(s,e){const mx=liveExp().filter((x)=>x.date>=s&&x.date<e),pendAll=liveExp().filter((x)=>!x.settled).sort((a,b)=>a.date.localeCompare(b.date));
 const mPend=mx.filter((x)=>!x.settled),settledRecent=liveExp().filter((x)=>x.settled).sort((a,b)=>(b.settledAt||'').localeCompare(a.settledAt||'')).slice(0,10);
 const cat=[...new Set(EXP_CATS.concat(mx.map((x)=>x.category)))].map((c)=>({c,v:expSum(mx.filter((x)=>x.category===c))})).filter((x)=>x.v);const maxV=Math.max(1,...cat.map((x)=>x.v));
 const who=[...new Set(pendAll.map((x)=>x.payer||'自己'))].map((w)=>({w,v:expSum(pendAll.filter((x)=>(x.payer||'自己')===w))}));
 const ask=(list,lbl)=>`<div class="confirm block">将把 <b>${list.length} 笔、${yuan(expSum(list))} 元</b>标记为已结算，日期范围 <b>${rangeTxt(list)}</b>（${lbl}）。<div class="actions"><button type="button" class="sm danger" id="settleYes">确认结算</button><button type="button" class="sm" id="settleNo">取消</button></div></div>`;
 return `<section class="sec"><div class="sec-h"><h3>垫付总计</h3><span>来自「当日花费」</span></div>
 <div class="grid3"><div class="kpi"><div class="l">本月花费</div><div class="v">${yuan(expSum(mx))}<small>元</small></div><div class="s">${mx.length} 笔</div></div>
 <div class="kpi"><div class="l">本月待结算</div><div class="v">${yuan(expSum(mPend))}<small>元</small></div><div class="s">${mPend.length} 笔未结</div></div>
 <div class="kpi"><div class="l">全部待结算</div><div class="v">${yuan(expSum(pendAll))}<small>元</small></div><div class="s">${who.length?who.map((x)=>esc(x.w)+' '+yuan(x.v)).join(' · '):'全部已结清'}</div></div></div>
 ${cat.length?`<div class="card bars" style="margin-top:10px">${cat.map((x)=>`<div class="bar"><span>${esc(x.c)}</span><span class="track"><i style="width:${(x.v/maxV*100).toFixed(1)}%"></i></span><span>${yuan(x.v)} 元</span></div>`).join('')}</div>`:'<div class="empty" style="margin-top:10px">这个月还没有记花费</div>'}
 ${pendAll.length?`<div class="sec-h" style="margin-top:16px"><h3>待结算明细</h3><span>${pendAll.length} 笔 · ${rangeTxt(pendAll)}</span></div><div class="list">${pendAll.map((x)=>`<div class="row exp"><div class="main"><div class="t">${esc(x.purpose)}<small>${cn(x.date)} · ${esc(x.category)}</small></div><div class="m">${esc(x.payer||'自己')}垫付 · ${esc(x.pay)}${x.note?' · '+esc(x.note):''}</div></div><div class="r"><b class="amt">${yuan(cents(x.amount))}</b><button type="button" class="sm" data-settle="${esc(x.id)}">结算</button></div></div>`).join('')}</div>
 ${settleAsk==='month'?ask(mPend,mlabel(statMonth)):settleAsk==='all'?ask(pendAll,'全部月份'):`<div class="actions">${mPend.length?`<button type="button" class="sm" data-settleask="month">结算${mlabel(statMonth)}待结（${mPend.length} 笔）</button>`:''}${pendAll.length>mPend.length?`<button type="button" class="sm" data-settleask="all">结算全部待结（${pendAll.length} 笔）</button>`:''}</div>`}`:''}
 ${settledRecent.length?`<details style="margin-top:12px"><summary>最近已结算（可撤销）</summary><div class="list">${settledRecent.map((x)=>`<div class="row exp settled"><div class="main"><div class="t">${esc(x.purpose)}<small>${cn(x.date)}</small></div><div class="m">结算于 ${cn((x.settledAt||'').slice(0,10))}</div></div><div class="r"><b class="amt">${yuan(cents(x.amount))}</b><button type="button" class="sm" data-unsettle="${esc(x.id)}">撤销结算</button></div></div>`).join('')}</div></details>`:''}
 </section>`;}

/* ---------- 备份与导出 ---------- */
function viewBackup(){const last=lastBackup();const dd=last?Math.floor((Date.now()-Date.parse(last))/864e5):null;
 const trash=all.filter((r)=>r.deleted).sort((a,b)=>(b.deletedAt||'').localeCompare(a.deletedAt||''));
 const months=[...new Set(live().map((r)=>r.checkin.slice(0,7)).concat([today().slice(0,7)]))].sort().reverse();
 return `<h2>备份与导出</h2><p class="lede"><b class="ink">仅保存在这台手机里，没有和其他手机、电脑同步。</b>换手机、清理浏览器数据前一定要先备份。</p>
 <div class="card"><div class="sec-h"><h3>完整备份</h3><span class="${!last||dd>=BACKUP_DAYS?'owe':''}">${last?'上次备份 '+cn(last.slice(0,10))+(dd>=BACKUP_DAYS?'，已 '+dd+' 天':''):(all.length?'还没备份过':'')}</span></div>
 <p class="muted small" style="margin:0">建议每周备份一次，存到微信文件传输助手或网盘。备份含客人电话，只存在自己的设备里。换手机时在新手机上「导入备份」恢复。</p>
 <div class="actions"><button type="button" class="pri" id="bkBtn">下载完整备份</button><button type="button" id="rsBtn">导入备份</button><input type="file" id="rsFile" accept=".json,application/json" hidden></div></div>
 <div class="card sec"><div class="sec-h"><h3>按月导出对账表</h3><span>CSV，Excel、WPS 可打开</span></div>
 <div class="field-row"><label>月份<select id="exM">${months.map((m)=>`<option value="${m}">${mlabel(m)}</option>`).join('')}</select></label>
 <label>口径<select id="exMode"><option value="checkin">本月入住的订单</option><option value="stay">本月有住宿日（含跨月）</option></select></label></div>
 <div class="actions"><button type="button" id="exBtn">导出本月登记</button><button type="button" id="exAll">导出全部登记</button><button type="button" id="exExp">导出本月花费</button></div>
 <p class="note">一行一间房；多间房的订单，收款按房费比例分到每间，合计等于整单收款。累计收款没有收款日期，不能当作当月现金收入。</p></div>
 <div class="card sec"><div class="sec-h"><h3>回收站</h3><span>${trash.length} 条</span></div>${trash.length?'<div class="list">'+trash.map((r)=>`<div class="row"><div class="main"><div class="t">${esc(r.name)}<small>${esc(r.room)} · ${cn(r.checkin)}–${cn(r.checkout)}</small></div><div class="m">删除于 ${cn((r.deletedAt||'').slice(0,10))}</div></div><div class="r"><button type="button" class="sm" data-restore="${esc(r.id)}">恢复</button></div></div>`).join('')+'</div>':'<p class="muted small" style="margin:0">删除的登记先放在这里，可以恢复。</p>'}
 ${trash.length?(pendingPurge?'<div class="confirm" style="margin-top:10px">清空后无法恢复，确定？<button type="button" class="sm danger" id="purgeYes">清空回收站</button><button type="button" class="sm" id="purgeNo">先不清</button></div>':'<div class="actions"><button type="button" class="sm" id="purgeBtn">清空回收站</button></div>'):''}</div>
 <div class="card sec"><div class="sec-h"><h3>离线与安装</h3><span id="swState">${swReady?'离线页面已就绪':'离线页面准备中'}</span></div>
 <p class="muted small" style="margin:0">iPhone：用 Safari 打开，点分享 →「添加到主屏幕」，以后只从桌面图标打开。桌面图标和 Safari 里的数据是分开的两份。</p>
 <div class="actions"><button type="button" class="sm" id="persistBtn">申请保留本机数据</button></div></div>`;}

/* ---------- 事件绑定 ---------- */
function byIds(s){const ids=String(s).split(',');return all.filter((r)=>ids.includes(r.id));}
function bindView(){const v=$('view');
 v.querySelectorAll('[data-open]').forEach((el)=>{el.addEventListener('click',()=>openDetail(el.dataset.open));el.addEventListener('keydown',(e)=>{if(e.key==='Enter')openDetail(el.dataset.open);});});
 v.querySelectorAll('[data-new]').forEach((el)=>el.addEventListener('click',()=>openEditor(null)));
 v.querySelectorAll('[data-tab-go]').forEach((el)=>el.addEventListener('click',()=>setTab(el.dataset.tabGo)));
 v.querySelectorAll('[data-day]').forEach((el)=>el.addEventListener('click',()=>{const n=Number(el.dataset.day);dayView=n===0?today():addDays(dayView,n);expOpen=false;expEdit='';render();}));
 const dp=$('dayPick');if(dp)dp.addEventListener('change',()=>{if(dateOK(dp.value)){dayView=dp.value;render();}});
 v.querySelectorAll('[data-cal]').forEach((el)=>el.addEventListener('click',()=>{const n=Number(el.dataset.cal);calStart=n===0?today():addDays(calStart,n);render();}));
 const cp=$('calPick');if(cp)cp.addEventListener('change',()=>{if(dateOK(cp.value)){calStart=cp.value;render();}});
 v.querySelectorAll('[data-tdone]').forEach((el)=>el.addEventListener('change',()=>{const id=el.dataset.tdone,i=Number(el.dataset.ti),val=el.checked;tx(()=>{const r=all.find((x)=>x.id===id);if(!r||!r.tasks[i])return false;r.tasks[i].done=val;r.updatedAt=nowISO();});render();}));
 v.querySelectorAll('[data-done]').forEach((el)=>el.addEventListener('click',()=>{const id=el.dataset.done,i=Number(el.dataset.ti);if(tx(()=>{const r=all.find((x)=>x.id===id);if(!r||!r.tasks[i])return false;r.tasks[i].done=true;r.updatedAt=nowISO();}))toast('事项已完成');render();}));
 const fq=$('fq');if(fq){fq.addEventListener('input',()=>{filt.q=fq.value;const pos=fq.selectionStart;render();const n=$('fq');n.focus();try{n.setSelectionRange(pos,pos);}catch(e){}});
  [['fs','status'],['fc','channel'],['fm','month']].forEach(([id,k])=>$(id).addEventListener('change',()=>{filt[k]=$(id).value;render();}));}
 v.querySelectorAll('[data-arrive]').forEach((el)=>el.addEventListener('click',()=>{const ids=el.dataset.arrive;const t=nowISO();let name='';
  if(tx(()=>{const g=byIds(ids);if(!g.length)return false;name=g[0].name;g.forEach((r)=>{if(r.status==='已预订'){r.status='已入住';r.arrivedAt=t;r.updatedAt=t;}});}))toast(name+' 已到店');render();}));
 v.querySelectorAll('[data-unarrive]').forEach((el)=>el.addEventListener('click',()=>{const ids=el.dataset.unarrive;if(tx(()=>{byIds(ids).forEach((r)=>{if(r.status==='已入住'){r.status='已预订';r.arrivedAt='';r.updatedAt=nowISO();}});}))toast('已撤销到店');render();}));
 // 花费
 if($('expNew'))$('expNew').onclick=()=>{expOpen=true;expEdit='';expDel='';render();const a=$('xAmt');if(a)a.focus();};
 v.querySelectorAll('[data-expedit]').forEach((el)=>el.addEventListener('click',()=>{expEdit=el.dataset.expedit;expOpen=false;expDel='';render();const f=$('expForm');if(f)f.scrollIntoView({block:'center'});}));
 const xf=$('expForm');if(xf){
  $('xCancel').onclick=()=>{expOpen=false;expEdit='';expDel='';render();};
  if($('xDel'))$('xDel').onclick=()=>{expDel=expEdit;render();};
  if($('xDelNo'))$('xDelNo').onclick=()=>{expDel='';render();};
  if($('xDelYes'))$('xDelYes').onclick=()=>{const id=expEdit;if(txExp(()=>{const x=exps.find((y)=>y.id===id);if(!x)return false;x.deleted=true;x.updatedAt=nowISO();}))toast('已删除');expEdit='';expDel='';render();};
  xf.addEventListener('submit',(e)=>{e.preventDefault();let amt;try{amt=moneyIn($('xAmt').value.trim());}catch(err){toast('金额要填非负数字');return;}
   const pur=$('xPur').value.trim();if(amt==null||amt<=0){toast('先填花费金额');$('xAmt').focus();return;}if(!pur){toast('写一下用途');$('xPur').focus();return;}
   const t=nowISO(),fields={amount:amt,purpose:pur.slice(0,60),category:$('xCat').value,pay:$('xPay').value,payer:($('xWho').value.trim()||'自己').slice(0,20),room:$('xRoom').value,note:$('xNote').value.trim().slice(0,100)};
   const id=expEdit;const st=$('xSettled')?$('xSettled').checked:null;
   const ok=txExp(()=>{if(id){const x=exps.find((y)=>y.id===id);if(!x)return false;Object.assign(x,fields,{updatedAt:t});if(st!==null&&st!==!!x.settled){x.settled=st;x.settledAt=st?t:'';}}
    else exps.push(Object.assign({id:newId(),date:dayView},fields,{settled:false,settledAt:'',deleted:false,createdAt:t,updatedAt:t}));});
   if(!ok)return;toast(id?'已保存修改':'已记 '+yuan(Math.round(amt*100))+' 元');expOpen=false;expEdit='';render();});}
 v.querySelectorAll('[data-settle]').forEach((el)=>el.addEventListener('click',()=>{const id=el.dataset.settle;if(txExp(()=>{const x=exps.find((y)=>y.id===id);if(!x)return false;x.settled=true;x.settledAt=x.updatedAt=nowISO();}))toast('已结算，可在「最近已结算」撤销');render();}));
 v.querySelectorAll('[data-unsettle]').forEach((el)=>el.addEventListener('click',()=>{const id=el.dataset.unsettle;if(txExp(()=>{const x=exps.find((y)=>y.id===id);if(!x)return false;x.settled=false;x.settledAt='';x.updatedAt=nowISO();}))toast('已撤销结算');render();}));
 v.querySelectorAll('[data-settleask]').forEach((el)=>el.addEventListener('click',()=>{settleAsk=el.dataset.settleask;render();}));
 if($('settleNo'))$('settleNo').onclick=()=>{settleAsk='';render();};
 if($('settleYes'))$('settleYes').onclick=()=>{const [s,e]=monthRange(statMonth);const scope=settleAsk;const t=nowISO();let n=0;
  if(txExp(()=>{liveExp().forEach((x)=>{if(!x.settled&&(scope==='all'||(x.date>=s&&x.date<e))){x.settled=true;x.settledAt=x.updatedAt=t;n++;}});}))toast('已结算 '+n+' 笔');settleAsk='';render();};
 const sm=$('statM');if(sm)sm.addEventListener('change',()=>{statMonth=sm.value;settleAsk='';render();});
 if($('bkBtn')){$('bkBtn').addEventListener('click',backup);$('rsBtn').addEventListener('click',()=>$('rsFile').click());$('rsFile').addEventListener('change',restore);
  $('exBtn').addEventListener('click',()=>exportCSV($('exM').value,$('exMode').value));$('exAll').addEventListener('click',()=>exportCSV('',''));$('exExp').addEventListener('click',()=>exportExp($('exM').value));
  v.querySelectorAll('[data-restore]').forEach((el)=>el.addEventListener('click',()=>{const r=all.find((x)=>x.id===el.dataset.restore);if(!r)return;const c=conflictOf(Object.assign({},r,{deleted:false}),r.id);if(c){toast(r.room+' 这几天已被 '+c.name+' 占用，先改日期或取消那条');return;}
   if(tx(()=>{r.deleted=false;r.deletedAt='';r.updatedAt=nowISO();}))toast('已恢复');render();}));
  if($('purgeBtn'))$('purgeBtn').addEventListener('click',()=>{pendingPurge=true;render();});
  if($('purgeYes'))$('purgeYes').addEventListener('click',()=>{if(tx(()=>{all=all.filter((r)=>!r.deleted);}))toast('回收站已清空');pendingPurge=false;render();});
  if($('purgeNo'))$('purgeNo').addEventListener('click',()=>{pendingPurge=false;render();});
  $('persistBtn').addEventListener('click',async()=>{try{const ok=navigator.storage&&navigator.storage.persist?await navigator.storage.persist():false;toast(ok?'系统已同意保留本机数据':'系统没有承诺保留，请定期备份');}catch(e){toast('系统没有承诺保留，请定期备份');}});}
}

/* ---------- 详情（按整单） ---------- */
function openDetail(id){const r=all.find((x)=>x.id===id);if(!r)return;detailConfirm=false;drawDetail(id);const d=$('detail');if(!d.open)d.showModal();}
function legTxt(l){if(!l||!(l.date||l.time||l.port||l.ship))return '未填写';return [l.date?cn(l.date):'',l.time,l.port,l.ship].filter(Boolean).join(' · ')+'（船票'+l.ticket+'）';}
function drawDetail(id){const d=$('detail'),r0=all.find((x)=>x.id===id);if(!r0){d.close();return;}const g=r0.deleted?[r0]:orderOf(r0),r=g[0],s=sumOrder(g),[ps,pc]=payState(s,r.status);
 const ids=new Set(g.map((x)=>x.id));const cs=g.map((x)=>conflictOf(x,ids)).filter(Boolean);
 d.innerHTML=`<div class="dlg"><div class="dlg-h"><h3>${esc(r.name)}</h3><button type="button" class="sm" data-x>关闭</button></div><div class="dlg-b">
 ${cs.length?`<div class="conflict bad">${cs.map((c)=>esc(c.room)+' 和 '+esc(c.name)+'（'+cn(c.checkin)+'–'+cn(c.checkout)+'）重叠').join('；')}，请核对。</div>`:''}
 <div class="dhead">${plates(g)}<span class="pill ${STATUS_CLS[r.status]}">${esc(r.status)}</span><span class="pill ${pc}">${ps}</span></div>
 <dl class="kv"><dt>住宿</dt><dd>${cn(r.checkin)} 入住 → ${cn(r.checkout)} 离店 · ${s.nights} 晚${g.length>1?' · '+g.length+' 间 · '+s.roomNights+' 间夜':''}</dd>
 ${r.arrivedAt?`<dt>到店</dt><dd>${cn(r.arrivedAt.slice(0,10))} ${hm(r.arrivedAt)}</dd>`:''}
 <dt>电话</dt><dd>${r.phone?esc(r.phone):'未记录'}</dd>
 <dt>房间</dt><dd>${g.map((x)=>`${esc(x.room)}：${x.adults} 位成人${x.children?' '+x.children+' 位儿童':''} · ${x.amount!=null?yuan(cents(x.amount))+' 元':'金额待补'}${x.nightlyRate!=null&&x.pricingMode==='nightly'?'（每晚 '+yuan(cents(x.nightlyRate))+'）':''}`).join('<br>')}</dd>
 <dt>房费合计</dt><dd>${s.amount!=null?yuan(s.amount)+' 元':'金额待补'+(s.known?'（已填 '+yuan(s.known)+' 元）':'')}</dd>
 <dt>收款</dt><dd>已收 ${yuan(s.paid)}${s.refund?' · 已退 '+yuan(s.refund):''}${s.owe!=null?(s.owe>0?` · <b class="owe">待收 ${yuan(s.owe)}</b>`:s.owe<0?` · <span class="owe">多收 ${yuan(-s.owe)}，请核对</span>`:' · 已收齐'):''}</dd>
 <dt>接船</dt><dd>${esc(pickTxt(r))}</dd><dt>来程</dt><dd>${esc(legTxt(r.arrival))}</dd><dt>返程</dt><dd>${esc(legTxt(r.departure))}</dd>
 ${g.map((x)=>{const n=nextOf(x);if(!n)return '';const l=n.arrival;return `<dt>下一位</dt><dd>${esc(x.room)}：${esc(n.name)} · ${cn(n.checkin)}入住 · ${l&&l.time?'船 '+esc(l.time):'船班时间待确认'}</dd>`;}).join('')}
 <dt>渠道</dt><dd>${esc(r.channel)}${r.reference?' · '+esc(r.reference):''} · 预订日 ${cn(r.bookingDate)||'—'}</dd>
 ${r.group?`<dt>同行编号</dt><dd>${esc(r.group)}</dd>`:''}${r.origin?`<dt>客源地</dt><dd>${esc(r.origin)}</dd>`:''}
 <dt>备注</dt><dd>${r.notes?esc(r.notes).replace(/\n/g,'<br>'):'暂无'}</dd>
 <dt>事项</dt><dd>${(r.tasks||[]).length?r.tasks.map((t,i)=>`<label class="chk"><input type="checkbox" data-task="${i}"${t.done?' checked':''}> ${t.priority==='重要'?'<b style="color:var(--bad)">重要</b> ':''}${esc(t.text)}${t.due?' · '+cn(t.due):''}</label>`).join(''):'暂无'}</dd></dl>
 ${r0.deleted?'':`<label>修改整单状态<select id="dStatus">${STATUSES.map((x)=>`<option${x===r.status?' selected':''}>${x}</option>`).join('')}</select></label>`}
 </div><div class="dlg-f">${r0.deleted?'':(detailConfirm?`<span class="confirm">整单${g.length>1?'（'+g.length+' 间）':''}移入回收站？之后可以恢复。<button type="button" class="sm danger" id="dDelYes">移入回收站</button><button type="button" class="sm" id="dDelNo">保留</button></span>`:`<button type="button" class="sm" id="dDel">删除</button>`)+
 (s.owe>0?'<button type="button" class="sm" id="dPaid">尾款已收齐</button>':'')+'<button type="button" class="pri" id="dEdit">编辑登记</button>'}</div></div>`;
 d.querySelector('[data-x]').onclick=()=>d.close();
 const gids=g.map((x)=>x.id).join(',');
 d.querySelectorAll('[data-task]').forEach((el)=>el.onchange=()=>{const i=Number(el.dataset.task),val=el.checked;tx(()=>{const x=all.find((y)=>y.id===r.id);if(!x||!x.tasks[i])return false;x.tasks[i].done=val;x.updatedAt=nowISO();});drawDetail(id);render();});
 if($('dStatus'))$('dStatus').onchange=()=>{const ns=$('dStatus').value;const gs=byIds(gids);const idset=new Set(gs.map((x)=>x.id));
  const cc=gs.map((x)=>conflictOf(Object.assign({},x,{status:ns}),idset)).find(Boolean);if(cc){toast(cc.room+' 这几天已被 '+cc.name+' 占用，不能改成'+ns);$('dStatus').value=r.status;return;}
  if(tx(()=>{const t=nowISO();byIds(gids).forEach((x)=>{x.status=ns;if(ns==='已入住'&&!x.arrivedAt)x.arrivedAt=t;if(ns==='已预订')x.arrivedAt='';x.updatedAt=t;});}))toast('整单状态已改为'+ns);drawDetail(id);render();};
 if($('dPaid'))$('dPaid').onclick=()=>{if(tx(()=>{byIds(gids).forEach((x)=>{if(x.amount!=null&&x.status!=='已取消'){x.paid=Math.round(cents(x.amount)+(cents(x.refund)||0))/100;x.updatedAt=nowISO();}});}))toast('已记为尾款收齐');drawDetail(id);render();};
 if($('dEdit'))$('dEdit').onclick=()=>{d.close();openEditor(id);};
 if($('dDel'))$('dDel').onclick=()=>{detailConfirm=true;drawDetail(id);};
 if($('dDelNo'))$('dDelNo').onclick=()=>{detailConfirm=false;drawDetail(id);};
 if($('dDelYes'))$('dDelYes').onclick=()=>{if(tx(()=>{const t=nowISO();byIds(gids).forEach((x)=>{x.deleted=true;x.deletedAt=t;x.updatedAt=t;});}))toast('已移入回收站');d.close();render();};}

/* ---------- 新建 / 编辑（一单可多间房） ---------- */
let ed=null, edDirty=false, edConfirmClose=false, edShipNote='';
const SHARED=['name','phone','checkin','checkout','bookingDate','channel','status','reference','group','origin','guestType','pickup','notes','arrivedAt'];
function openEditor(id){const src=id?all.find((x)=>x.id===id):null;const g=src?orderOf(src):[];
 if(src&&!g.length)g.push(src);
 const b=JSON.parse(JSON.stringify(g[0]||blank()));
 ed={_isNew:!src,_ids:g.map((x)=>x.id),order:src?(g.length>1?okey(src):src.order||''):'',children:g.reduce((a,x)=>a+(Number(x.children)||0),0),
  arrival:b.arrival,departure:b.departure,tasks:g.flatMap((x)=>x.tasks||[]).map((t)=>Object.assign({},t)),
  paid:g.length?g.reduce((a,x)=>a+(cents(x.paid)||0),0)/100:null,refund:g.reduce((a,x)=>a+(cents(x.refund)||0),0)/100||null,
  rooms:g.map((x)=>({id:x.id,room:x.room,adults:x.adults,nightlyRate:x.nightlyRate,amount:x.amount,pricingMode:x.pricingMode||'nightly'}))};
 if(g.length&&g.every((x)=>x.paid==null))ed.paid=null;
 SHARED.forEach((k)=>{ed[k]=b[k];});
 edDirty=false;edConfirmClose=false;edShipNote='';drawEditor();const d=$('editor');if(!d.open)d.showModal();}
function portSel(v){const other=v&&!PORTS.includes(v);
 return `<label>出发港<select id="ePort"><option value="">待确认</option>${PORTS.map((p)=>`<option${p===v?' selected':''}>${p}</option>`).join('')}<option value="__o"${other?' selected':''}>其他地点…</option></select></label>
 <label id="ePortOtherW"${other?'':' hidden'}>其他出发地点<input id="ePortOther" value="${other?esc(v):''}" placeholder="如 沈家门"></label>`;}
function drawEditor(){const d=$('editor'),r=ed;
 d.innerHTML=`<form class="dlg" id="edForm" novalidate><div class="dlg-h"><h3>${r._isNew?'新建登记':'编辑登记'}</h3><button type="button" class="sm" id="edClose">关闭</button></div><div class="dlg-b">
 <div class="field-row"><label>客人称呼 <b>*</b><input id="eName" value="${esc(r.name)}" placeholder="怎样称呼客人" autocomplete="off"></label><label>联系电话<input id="ePhone" type="tel" inputmode="numeric" pattern="1[0-9]{10}" oninput="this.value=this.value.replace(/\\D/g,'').slice(0,11)" value="${esc(r.phone)}" placeholder="11 位手机号" autocomplete="off"></label></div>
 <div class="field-row"><label>入住日期 <b>*</b><input type="date" id="eIn" value="${esc(r.checkin)}"></label><label>离店日期 <b>*</b><input type="date" id="eOut" value="${esc(r.checkout)}"></label></div>
 <div><div class="flabel">选择房间 <b>*</b><span>可多选，一单多间</span></div><div class="roomsel" id="eRooms"></div></div>
 <div id="eConflict"></div>
 <div id="eRoomRows" class="rrows"></div>
 <div class="field-row"><label>整单已收款（元）<input type="number" inputmode="decimal" min="0" step="0.01" id="ePaid" value="${r.paid??''}" placeholder="未收填 0"></label><label>整单已退款（元）<input type="number" inputmode="decimal" min="0" step="0.01" id="eRefund" value="${r.refund??''}" placeholder="没有可不填"></label></div>
 <div class="calc" id="eCalc"></div>
 <fieldset class="pick"><legend>接船</legend>
 <div class="field-row"><label>是否接船<select id="ePickup">${PICKUPS.map((p)=>`<option${p===r.pickup?' selected':''}>${p}</option>`).join('')}</select></label><label>出发时间<input type="time" id="eArrTime" value="${esc(r.arrival.time)}"></label></div>
 <div class="field-row">${portSel(r.arrival.port)}</div>
 <p class="shipnote" id="eShipNote"${edShipNote?'':' hidden'}>${esc(edShipNote)}</p></fieldset>
 <label>备注 / 注意事项（今日安排里会显示）<textarea id="eNotes" placeholder="例如：带儿童、行李较多、对海鲜过敏">${esc(r.notes)}</textarea></label>
 <details><summary>船班日期、船票与返程</summary><div class="inner">
  <div class="field-row"><label>来程船班日期<input type="date" id="eArrDate" value="${esc(r.arrival.date)}"></label><label>来程船名 / 航次<input id="eArrShip" value="${esc(r.arrival.ship)}" placeholder="可选"></label></div>
  <label>来程船票<select id="eArrTk">${TICKETS.map((t)=>`<option${t===r.arrival.ticket?' selected':''}>${t}</option>`).join('')}</select></label>
  <div class="field-row"><label>返程日期<input type="date" id="eDepDate" value="${esc(r.departure.date)}"></label><label>返程时间<input type="time" id="eDepTime" value="${esc(r.departure.time)}"></label></div>
  <div class="field-row"><label>返程到达港<input id="eDepPort" value="${esc(r.departure.port)}" placeholder="如 半升洞"></label><label>返程船票<select id="eDepTk">${TICKETS.map((t)=>`<option${t===r.departure.ticket?' selected':''}>${t}</option>`).join('')}</select></label></div>
 </div></details>
 <details><summary>儿童、渠道与其他资料</summary><div class="inner">
  <div class="field-row"><label>儿童数（整单）<input type="number" min="0" max="20" step="1" id="eCh" value="${r.children||0}"></label><label>同行类型<select id="eGT">${GUEST_TYPES.map((x)=>`<option${x===r.guestType?' selected':''}>${x}</option>`).join('')}</select></label></div>
  <div class="field-row"><label>预订渠道<select id="eChan">${CHANNELS.map((c)=>`<option${c===r.channel?' selected':''}>${c}</option>`).join('')}</select></label><label>实际预订日<input type="date" id="eBk" value="${esc(r.bookingDate)}"></label></div>
  <div class="field-row"><label>订单号（OTA 选填）<input id="eRef" value="${esc(r.reference)}"></label><label>客源地<input id="eOrigin" value="${esc(r.origin)}" placeholder="如 上海"></label></div>
  ${r.group?`<label>同行编号（旧版字段）<input id="eGroup" value="${esc(r.group)}"></label>`:''}
  ${r._isNew?'':`<label>订单状态<select id="eStatus">${STATUSES.map((x)=>`<option${x===r.status?' selected':''}>${x}</option>`).join('')}</select></label>`}
 </div></details>
 <details${(r.tasks||[]).length?' open':''}><summary>事项（需要逐项跟进时添加）</summary><div class="inner" id="eTasks"></div><div class="actions"><button type="button" class="sm" id="eAddTask">添加事项</button></div></details>
 </div><div class="dlg-f"><p class="err" id="eErr" role="alert"></p>${edConfirmClose?'<span class="confirm">还没保存，放弃本次修改？<button type="button" class="sm danger" id="edDiscard">放弃</button><button type="button" class="sm" id="edKeep">继续编辑</button></span>':'<button type="button" id="edCancel">取消</button><button type="submit" class="pri">保存登记</button>'}</div></form>`;
 drawRooms();drawRoomRows();drawTasks();recalc();
 const f=$('edForm');
 f.addEventListener('input',()=>{edDirty=true;$('eErr').textContent='';});
 $('eIn').addEventListener('change',()=>{const old=ed.checkin;sync();const ni=ed.checkin;
  if(dateOK(ni)&&(!dateOK(ed.checkout)||ed.checkout<=ni)){ed.checkout=addDays(ni,1);$('eOut').value=ed.checkout;}
  if(dateOK(ni)&&ni!==old){const ad=ed.arrival.date;if(!ad||ad===old){if(ad){ed.arrival.date=ni;$('eArrDate').value=ni;}edShipNote=ed.arrival.time||ed.arrival.port?'入住日期改为 '+cn(ni)+'，来程船班日期已一起改，请向客人核对船班时间。':'';}
   else edShipNote='入住日期改为 '+cn(ni)+'，但来程船班日期还是 '+cn(ad)+'，请核对。';const sn=$('eShipNote');sn.textContent=edShipNote;sn.hidden=!edShipNote;}
  drawRooms();drawRoomRows();recalc();});
 $('eOut').addEventListener('change',()=>{sync();drawRooms();drawRoomRows();recalc();});
 $('ePaid').addEventListener('input',()=>{sync();recalc();});$('eRefund').addEventListener('input',()=>{sync();recalc();});
 $('ePort').addEventListener('change',()=>{const o=$('ePort').value==='__o';$('ePortOtherW').hidden=!o;if(o)$('ePortOther').focus();});
 $('eAddTask').addEventListener('click',()=>{sync();ed.tasks.push({text:'',done:false,due:ed.checkin||today(),priority:'普通'});drawTasks();});
 f.addEventListener('submit',(e)=>{e.preventDefault();submitEditor();});
 {const t=$('eArrTime');const seed=()=>{if(!t.value)t.value='08:05';};t.addEventListener('pointerdown',seed);t.addEventListener('focus',seed);}
 const close=()=>{if(edDirty){edConfirmClose=true;sync();drawEditor();}else d.close();};
 $('edClose').onclick=close;if($('edCancel'))$('edCancel').onclick=close;
 if($('edDiscard'))$('edDiscard').onclick=()=>{edDirty=false;d.close();};
 if($('edKeep'))$('edKeep').onclick=()=>{edConfirmClose=false;drawEditor();edDirty=true;};
 d.oncancel=(e)=>{if(edDirty){e.preventDefault();close();}};}
function edStatus(){return ACTIVE.includes(ed.status)?ed.status:'已预订';}
function drawRooms(){const box=$('eRooms');if(!box)return;box.innerHTML='';const own=new Set(ed._ids);const sel=new Set(ed.rooms.map((x)=>x.room));
 ROOMS.forEach(([n,desc])=>{const c=conflictOf({room:n,checkin:ed.checkin,checkout:ed.checkout,status:edStatus(),id:'__'},own);
  const b=document.createElement('button');b.type='button';b.setAttribute('aria-pressed',sel.has(n)?'true':'false');if(c)b.className='taken';b.textContent=n;const s=document.createElement('span');s.textContent=c?('已被 '+c.name+' 占用'):desc;b.appendChild(s);
  b.onclick=()=>{sync();const i=ed.rooms.findIndex((x)=>x.room===n);if(i>=0)ed.rooms.splice(i,1);else{const tpl=ed.rooms[0];ed.rooms.push({id:'',room:n,adults:Math.min(2,ROOMS.find((x)=>x[0]===n)[2]),nightlyRate:tpl?tpl.nightlyRate:null,amount:null,pricingMode:'nightly'});ed.rooms.sort((a,b2)=>roomIdx(a.room)-roomIdx(b2.room));}
   edDirty=true;drawRooms();drawRoomRows();recalc();};box.appendChild(b);});
 const cf=$('eConflict');if(!ed.rooms.length||!dateOK(ed.checkin)||!dateOK(ed.checkout)){cf.innerHTML='';return;}
 if(ed.checkout<=ed.checkin){cf.innerHTML='<div class="conflict bad">离店日期要晚于入住日期。</div>';return;}
 const bad=ed.rooms.map((x)=>({x,c:conflictOf({room:x.room,checkin:ed.checkin,checkout:ed.checkout,status:edStatus(),id:'__'},own)})).filter((y)=>y.c);
 cf.innerHTML=bad.length?`<div class="conflict bad">${bad.map((y)=>esc(y.x.room)+' 在 '+cn(y.c.checkin)+'–'+cn(y.c.checkout)+' 已被 '+esc(y.c.name)+' 占用').join('；')}，不能保存。请换房或调整日期。</div>`:`<div class="conflict">${ed.rooms.map((x)=>esc(x.room)).join('、')} 这几天可登记。</div>`;}
function drawRoomRows(){const box=$('eRoomRows');if(!box)return;const n=nightsOf(ed);
 if(!ed.rooms.length){box.innerHTML='<p class="muted small" style="margin:0">先选房间，再填每间房的房价。</p>';return;}
 box.innerHTML=ed.rooms.map((x,i)=>`<div class="rrow"><div class="rname">${esc(x.room)}</div>
  <label>成人<input type="number" min="1" max="20" step="1" data-rr="${i}.adults" value="${x.adults??2}"></label>
  <label>每晚房价<input type="number" inputmode="decimal" min="0" step="0.01" data-rr="${i}.nightlyRate" value="${x.nightlyRate??''}" placeholder="元"></label>
  <label>这间合计${x.pricingMode==='total'&&x.amount!=null&&x.nightlyRate!=null&&n&&Math.round(x.nightlyRate*n*100)!==Math.round(x.amount*100)?' <button type="button" class="link" data-rrcalc="'+i+'">按房价重算</button>':''}<input type="number" inputmode="decimal" min="0" step="0.01" data-rr="${i}.amount" value="${x.amount??''}" placeholder="元"></label></div>`).join('');
 box.querySelectorAll('[data-rr]').forEach((el)=>el.addEventListener('input',()=>{const [i,k]=el.dataset.rr.split('.');const x=ed.rooms[Number(i)];if(!x)return;
  if(k==='adults')x.adults=Number(el.value)||1;else{x[k]=el.value===''?null:Number(el.value);x.pricingMode=k==='amount'?'total':'nightly';}
  if(k==='nightlyRate'){autoAmt(x,true);const a=box.querySelector(`[data-rr="${i}.amount"]`);if(a)a.value=x.amount??'';}recalc();}));
 box.querySelectorAll('[data-rrcalc]').forEach((b)=>b.onclick=()=>{const x=ed.rooms[Number(b.dataset.rrcalc)];x.pricingMode='nightly';autoAmt(x,true);drawRoomRows();recalc();});}
function autoAmt(x,force){const n=nightsOf(ed);if(x.pricingMode==='nightly'&&x.nightlyRate!=null&&n&&(force||true))x.amount=Math.round(cents(x.nightlyRate)*n)/100;}
function drawTasks(){const box=$('eTasks');if(!box)return;box.innerHTML=ed.tasks.length?'':'<p class="muted small" style="margin:0">例如：确认来程船票、准备儿童用品。</p>';
 ed.tasks.forEach((t,i)=>{const w=document.createElement('div');w.className='task';w.innerHTML=`<input type="checkbox" data-tk="${i}.done"${t.done?' checked':''} aria-label="事项已完成" style="width:auto"><input data-tk="${i}.text" value="${esc(t.text)}" placeholder="事项内容"><button type="button" class="sm" data-tdel="${i}">移除</button>
  <div class="tsub"><input type="date" data-tk="${i}.due" value="${esc(t.due)}" aria-label="事项日期"><select data-tk="${i}.priority" aria-label="优先级"><option${t.priority==='普通'?' selected':''}>普通</option><option${t.priority==='重要'?' selected':''}>重要</option></select></div>`;box.appendChild(w);});
 box.querySelectorAll('[data-tdel]').forEach((b)=>b.onclick=()=>{sync();ed.tasks.splice(Number(b.dataset.tdel),1);edDirty=true;drawTasks();});}
function sync(){if(!$('edForm'))return;const v=(id)=>$(id)?$(id).value:'';
 ed.name=v('eName').trim();ed.phone=v('ePhone').replace(/\D/g,'');ed.checkin=v('eIn');ed.checkout=v('eOut');ed.notes=v('eNotes').trim();
 ed.paid=v('ePaid')===''?null:Number(v('ePaid'));ed.refund=v('eRefund')===''?null:Number(v('eRefund'));
 ed.pickup=v('ePickup')||ed.pickup;ed.children=Number(v('eCh'))||0;ed.channel=v('eChan')||ed.channel;ed.bookingDate=v('eBk');
 ed.reference=v('eRef').trim();if($('eGroup'))ed.group=v('eGroup').trim();ed.guestType=v('eGT')||ed.guestType;ed.origin=v('eOrigin').trim();
 if($('eStatus'))ed.status=$('eStatus').value;
 const p=v('ePort');ed.arrival.port=p==='__o'?v('ePortOther').trim():p;ed.arrival.time=v('eArrTime');ed.arrival.date=v('eArrDate');ed.arrival.ship=v('eArrShip').trim();ed.arrival.ticket=v('eArrTk')||ed.arrival.ticket;
 ed.departure.date=v('eDepDate');ed.departure.time=v('eDepTime');ed.departure.port=v('eDepPort').trim();ed.departure.ticket=v('eDepTk')||ed.departure.ticket;
 document.querySelectorAll('[data-tk]').forEach((el)=>{const [i,f]=el.dataset.tk.split('.');const t=ed.tasks[Number(i)];if(!t)return;t[f]=f==='done'?el.checked:el.value.trim();});}
function recalc(){const box=$('eCalc');if(!box)return;const n=nightsOf(ed);ed.rooms.forEach((x)=>autoAmt(x));
 box.querySelectorAll&&document.querySelectorAll('[data-rr$=".amount"]').forEach((el)=>{const x=ed.rooms[Number(el.dataset.rr.split('.')[0])];if(x&&document.activeElement!==el)el.value=x.amount??'';});
 const missing=ed.rooms.some((x)=>x.amount==null),amt=ed.rooms.reduce((a,x)=>a+(cents(x.amount)||0),0),net=(cents(ed.paid)||0)-(cents(ed.refund)||0);
 let h=`<span>晚数 <b>${n||'—'}</b></span><span>房间 <b>${ed.rooms.length} 间</b></span><span>间夜 <b>${n*ed.rooms.length||'—'}</b></span><span>总房费 <b>${!ed.rooms.length?'—':missing?'待补'+(amt?'（已填 '+yuan(amt)+'）':''):yuan(amt)+' 元'}</b></span><span>已收 <b>${yuan(net)} 元</b></span>`;
 if(ed.rooms.length&&!missing){const o=amt-net;h+=o>=0?`<span>待收 <b class="${o>0?'owe':''}">${yuan(o)} 元</b></span>`:`<span class="bad">已多收 ${yuan(-o)} 元，请核对</span>`;}
 box.innerHTML=h;}
function submitEditor(){sync();const r=ed,err=(m)=>{$('eErr').textContent=m;$('eErr').scrollIntoView({block:'nearest'});};
 if(!r.name)return err('请填写客人称呼。');
 if(!dateOK(r.checkin)||!dateOK(r.checkout))return err('请选择入住和离店日期。');
 if(r.checkout<=r.checkin)return err('离店日期要晚于入住日期。');
 if(days(r.checkin,r.checkout)>366)return err('住宿超过 366 晚，请核对日期。');
 if(!r.rooms.length)return err('请至少选择一间房。');
 if(r.phone&&!/^1\d{10}$/.test(r.phone))return err('手机号要 11 位数字，以 1 开头。');
 let paid,refund;const rooms=[];
 try{paid=moneyIn(r.paid);refund=moneyIn(r.refund);r.rooms.forEach((x)=>{rooms.push(Object.assign({},x,{nightlyRate:moneyIn(x.nightlyRate),amount:moneyIn(x.amount)}));});}catch(e){return err(e.message);}
 if((refund||0)>(paid||0))return err('已退款不能超过已收款。');
 for(const x of rooms){const cap=(ROOMS.find((y)=>y[0]===x.room)||[])[2];if(cap&&x.adults>cap)return err(x.room+' 按床位最多住 '+cap+' 位成人，请核实或再加一间房。');}
 const own=new Set(r._ids);const status=r._isNew?'已预订':r.status;
 for(const x of rooms){const c=conflictOf({room:x.room,checkin:r.checkin,checkout:r.checkout,status,id:'__'},own);if(c)return err(x.room+' 在 '+cn(c.checkin)+'–'+cn(c.checkout)+' 已被 '+c.name+' 占用，不能保存。');}
 let bk=r.bookingDate;if(!dateOK(bk))bk=r.checkin<today()?r.checkin:today();if(bk>r.checkin)bk=r.checkin;
 const arrival=Object.assign({},r.arrival),departure=Object.assign({},r.departure);
 if(!arrival.date&&(arrival.time||arrival.port||arrival.ship))arrival.date=r.checkin;
 if(!departure.date&&(departure.time||departure.port||departure.ship))departure.date=r.checkout;
 const tasks=(r.tasks||[]).filter((t)=>t.text);
 // 收款按房费比例分到每间，合计不变
 const pc=Math.round((paid||0)*100),rc=Math.round((refund||0)*100);const tot=rooms.reduce((a,x)=>a+(cents(x.amount)||0),0);
 const share=(total)=>{let left=total;return rooms.map((x,i)=>{if(i===rooms.length-1)return left;const v=tot>0?Math.round(total*(cents(x.amount)||0)/tot):(i===0?total:0);left-=v;return v;});};
 const ps=share(pc),rs=share(rc);
 const t=nowISO();const isNew=r._isNew;const multi=rooms.length>1;const order=multi?(r.order||newId()):'';
 const keep=new Set();
 const ok=tx(()=>{rooms.forEach((x,i)=>{let rec=x.id?all.find((y)=>y.id===x.id):null;if(!rec){rec=blank({id:newId(),createdAt:t});all.push(rec);}keep.add(rec.id);
   SHARED.forEach((k)=>{rec[k]=r[k];});rec.status=status;rec.bookingDate=bk;rec.order=order;rec.room=x.room;rec.adults=x.adults||1;rec.children=i===0?(r.children||0):0;
   rec.nightlyRate=x.nightlyRate;rec.amount=x.amount;rec.pricingMode=x.pricingMode;rec.paid=paid==null&&i>0?null:(paid==null?null:ps[i]/100);rec.refund=refund==null?null:rs[i]/100;
   rec.arrival=Object.assign({},arrival);rec.departure=Object.assign({},departure);rec.tasks=i===0?tasks.map((y)=>Object.assign({},y)):[];rec.deleted=false;rec.deletedAt='';rec.updatedAt=t;});
  r._ids.forEach((id)=>{if(!keep.has(id)){const old=all.find((y)=>y.id===id);if(old){old.deleted=true;old.deletedAt=t;old.updatedAt=t;}}});});
 if(!ok)return err(FULL);
 edDirty=false;$('editor').close();toast(isNew?'已保存到本机'+(multi?'（'+rooms.length+' 间）':''):'已保存修改');render();}

/* ---------- 导出 / 备份 ---------- */
async function shareOrDownload(name,text,type){const blob=new Blob([text],{type});
 try{const file=new File([blob],name,{type});if(navigator.canShare&&navigator.canShare({files:[file]})){await navigator.share({files:[file],title:name});return 'shared';}}catch(e){if(e&&e.name==='AbortError')return 'cancel';}
 const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},3000);return 'downloaded';}
function csvCell(v){let s=String(v??'');if(/^[=+\-@\t\r]/.test(s))s="'"+s;return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;}
async function exportCSV(m,mode){let rows=live();let s='',e='';
 if(m){[s,e]=monthRange(m);rows=mode==='stay'?rows.filter((r)=>r.checkin<e&&r.checkout>s):rows.filter((r)=>r.checkin.slice(0,7)===m);}
 rows.sort((a,b)=>a.checkin.localeCompare(b.checkin)||okey(a).localeCompare(okey(b))||roomIdx(a.room)-roomIdx(b.room));
 if(!rows.length){toast('这个范围没有登记');return;}
 const H=['订单','同单房间数','入住','离店','晚数','房间','客人','电话','成人','儿童','渠道','订单号','预订日','状态','本间房费','本间已收（按比例）','本间已退','本间待收','是否接船','出发港','出发时间','来程','返程','备注'].concat(m?['本月间夜','本月分摊房费']:[]);
 const lines=[H.join(',')].concat(rows.map((r)=>{const o=owe(r);const g=orderOf(r);const base=[okey(r).slice(0,8),g.length,r.checkin,r.checkout,nightsOf(r),r.room,r.name,r.phone,r.adults,r.children||0,r.channel,r.reference,r.bookingDate,r.status,
  r.amount??'',r.paid??'',r.refund??'',o==null?'':o/100,r.pickup,r.arrival.port,r.arrival.time,legTxt(r.arrival),legTxt(r.departure),r.notes];
  if(m){const a=r.checkin>s?r.checkin:s,b=r.checkout<e?r.checkout:e,k=ACTIVE.includes(r.status)?Math.max(0,days(a,b)):0;const al=ACTIVE.includes(r.status)?allocated(r,s,e):null;base.push(k,al==null?'':al/100);}
  return base.map(csvCell).join(',');}));
 const name='住客簿_'+(m?m+(mode==='stay'?'_住宿日':'_入住月份'):'全部')+'.csv';
 const res=await shareOrDownload(name,'﻿'+lines.join('\n'),'text/csv');if(res!=='cancel')toast('已导出 '+rows.length+' 间房记录');}
async function exportExp(m){const [s,e]=monthRange(m);const rows=liveExp().filter((x)=>x.date>=s&&x.date<e).sort((a,b)=>a.date.localeCompare(b.date));
 if(!rows.length){toast('这个月没有花费记录');return;}
 const H=['日期','金额','用途','类别','付款方式','垫付人','关联房间','备注','结算状态','结算日期'];
 const lines=[H.join(',')].concat(rows.map((x)=>[x.date,x.amount,x.purpose,x.category,x.pay,x.payer,x.room,x.note,x.settled?'已结算':'待结算',(x.settledAt||'').slice(0,10)].map(csvCell).join(',')));
 lines.push(['合计',expSum(rows)/100].map(csvCell).join(','));
 const res=await shareOrDownload('住客簿_花费_'+m+'.csv','﻿'+lines.join('\n'),'text/csv');if(res!=='cancel')toast('已导出 '+rows.length+' 笔');}
async function backup(){const now=new Date();const name='住客簿备份_'+today()+'.json';
 const res=await shareOrDownload(name,JSON.stringify({app:'haichun-zkb',version:4,exportedAt:now.toISOString(),records:all,expenses:exps},null,1),'application/json');
 if(res!=='cancel'){try{localStorage.setItem(BKEY,now.toISOString());}catch(e){}toast('备份已生成，存到微信或网盘');render();}}
function validRec(x){return x&&typeof x.id==='string'&&x.id&&dateOK(x.checkin)&&dateOK(x.checkout)&&x.checkout>x.checkin&&ROOM_NAMES.includes(x.room)&&STATUSES.includes(x.status||'已预订');}
async function restore(e){const f=e.target.files&&e.target.files[0];e.target.value='';if(!f)return;if(f.size>5*1024*1024){toast('备份不能超过 5MB');return;}
 let d;try{d=JSON.parse(await f.text());}catch(err){toast('这个文件不是住客簿的备份');return;}
 let list=Array.isArray(d)?d:(d&&(d.records||d.bookings));if(!Array.isArray(list)){toast('这个文件不是住客簿的备份');return;}
 if((d&&d.app==='haichun-booking')||(list[0]&&list[0].rooms))list=migrateOld(list);
 let add=0,upd=0,skip=0,bad=0,clash=0,xa=0;const clashes=[];
 const ok=tx(()=>{const pool=all.map((r)=>r);// 先在副本上合并
  list.forEach((raw)=>{if(!validRec(raw)){bad++;return;}const rec=blank(raw);const i=pool.findIndex((y)=>y.id===rec.id);
   if(i>=0&&(rec.updatedAt||'')<=(pool[i].updatedAt||'')){skip++;return;}
   const others=pool.filter((y)=>y.id!==rec.id);const c=!rec.deleted&&ACTIVE.includes(rec.status)?others.find((y)=>isActive(y)&&overlap(y,rec)):null;
   if(c){clash++;if(clashes.length<3)clashes.push(rec.name+'·'+rec.room+' '+cn(rec.checkin));return;}
   if(i>=0){pool[i]=rec;upd++;}else{pool.push(rec);add++;}});
  if(Array.isArray(d.expenses))d.expenses.forEach((x)=>{if(!x||!x.id||!dateOK(x.date)||!(Number(x.amount)>=0))return;const i=exps.findIndex((y)=>y.id===x.id);if(i>=0){if((x.updatedAt||'')>(exps[i].updatedAt||''))exps[i]=x;}else{exps.push(x);xa++;}});
  all=pool;},{exp:true});
 if(!ok)return;render();
 toast('导入完成：新增 '+add+' 条，更新 '+upd+' 条'+(skip?'，较旧跳过 '+skip:'')+(bad?'，格式不对 '+bad:'')+(clash?'，房间冲突未导入 '+clash+'（'+clashes.join('、')+'）':'')+(xa?'，花费 '+xa+' 笔':''));}

/* ---------- 启动 ---------- */
all=load();exps=loadExp();
const h0=(location.hash||'').slice(1);if(['today','ledger','calendar','stats','backup'].includes(h0))tab=h0;
setTab(tab);
function updateChip(){const c=$('offlineChip');c.textContent=navigator.onLine?'仅存本机':'离线 · 仅存本机';c.className='chip'+(navigator.onLine?'':' warn');}
window.addEventListener('online',updateChip);window.addEventListener('offline',updateChip);updateChip();
if('serviceWorker' in navigator){window.addEventListener('load',()=>{navigator.serviceWorker.register('sw.js').then(()=>navigator.serviceWorker.ready).then(()=>{swReady=true;const s=$('swState');if(s)s.textContent='离线页面已就绪';}).catch(()=>{});});}
