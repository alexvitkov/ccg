import { GameStartedMessage } from '../messages';
import { Card, Player, Game, GameRules, CardProto } from '../game_common';

export var game: ClientGame;
export var rules: GameRules;

export class ClientGame extends Game {
	constructor(message: GameStartedMessage) {
		super(message.rules, new Player(), new Player());
		this.p1.game = this;
		this.p2.game = this;
		game = this;
		rules = message.rules;

		(document.getElementById('header') as any).style.display = 'none';

		this.p1.hand = message.hand.map(
			c => this.instantiate(c[0], this.p1, rules.cardSet[c[1]]));
	}

	instantiate(id: number, owner: Player, proto: CardProto) {
		const card = new Card(id, owner, proto);
		this.cards[id] = card;
		return card;
	}
}
