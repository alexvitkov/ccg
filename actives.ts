import { Game, Card } from './game_common.js'

export type Active = (game: Game, card: Card) => void;

function bomberActive(damage: number): Active {
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

export const actives: {[key: string]: Active} = {
	'bomberActive': bomberActive(4)
};
