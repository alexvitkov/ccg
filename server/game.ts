import { Session } from './session';
import { Card, CardProto, GameRules, Game, Player } from '../game_common';
import { GameStartedMessage, DoneWithBlindStageMessage, BlindStageOverMessage } from '../messages';
import { Message } from '../messages';

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
	game: ServerGame;
	isPlayer2: boolean;
	doneWithBlindStage: boolean;

	constructor(game: ServerGame, session: Session, isPlayer2: boolean) {
		super();
		this.doneWithBlindStage = false;
		this.game = game; 
		this.isPlayer2 = isPlayer2;
		this.session = session;
	}

	clientToServerX(x: number) {
		return this.isPlayer2 ? (this.game.rules.boardWidth - x - 1) : x;
	}

	clientToServerY(y: number) {
		return this.isPlayer2 ? (this.game.rules.boardHeight - y - 1) : y;
	}

	send(msg: {[_: string]: any; message: string;}) {
		this.session.send(msg);
	}
}

export class ServerGame extends Game {

	p1: ServerPlayer;
	p2: ServerPlayer;

	constructor(rules: GameRules, session1: Session, session2: Session) {
		super(rules);
		this.p1 = new ServerPlayer(this, session1, false)
		this.p2 = new ServerPlayer(this, session2, true)

		const hand = [0,0,0,1,1,1,2,2,2];
		this.p1.hand = hand.map(id => this.instantiate(this.p1, this.rules.cardSet[id]));
		this.p2.hand = hand.map(id => this.instantiate(this.p2, this.rules.cardSet[id]));

		session2.send({
			message: 'gameStarted',
			rules: this.rules,
			hand: this.p2.hand.map(c => [c.id, c.proto.cardID]),
			opponentHandSize: this.p1.hand.length
		} as GameStartedMessage);

		session1.send({
			message: 'gameStarted',
			rules: this.rules,
			hand: this.p1.hand.map(c => [c.id, c.proto.cardID]),
			opponentHandSize: this.p2.hand.length
		} as GameStartedMessage);
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

	otherPlayer(p: ServerPlayer) {
		return (p === this.p1) ? this.p2 : this.p1;
	}

	handleGameWsMessage(session: Session, message: Message) {
		const p = session === this.p1.session ? this.p1 : this.p2;

		if (message.message === 'doneWithBlindStage') {
			this.onPlayerDoneWithBlindStage(p, message as DoneWithBlindStageMessage);
			return true;
		}
		return false;
	}

	onPlayerDoneWithBlindStage(p: ServerPlayer, msg: DoneWithBlindStageMessage): boolean {
		// Validate the message
		if (this.stage !== 'BlindStage' 
			|| !Array.isArray(msg.played) 
			|| msg.played.length > this.rules.blindStageUnits)
			return false;

		const takenxy = [];
		for (const cardInfo of msg.played) {
			let [id, x, y] = cardInfo;
			if (typeof id !== 'number' || !this.coordinatesValid(x, y))
				return false;

			// The card has to come from the hand
			const card = this.cards[id];
			const index = p.hand.indexOf(card);
			if (index === -1)
				return false;

			// this check before we transform to server coordinates
			if (y >= this.rules.ownHeight)
				return false;

			// The board position has to be free and valid
			x = p.clientToServerX(x);
			y = p.clientToServerY(y);
			if (x < 0 || y < 0 || x >= this.rules.boardWidth || y >= this.rules.boardHeight)
				return false;

			const xy = this._xy(x, y);
			if (this.getBoard(x, y) || takenxy.indexOf(xy) !== -1)
				return false;

			takenxy.push(xy);
		}

		for (const cardInfo of msg.played) {
			let [id, x, y] = cardInfo;
			const card = this.cards[id];

			x = p.clientToServerX(x);
			y = p.clientToServerY(y);

			p.S_playCardFromHand(card, x, y);
		}

		p.doneWithBlindStage = true;
		if (this.otherPlayer(p).doneWithBlindStage)
			this.blindStageOver();

		return true;
	}

	blindStageOver() {
		const str1 = this.p1.strength;
		const str2 = this.p2.strength;
		const firstPlayer = str1 >= str2 ? this.p1 : this.p2;

		this.p1.send({
			message: 'blindStageOver',
			otherPlayerPlayed: this.p2.getUnits().map(unit => [
				unit.id,
				unit.proto.cardID,
				this.p1.clientToServerX(unit.x),
				this.p1.clientToServerY(unit.y)
			]),
			goFirst: firstPlayer === this.p1,
		} as BlindStageOverMessage);

		this.p2.send({
			message: 'blindStageOver',
			otherPlayerPlayed: this.p1.getUnits().map(unit => [
				unit.id,
				unit.proto.cardID,
				this.p2.clientToServerX(unit.x),
				this.p2.clientToServerY(unit.y)
			]),
			goFirst: firstPlayer === this.p2,
		} as BlindStageOverMessage);

		this.stage = 'Play';
	}

	coordinatesValid(x: number, y: number): boolean {
		return Number.isInteger(x) && Number.isInteger(y)
			&& x >= 0 && y >= 0
			&& x < this.rules.boardWidth && y < this.rules.boardHeight;
	}
}
