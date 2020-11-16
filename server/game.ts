import { Session } from './session';
import { Card, CardProto, GameRules, Game, Player } from './game_common';

export const ruleset: GameRules = {
	boardWidth: 7,
	boardHeight: 6,
	ownHeight: 3,
	startingHandSize: 10,
	blindStageUnits: 3,
	cardSet: [
		new CardProto(0, 'Bomber', 4, 'BOMB'),
		new CardProto(1, 'Healer', 3, 'HEAL'),
		new CardProto(2, 'Gunner', 3, 'GUN'),
	],
	minDeckSize: 20,
	maxDeckSize: 30,
}

class ServerPlayer extends Player {
	session: Session;

	constructor(session: Session) {
		super();
		this.session = session;
	}

	send(msg: {[_: string]: any; message: string;}) {
		this.session.send(msg);
	}
}

export class ServerGame extends Game {

	constructor(rules: GameRules, session1: Session, session2: Session) {

		super(rules, new ServerPlayer(session1), new ServerPlayer(session2));

		const hand = [0,0,0,1,1,1,2,2,2];
		this.p1.hand = hand.map(id => this.instantiate(this.p1, this.rules.cardSet[id]));
		this.p2.hand = hand.map(id => this.instantiate(this.p2, this.rules.cardSet[id]));

		session1.send({
			message: 'gameStarted',
			rules: this.rules,
			hand: this.p1.hand.map(c => [c.id, c.proto.cardID]),
			opponentHandSize: this.p2.hand.length
		});
		session2.send({
			message: 'gameStarted',
			rules: this.rules,
			hand: this.p2.hand.map(c => [c.id, c.proto.cardID]),
				opponentHandSize: this.p1.hand.length,
		});
	}

	instantiate(owner: Player, proto: CardProto) {
		var id: number;
		do { 
			id = Math.floor(Math.random() * 1_000_000);
		} while (id in this.cards);
		const card = new Card(id, owner, proto);
		this.cards[id] = card;
		return card;
	}

	handleGameWsMessage(session: Session, message: {[key:string]:any}) {
		return false;
	}
}
