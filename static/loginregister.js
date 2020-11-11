const loginFormButton = document.getElementById("loginFormButton");
const registerFormButton = document.getElementById("registerFormButton");

const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");

const registerUsername = document.getElementById("registerUsername");
const registerButton = document.getElementById("registerButton");
const registerPassword = document.getElementById("registerPassword");
const registerPassword2 = document.getElementById("registerPassword2");

const inputErr = document.getElementById("inputErr");

function showRegisterForm() {
  loginFormButton.classList = "";
  registerFormButton.classList = "active";
  loginForm.style.visibility = "hidden";
  registerForm.style.visibility = "visible";
}

function showLoginForm() {
  registerFormButton.className = "";
  loginFormButton.className = "active";
  loginForm.style.visibility = "visible";
  registerForm.style.visibility = "hidden";
}

function register() {
  // we call these two first in case the username/pass is empty
  // and we haven't looked for errors yet
  regUsernameChange();
  regPasswordChange(); 
  if (!updateInputErr())
    return;

  var xhr = new XMLHttpRequest();
  xhr.open("POST", "/register2", true);
  xhr.setRequestHeader("Content-Type", "application/json");
  const body = {
    username: registerUsername.value,
    password: registerPassword.value,
  };
  xhr.onreadystatechange = () => {
    if (xhr.readyState == XMLHttpRequest.DONE) {
      if (xhr.status == 200) {
        const resp = JSON.parse(xhr.responseText);
        // TODO future generations need to fix this
        document.cookie=`session=${resp.session};SameSite=Strict;Expires=Fri, 1 Jan 2100 05:30:00 GMT`;
      }
      else {
        // TODO
      }
    }
  };
  xhr.send(JSON.stringify(body));
}

function login() {
  var xhr = new XMLHttpRequest();
  xhr.open("POST", "/login2", true);
  xhr.setRequestHeader("Content-Type", "application/json");
  const body = {
    username: loginUsername.value,
    password: loginPassword.value
  };
  xhr.onreadystatechange = () => {
    if (xhr.readyState == XMLHttpRequest.DONE) {
      if (xhr.status == 200) {
        const resp = JSON.parse(xhr.responseText);
        // TODO future generations need to fix this as well
        document.cookie=`session=${resp.session};SameSite=Strict;Expires=Fri, 1 Jan 2100 05:30:00 GMT`;
        window.location='/';
      }
      else {
        // TODO
        console.log('fial');
      }
    }
  };
  xhr.send(JSON.stringify(body));
}

const userNameRegex = /^[a-zA-Z0-9.\-_]*$/;
var inputErrVal = 0;
var passwordErrVal = 0;

// 0 - dont know, need check
// 1 - don't know, don't check
// 1 - not taken
// 2 - taken
var usernameTaken = 0;
var lastCheck = 0;

window.setInterval(() => {
  if (usernameTaken == 0) {
    checkUsername(registerUsername.value);
    usernameTaken = 1;
  }
}, 1000);

function checkUsername(username) {
  var xhr = new XMLHttpRequest();
  xhr.open("GET", "/usernameTaken?username=" + registerUsername.value, true);
  xhr.setRequestHeader("Content-Type", "application/json");
  xhr.send();
  xhr.onreadystatechange = () => {
    if (xhr.readyState == XMLHttpRequest.DONE) {
      const resp = JSON.parse(xhr.responseText);
      if (registerUsername.value == username) {
        usernameTaken = 1 + resp.taken;
        updateInputErr();
      }
    }
  };
}

function regUsernameChange() {
  var err = 0;

  const username = registerUsername.value;
  if (username.length < 3)            err |= 1;
  if (username.length > 16)           err |= 2;
  if (!username.match(userNameRegex)) err |= 4;


  const oldUsernameTaken = usernameTaken;
  usernameTaken = err ? 1 : 0;

  if (err != inputErrVal || oldUsernameTaken == 1) {
    inputErrVal = err;
    updateInputErr();
  }
}

function regPasswordChange() {
  var err = 0;
  const password = registerPassword.value;
  const password2 = registerPassword2.value;

  if (password.length < 8)   err |= 1;
  if (password != password2) err |= 2;

  if (err != passwordErrVal) {
    passwordErrVal = err;
    updateInputErr();
  }
}

function updateInputErr() {
  inputErr.innerText = "";

  if (inputErrVal & 1)
    inputErr.innerText += "Username too short\n";
  if (inputErrVal & 2)
    inputErr.innerText += "Username too long\n";
  if (inputErrVal & 4)
    inputErr.innerText += "Invalid characters in username\n";
  if (usernameTaken == 2)
    inputErr.innerText += "Username taken\n";

  if (passwordErrVal & 1)
    inputErr.innerText += "Password too short\n";
  if (passwordErrVal & 2)
    inputErr.innerText += "Passwords don't match";


  const err = inputErrVal || passwordErrVal || usernameTaken != 1;
  registerButton.disabled = err;
  return err;
}
