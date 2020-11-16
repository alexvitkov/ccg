import { GameRules } from './game_common';

export type Message = {
	message: string;
	[_: string]: any;
};

export type ListLobbiesResponse = {
	message: 'listLobbies';
	lobbyId: string;
	lobbyIsMine: boolean;
	lobbies: {id: string, name: string, players: number, gameStarted: boolean }[];
};

export type GameStartedMessage = {
	message: 'gameStarted';
	rules: GameRules;
	//     cardID   card proto ID
	hand: [number, number][];
	opponentHandSize: number;
}
