/* FOR3NSIQ sign-in page: messages, show/hide password, keeps the page you were heading to.
   The actual check happens on the server (middleware.js). The form also works without this script. */
(function () {
  'use strict';
  var form = document.querySelector('.login-form');
  if (!form) return;
  var params = new URLSearchParams(location.search);
  var alertBox = document.querySelector('.login-alert');

  // Return to the page (and section) you originally asked for.
  var next = params.get('next');
  if (next && next.charAt(0) === '/' && next.charAt(1) !== '/') form.elements.next.value = next;
  if (/^#[A-Za-z0-9_-]{1,64}$/.test(location.hash)) form.elements.hash.value = location.hash;

  // Status messages from the server redirect.
  var message = null;
  var error = params.get('error');
  if (error === 'config') message = ['error', "Sign-in isn't set up yet. The site administrator needs to add AUTH_SECRET and AUTH_USERS in Vercel, then redeploy."];
  else if (error) message = ['error', "That username and password don't match. Check them and try again."];
  else if (params.has('signed_out')) message = ['info', "You've signed out."];
  else if (params.has('expired')) message = ['info', 'Your session expired. Please sign in again.'];
  if (message && alertBox) {
    alertBox.textContent = message[1];
    alertBox.className = 'login-alert login-alert--' + message[0];
    alertBox.hidden = false;
  }

  // Show / hide password.
  var toggle = form.querySelector('.field__toggle');
  var pwd = form.elements.password;
  if (toggle && pwd) {
    toggle.hidden = false;
    toggle.addEventListener('click', function () {
      var show = pwd.type === 'password';
      pwd.type = show ? 'text' : 'password';
      toggle.setAttribute('aria-pressed', String(show));
      toggle.querySelector('.field__toggle-text').textContent = show ? 'Hide password' : 'Show password';
      pwd.focus();
    });
  }

  // Busy state while the server checks the password.
  var submit = form.querySelector('.login-form__submit');
  var label = form.querySelector('.login-form__label');
  form.addEventListener('submit', function () {
    if (!form.checkValidity()) return;
    submit.disabled = true;
    submit.classList.add('is-loading');
    label.textContent = 'Signing in…';
  });
  // Reset if the user comes back with the browser's Back button.
  window.addEventListener('pageshow', function () {
    submit.disabled = false;
    submit.classList.remove('is-loading');
    label.textContent = 'Sign in';
    if (pwd) pwd.type = 'password';
  });

  form.elements.username.focus();
})();
