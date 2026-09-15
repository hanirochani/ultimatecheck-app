/* ==========================================================================
   UltimateCheck — Internal Tool prototype data layer
   Functional prototype only: all data lives in localStorage in the browser.
   No real backend, auth, database, WhatsApp or email sending is wired up.
   ========================================================================== */

const UC = (() => {

  const STORE_KEY = "uc_visits_v1";
  const SESSION_KEY = "uc_session_v1";

  // ---- Individual user accounts (prototype-only; passwords stored in client code) ----
  // Username pattern: shopper01..shopper25, quality01..quality05, management01..management05.
  function pad2(n) { return String(n).padStart(2, "0"); }
  const USERS = {};
  for (let i = 1; i <= 25; i++) {
    const id = "shopper" + pad2(i);
    USERS[id] = { password: "APRshop" + pad2(i) + "#2026", role: "shopper", name: "Shopper " + pad2(i) };
  }
  for (let i = 1; i <= 5; i++) {
    const id = "quality" + pad2(i);
    USERS[id] = { password: "APRqc" + pad2(i) + "#2026", role: "qc", name: "QC Reviewer " + pad2(i) };
  }
  for (let i = 1; i <= 5; i++) {
    const id = "management" + pad2(i);
    USERS[id] = { password: "APRmgt" + pad2(i) + "#2026", role: "management", name: "Manajemen " + pad2(i) };
  }

  const ROLE_LABEL = { shopper: "Shopper", qc: "Quality Checker", management: "Management" };
  const PROGRAM_LABEL = { training: "Training", mmp: "Mystery Motorist Program" };

  function login(username, password, role, program) {
    const u = USERS[username];
    if (!u) return { ok: false, error: "Username tidak ditemukan." };
    if (u.password !== password) return { ok: false, error: "Kata sandi salah." };
    if (u.role !== role) return { ok: false, error: `Username ini terdaftar sebagai ${ROLE_LABEL[u.role]}, bukan ${ROLE_LABEL[role]}.` };
    if (role === "management" && program === "training") return { ok: false, error: "Management tidak memiliki akses ke Training." };
    const session = { username, role, program, name: u.name };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return { ok: true, session };
  }

  function getSession() {
    try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)); } catch (e) { return null; }
  }

  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
  }

  // Redirects to index.html if there is no valid session matching the required role/program.
  // Returns the session object when valid (call this at the top of every protected page).
  function requireSession(role, program) {
    const s = getSession();
    if (!s || s.role !== role || s.program !== program) {
      window.location.href = "index.html";
      return null;
    }
    return s;
  }

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
        { key: "cl_forecourt", label: "Area forecourt bersih & bebas sampah", visual: true },
        { key: "cl_dispenser", label: "Dispenser & nozzle bersih, tidak bocor", critical: true, visual: true },
        { key: "cl_signage", label: "Signage harga terpasang & terbaca jelas", visual: true },
        { key: "cl_canopy", label: "Kanopi & pencahayaan berfungsi baik", visual: true },
        { key: "cl_toilet_clean", label: "Toilet bersih & tisu tersedia", visual: true },
        { key: "cl_toilet_water", label: "Air & sabun tersedia di toilet", visual: true },
        { key: "cl_musholla", label: "Musholla bersih & rapi (jika tersedia)", visual: true },
        { key: "cl_parking", label: "Area parkir rapi & tertata", visual: true },
        { key: "cl_trash", label: "Tempat sampah tersedia & tidak penuh", visual: true },
        { key: "cl_landscape", label: "Taman / area hijau terawat", visual: true },
        { key: "cl_safety_signage", label: "Signage keselamatan (dilarang merokok, dsb) lengkap", critical: true, visual: true },
        { key: "cl_fire", label: "APAR tersedia & mudah dijangkau", critical: true, visual: true },
      ]
    },
    marketing: {
      title: "3. Marketing & Promotional Execution", weight: 20, kind: "yn",
      items: [
        { key: "mk_pop", label: "Materi promosi terpasang sesuai panduan (POP)", visual: true },
        { key: "mk_poc", label: "Materi POC terpasang di titik komunikasi", visual: true },
        { key: "mk_condition", label: "Materi promosi dalam kondisi baik (tidak rusak/pudar)", visual: true },
        { key: "mk_campaign", label: "Kampanye aktif ter-display sesuai periode", visual: true },
        { key: "mk_pricing", label: "Informasi harga & promo konsisten dengan pusat", visual: true },
        { key: "mk_branding", label: "Branding & identitas visual sesuai standar", visual: true },
        { key: "mk_loyalty", label: "Program loyalti ditawarkan / disebutkan" },
      ]
    },
    grooming: {
      title: "4. Grooming & Uniform", weight: 15, kind: "yn",
      items: [
        { key: "gr_uniform", label: "Seragam lengkap & rapi", visual: true },
        { key: "gr_nametag", label: "Name tag terpasang & terbaca", visual: true },
        { key: "gr_grooming", label: "Grooming rapi (rambut, kuku, dsb)", visual: true },
        { key: "gr_shoes", label: "Sepatu safety sesuai standar", critical: true, visual: true },
        { key: "gr_hygiene", label: "Kebersihan diri terjaga", visual: true },
        { key: "gr_accessories", label: "Aksesoris sesuai ketentuan (tidak berlebihan)", visual: true },
        { key: "gr_id", label: "ID card / atribut identitas terpasang", visual: true },
        { key: "gr_posture", label: "Postur & sikap tubuh profesional", visual: true },
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

  // ---- Question reference codes (matches the PDF Site Report's "Ref" column, e.g. "2a") ----
  // Category order/number follows the SOW weighting sections 1-5; recording (category "0") is unlettered.
  const REF_CAT_NUMBER = { bss: 1, cleanliness: 2, marketing: 3, grooming: 4, cx: 5 };
  const ITEM_REF = {};
  Object.entries(REF_CAT_NUMBER).forEach(([catKey, num]) => {
    CHECKLIST[catKey].items.forEach((it, i) => {
      ITEM_REF[it.key] = num + String.fromCharCode(97 + i); // 97 = 'a'
    });
  });
  function refFor(itemKey) { return ITEM_REF[itemKey] || ""; }

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

  /* ======================================================================
     Training module — pre-deployment practice tests for shoppers.
     Shoppers complete up to 5 tests using the same field-visit form (incl.
     check-in/out + geo-tagged evidence). QC uploads the correct "answer
     key" per test; sessions are auto-scored (% items matching the key)
     once a key exists. Passing = at least 3 of 5 tests scored 100.
     ====================================================================== */
  const TRAINING_KEYS_KEY = "uc_training_keys_v1";
  const TRAINING_SESSIONS_KEY = "uc_training_sessions_v1";
  const TRAINING_TEST_IDS = ["test1", "test2", "test3", "test4", "test5"];
  const TRAINING_PASS_MIN_PERFECT = 3;
  const TRAINING_TOTAL_TESTS = 5;

  // All yn + rating items across every category, in the same order as the Ref codes — this is what a
  // training test scores against (the "recording" category is procedural only and isn't scored).
  const TRAINING_SCORABLE_ITEMS = [];
  ["bss", "cleanliness", "marketing", "grooming", "cx"].forEach(catKey => {
    CHECKLIST[catKey].items.forEach(it => TRAINING_SCORABLE_ITEMS.push({ catKey, key: it.key, kind: CHECKLIST[catKey].kind }));
  });

  function getTrainingKeys() {
    try { return JSON.parse(localStorage.getItem(TRAINING_KEYS_KEY)) || {}; } catch (e) { return {}; }
  }
  function getTrainingKey(testId) {
    return getTrainingKeys()[testId] || null;
  }
  // mediaByItem (optional): { [itemKey]: dataURL } — QC-authored reference photo/video shown
  // alongside the answer key item (video for BSS, photo for other visual items). Reference-only,
  // never affects scoring (scoreAgainstKey below only ever compares `answers`).
  function saveTrainingKey(testId, answers, savedByName, mediaByItem) {
    const keys = getTrainingKeys();
    const existing = keys[testId];
    keys[testId] = {
      answers,
      media: mediaByItem || (existing && existing.media) || {},
      savedBy: savedByName,
      savedAt: new Date().toISOString()
    };
    localStorage.setItem(TRAINING_KEYS_KEY, JSON.stringify(keys));
    // Rescore any sessions already submitted for this test now that a key exists/changed.
    const sessions = getTrainingSessions();
    let changed = false;
    sessions.forEach(s => {
      if (s.testId === testId) { s.score = scoreAgainstKey(s.answers, answers); changed = true; }
    });
    if (changed) saveTrainingSessions(sessions);
    return keys[testId];
  }

  function scoreAgainstKey(answers, keyAnswers) {
    let correct = 0, total = 0;
    TRAINING_SCORABLE_ITEMS.forEach(it => {
      const key = keyAnswers[it.key];
      if (key === undefined || key === null || key === "") return; // key not defined for this item — don't count it
      total++;
      if (String(answers[it.key]) === String(key)) correct++;
    });
    const pct = total ? Math.round((correct / total) * 1000) / 10 : 0;
    return { correct, total, pct };
  }

  function getTrainingSessions() {
    try { return JSON.parse(localStorage.getItem(TRAINING_SESSIONS_KEY)) || []; } catch (e) { return []; }
  }
  function saveTrainingSessions(list) {
    localStorage.setItem(TRAINING_SESSIONS_KEY, JSON.stringify(list));
  }
  function addTrainingSession(session) {
    const key = getTrainingKey(session.testId);
    session.score = key ? scoreAgainstKey(session.answers, key.answers) : null;
    const list = getTrainingSessions();
    list.unshift(session);
    saveTrainingSessions(list);
    return session;
  }
  function getTrainingSession(id) {
    return getTrainingSessions().find(s => s.id === id) || null;
  }
  function getTrainingSessionsForShopper(username) {
    return getTrainingSessions().filter(s => s.shopperUsername === username);
  }
  function getShopperTrainingSummary(username) {
    const sessions = getTrainingSessionsForShopper(username).sort((a, b) => a.testId.localeCompare(b.testId));
    const scored = sessions.filter(s => s.score);
    const perfectCount = scored.filter(s => s.score.pct === 100).length;
    const pass = perfectCount >= TRAINING_PASS_MIN_PERFECT;
    return {
      username, attempts: sessions.length, totalTests: TRAINING_TOTAL_TESTS,
      perfectCount, needed: TRAINING_PASS_MIN_PERFECT, pass, sessions
    };
  }
  function getAllShopperTrainingSummaries() {
    return Object.keys(USERS)
      .filter(u => USERS[u].role === "shopper")
      .map(u => Object.assign({ name: USERS[u].name }, getShopperTrainingSummary(u)));
  }

  // Best-effort geolocation capture for training check-in/out + evidence; never blocks on permission issues.
  function captureGeo() {
    return new Promise(resolve => {
      if (!navigator.geolocation) return resolve(null);
      const timer = setTimeout(() => resolve(null), 5000);
      navigator.geolocation.getCurrentPosition(
        pos => { clearTimeout(timer); resolve({ lat: Math.round(pos.coords.latitude * 1e5) / 1e5, lng: Math.round(pos.coords.longitude * 1e5) / 1e5 }); },
        () => { clearTimeout(timer); resolve(null); },
        { timeout: 4500, maximumAge: 60000 }
      );
    });
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
    CHECKLIST, EVIDENCE_SLOTS,
    USERS, ROLE_LABEL, PROGRAM_LABEL, login, getSession, logout, requireSession,
    refFor,
    uid, scoreVisit, tierLabel,
    getVisits, saveVisits, addVisit, updateVisit, getVisit, resetDemoData,
    TRAINING_TEST_IDS, TRAINING_PASS_MIN_PERFECT, TRAINING_TOTAL_TESTS, TRAINING_SCORABLE_ITEMS,
    getTrainingKey, saveTrainingKey, scoreAgainstKey,
    getTrainingSessions, addTrainingSession, getTrainingSession, getTrainingSessionsForShopper,
    getShopperTrainingSummary, getAllShopperTrainingSummaries, captureGeo,
    toast
  };
})();
