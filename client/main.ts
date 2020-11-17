import { Card, Player, Game, GameRules, CardProto } from '../game_common';
import { Message, GameStartedMessage, ListLobbiesResponse } from '../messages';

var game: ClientGame;
var ws: WebSocket;

// DRAGGING
var draggedCardPosInHand: number;
var draggedCardPlaceholder: HTMLDivElement;
var draggedDiv: HTMLDivElement = null;
var draggedCard: Card = null;
var draggedDivOffsetX: number = 0;
var draggedDivOffsetY: number = 0;
var handPlaceholders: {[cardId: number]: HTMLDivElement} = {};

var lobbyIsMine = false;
var createLobbyButton: HTMLButtonElement = <any>document.getElementById('createLobbyButton');

const lobbies = document.getElementById("lobbies");
const lobbiesTable = document.getElementById("lobbiesTable");
const noLobbies = document.getElementById("noLobbies");

const gameDiv = document.getElementById("game");
const myHandDiv = document.getElementById("myHand");
const opponentHandDiv = document.getElementById("opponentHandDiv ");

var rules: GameRules;

var boardTd: HTMLElement[] = [];


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
				game = new ClientGame(msg);
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

class ClientGame extends Game {
	constructor(message: GameStartedMessage) {
		super(message.rules, new Player(), new Player());
		this.p1.game = this;
		this.p2.game = this;
		game = this;
		rules = message.rules;

		lobbies.style.display = 'none';
		gameDiv.style.display = 'grid';
		(document.getElementById('header') as any).style.display = 'none';

		this.p1.hand = message.hand.map(
			c => this.instantiate(c[0], this.p1, rules.cardSet[c[1]]));

		// Populate the board grid
		var last = document.getElementById('game').firstChild;

		boardTd = new Array(rules.boardWidth * rules.boardHeight);
		for (let y = rules.boardHeight - 1; y >= 0; y--) {
			for (let x = 0; x < rules.boardWidth; x++) {
				const td = document.createElement('div');
				td.setAttribute('data-x', x.toString());
				td.setAttribute('data-y', y.toString());
				boardTd[y * rules.boardWidth + x] = td;
				last.parentNode.insertBefore(td, last.nextSibling);
				last = td;

				td.classList.add('field');

				if (y < rules.ownHeight)
					td.classList.add('myfield');
				else if (y >= rules.boardHeight - rules.ownHeight)
					td.classList.add('opponentfield');
				
				td.onmouseup = () => { onDropOnGrid(x, y); };
			}
		}

		// Populate the hand
		for (const c of this.p1.hand) {
			const cardDiv = makeCardDiv(c);
			myHandDiv.appendChild(cardDiv);
		}
		update();
	}

	instantiate(id: number, owner: Player, proto: CardProto) {
		const card = new Card(id, owner, proto);
		this.cards[id] = card;
		return card;
	}
}

function onMouseMove(event: MouseEvent) {
	if (draggedDiv) {
		const card = game.cards[parseInt(draggedDiv.getAttribute('data-id'))];
		draggedCardPosInHand = game.p1.hand.indexOf(card);
		draggedDiv.style.top = (event.clientY + draggedDivOffsetY) + 'px';
		draggedDiv.style.left = (event.clientX + draggedDivOffsetX) + 'px';
	}
}


function update() {
	if (game.p1.canPlayCard())
		myHandDiv.classList.add('canPlay');
	else
		myHandDiv.classList.remove('canPlay');

	if (game.p1.canMoveCard())
		gameDiv.classList.add('canMove');
	else 
		gameDiv.classList.remove('canMove');

	if (draggedDiv && ((draggedCard.x && game.p1.canReturnCard()) || isDraggedCardFromHand()))
		myHandDiv.classList.add('canReturn');
	else
		myHandDiv.classList.remove('canReturn');
}

function dragCardDiv(card: Card, cardDiv: HTMLDivElement, event: MouseEvent) {
	// not valid if we're currently dragging a card
	if (draggedDiv || card.owner !== game.p1)
		return;

	const posInHand = game.p1.hand.indexOf(card);
	if (posInHand !== -1 && !game.p1.canPlayCard())
		return false;

	if (card.onBoard && !game.p1.canMoveCard)
		return false;

	draggedDiv = cardDiv;
	draggedCard = card;
	draggedDivOffsetX = draggedDiv.getBoundingClientRect().left - event.clientX;
	draggedDivOffsetY = draggedDiv.getBoundingClientRect().top - event.clientY + window.scrollY;
	draggedCardPosInHand = posInHand;

	draggedCardPlaceholder = document.createElement('div');
	draggedCardPlaceholder.classList.add('placeholder');

	if (isDraggedCardFromHand())
		handPlaceholders[card.id] = draggedCardPlaceholder;
	cardDiv.parentElement.insertBefore(draggedCardPlaceholder, cardDiv);
	console.log(draggedCardPlaceholder);

	gameDiv.classList.add('dragging');
	cardDiv.classList.add('dragged');

	document.body.appendChild(cardDiv);
	document.body.onmousemove = onMouseMove;
	onMouseMove(event);

	update();
}

function stopDrag(returnToPlaceholder: boolean) {
	if (returnToPlaceholder) {
		draggedCardPlaceholder.parentElement.insertBefore(draggedDiv, draggedCardPlaceholder);
		draggedCardPlaceholder.remove();
	}
	if (!isDraggedCardFromHand() && draggedCardPlaceholder) {
		draggedCardPlaceholder.remove();
	}

	draggedDiv.classList.remove('dragged');
	gameDiv.classList.remove('dragging');
	draggedDiv.style.top = '';
	draggedDiv.style.left = '';
	draggedCardPlaceholder = null;
	draggedDiv = null;
	draggedCard = null;

	update();
}

function isDraggedCardFromHand() {
	return draggedCardPosInHand !== -1;
}

function onDropOnGrid(x: number, y: number) {
	if (draggedDiv) {
		if (isDraggedCardFromHand()) {
			if (game.p1.playCard(draggedCardPosInHand, x, y)) {
				boardTd[game.xy(x, y)].appendChild(draggedDiv);
				stopDrag(false);
				update();
			}
			else {
				stopDrag(true);
			}
		}
		else {
			if (!game.p1.moveCard(draggedCard, x, y)) {
				stopDrag(true);
			}
			else {
				boardTd[game.xy(x, y)].appendChild(draggedDiv);
				stopDrag(false);
				update();
			}
		}

	}
}

gameDiv.onmouseup = e => {
	if (draggedDiv) {
		stopDrag(true);
	}
};

myHandDiv.onmouseup = e => {
	if (draggedDiv) {
		// currentlyDraggingCard is from hand, just return it
		if (isDraggedCardFromHand()) {
			stopDrag(true);
		}
		else if (game.p1.canReturnCard()) {
			const placeholder = handPlaceholders[draggedCard.id];
			console.log('placeholders: ', handPlaceholders);

			var prevCardDiv: Element = placeholder;
			do {
				console.log('loop start', prevCardDiv);
				prevCardDiv = prevCardDiv.previousElementSibling;
				console.log('loop end', prevCardDiv);
			} while (prevCardDiv && !prevCardDiv.getAttribute('data-id'));
			const prevCard = game.cards[prevCardDiv.getAttribute('data-id')];

			game.p1.returnCard(draggedCard, prevCard);

			placeholder.parentElement.insertBefore(draggedDiv, placeholder);
			placeholder.parentElement.removeChild(placeholder);

			delete handPlaceholders[draggedCard.id];

			stopDrag(false);
		}
	}
}

function makeCardDiv(card: Card): HTMLDivElement {
	const cardDiv = document.createElement('div');
	cardDiv.classList.add('card', card.owner == game.p1 ? 'mycard' : 'opponentcard' );

	const text = document.createElement('p');
	text.classList.add('text');
	const strength = document.createElement('p');

	text.innerText = card.proto.cardLetter;
	strength.innerText = card.strength.toString();
	strength.classList.add('strength');

	cardDiv.setAttribute('data-id', card.id.toString());

	cardDiv.onmousedown = e => dragCardDiv(card, cardDiv, e);

	cardDiv.appendChild(text);
	cardDiv.appendChild(strength);
	return cardDiv;
}
