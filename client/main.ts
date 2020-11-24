import { handleLobbyMessage, refreshLobbies } from './lobby';

import { game, ClientGame } from './game';
import { set, onGameStarted, desync } from './gameHtml';
import  * as messages from '../messages';

var ws: WebSocket;

(window as any).logOut = function () {
	// TODO make this not suck and delete the cookie from the server
	document.cookie="session=;SameSite=Strict;expires = Thu, 01 Jan 1970 00:00:00 GMT";
	window.location.assign('/');
}

export function send(message: messages.Message) {
	ws.send(JSON.stringify(message));
}

wsConnect(() => {
	refreshLobbies();
});

async function handleMessage(msg: messages.Message): Promise<boolean> {
	switch (msg.message) {
		case 'gameStarted': {
			new ClientGame(msg as messages.GameStartedMessage);
			onGameStarted();
			return true;
		}
	}
	if (handleLobbyMessage(msg))
		return true;
	if (game?.handleMessage(msg))
		return true;
	console.error(`Didn't handle message ${msg}`);
	return false;
}

function wsConnect(callback: () => void) {
	// the ws server is the webserver we're connected to
	const loc = window.location;
	var wsPath = (loc.protocol === "https:" ? "wss:" : "ws:") + "//" + loc.host;

	ws = new WebSocket(wsPath);
	ws.addEventListener('open', _ev => {
		callback();
	});
	ws.addEventListener('message', ev => {
		const msg = JSON.parse(ev.data);
		handleMessage(msg);
	});
	ws.addEventListener('close', ev => {
		desync(`Server closed the connection: ${ev.code}, ${ev.reason}`);
		console.log('WS Closed', ev.code, ev.reason);
	});
}
