import { handleLobbyMessage, refreshLobbies } from './lobby';
import { game, ClientGame } from './game';
import { set, onGameStarted } from './gameHtml';
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

function handleMessage(msg: messages.Message): boolean {
	// TODO handle this in game.ts
	console.log(msg);
	switch (msg.message) {
		case 'gameStarted': {
			new ClientGame(msg as messages.GameStartedMessage);
			onGameStarted();
			return true;
		}
		case 'blindStageOver': {
			game.blindStageOver(msg as messages.BlindStageOverMessage);
			break;
		}
		case 'opponentPlayedCard': {
			const { id, cardID, x, y } = msg;
			game.instantiate(id, game.p2, game.rules.cardSet[cardID]);
			game.putCard(x, y, game.cards[id]);
			game.nextStage();
			break;
		}
		case 'opponentMovedCard': {
			const { id, x, y } = msg;
			game.putCard(x, y, game.cards[id]);
			game.p2.movePoints -= 1;
			if (game.p2.movePoints == 0)
				game.nextStage();
			set('enemyMovePoints', game.p2.movePoints.toString());
			break;
		}
		case 'nextStage': {
			game.nextStage();
			break;
		}
		case 'active': {
			game.p2.active(game.cards[msg.id]);
			break;
		}

	}
	return handleLobbyMessage(msg);
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
		handleMessage(msg as messages.Message);
	});
	ws.addEventListener('close', ev => {
		console.log('WS Closed', ev.code, ev.reason);
	});
}
