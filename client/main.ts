import { ClientGame } from './game';
import { onGameStarted } from './gameHtml';
import { Message, GameStartedMessage, ListLobbiesResponse } from '../messages';

var ws: WebSocket;

var lobbyIsMine = false;
var createLobbyButton: HTMLButtonElement = <any>document.getElementById('createLobbyButton');

const lobbiesTable = document.getElementById("lobbiesTable");
const noLobbies = document.getElementById("noLobbies");


(window as any).logOut = function () {
	// TODO make this not suck and delete the cookie from the server
	document.cookie="session=;SameSite=Strict;expires = Thu, 01 Jan 1970 00:00:00 GMT";
	window.location.assign('/');
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
		console.log('WS MSG:', msg);

		switch (msg.message) {
			case 'listLobbies': {
				lobbyIsMine = msg.lobbyIsMine;
				renderNewLobbies(msg);
				break;
			}
			case 'gameStarted': {
				new ClientGame(msg);
				onGameStarted();
				break;
			}
		}
	});
	ws.addEventListener('close', ev => {
		console.log('WS Closed', ev.code, ev.reason);
	});
}

function send(message: {message: string; [_: string]: any}) {
	ws.send(JSON.stringify(message));
}

(window as any).refreshLobbies = function () {
	send({
		message: 'listLobbies'
	});
};

(window as any).createLobby = function () {
	send({
		message: 'createLobby'
	});
};

function renderNewLobbies(resp: ListLobbiesResponse) {
	createLobbyButton.disabled = !!resp.lobbyId;

	if (resp.lobbies.length == 0) {
		lobbiesTable.style.display = 'none';
		noLobbies.style.display = 'block';
		return;
	}
	else {
		lobbiesTable.style.display = 'block';
		noLobbies.style.display = 'none';
	}

	while (lobbiesTable.childElementCount > 1)
		lobbiesTable.removeChild(lobbiesTable.lastChild);


	for (const l of resp.lobbies) {
		const row = document.createElement("tr");

		const name = document.createElement("td");
		name.innerText = l.name;
		row.appendChild(name);

		const state = document.createElement("td");
		state.innerText = `Players ${l.players}/2`;
		row.appendChild(state);

		const joinLeaveTd = document.createElement("td");
		const joinLeaveButton = document.createElement("button");
		joinLeaveButton.innerText = l.id == resp.lobbyId ? "Leave": "Join";

		joinLeaveButton.onclick = _ => {
			if (resp.lobbyId == l.id) {
				send({
					message: "leaveLobby",
					lobby: l.id,
				});
			}
			else {
				send({
					message: "joinLobby",
					lobby: l.id
				});
			}
		};
		joinLeaveTd.appendChild(joinLeaveButton);
		row.appendChild(joinLeaveTd);

		const startTd = document.createElement('td');
		if (resp.lobbyId == l.id) {
			if (lobbyIsMine) {
				const startButton = document.createElement('button');
				startButton.innerText = "Start game";
				startButton.disabled = l.players < 2;
				startTd.appendChild(startButton);

				startButton.onclick = _ => {
					send({ message: "startGame" });
				};
			}
			else {
				startTd.innerText = "Waiting for lobby creator to start...";
			}
		}
		row.appendChild(startTd);

		lobbiesTable.appendChild(row);
	}
}

wsConnect(() => {
	(window as any).refreshLobbies();
});


