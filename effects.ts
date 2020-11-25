import { Game, Card } from './game_common.js'

export type EffectInstance = {
	card: Card;
	effect: string;
	effectFunc: EffectFunciton;
	args: {[key: string]: any};
}

export type EffectFunciton = (game: Game, card: Card, args: object, activeArgs?: any[]) => void;

export type ActiveTarget = 'anyField';

export type EffectPreset = {
	func: EffectFunciton
	args: object,
	activeTypes?: ActiveTarget[];
}

function bomberEffect(game: Game, card: Card, args: {damage: number}) {
	// we store these because the card may get destroyed 
	// and we lose its coords mid loop
	const myX = card.x;
	const myY = card.y;
	game.beginGroup();
	for (var x = myX - 1; x <= myX + 1; x++) {
		for (var y = myY - 1; y <= myY + 1; y++) {
			const card = game.getBoard(x, y);
			if(card)
				card.takeDamage(args.damage);
		}
	}
	game.endGroup();
}

function archerbotPassive(game: Game, _card: Card, args: {damage: number, x: number; y: number}) {
	const unitToDamage = game.getBoard(args.x, args.y);
	unitToDamage?.takeDamage(args.damage);
}

function archerbotTarget(_game: Game, card: Card, _args: any, activeArgs: any) {
	for (const ef of card.owner.eot.filter(e => e.card === card && e.effect === 'archerbotPassive')) {
		ef.args.x = activeArgs[0].x;
		ef.args.y = activeArgs[0].y;
	}
}

function healerEffect(game: Game, card: Card, args: {healAmount: number}) {
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
	game.beginGroup();
	for (const c of nearestCards)
		c.takeDamage(-args.healAmount);
	game.endGroup();
}

function bulletEffect(game: Game, card: Card, args: {damage: number}) {
	const p2: boolean = card.owner.isPlayer2;
	if (p2) {
		for (let y = card.y - 1; y >= 0; y--) {
			const unit = game.getBoard(card.x, y);
			if (unit) {
				unit.takeDamage(args.damage);
				break;
			}
		}
	}
	else {
		for (let y = card.y + 1; y < game.rules.boardHeight; y++) {
			const unit = game.getBoard(card.x, y);
			if (unit) {
				unit.takeDamage(args.damage);
				break;
			}
		}
	}
}

export const effects: {[key: string]: EffectPreset } = {
	'bomberActive': { func: bomberEffect, args: { damage: 5 }},
	'gunnerPassive': { func: bulletEffect, args: { damage: 1 }},
	'gunnerActive': { func: bulletEffect, args: { damage: 2 }},
	'healerPassive': { func: healerEffect, args: { healAmount: 1 }},
	'archerbotPassive': { func: archerbotPassive, args: { damage: 1 }},
	'archerbotTarget': { func: archerbotTarget, args: {}, activeTypes: ['anyField']},
};

export function instantiateEffect(card: Card, name: string): EffectInstance {
	return {
		card: card,
		effect: name,
		effectFunc: effects[name].func,
		args: {... effects[name].args}
	}
}
