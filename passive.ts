import { Game, Card } from './game_common.js'

export type Passive = (game: Game, card: Card) => void;

function healerPassive(amount: number): Passive {

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

export const passives: {[key: string]: Passive} = {
	'healerPassive': healerPassive(1)
}
