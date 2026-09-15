(() => {
  const session = UC.requireSession("shopper", "mmp");
  if (!session) return;

  const userChip = document.getElementById("userChip");
  if (userChip) userChip.textContent = session.name;
  const logoutLink = document.getElementById("logoutLink");
  if (logoutLink) logoutLink.addEventListener("click", (e) => { e.preventDefault(); UC.logout(); window.location.href = "index.html"; });

  const host = document.getElementById("checklistHost");
  const evidenceStore = {}; // key -> dataURL
  const itemEvidenceStore = {}; // item key -> dataURL, for visual items answered "Tidak"

  function renderGroup(catKey, def, groupIndex) {
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
      def.items.forEach(it => body.appendChild(renderYesNo(catKey, it, true)));
      const note = document.createElement("div");
      note.className = "hint";
      note.textContent = "Rekaman video/audio dilampirkan otomatis sebagai bukti interaksi BSS sesuai kesepakatan. Penanganan consent/legal ditentukan manajemen sebelum fieldwork.";
      body.appendChild(note);
    } else if (def.kind === "yn") {
      def.items.forEach(it => body.appendChild(renderYesNo(catKey, it, false)));
    } else if (def.kind === "rating") {
      def.items.forEach(it => body.appendChild(renderRating(catKey, it)));
    }

    // evidence slots after the checklist inputs of category 1 (BSS) — matches SOW "evidence per visit"
    if (catKey === "bss") {
      body.appendChild(renderEvidenceBlock());
    }

    details.appendChild(body);
    host.appendChild(details);
  }

  function renderYesNo(catKey, it, isRecording) {
    const wrap = document.createElement("div");
    wrap.className = "field";
    const critTag = it.critical ? ' <span style="color:var(--bad); font-family:var(--font-mono); font-size:10px; text-transform:uppercase;">· zero-tolerance</span>' : "";
    const evidenceMarkup = it.visual ? `
      <div class="item-evidence" id="itemEvi_${it.key}" style="display:none;">
        <label class="item-evidence-box" for="itemEviInput_${it.key}"><span class="plus">+</span></label>
        <input type="file" accept="image/*" capture="environment" id="itemEviInput_${it.key}" data-key="${it.key}">
        <span class="item-evidence-hint"><span class="item-evidence-req">Wajib foto bukti</span>Lampirkan foto kondisi yang dimaksud karena jawaban "Tidak" pada kondisi fisik yang terlihat.</span>
      </div>` : "";
    const ref = UC.refFor(it.key);
    const refTag = ref ? `<span class="ref-tag">${ref}</span>` : "";
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
    wrap.querySelectorAll("input[type=radio]").forEach(r => r.addEventListener("change", onAnswerChange));

    if (it.visual) {
      const eviInput = wrap.querySelector(`#itemEviInput_${it.key}`);
      const eviWrap = wrap.querySelector(`#itemEvi_${it.key}`);
      const eviBox = wrap.querySelector(`.item-evidence-box`);
      eviInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          itemEvidenceStore[it.key] = reader.result;
          eviBox.innerHTML = `<img src="${reader.result}" alt="">`;
          eviWrap.classList.add("filled");
          markDirty();
          UC.toast("Foto bukti tersimpan");
        };
        reader.readAsDataURL(file);
      });
    }
    return wrap;
  }

  function renderRating(catKey, it) {
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
        markDirty();
      });
      rating.appendChild(b);
    }
    wrap.appendChild(rating);
    return wrap;
  }

  function renderEvidenceBlock() {
    const wrap = document.createElement("div");
    wrap.className = "field";
    wrap.innerHTML = `<label class="q">Bukti Foto / Video</label><span class="hint">Wajib diambil langsung dari kamera perangkat pada saat kunjungan — GPS &amp; timestamp otomatis dilampirkan.</span>`;
    const row = document.createElement("div");
    row.className = "evidence-row";
    UC.EVIDENCE_SLOTS.forEach(slot => {
      const s = document.createElement("div");
      s.className = "evidence-slot";
      s.innerHTML = `
        <label class="evidence-box" for="ev_${slot.key}"><span class="plus">+</span></label>
        <input type="file" accept="image/*,video/*" capture="environment" id="ev_${slot.key}" data-key="${slot.key}">
        <div class="lbl">${slot.label}</div>
      `;
      const input = s.querySelector("input");
      const box = s.querySelector(".evidence-box");
      input.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          evidenceStore[slot.key] = slot.file; // prototype: use bundled sample image regardless of upload, to keep demo lightweight
          box.innerHTML = `<img src="${slot.file}" alt=""><span class="evidence-badge">✓ ${new Date().toLocaleTimeString("id-ID",{hour:'2-digit',minute:'2-digit'})}</span>`;
          markDirty();
          UC.toast(slot.label + " tersimpan");
        };
        reader.readAsDataURL(file);
      });
      row.appendChild(s);
    });
    wrap.appendChild(row);
    return wrap;
  }

  function onAnswerChange() {
    markDirty();
    checkCritical();
    refreshItemEvidenceVisibility();
  }

  function refreshItemEvidenceVisibility() {
    document.querySelectorAll(".item-evidence").forEach(eviWrap => {
      const key = eviWrap.id.replace("itemEvi_", "");
      const checked = document.querySelector(`input[name="${key}"]:checked`);
      if (checked && checked.value === "no") {
        eviWrap.style.display = "flex";
      } else {
        eviWrap.style.display = "none";
      }
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
    if (failed.length) {
      alertHost.innerHTML = `
        <div class="crit-flag">
          <div>
            <b>Critical Failure Terdeteksi</b>
            Item zero-tolerance gagal: ${failed.join(", ")}. Notifikasi otomatis akan dikirim ke manajemen (WhatsApp dan/atau email, sesuai kebijakan yang difinalisasi manajemen) begitu form ini dikirim.
          </div>
        </div>`;
    } else {
      alertHost.innerHTML = "";
    }
  }

  function markDirty() {
    document.getElementById("draftStatus").textContent = "Draf tersimpan otomatis · " + new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
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

  function buildChecklist() {
    Object.entries(UC.CHECKLIST).forEach(([key, def], i) => renderGroup(key, def, i + 1));
  }

  buildChecklist();

  document.getElementById("saveDraftBtn").addEventListener("click", () => {
    markDirty();
    UC.toast("Draf disimpan di perangkat");
  });

  function findMissingVisualEvidence(answers) {
    const missing = [];
    Object.values(UC.CHECKLIST).forEach(def => {
      if (def.kind !== "yn") return;
      def.items.forEach(it => {
        if (it.visual && answers[it.key] === "no" && !itemEvidenceStore[it.key]) {
          missing.push(it);
        }
      });
    });
    return missing;
  }

  document.getElementById("visitForm").addEventListener("submit", (e) => {
    e.preventDefault();
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

    const score = UC.scoreVisit(answers);
    const [site, location, cluster] = document.getElementById("f_site").value.split("|");
    const shopperId = document.getElementById("f_shopperId").value;
    const mode = document.querySelector('input[name="f_mode"]:checked').value;
    const now = new Date();

    const evidence = {};
    UC.EVIDENCE_SLOTS.forEach(s => { evidence[s.key] = evidenceStore[s.key] || s.file; });

    const itemEvidence = {};
    Object.values(UC.CHECKLIST).forEach(def => {
      if (def.kind !== "yn") return;
      def.items.forEach(it => {
        if (it.visual && answers[it.key] === "no" && itemEvidenceStore[it.key]) {
          itemEvidence[it.key] = itemEvidenceStore[it.key];
        }
      });
    });

    const visit = {
      id: UC.uid("VS-" + now.getFullYear()),
      site, location, cluster, shopperId,
      visitMode: mode,
      visitDate: now.toISOString().slice(0, 10),
      submittedAt: now.toISOString(),
      status: "pending",
      emailStatus: null,
      answers,
      evidence,
      itemEvidence,
      notes: { observation: document.getElementById("f_observation").value, qc: "" },
      timing: { arrive: "—", startInteraction: "—", endInteraction: "—", depart: "—" },
      score
    };
    UC.addVisit(visit);
    UC.toast("Kunjungan dikirim untuk review QC");
    setTimeout(() => { window.location.href = "qc.html?highlight=" + visit.id; }, 700);
  });

  checkCritical();
})();
