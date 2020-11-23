import { effects, EffectInstance, EffectPreset, instantiateEffect } from './effects';

export class CardProto {
	protoID: number;
	cardName: string;
	cardDescription: string;
	baseStrength: number;

	active: string;
	sot: string;
	eot: string;
	cardLetter: string;

	constructor(protoID: number, cardName: string, desc: string, baseStrength: number, cardLetter: string, active?: string, sot?: string, eot?: string) {
		this.protoID = protoID;
		this.cardName = cardName;
		this.cardDescription = desc;
		this.baseStrength = baseStrength;
		this.cardLetter = cardLetter;
		this.active = active;
		this.sot = sot;
		this.eot = eot;
	}
}

export class Card {
	id: number;
	proto: CardProto;
	owner: Player;
	strength: number;
	x: number;
	y: number;
	active: EffectInstance;
	sot: EffectInstance;
	eot: EffectInstance;

	get onBoard() {
		return this.x >= 0;
	}

	die() {
		this.owner.game.liftCard(this);
		if (this.owner.getUnits().length === 0)
			this.owner.game.gameOver(this.owner.game.otherPlayer(this.owner));
	}

	takeDamage(damage: number) {
		this.strength -= damage;
		if (this.strength <= 0)
			this.die();
	}

	constructor(id: number, owner: Player, proto: CardProto) {
		this.id = id;
		this.proto = proto;
		this.owner = owner;
		this.strength = proto.baseStrength;
		this.x = -1;
		this.y = -1;
		if (proto.active)
			this.active = instantiateEffect(this, proto.active);
		if (proto.sot)
			this.active = instantiateEffect(this, proto.sot);
		if (proto.eot)
			this.active = instantiateEffect(this, proto.eot);
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
	fatigue: number;
	doneWithBlindStage: boolean;

	// These get rest every turn
	justPlayedCard: Card = null;
	justMovedCards: Card[] = [];
	usedActive: boolean = false;

	sot: EffectInstance[] = [];
	eot: EffectInstance[] = [];

	constructor(game: Game, isPlayer2: boolean) {
		this.game = game;
		this.fatigue = 1;
		this.movePoints = 0;
		this.doneWithBlindStage = false;
		this.isPlayer2 = isPlayer2;
	}

	S_takeFatigue() {
		let highestUnit: Card = this.getUnits()[0];
		if (!highestUnit) {
			this.game.gameOver(this.game.otherPlayer(this));
			return;
		}

		for (const unit of this.getUnits()) {
			if (unit.strength > highestUnit.strength)
				highestUnit = unit;
			else if (unit.strength === highestUnit.strength) {
				if (this.isPlayer2) {
					if (unit.y > highestUnit.y || (unit.y === highestUnit.y && unit.x > highestUnit.x))
						highestUnit = unit;
				}
				else {
					if (unit.y < highestUnit.y || (unit.y === highestUnit.y && unit.x < highestUnit.x))
						highestUnit = unit;
				}
			}
		}
		highestUnit.takeDamage(this.fatigue);
		this.fatigue++;
	}

	canActive(card: Card) {
		return card.active 
			&& card.owner === this 
			&& card.onBoard 
			&& !this.justMovedCards.includes(card)
			&& !this.usedActive 
			&& this.game.turn === this
			&& !this.justMovedCards.includes(card);
	}

	active(card: Card): boolean {
		if (this.canActive(card)) {
			card.active.effect
			this.usedActive = true;
			return true;
		}
		return false;
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
		if (this.game.inBlindStage
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
		// or just one card per our turn
		return this.game.inBlindStage ||
			(!this.justPlayedCard && this.game.turn === this);
	}

	S_canMoveCard(x: number, y: number, card: Card): boolean {
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
		if (this.game.inBlindStage) {
			if (this.isPlayer2 && y < this.game.rules.boardHeight - this.game.rules.ownHeight)
				return false;
			if (!this.isPlayer2 && y >= this.game.rules.ownHeight)
				return false;
			return true;
		}

		// if we're not in blind stage, we can move if we have points
		if (this.game.turn !== this || this.movePoints <= 0)
			return false;

		// we can move cards by one field horizontally or vertically
		const dx = x - card.x;
		const dy = y - card.y;
		return Math.abs(dx) + Math.abs(dy) == 1;
	}

	S_moveCard(x: number, y: number, card: Card) {
		this.game.putCard(x, y, card);
		if (!this.game.inBlindStage) {
			this.movePoints -= 1;
			if (!this.justMovedCards.includes(card))
				this.justMovedCards.push(card);
		}
	}

	S_playCardFromHand(x: number, y: number, card: Card) {
		const posInHand = this.hand.indexOf(card);
		this.hand.splice(posInHand, 1);
		if (!this.game.inBlindStage)
			this.justPlayedCard = card;
		this.game.putCard(x, y, card);
	}

	get strength(): number {
		let str = 0;
		for (const unit of this.getUnits()) {
			str += unit.strength;
		}
		return str;
	}
}

export class Game {
	rules: GameRules;
	inBlindStage: boolean;
	turn: Player;

	isGameOver: boolean = false;

	p1: Player;
	p2: Player;

	cards: {[id: number]: Card};
	_board: {[xy: number]: Card};

	constructor(rules: GameRules) {
		this.cards = {};
		this._board = {};
		this.rules = rules;
		this.inBlindStage = true;
	}

	firstTurn() {
		this.inBlindStage = false;

		// Give move points to the new player
		this.turn.movePoints += this.rules.movePointsPerTurn;
		if (this.turn.movePoints > this.rules.maxMovePoints)
			this.turn.movePoints = this.rules.maxMovePoints;

		this.turn.justMovedCards.length = 0;
		this.turn.justPlayedCard = null;
		this.turn.usedActive = false;
	}

	gameOver(winner: Player) {
		this.isGameOver = true;
	}

	nextTurn() {
		if (!this.turn.justPlayedCard)
			this.turn.S_takeFatigue();

		// Trigger EOT effects for player who just finished his turn
		this.turn.eot = this.turn.eot.filter(c => c.card.onBoard);
		for (const e of this.turn.eot)
			e.effectFunc(this, e.card, e.args);

		// Switch player
		this.turn = this.otherPlayer(this.turn);

		// Give move points to the new player
		this.firstTurn();

		// Trigger SOT effects for new player
		this.turn.sot = this.turn.sot.filter(c => c.card.onBoard);
		for (const e of this.turn.sot)
			e.effectFunc(this, e.card, e.args);
	}

	getBoard(x: number, y: number) {
		return this._board[y * this.rules.boardWidth + x];
	}

	beginGroup() {}
	endGroup() {}
	push(_x: any) {}

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
		if (!card.onBoard) {
			if (card.sot)
				card.owner.sot.push(card.sot);
			if (card.eot)
				card.owner.eot.push(card.eot);
		}
		const xy = this._xy(card.x, card.y);
		delete this._board[xy];
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
