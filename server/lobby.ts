import crypto from 'crypto';
import { Session } from './session';
import { ruleset, ServerGame } from './game';

import { Message, ListLobbiesResponse } from '../messages';

const lobbies2: {[lobbyId: string]: Lobby} = {};


export class Lobby {
	id: string;
	name: string;
	creatorSession: Session;
	otherPlayer: Session;
	game: ServerGame;

	get gameStarted(): boolean {
		return !!this.game;
	}

	constructor(creatorSession: Session) {
		this.creatorSession = creatorSession;
		this.name = creatorSession.username + "'s lobby";
		this.game = null;

		do {
			this.id = crypto.randomBytes(8).toString('base64');
		} while (this.id in lobbies2);

		lobbies2[this.id] = this;
	}
}


function leaveLobby(session: Session) {
	if (session.lobby && !session.lobby.gameStarted) {
		const lobby = session.lobby;

		if (lobby.creatorSession === session) {
			delete lobbies2[lobby.id];
			if (lobby.otherPlayer) {
				lobby.otherPlayer.lobby = null;
				refreshLobbiesForPlayer(session.lobby.otherPlayer);
			}
		}
		else {
			session.lobby = null;
			lobby.otherPlayer = null;
			refreshLobbiesForPlayer(lobby.creatorSession);
		}
		session.lobby = null;
	}
	refreshLobbiesForPlayer(session);
}

export function handleLobbyWsMessage(session: Session, message: Message) {
	console.log(message.message);
	switch (message.message) {
		case 'createLobby': {
			if (!session.lobby)
				session.lobby = new Lobby(session);
			refreshLobbiesForPlayer(session);
			break;
		}

		case 'listLobbies': {
			refreshLobbiesForPlayer(session);
			break;
		}

		case 'joinLobby': {
			if (session.lobby !== null) {
				leaveLobby(session);
			}
			const lobby = lobbies2[message.lobby];
			if (lobby && !lobby.otherPlayer && lobby.creatorSession !== session) {
				lobby.otherPlayer = session;
				session.lobby = lobby;
			}
			refreshLobbiesForPlayer(session);

			// TODO creatorSession is sometimes lost?? crash here
			refreshLobbiesForPlayer(lobby.creatorSession); 
			break;
		}

		case 'leaveLobby': {
			leaveLobby(session);
			break;
		}

		case 'startGame': {
			if (session.lobby && !session.lobby.game && session.lobby.creatorSession == session && session.lobby.otherPlayer) {
				session.lobby.game = new ServerGame(ruleset, session.lobby.creatorSession, session.lobby.otherPlayer);
				break;
			}
		}

		default: {
			if (session.lobby && session.lobby.game) {
				return session.lobby.game.handleGameWsMessage(session, message);
			}
			return false;
		}
	}

	return true;
}

function refreshLobbiesForPlayer(session: Session) {
	const l = Object.values(lobbies2).map(lobby => { return {
		id: lobby.id,
		name: lobby.name,
		players: lobby.otherPlayer ? 2 : 1,
		gameStarted: lobby.gameStarted
	}});
	const lobbyId = (session.lobby?.id);

	const msg: ListLobbiesResponse = {
		message: 'listLobbies',
		lobbyId: lobbyId,
		lobbyIsMine: session.lobby?.creatorSession === session,
		lobbies: l
	};
	session.send(msg);
}
