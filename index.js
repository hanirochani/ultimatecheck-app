(() => {
  const form = document.getElementById("loginForm");
  const programSel = document.getElementById("f_program");
  const roleSel = document.getElementById("f_role");
  const usernameInput = document.getElementById("f_username");
  const passwordInput = document.getElementById("f_password");
  const errorEl = document.getElementById("loginError");
  const note = document.getElementById("mgmtTrainingNote");
  const loginBtn = document.getElementById("loginBtn");

  function isBlockedCombo() {
    return roleSel.value === "management" && programSel.value === "training";
  }

  function refreshComboState() {
    const blocked = isBlockedCombo();
    note.style.display = blocked ? "block" : "none";
    loginBtn.disabled = blocked;
  }
  programSel.addEventListener("change", refreshComboState);
  roleSel.addEventListener("change", refreshComboState);
  refreshComboState();

  const ROUTES = {
    "shopper|mmp": "shopper.html",
    "qc|mmp": "qc.html",
    "management|mmp": "dashboard.html",
    "shopper|training": "training-shopper.html",
    "qc|training": "training-qc.html"
  };

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    errorEl.textContent = "";
    if (isBlockedCombo()) {
      errorEl.textContent = "Management tidak memiliki akses ke Training.";
      return;
    }
    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    const role = roleSel.value;
    const program = programSel.value;
    const result = UC.login(username, password, role, program);
    if (!result.ok) {
      errorEl.textContent = result.error;
      return;
    }
    const dest = ROUTES[role + "|" + program];
    window.location.href = dest || "index.html";
  });
})();
