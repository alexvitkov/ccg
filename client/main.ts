import { handleLobbyMessage, refreshLobbies } from './lobby';
import { ClientGame } from './game';
import { onGameStarted } from './gameHtml';
import { Message, GameStartedMessage, ListLobbiesResponse } from '../messages';

var ws: WebSocket;

(window as any).logOut = function () {
	// TODO make this not suck and delete the cookie from the server
	document.cookie="session=;SameSite=Strict;expires = Thu, 01 Jan 1970 00:00:00 GMT";
	window.location.assign('/');
}

export function send(message: Message) {
	ws.send(JSON.stringify(message));
}

wsConnect(() => {
	refreshLobbies();
});

function handleMessage(msg: Message): boolean {
	switch (msg.message) {
		case 'gameStarted': {
			console.log('asdf')
			new ClientGame(msg as GameStartedMessage);
			onGameStarted();
			return true;
		}
	}
	return handleLobbyMessage(msg);
}

function wsConnect(callback) {
	// the ws server is the webserver we're connected to
	const loc = window.location;
	var wsPath = (loc.protocol === "https:" ? "wss:" : "ws:") + "//" + loc.host;

	ws = new WebSocket(wsPath);
	ws.addEventListener('open', ev => {
		callback();
	});
	ws.addEventListener('message', ev => {
		const msg = JSON.parse(ev.data);
		handleMessage(msg as Message);
	});
	ws.addEventListener('close', ev => {
		console.log('WS Closed', ev.code, ev.reason);
	});
}
