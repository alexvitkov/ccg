import { handleLobbyMessage, refreshLobbies } from './lobby';

import { game, ClientGame } from './game';
import { set, onGameStarted } from './gameHtml';
import  * as messages from '../messages';

var ws: WebSocket;

var currentMessage: messages.Message = null;
const messagesQueue: messages.Message[] = [];

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
		case 'blindStageOver': {
			game.blindStageOver(msg as messages.BlindStageOverMessage);
			break;
		}
		case 'opponentPlayedCard': {
			const { id, cardID, x, y } = msg;
			game.instantiate(id, game.p2, game.rules.cardSet[cardID]);
			game.putCard(x, y, game.cards[id]);
			await game.nextStage();
			break;
		}
		case 'opponentMovedCard': {
			const { id, x, y } = msg;
			game.putCard(x, y, game.cards[id]);
			game.p2.movePoints -= 1;
			if (game.p2.movePoints == 0)
				await game.nextStage();
			set('enemyMovePoints', game.p2.movePoints.toString());
			break;
		}
		case 'nextStage': {
			await game.nextStage();
			break;
		}
		case 'active': {
			await game.p2.active(game.cards[msg.id]);
			break;
		}
		case 'fatigue': {
			const unit = game.cards[msg.id];
			await unit.takeDamage(unit.owner.fatigue);
			unit.owner.fatigue++;
			break;
		}

	}
	return handleLobbyMessage(msg);
}

async function handleMessageLoop() {
	while (messagesQueue.length > 0) {
		currentMessage = messagesQueue.shift();
		await handleMessage(currentMessage);
		currentMessage = null;
	}
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
		messagesQueue.push(msg as messages.Message);
		if (!currentMessage)
			handleMessageLoop();
	});
	ws.addEventListener('close', ev => {
		console.log('WS Closed', ev.code, ev.reason);
	});
}
