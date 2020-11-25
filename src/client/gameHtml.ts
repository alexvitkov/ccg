import { game, ClientCard, rules } from './game';
import { Proto } from '../game_common';
import { send } from './main';
import { effects, ActiveTarget } from '../effects';

const gameDiv = document.getElementById("game");

gameDiv.onmouseup = _e => { 
	// Hide message on click
	if (!messagePersistent && !messageDiv.hidden && performance.now() - messageStart > 300)
	    messageDiv.hidden = true;

	if (draggedCard)
		stopDrag(-1, -1);

	if (aomCard)
		stopActiveOrMove();
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

// MOVING / ACTIVE SELECTION
var aomCard: ClientCard = null;
var aomCardX: number;
var aomCardY: number;
var aomCanActive: boolean = false;
var aomCanMove: boolean = false;

// ACTIVE TARGETING
var activeTargets: ActiveTarget[];
var activeTargetsIndex: number;
var activeCard: ClientCard;
var activeArgs: any[];

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
			startActiveOrMove(card);
	}
	div.setAttribute('data-id', card.id.toString());
	return div;
}

function startActiveOrMove(card: ClientCard) {
	if (card.owner !== game.p1 || game.turn !== game.p1 || activeCard)
		return;

	aomCanActive = !game.p1.usedActive;
	aomCanMove = game.canMoveCards();

	if (aomCanActive || aomCanMove) {
		aomCard = card;
		aomCardX = card.x;
		aomCardY = card.y;

		if (aomCanMove) {
			const allowedSquares = game.p1.allowedMoveSquaresXY(card);
			for (const sq of allowedSquares)
				fieldDivs[sq].classList.add('actionable');
		}
	}
}

function startActive(card: ClientCard) {
	aomCard = null;
	activeCard = card;
	activeTargets = effects[card.active.effect].activeTypes;
	activeTargetsIndex = -1;
	activeArgs = [];
	
	nextActiveTarget();
}

function nextActiveTarget() {
	activeTargetsIndex++;
	console.log(activeTargetsIndex);
	console.log(activeTargets);
	if (activeTargetsIndex >= activeTargets.length) {
		game.p1.active(activeCard, activeArgs);
		activeCard = null;
		return;
	}

	switch (activeTargets[activeTargetsIndex]) {
		case 'anyField': {
			for (const field of fieldDivs)
				field.classList.add('actionable');
		}
	}
}

export function desync(msg?: string) {
	msg = "DESYNC" + (msg ? ("\n" + msg) : "");
	message(msg, -1);
}

function stopActiveOrMove() {
	var dostartActive = false;
	if (aomCardX === aomCard.x && aomCardY === aomCard.y) {
		if (aomCanActive) {
			dostartActive = true;
			gameDiv.classList.remove('canActive');
		}
	}
	else if (aomCanMove) {
		if (game.p1.S_canMoveCard(aomCardX, aomCardY, aomCard)) {
			game.p1.S_moveCard(aomCardX, aomCardY, aomCard);
			if (game.p1.movePoints === 0)
				gameDiv.classList.remove('canMove');
		}
		else {
			desync('From stopActive()');
		}
	}
	for (const td of fieldDivs)
		td.classList.remove('actionable');
	if (dostartActive)
		startActive(aomCard);
	else
		aomCard = null;
}

function onFieldClick(x: number, y: number) {
	if (activeCard && activeTargets[activeTargetsIndex] === 'anyField') {
		activeArgs.push({ x: x, y: y });
		for (const field of fieldDivs)
			field.classList.add('actionable');
		nextActiveTarget();
	}
}

function onMouseEnterField(x: number, y: number) {
	if (aomCard && aomCanMove) {
		if (y == aomCard.y)
			x = aomCard.x + Math.sign(x - aomCard.x);
		if (x == aomCard.x)
			y = aomCard.y + Math.sign(y - aomCard.y);

		if (game.p1.S_canMoveCard(x, y, aomCard) || (x == aomCard.x && y == aomCard.y)) {
			fieldDivs[game._xy(x,y)].appendChild(aomCard.div);
			aomCardX = x;
			aomCardY = y;
		}
		else {
			aomCardX = aomCard.x;
			aomCardY = aomCard.y;
			const fieldDiv = fieldDivs[game._xy(aomCard.x, aomCard.y)];
			fieldDiv.appendChild(aomCard.div);
		}
	}
}

function hoverProto(proto: Proto) {
	document.getElementById('sidebar1').innerHTML = `<h1>${proto.provision} provision</h1>` + proto.cardDescription;
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
			const fieldDiv = document.createElement('div');
			fieldDiv.setAttribute('data-x', x.toString());
			fieldDiv.setAttribute('data-y', y.toString());
			fieldDivs[y * rules.boardWidth + x] = fieldDiv;
			last.parentNode.insertBefore(fieldDiv, last.nextSibling);
			last = fieldDiv;

			fieldDiv.style.gridColumnStart = (x + 2).toString();
			fieldDiv.style.gridRowStart = (7 - y).toString();
			fieldDiv.classList.add('field');
			fieldDiv.onmouseenter = () => onMouseEnterField(x, y);
			fieldDiv.onclick = () => onFieldClick(x, y);

			if (y < rules.ownHeight)
				fieldDiv.classList.add('myfield');
			else if (y >= rules.boardHeight - rules.ownHeight)
				fieldDiv.classList.add('opponentfield');

			fieldDiv.onmouseup = () => { if (draggedCard) stopDrag(x, y); };
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
	else if (!activeCard && !aomCard && !draggedCard) {
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
