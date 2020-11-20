export class CardProto {
	cardID: number;
	cardName: string;
	baseStrength: number;

	cardLetter: string;

	constructor(cardID: number, cardName: string, baseStrength: number, cardLetter: string) {
		this.cardID=cardID;
		this.cardName=cardName;
		this.baseStrength=baseStrength;
		this.cardLetter=cardLetter;
	}
}

export class Card {
	id: number;
	proto: CardProto;
	owner: Player;
	strength: number;
	x: number;
	y: number;

	get onBoard() {
		return this.x >= 0;
	}

	constructor(id: number, owner: Player, proto: CardProto) {
		this.id = id;
		this.proto = proto;
		this.owner = owner;
		this.strength = this.proto.baseStrength;
		this.x = -1;
		this.y = -1;
	}
}

export class GameRules {
	boardWidth: number;
	boardHeight: number;
	ownHeight: number;
	startingHandSize: number;
	blindStageUnits: number;
	cardSet: CardProto[];

	minDeckSize: number;
	maxDeckSize: number;
};

export class Player {
	game: Game;
	hand: Card[];

	C_canMoveCard(card: Card, x: number, y: number) : boolean {
		if (card.owner !== this || !card.onBoard)
			return false;
		if (this.game.stage === 'BlindStage' && y >= this.game.rules.ownHeight)
			return false;
		if (this.game.getBoard(x, y))
			return false;
		return this.game.stage === 'BlindStage';
	}

	C_allowedMoveSquaresXY(card: Card): number[] {
		const squares = [];
		if (!card.onBoard || this.game.stage === 'BlindStage') {
			for (let y = 0; y < this.game.rules.ownHeight; y++)
				for (let x = 0; x < this.game.rules.boardWidth; x++)
					squares.push(this.game._xy(x, y));
		}
		return squares;
	}

	getUnits() {
		return Object.values(this.game._board).filter(c => c.owner === this);
	}

	// returns false only if card not in hand or board position taken
	S_playCardFromHand(card: Card, x: number, y: number): boolean {
		const posInHand = this.hand.indexOf(card);
		if (posInHand === -1)
			return false;

		this.hand.splice(posInHand, 1);
		return this.game.putCard(x, y, card);
	}

	get strength(): number {
		let str = 0;
		for (const unit of this.getUnits()) {
			str += unit.strength;
		}
		return str;
	}
}

export type Stage = 'BlindStage' | 'Play' | 'Active' | 'Move';

export class Game {
	rules: GameRules;
	stage: Stage;

	p1: Player;
	p2: Player;

	cards: {[id: number]: Card};
	_board: {[xy: number]: Card};

	getBoard(x: number, y: number) {
		return this._board[y * this.rules.boardWidth + x];
	}

	_xy(x: number, y: number) {
		return y * this.rules.boardWidth + x;
	}

	liftCard(card: Card) {
		const xy = this._xy(card.x, card.y);
		delete this._board[xy];
		card.x = -1;
		card.x = -1;
	}

	putCard(x: number, y: number, card: Card): boolean {
		if (this.getBoard(x, y))
			return false;
		this.liftCard(card);
		this._board[y * this.rules.boardWidth + x] = card;
		card.x = x;
		card.y = y;
		return true;
	}

	constructor(rules: GameRules) {
		this.cards = {};
		this._board = {};
		this.rules = rules;
		this.stage = 'BlindStage';
	}

}
