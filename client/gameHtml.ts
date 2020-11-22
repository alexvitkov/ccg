import { game, ClientCard, rules } from './game';
import { send } from './main';

const gameDiv = document.getElementById("game");
gameDiv.onmouseup = _e => { 
	if (!messageDiv.hidden && performance.now() - messageStart > 300)
	    messageDiv.hidden = true;
	if (draggedCard) { stopDrag(true); } 
	if (activeCard) {
		stopActive();
	}
};

const blindStageMessageDiv = document.getElementById('blindStageMessage');
const messageDiv = document.getElementById('message');
var messageStart: number;

const readyButton: HTMLButtonElement = document.getElementById("readyButton") as any;
const readyButtonText: HTMLElement = document.getElementById("readyButtonText") as any;
readyButton.onclick = ready;

const myHandDiv = document.getElementById("myHand");
// const opponentHandDiv = document.getElementById("opponentHandDiv ");


// list of field divs on the board, addressded via xy
// fieldDivs[game._xy(x, y)]
export var fieldDivs: HTMLElement[] = [];

// DRAGGING
var isDraggedCardFromHand: boolean;
var draggedCardPlaceholder: HTMLDivElement;
var draggedCard: ClientCard = null;
var draggedDivOffsetX: number = 0;
var draggedDivOffsetY: number = 0;

// MOVING / ACTIVE
var activeCard: ClientCard = null;
var activeCardX: number;
var activeCardY: number;
var activeCardCanActive: boolean = false;
var activeCardCanMove: boolean = false;

// when in blind stage, there are multiple placeholders.
// we store them here
var handPlaceholders: {[cardId: number]: HTMLDivElement} = {};

export function makeCardDiv(card: ClientCard): HTMLDivElement {
	const cardDiv = document.createElement('div');
	cardDiv.classList.add('card', card.owner == game.p1 ? 'mycard' : 'opponentcard' );

	if (card.active)
		cardDiv.classList.add('card', 'hasActive');

	const text = document.createElement('p');
	text.classList.add('text');
	const strength = document.createElement('p');

	text.innerText = card.proto.cardLetter;
	strength.innerText = card.strength.toString();
	strength.classList.add('strength');

	cardDiv.setAttribute('data-id', card.id.toString());

	cardDiv.onmouseenter = () => { hoverCard(card); };
	cardDiv.onmouseleave = () => { stopHover() };

	cardDiv.onmousedown = e => {
		if (!card.onBoard || game.inBlindStage) {
			onCardDrag(card, e);
		}
		else if (card.onBoard) {
			startActive(card);
		}
	}

	cardDiv.appendChild(text);
	cardDiv.appendChild(strength);

	return cardDiv;
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
			game.p1.C_allowedMoveSquaresXY(card);
			const allowedSquares = game.p1.C_allowedMoveSquaresXY(card);
			for (const sq of allowedSquares)
				fieldDivs[sq].classList.add('actionable');
		}
	}
}

export function desync(msg?: string) {
	msg = "DESYNC" + (msg ? ("\n" + msg) : "");
	console.trace(msg);
	message(msg, 3);
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

function hoverCard(card: ClientCard) {
	document.getElementById('sidebar1').innerHTML = card.proto.cardDescription;
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

			td.onmouseup = () => { onDropOnGrid(x, y); };
		}
	}
	// Populate the hand
	for (const c of game.p1.hand) {
		myHandDiv.appendChild(c.div);
	}

	// We can move and play cards since we're in blind stage
	gameDiv.classList.add('canMove');
	gameDiv.classList.add('canPlay');
}

function onCardDrag(card: ClientCard, event: MouseEvent) {
	// not valid if we're currently dragging a card
	if (draggedCard || card.owner !== game.p1)
		return;

	const posInHand = game.p1.hand.indexOf(card);
	if (posInHand !== -1 && !game.canPlayCards())
		return false;
	isDraggedCardFromHand = posInHand !== -1;

	if (card.onBoard && !game.inBlindStage)
		return false;

	draggedCard = card;
	draggedDivOffsetX = draggedCard.div.getBoundingClientRect().left - event.clientX;
	draggedDivOffsetY = draggedCard.div.getBoundingClientRect().top - event.clientY + window.scrollY;

	const allowedSquares = game.p1.C_allowedMoveSquaresXY(card);
	for (const sq of allowedSquares)
		fieldDivs[sq].classList.add('actionable');
	gameDiv.classList.add('dragging');
	card.div.classList.add('dragged');
	card.div.style.transform = '';

	if (isDraggedCardFromHand || game.inBlindStage)
		myHandDiv.classList.add('actionable');

	draggedCardPlaceholder = document.createElement('div');
	draggedCardPlaceholder.classList.add('placeholder');

	if (isDraggedCardFromHand)
		handPlaceholders[card.id] = draggedCardPlaceholder;
	card.div.parentElement.insertBefore(draggedCardPlaceholder, card.div);

	document.body.appendChild(card.div);
	document.body.onmousemove = onMouseMove;
	onMouseMove(event);
}



function stopDrag(returnToPlaceholder: boolean) {
	if (returnToPlaceholder) {
		draggedCardPlaceholder.parentElement.insertBefore(draggedCard.div, draggedCardPlaceholder);
		draggedCardPlaceholder.remove();
	}
	// if we're dragging a card from the board (moving a card)
	// delete the placeholder
	else if (!isDraggedCardFromHand && draggedCardPlaceholder) {
		draggedCardPlaceholder.remove();
	}
	for (const td of fieldDivs)
		td.classList.remove('actionable');

	gameDiv.classList.remove('dragging');
	myHandDiv.classList.remove('actionable');
	draggedCard.div.classList.remove('dragged');
	draggedCard.div.style.top = '';
	draggedCard.div.style.left = '';
	draggedCard = null;
	draggedCardPlaceholder = null;
	
}

function onDropOnGrid(x: number, y: number) {
	if (!draggedCard)
		return;

	// We're dragigng a card from the hand, aka playing
	if (isDraggedCardFromHand) {
		if (game.p1.S_canPlayCardFromHand(x, y, draggedCard)) {
			game.p1.S_playCardFromHand(x, y, draggedCard);

			if (!game.canPlayCards())
				gameDiv.classList.remove('canPlay');
			stopDrag(false); 
			return;
		}
	}
	// We're a dragging a card from the board
	else {
		if (game.p1.S_canMoveCard(x, y, draggedCard)) {
			game.p1.S_moveCard(x, y, draggedCard);
			stopDrag(false);
			return;
		}
	}

	stopDrag(true);
}

myHandDiv.onmouseup = _e => {
	if (draggedCard) {
		// if the card we're dragging is from hand, just return it
		if (isDraggedCardFromHand) {
			stopDrag(true);
		}
		// Can only return cards from board if blindstage
		else if (game.inBlindStage) {
			const placeholder = handPlaceholders[draggedCard.id];
			var prevCardDiv: Element = placeholder;
			do {
				prevCardDiv = prevCardDiv.previousElementSibling;
			} while (prevCardDiv && !prevCardDiv.getAttribute('data-id'));

			var prevCard = prevCardDiv ? game.cards[prevCardDiv.getAttribute('data-id')] : null;

			game.p1.returnCard(draggedCard, prevCard);

			placeholder.parentElement.insertBefore(draggedCard.div, placeholder);
			placeholder.parentElement.removeChild(placeholder);

			delete handPlaceholders[draggedCard.id];

			stopDrag(false);
		}
	}
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
		send({
			message: 'skip'
		});
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

export function message(msg: string, duration: number) {
	if (duration == 0) {
		setTimeout(() => messageDiv.hidden = true, 2000);
	}
	else if (duration == 1) {
		setTimeout(() => messageDiv.hidden = true, 1000);
	}
	messageDiv.hidden = false;
	messageStart = performance.now();
	messageDiv.innerText = msg;
}
