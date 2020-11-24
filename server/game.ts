import { Session } from './session';
import { fail, Proto, GameRules, Card, Game, Player } from '../game_common';
import * as messages from '../messages';

export const ruleset: GameRules = {
	boardWidth: 7,
	boardHeight: 6,
	ownHeight: 3,
	startingHandSize: 10,
	blindStageUnits: 3,
	cardSet: [
		new Proto(0, 'Bomber', '<h1>Active</h1>\n Deal 5 damage in a 3x3 square around self', 
				  4, 6, 'BOMB', 'bomberActive'),
		new Proto(1, 'Healer', '<h1>Start of Turn</h1>\n Heal all the nearest units for 1', 
				  3, 7, 'HEAL', null, 'healerPassive'),
		new Proto(2, 'Gunner', '<h1>End of Turn</h1>\n Fire forward a bullet dealing 1 damage\n<h1>Active</h1>Fire forward a bullet dealing 2 damage.', 
				  5, 5, 'GUN', 'gunnerActive', null, 'gunnerPassive'),
	],
	deckSize: 20,
	provision: 50,
	movePointsPerTurn: 2,
	maxMovePoints: 5,
}

class ServerPlayer extends Player {
	session: Session;
	game: ServerGame;

	instantiate(proto: Proto, id?: number): Card {
		const index = this.nextId.indexOf(id);
		if (index === -1) {
			fail(`index doesn't belong to player`);
			return null;
		}
		this.nextId.splice(index, 1);
		const card = new Card(id, this, proto); 
		this.game.cards[id] = card;
		return card
	}

	constructor(game: ServerGame, nextIds: number[], session: Session, isPlayer2: boolean) {
		super(game, nextIds, isPlayer2);
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

		const nextIds1 = [];
		for (let i = 0; i < rules.blindStageUnits + 1; i++)
			nextIds1.push(this.createId());
		const nextIds2 = [];
		for (let i = 0; i < rules.blindStageUnits + 1; i++)
			nextIds2.push(this.createId());

		this.p1 = new ServerPlayer(this, nextIds1, session1, false)
		this.p2 = new ServerPlayer(this, nextIds2, session2, true)

		const hand = [0, 1, 2];
		this.p1.hand = hand.map(id => rules.cardSet[id]);
		this.p2.hand = hand.map(id => rules.cardSet[id]);

		session1.send({
			message: 'gameStarted',
			rules: this.rules,
			hand: this.p1.hand.map(proto => proto.protoID),
			opponentHand: [],
			nextIds: nextIds1
		} as messages.GameStartedMessage);

		session2.send({
			message: 'gameStarted',
			rules: this.rules,
			hand: this.p2.hand.map(proto => proto.protoID),
			opponentHand: [],
			nextIds: nextIds2
		} as messages.GameStartedMessage);
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

	createId() {
		var id: number;
		do { 
			id = 1 + Math.floor(Math.random() * 1_000_000);
		} while (id in this.cards);
		return id;
	}

	fullSyncPlayerState(player: ServerPlayer): messages.FullSyncPlayerState {
		return {
			movePoints: player.movePoints,
			activesRemaining: player.usedActive ? 0 : 1,
			unitsMoved: player.justMovedCards.map(c => c.id),
			hand: player.hand.map(proto => proto.protoID),
			sot: null,
			eot: null,
		}
	}

	fullSync(player: ServerPlayer): messages.FullSync {
		return {
			message: 'fullSync',
			rules: this.rules,
			board: Object.values(this._board).map(c => { return {
				id: c.id,
				x: player.clientToServerX(c.x),
				y: player.clientToServerY(c.y),
				mine: c.owner === player,
				proto: c.proto.protoID,
				strength: c.strength,
				active: null, // TODO
			}}),
			myTurn: this.turn === player,
			me: this.fullSyncPlayerState(player),
			opponent: this.fullSyncPlayerState(this.otherPlayer(player) as ServerPlayer),
		};
	}

	handleGameWsMessage(session: Session, message: messages.Message): boolean {
		const p = session === this.p1.session ? this.p1 : this.p2;

		switch (message.message) {
			case 'doneWithBlindStage': return this.handleDWBS(p, message as any);
			case 'playCard':           return this.handlePlayCard(p, message as any);
			case 'moveCard':           return this.handleMoveCard(p, message);
			case 'skip':               return this.handleSkip(p, message);
			case 'active':             return this.handleActive(p, message);
			default: return false;
		}
		/*
		if (r != 0) {
			console.log(`Handler for ${message.message} failed @${r}`);
			this.fullSync(this.p1);
			this.fullSync(this.p2);
			this.abortGame();
			return false;
		}
		return true;
		*/
	}

	abortGame() {
		this.p1.session.lobby.game = null;
		this.p2.session.lobby.game = null;
	}

	handleMoveCard(p: ServerPlayer, msg: messages.Message): boolean {
		if (this.inBlindStage)
			return fail(`Rejected moveCard during blind stage`);

		var { id, x, y } = msg;
		if (typeof id !== 'number')
			return fail(`id not a number`);
 		if (!this.coordinatesValid(x, y))
			return false;

		x = p.clientToServerX(x);
		y = p.clientToServerY(y);

		const card = this.cards[id];
		if (!card)
			return fail(`card ${id} doesn't exist`);

		if (!p.S_canMoveCard(x, y, card))
			return false;

		p.S_moveCard(x, y, card);

		const otherPlayer = (this.otherPlayer(this.turn) as ServerPlayer);
		otherPlayer.send({
			message: 'opponentMovedCard',
			id: card.id,
			x: otherPlayer.clientToServerX(x),
			y: otherPlayer.clientToServerY(y),
		});

		return true;
	}

	handleSkip(p: ServerPlayer, _msg: messages.Message): boolean {
		if (this.turn !== p)
			return fail(`Rejected handleSkip during other player's turn`);
		const playerToNotify = this.otherPlayer(this.turn) as ServerPlayer;
		playerToNotify.send({
			message: 'endTurn'
		});
		this.nextTurn();
		return true;
	}

	handlePlayCard(p: ServerPlayer, msg: messages.PlayCardMessage): boolean {
		// We need this because we don't accept Play messages
		// during the blind stage, canMoveCard would let them
		// pass through
		if (this.inBlindStage)
			return fail(`Rejected playCard during blind stage`);

		var { id, protoID, x, y } = msg;
		if (typeof id !== 'number' || typeof protoID !== 'number' || !this.coordinatesValid(x, y))
			return fail(`Invalid message types for playCard: ${msg}`);
		x = p.clientToServerX(x);
		y = p.clientToServerY(y);

		const proto = this.rules.cardSet[protoID];
		if (!proto)
			return fail(`Invalid proto - ID: ${protoID}`);

		if (!p.nextId.includes(id))
			return fail(`id ${id} doesn't belong to player: ${p.nextId}`);

		if (!p.S_canPlayCardFromHand(x, y, proto))
			return false;

		const card = p.instantiate(proto, id);
		p.playCard(x, y, card);

		const otherPlayer = (this.otherPlayer(this.turn) as ServerPlayer);
		otherPlayer.send({
			message: 'opponentPlayedCard',
			id: card.id,
			cardID: card.proto.protoID,
			x: otherPlayer.clientToServerX(x),
			y: otherPlayer.clientToServerY(y),
		});

		const newId = this.createId();
		p.nextId.push(newId);
		p.send({
			message: 'newId',
			id: newId
		});

		return true;
	}

	handleActive(p: ServerPlayer, msg: messages.Message): boolean {
		if (typeof msg.id !== 'number')
			return fail(`msg.id not a number`);

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

	handleDWBS(p: ServerPlayer, msg: messages.DoneWithBlindStageMessage): boolean {
		// Validate the message
		if (!this.inBlindStage)
			return fail(`not in blind stage`);
		if(p.doneWithBlindStage)
			return fail(`player done with blind stage`);
		if(!Array.isArray(msg.played) || msg.played.length > this.rules.blindStageUnits)
			return fail(`invalid msg.played`);

		const takenxy = [];
		const takenid = [];
		for (const cardInfo of msg.played) {
			let [id, protoID, x, y] = cardInfo;
			if (typeof id !== 'number' || typeof protoID !== 'number' || !this.coordinatesValid(x, y))
				return fail(`invalid data type for a unit in the messagage`);

			const proto = this.rules.cardSet[protoID];
			x = p.clientToServerX(x);
			y = p.clientToServerY(y);

			if (!p.nextId.includes(id))
				return fail(`id ${id} doesn't belong to player: ${p.nextId}`);
			if (takenid.includes(id))
				return fail(`id taken by a previous card in the message`);
			takenid.push(id);

			if (!p.S_canPlayCardFromHand(x, y, proto))
				return false;

			// Make sure there aren't two cards with the same coords
			// from the ones the player wants to play
			const xy = this._xy(x, y);
			if (takenxy.indexOf(xy) !== -1)
				return fail(`position taken by a previous card in the message`);
			takenxy.push(xy);
		}

		for (const cardInfo of msg.played) {
			let [id, protoID, x, y] = cardInfo;
			const proto = this.rules.cardSet[protoID];

			x = p.clientToServerX(x);
			y = p.clientToServerY(y);

			const card = p.instantiate(proto, id);
			this.putCard(x, y, card);
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
		this.firstTurn();

		this.p1.send({
			message: 'blindStageOver',
			otherPlayerPlayed: this.p2.getUnits().map(unit => [
				unit.id,
				unit.proto.protoID,
				this.p1.clientToServerX(unit.x),
				this.p1.clientToServerY(unit.y)
			]),
			myTurn: this.turn === this.p1,
		} as messages.BlindStageOverMessage);

		this.p2.send({
			message: 'blindStageOver',
			otherPlayerPlayed: this.p1.getUnits().map(unit => [
				unit.id,
				unit.proto.protoID,
				this.p2.clientToServerX(unit.x),
				this.p2.clientToServerY(unit.y)
			]),
			myTurn: this.turn === this.p2,
		} as messages.BlindStageOverMessage);

	}

}
