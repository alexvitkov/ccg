import {Collection, Db, MongoClient} from "mongodb";
import express from 'express';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import cookie from 'cookie';
import crypto from 'crypto';
import ws from 'ws';

import { Lobby, handleLobbyWsMessage } from './lobby';
import { Session } from './session';

const mongoDbUri = process.env.MONGOURI || "mongodb://127.0.0.1:27017/?poolSize=20&w=majority";
const PORT       = process.env.PORT     ||  8000;

const mongoClient: MongoClient = new MongoClient(mongoDbUri, { useUnifiedTopology: true });
var db: Db;
var users: Collection<any>;
var sessionsColl: Collection<any>;

const expressApp: express.Express = express();
expressApp.set('view engine', 'ejs');
expressApp.use('/static', express.static('static'));
expressApp.use(bodyParser.urlencoded({ extended: true }));
expressApp.use(bodyParser.json({ limit: 1024 }));
expressApp.use(cookieParser());


// const activeSessions: {[session: string]: Session } = {};
const activeSessions2: {[userId: string]: Session } = {};

async function runMongo() {
	await mongoClient.connect();
	db = mongoClient.db("ccg");
	users = db.collection("users");
	sessionsColl = db.collection("sessions");
	await db.command({ ping: 1 });
	console.log("Connected to MongoDB server");
}


async function getSessionByCookie(cookie: string): Promise<Session> {
	const sessionFromDb = await sessionsColl.findOne({cookie: cookie});
	const userId: Buffer = sessionFromDb.userId;
	const userId64 = userId.toString('base64');

	if (userId64 in activeSessions2) {
		return activeSessions2[userId64];
	}
	else {
		const user = await users.findOne({id: userId});
		if (!user) {
			return null;
		}
		else {
			console.log("genSessionByCookie: creating session for " + user.username);
			activeSessions2[userId64] = new Session(user)
			return activeSessions2[userId64];
		}
	}
}


function runExpress() {
	const wsServer = new ws.Server({ noServer: true });

	const server = expressApp.listen(PORT, () => {
		console.log(`Express.js server started at port ${PORT}`)
	});
	server.on('upgrade', (req, tcpSocket, head) => {
		const cookies = cookie.parse(req.headers.cookie);
		const sessionCookie = cookies.session;

		wsServer.handleUpgrade(req, tcpSocket, head, async sock => {
			if (typeof sessionCookie === 'string') {
				(sock as any).session = await getSessionByCookie(sessionCookie);
			}
			wsServer.emit('connection', sock, req);
		});
	});

	wsServer.on('connection', sock => {
		const session = (sock as any).session;
		if (!session) {
			sock.close(4001, 'Invalid session');
		}
		else {
			session.sock = sock;
			sock.on('message', message => {
				var msg: object = null;
				try {
					msg = JSON.parse(message as string);
				} catch {
					sock.close(4002, 'Invalid message');
				}
				if (typeof msg !== 'object') {
					sock.close(4003, 'Invalid message');
				}
				else if (sock.readyState === sock.OPEN) {
					if (!handleWsMessage(session, msg))
						sock.close(4004, 'Invalid message');
				}
			});
		}
	});
}


function handleWsMessage(session: Session, message: {[key:string]:any}) {
	console.log(`WS[${session.username}]: `, message);
	if (handleLobbyWsMessage(session, message)) {
		return true;
	}
	return false;
}


async function register(username: string, password: string) {
	const existingUser = await users.findOne({username:username});
	if (existingUser)
		return null;

	if (username.length < 3 || username.length > 16)
		return null;
	if (!username.match(/^[a-zA-Z0-9.\-_]*$/))
		return null;
	if (password.length < 8 )
		return null;

	var userId: Buffer;
	do {
		userId = crypto.randomBytes(4);
	} while (await users.findOne({ userId: userId }));

	await users.insertOne({
		username: username,
		password: password,
		id: userId
	});
	return users.findOne({id:userId});
}

async function createSession(userId: Buffer, password: string) {
	const user = await users.findOne({id: userId, password: password});
	if (!user) {
		console.log('no user', userId, password)
		return null;
	}

	var sessionCookie: string;
	do {
		const cookieBytes = crypto.randomBytes(24);
		sessionCookie = cookieBytes.toString('hex');
	} while (await sessionsColl.findOne({ cookie: sessionCookie }));

	users.updateOne(
		{userId: userId},
		{ $push: { sessions: sessionCookie } }
	);
	sessionsColl.insertOne({cookie: sessionCookie, userId: userId});
	console.log("createSession: creating session for " + user.username);
	activeSessions2[userId.toString('base64')] = new Session(user);
	return sessionCookie;
}


expressApp.get('/', async (req, res) => {
	const sessionCookie = req.cookies.session;

	if (typeof sessionCookie === 'string') {
		const sessionDb = await sessionsColl.findOne({cookie: sessionCookie});
		if (!sessionDb) {
			// Invalid session cookie
			res.cookie('session', '', {maxAge: 0, sameSite: 'strict'});
		}
		else {
			const userId = sessionDb.userId;
			const userId64 = userId.toString('base64');
			const user = await users.findOne({id: userId});

			if (!(userId64 in activeSessions2)) {
				console.log("get(/): creating session for " + user.username);
				activeSessions2[userId64] = new Session(user);
			}

			const session = activeSessions2[userId64];

			res.render('index', {
				loggedIn: true,
				username: session.username,
				inLobby: !!session.lobby,
				lobbyId: session.lobby?.id || 0,
			});
			return;
		}
	}

	res.render('index', {
		loggedIn: false,
	});

});


expressApp.post('/register2', async (req: express.Request, res: express.Response) => {
	const { username, password }  = req.body;

	res.setHeader('Content-Type', 'application/json');

	if (typeof username !== 'string' || typeof password !== 'string') {
		res.status(400).send('{}');
		return;
	}

	const result = <any>await register(username, password);
	if (result) {
		const cookie = await createSession(result.id, password);
		res.send(JSON.stringify({
			username: username,
			session: cookie
		}));
	}
	else {
		res.status(400).send('{}');
	}
});


expressApp.post('/login2', async (req: express.Request, res: express.Response) => {
	const { username, password } = req.body;

	res.setHeader('Content-Type', 'application/json');

	if (typeof username !== 'string' || typeof password !== 'string') {
		res.status(400).send('{}');
		return;
	}

	const result = await users.findOne({username: username, password:password});
	if (result) {
		const cookie = await createSession(result.id, password);
		res.send(JSON.stringify({
			username: username,
			session: cookie
		}));
	}
	else {
		res.status(400).send('{}');
	}
});


expressApp.get('/usernameTaken', async (req: express.Request, res: express.Response) => {
	res.setHeader('Content-Type', 'application/json');
	res.send(`{"taken":${!!await users.findOne({username: req.query.username})}}`);
});


runExpress();
runMongo();

