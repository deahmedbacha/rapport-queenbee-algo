import {NODES, EDGES, makeGraph, dijkstra} from './algorithm.mjs';

const $ = id => document.getElementById(id);
const graph = makeGraph();
const nodes = new Map(NODES.map(n => [n.id, n]));
const short = id => id === 'COORD-SN-CASA' ? 'Base' : id.startsWith('SN-CASA-') ? `Ruche ${id.slice(-3)}` : id;
const edgeKey = (a,b) => [a,b].sort().join('|');
let result = null, step = 0, elapsed = 0, timer = null, playing = false;

function svg(tag, attrs, parent, text) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key,value] of Object.entries(attrs)) el.setAttribute(key,String(value));
  if (text !== undefined) el.textContent = text;
  parent.append(el);
  return el;
}
function drawGraph() {
  for (const [u,v,w] of EDGES) {
    const a=nodes.get(u), b=nodes.get(v), k=edgeKey(u,v);
    svg('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,class:'edge','data-edge':k},$('graph-edges'));
    const x=(a.x+b.x)/2, y=(a.y+b.y)/2;
    svg('rect',{x:x-12,y:y-10,width:24,height:20,rx:2,class:'edge-label-bg'},$('graph-labels'));
    svg('text',{x,y,class:'edge-weight','data-weight':k},$('graph-labels'),w);
  }
  for (const n of NODES) {
    const g=svg('g',{transform:`translate(${n.x} ${n.y})`,class:`node ${n.type}${n.isolated?' isolated':''}`,'data-node':n.id},$('graph-nodes'));
    if (n.type==='junction') {
      svg('circle',{r:20,class:'node-circle'},g);
      svg('text',{class:'junction-text',y:1},g,n.id);
    } else if (n.type==='base') {
      svg('rect',{x:-44,y:-18,width:88,height:36,rx:3,class:'base-shape'},g);
      svg('text',{class:'base-text',y:1},g,'Base');
      svg('text',{class:'base-subtext',y:35},g,'Coordinateur');
    } else {
      g.setAttribute('role','button');
      g.setAttribute('tabindex','0');
      g.setAttribute('aria-label',`Choisir la ruche ${n.label}${n.isolated?', inaccessible':''}`);
      svg('rect',{x:-23,y:-18,width:46,height:36,rx:3,class:'hive-shape'},g);
      svg('text',{class:'hive-text',y:1},g,n.label);
      if(n.isolated) svg('text',{class:'isolated-note',y:35},g,'isolée');
      const choose=()=>{$('target-select').value=n.id;pending();};
      g.addEventListener('click',choose);
      g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose();}});
    }
    svg('text',{class:'distance-label',y:-29,'data-distance':n.id},g,'');
  }
}
function stop() {
  clearTimeout(timer);
  timer=null; playing=false;
  $('animate-button').textContent='Animer';
}
function paint(frame=null, complete=false) {
  const visited=new Set(frame?.visited ?? []);
  const path=complete ? result.path : [];
  const pathNodes=new Set(path);
  const pathEdges=new Set(path.slice(1).map((n,i)=>edgeKey(path[i],n)));
  document.querySelectorAll('[data-node]').forEach(el=>{
    const id=el.getAttribute('data-node');
    el.classList.toggle('visited',visited.has(id));
    el.classList.toggle('on-route',pathNodes.has(id));
    el.classList.toggle('current',!complete&&frame?.current===id);
    el.classList.toggle('source',id===$('start-select').value);
    el.classList.toggle('target',id===$('target-select').value);
  });
  document.querySelectorAll('[data-edge]').forEach(el=>{
    const key=el.getAttribute('data-edge'), [u,v]=key.split('|');
    el.classList.toggle('route',pathEdges.has(key));
    el.classList.toggle('explored',!complete&&(visited.has(u)||visited.has(v)));
    el.classList.toggle('pending',!complete&&!!frame?.neighbor&&key===edgeKey(frame.current,frame.neighbor));
  });
  document.querySelectorAll('[data-weight]').forEach(el=>el.classList.toggle('route',pathEdges.has(el.getAttribute('data-weight'))));
  document.querySelectorAll('[data-distance]').forEach(el=>{
    const value=frame?.dist[el.getAttribute('data-distance')];
    el.textContent=!frame||complete ? '' : Number.isFinite(value) ? `${value} min` : '∞';
  });
}
function routeText(path) {
  const container=$('route-nodes'); container.replaceChildren();
  path.forEach((n,i)=>{
    if(i){const arrow=document.createElement('span');arrow.className='route-arrow';arrow.textContent='→';container.append(arrow);}
    const point=document.createElement('span');point.className='route-point';point.textContent=short(n);container.append(point);
  });
}
function queue(frame=null, complete=false) {
  document.querySelectorAll('[data-code]').forEach(el=>el.classList.toggle('active',!!frame&&el.getAttribute('data-code')===frame.phase));
  const entries=complete ? [] : frame?.queue ?? [];
  $('queue-count').textContent=`${entries.length} élément${entries.length===1?'':'s'}`;
  $('queue-items').replaceChildren();
  if(!entries.length){const empty=document.createElement('span');empty.className='queue-empty';empty.textContent=complete?'Calcul terminé.':'Lancez l’animation pour voir le tas.';$('queue-items').append(empty);}
  for(const n of entries){
    const pill=document.createElement('span');pill.className='queue-pill';pill.append(short(n.value));
    const cost=document.createElement('strong');cost.textContent=`${n.priority} min`;pill.append(cost);$('queue-items').append(pill);
  }
}
function pending() {
  stop(); result=null; paint(); queue();
  $('animate-button').disabled=true;$('step-button').disabled=true;$('copy-route').disabled=true;
  $('result-title').textContent='À calculer';$('total-cost').textContent='—';$('cost-unit').textContent='min';
  document.querySelector('.cost').classList.remove('unreachable');
  $('result-details').textContent='';$('route-nodes').textContent='Cliquez sur « Calculer le trajet ».';$('compute-time').textContent='—';
  $('result-note').textContent='Les pistes et leurs poids sont ceux du rapport.';
  $('step-title').textContent='Paramètres modifiés.';$('step-caption').textContent='Calculez le trajet pour afficher le résultat.';
}
function calculate() {
  stop();
  const start=$('start-select').value,target=$('target-select').value,t0=performance.now();
  dijkstra(graph,start,target);
  elapsed=performance.now()-t0;
  result=dijkstra(graph,start,target,true);step=result.frames.length-1;
  $('animate-button').disabled=false;$('step-button').disabled=false;
  render();
}
function render() {
  const f=result.frames[step], complete=f.phase==='done', reachable=Number.isFinite(result.cost);
  paint(f,complete);queue(f,complete);
  $('result-title').textContent=complete?(reachable?'Chemin optimal':'Aucun chemin'):'Calcul en cours';
  $('total-cost').textContent=complete?(reachable?String(result.cost):'Inaccessible'):'—';
  $('cost-unit').textContent='min';
  document.querySelector('.cost').classList.toggle('unreachable',complete&&!reachable);
  $('result-details').textContent=complete&&reachable?`${result.path.length-1} tronçon${result.path.length===2?'':'s'} · ${result.path.length} point${result.path.length===1?'':'s'} de passage`:'';
  $('compute-time').textContent=`${elapsed.toLocaleString('fr-FR',{minimumFractionDigits:3,maximumFractionDigits:3})} ms`;
  $('copy-route').disabled=!complete||!reachable;
  if(complete&&reachable) routeText(result.path);
  else $('route-nodes').textContent=complete?'La ruche 099 n’est reliée à aucune piste.':'En cours…';
  $('result-note').textContent=complete&&!reachable?'Le tas est vide et la distance de la ruche reste infinie.':'Poids positifs ou nuls. Calcul effectué dans le navigateur.';
  let title='',caption=`Étape ${step+1}/${result.frames.length}`;
  if(f.phase==='init'){title='Initialisation des distances.';caption+=' — 0 au départ, ∞ ailleurs.';}
  if(f.phase==='visit'){title=`${short(f.current)} : distance fixée à ${f.dist[f.current]} min.`;caption+=' — Extraction du minimum.';}
  if(f.phase==='relax'){title=`${short(f.neighbor)} : meilleur trajet de ${f.dist[f.neighbor]} min.`;caption+=' — Mise à jour du prédécesseur.';}
  if(complete){title=reachable?`Chemin optimal : ${result.cost} minute${result.cost===1?'':'s'}.`:'Aucun itinéraire vers la ruche 099.';caption=reachable?'Cliquez sur Animer ou Pas à pas pour suivre les étapes.':'Un sommet isolé ne peut pas être atteint depuis la base.';}
  $('step-title').textContent=title;$('step-caption').textContent=caption;
}
function tick() {
  if(!playing)return;
  if(step<result.frames.length-1){step++;render();}
  if(step>=result.frames.length-1){stop();return;}
  timer=setTimeout(tick,400);
}
function animate() {
  if(!result)return;
  if(playing){stop();$('animate-button').textContent='Reprendre';return;}
  if(step===result.frames.length-1)step=0;
  playing=true;$('animate-button').textContent='Pause';render();timer=setTimeout(tick,400);
}
function example(target) {
  $('start-select').value='COORD-SN-CASA';$('target-select').value=target;calculate();
}
function toast(message) {
  $('toast').textContent=message;$('toast').classList.add('visible');setTimeout(()=>$('toast').classList.remove('visible'),2000);
}
$('routing-form').addEventListener('submit',e=>{e.preventDefault();calculate();});
$('start-select').addEventListener('change',pending);
$('target-select').addEventListener('change',pending);
$('animate-button').addEventListener('click',animate);
$('step-button').addEventListener('click',()=>{if(!result)return;stop();step=step===result.frames.length-1?0:step+1;render();});
$('reset-button').addEventListener('click',()=>example('SN-CASA-014'));
$('scenario-alert').addEventListener('click',()=>example('SN-CASA-014'));
$('scenario-isolated').addEventListener('click',()=>example('SN-CASA-099'));
$('copy-route').addEventListener('click',async()=>{
  if(!result||!Number.isFinite(result.cost))return;
  try{await navigator.clipboard.writeText(`${result.path.join(' → ')} · ${result.cost} min`);toast('Chemin copié.');}
  catch{toast('Copie indisponible. Le chemin est affiché dans le résultat.');}
});
drawGraph();calculate();
if(location.protocol==='file:') {
  document.querySelectorAll('.report-link').forEach(a=>a.href='./rapport-queenbee.pdf');
  const download=document.querySelector('.download-demo');if(download)download.hidden=true;
  document.querySelector('.report-caption').textContent='PDF du rapport à placer dans le même dossier.';
}
