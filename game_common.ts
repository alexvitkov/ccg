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

	canPlayCard() : boolean {
		if (this.game.stage === 'BlindStage')
			return this.unitsCount < this.game.rules.blindStageUnits;
		return false;
	}

	canMoveCard() : boolean {
		if (this.game.stage === 'BlindStage')
			return true;
		return false;
	}

	canReturnCard() : boolean {
		return this.game.stage === 'BlindStage';
	}

	// Assuming canPlayCard === true
	playCard(posInHand: number, x: number, y: number): boolean {
		const card = this.hand[posInHand];
		if (!card)
			return false;
		const xy = this.game.xy(x, y);
		if (this.game.board[xy])
			return false;

		this.game.board[xy] = card;
		card.x = x;
		card.y = y;
		this.hand.splice(posInHand, 1);
		return true;
	}

	// Assuming canMoveCard === true
	moveCard(card: Card, x: number, y: number): boolean {
		if (card.owner !== this)
			return false;
		const xy = this.game.xy(x, y);
		if (this.game.board[xy])
			return false;

		// make sure card is on board
		if (card.x < 0)
			return false;

		delete this.game.board[this.game.xy(card.x, card.y)];
		this.game.board[xy] = card;
		card.x = x;
		card.y = y;
		return true;
	}

	// Assuming canReturnCard() === true
	// previousCard = null to insert at start of hand
	returnCard(card: Card, previousCard?: Card) {
		const xy = this.game.xy(card.x, card.y);
		delete this.game.board[xy];
		card.x = -1;
		card.y = -1;

		const pcIndex = this.hand.indexOf(previousCard);
		this.hand.splice(pcIndex + 1, 0, card);
	}

	get unitsCount() {
		return Object.values(this.game.board)
		             .filter(unit => unit.owner === this)
					 .length;
	}
}

export type Stage = 'BlindStage';

export class Game {
	rules: GameRules;
	stage: Stage;

	p1: Player;
	p2: Player;

	cards: {[id: number]: Card};
	board: {[xy: number]: Card};

	constructor(rules: GameRules, p1: Player, p2: Player) {
		this.cards = {};
		this.board = {};
		this.rules = rules;
		this.p1 = p1;
		this.p2 = p2;
		this.stage = 'BlindStage';
	}

	xy(x: number, y: number) {
		return y * this.rules.boardWidth + x;
	}
}
