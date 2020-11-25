import { GameRules } from './game_common';

export type Message = {
	message: string;
	[_: string]: any;
}

export type ListLobbiesResponse = {
	message: 'listLobbies';
	lobbyId: string;
	lobbyIsMine: boolean;
	lobbies: {id: string, name: string, players: number, gameStarted: boolean }[];
}

export type GameStartedMessage = {
	message: 'gameStarted';
	rules: GameRules;
	hand: number[];
	nextIds: number[],
	opponentHand: number[];
}

export type DoneWithBlindStageMessage = {
	message: 'doneWithBlindStage';
	played: [id: number, protoID: number, x: number, y: number][];
}

export type BlindStageOverMessage = {
	message: 'blindStageOver';
	otherPlayerPlayed: [id: number, cardID: number, x: number, y: number][];
	myTurn: boolean,
	movePoints: number,
}

export type PlayCardMessage = {
	message: 'playCard',
	id: number,
	protoID: number,
	x: number,
	y: number
}

export type FullSyncPlayerState =  {
	movePoints: number,
	activesRemaining: number,
	unitsMoved: number[],
	hand: number[],
	sot: [number,string][],
	eot: [number,string][],
}

export type FullSync = {
	message: 'fullSync',
	rules: GameRules,
	board: {
		id: number,
		x: number,
		y: number,
		mine: boolean,
		proto: number,
		strength: number,
		active: string[],
	}[],
	myTurn: boolean,
	me: FullSyncPlayerState,
	opponent: FullSyncPlayerState,
}
