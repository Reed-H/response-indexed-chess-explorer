import { Engine } from './engine.js';
import { TreeManager } from './tree-manager.js';
import { START_FEN } from './data.js';
import { Chess } from 'https://cdn.jsdelivr.net/npm/chess.js@1.0.0/dist/esm/chess.js';

const engine = new Engine();
const treeManager = new TreeManager(START_FEN);

const board = Chessboard("board", {
    position: START_FEN,
    draggable: false
});

const evalBar = document.getElementById('eval-bar');
const variationsContainer = document.getElementById('variations-container');
const breadcrumb = document.getElementById('breadcrumb');

// Normalize evaluation for side to move
function normalizeEval(score, fen) {
    const sideToMove = fen.split(' ')[1];
    return sideToMove === 'w' ? score : -score;
}

// Render evaluation bar
function renderEvalBar(score) {
    const clamped = Math.max(-5, Math.min(5, score));
    const percent = 50 + clamped * 10;
    evalBar.style.height = percent + '%';
    evalBar.style.background = score > 0 ? '#4CAF50' : '#f44336';
}

// Update the main board display
function updateBoard(fen) {
    board.position(fen);
}

// Render breadcrumb navigation
function renderBreadcrumb() {
    const path = treeManager.getCurrentPath();
    const breadcrumbHtml = path.map((node, idx) => {
        if (idx === 0) return '<span>Start</span>';
        return `<span> > ${node.move.san} (${node.eval !== null ? node.eval.toFixed(2) : '?'})</span>`;
    }).join('');
    breadcrumb.innerHTML = breadcrumbHtml;
}

// Evaluate and set score on node
function evaluateNode(node) {
    return new Promise(resolve => {
        if (node.eval !== null) {
            resolve(node.eval);
            return;
        }

        engine.evaluate(node.fen, 15, (score) => {
            const normalized = normalizeEval(score, node.fen);
            node.setEval(normalized);
            resolve(normalized);
        });
    });
}

// Render variation tree at current position
async function renderVariations() {
    variationsContainer.innerHTML = '';
    
    const children = treeManager.currentNode.children;
    if (children.length === 0) {
        variationsContainer.innerHTML = '<p><em>No variations yet</em></p>';
        return;
    }

    // Group children by white response
    const grouped = treeManager.getChildrenGroupedByResponse();

    for (const [whiteResponse, nodes] of Object.entries(grouped)) {
        const group = document.createElement('div');
        group.className = 'variation-group';
        
        const title = document.createElement('h4');
        title.textContent = whiteResponse === 'ungrouped' ? 'Unclassified' : `White plays: ${whiteResponse}`;
        group.appendChild(title);

        for (const node of nodes) {
            const nodeBtn = document.createElement('button');
            nodeBtn.className = 'node-button';
            
            let displayText = node.move.san;
            if (node.eval !== null) {
                displayText += ` (${node.eval.toFixed(2)})`;
            }
            
            nodeBtn.innerHTML = displayText;
            nodeBtn.onclick = () => navigateToNode(node);
            
            group.appendChild(nodeBtn);
        }

        variationsContainer.appendChild(group);
    }

    // Evaluate all children
    for (const child of children) {
        await evaluateNode(child);
    }
    
    // Re-render with evaluations
    renderVariations();
}

// Navigate to a node
async function navigateToNode(node) {
    const fen = treeManager.navigateToNode(node);
    updateBoard(fen);
    renderBreadcrumb();
    
    // Evaluate current position
    await evaluateNode(node);
    renderEvalBar(node.eval);
    
    // Render child variations
    await renderVariations();
}

// Create a new child node
async function createVariation(moveSan, whiteResponse = null) {
    const newNode = treeManager.createChildNode(moveSan, whiteResponse);
    if (!newNode) return false;

    // Evaluate immediately
    await evaluateNode(newNode);
    
    // Refresh display
    await renderVariations();
    return true;
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    await evaluateNode(treeManager.root);
    renderBreadcrumb();
    await renderVariations();
});

// Export for other modules
window.app = {
    treeManager,
    createVariation,
    navigateToNode,
    evaluateNode
};