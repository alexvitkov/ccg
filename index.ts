import {Collection, Db, MongoClient} from "mongodb";
import express from 'express';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import crypto from 'crypto';


const mongoDbUri = process.env.MONGOURI || "mongodb://127.0.0.1:27017/?poolSize=20&w=majority";
const PORT       = process.env.PORT     ||  8000;

const mongoClient: MongoClient = new MongoClient(mongoDbUri, { useUnifiedTopology: true });
var db: Db;
var users: Collection<any>;
var sessions: Collection<any>;

const expressApp: express.Express = express();

class Session {
  username: string;
  lobby: Lobby;

  constructor(username: string) {
    this.username = username;
    this.lobby = null;
  }

  deleteLobby() {
    if (this.lobby != null && this.lobby.creatorSession === this) {
      lobbies[this.username] = null;
    }
  }

  createLobby() {
    this.deleteLobby();
    lobbies[this.username] = new Lobby(this);
  }

  joinLobby(lobby: Lobby) {
    if (!lobby.otherPlayer) {
      lobby.otherPlayer = this;
      lobby.start();
    }
  }
}

class Lobby {
  creatorSession: Session;
  otherPlayer: Session;
  lobbyName: string;

  constructor(creatorSession: Session) {
    this.creatorSession = creatorSession;
    this.lobbyName = creatorSession.username + "'s lobby";
  }

  start() {
    // TODO
  }
}

const activeSessions: {[username: string]: Session } = {};
const lobbies: {[username: string]: Lobby} = {};

async function runMongo() {
  await mongoClient.connect();
  db = mongoClient.db("ccg");
  users = db.collection("users");
  sessions = db.collection("sessions");
  await db.command({ ping: 1 });
  console.log("Connected to MongoDB server");
}

function runExpress() {
  expressApp.listen(PORT, () => {
    console.log(`Express.js server started at port ${PORT}`)
  });
}

async function findUser(username: string, password?: string): Promise<object|null> {
  var query: any = {username:username};
  if (password) query.password = password;
  const user = await users.findOne(query);
  return user;
}


// TODO forbidden symbols
async function register(username: string, password: string) {
  const existingUser = await findUser(username);
  if (existingUser)
    return null;

  return await users.insertOne({
    username: username,
    password: password
  });
}

async function genSessionCookie(username: string, password: string) {
  const user = await findUser(username, password);
  if (!user)
    return null;

  var cookie: string;

  do {
    const cookieBytes = crypto.randomBytes(24);
    cookie = cookieBytes.toString('hex');
  } while (await sessions.findOne({ cookie: cookie }));

  users.updateOne({username: username},
                  { $push: { sessions: cookie } }
                 );
                 sessions.insertOne({cookie: cookie, username: username});
                 return cookie;
}



expressApp.use(express.static('static'));
expressApp.use(bodyParser.urlencoded({ extended: true }));
expressApp.use(cookieParser());

async function login(username: string, password: string, res: express.Response) {
  const cookie = await genSessionCookie(username, password);
  res.cookie('session', cookie);
  res.write('<!DOCTYPE html><html><head><meta charset="utf-8"><meta http-equiv="Refresh" content="0; URL=/index.html"></head></html>');
  if (!(username in activeSessions))
    activeSessions[username] = new Session(username);
}

expressApp.post('/register', async (req: express.Request, res: express.Response) => {
  if (typeof req.body.username != 'string' || typeof req.body.password != 'string') {
    res.setHeader('Content-Type', 'text/plain');
    res.status(400);
    res.write('BAD REQUEST');
    res.end();
    return;
  }

  res.setHeader('Content-Type', 'text/html');
  const username = req.body.username;
  const password = req.body.password;

  const result = await register(username, password);
  if (!result) {
    res.status(400);
    res.write('<!DOCTYPE html><html><head><meta charset="utf-8">Username taken.<br><button onclick="window.location=\'/\'">Go back</button>');
  }
  else {
    login(username, password, res);
  }
  res.end();
});

expressApp.post('/login', async (req: express.Request, res: express.Response) => {
  if (typeof req.body.username != 'string' || typeof req.body.password != 'string') {
    res.setHeader('Content-Type', 'text/plain');
    res.status(400);
    res.write('BAD REQUEST');
    res.end();
    return;
  }

  res.setHeader('Content-Type', 'text/html');
  const username = req.body.username;
  const password = req.body.password;
  const user = await findUser(username, password);

  if (!user) {
    res.status(400);
    res.write('<!DOCTYPE html><html><head><meta charset="utf-8">Invalid username or password<br><button onclick="window.location=\'/\'">Go back</button>');
  }
  else {
    login(username, password, res);
  }
  res.end();
});

expressApp.get('/whoami', async (req: express.Request, res: express.Response) => {
  res.setHeader('Content-Type', 'application/json');

  const session = req.cookies.session;
  if (typeof session != 'string') {
    // no session cookie
    res.status(400);
    res.write('{}');
    res.end();
  }
  else {
    const result = await sessions.findOne({cookie: session});
    if (!result) {
      // invalid session cookie
      res.status(400);
      res.write('{}');
      res.end();
    }
    else {
      res.write(`{"username":"${result.username}"}`);
      res.end();
    }
  }
});

expressApp.get('/lobbies', async (_, res) => {
  res.setHeader('Content-Type', 'application/json');

});

runMongo();
runExpress();
