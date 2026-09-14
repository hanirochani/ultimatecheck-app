(() => {
  const gate = document.getElementById("gate");
  const dashHost = document.getElementById("dashHost");
  const gateBtn = document.getElementById("gateBtn");
  const gatePass = document.getElementById("gatePass");
  const gateError = document.getElementById("gateError");

  function tryEnter() {
    if (UC.tryMgmtLogin(gatePass.value)) {
      showDashboard();
    } else {
      gateError.textContent = "Kata sandi salah. Coba lagi.";
    }
  }
  gateBtn.addEventListener("click", tryEnter);
  gatePass.addEventListener("keydown", (e) => { if (e.key === "Enter") tryEnter(); });

  document.getElementById("topbarRight").querySelector(".logout").addEventListener("click", () => UC.mgmtLogout());

  function computeAggregates() {
    const visits = UC.getVisits();
    const finalized = visits.filter(v => v.status === "approved");
    const n = finalized.length || 1;

    const catSums = { bss: 0, cleanliness: 0, marketing: 0, grooming: 0, cx: 0 };
    finalized.forEach(v => Object.keys(catSums).forEach(k => catSums[k] += v.score.categories[k] || 0));
    Object.keys(catSums).forEach(k => catSums[k] = catSums[k] / n);

    const overall = finalized.length ? finalized.reduce((s, v) => s + v.score.total, 0) / finalized.length : 0;

    // Per-item yes rate across all yn categories, using finalized visits' answers
    const itemStats = [];
    ["bss", "cleanliness", "marketing", "grooming"].forEach(catKey => {
      UC.CHECKLIST[catKey].items.forEach(it => {
        let yes = 0, total = 0;
        finalized.forEach(v => {
          const val = v.answers[it.key];
          if (val === "yes" || val === "no") { total++; if (val === "yes") yes++; }
        });
        if (total > 0) itemStats.push({ label: it.label, cat: UC.CHECKLIST[catKey].title, pct: (yes / total) * 100 });
      });
    });
    itemStats.sort((a, b) => b.pct - a.pct);
    const top3 = itemStats.slice(0, 3);
    const bottom3 = itemStats.slice(-3).reverse();

    const clusters = {};
    finalized.forEach(v => {
      clusters[v.cluster] = clusters[v.cluster] || { n: 0, sum: 0, cats: { bss: 0, cleanliness: 0, marketing: 0, grooming: 0 } };
      clusters[v.cluster].n++;
      clusters[v.cluster].sum += v.score.total;
      Object.keys(clusters[v.cluster].cats).forEach(k => clusters[v.cluster].cats[k] += v.score.categories[k] || 0);
    });
    Object.values(clusters).forEach(c => {
      c.avg = c.sum / c.n;
      Object.keys(c.cats).forEach(k => c.cats[k] = c.cats[k] / c.n);
    });

    const ranked = finalized.slice().sort((a, b) => b.score.total - a.score.total);
    const criticalCount = visits.filter(v => v.score.criticalFail).length;
    const emailedCount = visits.filter(v => v.emailStatus === "emailed").length;
    const pendingCount = visits.filter(v => v.status === "pending").length;

    return { visits, finalized, catSums, overall, top3, bottom3, clusters, ranked, criticalCount, emailedCount, pendingCount };
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

  function hlItem(rank, cls, item) {
    return `
      <div class="hl-item ${cls}">
        <div class="hl-rank">${rank}</div>
        <div class="hl-body"><div class="t">${item.label}</div><div class="s">${item.cat}</div></div>
        <div class="hl-pct">${Math.round(item.pct)}%</div>
      </div>`;
  }

  function tierChip(score) {
    if (score >= 85) return `<span class="tier-chip good">Baik Sekali</span>`;
    if (score >= 75) return `<span class="tier-chip good">Baik</span>`;
    if (score >= 65) return `<span class="tier-chip watch">Perlu Perhatian</span>`;
    return `<span class="tier-chip bad">Kritis</span>`;
  }

  function showDashboard() {
    gate.style.display = "none";
    dashHost.style.display = "block";
    render();
  }

  function render() {
    const d = computeAggregates();

    const clusterCards = Object.entries(d.clusters).map(([name, c]) => `
      <div class="card" style="flex:1; min-width:260px;">
        <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:8px;">
          <div style="font-family:var(--font-display); font-weight:800; text-transform:uppercase; font-size:16px;">${name}</div>
          <div style="font-family:var(--font-mono); font-size:11px; color:var(--ink-faint);">${c.n} site</div>
        </div>
        <div style="display:flex; align-items:baseline; gap:6px; margin-bottom:10px;">
          <div style="font-family:var(--font-display); font-weight:800; font-size:26px; color:var(--green);">${c.avg.toFixed(1)}</div>
          <div style="font-family:var(--font-mono); font-size:11px; color:var(--ink-faint);">/ 100</div>
        </div>
        ${Object.entries({ bss: "Basic Service Steps", cleanliness: "Kebersihan", marketing: "Marketing", grooming: "Grooming" })
          .map(([k, lbl]) => `<div style="display:flex; align-items:center; gap:8px; font-size:12px; margin-bottom:4px;"><div style="width:110px; color:var(--ink-soft);">${lbl}</div><div class="track" style="flex:1; height:6px;"><div class="fill" style="width:${c.cats[k]}%"></div></div><div style="font-family:var(--font-mono); width:32px; text-align:right;">${Math.round(c.cats[k])}%</div></div>`).join("")}
      </div>`).join("");

    const rankRows = d.ranked.map((v, i) => `
      <tr>
        <td style="font-family:var(--font-mono); color:var(--ink-faint);">${i + 1}</td>
        <td><b>${v.site}</b><br><span style="color:var(--ink-faint); font-size:11.5px;">${v.location}</span></td>
        <td>${v.cluster}</td>
        <td style="font-family:var(--font-mono); font-weight:700; color:${v.score.total >= 75 ? "var(--good)" : "var(--bad)"};">${v.score.total.toFixed(1)}</td>
        <td>${tierChip(v.score.total)}</td>
      </tr>`).join("");

    dashHost.innerHTML = `
      <h1 class="page-title">Management Dashboard</h1>
      <p class="page-sub">Ringkasan kumulatif seluruh laporan kunjungan yang telah difinalisasi QC. Data contoh untuk keperluan review desain — akan terhubung ke data produksi setelah tool ini disetujui.</p>

      <div class="stat-strip">
        <div class="stat-tile"><div class="k">Laporan Final</div><div class="v">${d.finalized.length} <span>disetujui QC</span></div></div>
        <div class="stat-tile"><div class="k">Menunggu QC</div><div class="v">${d.pendingCount} <span>kunjungan</span></div></div>
        <div class="stat-tile"><div class="k">Critical Failure</div><div class="v">${d.criticalCount} <span>kejadian</span></div></div>
        <div class="stat-tile"><div class="k">Terkirim ke Email</div><div class="v">${d.emailedCount} <span>laporan</span></div></div>
      </div>

      <div class="section-h"><h2>Ringkasan Skor Jaringan</h2></div>
      <div class="scorewrap">
        <div class="scorebig">
          <div class="num">${d.overall.toFixed(1)}</div>
          <div class="max">/ 100</div>
          <div class="tier">${UC.tierLabel(d.overall)}</div>
        </div>
        <div class="catscore">
          ${catRow("Basic Service Steps & Interaction", 35, d.catSums.bss)}
          ${catRow("Kebersihan & Fasilitas Situs", 20, d.catSums.cleanliness)}
          ${catRow("Eksekusi Marketing & Promosi", 20, d.catSums.marketing)}
          ${catRow("Grooming & Seragam", 15, d.catSums.grooming)}
          ${catRow("Pengalaman Pelanggan Keseluruhan", 10, d.catSums.cx)}
        </div>
      </div>

      <div class="section-h"><h2>3 Item Tertinggi &amp; Terendah <span class="w">se-jaringan, dari laporan final</span></h2></div>
      <div class="highlight-wrap">
        <div class="highlight-col">
          <div class="highlight-head good"><span class="dot"></span><b>Top 3 — Paling Konsisten</b></div>
          ${d.top3.map((it, i) => hlItem(i + 1, "good", it)).join("") || '<div class="empty">Belum cukup data.</div>'}
        </div>
        <div class="highlight-col">
          <div class="highlight-head bad"><span class="dot"></span><b>Bottom 3 — Paling Sering Gagal</b></div>
          ${d.bottom3.map((it, i) => hlItem(i + 1, "bad", it)).join("") || '<div class="empty">Belum cukup data.</div>'}
        </div>
      </div>

      <div class="section-h"><h2>Perbandingan Klaster / Wilayah</h2></div>
      <div style="display:flex; gap:14px; flex-wrap:wrap;">${clusterCards || '<div class="empty">Belum ada data klaster.</div>'}</div>

      <div class="section-h"><h2>Peringkat Site <span class="w">berdasarkan laporan final</span></h2></div>
      <div class="card" style="padding:0; overflow:hidden;">
        <table class="list">
          <thead><tr><th>#</th><th>Site</th><th>Wilayah</th><th>Skor</th><th>Status</th></tr></thead>
          <tbody>${rankRows || '<tr><td colspan="5"><div class="empty">Belum ada laporan final.</div></td></tr>'}</tbody>
        </table>
      </div>

      <div class="section-h"><h2>Rekomendasi</h2></div>
      <ol style="margin:6px 0 0; padding:0; list-style:none; display:flex; flex-direction:column; gap:8px;">
        <li style="display:flex; gap:10px; font-size:13.5px; background:var(--surface-2); border-radius:8px; padding:10px 14px;"><span style="font-family:var(--font-display); font-weight:800; color:var(--green);">01</span><span>Prioritaskan perbaikan pada item skor terendah se-jaringan (lihat Bottom 3 di atas).</span></li>
        <li style="display:flex; gap:10px; font-size:13.5px; background:var(--surface-2); border-radius:8px; padding:10px 14px;"><span style="font-family:var(--font-display); font-weight:800; color:var(--green);">02</span><span>Tindak lanjuti site dengan status "Kritis" melalui kunjungan re-audit dalam 2 minggu.</span></li>
        <li style="display:flex; gap:10px; font-size:13.5px; background:var(--surface-2); border-radius:8px; padding:10px 14px;"><span style="font-family:var(--font-display); font-weight:800; color:var(--green);">03</span><span>Finalisasi kebijakan kanal notifikasi Critical Failure (WhatsApp dan/atau email) sebelum periode berikutnya.</span></li>
      </ol>

      <p class="hint" style="margin-top:20px; text-align:center;">Akses dasbor ini terbatas untuk manajemen. Personil site/SPBU dan shopper tidak memiliki akses ke halaman ini.</p>
    `;
  }

  if (UC.isMgmtUnlocked()) showDashboard();
})();
