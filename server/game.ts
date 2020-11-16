import { Session } from './session';

class Card {
	cardID: number;
	cardName: string;
	baseStrength: number;

	cardLetter: string;
	cardColor: string;
}

class PlayerState {
	hand: Card[];
}

export class Game {
	boardWidth: number;
	boardHeight: number;
	blindStageUnits: number;
	ownHeight: number;

	player1: Session;
	player2: Session;

	ps1: PlayerState;
	ps2: PlayerState;

	constructor(boardWidth: number, boardHeight: number, ownHeight: number, player1: Session, player2: Session, blindStageUnits: number) {
		this.boardWidth = boardWidth;
		this.boardHeight = boardHeight;
		this.blindStageUnits = blindStageUnits;
		this.ownHeight = ownHeight;	

		player1.send({
			message: 'gameStarted',
			boardWidth: this.boardWidth,
			boardHeight: this.boardHeight,
			ownHeight: this.ownHeight,
			blindStageUnits: this.blindStageUnits,
		});
		player2.send({
			message: 'gameStarted',
			boardWidth: this.boardWidth,
			boardHeight: this.boardHeight,
			ownHeight: this.ownHeight,
			blindStageUnits: this.blindStageUnits,
		});
	}

	handleGameWsMessage(session: Session, message: {[key:string]:any}) {
		return false;
	}
}

