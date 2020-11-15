var ws;

var myLobby;

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
        renderNewLobbies(msg.lobbies);
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
  const lobbiesTable = document.getElementById("lobbiesTable");
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

    const joinTd = document.createElement("td");
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

    joinTd.appendChild(joinLeaveButton);
    row.appendChild(joinTd);

    lobbiesTable.appendChild(row);
  }
}

wsConnect(() => {
  refreshLobbies();
});

