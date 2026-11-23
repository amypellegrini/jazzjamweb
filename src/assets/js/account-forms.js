// The account pages' messages: the Worker's /auth/ routes answer a form by
// redirecting back with ?error=<code> or ?notice=<code>, shown here in words.
(function () {
  var MESSAGES = {
    error: {},
    notice: {},
  };
  var params = new URLSearchParams(location.search);
  var box = document.querySelector("[data-account-message]");
  if (!box) return;
  ["error", "notice"].forEach(function (kind) {
    var code = params.get(kind);
    if (!code) return;
    box.textContent = MESSAGES[kind][code] || MESSAGES.error.unknown || "Something went wrong. Please try again.";
    box.setAttribute("data-kind", kind);
    if (kind === "error") box.setAttribute("role", "alert");
  });
})();
