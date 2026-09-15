(() => {
  const session = UC.requireSession("shopper", "training");
  if (!session) return;

  const userChip = document.getElementById("userChip");
  if (userChip) userChip.textContent = session.name;
  const logoutLink = document.getElementById("logoutLink");
  if (logoutLink) logoutLink.addEventListener("click", (e) => { e.preventDefault(); UC.logout(); window.location.href = "index.html"; });

  const host = document.getElementById("trainHost");

  // ---- Test-taking state (reset per test attempt) ----
  let currentTestId = null;
  let itemEvidenceStore = {};
  let checkInInfo = null;
  let startInteractionInfo = null;
  let endInteractionInfo = null;

  function fmtTime(d) {
    return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  }
  function fmtDateTime(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) + " " + fmtTime(d);
  }
  function fmtGeo(geo) {
    return geo ? `${geo.lat}, ${geo.lng}` : "tidak tersedia";
  }
  function fmtCheckpoint(info) {
    return info ? `${fmtTime(new Date(info.time))} · ${fmtGeo(info.geo)}` : "—";
  }

  /* ============================= LIST / DASHBOARD VIEW ============================= */

  function testLabel(testId) {
    return "Tes " + testId.replace("test", "");
  }

  function renderList() {
    const summary = UC.getShopperTrainingSummary(session.username);
    const sessionsByTest = {};
    summary.sessions.forEach(s => {
      if (!sessionsByTest[s.testId] || new Date(s.submittedAt) > new Date(sessionsByTest[s.testId].submittedAt)) {
        sessionsByTest[s.testId] = s;
      }
    });

    const banner = `
      <div class="pass-banner ${summary.pass ? "pass" : "fail"}">
        <div>
          <div class="big">${summary.pass ? "LULUS" : "BELUM LULUS"}</div>
          <div style="font-size:12.5px; margin-top:2px;">
            ${summary.perfectCount} dari ${summary.needed} tes bernilai 100 diperlukan untuk lulus training.
            ${summary.pass ? "" : `Butuh ${Math.max(0, summary.needed - summary.perfectCount)} tes lagi bernilai 100.`}
          </div>
        </div>
      </div>`;

    const cards = UC.TRAINING_TEST_IDS.map(testId => {
      const s = sessionsByTest[testId];
      let scoreHtml, actionHtml;
      if (!s) {
        scoreHtml = `<span class="score-pill pending">Belum dicoba</span>`;
        actionHtml = `<button class="btn btn-primary btn-sm" data-start="${testId}">Mulai Tes</button>`;
      } else if (s.score) {
        const cls = s.score.pct === 100 ? "perfect" : "partial";
        scoreHtml = `<span class="score-pill ${cls}">${s.score.correct}/${s.score.total} · ${s.score.pct}%</span>`;
        actionHtml = `<button class="btn btn-ghost btn-sm" data-detail="${s.id}">Lihat Detail</button> <button class="btn btn-ghost btn-sm" data-start="${testId}">Ulangi Tes</button>`;
      } else {
        scoreHtml = `<span class="score-pill pending">Menunggu key jawaban</span>`;
        actionHtml = `<button class="btn btn-ghost btn-sm" data-detail="${s.id}">Lihat Detail</button> <button class="btn btn-ghost btn-sm" data-start="${testId}">Ulangi Tes</button>`;
      }
      return `
        <div class="test-card">
          <div>
            <div class="t">${testLabel(testId)}</div>
            <div class="s">${s ? "Terakhir dikirim " + fmtDateTime(s.submittedAt) : "Belum ada percobaan"}</div>
          </div>
          <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
            ${scoreHtml}
            ${actionHtml}
          </div>
        </div>`;
    }).join("");

    host.innerHTML = `
      <h1 class="page-title">Training Shopper</h1>
      <p class="page-sub">Training · Mystery Shopper — selesaikan minimal 3 dari 5 tes dengan skor 100 untuk dinyatakan lulus sebelum penugasan lapangan sesungguhnya.</p>
      ${banner}
      <div class="section-h"><h2>Daftar Tes</h2></div>
      <div class="test-grid">${cards}</div>
      <div class="section-h"><h2>Riwayat Percobaan</h2></div>
      <div class="card" style="padding:0; overflow:hidden;">
        <table class="list">
          <thead><tr><th>Tes</th><th>Dikirim</th><th>Skor</th></tr></thead>
          <tbody>
            ${summary.sessions.length ? summary.sessions.map(s => `
              <tr>
                <td><a class="row-link" href="#" data-detail="${s.id}">${testLabel(s.testId)}</a></td>
                <td>${fmtDateTime(s.submittedAt)}</td>
                <td>${s.score ? `${s.score.correct}/${s.score.total} · ${s.score.pct}%` : "Menunggu key"}</td>
              </tr>`).join("") : `<tr><td colspan="3"><div class="empty">Belum ada percobaan tes.</div></td></tr>`}
          </tbody>
        </table>
      </div>
    `;

    host.querySelectorAll("[data-start]").forEach(b => b.addEventListener("click", () => startTest(b.dataset.start)));
    host.querySelectorAll("[data-detail]").forEach(b => b.addEventListener("click", (e) => { e.preventDefault(); renderDetail(b.dataset.detail); }));
  }

  /* ============================= TEST-TAKING VIEW ============================= */

  function startTest(testId) {
    currentTestId = testId;
    itemEvidenceStore = {};
    checkInInfo = null;
    startInteractionInfo = null;
    endInteractionInfo = null;

    host.innerHTML = `
      <button class="btn btn-ghost btn-sm" id="cancelBtn" style="margin-bottom:16px;">← Kembali</button>
      <h1 class="page-title">${testLabel(testId)}</h1>
      <p class="page-sub">Training · Mystery Shopper — jawab checklist berikut seolah kunjungan sesungguhnya, termasuk check-in / check-out dan foto bukti bergeotag.</p>

      <div class="card" id="checkInCard">
        <div class="field">
          <label class="q">Check-in</label>
          <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
            <button type="button" class="btn btn-primary btn-sm" id="checkInBtn">Check-in Sekarang</button>
            <span class="hint" id="checkInStatus">Belum check-in.</span>
          </div>
        </div>
        <div class="field" style="margin-top:14px;">
          <label class="q">Mulai Interaksi</label>
          <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
            <button type="button" class="btn btn-ghost btn-sm" id="startInteractionBtn">Catat Waktu</button>
            <span class="hint" id="startInteractionStatus">Belum dicatat. (Opsional)</span>
          </div>
        </div>
      </div>

      <form id="testForm" style="margin-top:16px; ${checkInInfo ? "" : "opacity:.5; pointer-events:none;"}" id="testFormWrap">
        <div id="checklistHost"></div>
        <div id="critAlert"></div>
        <div class="card" style="margin-top:16px;">
          <div class="field">
            <label class="q">Selesai Interaksi</label>
            <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
              <button type="button" class="btn btn-ghost btn-sm" id="endInteractionBtn">Catat Waktu</button>
              <span class="hint" id="endInteractionStatus">Belum dicatat. (Opsional)</span>
            </div>
          </div>
        </div>
        <div class="form-footer">
          <span class="hint" id="checkOutStatus">Belum check-out.</span>
          <div style="display:flex; gap:10px;">
            <button type="button" class="btn btn-ghost" id="checkOutBtn">Check-out</button>
            <button type="submit" class="btn btn-primary" id="submitBtn" disabled>Kirim Hasil Tes</button>
          </div>
        </div>
      </form>
    `;

    document.getElementById("cancelBtn").addEventListener("click", renderList);

    const checkInBtn = document.getElementById("checkInBtn");
    const checkInStatus = document.getElementById("checkInStatus");
    const testForm = document.getElementById("testForm");
    checkInBtn.addEventListener("click", async () => {
      checkInBtn.disabled = true;
      checkInBtn.textContent = "Mengambil lokasi…";
      const geo = await UC.captureGeo();
      const now = new Date();
      checkInInfo = { time: now.toISOString(), geo };
      checkInStatus.textContent = `Check-in ${fmtTime(now)} · GPS ${fmtGeo(geo)}`;
      checkInBtn.textContent = "✓ Sudah Check-in";
      testForm.style.opacity = "1";
      testForm.style.pointerEvents = "auto";
    });

    const startInteractionBtn = document.getElementById("startInteractionBtn");
    const startInteractionStatus = document.getElementById("startInteractionStatus");
    startInteractionBtn.addEventListener("click", async () => {
      startInteractionBtn.disabled = true;
      startInteractionBtn.textContent = "Mengambil lokasi…";
      const geo = await UC.captureGeo();
      const now = new Date();
      startInteractionInfo = { time: now.toISOString(), geo };
      startInteractionStatus.textContent = `Mulai interaksi ${fmtTime(now)} · GPS ${fmtGeo(geo)}`;
      startInteractionBtn.textContent = "✓ Tercatat";
    });

    const endInteractionBtn = document.getElementById("endInteractionBtn");
    const endInteractionStatus = document.getElementById("endInteractionStatus");
    endInteractionBtn.addEventListener("click", async () => {
      endInteractionBtn.disabled = true;
      endInteractionBtn.textContent = "Mengambil lokasi…";
      const geo = await UC.captureGeo();
      const now = new Date();
      endInteractionInfo = { time: now.toISOString(), geo };
      endInteractionStatus.textContent = `Selesai interaksi ${fmtTime(now)} · GPS ${fmtGeo(geo)}`;
      endInteractionBtn.textContent = "✓ Tercatat";
    });

    buildChecklist();

    let checkOutInfo = null;
    const checkOutBtn = document.getElementById("checkOutBtn");
    const checkOutStatus = document.getElementById("checkOutStatus");
    const submitBtn = document.getElementById("submitBtn");
    checkOutBtn.addEventListener("click", async () => {
      checkOutBtn.disabled = true;
      checkOutBtn.textContent = "Mengambil lokasi…";
      const geo = await UC.captureGeo();
      const now = new Date();
      checkOutInfo = { time: now.toISOString(), geo };
      checkOutStatus.textContent = `Check-out ${fmtTime(now)} · GPS ${fmtGeo(geo)}`;
      checkOutBtn.textContent = "✓ Sudah Check-out";
      submitBtn.disabled = false;
    });

    testForm.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!checkInInfo) { UC.toast("Silakan check-in terlebih dahulu"); return; }
      if (!checkOutInfo) { UC.toast("Silakan check-out terlebih dahulu"); return; }

      const answers = collectAnswers();
      const missing = findMissingVisualEvidence(answers);
      if (missing.length) {
        refreshItemEvidenceVisibility();
        const firstField = document.getElementById(`itemEvi_${missing[0].key}`);
        if (firstField) {
          const detailsEl = firstField.closest("details.fg");
          if (detailsEl) detailsEl.open = true;
          firstField.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        UC.toast(`Lampirkan foto bukti untuk ${missing.length} item kondisi fisik yang dijawab "Tidak"`);
        return;
      }

      const trainingSession = {
        id: UC.uid("TR"),
        testId: currentTestId,
        shopperUsername: session.username,
        shopperName: session.name,
        answers,
        checkIn: checkInInfo,
        startInteraction: startInteractionInfo,
        endInteraction: endInteractionInfo,
        checkOut: checkOutInfo,
        submittedAt: new Date().toISOString()
      };
      const saved = UC.addTrainingSession(trainingSession);
      UC.toast("Hasil tes terkirim");
      renderResult(saved);
    });
  }

  function buildChecklist() {
    const clHost = document.getElementById("checklistHost");
    Object.entries(UC.CHECKLIST).forEach(([catKey, def], i) => {
      const groupIndex = i + 1;
      const details = document.createElement("details");
      details.className = "fg";
      details.open = groupIndex <= 2;
      details.dataset.cat = catKey;

      const head = document.createElement("summary");
      head.className = "fg-head";
      head.innerHTML = `
        <div class="t"><h3>${def.title}</h3></div>
        <span class="w">${def.kind === "recording" ? "wajib" : def.weight + "% bobot"}</span>
      `;
      details.appendChild(head);

      const body = document.createElement("div");
      body.className = "fg-body";

      if (def.kind === "recording") {
        def.items.forEach(it => body.appendChild(renderYesNo(it, true, catKey)));
        const note = document.createElement("div");
        note.className = "hint";
        note.textContent = "Simulasi rekaman video/audio sebagai bagian latihan BSS.";
        body.appendChild(note);
      } else if (def.kind === "yn") {
        def.items.forEach(it => body.appendChild(renderYesNo(it, false, catKey)));
      } else if (def.kind === "rating") {
        def.items.forEach(it => body.appendChild(renderRating(it)));
      }

      details.appendChild(body);
      clHost.appendChild(details);
    });
  }

  function renderYesNo(it, isRecording, catKey) {
    const wrap = document.createElement("div");
    wrap.className = "field";
    const ref = UC.refFor(it.key);
    const refTag = ref ? `<span class="ref-tag">${ref}</span>` : "";
    const critTag = it.critical ? ' <span style="color:var(--bad); font-family:var(--font-mono); font-size:10px; text-transform:uppercase;">· zero-tolerance</span>' : "";
    // BSS observation items (category 1) are captured as video since they evaluate a live
    // service interaction; every other visual category keeps photo evidence (as in the live MMP form).
    const isVideo = catKey === "bss";
    const needsEvidence = it.visual || isVideo;
    const evidenceMarkup = needsEvidence ? `
      <div class="item-evidence" id="itemEvi_${it.key}" style="display:none;">
        <label class="item-evidence-box" for="itemEviInput_${it.key}"><span class="plus">+</span></label>
        <input type="file" accept="${isVideo ? "video/*" : "image/*"}" capture="environment" id="itemEviInput_${it.key}" data-key="${it.key}">
        <span class="item-evidence-hint"><span class="item-evidence-req">Wajib ${isVideo ? "video" : "foto"} bukti</span>Lampirkan ${isVideo ? "video" : "foto"} kondisi yang dimaksud karena jawaban "Tidak".</span>
      </div>` : "";
    wrap.innerHTML = `
      <label class="q">${refTag}${it.label}${critTag}</label>
      <div class="seg">
        <input type="radio" class="opt-yes" name="${it.key}" id="${it.key}_y" value="yes">
        <label for="${it.key}_y">${isRecording ? "Selesai" : "Ya"}</label>
        ${isRecording ? "" : `<input type="radio" class="opt-no" name="${it.key}" id="${it.key}_n" value="no"><label for="${it.key}_n" class="no-opt">Tidak</label>`}
        <input type="radio" name="${it.key}" id="${it.key}_na" value="na">
        <label for="${it.key}_na">N/A</label>
      </div>
      ${evidenceMarkup}
    `;
    wrap.querySelectorAll("input[type=radio]").forEach(r => r.addEventListener("change", () => { checkCritical(); refreshItemEvidenceVisibility(); }));

    if (needsEvidence) {
      const eviInput = wrap.querySelector(`#itemEviInput_${it.key}`);
      const eviWrap = wrap.querySelector(`#itemEvi_${it.key}`);
      const eviBox = wrap.querySelector(`.item-evidence-box`);
      eviInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async () => {
          const geo = await UC.captureGeo();
          itemEvidenceStore[it.key] = reader.result;
          eviBox.innerHTML = isVideo
            ? `<video src="${reader.result}" controls muted playsinline></video>`
            : `<img src="${reader.result}" alt="">`;
          eviWrap.classList.add("filled");
          UC.toast((isVideo ? "Video bukti tersimpan" : "Foto bukti tersimpan") + (geo ? ` (GPS ${fmtGeo(geo)})` : ""));
        };
        reader.readAsDataURL(file);
      });
    }
    return wrap;
  }

  function renderRating(it) {
    const wrap = document.createElement("div");
    wrap.className = "field";
    const ref = UC.refFor(it.key);
    const refTag = ref ? `<span class="ref-tag">${ref}</span>` : "";
    wrap.innerHTML = `<label class="q">${refTag}${it.label}</label>`;
    const rating = document.createElement("div");
    rating.className = "rating";
    rating.dataset.key = it.key;
    for (let i = 1; i <= 5; i++) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = i;
      b.addEventListener("click", () => {
        rating.querySelectorAll("button").forEach(x => x.classList.remove("active"));
        b.classList.add("active");
        rating.dataset.value = i;
      });
      rating.appendChild(b);
    }
    wrap.appendChild(rating);
    return wrap;
  }

  function refreshItemEvidenceVisibility() {
    document.querySelectorAll(".item-evidence").forEach(eviWrap => {
      const key = eviWrap.id.replace("itemEvi_", "");
      const checked = document.querySelector(`input[name="${key}"]:checked`);
      eviWrap.style.display = (checked && checked.value === "no") ? "flex" : "none";
    });
  }

  function checkCritical() {
    const alertHost = document.getElementById("critAlert");
    let failed = [];
    Object.entries(UC.CHECKLIST).forEach(([catKey, def]) => {
      if (def.kind !== "yn") return;
      def.items.forEach(it => {
        if (!it.critical) return;
        const el = document.querySelector(`input[name="${it.key}"]:checked`);
        if (el && el.value === "no") failed.push(it.label);
      });
    });
    alertHost.innerHTML = failed.length ? `
      <div class="crit-flag">
        <div><b>Critical Item Gagal (Simulasi)</b>Item zero-tolerance gagal: ${failed.join(", ")}.</div>
      </div>` : "";
  }

  function collectAnswers() {
    const answers = {};
    Object.entries(UC.CHECKLIST).forEach(([catKey, def]) => {
      if (def.kind === "rating") {
        def.items.forEach(it => {
          const el = document.querySelector(`.rating[data-key="${it.key}"]`);
          answers[it.key] = el && el.dataset.value ? el.dataset.value : "3";
        });
      } else {
        def.items.forEach(it => {
          const el = document.querySelector(`input[name="${it.key}"]:checked`);
          answers[it.key] = el ? el.value : "na";
        });
      }
    });
    return answers;
  }

  function findMissingVisualEvidence(answers) {
    const missing = [];
    Object.entries(UC.CHECKLIST).forEach(([catKey, def]) => {
      if (def.kind !== "yn") return;
      def.items.forEach(it => {
        const needsEvidence = it.visual || catKey === "bss";
        if (needsEvidence && answers[it.key] === "no" && !itemEvidenceStore[it.key]) missing.push(it);
      });
    });
    return missing;
  }

  /* ============================= RESULT VIEW ============================= */

  function renderResult(s) {
    host.innerHTML = `
      <h1 class="page-title">Hasil ${testLabel(s.testId)}</h1>
      <p class="page-sub">Training · Mystery Shopper</p>
      <div class="card" style="text-align:center;">
        ${s.score ? `
          <div class="score-pill ${s.score.pct === 100 ? "perfect" : "partial"}" style="font-size:16px; padding:8px 18px;">${s.score.correct} / ${s.score.total} benar · ${s.score.pct}%</div>
          <p style="margin-top:14px; color:var(--ink-soft);">${s.score.pct === 100 ? "Sempurna! Tes ini terhitung sebagai salah satu tes bernilai 100." : "Tinjau kembali item yang belum sesuai key jawaban pada halaman detail."}</p>
        ` : `
          <div class="score-pill pending" style="font-size:14px; padding:8px 18px;">Menunggu key jawaban dari Quality Checker</div>
          <p style="margin-top:14px; color:var(--ink-soft);">Skor akan muncul otomatis setelah Quality Checker mengunggah key jawaban untuk tes ini.</p>
        `}
      </div>
      <div style="display:flex; gap:10px; margin-top:18px;">
        <button class="btn btn-ghost" id="toDetailBtn">Lihat Detail Jawaban</button>
        <button class="btn btn-primary" id="toListBtn">Kembali ke Daftar Tes</button>
      </div>
    `;
    document.getElementById("toListBtn").addEventListener("click", renderList);
    document.getElementById("toDetailBtn").addEventListener("click", () => renderDetail(s.id));
  }

  /* ============================= DETAIL VIEW (own session) ============================= */

  function renderDetail(sessionId) {
    const s = UC.getTrainingSession(sessionId);
    if (!s || s.shopperUsername !== session.username) { renderList(); return; }
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
      <h1 class="page-title">${testLabel(s.testId)}</h1>
      <p class="page-sub">Dikirim ${fmtDateTime(s.submittedAt)}</p>

      <div class="id-card">
        <div class="id-cell"><div class="k">Check-in</div><div class="v">${fmtCheckpoint(s.checkIn)}</div></div>
        <div class="id-cell"><div class="k">Mulai Interaksi</div><div class="v">${fmtCheckpoint(s.startInteraction)}</div></div>
        <div class="id-cell"><div class="k">Selesai Interaksi</div><div class="v">${fmtCheckpoint(s.endInteraction)}</div></div>
        <div class="id-cell"><div class="k">Check-out</div><div class="v">${fmtCheckpoint(s.checkOut)}</div></div>
      </div>
      <div class="id-card" style="grid-template-columns:repeat(2,1fr);">
        <div class="id-cell"><div class="k">Skor</div><div class="v">${s.score ? s.score.correct + "/" + s.score.total + " · " + s.score.pct + "%" : "Menunggu key"}</div></div>
        <div class="id-cell"><div class="k">Status</div><div class="v">${s.score ? (s.score.pct === 100 ? "Sempurna" : "Belum sempurna") : "Pending"}</div></div>
      </div>

      <div class="section-h"><h2>Detail Jawaban</h2></div>
      ${tables}
    `;
    document.getElementById("backBtn").addEventListener("click", renderList);
  }

  renderList();
})();
