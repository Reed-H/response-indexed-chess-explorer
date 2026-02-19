export class PositionNode {
	constructor({ fen, move = null, parent = null }) {
		this.fen = fen
		this.move = move
		this.parent = parent
		this.children = []
		this.eval = null
	}

	addChild(node) {
		this.children.push(node)
	}

	setEval(score) {
		this.eval = score
	}
}
