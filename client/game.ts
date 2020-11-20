import { Message, GameStartedMessage, DoneWithBlindStageMessage, BlindStageOverMessage } from '../messages';
import { Card, Player, Game, GameRules, CardProto } from '../game_common';
import { set, blindStageOver, makeCardDiv } from './gameHtml';
import { send } from './main';

export var game: ClientGame;
export var rules: GameRules;


export class ClientPlayer extends Player {
	game: Game;

	constructor(game: Game) {
		super();
		this.game = game;
	}
	 
	recalculateStrength() {
		set(this === game.p1 ? 'myStrength' : 'enemyStrength', this.strength.toString());
	}
}

export class ClientGame extends Game {
	constructor(message: GameStartedMessage) {
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
		const card = new Card(id, owner, proto);
		this.cards[id] = card;
		return card;
	}

	doneWithBlindStage() {
		send({
			message: 'doneWithBlindStage',
			played: Object.values(this.board).map(card => [card.id, card.x, card.y])
		} as DoneWithBlindStageMessage);
	}

	blindStageOver(msg: BlindStageOverMessage) {
		for (const [id, cardID, x, y] of msg.otherPlayerPlayed) {
		 	const card = this.instantiate(id, this.p2, this.rules.cardSet[cardID]);
			const xy = this.xy(x, y);
			this.board[xy] = card;
			makeCardDiv(card, x, y);
		}
		blindStageOver();
	}
}


