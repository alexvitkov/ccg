import crypto from 'crypto';
import { Session } from './session';


const lobbies2: {[lobbyId: string]: Lobby} = {};

export class Lobby {
	id: string;
	name: string;
	creatorSession: Session;
	otherPlayer: Session;
	gameStarted: boolean;

	constructor(creatorSession: Session) {
		this.creatorSession = creatorSession;
		this.name = creatorSession.username + "'s lobby";
		this.gameStarted = false;

		do {
			this.id = crypto.randomBytes(8).toString('base64');
		} while (this.id in lobbies2);

		lobbies2[this.id] = this;
	}
}


function leaveLobby(session: Session) {
	if (session.lobby) {
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
	}
	session.lobby = null;
	refreshLobbiesForPlayer(session);
}

export function handleLobbyWsMessage(session: Session, message: {[key:string]:any}) {
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
			refreshLobbiesForPlayer(lobby.creatorSession);
			break;
		}

		case 'leaveLobby': {
			leaveLobby(session);
			break;
		}

		default: {
			return false;
		}
	}
	return true;
}

function refreshLobbiesForPlayer(session: Session) {
	const l = Object.values(lobbies2).map(lobby => { return {
		id: lobby.id,
		name: lobby.name,
		players: lobby.otherPlayer ? 2 : 1
	}});
	// console.log(session);
	const lobbyId = (session.lobby?.id);
	session.send(JSON.stringify({
		message: 'listLobbies',
		success: true,
		lobbyId: lobbyId,
		lobbies: l
	}));
}

