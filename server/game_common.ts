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
	hand: Card[];

	constructor() {
	}
}

export class Game {
	rules: GameRules;

	p1: Player;
	p2: Player;

	cards: {[id: number]: Card};

	constructor(rules: GameRules, p1: Player, p2: Player) {
		this.cards = {};
		this.rules = rules;
		this.p1 = p1;
		this.p2 = p2;
	}
}
