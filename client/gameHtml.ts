import { game, rules } from './game';
import { Card } from '../game_common';

const gameDiv = document.getElementById("game");
const readyButton = document.getElementById("readyButton");
readyButton.onclick = ready;
gameDiv.onmouseup = e => { if (draggedDiv) { stopDrag(true); } };

const myHandDiv = document.getElementById("myHand");
const opponentHandDiv = document.getElementById("opponentHandDiv ");

const lobbiesDiv = document.getElementById("lobbies");


var boardTd: HTMLElement[] = [];

// DRAGGING
var draggedCardPosInHand: number;
var draggedCardPlaceholder: HTMLDivElement;
var draggedDiv: HTMLDivElement = null;
var draggedCard: Card = null;
var draggedDivOffsetX: number = 0;
var draggedDivOffsetY: number = 0;
var handPlaceholders: {[cardId: number]: HTMLDivElement} = {};

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

	cardDiv.onmousedown = e => onCardDrag(card, cardDiv, e);

	cardDiv.appendChild(text);
	cardDiv.appendChild(strength);
	return cardDiv;
}

export function onGameStarted() {
	lobbiesDiv.style.display = 'none';
	lobbiesDiv.style.display = 'none';
	gameDiv.style.display = 'grid';
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

			td.style.gridColumnStart = (x + 2).toString();
			td.style.gridRowStart = (7 - y).toString();
			td.classList.add('field');

			if (y < rules.ownHeight)
				td.classList.add('myfield');
			else if (y >= rules.boardHeight - rules.ownHeight)
				td.classList.add('opponentfield');

			td.onmouseup = () => { onDropOnGrid(x, y); };
		}
	}
	// Populate the hand
	for (const c of game.p1.hand) {
		const cardDiv = makeCardDiv(c);
		myHandDiv.appendChild(cardDiv);
	}
	update();
}

function onCardDrag(card: Card, cardDiv: HTMLDivElement, event: MouseEvent) {
	// not valid if we're currently dragging a card
	if (draggedDiv || card.owner !== game.p1)
		return;

	const posInHand = game.p1.hand.indexOf(card);
	if (posInHand !== -1 && !game.p1.canPlayAnyCard())
		return false;

	if (card.onBoard && !game.p1.canMoveAnyCard())
		return false;

	draggedDiv = cardDiv;
	draggedCard = card;
	draggedDivOffsetX = draggedDiv.getBoundingClientRect().left - event.clientX;
	draggedDivOffsetY = draggedDiv.getBoundingClientRect().top - event.clientY + window.scrollY;
	draggedCardPosInHand = posInHand;

	const allowedSquares = game.p1.allowedMoveSquaresXY(card);
	for (const sq of allowedSquares)
		boardTd[sq].classList.add('canDrop');
	gameDiv.classList.add('dragging');
	cardDiv.classList.add('dragged');

	draggedCardPlaceholder = document.createElement('div');
	draggedCardPlaceholder.classList.add('placeholder');

	if (isDraggedCardFromHand())
		handPlaceholders[card.id] = draggedCardPlaceholder;
	cardDiv.parentElement.insertBefore(draggedCardPlaceholder, cardDiv);

	document.body.appendChild(cardDiv);
	document.body.onmousemove = onMouseMove;
	onMouseMove(event);

	update();
}

function update() {
	if (game.p1.canPlayAnyCard())
		myHandDiv.classList.add('canPlay');
	else
		myHandDiv.classList.remove('canPlay');

	if (game.p1.canMoveAnyCard())
		gameDiv.classList.add('canMove');
	else 
		gameDiv.classList.remove('canMove');

	if (draggedDiv && ((draggedCard.x && game.p1.canReturnCard()) || isDraggedCardFromHand()))
		myHandDiv.classList.add('canReturn');
	else
		myHandDiv.classList.remove('canReturn');
}


function stopDrag(returnToPlaceholder: boolean) {
	if (returnToPlaceholder) {
		draggedCardPlaceholder.parentElement.insertBefore(draggedDiv, draggedCardPlaceholder);
		draggedCardPlaceholder.remove();
	}
	if (!isDraggedCardFromHand() && draggedCardPlaceholder) {
		draggedCardPlaceholder.remove();
	}
	for (const td of boardTd)
		td.classList.remove('canDrop');

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

myHandDiv.onmouseup = e => {
	if (draggedDiv) {
		// if currentlyDraggingCard is from hand, just return it
		if (isDraggedCardFromHand()) {
			stopDrag(true);
		}
		else if (game.p1.canReturnCard()) {
			const placeholder = handPlaceholders[draggedCard.id];
			var prevCardDiv: Element = placeholder;
			do {
				prevCardDiv = prevCardDiv.previousElementSibling;
			} while (prevCardDiv && !prevCardDiv.getAttribute('data-id'));

			var prevCard = prevCardDiv ? game.cards[prevCardDiv.getAttribute('data-id')] : null;

			game.p1.returnCard(draggedCard, prevCard);

			placeholder.parentElement.insertBefore(draggedDiv, placeholder);
			placeholder.parentElement.removeChild(placeholder);

			delete handPlaceholders[draggedCard.id];

			stopDrag(false);
		}
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

function ready() {
	if (game.stage === 'BlindStage') {
		
	}
}

export function set(className: string, value: string) {
	for (const el of document.getElementsByClassName(className)) {
		(el as HTMLElement).innerText = value;
	}
}
