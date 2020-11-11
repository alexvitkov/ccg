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
expressApp.set('view engine', 'ejs');
expressApp.use('/static', express.static('static'));
expressApp.use(bodyParser.urlencoded({ extended: true }));
expressApp.use(bodyParser.json({ limit: 1024 }));
expressApp.use(cookieParser());

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


async function register(username: string, password: string) {
  const existingUser = await findUser(username);
  if (existingUser)
    return null;

  if (username.length < 3 || username.length > 16)
    return null;
  if (!username.match(/^[a-zA-Z0-9.\-_]*$/))
    return null;
  if (password.length < 8 )
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

  users.updateOne(
    {username: username},
    { $push: { sessions: cookie } }
  );
  sessions.insertOne({cookie: cookie, username: username});
  return cookie;
}




expressApp.get('/', async (req, res) => {
  const sessionCookie = req.cookies.session;
  var invalidSessionCookie = false;
  var username: string = null;

  if (typeof sessionCookie === 'string') {
    const session = await sessions.findOne({cookie: sessionCookie});
      console.log(session)
    if (session) {
      username = session.username; 
    }
    else {
      invalidSessionCookie = true;
    }
  }
  else if ('session' in req.cookies) {
    invalidSessionCookie = true;
  }

  console.log(username)
  
  res.render('index', {
    loggedIn: username !== null,
    username: username,
  });
});


expressApp.post('/register2', async (req: express.Request, res: express.Response) => {
  const { username, password }  = req.body;

  res.setHeader('Content-Type', 'application/json');

  if (typeof username !== 'string' || typeof password !== 'string') {
    res.status(400).send('{}');
    return;
  }

  const result = await register(username, password);
  if (result) {
    const cookie = await genSessionCookie(username, password);
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

  const result = await findUser(username, password);
  console.log(result);
  if (result) {
    const cookie = await genSessionCookie(username, password);
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


expressApp.get('/lobbies', async (_, res) => {
  res.setHeader('Content-Type', 'application/json');
});


runMongo();
runExpress();
