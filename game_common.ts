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
		this.strength = proto.baseStrength;
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
	movePointsPerTurn: number;
	maxMovePoints: number;

	minDeckSize: number;
	maxDeckSize: number;
};

export class Player {
	game: Game;
	hand: Card[];
	isPlayer2: boolean;
	movePoints: number;

	constructor(game: Game, isPlayer2: boolean) {
		this.game = game;
		this.isPlayer2 = isPlayer2;
		this.movePoints = game.rules.movePointsPerTurn;
	}

	getUnits() {
		return Object.values(this.game._board).filter(c => c.owner === this);
	}

	S_canPlayCardFromHand(x: number, y: number, card: Card): boolean {
		// can only play cards on our side of the board
		if (this.isPlayer2 && y < this.game.rules.boardHeight - this.game.rules.ownHeight)
			return false;
		if (!this.isPlayer2 && y >= this.game.rules.ownHeight)
			return false;

		// if it's blind stage respect the unit count limit
		if (this.game.stage === 'BlindStage' 
			&& this.getUnits().length >= this.game.rules.blindStageUnits)
			return false;

		// validate coordinates
		if (!this.game.coordinatesValid(x, y))
			return false;

		// cant play if there's something on the field
		if (this.game.getBoard(x, y))
			return false;

		// can't play a card that's not in our hand
		if (this.hand.indexOf(card) === -1)
			return false;

		// we can only play cards in blind stage
		// or during our play turn
		return this.game.stage === 'BlindStage' ||
			(this.game.stage === 'Play' && this.game.turn === this);
	}

	S_canMoveCard(x: number, y: number, card: Card) {
		// validate coordinates
		if (!this.game.coordinatesValid(x, y))
			return false;

		// cant play if there's something on the field
		if (this.game.getBoard(x, y))
			return false;

		// can't move a card that's not ours or isn't on board
		if (card.owner !== this || !card.onBoard)
			return false;

		// if we're in blind stage, we can freely move cards
		// on our side of the board
		if (this.game.stage === 'BlindStage') {
			if (this.isPlayer2 && y < this.game.rules.boardHeight - this.game.rules.ownHeight)
				return false;
			if (!this.isPlayer2 && y >= this.game.rules.ownHeight)
				return false;
			return true;
		}

		// if we're not in blind stage, we can only move in our move stage and if we have points
		if (this.game.stage !== 'Move' || this.game.turn !== this || this.movePoints <= 0)
			return false;

		// we can move cards by one field horizontally or vertically
		const dx = x - card.x;
		const dy = y - card.y;
		return Math.abs(dx) + Math.abs(dy) == 1;
	}

	// returns false only if card not in hand or board position taken
	S_playCardFromHand(x: number, y: number, card: Card): boolean {
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
	turn: Player;

	p1: Player;
	p2: Player;

	cards: {[id: number]: Card};
	_board: {[xy: number]: Card};

	constructor(rules: GameRules) {
		this.cards = {};
		this._board = {};
		this.rules = rules;
		this.stage = 'BlindStage';
	}

	nextStage() {
		switch (this.stage) {
			case 'Play': {
				this.stage = 'Active';
				break;
			}
			case 'Active': {
				this.stage = 'Move';
				break;
			}
			case 'Move': {
				this.stage = 'Play';
				this.turn = this.otherPlayer(this.turn);
				this.turn.movePoints += this.rules.movePointsPerTurn;
				if (this.turn.movePoints > this.rules.maxMovePoints)
					this.turn.movePoints = this.rules.maxMovePoints;
				this
				break;
			}
		}
	}

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

	coordinatesValid(x: number, y: number): boolean {
		return Number.isInteger(x) && Number.isInteger(y)
		&& x >= 0 && y >= 0
		&& x < this.rules.boardWidth && y < this.rules.boardHeight;
	}

	otherPlayer(p: Player) {
		return (p === this.p1) ? this.p2 : this.p1;
	}


}
