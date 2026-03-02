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
const collapseLeftBtn = $('collapse-left-btn');

const addVariationBtn = $('add-variation-btn');
const undoMoveBtn = $('undo-move-btn');
const backBtn = $('back-btn');

const importJsonInput = $('import-json-input');
const importJsonBtn = $('import-json-btn');
const importLinesBtn = $('import-lines-btn');
const importPgnBtn = $('import-pgn-btn');
const exportBtn = $('export-btn');
const exportSubtreeBtn = $('export-subtree-btn');
const exportPngBtn = $('export-png-btn');
const exportJpegBtn = $('export-jpeg-btn');
const exportPdfBtn = $('export-pdf-btn');

const centerTreeBtn = $('center-tree-btn');
const treeAlignSelect = $('tree-align');
const nodeSpacingX = $('node-spacing-x');
const nodeSpacingY = $('node-spacing-y');
const lastMoveStyleSelect = $('last-move-style');
const lineHighlightMode = $('line-highlight-mode');
const wheelModeSelect = $('wheel-mode');

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
const engineLinesToggle = $('engine-lines-toggle');
const engineLinesOverlay = $('engine-lines-overlay');
const boardShell = $('board-shell');

const statusMessage = $('status-message');

let selectedMove = null;
let selectedSourceSquare = null;
let treeOffset = { x: 18, y: 18 };
let treeScale = 1;
let isPanning = false;
let panStart = null;
let resizing = false;
let miniBoards = [];
let clusterChildFens = new Set();

const board = Chessboard('board', {
  position: START_FEN,
  draggable: true,
  onDragStart,
  onDrop,
  onSnapEnd
});

function showStatus(message, type = 'success') {
  statusMessage.textContent = message;
  statusMessage.className = `status-message status-${type}`;
  setTimeout(() => {
    statusMessage.textContent = '';
    statusMessage.className = 'status-message';
  }, 2800);
}

const normalizeEval = (score, fen) => fen.split(' ')[1] === 'w' ? score : -score;
const evalToPercent = (score) => 50 + Math.max(-5, Math.min(5, score)) * 10;
function renderEvalBar(score) { evalBar.style.height = `${evalToPercent(score)}%`; }

function getCurrentPositionGame() { return new Chess(treeManager.currentNode.fen); }
function getLegalMoves() { return treeManager.getLegalMoves(); }
function updateBoard() { board.position(selectedMove ? selectedMove.fen : treeManager.currentNode.fen); }

function clearHighlights() {
  boardElement.querySelectorAll('.square-55d63').forEach(el => el.classList.remove('move-source', 'move-target'));
}

function clearMoveSelection() {
  selectedMove = null;
  selectedSourceSquare = null;
  clearHighlights();
  selectedMoveDisplay.textContent = 'None';
  undoMoveBtn.disabled = true;
  updateBoard();
}

function setSelectedMove(move) {
  selectedMove = move;
  selectedSourceSquare = null;
  clearHighlights();
  selectedMoveDisplay.textContent = move.san;
  undoMoveBtn.disabled = false;
  updateBoard();
}

function highlightMovesFrom(sourceSquare) {
  clearHighlights();
  if (!showLegalToggle.checked) return;
  const legal = getLegalMoves().filter(m => m.from === sourceSquare);
  boardElement.querySelector(`[data-square="${sourceSquare}"]`)?.classList.add('move-source');
  legal.forEach(m => boardElement.querySelector(`[data-square="${m.to}"]`)?.classList.add('move-target'));
}

function findLegalMove(source, target) {
  return getLegalMoves().find(m => m.from === source && m.to === target) || null;
}

function previewMove(source, target) {
  const move = findLegalMove(source, target);
  if (!move) return false;

  const game = getCurrentPositionGame();
  const played = game.move({ from: source, to: target, promotion: 'q' });
  if (!played) return false;

  setSelectedMove({ ...move, san: played.san, fen: game.fen() });
  return true;
}

function onDragStart(source) {
  const g = getCurrentPositionGame();
  const p = g.get(source);
  if (!p || p.color !== g.turn()) return false;
  if (!getLegalMoves().some(m => m.from === source)) return false;
  highlightMovesFrom(source);
  return true;
}

function onDrop(source, target) {
  if (!previewMove(source, target)) {
    clearHighlights();
    return 'snapback';
  }
  return 'drop';
}

function onSnapEnd() { updateBoard(); }

function handleBoardClick(event) {
  const sqEl = event.target.closest('.square-55d63');
  if (!sqEl) return;
  const square = sqEl.getAttribute('data-square');
  if (!square) return;

  const game = getCurrentPositionGame();

  if (selectedSourceSquare) {
    if (previewMove(selectedSourceSquare, square)) return;
    selectedSourceSquare = null;
  }

  const piece = game.get(square);
  if (piece && piece.color === game.turn()) {
    selectedSourceSquare = square;
    highlightMovesFrom(square);
    return;
  }

  clearHighlights();
}

function evaluateNode(node) {
  return new Promise(resolve => {
    if (node.eval !== null) return resolve(node.eval);
    engine.evaluate(node.fen, 14, score => {
      const normalized = normalizeEval(score, node.fen);
      node.setEval(normalized);
      resolve(normalized);
    });
  });
}

function renderBreadcrumb() {
  const path = treeManager.getCurrentPath();
  breadcrumb.innerHTML = path.map((n, i) => {
    if (i === 0) return '<span>Start</span>';
    const num = n.move?.beforeFullmove ?? '';
    const dots = n.move?.color === 'b' ? '...' : '.';
    return `<span> > ${num}${dots} ${n.move?.san || ''}${n.whiteResponse ? ` | ${n.whiteResponse}` : ''}${n.lineTag ? ` #${n.lineTag}` : ''}</span>`;
  }).join('');
}


function normalizeSanForCluster(san) {
  return (san || '')
    .replace(/[+#?!]/g, '')
    .replace(/=[QRBN]/g, '=X')
    .trim();
}

function clusterSignature(node, topN) {
  const children = node.children.slice().sort((a, b) => (b.eval ?? -999) - (a.eval ?? -999));
  const only = children.length === 1 ? `${normalizeSanForCluster(children[0].move?.san)}|${children[0].whiteResponse || ''}` : '';
  const top = children.slice(0, topN).map(c => `${normalizeSanForCluster(c.move?.san)}|${c.whiteResponse || ''}`).sort().join(',');
  return `${only}::${top}`;
}

function clusterSiblings(nodes, topN) {
  const grouped = new Map();
  for (const node of nodes) {
    const key = clusterSignature(node, topN);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(node);
  }

  return [...grouped.entries()].map(([key, group], idx) => ({
    key,
    label: key.split('::')[0] ? `Shared child: ${key.split('::')[0]}` : `Cluster ${idx + 1}`,
    nodes: group
  }));
}

function refreshPickersAndFilters() {
  const all = treeManager.getAllNodes();
  const whites = [...new Set(all.map(n => n.whiteResponse).filter(Boolean))].sort();
  const tags = [...new Set(all.map(n => n.lineTag).filter(Boolean))].sort();
  const blacks = [...new Set(all.map(n => n.move?.san).filter(Boolean))].sort();

  blackFilter.innerHTML = '<option value="">All</option>' + blacks.map(v => `<option value="${v}">${v}</option>`).join('');
  whiteFilter.innerHTML = '<option value="">All</option>' + whites.map(v => `<option value="${v}">${v}</option>`).join('');
  strategyPicker.innerHTML = whites.map(v => `<button class="pill" data-val="${v}" type="button">${v}</button>`).join('');
  tagPicker.innerHTML = tags.map(v => `<button class="pill" data-val="${v}" type="button">${v}</button>`).join('');
}

function getFilteredChildren() {
  return treeManager.currentNode.children.filter(n => {
    if (blackFilter.value && n.move?.san !== blackFilter.value) return false;
    if (whiteFilter.value && (n.whiteResponse || '') !== whiteFilter.value) return false;
    return true;
  });
}

function renderMoveCluster(title, nodes) {
  const box = document.createElement('div');
  box.className = 'variation-group';
  box.innerHTML = `<h4>${title} (${nodes.length})</h4>`;

  const wrap = document.createElement('div');
  wrap.className = 'variation-cluster';
  nodes.forEach(node => {
    const b = document.createElement('button');
    b.className = 'node-button';
    b.textContent = `${node.move?.beforeFullmove ?? ''}${node.move?.color === 'b' ? '...' : '.'} ${node.move?.san ?? ''} ${node.eval !== null ? `(${node.eval.toFixed(2)})` : '(?)'}`;
    b.onclick = () => navigateToNode(node);
    wrap.appendChild(b);
  });

  box.appendChild(wrap);
  return box;
}

async function renderVariations() {
  variationsContainer.innerHTML = '';
  const children = getFilteredChildren();
  if (!children.length) {
    variationsContainer.innerHTML = '<p><em>No matching variations.</em></p>';
    return;
  }

  if (groupingToggle.checked) {
    const grouped = treeManager.getChildrenGroupedByResponse();
    for (const [name, list] of Object.entries(grouped)) {
      const filtered = list.filter(n => children.includes(n));
      if (filtered.length) variationsContainer.appendChild(renderMoveCluster(name, filtered));
    }
  } else {
    variationsContainer.appendChild(renderMoveCluster('All responses', children));
  }

  if (clusteringToggle.checked) {
    clusterSiblings(children, Number(clusterTopNSelect.value || 2)).forEach(c => {
      if (c.nodes.length > 1) variationsContainer.appendChild(renderMoveCluster(c.label, c.nodes));
    });
  }

  for (const node of children.filter(n => n.eval === null)) await evaluateNode(node);
}

function buildJsonTree(data, depth = 0, numbering = '') {
  const fragment = document.createDocumentFragment();
  const row = document.createElement('div');
  row.style.paddingLeft = `${depth * 14}px`;
  const b = document.createElement('button');
  b.className = 'tree-node-button';
  b.textContent = `${data.move ? `${numbering} ${data.move.san}` : 'Start'}${typeof data.eval === 'number' ? ` (${data.eval.toFixed(2)})` : ''}`;
  if (data.fen === treeManager.currentNode.fen) b.classList.add('active');
  b.onclick = () => { const node = treeManager.getNodeByFen(data.fen); if (node) navigateToNode(node); };
  row.appendChild(b);
  fragment.appendChild(row);

  let children = data.children || [];
  if (clusteringToggle.checked && children.length > 1) {
    const nodes = children.map(c => treeManager.getNodeByFen(c.fen)).filter(Boolean);
    const clusters = clusterSiblings(nodes, Number(clusterTopNSelect.value || 2));
    const used = new Set();
    for (const cluster of clusters) {
      if (cluster.nodes.length < 2) continue;
      const cRow = document.createElement('div');
      cRow.style.paddingLeft = `${(depth + 1) * 14}px`;
      cRow.innerHTML = `<em>${cluster.label}</em>`;
      fragment.appendChild(cRow);
      cluster.nodes.forEach((n, i) => {
        used.add(n.fen);
        const child = children.find(c => c.fen === n.fen);
        fragment.appendChild(buildJsonTree(child, depth + 2, `${numbering}${i + 1}.`));
      });
    }
    children = children.filter(c => !used.has(c.fen));
  }

  children.forEach((child, i) => fragment.appendChild(buildJsonTree(child, depth + 1, `${numbering}${i + 1}.`)));
  return fragment;
}

function renderTreeJsonView() {
  treeJsonContainer.innerHTML = '';
  treeJsonContainer.appendChild(buildJsonTree(treeManager.exportTree().root));
}

function computeTreeLayout() {
  const levels = [];
  const queue = [{ node: treeManager.root, depth: 0 }];

  while (queue.length) {
    const { node, depth } = queue.shift();
    if (!levels[depth]) levels[depth] = [];
    levels[depth].push(node);
    node.children.forEach(child => queue.push({ node: child, depth: depth + 1 }));
  }

  const spacingX = Number(nodeSpacingX.value || 190);
  const spacingY = Number(nodeSpacingY.value || 190);
  const positions = new Map();

  if (treeAlignSelect.value === 'pyramid') {
    positions.set(treeManager.root.fen, { x: 0, y: 0 });
    const levelQueues = [[treeManager.root]];
    while (levelQueues.length) {
      const current = levelQueues.shift();
      const next = [];
      for (const node of current) {
        const parentPos = positions.get(node.fen);
        const children = node.children;
        const n = children.length;
        children.forEach((child, idx) => {
          const offset = (idx - (n - 1) / 2) * spacingX;
          positions.set(child.fen, { x: parentPos.x + offset, y: parentPos.y + spacingY });
          next.push(child);
        });
      }
      if (next.length) levelQueues.push(next);
    }
  } else {
    const maxWidth = Math.max(...levels.map(l => l.length));
    levels.forEach((nodes, depth) => {
      nodes.forEach((node, idx) => {
        let x = idx * spacingX;
        if (treeAlignSelect.value === 'center') {
          x += ((maxWidth - nodes.length) * spacingX) / 2;
        }
        positions.set(node.fen, { x, y: depth * spacingY });
      });
    });
  }

  const allPos = [...positions.values()];
  const minX = Math.min(...allPos.map(p => p.x));
  const maxX = Math.max(...allPos.map(p => p.x));
  const maxY = Math.max(...allPos.map(p => p.y));

  positions.forEach((pos, fen) => positions.set(fen, { x: pos.x - minX + spacingX, y: pos.y }));

  return {
    levels,
    positions,
    width: (maxX - minX) + (spacingX * 2),
    height: maxY + spacingY + 130
  };
}

function getPathSet() { return new Set(treeManager.getCurrentPath().map(n => n.fen)); }
function clearMiniBoards() { miniBoards.forEach(b => b.destroy?.()); miniBoards = []; }
function applyTreeTransform() { boardTreeCanvas.style.transform = `translate(${treeOffset.x}px,${treeOffset.y}px) scale(${treeScale})`; }

function squareToPos(square, boardSize = 122) {
  if (!square || square.length < 2) return null;
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]) - 1;
  const cell = boardSize / 8;
  return { x: file * cell, y: (7 - rank) * cell, cell };
}

function drawLastMove(overlay, move) {
  if (!move?.from || !move?.to) return;
  const from = squareToPos(move.from);
  const to = squareToPos(move.to);
  if (!from || !to) return;

  if (lastMoveStyleSelect.value === 'squares') {
    [from, to].forEach(p => {
      const m = document.createElement('div');
      m.className = 'last-move-square';
      m.style.left = `${p.x}px`;
      m.style.top = `${p.y}px`;
      m.style.width = `${p.cell}px`;
      m.style.height = `${p.cell}px`;
      overlay.appendChild(m);
    });
  } else {
    const arrow = document.createElement('div');
    arrow.className = 'last-move-arrow';
    const sx = from.x + from.cell / 2;
    const sy = from.y + from.cell / 2;
    const ex = to.x + to.cell / 2;
    const ey = to.y + to.cell / 2;
    const dx = ex - sx;
    const dy = ey - sy;
    arrow.style.left = `${sx}px`;
    arrow.style.top = `${sy}px`;
    arrow.style.width = `${Math.hypot(dx, dy)}px`;
    arrow.style.transform = `rotate(${Math.atan2(dy, dx) * 180 / Math.PI}deg)`;
    overlay.appendChild(arrow);
  }
}

function tagColor(tag) {
  if (!tag) return '#5b6770';
  const palette = ['#ff6b6b', '#4dabf7', '#51cf66', '#fcc419', '#b197fc', '#ffa94d'];
  let hash = 0;
  for (const c of tag) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  return palette[hash % palette.length];
}


function buildClusterChildFen(node) {
  if (!node?.move?.from || !node?.move?.to || !node.parent) return node.fen;
  const game = new Chess(node.parent.fen);
  const mover = game.get(node.move.from);
  const captured = game.get(node.move.to);
  if (!mover) return node.fen;
  const files = "abcdefgh";
  for (const f of files) {
    for (let r = 1; r <= 8; r++) game.remove(`${f}${r}`);
  }
  game.put({ type: mover.type, color: mover.color }, node.move.from);
  if (captured) game.put({ type: captured.type, color: captured.color }, node.move.to);
  game.move({ from: node.move.from, to: node.move.to, promotion: node.move.promotion || 'q' });
  return game.fen();
}

function updateEvalBarHeight() {
  const h = boardShell.getBoundingClientRect().height;
  document.documentElement.style.setProperty('--eval-bar-height', `${Math.max(120, Math.round(h))}px`);
}

function renderEngineLines(node) {
  if (!engineLinesToggle.checked) {
    engineLinesOverlay.classList.add('hidden');
    engineLinesOverlay.innerHTML = '';
    return;
  }
  engineLinesOverlay.classList.remove('hidden');
  engineLinesOverlay.innerHTML = '<div class="engine-lines-loading">Analyzing top lines…</div>';
  engine.evaluateTopLines(node.fen, 12, 3, (lines) => {
    if (!engineLinesToggle.checked || node.fen !== treeManager.currentNode.fen) return;
    engineLinesOverlay.innerHTML = lines.map((line, idx) => `<div>${idx + 1}. ${line.score ?? '?'} | ${line.pv}</div>`).join('');
  });
}

function renderBoardTree() {
  clearMiniBoards();
  boardTreeCanvas.innerHTML = '';

  const { levels, positions, width, height } = computeTreeLayout();
  boardTreeCanvas.style.width = `${width}px`;
  boardTreeCanvas.style.height = `${height}px`;

  const pathSet = getPathSet();
  const mode = lineHighlightMode.value;

  const clusterByParent = new Map();
  clusterChildFens = new Set();
  if (clusteringToggle.checked) {
    for (const parentLevel of levels) {
      for (const parent of parentLevel) {
        const clusters = clusterSiblings(parent.children, Number(clusterTopNSelect.value || 2)).filter(c => c.nodes.length > 1);
        if (clusters.length) {
          clusterByParent.set(parent.fen, clusters);
          clusters.forEach(c => c.nodes.forEach(n => clusterChildFens.add(n.fen)));
        }
      }
    }
  }

  for (const levelNodes of levels) {
    for (const node of levelNodes) {
      const pos = positions.get(node.fen);
      if (!pos) continue;

      const wrapper = document.createElement('div');
      wrapper.className = 'board-tree-node';
      wrapper.style.left = `${pos.x}px`;
      wrapper.style.top = `${pos.y}px`;
      if (mode === 'line' && !pathSet.has(node.fen)) wrapper.classList.add('dimmed');
      if (node.fen === treeManager.currentNode.fen) wrapper.classList.add('active');

      const miniWrap = document.createElement('div');
      miniWrap.className = 'mini-node-wrap';
      const mini = document.createElement('div');
      mini.className = 'mini-board';
      mini.id = `mb-${Math.random().toString(36).slice(2, 8)}`;
      const overlay = document.createElement('div');
      overlay.style.position = 'absolute';
      overlay.style.inset = '0';
      drawLastMove(overlay, node.move);

      const nodeEval = document.createElement('div');
      nodeEval.className = 'node-eval-bar';
      const nodeFill = document.createElement('div');
      nodeFill.className = 'node-eval-fill';
      nodeFill.style.height = `${evalToPercent(node.eval ?? 0)}%`;
      nodeEval.appendChild(nodeFill);

      miniWrap.appendChild(mini);
      miniWrap.appendChild(overlay);
      miniWrap.appendChild(nodeEval);

      const cap = document.createElement('div');
      cap.className = 'mini-caption';
      cap.textContent = `${node.move?.beforeFullmove ?? ''}${node.move?.color === 'b' ? '...' : '.'} ${node.move?.san ?? 'Start'} ${typeof node.eval === 'number' ? node.eval.toFixed(2) : '?'}`;

      wrapper.appendChild(miniWrap);
      wrapper.appendChild(cap);
      wrapper.onclick = () => navigateToNode(node);
      boardTreeCanvas.appendChild(wrapper);

      const fen = clusterChildFens.has(node.fen) ? buildClusterChildFen(node) : node.fen;
      miniBoards.push(Chessboard(mini.id, { position: fen, draggable: false, showNotation: false }));

      if (node.parent && !(clusteringToggle.checked && clusterChildFens.has(node.fen))) {
        const p = positions.get(node.parent.fen);
        if (p) {
          const edge = document.createElement('div');
          edge.className = 'board-tree-edge';
          const sx = p.x + 61;
          const sy = p.y + 124;
          const ex = pos.x + 61;
          const ey = pos.y;
          const dx = ex - sx;
          const dy = ey - sy;
          edge.style.left = `${sx}px`;
          edge.style.top = `${sy}px`;
          edge.style.width = `${Math.hypot(dx, dy)}px`;
          edge.style.transform = `rotate(${Math.atan2(dy, dx) * 180 / Math.PI}deg)`;

          if (mode === 'line') {
            if (pathSet.has(node.fen) && pathSet.has(node.parent.fen)) edge.classList.add('line-focus');
            else edge.classList.add('dimmed');
          }
          if (mode === 'tags') {
            edge.classList.add('tag-colored');
            edge.style.background = tagColor(node.lineTag || node.parent.lineTag);
          }

          boardTreeCanvas.appendChild(edge);
        }
      }
    }
  }

  if (clusteringToggle.checked) {
    for (const [parentFen, clusters] of clusterByParent.entries()) {
      const p = positions.get(parentFen);
      if (!p) continue;
      for (const cluster of clusters) {
        const childPositions = cluster.nodes.map(n => positions.get(n.fen)).filter(Boolean);
        if (!childPositions.length) continue;
        const minX = Math.min(...childPositions.map(c => c.x)) - 10;
        const maxX = Math.max(...childPositions.map(c => c.x)) + 162;
        const minY = Math.min(...childPositions.map(c => c.y)) - 8;
        const maxY = Math.max(...childPositions.map(c => c.y)) + 150;

        const box = document.createElement('div');
        box.className = 'cluster-box';
        box.style.left = `${minX}px`;
        box.style.top = `${minY}px`;
        box.style.width = `${maxX - minX}px`;
        box.style.height = `${maxY - minY}px`;
        box.textContent = cluster.label;
        boardTreeCanvas.appendChild(box);

        const midX = (minX + maxX) / 2;
        const edge = document.createElement('div');
        edge.className = 'board-tree-edge cluster-link';
        const sx = p.x + 61;
        const sy = p.y + 124;
        const ex = midX;
        const ey = minY;
        const dx = ex - sx;
        const dy = ey - sy;
        edge.style.left = `${sx}px`;
        edge.style.top = `${sy}px`;
        edge.style.width = `${Math.hypot(dx, dy)}px`;
        edge.style.transform = `rotate(${Math.atan2(dy, dx) * 180 / Math.PI}deg)`;
        boardTreeCanvas.appendChild(edge);
      }
    }
  }

  applyTreeTransform();
}

async function navigateToNode(node) {
  treeManager.navigateToNode(node);
  clearMoveSelection();
  lineTagInput.value = treeManager.currentNode.lineTag || '';
  renderBreadcrumb();
  await evaluateNode(node);
  renderEvalBar(node.eval || 0);
  refreshPickersAndFilters();
  await renderVariations();
  renderTreeJsonView();
  renderBoardTree();
  updateEvalBarHeight();
  renderEngineLines(node);
}

async function addVariation() {
  if (!selectedMove) {
    showStatus('Select a move first', 'error');
    return;
  }

  const created = treeManager.createChildNode(
    selectedMove.san,
    whiteResponseInput.value.trim() || null,
    lineTagInput.value.trim() || null
  );

  if (!created) {
    showStatus('Invalid move', 'error');
    return;
  }

  await evaluateNode(created);
  whiteResponseInput.value = '';

  if (autoNavigateToggle.checked) await navigateToNode(created);
  else {
    clearMoveSelection();
    await renderVariations();
    renderTreeJsonView();
    renderBoardTree();
  }

  showStatus('Variation added');
}

async function goBack() {
  const parent = treeManager.goBack();
  if (!parent) {
    showStatus('Already at root', 'info');
    return;
  }
  await navigateToNode(parent);
}

function downloadJson(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportTree() {
  downloadJson(treeManager.exportTree(), 'opening-tree.json');
}

function exportSection() {
  const section = { root: treeManager._serializeNode(treeManager.currentNode) };
  downloadJson(section, 'opening-section.json');
}

async function exportTreeImage(type = 'png') {
  const canvas = await window.html2canvas(boardTreeViewport, { backgroundColor: null, scale: 2 });
  const a = document.createElement('a');
  a.href = canvas.toDataURL(type === 'jpeg' ? 'image/jpeg' : 'image/png', 0.95);
  a.download = `position-tree.${type}`;
  a.click();
}

async function exportTreePdf() {
  const canvas = await window.html2canvas(boardTreeViewport, { backgroundColor: null, scale: 2 });
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const w = pdf.internal.pageSize.getWidth();
  const h = pdf.internal.pageSize.getHeight();
  pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 20, 20, w - 40, h - 40);
  pdf.save('position-tree.pdf');
}

async function importJsonTree() {
  try {
    treeManager.importTree(JSON.parse(importJsonInput.value));
    await navigateToNode(treeManager.root);
    showStatus('JSON imported');
  } catch (e) {
    showStatus(`Import failed: ${e.message}`, 'error');
  }
}

async function importLines() {
  try {
    const n = treeManager.importLines(importJsonInput.value);
    refreshPickersAndFilters();
    await renderVariations();
    renderTreeJsonView();
    renderBoardTree();
    showStatus(`Imported ${n} line(s)`);
  } catch (e) {
    showStatus(`Line import failed: ${e.message}`, 'error');
  }
}

async function importPgn() {
  try {
    const text = importJsonInput.value.replace(/\{[^}]*\}|\([^)]*\)|\[[^\]]*\]/g, ' ');
    const tokens = text.split(/\s+/).filter(Boolean).filter(t => !/^\d+\.|1-0|0-1|1\/2-1\/2|\*$/.test(t));
    const line = `${treeManager.root.fen} | ${tokens.join(' ')}`;
    const n = treeManager.importLines(line);
    refreshPickersAndFilters();
    await renderVariations();
    renderTreeJsonView();
    renderBoardTree();
    showStatus(`Imported PGN (${n} line)`);
  } catch (e) {
    showStatus(`PGN import failed: ${e.message}`, 'error');
  }
}

function applySettings() {
  document.body.classList.toggle('theme-dark', themeSelect.value === 'dark');
  document.documentElement.style.setProperty('--tree-bg', treeBgInput.value);
  boardTreeViewport.style.background = treeBgInput.value;
  document.documentElement.style.setProperty('--eval-fill', evalFillInput.value);
  document.documentElement.style.setProperty('--eval-bg', evalBgInput.value);

  const themes = {
    classic: ['#f0d9b5', '#b58863'],
    green: ['#eeeed2', '#769656'],
    blue: ['#dee3e6', '#8ca2ad']
  };
  const t = themes[boardThemeSelect.value];
  if (t) {
    document.documentElement.style.setProperty('--light-square', t[0]);
    document.documentElement.style.setProperty('--dark-square', t[1]);
  }
}

function setupPanZoom() {
  boardTreeViewport.addEventListener('mousedown', (e) => {
    if (e.target.closest('.board-tree-node')) return;
    isPanning = true;
    panStart = { x: e.clientX - treeOffset.x, y: e.clientY - treeOffset.y };
    boardTreeViewport.classList.add('panning');
  });
  window.addEventListener('mousemove', (e) => {
    if (!isPanning) return;
    treeOffset = { x: e.clientX - panStart.x, y: e.clientY - panStart.y };
    applyTreeTransform();
  });
  window.addEventListener('mouseup', () => {
    isPanning = false;
    boardTreeViewport.classList.remove('panning');
  });
  boardTreeViewport.addEventListener('wheel', (e) => {
    const shouldZoom = e.ctrlKey || wheelModeSelect.value === 'zoom';
    if (shouldZoom) {
      e.preventDefault();
      treeScale = Math.max(0.45, Math.min(1.9, treeScale + (e.deltaY < 0 ? 0.08 : -0.08)));
      applyTreeTransform();
      return;
    }
    treeOffset.y -= e.deltaY;
    applyTreeTransform();
    e.preventDefault();
  }, { passive: false });
}

function centerTree() {
  treeOffset = { x: 18, y: 18 };
  treeScale = 1;
  applyTreeTransform();
}

function setupResizer() {
  panelResizer.addEventListener('mousedown', () => {
    resizing = true;
    document.body.style.userSelect = 'none';
  });

  window.addEventListener('mousemove', (e) => {
    if (!resizing) return;
    const w = Math.max(450, Math.min(window.innerWidth * 0.75, e.clientX - 20));
    leftPanel.style.width = `${w}px`;
    const boardWidth = Math.max(360, Math.min(650, w - 70));
    boardElement.style.width = `${boardWidth}px`;
    board.resize?.();
    updateEvalBarHeight();
  });

  window.addEventListener('mouseup', () => {
    resizing = false;
    document.body.style.userSelect = '';
  });
}

function setupMenu() {
  const closeMenu = (ev) => {
    if (sideMenu.classList.contains('hidden')) return;
    if (sideMenu.contains(ev.target) || menuBtn.contains(ev.target)) return;
    sideMenu.classList.add('hidden');
  };
  menuBtn.addEventListener('click', () => sideMenu.classList.toggle('hidden'));
  document.addEventListener('click', closeMenu);
  window.addEventListener('scroll', () => sideMenu.classList.add('hidden'));
}

function setupPickers() {
  strategyPickerBtn.addEventListener('click', () => strategyPicker.classList.toggle('hidden'));
  tagPickerBtn.addEventListener('click', () => tagPicker.classList.toggle('hidden'));
  strategyPicker.addEventListener('click', (e) => {
    const p = e.target.closest('.pill');
    if (!p) return;
    whiteResponseInput.value = p.dataset.val;
    strategyPicker.classList.add('hidden');
  });
  tagPicker.addEventListener('click', (e) => {
    const p = e.target.closest('.pill');
    if (!p) return;
    lineTagInput.value = p.dataset.val;
    tagPicker.classList.add('hidden');
  });
}

addVariationBtn.addEventListener('click', addVariation);
undoMoveBtn.addEventListener('click', () => { clearMoveSelection(); showStatus('Move selection undone', 'info'); });
backBtn.addEventListener('click', goBack);
collapseLeftBtn.addEventListener('click', () => {
  leftPanel.classList.toggle('collapsed');
  collapseLeftBtn.textContent = leftPanel.classList.contains('collapsed') ? 'Expand Live Panel' : 'Collapse Live Panel';
});

exportBtn.addEventListener('click', exportTree);
exportSubtreeBtn.addEventListener('click', exportSection);
exportPngBtn.addEventListener('click', () => exportTreeImage('png'));
exportJpegBtn.addEventListener('click', () => exportTreeImage('jpeg'));
exportPdfBtn.addEventListener('click', exportTreePdf);
importJsonBtn.addEventListener('click', importJsonTree);
importLinesBtn.addEventListener('click', importLines);
importPgnBtn.addEventListener('click', importPgn);
centerTreeBtn.addEventListener('click', centerTree);

[groupingToggle, clusteringToggle, clusterTopNSelect, blackFilter, whiteFilter, treeAlignSelect, nodeSpacingX, nodeSpacingY, lastMoveStyleSelect, lineHighlightMode, wheelModeSelect].forEach(ctrl => {
  ctrl.addEventListener('change', async () => {
    await renderVariations();
    renderTreeJsonView();
    renderBoardTree();
  });
});

boardElement.addEventListener('click', handleBoardClick);
settingsBtn.addEventListener('click', () => settingsDialog.showModal());
closeSettingsBtn.addEventListener('click', () => settingsDialog.close());
[themeSelect, treeBgInput, boardThemeSelect, evalFillInput, evalBgInput, engineLinesToggle].forEach(input => {
  input.addEventListener('input', () => {
    applySettings();
    renderBoardTree();
    renderEngineLines(treeManager.currentNode);
  });
});

setupPanZoom();
setupResizer();
setupMenu();
setupPickers();

document.addEventListener('DOMContentLoaded', async () => {
  applySettings();
  updateEvalBarHeight();
  await evaluateNode(treeManager.root);
  renderEvalBar(treeManager.root.eval || 0);
  clearMoveSelection();
  renderBreadcrumb();
  refreshPickersAndFilters();
  await renderVariations();
  renderTreeJsonView();
  renderBoardTree();
  renderEngineLines(treeManager.root);
  showStatus('Tree explorer ready!');
});

window.treeManager = treeManager;
window.app = { navigateToNode, addVariation, importJsonTree, importLines, importPgn };
