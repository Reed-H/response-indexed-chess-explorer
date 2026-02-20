export class PositionNode {
	constructor({ fen, move = null, parent = null, whiteResponse = null }) {
		this.fen = fen;
		this.move = move;
		this.parent = parent;
		this.children = [];
		this.eval = null;
		this.whiteResponse = whiteResponse; // Label for grouping by white strategy
	}

	addChild(node) {
		if (!this.children.includes(node)) {
			this.children.push(node);
		}
	}

	setEval(score) {
		this.eval = score;
	}

	setWhiteResponse(response) {
		this.whiteResponse = response;
	}
}