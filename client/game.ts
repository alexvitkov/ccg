import * as messages from '../messages';
import { Card, Player, Game, GameRules, Proto, fail } from '../game_common';
import { set, blindStageOver, turnChanged, makeCardDiv, fieldDivs, desync, gameOver, provisionChanged } from './gameHtml';
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
	
	constructor(id: number, owner: Player, proto: Proto) {
		super(id, owner, proto);
		this.div = makeCardDiv(this);
		if (this.sot)
			highlight(this.sot);
		if (this.eot)
			highlight(this.eot);
		if (this.active)
			highlight(this.active);
	}

	giveId(): boolean {
		if (this.id)
			return fail('Trying to call giveId on a unit that already has one');
		if (this.owner.nextId.length === 0)
			return fail('Out of IDs');
		this.id = this.owner.nextId.pop();
		return true;
	}

	takeDamage(dmg: number) {
		this.owner.game.push(ve.TakeDamage(this, this.strength, dmg));
		super.takeDamage(dmg);
	}

}

export class ClientPlayer extends Player {
	game: ClientGame;

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

	instantiate(proto: Proto, id?: number): ClientCard {
		if (id && !this.isPlayer2) {
			const index = this.nextId.indexOf(id);
			if (index === -1) {
				console.log('Invalid ID');
				return null;
			}
			this.nextId.splice(index, 1);
		}
		const card = new ClientCard(id, this, proto);
		this.game.cards[id] = card;
		return card;
	}

	playCard(x: number, y: number, card: ClientCard) {
		if (!this.isPlayer2)
			card.giveId();

		super.playCard(x, y, card);

		if (!this.isPlayer2 && !game.inBlindStage) {
			send({
				message: 'playCard',
				id: card.id,
				protoID: card.proto.protoID,
				x: x,
				y: y
			});
		}

		provisionChanged();
		set('opponentProvision', game.p2.provision.toString());
		return true;
	}

	S_moveCard(x: number, y: number, card: ClientCard) {
		super.S_moveCard(x, y, card);
		if (!this.game.inBlindStage && !this.isPlayer2) {
			set('myMovePoints', this.movePoints.toString());
			send({
				message: 'moveCard',
				id: card.id,
				x: x,
				y: y
			});
			set(this.isPlayer2 ? 'enemyMovePoints' : 'myMovePoints', this.movePoints.toString());
		}
	}

	allowedPlaySquaresXY(addX?: number, addY?: number): number[] {
		const squares = [];
		for (let y = 0; y < this.game.rules.ownHeight; y++) {
			for (let x = 0; x < this.game.rules.boardWidth; x++) {
				if (!game.getBoard(x, y) || (game.inBlindStage && x === addX && y === addY))
					squares.push(this.game._xy(x, y));
			}
		}
		return squares;
	}

	allowedMoveSquaresXY(card: Card): number[] {
		const squares = [];
		// We're moving a card, valid squares are the neighboring ones
		squares.push(this.game._xy(card.x, card.y));
		if (card.x > 0 && !this.game.getBoard(card.x - 1, card.y))
			squares.push(this.game._xy(card.x - 1, card.y));
		if (card.x < this.game.rules.boardWidth + 1 && !this.game.getBoard(card.x + 1, card.y))
			squares.push(this.game._xy(card.x + 1, card.y));
		if (card.y > 0 && !this.game.getBoard(card.x, card.y - 1))
			squares.push(this.game._xy(card.x, card.y - 1));
		if (card.y < this.game.rules.boardHeight - 1 && !this.game.getBoard(card.x, card.y + 1))
			squares.push(this.game._xy(card.x, card.y + 1));
		return squares;
	}

	recalculateStrength() {
		set(this === game.p1 ? 'myStrength' : 'enemyStrength', this.strength.toString());
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
		this.p1 = new ClientPlayer(this, message.nextIds, false);
		this.p2 = new ClientPlayer(this, null, true);

		game = this;
		rules = this.rules;

		(document.getElementById('header') as any).style.display = 'none';
		this.p1.hand = message.hand.map(c => game.rules.cardSet[c]);
		// this.p2.hand = message.hand.map(c => game.rules.cardSet[c]);

		set('myProvision', this.p1.provision.toString());
		set('opponentProvision', this.p2.provision.toString());
		set('maxProvision', this.rules.provision.toString());
	}



	destroy(card: ClientCard) {
		super.destroy(card);
		this.push(() => { 
			card.owner.recalculateStrength();
			card.div.remove(); 
		});
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

	doneWithBlindStage() {
		this.p1.doneWithBlindStage = true;
		// Give the units IDs
		for (const unit of this.p1.getUnits())
			(unit as ClientCard).giveId();

		send({
			message: 'doneWithBlindStage',
			played: Object.values(this._board).map(card => [card.id, card.proto.protoID, card.x, card.y])
		} as messages.DoneWithBlindStageMessage);
	}

	blindStageOver(msg: messages.BlindStageOverMessage) {
		for (const [id, cardID, x, y] of msg.otherPlayerPlayed) {
			const card = this.p2.instantiate(this.rules.cardSet[cardID], id);
			this.putCard(x, y, card as ClientCard);
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
			case 'newId': {
				this.p1.nextId.push(msg.id);
				break;
			}
			case 'blindStageOver': {
				this.blindStageOver(msg as messages.BlindStageOverMessage);
				break;
			}
			case 'opponentPlayedCard': {
				// TODO validation here
				const { id, cardID, x, y } = msg;
				const card = this.p2.instantiate(this.rules.cardSet[cardID], id);
				this.putCard(x, y, card);
				this.p2.justPlayedCard = card;
				break;
			}
			case 'opponentMovedCard': {
				const { id, x, y } = msg;
				const card = this.getCard(id);
				if (!card || !this.p2.S_canMoveCard(x, y, card))
					return false;
				this.p2.S_moveCard(x, y, card as ClientCard);
				break;
			}
			case 'endTurn': {
				if (this.turn === this.p2) {
					this.nextTurn();
				}
				else return fail(`Received endTurn from server during my turn!`);
				break;
			}
			case 'active': {
				return this.p2.active(this.cards[msg.id]);
			}
			default: {
				return false;
			}
		}
		return true;
	}
}


