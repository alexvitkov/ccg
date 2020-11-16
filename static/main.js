var ws;

var lobbyId = 0;
var lobbyIsMine = false;
var createLobbyButton = document.getElementById('createLobbyButton');

const lobbies = document.getElementById("lobbies");
const lobbiesTable = document.getElementById("lobbiesTable");
const noLobbies = document.getElementById("noLobbies");

const game = document.getElementById("game");
const gameBoard = document.getElementById("gameBoard");

var gameSettings = {};
var boardTd = [];

function logOut() {
	// TODO make this not suck and delete the cookie from the server
	document.cookie="session=;SameSite=Strict;expires = Thu, 01 Jan 1970 00:00:00 GMT";
	window.location='/';
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
				lobbyId = msg.lobbyId;
				lobbyIsMine = msg.lobbyIsMine;
				renderNewLobbies(msg.lobbies);
				break;
			}
			case 'gameStarted': {
				gameSettings = msg;
				startGame();
				break;
			}
		}
	});
	ws.addEventListener('close', ev => {
		console.log('WS Closed', ev.code, ev.reason);
	});
}

function send(message) {
	ws.send(JSON.stringify(message));
}

function refreshLobbies() {
	send({
		message: 'listLobbies'
	});
}

function createLobby() {
	send({
		message: 'createLobby'
	});
}

function renderNewLobbies(lobbies) {


	createLobbyButton.disabled = !!lobbyId;

	if (lobbies.length == 0) {
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


	for (const l of lobbies) {
		const row = document.createElement("tr");

		const name = document.createElement("td");
		name.innerText = l.name;
		row.appendChild(name);

		const state = document.createElement("td");
		state.innerText = `Players ${l.players}/2`;
		row.appendChild(state);

		const joinLeaveTd = document.createElement("td");
		const joinLeaveButton = document.createElement("button");
		joinLeaveButton.innerText = l.id == lobbyId ? "Leave": "Join";

		joinLeaveButton.onclick = _ => {
			if (lobbyId == l.id) {
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
		if (lobbyId == l.id) {
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
	refreshLobbies();
});

function startGame() {
	lobbies.style.display = 'none';
	game.style.display = 'block';

	board = new Array(gameSettings.boardWidth * gameSettings.boardHeight);
	
	for (var y = gameSettings.boardHeight - 1; y >= 0; y--) {
		const tr = document.createElement('tr');
		for (var x = 0; x < gameSettings.boardWidth; x++) {
			const td = document.createElement('td');
			td.setAttribute('data-x', x);
			td.setAttribute('data-y', y);
			boardTd[y * game.boardWidth + x] = td;
			tr.appendChild(td);

			if (y < gameSettings.ownHeight)
				td.classList = 'myfield';
			else if (y >= gameSettings.boardHeight - gameSettings.ownHeight)
				td.classList = 'opponentfield';
		}
		gameBoard.appendChild(tr);
	}
}
