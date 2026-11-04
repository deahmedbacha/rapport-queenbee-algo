export class MinHeap {
  constructor() { this.data = []; }
  get size() { return this.data.length; }
  push(priority, value) {
    this.data.push({priority, value});
    let i = this.data.length - 1;
    while (i > 0) {
      const p = Math.floor((i - 1) / 2);
      if (this.data[p].priority <= this.data[i].priority) break;
      [this.data[p], this.data[i]] = [this.data[i], this.data[p]];
      i = p;
    }
  }
  pop() {
    if (!this.size) throw new Error('Tas vide');
    const root = this.data[0], last = this.data.pop();
    if (this.size) {
      this.data[0] = last;
      let i = 0;
      while (true) {
        let smallest = i;
        const left = i * 2 + 1, right = left + 1;
        if (left < this.size && this.data[left].priority < this.data[smallest].priority) smallest = left;
        if (right < this.size && this.data[right].priority < this.data[smallest].priority) smallest = right;
        if (smallest === i) break;
        [this.data[i], this.data[smallest]] = [this.data[smallest], this.data[i]];
        i = smallest;
      }
    }
    return root;
  }
}

export const NODES = [
  {id:'COORD-SN-CASA', x:85,y:252,type:'base',label:'Base'},
  {id:'P1',x:242,y:155,type:'junction'}, {id:'P2',x:242,y:326,type:'junction'},
  {id:'P3',x:411,y:122,type:'junction'}, {id:'P4',x:411,y:300,type:'junction'},
  {id:'P5',x:588,y:196,type:'junction'}, {id:'P6',x:588,y:356,type:'junction'},
  {id:'SN-CASA-001',x:242,y:61,type:'hive',label:'001'},
  {id:'SN-CASA-002',x:411,y:36,type:'hive',label:'002'},
  {id:'SN-CASA-003',x:411,y:417,type:'hive',label:'003'},
  {id:'SN-CASA-004',x:126,y:425,type:'hive',label:'004'},
  {id:'SN-CASA-005',x:687,y:437,type:'hive',label:'005'},
  {id:'SN-CASA-014',x:748,y:279,type:'hive',label:'014'},
  {id:'SN-CASA-099',x:738,y:74,type:'hive',label:'099',isolated:true}
];
export const EDGES = [
  ['COORD-SN-CASA','P1',4],['COORD-SN-CASA','P2',7],['P1','P2',2],
  ['P1','P3',6],['P2','P4',3],['P3','P4',2],['P3','P5',5],
  ['P4','P5',8],['P4','P6',4],['P5','P6',1],
  ['P1','SN-CASA-001',1],['P3','SN-CASA-002',2],['P4','SN-CASA-003',2],
  ['P2','SN-CASA-004',5],['P6','SN-CASA-005',2],
  ['P5','SN-CASA-014',3],['P6','SN-CASA-014',6]
];

export function makeGraph(nodes = NODES, edges = EDGES) {
  const graph = new Map(nodes.map(n => [typeof n === 'string' ? n : n.id, new Map()]));
  for (const [u,v,w] of edges) {
    if (!Number.isFinite(w) || w < 0) throw new Error('Poids positif ou nul requis');
    if (!graph.has(u)) graph.set(u, new Map());
    if (!graph.has(v)) graph.set(v, new Map());
    const best = Math.min(graph.get(u).get(v) ?? Infinity, w);
    graph.get(u).set(v, best); graph.get(v).set(u, best);
  }
  return graph;
}

export function dijkstra(graph, source, target, trace = false) {
  if (!graph.has(source) || !graph.has(target)) throw new Error('Sommet inconnu');
  const dist = new Map([...graph.keys()].map(n => [n, Infinity]));
  const prev = new Map(), visited = new Set(), heap = new MinHeap(), frames = [];
  dist.set(source, 0); heap.push(0,source);
  function frame(phase, current = null, neighbor = null) {
    if (!trace) return;
    frames.push({phase,current,neighbor,dist:Object.fromEntries(dist),visited:[...visited],queue:heap.data.filter(n => !visited.has(n.value)).map(n => ({...n}))});
  }
  frame('init');
  while (heap.size) {
    const {priority:cost, value:u} = heap.pop();
    if (visited.has(u)) continue;
    visited.add(u); frame('visit', u);
    if (u === target) break;
    for (const [v,w] of graph.get(u)) {
      if (!visited.has(v) && cost + w < dist.get(v)) {
        dist.set(v, cost+w); prev.set(v,u); heap.push(cost+w,v);
        frame('relax', u, v);
      }
    }
  }
  const path = [];
  if (Number.isFinite(dist.get(target))) {
    for (let n=target; n!==undefined; n=prev.get(n)) path.push(n);
    path.reverse();
  }
  frame('done',target);
  return {cost:dist.get(target), path, frames, visited:[...visited]};
}
