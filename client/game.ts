import * as messages from '../messages';
import { Card, Player, Game, GameRules, CardProto } from '../game_common';
import { set, blindStageOver, makeCardDiv, fieldDivs } from './gameHtml';
import { send } from './main';

export var game: ClientGame;
export var rules: GameRules;

export class ClientCard extends Card {
	div: HTMLDivElement;
	
	constructor(id: number, owner: Player, proto: CardProto) {
		super(id, owner, proto);
		this.div = makeCardDiv(this);
	}
}

export class ClientPlayer extends Player {
	game: Game;

	constructor(game: Game) {
		super();
		this.game = game;
	}
	 
	recalculateStrength() {
		set(this === game.p1 ? 'myStrength' : 'enemyStrength', this.strength.toString());
	}

	// previousCard = null to insert at start of hand
	returnCard(card: Card, previousCard?: Card) {
		const pcIndex = this.hand.indexOf(previousCard);
		this.hand.splice(pcIndex + 1, 0, card);
		this.recalculateStrength();
	}
}

export class ClientGame extends Game {
	p1: ClientPlayer;
	p2: ClientPlayer;

	constructor(message: messages.GameStartedMessage) {
		super(message.rules);
		this.p1 = new ClientPlayer(this);
		this.p2 = new ClientPlayer(this);

		game = this;
		rules = this.rules;

		(document.getElementById('header') as any).style.display = 'none';

		this.p1.hand = message.hand.map(
			c => this.instantiate(c[0], this.p1, rules.cardSet[c[1]]));
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
		blindStageOver();
	}

	putCard(x: number, y: number, card: ClientCard) {
		fieldDivs[this._xy(x, y)].appendChild(card.div);
		super.putCard(x, y, card);
	}

	canPlayCards() {
		return this.stage === 'BlindStage' 
			&& this.p1.getUnits().length < this.rules.blindStageUnits;
	}
}


