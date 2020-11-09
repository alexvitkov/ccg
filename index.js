const { MongoClient } = require("mongodb");
const express = require('express');

// Connection URI
const uri =
  "mongodb://127.0.0.1:27017/?poolSize=20&w=majority";

// Create a new MongoClient
const client = new MongoClient(uri);

var db;
var users;

async function run() {
  try {
    await client.connect();
    db = client.db("admin");
    users = db.collection("users");
    await db.command({ ping: 1 });
    console.log("Connected successfully to server");

    console.log(await register('mi6o', '1234'));
    console.log(await register('go6o', '1234'));

  } finally {
    await client.close();
  }
}
run().catch(console.dir);


async function findUser(username) {
  user = await users.findOne({username:username});
  return user;
}


async function register(username, password) {
  const existingUser = await findUser(username);
  if (existingUser)
    return false;
  
  await users.insertOne({
    username: username,
    password: password
  });
  return true; // TODO check if insertone fails
}



