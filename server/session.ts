import ws from 'ws';

import { Lobby } from './lobby';

export class Session {
	userId: string;
	username: string;
	sock: ws;
	lobby: Lobby;

	constructor(userInDb: any) {
		this.userId = userInDb.id.toString('base64');
		this.username = userInDb.username;
	}
	send(msg: {message: string; [_: string]: any;}) {
		if (this.sock) { this.sock.send(JSON.stringify(msg)); }
	}
}
