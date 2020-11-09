const { MongoClient } = require("mongodb");
const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');

// Connection URI
const uri =
  "mongodb://127.0.0.1:27017/?poolSize=20&w=majority";

// Create a new MongoClient
const client = new MongoClient(uri);

const app = express();
const PORT = 8000;

var db;
var users;
var sessions;

async function run() {
  await client.connect();
  db = client.db("admin");
  users = db.collection("users");
  sessions = db.collection("sessions");
  await db.command({ ping: 1 });
  console.log("Connected successfully to mongodb server");
}
run();


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


app.use(express.static('static'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

app.listen(PORT, () => {
  console.log(`express listening at http://localhost:${PORT}`)
});

app.post('/register', async (req, res) => {
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

app.post('/login', async (req, res) => {
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

app.get('/whoami', async (req, res) => {
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
