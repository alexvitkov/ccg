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

	constructor(id: number, owner: Player, proto: CardProto) {
		this.id = id;
		this.proto = proto;
		this.owner = owner;
		this.strength = this.proto.baseStrength;
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

	playCard(posInHand: number, x: number, y: number): boolean {
		const card = this.hand[posInHand];
		if (!card)
			return false;
		const xy = this.game.xy(x, y);
		if (this.game.board[xy])
			return false;

		this.game.board[xy] = card;
		this.hand.splice(posInHand, 1);
		return true;
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
