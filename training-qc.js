(() => {
  const session = UC.requireSession("qc", "training");
  if (!session) return;

  const userChip = document.getElementById("userChip");
  if (userChip) userChip.textContent = session.name;
  const logoutLink = document.getElementById("logoutLink");
  if (logoutLink) logoutLink.addEventListener("click", (e) => { e.preventDefault(); UC.logout(); window.location.href = "index.html"; });

  const host = document.getElementById("trainHost");

  function testLabel(testId) { return "Tes " + testId.replace("test", ""); }
  function fmtDateTime(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) + " " + d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  }
  function fmtGeo(geo) { return geo ? `${geo.lat}, ${geo.lng}` : "tidak tersedia"; }

  /* ============================= HOME VIEW ============================= */

  function renderHome() {
    const keyCards = UC.TRAINING_TEST_IDS.map(testId => {
      const key = UC.getTrainingKey(testId);
      return `
        <div class="test-card">
          <div>
            <div class="t">${testLabel(testId)}</div>
            <div class="s">${key ? `Key tersimpan oleh ${key.savedBy} · ${fmtDateTime(key.savedAt)}` : "Belum ada key jawaban"}</div>
          </div>
          <div style="display:flex; align-items:center; gap:10px;">
            <span class="score-pill ${key ? "perfect" : "pending"}">${key ? "Key tersedia" : "Belum ada key"}</span>
            <button class="btn btn-primary btn-sm" data-edit="${testId}">${key ? "Edit Key" : "Buat Key"}</button>
          </div>
        </div>`;
    }).join("");

    const summaries = UC.getAllShopperTrainingSummaries();
    const rows = summaries.map(s => `
      <tr>
        <td><a class="row-link" href="#" data-shopper="${s.username}"><b>${s.name}</b><br><span style="color:var(--ink-faint); font-size:11.5px;">${s.username}</span></a></td>
        <td style="font-family:var(--font-mono);">${s.attempts}</td>
        <td style="font-family:var(--font-mono);">${s.perfectCount} / ${s.needed}</td>
        <td>${s.pass ? '<span class="tier-chip good">LULUS</span>' : '<span class="tier-chip watch">BELUM LULUS</span>'}</td>
      </tr>`).join("");

    host.innerHTML = `
      <h1 class="page-title">Training — Quality Checker</h1>
      <p class="page-sub">Kelola key jawaban tiap tes dan tinjau hasil training seluruh shopper. Hanya Quality Checker yang dapat melihat hasil seluruh shopper.</p>

      <div class="section-h"><h2>Key Jawaban Tes</h2></div>
      <div class="test-grid">${keyCards}</div>

      <div class="section-h"><h2>Hasil Training Seluruh Shopper</h2></div>
      <div class="card" style="padding:0; overflow:hidden;">
        <table class="list">
          <thead><tr><th>Shopper</th><th>Percobaan</th><th>Tes Bernilai 100</th><th>Status</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="4"><div class="empty">Belum ada data.</div></td></tr>'}</tbody>
        </table>
      </div>
    `;

    host.querySelectorAll("[data-edit]").forEach(b => b.addEventListener("click", () => renderKeyEditor(b.dataset.edit)));
    host.querySelectorAll("[data-shopper]").forEach(a => a.addEventListener("click", (e) => { e.preventDefault(); renderShopperDetail(a.dataset.shopper); }));
  }

  /* ============================= KEY EDITOR VIEW ============================= */

  function renderKeyEditor(testId) {
    const existing = UC.getTrainingKey(testId);
    const answers = existing ? Object.assign({}, existing.answers) : {};

    host.innerHTML = `
      <button class="btn btn-ghost btn-sm" id="backBtn" style="margin-bottom:16px;">← Kembali</button>
      <h1 class="page-title">Key Jawaban — ${testLabel(testId)}</h1>
      <p class="page-sub">Tentukan jawaban yang benar untuk setiap item. Jawaban shopper akan dibandingkan otomatis terhadap key ini.</p>
      <div id="keyChecklistHost"></div>
      <div class="form-footer">
        <span class="hint">${existing ? "Key sudah ada — menyimpan akan menimpa key sebelumnya dan menilai ulang semua sesi." : "Belum ada key untuk tes ini."}</span>
        <button class="btn btn-primary" id="saveKeyBtn">Simpan Key Jawaban</button>
      </div>
    `;
    document.getElementById("backBtn").addEventListener("click", renderHome);

    const clHost = document.getElementById("keyChecklistHost");
    let groupIndex = 0;
    ["bss", "cleanliness", "marketing", "grooming", "cx"].forEach(catKey => {
      const def = UC.CHECKLIST[catKey];
      groupIndex++;
      const details = document.createElement("details");
      details.className = "fg";
      details.open = groupIndex <= 2;

      const head = document.createElement("summary");
      head.className = "fg-head";
      head.innerHTML = `<div class="t"><span class="num">${groupIndex}</span><h3>${def.title}</h3></div><span class="w">${def.weight}% bobot</span>`;
      details.appendChild(head);

      const body = document.createElement("div");
      body.className = "fg-body";

      def.items.forEach(it => {
        const ref = UC.refFor(it.key);
        const refTag = ref ? `<span class="ref-tag">${ref}</span>` : "";
        const wrap = document.createElement("div");
        wrap.className = "field";
        if (def.kind === "rating") {
          wrap.innerHTML = `<label class="q">${refTag}${it.label}</label>`;
          const rating = document.createElement("div");
          rating.className = "rating";
          rating.dataset.key = it.key;
          for (let i = 1; i <= 5; i++) {
            const b = document.createElement("button");
            b.type = "button";
            b.textContent = i;
            if (String(answers[it.key]) === String(i)) b.classList.add("active");
            b.addEventListener("click", () => {
              rating.querySelectorAll("button").forEach(x => x.classList.remove("active"));
              b.classList.add("active");
              rating.dataset.value = i;
            });
            rating.appendChild(b);
          }
          if (answers[it.key]) rating.dataset.value = answers[it.key];
          wrap.appendChild(rating);
        } else {
          const cur = answers[it.key];
          wrap.innerHTML = `
            <label class="q">${refTag}${it.label}</label>
            <div class="seg">
              <input type="radio" class="opt-yes" name="key_${it.key}" id="key_${it.key}_y" value="yes" ${cur === "yes" ? "checked" : ""}>
              <label for="key_${it.key}_y">Ya</label>
              <input type="radio" class="opt-no" name="key_${it.key}" id="key_${it.key}_n" value="no" ${cur === "no" ? "checked" : ""}>
              <label for="key_${it.key}_n" class="no-opt">Tidak</label>
              <input type="radio" name="key_${it.key}" id="key_${it.key}_na" value="na" ${cur === "na" || !cur ? "checked" : ""}>
              <label for="key_${it.key}_na">N/A</label>
            </div>
          `;
        }
        body.appendChild(wrap);
      });

      details.appendChild(body);
      clHost.appendChild(details);
    });

    document.getElementById("saveKeyBtn").addEventListener("click", () => {
      const newAnswers = {};
      ["bss", "cleanliness", "marketing", "grooming", "cx"].forEach(catKey => {
        const def = UC.CHECKLIST[catKey];
        def.items.forEach(it => {
          if (def.kind === "rating") {
            const el = document.querySelector(`.rating[data-key="${it.key}"]`);
            newAnswers[it.key] = el && el.dataset.value ? el.dataset.value : "3";
          } else {
            const el = document.querySelector(`input[name="key_${it.key}"]:checked`);
            newAnswers[it.key] = el ? el.value : "na";
          }
        });
      });
      UC.saveTrainingKey(testId, newAnswers, session.name);
      UC.toast("Key jawaban tersimpan — sesi yang sudah dikirim akan dinilai ulang");
      renderHome();
    });
  }

  /* ============================= SHOPPER DETAIL VIEW ============================= */

  function renderShopperDetail(username) {
    const summary = UC.getShopperTrainingSummary(username);
    const rows = summary.sessions.map(s => `
      <tr>
        <td><a class="row-link" href="#" data-session="${s.id}"><b>${testLabel(s.testId)}</b></a></td>
        <td>${fmtDateTime(s.submittedAt)}</td>
        <td>${s.score ? `${s.score.correct}/${s.score.total} · ${s.score.pct}%` : "Menunggu key"}</td>
      </tr>`).join("");

    host.innerHTML = `
      <button class="btn btn-ghost btn-sm" id="backBtn" style="margin-bottom:16px;">← Kembali ke Hasil Training</button>
      <h1 class="page-title">${UC.USERS[username] ? UC.USERS[username].name : username}</h1>
      <p class="page-sub">${username}</p>

      <div class="pass-banner ${summary.pass ? "pass" : "fail"}">
        <div>
          <div class="big">${summary.pass ? "LULUS" : "BELUM LULUS"}</div>
          <div style="font-size:12.5px; margin-top:2px;">${summary.perfectCount} dari ${summary.needed} tes bernilai 100 diperlukan untuk lulus · ${summary.attempts} total percobaan dari ${summary.totalTests} tes.</div>
        </div>
      </div>

      <div class="section-h"><h2>Riwayat Sesi</h2></div>
      <div class="card" style="padding:0; overflow:hidden;">
        <table class="list">
          <thead><tr><th>Tes</th><th>Dikirim</th><th>Skor</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="3"><div class="empty">Belum ada percobaan.</div></td></tr>'}</tbody>
        </table>
      </div>
    `;
    document.getElementById("backBtn").addEventListener("click", renderHome);
    host.querySelectorAll("[data-session]").forEach(a => a.addEventListener("click", (e) => { e.preventDefault(); renderSessionDetail(a.dataset.session, username); }));
  }

  function renderSessionDetail(sessionId, username) {
    const s = UC.getTrainingSession(sessionId);
    if (!s) { renderShopperDetail(username); return; }
    const key = UC.getTrainingKey(s.testId);

    const tables = ["bss", "cleanliness", "marketing", "grooming", "cx"].map(catKey => {
      const def = UC.CHECKLIST[catKey];
      const rows = def.items.map(it => {
        const v = s.answers[it.key];
        const kv = key ? key.answers[it.key] : undefined;
        const isCorrect = key && kv !== undefined && kv !== null && kv !== "" ? String(v) === String(kv) : null;
        let valHtml = def.kind === "rating" ? `${v}/5` : (v === "yes" ? "Ya" : v === "no" ? "Tidak" : "N/A");
        let markHtml = "";
        if (isCorrect === true) markHtml = '<span style="color:var(--good); font-family:var(--font-mono); font-size:10px; text-transform:uppercase; font-weight:700;">✓ benar</span>';
        else if (isCorrect === false) markHtml = `<span style="color:var(--bad); font-family:var(--font-mono); font-size:10px; text-transform:uppercase; font-weight:700;">✗ salah (key: ${def.kind === "rating" ? kv + "/5" : (kv === "yes" ? "Ya" : kv === "no" ? "Tidak" : "N/A")})</span>`;
        return `<tr><td style="width:34px; color:var(--ink-faint); font-family:var(--font-mono); font-weight:700;">${UC.refFor(it.key)}</td><td>${it.label}</td><td style="text-align:right;">${valHtml}</td><td style="text-align:right;">${markHtml}</td></tr>`;
      }).join("");
      return `<table class="list" style="margin-bottom:18px;"><thead><tr><th></th><th>${def.title}</th><th style="text-align:right;">Jawaban</th><th style="text-align:right;">Hasil</th></tr></thead><tbody>${rows}</tbody></table>`;
    }).join("");

    host.innerHTML = `
      <button class="btn btn-ghost btn-sm" id="backBtn" style="margin-bottom:16px;">← Kembali</button>
      <h1 class="page-title">${testLabel(s.testId)} — ${s.shopperName}</h1>
      <p class="page-sub">Dikirim ${fmtDateTime(s.submittedAt)}</p>

      <div class="id-card">
        <div class="id-cell"><div class="k">Check-in</div><div class="v">${fmtDateTime(s.checkIn.time)} · ${fmtGeo(s.checkIn.geo)}</div></div>
        <div class="id-cell"><div class="k">Check-out</div><div class="v">${fmtDateTime(s.checkOut.time)} · ${fmtGeo(s.checkOut.geo)}</div></div>
        <div class="id-cell"><div class="k">Skor</div><div class="v">${s.score ? s.score.correct + "/" + s.score.total + " · " + s.score.pct + "%" : "Menunggu key"}</div></div>
        <div class="id-cell"><div class="k">Status</div><div class="v">${s.score ? (s.score.pct === 100 ? "Sempurna" : "Belum sempurna") : "Pending"}</div></div>
      </div>

      <div class="section-h"><h2>Detail Jawaban</h2></div>
      ${tables}
    `;
    document.getElementById("backBtn").addEventListener("click", () => renderShopperDetail(username));
  }

  renderHome();
})();
