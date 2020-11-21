import { ClientCard } from './game';

function sleep(ms: number) {
	return new Promise(r => setTimeout(r, ms));
}

export async function beginHightlight(card: ClientCard) {
	card.div.style.transition = 'transform 0.3s';
	card.div.style.transform = 'translate(-50%, -50%) scale(1.2)';
	await sleep(100);
}

export async function endHightlight(card: ClientCard) {
	card.div.style.transform = 'translate(-50%, -50%)';
	await sleep(250);
	card.div.style.transition = '';
}

export function TakeDamage(card: ClientCard, oldStr: number, dmg: number) {
	return async () => {
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
		(card.div.getElementsByClassName('strength')[0] as HTMLElement).innerText 
		= (oldStr - dmg).toString();

		await sleep(800);

		card.owner.recalculateStrength();

		div.remove();
	}
}
