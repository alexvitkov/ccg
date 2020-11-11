function logOut() {
  // TODO make this not suck and delete the cookie from the server
  document.cookie="session=; expires = Thu, 01 Jan 1970 00:00:00 GMT";
  window.location='/';
}
