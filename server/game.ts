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
		new CardProto(0, 'Bomber', '<h1>Active</h1>\n Deal 5 damage in a 3x3 square around self', 4, 'BOMB', 'bomberActive'),
		new CardProto(1, 'Healer', '<h1>Start of Turn</h1>\n Heal all the nearest units for 1', 4, 'HEAL', null, 'healerPassive'),
		new CardProto(2, 'Gunner', '<h1>End of Turn</h1>\n Fire forward a bullet dealing 1 damage\n<h1>Active</h1>Fire forward a bullet dealing 2 damage.', 6, 'GUN', 'gunnerActive', null, 'gunnerPassive'),
	],
	minDeckSize: 20,
	maxDeckSize: 30,

	movePointsPerTurn: 2,
	maxMovePoints: 5,
}

class ServerPlayer extends Player {
	session: Session;
	game: ServerGame;

	constructor(game: ServerGame, session: Session, isPlayer2: boolean) {
		super(game, isPlayer2);
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

		const hand = [0,0,0,0,1,1,1,2,2,2,2];
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

	gameOver(winner: ServerPlayer) {
		super.gameOver(winner);

		winner.send({
			message: 'gameOver',
			won: true
		});
		(this.otherPlayer(winner) as ServerPlayer).send({
			message: 'gameOver',
			won: false
		});
		this.abortGame();
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

	handleGameWsMessage(session: Session, message: Message): boolean {
		const p = session === this.p1.session ? this.p1 : this.p2;

		var r: number;
		switch (message.message) {
			case 'doneWithBlindStage': r = this.handleDWBS(p, message as any); break;
			case 'playCard':           r = this.handlePlayCard(p, message);    break;
			case 'moveCard':           r = this.handleMoveCard(p, message);    break;
			case 'skip':               r = this.handleSkip(p, message);        break;
			case 'active':             r = this.handleActive(p, message);      break;
			default: return false;
		}
		if (r != 0) {
			console.log(`Handler for ${message.message} failed @${r}`);
			this.p1.send({ message: 'desync' });
			this.p2.send({ message: 'desync' });
			this.abortGame();
			return false;
		}
		return true;
	}

	abortGame() {
		this.p1.session.lobby.game = null;
		this.p2.session.lobby.game = null;
	}

	handleMoveCard(p: ServerPlayer, msg: Message): number {
		// We need this because we don't accept move messages
		// during the blind stage, canMoveCard would let them
		// pass through
		if (this.inBlindStage)
			return 1;

		var { id, x, y } = msg;
		if (typeof id !== 'number' || !this.coordinatesValid(x, y))
			return 2;
		x = p.clientToServerX(x);
		y = p.clientToServerY(y);

		const card = this.cards[id];

		const cm = p.S_canMoveCard(x, y, card);
		if (!cm) {
			return 3;
		}

		p.S_moveCard(x, y, card);

		const otherPlayer = (this.otherPlayer(this.turn) as ServerPlayer);
		otherPlayer.send({
			message: 'opponentMovedCard',
			id: card.id,
			x: otherPlayer.clientToServerX(x),
			y: otherPlayer.clientToServerY(y),
		});

		return 0;
	}

	handleSkip(p: ServerPlayer, _msg: Message): number {
		if (this.turn !== p)
			return 1;
		const playerToNotify = this.otherPlayer(this.turn) as ServerPlayer;
		playerToNotify.send({
			message: 'endTurn'
		});
		this.nextTurn();
		return 0;
	}

	handlePlayCard(p: ServerPlayer, msg: Message): number {
		// We need this because we don't accept Play messages
		// during the blind stage, canMoveCard would let them
		// pass through
		if (this.inBlindStage)
			return 1;

		var { id, x, y } = msg;
		if (typeof id !== 'number' || !this.coordinatesValid(x, y))
			return 2;
		x = p.clientToServerX(x);
		y = p.clientToServerY(y);

		const card = this.cards[id];
		if (!p.S_canPlayCardFromHand(x, y, card))
			return 3;

		p.S_playCardFromHand(x, y, card);

		const otherPlayer = (this.otherPlayer(this.turn) as ServerPlayer);
		otherPlayer.send({
			message: 'opponentPlayedCard',
			id: card.id,
			cardID: card.proto.cardID,
			x: otherPlayer.clientToServerX(x),
			y: otherPlayer.clientToServerY(y),
		});
		p.justPlayedCard = card;
		return 0;
	}

	handleActive(p: ServerPlayer, msg: Message): number {
		if (typeof msg.id !== 'number')
			return 1;
		const card = this.cards[msg.id];
		if (card && p.active(card)) {
			(this.otherPlayer(p) as ServerPlayer).send({
				message: 'active',
				id: card.id
			});
			return 0;
		}
		return 2;
	}

	handleDWBS(p: ServerPlayer, msg: DoneWithBlindStageMessage): number {
		// Validate the message
		if (!this.inBlindStage || p.doneWithBlindStage || !Array.isArray(msg.played) || msg.played.length > this.rules.blindStageUnits)
			return 1;

		const takenxy = [];
		for (const cardInfo of msg.played) {
			let [id, x, y] = cardInfo;
			if (typeof id !== 'number' || !this.coordinatesValid(x, y))
				return 2;

			const card = this.cards[id];
			x = p.clientToServerX(x);
			y = p.clientToServerY(y);

			if (!p.S_canPlayCardFromHand(x, y, card))
				return 3;

			// Make sure there aren't two cards with the same coords
			// from the ones the player wants to play
			const xy = this._xy(x, y);
			if (takenxy.indexOf(xy) !== -1)
				return 4;
			takenxy.push(xy);
		}

		for (const cardInfo of msg.played) {
			let [id, x, y] = cardInfo;
			const card = this.cards[id];

			x = p.clientToServerX(x);
			y = p.clientToServerY(y);

			p.S_playCardFromHand(x, y, card);
		}

		p.doneWithBlindStage = true;
		if ((this.otherPlayer(p) as ServerPlayer).doneWithBlindStage)
			this.blindStageOver();

		return 0;
	}

	blindStageOver() {
		const str1 = this.p1.strength;
		const str2 = this.p2.strength;

		this.turn = str1 >= str2 ? this.p1 : this.p2;
		this.firstTurn();

		this.p1.send({
			message: 'blindStageOver',
			otherPlayerPlayed: this.p2.getUnits().map(unit => [
				unit.id,
				unit.proto.cardID,
				this.p1.clientToServerX(unit.x),
				this.p1.clientToServerY(unit.y)
			]),
			myTurn: this.turn === this.p1,
		} as BlindStageOverMessage);

		this.p2.send({
			message: 'blindStageOver',
			otherPlayerPlayed: this.p1.getUnits().map(unit => [
				unit.id,
				unit.proto.cardID,
				this.p2.clientToServerX(unit.x),
				this.p2.clientToServerY(unit.y)
			]),
			myTurn: this.turn === this.p2,
		} as BlindStageOverMessage);

	}

}
