import { game, ClientCard, rules } from './game';
import { Proto } from '../game_common';
import { send } from './main';

const gameDiv = document.getElementById("game");

gameDiv.onmouseup = _e => { 
	// Hide message on click
	if (!messagePersistent && !messageDiv.hidden && performance.now() - messageStart > 300)
	    messageDiv.hidden = true;

	if (draggedCard)
		stopDrag(-1, -1);

	if (activeCard)
		stopActive();
};

const blindStageMessageDiv = document.getElementById('blindStageMessage');
const messageDiv = document.getElementById('message');
var messagePersistent: boolean = false;
var messageStart: number;

const readyButton: HTMLButtonElement = document.getElementById("readyButton") as any;
const readyButtonText: HTMLElement = document.getElementById("readyButtonText") as any;
readyButton.onclick = ready;

const protoDivs = {};

const myHandDiv = document.getElementById("myHand");
// const opponentHandDiv = document.getElementById("opponentHandDiv ");

// list of field divs on the board, addressded via xy
// fieldDivs[game._xy(x, y)]
export var fieldDivs: HTMLElement[] = [];

// DRAGGING
var draggedCard: ClientCard = null;
var draggedDivOffsetX: number = 0;
var draggedDivOffsetY: number = 0;

// MOVING / ACTIVE
var activeCard: ClientCard = null;
var activeCardX: number;
var activeCardY: number;
var activeCardCanActive: boolean = false;
var activeCardCanMove: boolean = false;

export function makeProtoDiv(mine: boolean, proto: Proto): HTMLDivElement {
	const protoDiv = document.createElement('div');
	protoDiv.classList.add('card', mine ? 'mycard' : 'opponentcard' );

	if (proto.active)
		protoDiv.classList.add('card', 'hasActive');

	const text = document.createElement('p');
	text.classList.add('text');
	const strength = document.createElement('p');

	text.innerText = proto.cardLetter;
	strength.innerText = proto.baseStrength.toString();
	strength.classList.add('strength');

	protoDiv.onmouseenter = () => { hoverProto(proto); };
	protoDiv.onmouseleave = () => { stopHover() };

	protoDiv.appendChild(text);
	protoDiv.appendChild(strength);
	protoDiv.setAttribute('data-protoId', proto.protoID.toString());

	protoDiv.onmousedown = e => { 
		if (game.canPlayCards() && proto.provision < game.p1.provision) {
			const card = game.p1.instantiate(proto, 0);
			startDrag(card as ClientCard, e); 
		}
	}

	return protoDiv;
}

export function makeCardDiv(card: ClientCard): HTMLDivElement {
	const div = makeProtoDiv(card.owner === game.p1, card.proto);
	div.setAttribute('data-id', card.id.toString());
	div.onmousedown = e => {
		if (game.inBlindStage)
			startDrag(card, e);
		else
			startActive(card);
	}
	div.setAttribute('data-id', card.id.toString());
	return div;
}

function startActive(card: ClientCard) {
	if (card.owner !== game.p1 || game.turn !== game.p1)
		return;

	activeCardCanActive = !game.p1.usedActive;
	activeCardCanMove = game.canMoveCards();

	if (activeCardCanActive || activeCardCanMove) {
		activeCard = card;
		activeCardX = card.x;
		activeCardY = card.y;

		if (activeCardCanMove) {
			const allowedSquares = game.p1.allowedMoveSquaresXY(card);
			for (const sq of allowedSquares)
				fieldDivs[sq].classList.add('actionable');
		}
	}
}

export function desync(msg?: string) {
	msg = "DESYNC" + (msg ? ("\n" + msg) : "");
	message(msg, -1);
}

function stopActive() {
	if (activeCardX === activeCard.x && activeCardY === activeCard.y) {
		if (activeCardCanActive) {
			game.p1.active(activeCard);
			gameDiv.classList.remove('canActive');
		}
	}
	else if (activeCardCanMove) {
		if (game.p1.S_canMoveCard(activeCardX, activeCardY, activeCard)) {
			game.p1.S_moveCard(activeCardX, activeCardY, activeCard);
			if (game.p1.movePoints === 0)
				gameDiv.classList.remove('canMove');
		}
		else {
			desync('From stopActive()');
		}
	}
	activeCard = null;
	for (const td of fieldDivs)
		td.classList.remove('actionable');
}

function onMouseEnterField(x: number, y: number) {
	if (activeCard && activeCardCanMove) {
		if (y == activeCard.y)
			x = activeCard.x + Math.sign(x - activeCard.x);
		if (x == activeCard.x)
			y = activeCard.y + Math.sign(y - activeCard.y);

		if (game.p1.S_canMoveCard(x, y, activeCard) || (x == activeCard.x && y == activeCard.y)) {
			fieldDivs[game._xy(x,y)].appendChild(activeCard.div);
			activeCardX = x;
			activeCardY = y;
		}
		else {
			activeCardX = activeCard.x;
			activeCardY = activeCard.y;
			const fieldDiv = fieldDivs[game._xy(activeCard.x, activeCard.y)];
			fieldDiv.appendChild(activeCard.div);
		}
	}
}

function hoverProto(proto: Proto) {
	document.getElementById('sidebar1').innerHTML = proto.cardDescription;
	document.getElementById('sidebar1').hidden = false;
}

function stopHover() {
	document.getElementById('sidebar1').hidden = true;
}

export function onGameStarted() {
	// hide the lobby screen and show the game
	(document.getElementById("lobbies") as HTMLElement).style.display = 'none';
	gameDiv.style.display = 'grid';

	set('maxMovePoints', game.rules.maxMovePoints.toString());

	// Populate the board grid
	var last = document.getElementById('game').firstChild;
	fieldDivs = new Array(rules.boardWidth * rules.boardHeight);

	for (let y = rules.boardHeight - 1; y >= 0; y--) {
		for (let x = 0; x < rules.boardWidth; x++) {
			const td = document.createElement('div');
			td.setAttribute('data-x', x.toString());
			td.setAttribute('data-y', y.toString());
			fieldDivs[y * rules.boardWidth + x] = td;
			last.parentNode.insertBefore(td, last.nextSibling);
			last = td;

			td.style.gridColumnStart = (x + 2).toString();
			td.style.gridRowStart = (7 - y).toString();
			td.classList.add('field');
			td.onmouseenter = () => onMouseEnterField(x, y);

			if (y < rules.ownHeight)
				td.classList.add('myfield');
			else if (y >= rules.boardHeight - rules.ownHeight)
				td.classList.add('opponentfield');

			td.onmouseup = () => { if (draggedCard) stopDrag(x, y); };
		}
	}
	// Populate the hand
	for (const c of game.p1.hand) {
		myHandDiv.appendChild(makeProtoDiv(true, c));
	}

	// We can move and play cards since we're in blind stage
	gameDiv.classList.add('canMove');
	gameDiv.classList.add('canPlay');
}

function startDrag(card: ClientCard, event: MouseEvent) {
	draggedCard = card;
	// TODO
	draggedDivOffsetX = 0; //draggedCard.div.getBoundingClientRect().left - event.clientX;
	draggedDivOffsetY = 0; //draggedCard.div.getBoundingClientRect().top - event.clientY + window.scrollY;

	const allowedSquares = game.p1.allowedPlaySquaresXY();
	for (const sq of allowedSquares)
		fieldDivs[sq].classList.add('actionable');
	gameDiv.classList.add('dragging');
	card.div.classList.add('dragged');
	card.div.style.transform = '';

	myHandDiv.classList.add('actionable');

	document.body.appendChild(card.div);
	document.body.onmousemove = onMouseMove;
	onMouseMove(event);
}

export function provisionChanged() {
	set('myProvision', game.p1.provision.toString());
	for (const div of myHandDiv.children) {
		if (rules.cardSet[div.getAttribute('data-protoId')].provision > game.p1.provision)
			div.classList.add('noProvision');
	}
}

function stopDrag(x: number, y: number) {
	if (x < 0 || y < 0) {
		if (Object.values(game._board).includes(draggedCard)) {
			game.p1.provision += draggedCard.proto.provision;
		}

		game.destroy(draggedCard);
		if (game.canPlayCards())
			gameDiv.classList.add('canPlay');
	}

	else if (game.inBlindStage) {
		if (!game.putCard(x, y, draggedCard)) {
			if (Object.values(game._board).includes(draggedCard))
				game.p1.provision += draggedCard.proto.provision;
			game.destroy(draggedCard);
			if (game.canPlayCards())
				gameDiv.classList.add('canPlay');
		}
		else {
			// TODO we're not calling playCard, manually changing provision
			game.p1.provision -= draggedCard.proto.provision;
		}
	}

	else {
		if (!game.p1.S_canPlayCardFromHand(x, y, draggedCard.proto))
			game.destroy(draggedCard);
		else
			game.p1.playCard(x, y, draggedCard);
	}

	provisionChanged();

	if (!game.canPlayCards())
		gameDiv.classList.remove('canPlay');

	for (const td of fieldDivs)
		td.classList.remove('actionable');

	gameDiv.classList.remove('dragging');
	myHandDiv.classList.remove('actionable');
	draggedCard.div.classList.remove('dragged');
	draggedCard.div.style.top = '';
	draggedCard.div.style.left = '';
	draggedCard = null;
	
}

function onMouseMove(event: MouseEvent) {
	if (draggedCard) {
		draggedCard.div.style.top = (event.clientY + draggedDivOffsetY) + 'px';
		draggedCard.div.style.left = (event.clientX + draggedDivOffsetX) + 'px';
	}
}

function ready() {
	if (game.inBlindStage) {
		readyButton.disabled = true;
		game.doneWithBlindStage();
		gameDiv.classList.remove('canMove');
		gameDiv.classList.remove('canPlay');
	}
	else {
		send({ message: 'skip' });
		game.nextTurn();
	}
}

export function set(className: string, value: string) {
	for (const el of document.getElementsByClassName(className)) {
		(el as HTMLElement).innerText = value;
	}
}

export function blindStageOver() {
	blindStageMessageDiv.style.display = 'none';
}

export function turnChanged() {
	if (game.turn === game.p1) {
		readyButton.disabled  = false;
		gameDiv.classList.add('canMove');
		gameDiv.classList.add('canPlay');
		gameDiv.classList.add('canActive');
		message('Your turn', 0);
		readyButtonText.innerText = 'End Turn';
		set('myMovePoints', game.p1.movePoints.toString());
	}
	else {
		readyButton.disabled  = true;
		gameDiv.classList.remove('canMove');
		gameDiv.classList.remove('canPlay');
		gameDiv.classList.remove('canActive');
		readyButtonText.innerText = "Opponent's turn";
		message('Opponent\'s turn', 1);
		set('enemyMovePoints', game.p2.movePoints.toString());
	}
}

export function gameOver(win: boolean) {
	message(win ? "you win bro" : "you lose bro", -1);
	gameDiv.classList.remove('canMove');
	gameDiv.classList.remove('canPlay');
	gameDiv.classList.remove('canActive');
	readyButtonText.innerText = ":D";
}

export function message(msg: string, duration: number) {
	if (duration < 0)
		messagePersistent = true;
	else {
		if (duration == 0) {
			setTimeout(() =>  { if (!messagePersistent) messageDiv.hidden = true}, 2000);
		}
		else if (duration == 1) {
			setTimeout(() => { if (!messagePersistent) messageDiv.hidden = true }, 1000);
		}
	}

	messageDiv.hidden = false;
	messageStart = performance.now();
	messageDiv.innerText = msg;
}
