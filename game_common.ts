import { effects, EffectInstance, EffectPreset, instantiateEffect } from './effects';

export class Proto {
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

export const fatal_errors = [];
export function good() {
	return fatal_errors.length === 0;
}

export function fail(msg: string): false {
	fatal_errors.push(Error(msg));	
	console.log(fatal_errors[fatal_errors.length - 1]);
	return false;
}

export class Card {
	id: number;
	proto: Proto;
	owner: Player;
	strength: number;
	x: number;
	y: number;
	active: EffectInstance;
	sot: EffectInstance;
	eot: EffectInstance;

	takeDamage(damage: number) {
		this.strength -= damage;
		if (this.strength <= 0)
			this.owner.game.destroy(this);
	}

	constructor(id: number, owner: Player, proto: Proto) {
		this.id = id;
		this.proto = proto;
		this.owner = owner;
		this.strength = proto.baseStrength;
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
	cardSet: Proto[];
	movePointsPerTurn: number;
	maxMovePoints: number;

	minDeckSize: number;
	maxDeckSize: number;
};

export class Player {
	game: Game;
	hand: Proto[];
	isPlayer2: boolean;
	movePoints: number = 0;
	fatigue: number = 1;
	doneWithBlindStage: boolean = false;
 	nextId: number[];

	// These get rest every turn
	justPlayedCard: Card = null;
	justMovedCards: Card[] = [];
	usedActive: boolean = false;

	sot: EffectInstance[] = [];
	eot: EffectInstance[] = [];

	debugPlayerName(): string {
		return this.isPlayer2 ? "P2" : "P1";
	}

	constructor(game: Game, nextId: number[], isPlayer2: boolean) {
		this.game = game;
		this.nextId = nextId;
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

	canActive(card: Card): boolean {
		if(!card.active) 
			return fail(`Card ${card.id} has no active`);
		if (card.owner !== this) 
			return fail(`Card ${card.id} doesn't belong to ${card.owner.debugPlayerName()}`);
		if(this.usedActive)
			return fail(`${card.owner.debugPlayerName()} already used an active`);
		if(this.game.turn !== this)
			return fail(`${card.owner.debugPlayerName()} tried to use an active during other player's turn`);
		if(this.justMovedCards.includes(card))
			return fail(`${card.owner.debugPlayerName()} tried to use active of ${card.id} which was already moved`);
		return true;
	}

	active(card: Card): boolean {
		if (this.canActive(card)) {
			card.active.effectFunc(this.game, card, card.active.args);
			this.usedActive = true;
			return true;
		}
		return false;
	}

	getUnits() {
		return Object.values(this.game._board).filter(c => c.owner === this);
	}

	S_canPlayCardFromHand(x: number, y: number, proto: Proto): boolean {
		// validate coordinates
		if (!this.game.coordinatesValid(x, y))
			return false;

		// can only play cards on our side of the board
		if (this.isPlayer2 && y < this.game.rules.boardHeight - this.game.rules.ownHeight)
			return fail(`trying to play card on opponent side of board`);
		if (!this.isPlayer2 && y >= this.game.rules.ownHeight)
			return fail(`trying to play card on opponent side of board`);


		// cant play if there's something on the field
		if (this.game.getBoard(x, y))
			return fail(`Field ${[x, y]} taken`);

		// can't play a card that's not in our hand
		if (this.hand.indexOf(proto) === -1)
			return fail(`Trying to play card that's not in hand`);

		// if it's blind stage respect the unit count limit
		if (this.game.inBlindStage) {
			if (this.getUnits().length >= this.game.rules.blindStageUnits)
				return fail(`trying to play cards over the blind stage limit`);
			if (this.doneWithBlindStage)
				return fail(`trying to play cards after ready with blind stage`);
			return true;
		}

		if (this.game.turn !== this)
			return fail(`trying to play card during other player's turn`);

		if (this.justPlayedCard)
			return fail(`already played a card this turn`);
		
		return true;
	}

	S_canMoveCard(x: number, y: number, card: Card): boolean {
		// validate coordinates
		if (!this.game.coordinatesValid(x, y))
			return false;

		// cant play if there's something on the field
		if (this.game.getBoard(x, y))
			return fail(`Field ${[x, y]} taken`);

		// can't move a card that's not ours or isn't on board
		if (card.owner !== this)
			return fail(`trying to play a card you dont own`);

		// if we're in blind stage, we can freely move cards
		// on our side of the board
		if (this.game.inBlindStage) {
			if (this.isPlayer2 && y < this.game.rules.boardHeight - this.game.rules.ownHeight)
				return fail(`trying to play card on opponent side of board`);
			if (!this.isPlayer2 && y >= this.game.rules.ownHeight)
				return fail(`trying to play card on opponent side of board`);
			return true;
		}

		if (this.game.turn !== this)
			return fail(`Trying to play a card during other player's turn`);
		if(this.movePoints <= 0)
			return fail(`out of move points`);

		const dx = x - card.x;
		const dy = y - card.y;
		const dist = Math.abs(dx) + Math.abs(dy);
		if (dist !== 1)
			return fail('can only move cards by one field horizontally or vertically');

		return true;
	}

	S_moveCard(x: number, y: number, card: Card) {
		this.game.putCard(x, y, card);
		if (!this.game.inBlindStage) {
			this.movePoints -= 1;
			if (!this.justMovedCards.includes(card))
				this.justMovedCards.push(card);
		}
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
	inBlindStage: boolean = true;
	isGameOver: boolean = false;
	turn: Player;


	p1: Player;
	p2: Player;

	cards: {[id: number]: Card} = {};
	_board: {[xy: number]: Card} = {};

	constructor(rules: GameRules) {
		this.rules = rules;
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

	getCard(id: number): Card {
		const card = this.cards[id];
		if (!card) {
			var msg = `failed to get card ${id}. existing cards:`;
			for (const id in this.cards)
				msg += `\n[${id}] => { p2: ${this.cards[id].owner === this.p2} }`;
			fail(msg);
			return null;
		}
		return card;
	}

	gameOver(winner: Player) {
		this.isGameOver = true;
	}

	nextTurn() {
		if (!this.turn.justPlayedCard)
			this.turn.S_takeFatigue();

		// Trigger EOT effects for player who just finished his turn
		this.turn.eot = this.turn.eot.filter(c => this.cards[c.card.id]);
		for (const e of this.turn.eot)
			e.effectFunc(this, e.card, e.args);

		// Switch player
		this.turn = this.otherPlayer(this.turn);

		// Give move points to the new player
		this.firstTurn();

		// Trigger SOT effects for new player
		this.turn.sot = this.turn.sot.filter(c => this.cards[c.card.id]);
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

	destroy(card: Card) {
		const xy = this._xy(card.x, card.y);
		delete this._board[xy];
		if (card.id)
			delete this.cards[card.id];
		if (!this.inBlindStage && card.owner.getUnits().length === 0)
			card.owner.game.gameOver(this.otherPlayer(card.owner));
	}

	putCard(x: number, y: number, card: Card): boolean {
		if (this.getBoard(x, y))
			return fail(`There's already a unit at ${[x, y]}`);
		if (card.sot)
			card.owner.sot.push(card.sot);
		if (card.eot)
			card.owner.eot.push(card.eot);
		const xy = this._xy(card.x, card.y);
		delete this._board[xy];
		this._board[y * this.rules.boardWidth + x] = card;
		card.x = x;
		card.y = y;
		return true;
	}

	coordinatesValid(x: number, y: number): boolean {
		if (Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < this.rules.boardWidth && y < this.rules.boardHeight) return true;
		return fail(`Invalid coordinates (${x}, ${y})`);
	}

	otherPlayer(p: Player) {
		return (p === this.p1) ? this.p2 : this.p1;
	}

}
