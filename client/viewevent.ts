import { ClientCard } from './game';

function sleep(ms: number) {
	return new Promise(r => setTimeout(r, ms));
}

export async function TakeDamage(card: ClientCard, dmg: number) {

	const div = document.createElement('div');

	if (dmg > 0) {
		div.classList.add('damageText');
		div.innerText = "-" + dmg.toString();
	}
	else {
		div.classList.add('healText');
		div.innerText = "+" + (-dmg).toString();
	}
	card.div.appendChild(div);
	(card.div.getElementsByClassName('strength')[0] as HTMLElement).innerText = card.strength.toString();
	await sleep(500);

	card.owner.recalculateStrength();

	div.remove();
}
