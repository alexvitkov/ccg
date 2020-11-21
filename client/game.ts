import * as messages from '../messages';
import { Card, Player, Game, GameRules, CardProto } from '../game_common';
import { set, blindStageOver, stageChanged as onStageChanged, makeCardDiv, fieldDivs } from './gameHtml';
import { send } from './main';
import * as ve from './viewevent';
import { Effect } from '../effects';

export var game: ClientGame;
export var rules: GameRules;

export class ClientCard extends Card {
	div: HTMLDivElement;
	owner: ClientPlayer;
	
	constructor(id: number, owner: Player, proto: CardProto) {
		super(id, owner, proto);
		this.div = makeCardDiv(this);
	}

	protected async _takeDamageView(damage: number) {
		await ve.TakeDamage(this, damage);
	}

	async die() {
		super.die();
		this.owner.recalculateStrength();
		this.div.remove();
	}
}

export class ClientPlayer extends Player {
	game: ClientGame;
	hand: ClientCard[];

	constructor(game: ClientGame, isPlayer2: boolean) {
		super(game, isPlayer2);
	}

	S_playCardFromHand(x: number, y: number, card: ClientCard): boolean {
		if (!super.S_playCardFromHand(x, y, card))
			return false;

		if (game.stage === 'Play') {
			send({
				message: 'playCard',
				id: card.id,
				x: x,
				y: y
			});
			game.nextStage();
		}
		return true;
	}

	moveCard(x: number, y: number, card: ClientCard): boolean {
		if (!game.p1.S_canMoveCard(x, y, card))
			return false;
		this.game.putCard(x, y, card);

		if (this.game.stage === 'Move') {
			this.movePoints -= 1;
			set('myMovePoints', this.movePoints.toString());
			if (this.movePoints == 0) {
				game.nextStage();
			}
			send({
				message: 'moveCard',
				id: card.id,
				x: x,
				y: y
			});
		}

		return true;
	}

	C_allowedMoveSquaresXY(card: Card): number[] {
		const squares = [];
		// We're playing a card, valid squares are our side of the board
		if (!card.onBoard) {
			for (let y = 0; y < this.game.rules.ownHeight; y++)
			for (let x = 0; x < this.game.rules.boardWidth; x++)
			squares.push(this.game._xy(x, y));
		}
		// We're moving a card, valid squares are the neighboring ones
		else {
			if (card.x > 0)
				squares.push(this.game._xy(card.x - 1, card.y));
			if (card.x < this.game.rules.boardWidth - 1)
				squares.push(this.game._xy(card.x + 1, card.y));
			if (card.y > 0)
				squares.push(this.game._xy(card.x, card.y - 1));
			if (card.y < this.game.rules.boardHeight - 1)
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

	async highlight(unit: ClientCard, duration: number) {
		await ve.Highlight(unit, duration);
	}

	async nextStage() {
		// TODO this is a hack to fix a desync
		(document.getElementById("readyButton") as any).disabled = true;
		await super.nextStage();
		onStageChanged();
	}

	instantiate(id: number, owner: Player, proto: CardProto) {
		const card = new ClientCard(id, owner, proto);
		this.cards[id] = card;
		return card;
	}

	doneWithBlindStage() {
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
		blindStageOver();
		this.nextStage();
	}

	putCard(x: number, y: number, card: ClientCard): boolean {
		if (!super.putCard(x, y, card))
			return false;
		fieldDivs[this._xy(x, y)].appendChild(card.div);
		card.owner.recalculateStrength();
		return true;
	}

	canPlayCards() {
		if (this.stage === 'BlindStage')
			return this.p1.getUnits().length < this.rules.blindStageUnits;
		else return this.stage === 'Play' && this.turn === this.p1;
	}

	canMoveCards() {
		return this.stage === 'BlindStage'
			|| (this.stage == 'Move' && this.turn === this.p1)
	}
}


