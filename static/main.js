var username = 'NOT_LOGGED_IN';

if (document.cookie && document.cookie.includes('session=')) {
  const req = new XMLHttpRequest();
  req.open('GET', '/whoami');
  req.send();

  req.onreadystatechange = e => {
    if (req.readyState == 4) {
      const j = JSON.parse(req.responseText);
      if (j.username) {
        setUsername(j.username);
        showLoggedIn();
      }
      else {
        showLogin();
      }
    }
  };
}
else {
  showLogin();
}

function setUsername(un) {
  username = un;
  for (const el of document.getElementsByClassName('username'))
    el.innerHTML = un;
}

function showLogin() {
  document.getElementById('loggedin').style.display = 'none';
  document.getElementById('notloggedin').style.display = 'block';
}

function showLoggedIn() {
  document.getElementById('notloggedin').style.display = 'none';
  document.getElementById('loggedin').style.display = 'block';
}

function logOut() {
  document.cookie = 'session=;expires=Thu, 01 Jan 1970 00:00:01 GMT';
  location.reload();
}
