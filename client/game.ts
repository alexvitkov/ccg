import * as messages from '../messages';
import { Card, Player, Game, GameRules, CardProto } from '../game_common';
import { set, blindStageOver, turnChanged, makeCardDiv, fieldDivs, desync, gameOver } from './gameHtml';
import { send } from './main';
import * as ve from './viewevent';
import { EffectInstance } from '../effects';

export var game: ClientGame;
export var rules: GameRules;

// this takes the effect and transforms it a bit
// it adds some animations so the card goes up in the air a bit
// while the effect is playing
function highlight(effect: EffectInstance) {
	const oldFn = effect.effectFunc;
	effect.effectFunc = (game, card, args) => {
		game.push(() => ve.beginHightlight(card as ClientCard));
		oldFn(game, card, args);
		game.push(() => ve.endHightlight(card as ClientCard));
	}
}

export class ClientCard extends Card {
	div: HTMLDivElement;
	owner: ClientPlayer;
	
	constructor(id: number, owner: Player, proto: CardProto) {
		super(id, owner, proto);
		this.div = makeCardDiv(this);
		if (this.sot)
			highlight(this.sot);
		if (this.eot)
			highlight(this.eot);
		if (this.active)
			highlight(this.active);
	}

	takeDamage(dmg: number) {
		this.owner.game.push(ve.TakeDamage(this, this.strength, dmg));
		super.takeDamage(dmg);
	}

	die() {
		this.owner.game.push(() => { 
			this.owner.recalculateStrength();
			this.div.remove(); 
		});
		super.die();
	}
}

export class ClientPlayer extends Player {
	game: ClientGame;
	hand: ClientCard[];

	constructor(game: ClientGame, isPlayer2: boolean) {
		super(game, isPlayer2);
	}

	active(card: Card): boolean {
		if (super.active(card)) {
			if (!this.isPlayer2) {
				send({
					message: 'active',
					id: card.id
				});
			}
			return true;
		}
		return false;
	}

	S_playCardFromHand(x: number, y: number, card: ClientCard) {
		super.S_playCardFromHand(x, y, card);
		if (!game.inBlindStage) {
			send({
				message: 'playCard',
				id: card.id,
				x: x,
				y: y
			});
		}
		return true;
	}

	S_moveCard(x: number, y: number, card: ClientCard) {
		super.S_moveCard(x, y, card);
		if (!this.game.inBlindStage && !this.isPlayer2) {
			set('myMovePoints', this.movePoints.toString());
			console.log('Sending moveCard');
			send({
				message: 'moveCard',
				id: card.id,
				x: x,
				y: y
			});
			set(this.isPlayer2 ? 'enemyMovePoints' : 'myMovePoints', this.movePoints.toString());
		}
	}

	C_allowedMoveSquaresXY(card: Card): number[] {
		const squares = [];
		// We're playing a card, valid squares are our side of the board
		if (!card.onBoard || game.inBlindStage) {
			for (let y = 0; y < this.game.rules.ownHeight; y++)
			for (let x = 0; x < this.game.rules.boardWidth; x++) {
				if (!game.getBoard(x, y) || (game.inBlindStage && x === card.x && y === card.y))
					squares.push(this.game._xy(x, y));
			}
		}
		// We're moving a card, valid squares are the neighboring ones
		else {
			squares.push(this.game._xy(card.x, card.y));
			if (card.x > 0 && !this.game.getBoard(card.x - 1, card.y))
				squares.push(this.game._xy(card.x - 1, card.y));
			if (card.x < this.game.rules.boardWidth + 1 && !this.game.getBoard(card.x + 1, card.y))
				squares.push(this.game._xy(card.x + 1, card.y));
			if (card.y > 0 && !this.game.getBoard(card.x, card.y - 1))
				squares.push(this.game._xy(card.x, card.y - 1));
			if (card.y < this.game.rules.boardHeight - 1 && !this.game.getBoard(card.x, card.y + 1))
				squares.push(this.game._xy(card.x, card.y + 1));
		}
		return squares;
	}

	recalculateStrength() {
		set(this === game.p1 ? 'myStrength' : 'enemyStrength', this.strength.toString());
	}

	// previousCard = null to insert at start of hand
	returnCard(card: ClientCard, previousCard?: ClientCard) {
		const pcIndex = this.hand.indexOf(previousCard);
		this.game.liftCard(card);
		this.hand.splice(pcIndex + 1, 0, card);
		this.recalculateStrength();
	}
}

export class ClientGame extends Game {
	cards: {[id: number]: ClientCard};
	p1: ClientPlayer;
	p2: ClientPlayer;

	currentEfect: Promise<any> = Promise.resolve();
	group: number = 0;
	groupItems: (() => any)[] = [];

	constructor(message: messages.GameStartedMessage) {
		super(message.rules);
		this.p1 = new ClientPlayer(this, false);
		this.p2 = new ClientPlayer(this, true);

		game = this;
		rules = this.rules;

		(document.getElementById('header') as any).style.display = 'none';

		this.p1.hand = message.hand.map(
			c => this.instantiate(c[0], this.p1, rules.cardSet[c[1]]));
	}

	firstTurn() {
		super.firstTurn();
		turnChanged();
	}

	nextTurn() {
		super.nextTurn();
		turnChanged();
	}

	push(effect: () => any) {
		if (this.group === 0)
			this.currentEfect = this.currentEfect.then(effect);
		else
			this.groupItems.push(effect);
	}

	beginGroup() {
		this.group ++;
	}

	endGroup() {
		this.group --;
		if (this.group === 0) {
			const items = this.groupItems;
			this.push( async () => {
				await Promise.all(items.map(y => y()));
			});
			this.groupItems = [];
		}
	}

	instantiate(id: number, owner: Player, proto: CardProto) {
		const card = new ClientCard(id, owner, proto);
		this.cards[id] = card;
		return card;
	}

	doneWithBlindStage() {
		this.p1.doneWithBlindStage = true;
		send({
			message: 'doneWithBlindStage',
			played: Object.values(this._board).map(card => [card.id, card.x, card.y])
		} as messages.DoneWithBlindStageMessage);
	}

	blindStageOver(msg: messages.BlindStageOverMessage) {
		for (const [id, cardID, x, y] of msg.otherPlayerPlayed) {
			const card = this.instantiate(id, this.p2, this.rules.cardSet[cardID]);
			this.putCard(x, y, card);
		}
		this.turn = msg.myTurn ? this.p1 : this.p2;
		this.firstTurn();
		blindStageOver();
	}

	putCard(x: number, y: number, card: ClientCard): boolean {
		if (!super.putCard(x, y, card))
			return false;
		fieldDivs[this._xy(x, y)].appendChild(card.div);
		card.owner.recalculateStrength();
		return true;
	}

	canPlayCards() {
		if (this.inBlindStage)
			return !this.p1.doneWithBlindStage && this.p1.getUnits().length < this.rules.blindStageUnits;
		else 
			return this.turn === this.p1 && !this.p1.justPlayedCard;
	}

	gameOver(winner: Player) {
		gameOver(winner === this.p1);
	}

	canMoveCards(): boolean {
		if (this.inBlindStage) return !this.doneWithBlindStage;
		return this.turn === this.p1 && this.p1.movePoints > 0;
	}

	handleMessage(msg: messages.Message): boolean {
		switch (msg.message) {
			case 'desync': {
				desync('Notified by server');
				break;
			}
			case 'gameOver': {
				this.gameOver(msg.won ? this.p1 : this.p2);
				break;
			}
			case 'blindStageOver': {
				this.blindStageOver(msg as messages.BlindStageOverMessage);
				break;
			}
			case 'opponentPlayedCard': {
				const { id, cardID, x, y } = msg;
				this.instantiate(id, this.p2, this.rules.cardSet[cardID]);
				this.putCard(x, y, this.cards[id]);
				this.p2.justPlayedCard = this.cards[id];
				break;
			}
			case 'opponentMovedCard': {
				const { id, x, y } = msg;
				this.p2.S_moveCard(x, y, this.cards[id]);
				break;
			}
			case 'endTurn': {
				this.nextTurn();
				break;
			}
			case 'active': {
				this.p2.active(this.cards[msg.id]);
				break;
			}
			case 'fatigue': {
				const unit = this.cards[msg.id];
				unit.takeDamage(unit.owner.fatigue);
				unit.owner.fatigue++;
				break;
			}
			default: {
				return false;
			}
		}
		return true;
	}
}


