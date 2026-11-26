// The account pages (src/account/). The Worker's /auth/ routes answer each form by
// redirecting back with ?error=<code> or ?notice=<code>, put into words here, and
// a ?next=<path> is carried through the forms and links so the student ends up
// back where they started.
(function () {
  var MESSAGES = {
    error: {
      invalid_credentials: "That email and password don't match an account.",
      email_taken: "There's already an account with that email. Sign in, or reset your password.",
      weak_password: "That password is too short or too easy to guess. Try a longer one.",
      same_password: "That's the password you already have. Choose a different one.",
      email_not_confirmed: "Confirm your email first: follow the link we sent you.",
      invalid_email: "That doesn't look like an email address.",
      rate_limited: "Too many tries. Wait a minute, then try again.",
      link_expired: "That link has expired or was already used. Ask for a new one.",
      oauth_failed: "Signing in with Google didn't finish. Please try again.",
      unavailable: "Accounts are unavailable right now. Please try again later.",
      unknown: "Something went wrong. Please try again.",
    },
    notice: {
      check_email: "Check your email: we've sent you a link to confirm your account.",
      reset_sent: "If there's an account for that email, we've sent it a link to choose a new password.",
      password_updated: "Your password has been updated.",
    },
  };

  var params = new URLSearchParams(location.search);

  var box = document.querySelector("[data-account-message]");
  if (box) {
    ["notice", "error"].forEach(function (kind) {
      var code = params.get(kind);
      if (!code) return;
      box.textContent = MESSAGES[kind][code] || MESSAGES.error.unknown;
      box.setAttribute("data-kind", kind);
      if (kind === "error") box.setAttribute("role", "alert");
    });
  }

  // The Worker checks next again; this only carries it along.
  var next = params.get("next");
  if (next && next.charAt(0) === "/" && next.charAt(1) !== "/") {
    document.querySelectorAll('form input[name="next"]').forEach(function (input) {
      input.value = next;
    });
    document.querySelectorAll("a[data-keep-next]").forEach(function (link) {
      var url = new URL(link.getAttribute("href"), location.origin);
      url.searchParams.set("next", next);
      link.setAttribute("href", url.pathname + url.search);
    });
  }
})();
