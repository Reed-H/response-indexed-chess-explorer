import { Engine } from './engine.js';
import { TreeManager } from './tree-manager.js';
import { START_FEN } from './data.js';
import { Chess } from 'https://cdn.jsdelivr.net/npm/chess.js@1.0.0/dist/esm/chess.js';

const engine = new Engine();
const treeManager = new TreeManager(START_FEN);
const $ = (id) => document.getElementById(id);

const boardElement = $('board');
const evalBar = $('eval-bar');
const variationsContainer = $('variations-container');
const treeJsonContainer = $('tree-json-container');
const boardTreeViewport = $('board-tree-viewport');
const boardTreeCanvas = $('board-tree-canvas');
const breadcrumb = $('breadcrumb');
const leftPanel = $('left-panel');
const rightPanel = $('right-panel');
const panelResizer = $('panel-resizer');

const groupingToggle = $('grouping-toggle');
const clusteringToggle = $('clustering-toggle');
const clusterTopNSelect = $('cluster-topn');
const blackFilter = $('black-filter');
const whiteFilter = $('white-filter');
const selectedMoveDisplay = $('selected-move-display');
const whiteResponseInput = $('white-response-input');
const lineTagInput = $('line-tag-input');
const showLegalToggle = $('show-legal-toggle');
const autoNavigateToggle = $('auto-navigate-toggle');

const addVariationBtn = $('add-variation-btn');
const undoMoveBtn = $('undo-move-btn');
const backBtn = $('back-btn');
const collapseLeftBtn = $('collapse-left-btn');

const importJsonInput = $('import-json-input');
const importJsonBtn = $('import-json-btn');
const importLinesBtn = $('import-lines-btn');
const importPgnBtn = $('import-pgn-btn');
const exportBtn = $('export-btn');
const exportPngBtn = $('export-png-btn');
const exportJpegBtn = $('export-jpeg-btn');
const exportPdfBtn = $('export-pdf-btn');

const centerTreeBtn = $('center-tree-btn');
const treeAlignSelect = $('tree-align');
const nodeSpacingX = $('node-spacing-x');
const nodeSpacingY = $('node-spacing-y');
const lastMoveStyleSelect = $('last-move-style');
const lineHighlightMode = $('line-highlight-mode');

const strategyPickerBtn = $('strategy-picker-btn');
const tagPickerBtn = $('tag-picker-btn');
const strategyPicker = $('strategy-picker');
const tagPicker = $('tag-picker');

const menuBtn = $('menu-btn');
const sideMenu = $('side-menu');
const settingsBtn = $('settings-btn');
const settingsDialog = $('settings-dialog');
const closeSettingsBtn = $('close-settings-btn');
const themeSelect = $('theme-select');
const treeBgInput = $('tree-bg-input');
const boardThemeSelect = $('board-theme-select');
const evalFillInput = $('eval-fill-input');
const evalBgInput = $('eval-bg-input');

const statusMessage = $('status-message');

let selectedMove = null;
let selectedSourceSquare = null;
let treeOffset = { x: 18, y: 18 };
let treeScale = 1;
let isPanning = false;
let panStart = null;
let miniBoards = [];
let resizing = false;

const board = Chessboard('board', { position: START_FEN, draggable: true, onDragStart, onDrop, onSnapEnd });

function showStatus(message, type = 'success') {
  statusMessage.textContent = message;
  statusMessage.className = `status-message status-${type}`;
  setTimeout(() => { statusMessage.textContent = ''; statusMessage.className = 'status-message'; }, 3000);
}
const normalizeEval = (score, fen) => (fen.split(' ')[1] === 'w' ? score : -score);
const evalToPercent = (score) => 50 + Math.max(-5, Math.min(5, score)) * 10;
function renderEvalBar(score) { evalBar.style.height = `${evalToPercent(score)}%`; }
const getCurrentPositionGame = () => new Chess(treeManager.currentNode.fen);
const getLegalMoves = () => treeManager.getLegalMoves();
function updateBoard() { board.position(selectedMove ? selectedMove.fen : treeManager.currentNode.fen); }

function clearHighlights() { boardElement.querySelectorAll('.square-55d63').forEach(s => s.classList.remove('move-source', 'move-target')); }
function clearMoveSelection() { selectedMove = null; selectedSourceSquare = null; clearHighlights(); selectedMoveDisplay.textContent = 'None'; undoMoveBtn.disabled = true; updateBoard(); }
function setSelectedMove(move) { selectedMove = move; selectedSourceSquare = null; clearHighlights(); selectedMoveDisplay.textContent = move.san; undoMoveBtn.disabled = false; updateBoard(); }

function highlightMovesFrom(sourceSquare) {
  clearHighlights();
  if (!showLegalToggle.checked) return;
  const options = getLegalMoves().filter(m => m.from === sourceSquare);
  boardElement.querySelector(`[data-square="${sourceSquare}"]`)?.classList.add('move-source');
  options.forEach(m => boardElement.querySelector(`[data-square="${m.to}"]`)?.classList.add('move-target'));
}
function findLegalMove(source, target) { return getLegalMoves().find(m => m.from === source && m.to === target) || null; }
function previewMove(source, target) {
  const move = findLegalMove(source, target); if (!move) return false;
  const game = getCurrentPositionGame(); const played = game.move({ from: source, to: target, promotion: 'q' }); if (!played) return false;
  setSelectedMove({ ...move, san: played.san, fen: game.fen() }); return true;
}
function onDragStart(source) {
  const g = getCurrentPositionGame(); const p = g.get(source);
  if (!p || p.color !== g.turn()) return false;
  if (!getLegalMoves().some(m => m.from === source)) return false;
  highlightMovesFrom(source); return true;
}
function onDrop(source, target) { if (!previewMove(source, target)) { clearHighlights(); return 'snapback'; } return 'drop'; }
function onSnapEnd() { updateBoard(); }
function handleBoardClick(event) {
  const sqEl = event.target.closest('.square-55d63'); if (!sqEl) return;
  const sq = sqEl.getAttribute('data-square'); if (!sq) return;
  const game = getCurrentPositionGame();
  if (selectedSourceSquare) {
    if (previewMove(selectedSourceSquare, sq)) return;
    selectedSourceSquare = null;
  }
  const piece = game.get(sq);
  if (piece && piece.color === game.turn()) {
    selectedSourceSquare = sq;
    highlightMovesFrom(sq);
    return;
  }
  clearHighlights();
}

function evaluateNode(node) { return new Promise(resolve => {
  if (node.eval !== null) return resolve(node.eval);
  engine.evaluate(node.fen, 14, score => { const n = normalizeEval(score, node.fen); node.setEval(n); resolve(n); });
}); }

function renderBreadcrumb() {
  const path = treeManager.getCurrentPath();
  breadcrumb.innerHTML = path.map((n,i)=> i===0 ? '<span>Start</span>' : `<span> > ${n.move?.beforeFullmove || ''}${n.move?.color==='b'?'...':'.'} ${n.move?.san || ''}${n.whiteResponse?` | ${n.whiteResponse}`:''}${n.lineTag?` #${n.lineTag}`:''}</span>`).join('');
}

function getSignature(node, topN) {
  const children = node.children.slice().sort((a,b)=>(b.eval??-999)-(a.eval??-999));
  const single = children.length === 1 ? `${children[0].move?.san}|${children[0].whiteResponse||''}` : null;
  const top = children.slice(0,topN).map(c=>`${c.move?.san}|${c.whiteResponse||''}`).sort().join(',');
  return { single, top };
}

function clusterSiblings(nodes, topN) {
  const groups = [];
  for (const node of nodes) {
    const sig = getSignature(node, topN);
    let g = groups.find(x => (sig.single && x.single && x.single === sig.single) || (sig.top && x.top && sig.top.split(',').some(v => x.top.includes(v))));
    if (!g) { g = { single: sig.single, top: sig.top, nodes: [] }; groups.push(g); }
    g.nodes.push(node);
    if (!g.single && sig.single) g.single = sig.single;
  }
  return groups.map((g,i)=>({ label: g.single ? `Shared child: ${g.single}` : `Cluster ${i+1}`, nodes: g.nodes }));
}

function refreshPickersAndFilters() {
  const all = treeManager.getAllNodes();
  const whites = [...new Set(all.map(n=>n.whiteResponse).filter(Boolean))].sort();
  const tags = [...new Set(all.map(n=>n.lineTag).filter(Boolean))].sort();
  const blacks = [...new Set(all.map(n=>n.move?.san).filter(Boolean))].sort();
  blackFilter.innerHTML = '<option value="">All</option>' + blacks.map(v=>`<option value="${v}">${v}</option>`).join('');
  whiteFilter.innerHTML = '<option value="">All</option>' + whites.map(v=>`<option value="${v}">${v}</option>`).join('');
  strategyPicker.innerHTML = whites.map(v=>`<button class="pill" data-val="${v}" type="button">${v}</button>`).join('');
  tagPicker.innerHTML = tags.map(v=>`<button class="pill" data-val="${v}" type="button">${v}</button>`).join('');
}

function getFilteredChildren(){
  return treeManager.currentNode.children.filter(n=>(!blackFilter.value||n.move?.san===blackFilter.value)&&(!whiteFilter.value||(n.whiteResponse||'')===whiteFilter.value));
}

function renderMoveCluster(title, nodes) {
  const el = document.createElement('div'); el.className='variation-group'; el.innerHTML=`<h4>${title} (${nodes.length})</h4>`;
  const wrap = document.createElement('div'); wrap.className='variation-cluster';
  nodes.forEach(node=>{ const b=document.createElement('button'); b.className='node-button'; b.textContent=`${node.move?.beforeFullmove||''}${node.move?.color==='b'?'...':'.'} ${node.move?.san || ''} ${node.eval!==null?`(${node.eval.toFixed(2)})`:'(?)'}`; b.onclick=()=>navigateToNode(node); wrap.appendChild(b);});
  el.appendChild(wrap); return el;
}

async function renderVariations() {
  variationsContainer.innerHTML='';
  const children = getFilteredChildren();
  if (!children.length) { variationsContainer.innerHTML='<p><em>No matching variations.</em></p>'; return; }

  if (groupingToggle.checked) {
    const grouped = treeManager.getChildrenGroupedByResponse();
    Object.entries(grouped).forEach(([k,v]) => { const f=v.filter(x=>children.includes(x)); if (f.length) variationsContainer.appendChild(renderMoveCluster(k,f)); });
  } else {
    variationsContainer.appendChild(renderMoveCluster('All responses', children));
  }

  if (clusteringToggle.checked) {
    clusterSiblings(children, Number(clusterTopNSelect.value||2)).forEach(c => { if (c.nodes.length > 1) variationsContainer.appendChild(renderMoveCluster(c.label, c.nodes)); });
  }

  for (const child of children.filter(c=>c.eval===null)) await evaluateNode(child);
}

function buildJsonTree(rootData, depth=0, numbering='') {
  const row = document.createElement('div'); row.style.paddingLeft = `${depth*14}px`;
  const b = document.createElement('button'); b.className='tree-node-button';
  const label = rootData.move ? `${numbering} ${rootData.move.san}` : 'Start';
  b.textContent = `${label}${typeof rootData.eval==='number'?` (${rootData.eval.toFixed(2)})`:''}`;
  if (rootData.fen === treeManager.currentNode.fen) b.classList.add('active');
  b.onclick = ()=>{ const node = treeManager.getNodeByFen(rootData.fen); if (node) navigateToNode(node); };
  row.appendChild(b);
  const frag = document.createDocumentFragment(); frag.appendChild(row);

  let children = rootData.children || [];
  if (clusteringToggle.checked && children.length > 1) {
    const nodeObjs = children.map(c => treeManager.getNodeByFen(c.fen)).filter(Boolean);
    const clusters = clusterSiblings(nodeObjs, Number(clusterTopNSelect.value||2));
    const clusteredFens = new Set(clusters.flatMap(c=>c.nodes.map(n=>n.fen)));
    for (const cl of clusters) {
      if (cl.nodes.length < 2) continue;
      const cr = document.createElement('div'); cr.style.paddingLeft = `${(depth+1)*14}px`; cr.innerHTML = `<em>${cl.label}</em>`;
      frag.appendChild(cr);
      cl.nodes.forEach((n,i)=>{ const childData = children.find(c=>c.fen===n.fen); frag.appendChild(buildJsonTree(childData, depth+2, `${numbering}${i+1}.`)); });
    }
    children = children.filter(c=>!clusteredFens.has(c.fen));
  }

  children.forEach((child,i)=> frag.appendChild(buildJsonTree(child, depth+1, `${numbering}${i+1}.`)));
  return frag;
}
function renderTreeJsonView(){ treeJsonContainer.innerHTML=''; treeJsonContainer.appendChild(buildJsonTree(treeManager.exportTree().root)); }

function computeTreeLayout() {
  const levels = []; const q=[{node:treeManager.root,depth:0}];
  while(q.length){const {node,depth}=q.shift(); if(!levels[depth])levels[depth]=[]; levels[depth].push(node); node.children.forEach(c=>q.push({node:c,depth:depth+1}));}
  const sx = Number(nodeSpacingX.value||190), sy = Number(nodeSpacingY.value||190); const pos = new Map();
  const maxWidth = Math.max(...levels.map(l=>l.length));
  levels.forEach((nodes,d)=>nodes.forEach((n,i)=>{
    let x=i*sx;
    if (treeAlignSelect.value==='center') x += ((maxWidth - nodes.length)*sx)/2;
    if (treeAlignSelect.value==='pyramid') x += ((maxWidth - nodes.length)*sx)/2;
    pos.set(n.fen,{x,y:d*sy});
  }));
  return { levels, pos, width:(maxWidth+2)*sx, height:levels.length*sy + 120 };
}

function getPathSet(){ return new Set(treeManager.getCurrentPath().map(n=>n.fen)); }
function clearMiniBoards(){ miniBoards.forEach(b=>b.destroy?.()); miniBoards=[]; }
function applyTreeTransform(){ boardTreeCanvas.style.transform=`translate(${treeOffset.x}px,${treeOffset.y}px) scale(${treeScale})`; }

function sqPos(square,size=122){ if(!square) return null; const f=square.charCodeAt(0)-97,r=Number(square[1])-1,c=size/8; return {x:f*c,y:(7-r)*c,c}; }
function drawLastMove(overlay, move){
  if(!move?.from || !move?.to) return;
  const a=sqPos(move.from), b=sqPos(move.to); if(!a||!b) return;
  if(lastMoveStyleSelect.value==='squares'){
    [a,b].forEach(p=>{ const d=document.createElement('div'); d.className='last-move-square'; d.style.left=`${p.x}px`; d.style.top=`${p.y}px`; d.style.width=`${p.c}px`; d.style.height=`${p.c}px`; overlay.appendChild(d); });
  } else {
    const ar=document.createElement('div'); ar.className='last-move-arrow';
    const sx=a.x+a.c/2, sy=a.y+a.c/2, ex=b.x+b.c/2, ey=b.y+b.c/2, dx=ex-sx, dy=ey-sy;
    ar.style.left=`${sx}px`; ar.style.top=`${sy}px`; ar.style.width=`${Math.hypot(dx,dy)}px`; ar.style.transform=`rotate(${Math.atan2(dy,dx)*180/Math.PI}deg)`; overlay.appendChild(ar);
  }
}

const TAG_COLORS = ['#ff6b6b','#4dabf7','#51cf66','#fcc419','#b197fc','#ffa94d'];
function colorForTag(tag){ if(!tag) return '#5b6770'; let h=0; for(const c of tag) h=(h*31+c.charCodeAt(0))>>>0; return TAG_COLORS[h%TAG_COLORS.length]; }

function renderBoardTree() {
  clearMiniBoards(); boardTreeCanvas.innerHTML='';
  const {levels,pos,width,height}=computeTreeLayout(); boardTreeCanvas.style.width=`${width}px`; boardTreeCanvas.style.height=`${height}px`;
  const line = getPathSet();

  levels.forEach(nodes=>nodes.forEach(node=>{
    const {x,y} = pos.get(node.fen);
    const wrap=document.createElement('div'); wrap.className='board-tree-node'; wrap.style.left=`${x}px`; wrap.style.top=`${y}px`;
    const mode = lineHighlightMode.value;
    if (mode==='line' && !line.has(node.fen)) wrap.classList.add('dimmed');
    if (node.fen===treeManager.currentNode.fen) wrap.classList.add('active');
    if (mode==='tags' && node.lineTag) wrap.style.boxShadow = `0 0 0 2px ${colorForTag(node.lineTag)}`;

    const mw=document.createElement('div'); mw.className='mini-node-wrap';
    const mini=document.createElement('div'); mini.className='mini-board'; mini.id=`mb-${Math.random().toString(36).slice(2,8)}`;
    const ov=document.createElement('div'); ov.style.position='absolute'; ov.style.inset='0'; drawLastMove(ov,node.move);
    const eb=document.createElement('div'); eb.className='node-eval-bar'; const ef=document.createElement('div'); ef.className='node-eval-fill'; ef.style.height=`${evalToPercent(node.eval??0)}%`; eb.appendChild(ef);
    mw.appendChild(mini); mw.appendChild(ov); mw.appendChild(eb);
    const cap=document.createElement('div'); cap.className='mini-caption'; cap.textContent=`${node.move?.beforeFullmove||''}${node.move?.color==='b'?'...':'.'} ${node.move?.san||'Start'} ${typeof node.eval==='number'?node.eval.toFixed(2):'?'}`;
    wrap.appendChild(mw); wrap.appendChild(cap); wrap.onclick=()=>navigateToNode(node); boardTreeCanvas.appendChild(wrap);
    miniBoards.push(Chessboard(mini.id,{position:node.fen,draggable:false,showNotation:false}));

    if(node.parent){
      const p=pos.get(node.parent.fen); const e=document.createElement('div'); e.className='board-tree-edge';
      const sx=p.x+61, sy=p.y+124, ex=x+61, ey=y, dx=ex-sx, dy=ey-sy;
      e.style.left=`${sx}px`; e.style.top=`${sy}px`; e.style.width=`${Math.hypot(dx,dy)}px`; e.style.transform=`rotate(${Math.atan2(dy,dx)*180/Math.PI}deg)`;
      if(mode==='line'){ if(line.has(node.fen)&&line.has(node.parent.fen)) e.classList.add('line-focus'); else e.classList.add('dimmed'); }
      if(mode==='tags'){ e.classList.add('tag-colored'); e.style.background = colorForTag(node.lineTag || node.parent.lineTag); }
      boardTreeCanvas.appendChild(e);
    }
  }));
  applyTreeTransform();
}

async function navigateToNode(node){
  treeManager.navigateToNode(node); clearMoveSelection(); lineTagInput.value=treeManager.currentNode.lineTag||'';
  renderBreadcrumb(); await evaluateNode(node); renderEvalBar(node.eval||0);
  refreshPickersAndFilters(); await renderVariations(); renderTreeJsonView(); renderBoardTree();
}

async function addVariation(){
  if(!selectedMove){showStatus('Select a move first','error');return;}
  const created=treeManager.createChildNode(selectedMove.san, whiteResponseInput.value.trim()||null, lineTagInput.value.trim()||null);
  if(!created){showStatus('Invalid move','error');return;}
  await evaluateNode(created);
  whiteResponseInput.value='';
  if(autoNavigateToggle.checked){ await navigateToNode(created); }
  else { clearMoveSelection(); await renderVariations(); renderTreeJsonView(); renderBoardTree(); }
  showStatus('Variation added');
}
async function goBack(){ const p=treeManager.goBack(); if(!p){showStatus('Already root','info'); return;} await navigateToNode(p); }

function exportTree(){ const blob=new Blob([JSON.stringify(treeManager.exportTree(),null,2)],{type:'application/json'}); const u=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=u; a.download='opening-tree.json'; a.click(); URL.revokeObjectURL(u); }
async function exportTreeImage(type='png'){ const c=await window.html2canvas(boardTreeViewport,{backgroundColor:null,scale:2}); const a=document.createElement('a'); a.href=c.toDataURL(type==='jpeg'?'image/jpeg':'image/png',0.95); a.download=`position-tree.${type}`; a.click(); }
async function exportTreePdf(){ const c=await window.html2canvas(boardTreeViewport,{backgroundColor:null,scale:2}); const {jsPDF}=window.jspdf; const pdf=new jsPDF({orientation:'landscape',unit:'pt',format:'a4'}); const w=pdf.internal.pageSize.getWidth(),h=pdf.internal.pageSize.getHeight(); pdf.addImage(c.toDataURL('image/png'),'PNG',20,20,w-40,h-40); pdf.save('position-tree.pdf'); }

async function importJsonTree(){ try{ treeManager.importTree(JSON.parse(importJsonInput.value)); await navigateToNode(treeManager.root); showStatus('JSON imported'); }catch(e){showStatus(`Import failed: ${e.message}`,'error');} }
async function importLines(){ try{ const n=treeManager.importLines(importJsonInput.value); refreshPickersAndFilters(); await renderVariations(); renderTreeJsonView(); renderBoardTree(); showStatus(`Imported ${n} line(s)`);}catch(e){showStatus(`Line import failed: ${e.message}`,'error');} }
async function importPgn(){
  try {
    const text = importJsonInput.value.replace(/\{[^}]*\}|\([^)]*\)|\[[^\]]*\]/g,' ');
    const tokens = text.split(/\s+/).filter(Boolean).filter(t => !/^\d+\.|1-0|0-1|1\/2-1\/2|\*$/.test(t));
    const line = `${treeManager.root.fen} | ${tokens.join(' ')}`;
    const n = treeManager.importLines(line);
    refreshPickersAndFilters(); await renderVariations(); renderTreeJsonView(); renderBoardTree(); showStatus(`Imported PGN (${n} line)`);
  } catch (e) { showStatus(`PGN import failed: ${e.message}`,'error'); }
}

function applySettings(){
  document.body.classList.toggle('theme-dark', themeSelect.value==='dark');
  document.documentElement.style.setProperty('--tree-bg', treeBgInput.value);
  document.documentElement.style.setProperty('--eval-fill', evalFillInput.value);
  document.documentElement.style.setProperty('--eval-bg', evalBgInput.value);
  const t={classic:['#f0d9b5','#b58863'],green:['#eeeed2','#769656'],blue:['#dee3e6','#8ca2ad']}[boardThemeSelect.value];
  if(t){document.documentElement.style.setProperty('--light-square',t[0]);document.documentElement.style.setProperty('--dark-square',t[1]);}
}

function setupPanZoom(){
  boardTreeViewport.addEventListener('mousedown',e=>{ if(e.target.closest('.board-tree-node')) return; isPanning=true; panStart={x:e.clientX-treeOffset.x,y:e.clientY-treeOffset.y}; boardTreeViewport.classList.add('panning'); });
  window.addEventListener('mousemove',e=>{ if(!isPanning)return; treeOffset={x:e.clientX-panStart.x,y:e.clientY-panStart.y}; applyTreeTransform(); });
  window.addEventListener('mouseup',()=>{ isPanning=false; boardTreeViewport.classList.remove('panning'); });
  boardTreeViewport.addEventListener('wheel',e=>{ e.preventDefault(); treeScale=Math.max(.45,Math.min(1.9,treeScale+(e.deltaY<0?.08:-.08))); applyTreeTransform(); },{passive:false});
}
function centerTree(){ treeOffset={x:18,y:18}; treeScale=1; applyTreeTransform(); }

function setupResizer(){
  panelResizer.addEventListener('mousedown',()=>{ resizing=true; document.body.style.userSelect='none'; });
  window.addEventListener('mousemove',e=>{ if(!resizing) return; const w=Math.max(450,Math.min(window.innerWidth*0.75,e.clientX-20)); leftPanel.style.width=`${w}px`; });
  window.addEventListener('mouseup',()=>{ resizing=false; document.body.style.userSelect=''; });
}

function setupMenu(){
  const close = (ev)=>{ if(sideMenu.classList.contains('hidden')) return; if(sideMenu.contains(ev.target)||menuBtn.contains(ev.target)) return; sideMenu.classList.add('hidden'); };
  menuBtn.addEventListener('click',()=>sideMenu.classList.toggle('hidden'));
  document.addEventListener('click',close);
  window.addEventListener('scroll',()=>sideMenu.classList.add('hidden'));
}

function setupPickers(){
  strategyPickerBtn.addEventListener('click',()=>strategyPicker.classList.toggle('hidden'));
  tagPickerBtn.addEventListener('click',()=>tagPicker.classList.toggle('hidden'));
  strategyPicker.addEventListener('click',e=>{ const p=e.target.closest('.pill'); if(!p) return; whiteResponseInput.value=p.dataset.val; strategyPicker.classList.add('hidden');});
  tagPicker.addEventListener('click',e=>{ const p=e.target.closest('.pill'); if(!p) return; lineTagInput.value=p.dataset.val; tagPicker.classList.add('hidden');});
}

addVariationBtn.addEventListener('click', addVariation);
undoMoveBtn.addEventListener('click', ()=>{ clearMoveSelection(); showStatus('Move selection undone','info'); });
backBtn.addEventListener('click', goBack);
collapseLeftBtn.addEventListener('click', ()=>{ leftPanel.classList.toggle('collapsed'); collapseLeftBtn.textContent = leftPanel.classList.contains('collapsed') ? 'Expand Live Panel' : 'Collapse Live Panel'; });
exportBtn.addEventListener('click', exportTree);
exportPngBtn.addEventListener('click', ()=>exportTreeImage('png'));
exportJpegBtn.addEventListener('click', ()=>exportTreeImage('jpeg'));
exportPdfBtn.addEventListener('click', exportTreePdf);
importJsonBtn.addEventListener('click', importJsonTree);
importLinesBtn.addEventListener('click', importLines);
importPgnBtn.addEventListener('click', importPgn);
centerTreeBtn.addEventListener('click', centerTree);
[ groupingToggle, clusteringToggle, clusterTopNSelect, blackFilter, whiteFilter, treeAlignSelect, nodeSpacingX, nodeSpacingY, lastMoveStyleSelect, lineHighlightMode ].forEach(c => c.addEventListener('change', async ()=>{ await renderVariations(); renderTreeJsonView(); renderBoardTree(); }));
boardElement.addEventListener('click', handleBoardClick);

settingsBtn.addEventListener('click', ()=>settingsDialog.showModal());
closeSettingsBtn.addEventListener('click', ()=>settingsDialog.close());
[themeSelect, treeBgInput, boardThemeSelect, evalFillInput, evalBgInput].forEach(el=>el.addEventListener('input', ()=>{ applySettings(); renderBoardTree(); }));

setupPanZoom(); setupResizer(); setupMenu(); setupPickers();

document.addEventListener('DOMContentLoaded', async ()=>{
  applySettings();
  await evaluateNode(treeManager.root);
  renderEvalBar(treeManager.root.eval || 0);
  clearMoveSelection();
  renderBreadcrumb();
  refreshPickersAndFilters();
  await renderVariations();
  renderTreeJsonView();
  renderBoardTree();
  showStatus('Tree explorer ready!');
});

window.treeManager = treeManager;
window.app = { navigateToNode, addVariation, importJsonTree, importLines, importPgn };
