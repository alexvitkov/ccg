import { Game, Card } from './game_common.js'

export type EffectBuilder = (game: Game, card: Card) => Effect;

export type Effect = {
	card: Card;
	effect: () => Promise<any>;
}

function bomberEffect(dmg: number): EffectBuilder {
	return (game, card) => { 
		return {
			card: card,
			effect: async () => {
				// we store these because the card may get destroyed 
				// and we lose its coords mid loop
				const myX = card.x;
				const myY = card.y;
				const promises = [];
				for (var x = myX - 1; x <= myX + 1; x++) {
					for (var y = myY - 1; y <= myY + 1; y++) {
						const card = game.getBoard(x, y);
						if(card)
							promises.push(card.takeDamage(dmg));
					}
				}
				await Promise.all(promises);
			}
		};
	}
}

function healerEffect(amount: number): EffectBuilder {
	return (game, card) => {
		return {
			card: card,
			effect: async () => {
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

				const promises = [];
				for (const c of nearestCards)
					promises.push(c.takeDamage(-amount));

				await Promise.all(promises);
			}
		}
	}
}

function bulletEffect(dmg: number): EffectBuilder {
	return (game, card) => {
		return {
			card: card,
			effect: () => {
				const p2: boolean = card.owner.isPlayer2;
				if (p2) {
					for (let y = card.y - 1; y >= 0; y--) {
						const unit = game.getBoard(card.x, y);
						if (unit) {
							return unit.takeDamage(dmg);
						}
					}
				}
				else {
					for (let y = card.y + 1; y < game.rules.boardHeight; y++) {
						const unit = game.getBoard(card.x, y);
						if (unit) {
							return unit.takeDamage(dmg);
						}
					}
				}
			}
		}
	}
}

export const effects: {[key: string]: EffectBuilder } = {
	'bomberActive': bomberEffect(5),
	'gunnerPassive': bulletEffect(1),
	'gunnerActive': bulletEffect(2),
	'healerPassive': healerEffect(1)
};


