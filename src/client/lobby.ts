import { Message, ListLobbiesResponse } from '../messages' 
import { send } from './main' 

var createLobbyButton: HTMLButtonElement = <any>document.getElementById('createLobbyButton');
createLobbyButton.onclick = _ => { send({ message: 'createLobby' }); };

document.getElementById('refreshLobbiesButton').onclick = refreshLobbies;

var lobbyIsMine = false;
const lobbiesTable = document.getElementById("lobbiesTable");
const noLobbiesDiv = document.getElementById("noLobbies");

export function refreshLobbies() {
	send({ message: 'listLobbies' });
}

export function handleLobbyMessage(msg: Message): boolean {
	switch (msg.message) {
		case 'listLobbies': {
			lobbyIsMine = msg.lobbyIsMine;
			renderNewLobbies(msg as ListLobbiesResponse);
			return true;
		}
	}
	return false;
}

function renderNewLobbies(resp: ListLobbiesResponse) {
	createLobbyButton.disabled = !!resp.lobbyId;

	if (resp.lobbies.length == 0) {
		lobbiesTable.style.display = 'none';
		noLobbiesDiv.style.display = 'block';
		return;
	}
	else {
		lobbiesTable.style.display = 'block';
		noLobbiesDiv.style.display = 'none';
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
