import { PositionNode } from './node.js';
import { Chess } from 'https://cdn.jsdelivr.net/npm/chess.js@1.0.0/dist/esm/chess.js';

export class TreeManager {
    constructor(startFen) {
        this.root = new PositionNode({ fen: startFen });
        this.currentNode = this.root;
        this.nodeIndex = new Map();
        this.nodeIndex.set(startFen, this.root);
    }

    getLegalMoves() {
        const game = new Chess(this.currentNode.fen);
        return game.moves({ verbose: true }).map(m => ({
            san: m.san,
            from: m.from,
            to: m.to
        }));
    }

    createChildNode(moveSan, whiteResponse = null, lineTag = null) {
        const game = new Chess(this.currentNode.fen);
        const beforeFullmove = Number(game.fen().split(' ')[5]);
        const move = game.move(moveSan);
        if (!move) return null;

        const newFen = game.fen();
        if (this.nodeIndex.has(newFen)) {
            const existingNode = this.nodeIndex.get(newFen);
            if (!this.currentNode.children.includes(existingNode)) {
                this.currentNode.addChild(existingNode);
            }
            if (whiteResponse && !existingNode.whiteResponse) existingNode.setWhiteResponse(whiteResponse);
            if (lineTag && !existingNode.lineTag) existingNode.setLineTag(lineTag);
            return existingNode;
        }

        const inheritedTag = lineTag || this.currentNode.lineTag || null;
        const newNode = new PositionNode({
            fen: newFen,
            move: { san: moveSan, beforeFullmove, ...move },
            parent: this.currentNode,
            whiteResponse,
            lineTag: inheritedTag
        });

        this.currentNode.addChild(newNode);
        this.nodeIndex.set(newFen, newNode);
        return newNode;
    }

    getNodeByFen(fen) {
        return this.nodeIndex.get(fen) || null;
    }

    navigateToNode(node) {
        if (!this.nodeIndex.has(node.fen)) return null;
        this.currentNode = node;
        return node.fen;
    }

    goBack() {
        if (!this.currentNode.parent) return null;
        this.currentNode = this.currentNode.parent;
        return this.currentNode;
    }

    getChildrenGroupedByResponse() {
        const groups = {};
        this.currentNode.children.forEach(child => {
            const responseKey = child.whiteResponse || 'Ungrouped';
            if (!groups[responseKey]) groups[responseKey] = [];
            groups[responseKey].push(child);
        });
        return groups;
    }

    getCurrentPath() {
        const path = [];
        let node = this.currentNode;
        while (node.parent) {
            path.unshift(node);
            node = node.parent;
        }
        path.unshift(this.root);
        return path;
    }

    getAllNodes(node = this.root) {
        const nodes = [node];
        for (const child of node.children) nodes.push(...this.getAllNodes(child));
        return nodes;
    }

    exportTree() {
        return { root: this._serializeNode(this.root) };
    }

    importTree(treeData) {
        if (!treeData || !treeData.root || !treeData.root.fen) throw new Error('Invalid tree JSON');
        this.nodeIndex.clear();
        this.root = this._deserializeNode(treeData.root, null);
        this.currentNode = this.root;
    }

    importLines(linesText) {
        const lines = linesText.split('\n').map(line => line.trim()).filter(Boolean);
        let imported = 0;

        for (const line of lines) {
            const [fenPart, movesPart = ''] = line.split('|').map(v => v.trim());
            const startFen = fenPart || this.root.fen;
            const moves = movesPart.split(/\s+/).filter(Boolean);
            const game = new Chess(startFen);

            let parentNode = this.nodeIndex.get(startFen);
            if (!parentNode) {
                parentNode = new PositionNode({ fen: startFen });
                this.root.addChild(parentNode);
                parentNode.parent = this.root;
                this.nodeIndex.set(startFen, parentNode);
            }

            for (const moveSan of moves) {
                const played = game.move(moveSan);
                if (!played) break;
                const fen = game.fen();
                let child = this.nodeIndex.get(fen);
                if (!child) {
                    child = new PositionNode({
                        fen,
                        move: { san: moveSan, ...played },
                        parent: parentNode,
                        whiteResponse: null,
                        lineTag: parentNode.lineTag
                    });
                    this.nodeIndex.set(fen, child);
                }
                if (!parentNode.children.includes(child)) parentNode.addChild(child);
                parentNode = child;
            }
            imported++;
        }

        return imported;
    }

    _serializeNode(node) {
        return {
            fen: node.fen,
            move: node.move ? { san: node.move.san, from: node.move.from, to: node.move.to, color: node.move.color, beforeFullmove: node.move.beforeFullmove } : null,
            eval: node.eval,
            whiteResponse: node.whiteResponse,
            lineTag: node.lineTag,
            children: node.children.map(child => this._serializeNode(child))
        };
    }

    _deserializeNode(data, parent) {
        const node = new PositionNode({
            fen: data.fen,
            move: data.move,
            parent,
            whiteResponse: data.whiteResponse || null,
            lineTag: data.lineTag || (parent ? parent.lineTag : null)
        });
        node.eval = typeof data.eval === 'number' ? data.eval : null;
        this.nodeIndex.set(node.fen, node);

        for (const childData of (data.children || [])) {
            const childNode = this._deserializeNode(childData, node);
            node.addChild(childNode);
        }

        return node;
    }
}
