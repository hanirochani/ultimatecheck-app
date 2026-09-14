(() => {
  const gate = document.getElementById("gate");
  const qcHost = document.getElementById("qcHost");
  const gateBtn = document.getElementById("gateBtn");
  const gatePass = document.getElementById("gatePass");
  const gateError = document.getElementById("gateError");

  function tryEnter() {
    if (UC.tryQcLogin(gatePass.value)) {
      enterQc();
    } else {
      gateError.textContent = "Kata sandi salah. Coba lagi.";
    }
  }
  gateBtn.addEventListener("click", tryEnter);
  gatePass.addEventListener("keydown", (e) => { if (e.key === "Enter") tryEnter(); });

  const logoutLink = document.getElementById("logoutLink");
  if (logoutLink) logoutLink.addEventListener("click", () => UC.qcLogout());

  const listView = document.getElementById("listView");
  const detailView = document.getElementById("detailView");
  const tbody = document.getElementById("visitTbody");

  const params = new URLSearchParams(window.location.search);
  const highlightId = params.get("highlight");
  const openId = params.get("open");

  function statusPill(v) {
    if (v.status === "approved") return `<span class="pill approved"><span class="dot"></span>Disetujui</span>`;
    if (v.status === "rejected") return `<span class="pill rejected"><span class="dot"></span>Dikembalikan</span>`;
    if (v.score.criticalFail) return `<span class="pill critical"><span class="dot"></span>Critical · Menunggu</span>`;
    return `<span class="pill pending"><span class="dot"></span>Menunggu QC</span>`;
  }

  function renderList() {
    const visits = UC.getVisits().sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1));
    tbody.innerHTML = "";
    if (!visits.length) {
      tbody.innerHTML = `<tr><td colspan="6"><div class="empty">Belum ada kunjungan masuk.</div></td></tr>`;
      return;
    }
    visits.forEach(v => {
      const tr = document.createElement("tr");
      if (v.id === highlightId) tr.style.background = "var(--good-bg)";
      tr.innerHTML = `
        <td><a class="row-link" href="#" data-id="${v.id}"><b>${v.site}</b><br><span style="color:var(--ink-faint); font-size:11.8px;">${v.location}</span></a></td>
        <td>${v.shopperId}</td>
        <td>${formatDate(v.visitDate)}</td>
        <td style="font-family:var(--font-mono); font-weight:700;">${v.score.total.toFixed(1)}</td>
        <td>${statusPill(v)}</td>
        <td>${v.emailStatus === "emailed" ? '<span class="pill emailed"><span class="dot"></span>Terkirim Email</span>' : ""}</td>
      `;
      tr.querySelector("a").addEventListener("click", (e) => { e.preventDefault(); showDetail(v.id); });
      tbody.appendChild(tr);
    });
  }

  function formatDate(d) {
    const dt = new Date(d + "T00:00:00");
    return dt.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
  }

  function catRow(label, weight, pct) {
    return `
      <div class="cat-row">
        <div class="cat-label">${label}</div>
        <div class="cat-w">${weight}%</div>
        <div class="track"><div class="fill" style="width:${pct}%"></div></div>
        <div class="pct">${Math.round(pct)}%</div>
      </div>`;
  }

  function checklistTable(catKey, def, answers, itemEvidence) {
    itemEvidence = itemEvidence || {};
    const rows = def.items.map((it, i) => {
      const v = answers[it.key];
      let resultHtml;
      if (def.kind === "rating") {
        resultHtml = `<span style="font-family:var(--font-mono); font-weight:700;">${v}/5</span>`;
      } else {
        resultHtml = v === "yes" ? '<span style="color:var(--good); font-weight:700;">Ya</span>'
          : v === "no" ? '<span style="color:var(--bad); font-weight:700;">Tidak</span>'
          : '<span style="color:var(--ink-faint);">N/A</span>';
        if (v === "no" && it.visual) {
          resultHtml += itemEvidence[it.key]
            ? `<br><img src="${itemEvidence[it.key]}" alt="Bukti foto" title="Bukti foto dari shopper" style="width:56px;height:42px;object-fit:cover;border-radius:5px;margin-top:4px;border:1px solid var(--line);">`
            : `<br><span style="font-family:var(--font-mono); font-size:9.5px; color:var(--hazard); text-transform:uppercase;">tanpa foto</span>`;
        }
      }
      return `<tr><td style="width:22px; color:var(--ink-faint); font-family:var(--font-mono);">${i + 1}</td><td>${it.label}${it.critical ? ' <span style="color:var(--bad); font-size:10px; font-family:var(--font-mono); text-transform:uppercase;">zero-tolerance</span>' : ""}</td><td style="width:70px; text-align:right;">${resultHtml}</td></tr>`;
    }).join("");
    return `<table class="list" style="margin-bottom:18px;"><thead><tr><th></th><th>${def.title}</th><th style="text-align:right;">Hasil</th></tr></thead><tbody>${rows}</tbody></table>`;
  }

  function showDetail(id) {
    const v = UC.getVisit(id);
    if (!v) return;
    listView.style.display = "none";
    detailView.style.display = "block";

    const cats = v.score.categories;
    const catRows = [
      catRow("Basic Service Steps & Interaction", 35, cats.bss),
      catRow("Site Cleanliness & Facilities", 20, cats.cleanliness),
      catRow("Marketing & Promotional Execution", 20, cats.marketing),
      catRow("Grooming & Uniform", 15, cats.grooming),
      catRow("Overall Customer Experience", 10, cats.cx),
    ].join("");

    const evidenceCards = UC.EVIDENCE_SLOTS.map(s => `
      <div class="photocard">
        <img src="${v.evidence[s.key] || s.file}" alt="">
        <div class="cap">${s.label}</div>
      </div>`).join("");

    const checklistTables = ["bss", "cleanliness", "marketing", "grooming", "cx"]
      .map(k => checklistTable(k, UC.CHECKLIST[k], v.answers, v.itemEvidence)).join("");

    detailView.innerHTML = `
      <button class="btn btn-ghost btn-sm" id="backBtn" style="margin-bottom:16px;">← Kembali ke Antrean</button>
      <h1 class="page-title">${v.site}</h1>
      <p class="page-sub">${v.location} · ${v.cluster}</p>

      <div class="id-card">
        <div class="id-cell"><div class="k">Visit ID</div><div class="v">${v.id}</div></div>
        <div class="id-cell"><div class="k">Shopper</div><div class="v">${v.shopperId}</div></div>
        <div class="id-cell"><div class="k">Tanggal</div><div class="v">${formatDate(v.visitDate)}</div></div>
        <div class="id-cell"><div class="k">Status</div><div class="v">${statusPill(v)}</div></div>
      </div>

      <div class="scorewrap">
        <div class="scorebig">
          <div class="num">${v.score.total.toFixed(1)}</div>
          <div class="max">/ 100</div>
          <div class="tier">${UC.tierLabel(v.score.total)}</div>
        </div>
        <div class="catscore">${catRows}</div>
      </div>

      ${v.score.criticalFail ? `
      <div class="crit-flag" style="margin-bottom:18px;">
        <div><b>Critical Failure</b>Item zero-tolerance gagal: ${v.score.criticalItems.join(", ")}. Notifikasi darurat telah/akan dikirim ke manajemen.</div>
      </div>` : ""}

      <div class="section-h"><h2>Bukti Foto / Video</h2></div>
      <div class="photogrid">${evidenceCards}</div>

      <div class="section-h"><h2>Catatan Observasi Shopper</h2></div>
      <div class="card" style="font-size:13.4px; color:var(--ink-soft);">${v.notes.observation || "—"}</div>

      <div class="section-h"><h2>Detail Checklist</h2></div>
      ${checklistTables}

      <div class="section-h"><h2>Keputusan QC</h2></div>
      <div class="card">
        <div class="field">
          <label class="q">Catatan QC</label>
          <textarea id="qcNote" placeholder="Catatan verifikasi, alasan approve/reject…">${v.notes.qc || ""}</textarea>
        </div>
        <div style="display:flex; gap:10px; margin-top:14px; flex-wrap:wrap;">
          <button class="btn btn-primary" id="approveBtn" ${v.status === "approved" ? "disabled" : ""}>Setujui &amp; Finalisasi</button>
          <button class="btn btn-danger" id="rejectBtn" ${v.status === "rejected" ? "disabled" : ""}>Kembalikan ke Shopper</button>
          ${v.status === "approved" ? `<button class="btn btn-ghost" id="emailBtn" ${v.emailStatus === "emailed" ? "disabled" : ""}>${v.emailStatus === "emailed" ? "✓ Email Terkirim ke Manajemen" : "Kirim Laporan via Email ke Manajemen"}</button>` : ""}
        </div>
      </div>
    `;

    document.getElementById("backBtn").addEventListener("click", () => {
      detailView.style.display = "none";
      listView.style.display = "block";
      renderList();
    });
    document.getElementById("approveBtn").addEventListener("click", () => {
      const note = document.getElementById("qcNote").value;
      UC.updateVisit(v.id, { status: "approved", notes: Object.assign({}, v.notes, { qc: note }) });
      UC.toast("Kunjungan disetujui QC");
      showDetail(v.id);
    });
    document.getElementById("rejectBtn").addEventListener("click", () => {
      const note = document.getElementById("qcNote").value;
      UC.updateVisit(v.id, { status: "rejected", notes: Object.assign({}, v.notes, { qc: note }) });
      UC.toast("Dikembalikan ke shopper untuk revisi");
      showDetail(v.id);
    });
    const emailBtn = document.getElementById("emailBtn");
    if (emailBtn) {
      emailBtn.addEventListener("click", () => {
        UC.updateVisit(v.id, { emailStatus: "emailed" });
        UC.toast("Laporan final dikirim via email ke manajemen (simulasi)");
        showDetail(v.id);
      });
    }
  }

  function enterQc() {
    gate.style.display = "none";
    qcHost.style.display = "block";
    renderList();
    if (openId) showDetail(openId);
  }

  if (UC.isQcUnlocked()) enterQc();
})();
