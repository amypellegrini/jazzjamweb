// Fills in the header's account area (src/_includes/account-status.njk) from the
// Worker's GET /auth/session. The session itself lives in HttpOnly cookies this
// script never sees; the endpoint only says whether someone is signed in, and who.
(function () {
  var areas = document.querySelectorAll("[data-account-status]");
  if (!areas.length) return;

  function show(state, email) {
    areas.forEach(function (area) {
      area.querySelectorAll("[data-account-email]").forEach(function (el) {
        el.textContent = email || "";
      });
      area.querySelectorAll("[data-return-here]").forEach(function (input) {
        input.value = location.pathname;
      });
      area.setAttribute("data-state", state);
    });
  }

  fetch("/auth/session", { credentials: "same-origin", headers: { accept: "application/json" } })
    .then(function (response) {
      return response.ok ? response.json() : { signedIn: false };
    })
    .then(function (session) {
      if (session && session.signedIn && session.user) show("signed-in", session.user.email);
      else show("signed-out");
    })
    .catch(function () {
      show("signed-out");
    });
})();
