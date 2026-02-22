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
const boardTreeSection = $('board-tree-section');
const breadcrumb = $('breadcrumb');
const groupingToggle = $('grouping-toggle');
const clusteringToggle = $('clustering-toggle');
const clusterTopNSelect = $('cluster-topn');
const blackFilter = $('black-filter');
const whiteFilter = $('white-filter');
const selectedMoveDisplay = $('selected-move-display');
const whiteResponseInput = $('white-response-input');
const lineTagInput = $('line-tag-input');
const addVariationBtn = $('add-variation-btn');
const undoMoveBtn = $('undo-move-btn');
const backBtn = $('back-btn');
const exportBtn = $('export-btn');
const exportPngBtn = $('export-png-btn');
const exportJpegBtn = $('export-jpeg-btn');
const exportPdfBtn = $('export-pdf-btn');
const importJsonInput = $('import-json-input');
const importJsonBtn = $('import-json-btn');
const importLinesBtn = $('import-lines-btn');
const centerTreeBtn = $('center-tree-btn');
const fullscreenTreeBtn = $('fullscreen-tree-btn');
const treeAlignSelect = $('tree-align');
const lastMoveStyleSelect = $('last-move-style');
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
const statusMessage = $('status-message');

let selectedMove = null;
let selectedSourceSquare = null;
let treeOffset = { x: 18, y: 18 };
let treeScale = 1;
let isPanning = false;
let panStart = null;
let miniBoards = [];

const board = Chessboard('board', { position: START_FEN, draggable: true, onDragStart, onDrop, onSnapEnd });

function showStatus(message, type = 'success') {
  statusMessage.textContent = message;
  statusMessage.className = `status-message status-${type}`;
  setTimeout(() => { statusMessage.textContent = ''; statusMessage.className = 'status-message'; }, 2800);
}

function normalizeEval(score, fen) {
  return fen.split(' ')[1] === 'w' ? score : -score;
}
function evalToPercent(score) { return 50 + Math.max(-5, Math.min(5, score)) * 10; }
function renderEvalBar(score) { evalBar.style.height = `${evalToPercent(score)}%`; }

function getCurrentPositionGame() { return new Chess(treeManager.currentNode.fen); }
function getLegalMoves() { return treeManager.getLegalMoves(); }
function updateBoard() { board.position(selectedMove ? selectedMove.fen : treeManager.currentNode.fen); }

function clearHighlights() { boardElement.querySelectorAll('.square-55d63').forEach(s => s.classList.remove('move-source', 'move-target')); }
function clearMoveSelection() {
  selectedMove = null; selectedSourceSquare = null; clearHighlights(); selectedMoveDisplay.textContent = 'None'; undoMoveBtn.disabled = true; updateBoard();
}
function setSelectedMove(move) {
  selectedMove = move; selectedSourceSquare = null; clearHighlights(); selectedMoveDisplay.textContent = move.san; undoMoveBtn.disabled = false; updateBoard();
}
function highlightMovesFrom(sourceSquare) {
  clearHighlights();
  const options = getLegalMoves().filter(m => m.from === sourceSquare);
  boardElement.querySelector(`[data-square="${sourceSquare}"]`)?.classList.add('move-source');
  options.forEach(m => boardElement.querySelector(`[data-square="${m.to}"]`)?.classList.add('move-target'));
}
function findLegalMove(source, target) { return getLegalMoves().find(m => m.from === source && m.to === target) || null; }
function previewMove(source, target) {
  const move = findLegalMove(source, target); if (!move) return false;
  const game = getCurrentPositionGame(); const played = game.move({ from: source, to: target, promotion: 'q' });
  if (!played) return false;
  setSelectedMove({ ...move, san: played.san, fen: game.fen() });
  return true;
}
function onDragStart(source) {
  const game = getCurrentPositionGame(); const p = game.get(source);
  if (!p || p.color !== game.turn()) return false;
  if (!getLegalMoves().some(m => m.from === source)) return false;
  highlightMovesFrom(source); return true;
}
function onDrop(source, target) { if (!previewMove(source, target)) { clearHighlights(); return 'snapback'; } return 'drop'; }
function onSnapEnd() { updateBoard(); }
function handleBoardClick(event) {
  const sqEl = event.target.closest('.square-55d63'); if (!sqEl || !boardElement.contains(sqEl)) return;
  const sq = sqEl.getAttribute('data-square'); if (!sq) return;
  const game = getCurrentPositionGame();
  if (selectedSourceSquare && previewMove(selectedSourceSquare, sq)) return;
  const piece = game.get(sq); if (piece && piece.color === game.turn()) { selectedSourceSquare = sq; highlightMovesFrom(sq); return; }
  selectedSourceSquare = null; clearHighlights();
}

function evaluateNode(node) { return new Promise(resolve => {
  if (node.eval !== null) return resolve(node.eval);
  engine.evaluate(node.fen, 14, (score) => { const n = normalizeEval(score, node.fen); node.setEval(n); resolve(n); });
});}

function renderBreadcrumb() {
  const path = treeManager.getCurrentPath();
  breadcrumb.innerHTML = path.map((n, i) => {
    if (i === 0) return '<span>Start</span>';
    const moveNum = n.move?.beforeFullmove || '';
    const piece = `${moveNum ? moveNum + '.' : ''}${n.move?.san || ''}`;
    return `<span> > ${piece}${n.whiteResponse ? ` | ${n.whiteResponse}` : ''}${n.lineTag ? ` #${n.lineTag}` : ''}</span>`;
  }).join('');
}

function getTopWhiteMoves(node, n) {
  return node.children.slice().sort((a,b)=>(b.eval??-999)-(a.eval??-999)).slice(0,n).map(c=>`${c.move?.san}|${c.whiteResponse||''}`).filter(Boolean);
}

function clusterBlackResponses(nodes, topN) {
  const out = [];
  for (const node of nodes) {
    const only = node.children.length === 1 ? `${node.children[0].move?.san}|${node.children[0].whiteResponse||''}` : null;
    const top = new Set(getTopWhiteMoves(node, topN));
    let group = out.find(g => (only && g.only && g.only === only) || [...top].some(t => g.top.has(t)));
    if (!group) { group = { only, top: new Set(top), nodes: [] }; out.push(group); }
    if (!group.only && only) group.only = only;
    top.forEach(t => group.top.add(t));
    group.nodes.push(node);
  }
  return out.map((g, i) => ({ label: g.only ? `Shared response: ${g.only}` : `Cluster ${i+1}`, nodes: g.nodes }));
}

function refreshPickersAndFilters() {
  const all = treeManager.getAllNodes();
  const strategies = [...new Set(all.map(n => n.whiteResponse).filter(Boolean))].sort();
  const tags = [...new Set(all.map(n => n.lineTag).filter(Boolean))].sort();
  const blacks = [...new Set(all.map(n => n.move?.san).filter(Boolean))].sort();

  blackFilter.innerHTML = '<option value="">All</option>' + blacks.map(v=>`<option value="${v}">${v}</option>`).join('');
  whiteFilter.innerHTML = '<option value="">All</option>' + strategies.map(v=>`<option value="${v}">${v}</option>`).join('');
  strategyPicker.innerHTML = strategies.map(v=>`<button class="pill" data-value="${v}" type="button">${v}</button>`).join('');
  tagPicker.innerHTML = tags.map(v=>`<button class="pill" data-value="${v}" type="button">${v}</button>`).join('');
}

function getFilteredChildren() {
  return treeManager.currentNode.children.filter(n => (!blackFilter.value || n.move?.san === blackFilter.value) && (!whiteFilter.value || (n.whiteResponse||'') === whiteFilter.value));
}

function renderMoveCluster(title, nodes) {
  const g = document.createElement('div'); g.className = 'variation-group';
  g.innerHTML = `<h4>${title} (${nodes.length})</h4>`;
  const wrap = document.createElement('div'); wrap.className='variation-cluster';
  nodes.forEach(node => {
    const b = document.createElement('button'); b.className='node-button';
    const ply = node.move?.beforeFullmove ? `${node.move.beforeFullmove}${node.move.color==='w'?'.':'...'} ` : '';
    b.textContent = `${ply}${node.move?.san || ''} ${node.eval!==null?`(${node.eval.toFixed(2)})`:'(?)'}`;
    b.onclick = ()=>navigateToNode(node); wrap.appendChild(b);
  });
  g.appendChild(wrap); return g;
}

async function renderVariations() {
  variationsContainer.innerHTML = '';
  const children = getFilteredChildren();
  if (!children.length) { variationsContainer.innerHTML='<p><em>No matching variations.</em></p>'; return; }

  if (groupingToggle.checked) {
    const grouped = treeManager.getChildrenGroupedByResponse();
    Object.entries(grouped).forEach(([k,v]) => {
      const filtered = v.filter(x=>children.includes(x)); if (filtered.length) variationsContainer.appendChild(renderMoveCluster(k, filtered));
    });
  } else {
    variationsContainer.appendChild(renderMoveCluster('All responses', children));
  }

  if (clusteringToggle.checked) {
    const topN = Number(clusterTopNSelect.value || 2);
    clusterBlackResponses(children, topN).forEach(c => variationsContainer.appendChild(renderMoveCluster(c.label, c.nodes)));
  }

  for (const child of children.filter(c=>c.eval===null)) await evaluateNode(child);
}

function renderTreeJsonViewNode(jsonNode, depth=0, idx=1, moveNumber='') {
  const row = document.createElement('div'); row.style.paddingLeft = `${depth*14}px`;
  const b = document.createElement('button'); b.className='tree-node-button';
  const numbering = jsonNode.move ? `${moveNumber || idx}. ` : '';
  b.textContent = `${numbering}${jsonNode.move?.san || 'Start'}${typeof jsonNode.eval==='number'?` (${jsonNode.eval.toFixed(2)})`:''}`;
  if (jsonNode.fen === treeManager.currentNode.fen) b.classList.add('active');
  b.onclick = ()=>{ const node = treeManager.getNodeByFen(jsonNode.fen); if (node) navigateToNode(node); };
  row.appendChild(b);
  const frag = document.createDocumentFragment(); frag.appendChild(row);
  (jsonNode.children||[]).forEach((child, i) => frag.appendChild(renderTreeJsonViewNode(child, depth+1, i+1, `${idx}.${i+1}`)));
  return frag;
}
function renderTreeJsonView() { treeJsonContainer.innerHTML=''; treeJsonContainer.appendChild(renderTreeJsonViewNode(treeManager.exportTree().root)); }

function computeTreeLayout() {
  const levels = []; const q=[{node:treeManager.root,depth:0}];
  while(q.length){const {node,depth}=q.shift(); if(!levels[depth])levels[depth]=[]; levels[depth].push(node); node.children.forEach(c=>q.push({node:c,depth:depth+1}));}
  const spacingX=190, spacingY=190, pos = new Map();
  levels.forEach((nodes,d)=>nodes.forEach((n,i)=>{
    const offset = treeAlignSelect.value === 'center' ? ((Math.max(...levels.map(l=>l.length))-nodes.length)*spacingX)/2 : 0;
    pos.set(n.fen,{x:i*spacingX+offset,y:d*spacingY});
  }));
  return {levels,pos,width:(Math.max(...levels.map(l=>l.length))+2)*spacingX,height:levels.length*spacingY+80};
}

function getPathSet(){ return new Set(treeManager.getCurrentPath().map(n=>n.fen)); }
function clearMiniBoards(){ miniBoards.forEach(b=>b.destroy?.()); miniBoards=[]; }
function applyTreeTransform(){ boardTreeCanvas.style.transform=`translate(${treeOffset.x}px,${treeOffset.y}px) scale(${treeScale})`; }

function squareToCoords(square, boardSize=122) {
  if (!square) return null;
  const file = square.charCodeAt(0)-97; const rank = Number(square[1])-1;
  const cell = boardSize/8;
  return { x:file*cell, y:(7-rank)*cell, cell };
}

function addLastMoveMark(overlay, move) {
  if (!move?.from || !move?.to) return;
  const from = squareToCoords(move.from), to = squareToCoords(move.to);
  if (!from || !to) return;
  if (lastMoveStyleSelect.value === 'squares') {
    [from,to].forEach(pt=>{
      const m=document.createElement('div'); m.className='last-move-square'; m.style.left=`${pt.x}px`; m.style.top=`${pt.y}px`; m.style.width=`${pt.cell}px`; m.style.height=`${pt.cell}px`; overlay.appendChild(m);
    });
  } else {
    const a=document.createElement('div'); a.className='last-move-arrow';
    const sx=from.x+from.cell/2, sy=from.y+from.cell/2, ex=to.x+to.cell/2, ey=to.y+to.cell/2;
    const dx=ex-sx, dy=ey-sy, len=Math.hypot(dx,dy), ang=Math.atan2(dy,dx)*180/Math.PI;
    a.style.left=`${sx}px`; a.style.top=`${sy}px`; a.style.width=`${len}px`; a.style.transform=`rotate(${ang}deg)`; overlay.appendChild(a);
  }
}

function renderBoardTree() {
  clearMiniBoards(); boardTreeCanvas.innerHTML='';
  const {levels,pos,width,height}=computeTreeLayout();
  boardTreeCanvas.style.width=`${width}px`; boardTreeCanvas.style.height=`${height}px`;
  const line = getPathSet();

  levels.forEach(nodes=>nodes.forEach(node=>{
    const {x,y}=pos.get(node.fen);
    const wrap=document.createElement('div'); wrap.className='board-tree-node'; wrap.style.left=`${x}px`; wrap.style.top=`${y}px`;
    if(!line.has(node.fen)) wrap.classList.add('dimmed'); if(node.fen===treeManager.currentNode.fen) wrap.classList.add('active');

    const miniWrap=document.createElement('div'); miniWrap.className='mini-node-wrap';
    const mini=document.createElement('div'); mini.className='mini-board'; mini.id=`mb-${Math.random().toString(36).slice(2,9)}`;
    const overlay=document.createElement('div'); overlay.style.position='absolute'; overlay.style.inset='0';
    addLastMoveMark(overlay, node.move);

    const ev=document.createElement('div'); ev.className='node-eval-bar';
    const evFill=document.createElement('div'); evFill.className='node-eval-fill'; evFill.style.height=`${evalToPercent(node.eval ?? 0)}%`; ev.appendChild(evFill);

    miniWrap.appendChild(mini); miniWrap.appendChild(overlay); miniWrap.appendChild(ev);
    const ply = node.move?.beforeFullmove ? `${node.move.beforeFullmove}${node.move.color==='w'?'.':'...'} ` : '';
    const cap=document.createElement('div'); cap.className='mini-caption'; cap.textContent=`${ply}${node.move?.san||'Start'} ${typeof node.eval==='number'?node.eval.toFixed(2):'?'}`;
    wrap.appendChild(miniWrap); wrap.appendChild(cap); wrap.onclick=()=>navigateToNode(node);
    boardTreeCanvas.appendChild(wrap);
    miniBoards.push(Chessboard(mini.id,{position:node.fen,draggable:false,showNotation:false}));

    if(node.parent){
      const p=pos.get(node.parent.fen); const e=document.createElement('div'); e.className='board-tree-edge';
      if(!line.has(node.fen)||!line.has(node.parent.fen)) e.classList.add('dimmed');
      const sx=p.x+61, sy=p.y+124, ex=x+61, ey=y; const dx=ex-sx, dy=ey-sy, len=Math.hypot(dx,dy), ang=Math.atan2(dy,dx)*180/Math.PI;
      e.style.left=`${sx}px`; e.style.top=`${sy}px`; e.style.width=`${len}px`; e.style.transform=`rotate(${ang}deg)`; boardTreeCanvas.appendChild(e);
    }
  }));
  applyTreeTransform();
}

async function navigateToNode(node){
  treeManager.navigateToNode(node); clearMoveSelection(); lineTagInput.value = treeManager.currentNode.lineTag || '';
  renderBreadcrumb(); await evaluateNode(node); renderEvalBar(node.eval || 0);
  refreshPickersAndFilters(); await renderVariations(); renderTreeJsonView(); renderBoardTree();
}

async function addVariation(){
  if(!selectedMove){ showStatus('Select a move on the board first','error'); return; }
  const node=treeManager.createChildNode(selectedMove.san, whiteResponseInput.value.trim()||null, lineTagInput.value.trim()||null);
  if(!node){ showStatus('Invalid move','error'); return; }
  await evaluateNode(node); whiteResponseInput.value=''; clearMoveSelection();
  refreshPickersAndFilters(); await renderVariations(); renderTreeJsonView(); renderBoardTree(); showStatus('Variation added');
}
async function goBack(){ const p=treeManager.goBack(); if(!p){showStatus('Already at root','info'); return;} await navigateToNode(p); }

function exportTree(){
  const blob = new Blob([JSON.stringify(treeManager.exportTree(),null,2)], {type:'application/json'});
  const u=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=u; a.download='opening-tree.json'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(u);
}

async function exportTreeImage(type='png') {
  const canvas = await window.html2canvas(boardTreeViewport, { backgroundColor: null, scale: 2 });
  const mime = type==='jpeg' ? 'image/jpeg' : 'image/png';
  const data = canvas.toDataURL(mime, 0.95);
  const a=document.createElement('a'); a.href=data; a.download=`position-tree.${type}`; a.click();
}

async function exportTreePdf() {
  const canvas = await window.html2canvas(boardTreeViewport, { backgroundColor: null, scale: 2 });
  const img = canvas.toDataURL('image/png');
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const w = pdf.internal.pageSize.getWidth(); const h = pdf.internal.pageSize.getHeight();
  pdf.addImage(img, 'PNG', 20, 20, w-40, h-40); pdf.save('position-tree.pdf');
}

async function importJsonTree(){ try{ treeManager.importTree(JSON.parse(importJsonInput.value)); await navigateToNode(treeManager.root); showStatus('JSON tree imported'); } catch(e){ showStatus(`Import failed: ${e.message}`,'error'); } }
async function importLines(){ try{ const n=treeManager.importLines(importJsonInput.value); await renderVariations(); renderTreeJsonView(); renderBoardTree(); refreshPickersAndFilters(); showStatus(`Imported ${n} line(s)`);}catch(e){showStatus(`Line import failed: ${e.message}`,'error');} }

function applySettings(){
  document.body.classList.toggle('theme-dark', themeSelect.value === 'dark');
  document.documentElement.style.setProperty('--tree-bg', treeBgInput.value);
  const themes = {
    classic: ['#f0d9b5','#b58863'],
    green: ['#eeeed2','#769656'],
    blue: ['#dee3e6','#8ca2ad']
  };
  const [light,dark] = themes[boardThemeSelect.value] || themes.classic;
  document.documentElement.style.setProperty('--light-square', light);
  document.documentElement.style.setProperty('--dark-square', dark);
}

function setupPanZoom(){
  boardTreeViewport.addEventListener('mousedown', e=>{ if(e.target.closest('.board-tree-node')) return; isPanning=true; panStart={x:e.clientX-treeOffset.x,y:e.clientY-treeOffset.y}; boardTreeViewport.classList.add('panning'); });
  window.addEventListener('mousemove', e=>{ if(!isPanning) return; treeOffset={x:e.clientX-panStart.x,y:e.clientY-panStart.y}; applyTreeTransform(); });
  window.addEventListener('mouseup', ()=>{ isPanning=false; boardTreeViewport.classList.remove('panning'); });
  boardTreeViewport.addEventListener('wheel', e=>{ e.preventDefault(); treeScale=Math.max(.45,Math.min(1.8,treeScale+(e.deltaY<0?0.08:-0.08))); applyTreeTransform(); }, {passive:false});
}
function centerTree(){ treeOffset={x:18,y:18}; treeScale=1; applyTreeTransform(); }
async function toggleFullscreenTree(){ if(!document.fullscreenElement) await boardTreeSection.requestFullscreen?.(); else await document.exitFullscreen(); }

function wirePickers(){
  strategyPicker.onclick = (e)=>{ const b=e.target.closest('.pill'); if(!b) return; whiteResponseInput.value = b.dataset.value; };
  tagPicker.onclick = (e)=>{ const b=e.target.closest('.pill'); if(!b) return; lineTagInput.value = b.dataset.value; };
}

addVariationBtn.addEventListener('click', addVariation);
undoMoveBtn.addEventListener('click', ()=>{ clearMoveSelection(); showStatus('Move selection undone','info'); });
backBtn.addEventListener('click', goBack);
exportBtn.addEventListener('click', exportTree);
exportPngBtn.addEventListener('click', ()=>exportTreeImage('png'));
exportJpegBtn.addEventListener('click', ()=>exportTreeImage('jpeg'));
exportPdfBtn.addEventListener('click', exportTreePdf);
importJsonBtn.addEventListener('click', importJsonTree);
importLinesBtn.addEventListener('click', importLines);
centerTreeBtn.addEventListener('click', centerTree);
fullscreenTreeBtn.addEventListener('click', toggleFullscreenTree);
[groupingToggle, clusteringToggle, clusterTopNSelect, blackFilter, whiteFilter, treeAlignSelect, lastMoveStyleSelect].forEach(c=>c.addEventListener('change', async ()=>{ await renderVariations(); renderTreeJsonView(); renderBoardTree(); }));
boardElement.addEventListener('click', handleBoardClick);

menuBtn.addEventListener('click', ()=>sideMenu.classList.toggle('hidden'));
settingsBtn.addEventListener('click', ()=>settingsDialog.showModal());
closeSettingsBtn.addEventListener('click', ()=>settingsDialog.close());
[themeSelect, treeBgInput, boardThemeSelect].forEach(el=>el.addEventListener('input', ()=>{ applySettings(); renderBoardTree(); }));
strategyPickerBtn.addEventListener('click', ()=>strategyPicker.classList.toggle('hidden'));
tagPickerBtn.addEventListener('click', ()=>tagPicker.classList.toggle('hidden'));
wirePickers();

setupPanZoom();

document.addEventListener('DOMContentLoaded', async () => {
  applySettings();
  await evaluateNode(treeManager.root);
  lineTagInput.value = treeManager.root.lineTag || '';
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
window.app = { navigateToNode, addVariation, importJsonTree, importLines };
