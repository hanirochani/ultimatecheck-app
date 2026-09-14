/* ==========================================================================
   UltimateCheck — Internal Tool prototype data layer
   Functional prototype only: all data lives in localStorage in the browser.
   No real backend, auth, database, WhatsApp or email sending is wired up.
   ========================================================================== */

const UC = (() => {

  const STORE_KEY = "uc_visits_v1";
  const MGMT_PASS_KEY = "uc_mgmt_ok";
  const MGMT_PASSWORD = "APRmanajemen2026"; // prototype-only shared password gate

  // Checklist definitions per SOW category, with weight + zero-tolerance flags.
  const CHECKLIST = {
    recording: {
      title: "0. Rekaman Interaksi BSS", weight: 0, kind: "recording",
      items: [
        { key: "rec_start", label: "Mulai rekaman video/audio sebelum memasuki area interaksi" },
        { key: "rec_stop", label: "Hentikan rekaman setelah transaksi selesai" },
      ]
    },
    bss: {
      title: "1. Basic Service Steps & Interaction", weight: 35, kind: "yn",
      items: [
        { key: "bss_greet1", label: "Memberikan acknowledgement / greeting" },
        { key: "bss_greet2", label: "Greeting sesuai service standard" },
        { key: "bss_body", label: "Ramah & positive body language" },
        { key: "bss_confirm_product", label: "Konfirmasi jenis produk" },
        { key: "bss_confirm_amount", label: "Konfirmasi nominal / volume pengisian" },
        { key: "bss_offer_sop", label: "Menawarkan produk sesuai SOP" },
        { key: "bss_offer_promo", label: "Menawarkan promo yang berlaku" },
        { key: "bss_explain_promo", label: "Menjelaskan promo dengan benar saat ditanya" },
        { key: "bss_payment_info", label: "Menginformasikan metode / promo pembayaran" },
        { key: "bss_payment_process", label: "Proses pembayaran berjalan baik" },
        { key: "bss_receipt", label: "Memberikan receipt", critical: true },
        { key: "bss_closing", label: "Memberikan closing / thank you" },
        { key: "bss_attentive", label: "Menjaga perhatian selama pelayanan" },
        { key: "bss_ppe", label: "Menggunakan APD (sarung tangan) saat mengisi", critical: true },
      ]
    },
    cleanliness: {
      title: "2. Site Cleanliness, Presentation & Facilities", weight: 20, kind: "yn",
      items: [
        { key: "cl_forecourt", label: "Area forecourt bersih & bebas sampah" },
        { key: "cl_dispenser", label: "Dispenser & nozzle bersih, tidak bocor", critical: true },
        { key: "cl_signage", label: "Signage harga terpasang & terbaca jelas" },
        { key: "cl_canopy", label: "Kanopi & pencahayaan berfungsi baik" },
        { key: "cl_toilet_clean", label: "Toilet bersih & tisu tersedia" },
        { key: "cl_toilet_water", label: "Air & sabun tersedia di toilet" },
        { key: "cl_musholla", label: "Musholla bersih & rapi (jika tersedia)" },
        { key: "cl_parking", label: "Area parkir rapi & tertata" },
        { key: "cl_trash", label: "Tempat sampah tersedia & tidak penuh" },
        { key: "cl_landscape", label: "Taman / area hijau terawat" },
        { key: "cl_safety_signage", label: "Signage keselamatan (dilarang merokok, dsb) lengkap", critical: true },
        { key: "cl_fire", label: "APAR tersedia & mudah dijangkau", critical: true },
      ]
    },
    marketing: {
      title: "3. Marketing & Promotional Execution", weight: 20, kind: "yn",
      items: [
        { key: "mk_pop", label: "Materi promosi terpasang sesuai panduan (POP)" },
        { key: "mk_poc", label: "Materi POC terpasang di titik komunikasi" },
        { key: "mk_condition", label: "Materi promosi dalam kondisi baik (tidak rusak/pudar)" },
        { key: "mk_campaign", label: "Kampanye aktif ter-display sesuai periode" },
        { key: "mk_pricing", label: "Informasi harga & promo konsisten dengan pusat" },
        { key: "mk_branding", label: "Branding & identitas visual sesuai standar" },
        { key: "mk_loyalty", label: "Program loyalti ditawarkan / disebutkan" },
      ]
    },
    grooming: {
      title: "4. Grooming & Uniform", weight: 15, kind: "yn",
      items: [
        { key: "gr_uniform", label: "Seragam lengkap & rapi" },
        { key: "gr_nametag", label: "Name tag terpasang & terbaca" },
        { key: "gr_grooming", label: "Grooming rapi (rambut, kuku, dsb)" },
        { key: "gr_shoes", label: "Sepatu safety sesuai standar", critical: true },
        { key: "gr_hygiene", label: "Kebersihan diri terjaga" },
        { key: "gr_accessories", label: "Aksesoris sesuai ketentuan (tidak berlebihan)" },
        { key: "gr_id", label: "ID card / atribut identitas terpasang" },
        { key: "gr_posture", label: "Postur & sikap tubuh profesional" },
      ]
    },
    cx: {
      title: "5. Overall Customer Experience", weight: 10, kind: "rating",
      items: [
        { key: "cx_overall", label: "Kesan keseluruhan pengalaman pelanggan" },
        { key: "cx_speed", label: "Kecepatan pelayanan" },
        { key: "cx_professionalism", label: "Profesionalisme petugas" },
        { key: "cx_wouldreturn", label: "Kemungkinan pelanggan kembali ke site ini" },
      ]
    }
  };

  function xmlEscape(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function svgPlaceholder(label, bg, fg) {
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='320' height='240'>
      <rect width='320' height='240' fill='${bg}'/>
      <rect x='2' y='2' width='316' height='236' fill='none' stroke='${fg}' stroke-opacity='.25' stroke-width='2'/>
      <text x='160' y='124' font-family='IBM Plex Sans,sans-serif' font-size='17' font-weight='700' fill='${fg}' text-anchor='middle'>${xmlEscape(label)}</text>
      <rect x='0' y='210' width='320' height='30' fill='#142019'/>
      <text x='160' y='229' font-family='IBM Plex Mono,monospace' font-size='9' fill='#C7DB1F' text-anchor='middle'>CONTOH FOTO — BUKAN FOTO ASLI</text>
    </svg>`;
    return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
  }

  const EVIDENCE_SLOTS = [
    { key: "ev_forecourt", label: "Forecourt", file: svgPlaceholder("Forecourt Overview", "#0B5D3F", "#F5FAF3") },
    { key: "ev_dispenser", label: "Dispenser", file: svgPlaceholder("Dispenser & Nozzle", "#637A40", "#F5FAF3") },
    { key: "ev_uniform", label: "Seragam Petugas", file: svgPlaceholder("Staff Uniform", "#0B5D3F", "#F5FAF3") },
    { key: "ev_promo", label: "Materi Promosi", file: svgPlaceholder("Promotional Material", "#B85A00", "#FBE9D6") },
    { key: "ev_toilet", label: "Toilet", file: svgPlaceholder("Toilet Condition", "#3E5A9E", "#F5FAF3") },
    { key: "ev_receipt", label: "Struk Transaksi", file: svgPlaceholder("Transaction Receipt", "#EBEEE4", "#13201A") },
  ];

  function uid(prefix) {
    return prefix + "-" + Math.random().toString(36).slice(2, 8).toUpperCase();
  }

  function scoreVisit(answers) {
    const catScores = {};
    let weighted = 0;
    let criticalFail = false;
    let criticalItems = [];
    ["bss", "cleanliness", "marketing", "grooming"].forEach(catKey => {
      const items = CHECKLIST[catKey].items;
      let yes = 0, total = 0;
      items.forEach(it => {
        const v = answers[it.key];
        if (v === "yes" || v === "no") {
          total++;
          if (v === "yes") yes++;
          if (v === "no" && it.critical) { criticalFail = true; criticalItems.push(it.label); }
        }
      });
      const pct = total ? (yes / total) * 100 : 0;
      catScores[catKey] = pct;
      weighted += (pct / 100) * CHECKLIST[catKey].weight;
    });
    // rating category (1-5 scale averaged, converted to %)
    const cxItems = CHECKLIST.cx.items;
    let cxSum = 0, cxN = 0;
    cxItems.forEach(it => { const v = answers[it.key]; if (v) { cxSum += Number(v); cxN++; } });
    const cxPct = cxN ? (cxSum / cxN / 5) * 100 : 0;
    catScores.cx = cxPct;
    weighted += (cxPct / 100) * CHECKLIST.cx.weight;

    return { total: Math.round(weighted * 10) / 10, categories: catScores, criticalFail, criticalItems };
  }

  function tierLabel(score) {
    if (score >= 85) return "Baik Sekali";
    if (score >= 75) return "Baik";
    if (score >= 65) return "Perlu Perhatian";
    return "Kritis";
  }

  function seedVisits() {
    const seed = [
      mkSeedVisit("VS-2026-1014-0042", "SPBU 34.16.05", "Kebon Jeruk, Jakarta Barat", "Jabodetabek", "MS-014", "2026-10-14", "approved", true, {
        bss: 86, cleanliness: 75, marketing: 86, grooming: 88, cx: 85
      }, 84.0, false, "emailed"),
      mkSeedVisit("VS-2026-1012-0038", "SPBU 34.16.12", "Cikarang", "Jabodetabek", "MS-007", "2026-10-12", "approved", true, {
        bss: 95, cleanliness: 91, marketing: 92, grooming: 96, cx: 90
      }, 93.2, false, "emailed"),
      mkSeedVisit("VS-2026-1011-0035", "SPBU 34.15.08", "Karawang", "Jabodetabek", "MS-021", "2026-10-11", "approved", true, {
        bss: 64, cleanliness: 48, marketing: 60, grooming: 70, cx: 55
      }, 61.4, true, "emailed"),
      mkSeedVisit("VS-2026-1010-0031", "SPBU 34.17.04", "Soreang, Bandung", "Bandung", "MS-009", "2026-10-10", "pending", true, {
        bss: 70, cleanliness: 55, marketing: 62, grooming: 74, cx: 60
      }, 64.3, true, null),
      mkSeedVisit("VS-2026-1009-0028", "SPBU 34.16.03", "Tangerang", "Jabodetabek", "MS-014", "2026-10-09", "approved", true, {
        bss: 93, cleanliness: 88, marketing: 90, grooming: 94, cx: 89
      }, 91.5, false, "emailed"),
      mkSeedVisit("VS-2026-1015-0045", "SPBU 34.16.21", "Bogor", "Jabodetabek", "MS-003", "2026-10-15", "pending", false, {
        bss: 78, cleanliness: 60, marketing: 70, grooming: 72, cx: 66
      }, 66.9, false, null),
    ];
    localStorage.setItem(STORE_KEY, JSON.stringify(seed));
    return seed;
  }

  function mkSeedVisit(id, site, loc, cluster, shopper, date, status, hasCrit, cats, total, criticalFail, emailStatus) {
    const answers = {};
    // fabricate yes/no answers roughly matching target category %s for demo detail views
    Object.keys(CHECKLIST).forEach(catKey => {
      if (catKey === "recording") { answers.rec_start = "yes"; answers.rec_stop = "yes"; return; }
      const def = CHECKLIST[catKey];
      if (def.kind === "rating") {
        def.items.forEach(it => { answers[it.key] = String(Math.round((cats[catKey] / 100) * 5) || 4); });
        return;
      }
      const targetPct = cats[catKey];
      def.items.forEach((it, i) => {
        if (it.critical) { answers[it.key] = "yes"; return; } // critical items default pass; overridden below only for the intended critical-fail visits
        answers[it.key] = (i / def.items.length) * 100 < targetPct ? "yes" : "no";
      });
      if (criticalFail) {
        const critItem = def.items.find(it => it.critical);
        if (critItem) answers[critItem.key] = "no";
      }
    });
    const evidence = {};
    EVIDENCE_SLOTS.forEach(s => { evidence[s.key] = s.file; });
    return {
      id, site, location: loc, cluster, shopperId: shopper, visitDate: date,
      visitMode: "Mobil", submittedAt: date + "T18:20:00", status, // pending | approved | rejected
      emailStatus, // null | 'emailed'
      answers, evidence,
      notes: {
        observation: "Petugas kurang yakin menjelaskan syarat & ketentuan promo cashback saat ditanya pelanggan. Area toilet perlu perhatian tambahan pada jam ramai.",
        qc: status === "approved" ? "Bukti lengkap, sesuai checklist. Disetujui untuk laporan final." : ""
      },
      timing: { arrive: "14:02", startInteraction: "14:06", endInteraction: "14:11", depart: "14:13" },
      score: scoreVisit(answers)
    };
  }

  function getVisits() {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return seedVisits();
    try { return JSON.parse(raw); } catch (e) { return seedVisits(); }
  }

  function saveVisits(list) {
    localStorage.setItem(STORE_KEY, JSON.stringify(list));
  }

  function addVisit(visit) {
    const list = getVisits();
    list.unshift(visit);
    saveVisits(list);
    return visit;
  }

  function updateVisit(id, patch) {
    const list = getVisits();
    const idx = list.findIndex(v => v.id === id);
    if (idx === -1) return null;
    list[idx] = Object.assign({}, list[idx], patch);
    saveVisits(list);
    return list[idx];
  }

  function getVisit(id) {
    return getVisits().find(v => v.id === id) || null;
  }

  function resetDemoData() {
    localStorage.removeItem(STORE_KEY);
    return seedVisits();
  }

  function isMgmtUnlocked() {
    return sessionStorage.getItem(MGMT_PASS_KEY) === "1";
  }
  function tryMgmtLogin(pass) {
    if (pass === MGMT_PASSWORD) {
      sessionStorage.setItem(MGMT_PASS_KEY, "1");
      return true;
    }
    return false;
  }
  function mgmtLogout() {
    sessionStorage.removeItem(MGMT_PASS_KEY);
  }

  function toast(msg) {
    let el = document.querySelector(".toast");
    if (!el) {
      el = document.createElement("div");
      el.className = "toast";
      el.innerHTML = '<span class="dot"></span><span class="msg"></span>';
      document.body.appendChild(el);
    }
    el.querySelector(".msg").textContent = msg;
    el.classList.add("show");
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove("show"), 2600);
  }

  return {
    CHECKLIST, EVIDENCE_SLOTS, MGMT_PASSWORD,
    uid, scoreVisit, tierLabel,
    getVisits, saveVisits, addVisit, updateVisit, getVisit, resetDemoData,
    isMgmtUnlocked, tryMgmtLogin, mgmtLogout,
    toast
  };
})();
