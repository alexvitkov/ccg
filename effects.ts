import { Game, Card } from './game_common.js'

export type Effect = (game: Game, card: Card) => void;

function bomberEffect(damage: number): Effect {
	return (game, card) => {
		// we store these because the card may get destroyed and we lose them
		const myX = card.x;
		const myY = card.y;
		for (var x = myX - 1; x <= myX + 1; x++)
			for (var y = myY - 1; y <= myY + 1; y++) {
				game.getBoard(x, y)?.takeDamage(damage);
			}
	}
}

function healerEffect(amount: number): Effect {
	return (game, card) => {
		let nearestCardDist = 10000;
		let nearestCards = [];

		for (const c of Object.values(game._board)) {
			if (c === card)
				continue;
			const dist = Math.abs(c.x - card.x) + Math.abs(c.y - card.y);
			if (dist < nearestCardDist) {
				nearestCardDist = dist;
				nearestCards = [c];
			}
			else if (dist === nearestCardDist)
				 nearestCards.push(c);
		}

		for (const c of nearestCards)
			c.takeDamage(-amount);
	}
}

function bulletEffect(dmg: number): Effect {
	return (game, card) => {
		const p2: boolean = card.owner.isPlayer2;
		if (p2) {
			for (let y = card.y - 1; y >= 0; y--) {
				const unit = game.getBoard(card.x, y);
				if (unit) {
					unit.takeDamage(dmg);
					return;
				}
			}
		}
		else {
			for (let y = card.y + 1; y < game.rules.boardHeight; y++) {
				const unit = game.getBoard(card.x, y);
				if (unit) {
					unit.takeDamage(dmg);
					return;
				}
			}
		}
	}
}

export const effects: {[key: string]: Effect} = {
	'bomberActive': bomberEffect(5),
	'gunnerPassive': bulletEffect(1),
	'gunnerActive': bulletEffect(2),
	'healerPassive': healerEffect(1)
};

