import { game, ClientCard, rules } from './game';
import { send } from './main';

const gameDiv = document.getElementById("game");
const blindStageMessageDiv = document.getElementById('blindStageMessage');
const readyButton: HTMLButtonElement = document.getElementById("readyButton") as any;
readyButton.onclick = ready;
gameDiv.onmouseup = _e => { if (draggedCard) { stopDrag(true); } };

const myHandDiv = document.getElementById("myHand");
const opponentHandDiv = document.getElementById("opponentHandDiv ");


// list of field divs on the board, addressded via xy
// fieldDivs[game._xy(x, y)]
export var fieldDivs: HTMLElement[] = [];

// DRAGGING
var isDraggedCardFromHand: boolean;
var draggedCardPlaceholder: HTMLDivElement;
var draggedCard: ClientCard = null;
var draggedDivOffsetX: number = 0;
var draggedDivOffsetY: number = 0;

// when in blind stage, there are multiple placeholders.
// we store them here
var handPlaceholders: {[cardId: number]: HTMLDivElement} = {};

export function makeCardDiv(card: ClientCard): HTMLDivElement {
	const cardDiv = document.createElement('div');
	cardDiv.classList.add('card', card.owner == game.p1 ? 'mycard' : 'opponentcard' );

	const text = document.createElement('p');
	text.classList.add('text');
	const strength = document.createElement('p');

	text.innerText = card.proto.cardLetter;
	strength.innerText = card.strength.toString();
	strength.classList.add('strength');

	cardDiv.setAttribute('data-id', card.id.toString());

	cardDiv.onmouseenter= () => { hoverCard(card); };
	cardDiv.onmouseleave= () => { stopHover() };

	cardDiv.onmousedown = e => onCardDrag(card, cardDiv, e);
	cardDiv.onclick = () => {
		if (game.p1.active(card)) {
			send({
				message: 'active',
				id: card.id,
			});
		}
	};

	cardDiv.appendChild(text);
	cardDiv.appendChild(strength);

	return cardDiv;
}

function hoverCard(card: ClientCard) {
	document.getElementById('sidebar1').innerHTML = card.proto.cardDescription;
}

function stopHover() {
	document.getElementById('sidebar1').innerText = '';
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

function onCardDrag(card: ClientCard, cardDiv: HTMLDivElement, event: MouseEvent) {
	// not valid if we're currently dragging a card
	if (draggedCard || card.owner !== game.p1)
		return;

	const posInHand = game.p1.hand.indexOf(card);
	if (posInHand !== -1 && !game.canPlayCards())
		return false;
	isDraggedCardFromHand = posInHand !== -1;

	if (card.onBoard && !game.canMoveCards())
		return false;

	draggedCard = card;
	draggedDivOffsetX = draggedCard.div.getBoundingClientRect().left - event.clientX;
	draggedDivOffsetY = draggedCard.div.getBoundingClientRect().top - event.clientY + window.scrollY;

	const allowedSquares = game.p1.C_allowedMoveSquaresXY(card);
	for (const sq of allowedSquares)
		fieldDivs[sq].classList.add('canDrop');
	gameDiv.classList.add('dragging');
	cardDiv.classList.add('dragged');

	if (!isDraggedCardFromHand && game.stage === 'BlindStage')
		myHandDiv.classList.add('canReturn');

	draggedCardPlaceholder = document.createElement('div');
	draggedCardPlaceholder.classList.add('placeholder');

	if (isDraggedCardFromHand)
		handPlaceholders[card.id] = draggedCardPlaceholder;
	cardDiv.parentElement.insertBefore(draggedCardPlaceholder, cardDiv);

	document.body.appendChild(cardDiv);
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
		td.classList.remove('canDrop');

	gameDiv.classList.remove('dragging');
	myHandDiv.classList.remove('canReturn');
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
			stopDrag(false); 
			return;
		}
	}
	// We're a dragging a card from the board
	else {
		if (game.p1.moveCard(x, y, draggedCard)) {
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
		else if (game.stage === 'BlindStage') {
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
	if (game.stage === 'BlindStage') {
		readyButton.disabled = true;
		game.doneWithBlindStage();
	}
	else {
		send({
			message: 'skip'
		});
		game.nextStage();
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

export function stageChanged() {
	set('whoseturn', game.turn === game.p1 ? 'Your' : "Opponent's");
	set('stage', game.stage);
	gameDiv.classList.remove('canMove');
	gameDiv.classList.remove('canPlay');

	readyButton.innerText = game.turn === game.p1 ? 'Skip ' + game.stage : "Opponent's turn";
	readyButton.disabled  = game.turn !== game.p1;

	if (game.turn === game.p1) {
		switch (game.stage) {
			case 'Move':
				gameDiv.classList.add('canMove');
			break;
			case 'Play':
				gameDiv.classList.add('canPlay');
			break;
		}
	}

	set('myMovePoints', game.p1.movePoints.toString());
	set('enemyMovePoints', game.p2.movePoints.toString());
}
