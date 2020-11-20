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
		new CardProto(0, 'Bomber', 'ACTIVE: Deal 5 damage to all units in a 3x3 square around the bomber', 4, 'BOMB', 'bomberActive'),
		new CardProto(1, 'Healer', 'SOT: Heal all the nearest units for 1', 4, 'HEAL', null, 'healerPassive'),
		new CardProto(2, 'Gunner', 'EOT: Fire a bullet dealing 1 damage.', 6, 'GUN', 'gunnerActive', null, 'gunnerPassive'),
	],
	minDeckSize: 20,
	maxDeckSize: 30,

	movePointsPerTurn: 2,
	maxMovePoints: 5,
}

class ServerPlayer extends Player {
	session: Session;
	game: ServerGame;
	doneWithBlindStage: boolean;

	constructor(game: ServerGame, session: Session, isPlayer2: boolean) {
		super(game, isPlayer2);
		this.doneWithBlindStage = false;
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

	handleGameWsMessage(session: Session, message: Message) {
		const p = session === this.p1.session ? this.p1 : this.p2;

		switch (message.message) {
			case 'doneWithBlindStage': {
				this.onPlayerDoneWithBlindStage(p, message as DoneWithBlindStageMessage);
				return true;
			}
			case 'playCard': {
				if (!this.handlePlayCard(p, message))
					console.log('handlePlayCard fail');
				return true;
			}
			case 'moveCard': {
				if (!this.handleMoveCard(p, message))
					console.log('handleMoveCard fail');
				return true;
			}
			case 'skip': {
				if (!this.handleSkip(p, message))
					console.log('handleSkip fail');
				return true;
			}
			case 'active': {
				if (!this.handleActive(p, message))
					console.log('handleActive fail');
				return true;
			}
		}
	}

	handleMoveCard(p: ServerPlayer, msg: Message): boolean {
		// We need this because we don't accept move messages
		// during the blind stage, canMoveCard would let them
		// pass through
		if (this.stage !== 'Move')
			return false;

		var { id, x, y } = msg;
		if (typeof id !== 'number' || !this.coordinatesValid(x, y))
			return false;
		x = p.clientToServerX(x);
		y = p.clientToServerY(y);

		const card = this.cards[id];

		if (!p.S_canMoveCard(x, y, card))
			return false;

		this.putCard(x, y, card);

		const otherPlayer = (this.otherPlayer(this.turn) as ServerPlayer);
		otherPlayer.send({
			message: 'opponentMovedCard',
			id: card.id,
			x: otherPlayer.clientToServerX(x),
			y: otherPlayer.clientToServerY(y),
		});

		// we don't notify the client for this, they can infer it
		this.turn.movePoints -= 1;
		if (this.turn.movePoints === 0)
			this.nextStage(); 
		return true;
	}

	handleSkip(p: ServerPlayer, _msg: Message) {
		if (this.turn !== p)
			return false;
		const playerToNotify = this.otherPlayer(this.turn) as ServerPlayer;
		playerToNotify.send({
			message: 'nextStage'
		});
		this.nextStage();
		return true;
	}

	handlePlayCard(p: ServerPlayer, msg: Message): boolean {
		// We need this because we don't accept Play messages
		// during the blind stage, canMoveCard would let them
		// pass through
		if (this.stage !== 'Play')
			return false;

		var { id, x, y } = msg;
		if (typeof id !== 'number' || !this.coordinatesValid(x, y))
			return false;
		x = p.clientToServerX(x);
		y = p.clientToServerY(y);

		const card = this.cards[id];
		if (!p.S_playCardFromHand(x, y, card))
			return false;

		const otherPlayer = (this.otherPlayer(this.turn) as ServerPlayer);
		otherPlayer.send({
			message: 'opponentPlayedCard',
			id: card.id,
			cardID: card.proto.cardID,
			x: otherPlayer.clientToServerX(x),
			y: otherPlayer.clientToServerY(y),
		});
		this.nextStage();
		return true;
	}

	handleActive(p: ServerPlayer, msg: Message): boolean {
		if (typeof msg.id !== 'number')
			return false;
		const card = this.cards[msg.id];
		if (card && p.active(card)) {
			(this.otherPlayer(p) as ServerPlayer).send({
				message: 'active',
				id: card.id
			});
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

					const card = this.cards[id];
					x = p.clientToServerX(x);
					y = p.clientToServerY(y);

					if (!p.S_canPlayCardFromHand(x, y, card))
						return false;

					// Make sure there aren't two cards with the same coords
					// from the ones the player wants to play
					const xy = this._xy(x, y);
					if (takenxy.indexOf(xy) !== -1)
						return false;
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

				return true;
	}

	blindStageOver() {
		const str1 = this.p1.strength;
		const str2 = this.p2.strength;

		this.turn = str1 >= str2 ? this.p1 : this.p2;
		this.nextStage();

		this.p1.send({
			message: 'blindStageOver',
			otherPlayerPlayed: this.p2.getUnits().map(unit => [
				unit.id,
				unit.proto.cardID,
				this.p1.clientToServerX(unit.x),
				this.p1.clientToServerY(unit.y)
			]),
			myTurn: this.turn === this.p1,
			gameStage: this.stage
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
			gameStage: this.stage
		} as BlindStageOverMessage);

	}

}
