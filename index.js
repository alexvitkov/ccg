const { MongoClient } = require("mongodb");
const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');


const mongoDbUri = process.env.MONGOURI || "mongodb://127.0.0.1:27017/?poolSize=20&w=majority";
const PORT       = process.env.PORT     ||  8000;

const mongoClient = new MongoClient(mongoDbUri, { useUnifiedTopology: true });
var db;
var users;
var sessions;

const expressApp = express();

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

async function findUser(username, password) {
  var query = {username:username};
  if (password) query.password = password;

  user = await users.findOne(query);
  return user;
}


// TODO forbidden symbols
async function register(username, password) {
  const existingUser = await findUser(username);
  if (existingUser)
    return null;

  return await users.insertOne({
    username: username,
    password: password
  });
}

async function genSessionCookie(username, password) {
  const user = await findUser(username, password);
  if (!user)
    return null;

  var cookie;

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


expressApp.post('/register', async (req, res) => {
  if (typeof req.body.username != 'string' || typeof req.body.password != 'string') {
    res.setHeader('Content-Type', 'text/plain');
    res.status('400');
    res.write('BAD REQUEST');
    res.end();
    return;
  }

  res.setHeader('Content-Type', 'text/html');
  const username = req.body.username;
  const password = req.body.password;

  result = await register(username, password);
  if (!result) {
    res.status('400');
    res.write('<!DOCTYPE html><html><head><meta charset="utf-8">Username taken.<br><button onclick="window.location=\'/\'">Go back</button>');
  }
  else {
    const cookie = await genSessionCookie(username, password);
    res.cookie('session', cookie);
    res.write('<!DOCTYPE html><html><head><meta charset="utf-8"><meta http-equiv="Refresh" content="0; URL=/index.html"></head></html>');
  }
  res.end();
});

expressApp.post('/login', async (req, res) => {
  if (typeof req.body.username != 'string' || typeof req.body.password != 'string') {
    res.setHeader('Content-Type', 'text/plain');
    res.status('400');
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
    res.end();
    return;
  }
  else {
    const cookie = await genSessionCookie(username, password);
    res.cookie('session', cookie);
    res.write('<!DOCTYPE html><html><head><meta charset="utf-8"><meta http-equiv="Refresh" content="0; URL=/index.html"></head></html>');
    res.end();
  }

});

expressApp.get('/whoami', async (req, res) => {
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

runMongo();
runExpress();
