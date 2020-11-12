var ws;

function logOut() {
  // TODO make this not suck and delete the cookie from the server
  document.cookie="session=;SameSite=Strict;expires = Thu, 01 Jan 1970 00:00:00 GMT";
  window.location='/';
}

function wsConnect() {
  const loc = window.location;
  var wsPath;
  if (loc.protocol === "https:") {
    wsPath = "wss:";
  } else {
    wsPath = "ws:";
  }
  wsPath += "//" + loc.host;
  wsPath += loc.pathname;

  ws = new WebSocket(wsPath);
  ws.addEventListener('open', ev => {
    ws.send('hellooooo');
  });
  ws.addEventListener('message', ev => {
    const msg = ev.data;
  });
}

wsConnect();
