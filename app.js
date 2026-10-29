"use strict";
const KEY = "etoll_pwa_v1";
const TYP = { TOLL: "Tol", TOPUP: "Top-up", OTHER: "Lainnya" };
const SRC = { MANUAL: "Input manual", ESTIMASI: "Estimasi (dikonfirmasi pengguna)", IMPOR: "Diimpor", DEMO: "DATA DEMO", TERVERIFIKASI: "Terverifikasi" };

let db = { txns: [], snaps: [], seq: 1 };
try { const r = localStorage.getItem(KEY); if (r) db = JSON.parse(r); } catch (e) {}
let ui = { edit: null, preset: "TOLL" }, pend = null, flt = { q: "", p: "0", ty: "" }, deferred = null;

const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { toast("Gagal menyimpan data"); } };
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const p2 = n => String(n).padStart(2, "0");
const fmtIn = d => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
const now = () => fmtIn(new Date());
const rp = v => v == null ? "—" : (v < 0 ? "-" : "") + "Rp" + Math.abs(v).toLocaleString("id-ID");
const valid = s => /^\d{4}-\d\d-\d\d \d\d:\d\d$/.test(s || "");
const tgl = s => valid(s) ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)} ${s.slice(11)}` : "Tidak tersedia";
const cleanTime = v => { const s = (v || "").replace("T", " "); return valid(s) ? s : null; };
const duration = (t, tin) => {
  if (!valid(t) || !valid(tin)) return "Tidak tersedia";
  const m = Math.round((new Date(t.replace(" ", "T")) - new Date(tin.replace(" ", "T"))) / 60000);
  return m < 0 ? "Tidak tersedia" : `${Math.floor(m / 60)} jam ${m % 60} menit`;
};
function toast(m) {
  const t = $("#toast"); t.textContent = m; t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2500);
}
function add(t) {
  if (db.txns.some(x => x.dedupe === t.dedupe)) return false;
  t.id = db.seq++; db.txns.push(t); save(); return true;
}
const mk = (o) => Object.assign({ card: "", gate_in: "", gate_out: "", time_in: null, bal_before: null, bal_after: null, note: "" }, o);

function summary() {
  const t = db.txns;
  const s = db.snaps.filter(x => x.balance != null).sort((a, b) => a.time.localeCompare(b.time) || a.id - b.id);
  const first = s[0], last = s[s.length - 1];
  const sum = (a, f) => a.filter(f).reduce((n, x) => n + x.amount, 0);
  const top = x => x.type === "TOPUP", oth = x => x.type !== "TOPUP";
  let calc = null, diff = null;
  if (first) {
    const rel = t.filter(x => x.time >= first.time);
    calc = first.balance + sum(rel, top) - sum(rel, oth);
    diff = last.balance - calc;
  }
  const mo = now().slice(0, 7);
  return { initial: first ? first.balance : null, actual: last ? last.balance : null, income: sum(t, top), expense: sum(t, oth),
    calc, diff, trips: t.filter(x => x.type === "TOLL").length, month: sum(t, x => oth(x) && x.time.startsWith(mo)) };
}

function vHome() {
  const s = summary();
  return `<h1>e-Toll Tracker Indonesia</h1>
<p class="muted">Status NFC: tidak tersedia di versi web (pembacaan kartu e-money hanya bisa lewat aplikasi Android native). Saldo dimasukkan manual.</p>
<div class="hero"><small>Saldo terakhir yang dicatat</small><big>${rp(s.actual)}</big><small>Saldo awal: ${rp(s.initial)}</small>
${s.calc != null ? `<small>Saldo hitungan (estimasi): ${rp(s.calc)}</small>` : ""}
${s.diff ? `<small>⚠ Selisih ${rp(s.diff)}: ada transaksi belum tercatat atau data belum lengkap.</small>` : ""}</div>
<div class="grid"><div class="card"><small>Total pemasukan</small><b>${rp(s.income)}</b></div>
<div class="card"><small>Total pengeluaran</small><b>${rp(s.expense)}</b></div>
<div class="card"><small>Jumlah perjalanan</small><b>${s.trips}</b></div>
<div class="card"><small>Pengeluaran bulan ini</small><b>${rp(s.month)}</b></div></div>
<a class="btn big" href="#scan">Catat Saldo Kartu</a>
<a class="btn alt" href="#catat" data-act="newTopup">Catat Top-Up</a>
<a class="btn alt" href="#riwayat">Riwayat Perjalanan</a>
<a class="btn alt" href="#scan">Lihat Detail Kartu</a>`;
}

function vScan() {
  const snaps = db.snaps.slice().reverse().slice(0, 10);
  return `<h1>Catat Saldo Kartu</h1>
<p class="muted">Browser tidak dapat membaca saldo kartu e-money lewat NFC. Lihat saldo di mesin/aplikasi bank, lalu masukkan di sini sebagai snapshot.</p>
${pend ? `<div class="card warn"><b>Saldo berubah</b> ${rp(pend.before)} → ${rp(pend.after)}.
Jenis transaksi tidak dapat dipastikan. Klasifikasikan (dicatat sebagai estimasi):
<div class="row"><button data-act="klas" data-t="TOLL">Transaksi tol</button><button data-act="klas" data-t="TOPUP">Top-up</button>
<button data-act="klas" data-t="OTHER">Lainnya</button></div><button class="alt" data-act="skip">Abaikan</button></div>` : ""}
<form data-f="snap" class="card"><label>Nama kartu<input name="card" placeholder="mis. Kartu tol saya"></label>
<label>Saldo saat ini (Rp)<input name="balance" inputmode="numeric" pattern="[0-9]*" required></label>
<button class="big">Simpan Snapshot Saldo</button></form>
<h2>Snapshot terakhir</h2>
${snaps.map(x => `<div class="card"><b>${rp(x.balance)}</b> • ${esc(x.card)}<br><small>${tgl(x.time)} • ${esc(x.note)}</small></div>`).join("") || '<p class="muted">Belum ada snapshot.</p>'}`;
}

function vRiwayat() {
  const n = new Date(), lim = { "1": now().slice(0, 10), "2": fmtIn(new Date(n - 7 * 864e5)), "3": now().slice(0, 7) }[flt.p] || "";
  const q = flt.q.toLowerCase();
  const rows = db.txns.filter(r => r.time >= lim && (!flt.ty || r.type === flt.ty) &&
    (!q || [r.gate_in, r.gate_out, r.card, r.note, r.amount].join(" ").toLowerCase().includes(q)))
    .sort((a, b) => b.time.localeCompare(a.time));
  const opt = (v, l, cur) => `<option value="${v}" ${cur === v ? "selected" : ""}>${l}</option>`;
  return `<h1>Riwayat Perjalanan Tol</h1>
<form data-f="filter" class="card"><input name="q" value="${esc(flt.q)}" placeholder="Cari gerbang, kartu, nominal">
<div class="row"><select name="p">${opt("0", "Semua waktu", flt.p)}${opt("1", "Hari ini", flt.p)}${opt("2", "7 hari", flt.p)}${opt("3", "Bulan ini", flt.p)}</select>
<select name="ty">${opt("", "Semua jenis", flt.ty)}${Object.entries(TYP).map(([k, l]) => opt(k, l, flt.ty)).join("")}</select>
<button>Filter</button></div></form>
<a class="btn alt" href="#catat" data-act="newToll">+ Tambah catatan</a>
${rows.map(r => `<details class="card"><summary><b>${TYP[r.type]}</b> <span class="amt ${r.type === "TOPUP" ? "in" : ""}">${r.type === "TOPUP" ? "+" : "-"}${rp(r.amount)}</span><br>
${r.type === "TOLL" ? `${esc(r.gate_in || "?")} → ${esc(r.gate_out || "?")}<br>` : ""}<small>${tgl(r.time)} • ${SRC[r.source]}</small></summary>
<p>Gerbang masuk: ${esc(r.gate_in || "Tidak tersedia")}<br>Waktu masuk: ${tgl(r.time_in)}<br>Gerbang keluar: ${esc(r.gate_out || "Tidak tersedia")}<br>
Waktu keluar/transaksi: ${tgl(r.time)}<br>Lama perjalanan: ${duration(r.time, r.time_in)}<br>
Saldo sebelum: ${rp(r.bal_before)}<br>Saldo sesudah: ${rp(r.bal_after)}<br>Sumber: ${SRC[r.source]}<br>
Validasi: ${r.source === "TERVERIFIKASI" ? "Terverifikasi" : "Belum terverifikasi dari sumber resmi"}<br>${r.note ? "Catatan: " + esc(r.note) : ""}</p>
<div class="row"><a class="btn alt" href="#catat" data-act="edit" data-id="${r.id}">Edit</a><button class="danger" data-act="del" data-id="${r.id}">Hapus</button></div></details>`).join("")
    || '<p class="muted">Belum ada catatan. Tambahkan, atau muat data demo di Pengaturan.</p>'}`;
}

function vForm() {
  const r = ui.edit ? db.txns.find(x => x.id === ui.edit) : null, cur = r ? r.type : ui.preset || "TOLL";
  return `<h1>${r ? "Edit" : "Tambah"} Catatan</h1><form data-f="catat" class="card">
<label>Jenis<select name="type">${Object.entries(TYP).map(([k, l]) => `<option value="${k}" ${cur === k ? "selected" : ""}>${l}</option>`).join("")}</select></label>
<label>Nominal (Rp)<input name="amount" inputmode="numeric" pattern="[0-9]*" value="${r ? r.amount : ""}" required></label>
<label>Waktu transaksi/keluar<input type="datetime-local" name="time" value="${(r ? r.time : now()).replace(" ", "T")}"></label>
<label>Gerbang masuk (opsional, jenis Tol)<input name="gate_in" value="${esc(r ? r.gate_in : "")}"></label>
<label>Waktu masuk (opsional)<input type="datetime-local" name="time_in" value="${r && r.time_in ? r.time_in.replace(" ", "T") : ""}"></label>
<label>Gerbang keluar (opsional)<input name="gate_out" value="${esc(r ? r.gate_out : "")}"></label>
<label>Catatan sumber<input name="note" value="${esc(r ? r.note : "")}"></label>
<button class="big">Simpan</button><a class="btn alt" href="#riwayat">Batal</a></form>`;
}

function bars(d) {
  const m = Math.max(1, ...d.map(x => x[1]));
  return `<div class="bars">${d.map(([l, v]) => `<div><small>${v ? Math.floor(v / 1000) + "rb" : ""}</small><i style="height:${Math.round(v / m * 100)}%"></i><small>${l}</small></div>`).join("")}</div>`;
}
function vStat() {
  const rows = db.txns.filter(x => x.type !== "TOPUP"), n = new Date();
  const daily = [6, 5, 4, 3, 2, 1, 0].map(i => {
    const d = new Date(n - i * 864e5), k = fmtIn(d).slice(0, 10);
    return [`${p2(d.getDate())}/${p2(d.getMonth() + 1)}`, rows.filter(r => r.time.startsWith(k)).reduce((a, r) => a + r.amount, 0)];
  });
  const monthly = [5, 4, 3, 2, 1, 0].map(i => {
    const d = new Date(n.getFullYear(), n.getMonth() - i, 1), k = `${d.getFullYear()}-${p2(d.getMonth() + 1)}`;
    return [`${p2(d.getMonth() + 1)}/${String(d.getFullYear()).slice(2)}`, rows.filter(r => r.time.startsWith(k)).reduce((a, r) => a + r.amount, 0)];
  });
  const tolls = rows.filter(r => r.type === "TOLL");
  const avg = tolls.length ? Math.floor(tolls.reduce((a, r) => a + r.amount, 0) / tolls.length) : null;
  return `<h1>Statistik</h1><div class="card"><small>Rata-rata biaya tol per perjalanan</small><b>${rp(avg)}</b></div>
<h2>Pengeluaran 7 hari terakhir</h2>${bars(daily)}<h2>Pengeluaran 6 bulan terakhir</h2>${bars(monthly)}`;
}

function vSet() {
  return `<h1>Pengaturan</h1>
${deferred ? '<button data-act="install">Pasang aplikasi di HP</button>' : '<p class="muted">Untuk memasang: menu ⋮ Chrome → Instal aplikasi.</p>'}
<button data-act="csv">Ekspor CSV</button><button class="alt" data-act="print">Cetak / Simpan PDF (lewat browser)</button>
<button class="alt" data-act="demo">Muat data demo (berlabel DEMO)</button><button class="alt" data-act="delDemo">Hapus data demo saja</button>
<button class="danger" data-act="delAll">Hapus seluruh data lokal</button>
<p class="muted">Privasi: data hanya tersimpan di browser/HP ini. Tidak ada PIN/kunci kartu, lokasi, atau pengiriman ke server.
Menghapus data situs Chrome akan menghapus catatan; ekspor CSV secara berkala sebagai cadangan.</p>`;
}

const views = { beranda: vHome, scan: vScan, riwayat: vRiwayat, catat: vForm, statistik: vStat, pengaturan: vSet };
function render(keepScroll) {
  const r = (location.hash || "#beranda").slice(1), v = views[r] || vHome;
  $("#app").innerHTML = v();
  document.querySelectorAll("nav a").forEach(a => a.classList.toggle("on", a.getAttribute("href") === "#" + (r === "catat" ? "riwayat" : r)));
  if (!keepScroll) window.scrollTo(0, 0);
}
addEventListener("hashchange", () => render(false));

const forms = {
  snap(f) {
    const raw = (f.get("balance") || "").trim(), card = (f.get("card") || "").trim() || "Kartu e-money";
    if (!/^\d+$/.test(raw)) return toast("Masukkan saldo berupa angka.");
    const bal = +raw, prev = db.snaps.filter(x => x.card === card && x.balance != null).pop();
    db.snaps.push({ id: db.seq++, time: now(), card, balance: bal, note: "Dimasukkan pengguna" }); save();
    if (prev && prev.balance !== bal) pend = { before: prev.balance, after: bal, card };
    else toast("Snapshot saldo disimpan.");
    render(true);
  },
  filter(f) { flt = { q: f.get("q") || "", p: f.get("p") || "0", ty: f.get("ty") || "" }; render(true); },
  catat(f) {
    const typ = TYP[f.get("type")] ? f.get("type") : "TOLL", raw = (f.get("amount") || "").trim();
    if (!/^\d+$/.test(raw) || +raw <= 0) return toast("Nominal harus angka lebih dari 0.");
    const a = +raw, t = cleanTime(f.get("time")) || now(), toll = typ === "TOLL";
    const gin = toll ? (f.get("gate_in") || "").trim() : "", gout = toll ? (f.get("gate_out") || "").trim() : "";
    const tin = toll ? cleanTime(f.get("time_in")) : null, note = f.get("note") || "";
    const key = `M|${typ}|${a}|${t}|${gin}|${gout}`;
    if (ui.edit) {
      const r = db.txns.find(x => x.id === ui.edit);
      if (db.txns.some(x => x.dedupe === key && x.id !== r.id)) return toast("Catatan duplikat ditolak.");
      Object.assign(r, { type: typ, amount: a, time: t, gate_in: gin, gate_out: gout, time_in: tin, note, dedupe: key }); save();
    } else if (!add(mk({ type: typ, amount: a, time: t, source: "MANUAL", gate_in: gin, gate_out: gout, time_in: tin, note, dedupe: key })))
      toast("Catatan duplikat diabaikan.");
    location.hash = "#riwayat";
  }
};
document.addEventListener("submit", e => {
  e.preventDefault();
  const h = forms[e.target.dataset.f];
  if (h) h(new FormData(e.target));
});

function demo() {
  [11000, 22500, 8500, 17000, 13500, 22500].forEach((a, i) => {
    const d = new Date(); d.setDate(d.getDate() - (i + 1));
    add(mk({ type: "TOLL", amount: a, time: fmtIn(d), source: "DEMO", gate_in: `Gerbang Demo ${String.fromCharCode(65 + i)}`,
      gate_out: `Gerbang Demo ${String.fromCharCode(66 + i)}`, time_in: fmtIn(new Date(d - 45 * 60000)), note: "DATA DEMO", dedupe: "D|" + i }));
  });
  const d = new Date(); d.setDate(d.getDate() - 7);
  add(mk({ type: "TOPUP", amount: 200000, time: fmtIn(d), source: "DEMO", note: "DATA DEMO", dedupe: "D|topup" }));
}
function csv() {
  const q = s => '"' + String(s == null ? "" : s).replace(/"/g, '""') + '"';
  const head = ["Waktu", "Jenis", "Nominal", "Sumber", "Gerbang Masuk", "Waktu Masuk", "Gerbang Keluar", "Saldo Sebelum", "Saldo Sesudah", "Catatan"];
  const lines = db.txns.slice().sort((a, b) => b.time.localeCompare(a.time)).map(r =>
    [r.time, TYP[r.type], r.amount, SRC[r.source], r.gate_in, r.time_in || "", r.gate_out, r.bal_before == null ? "" : r.bal_before, r.bal_after == null ? "" : r.bal_after, r.note].map(q).join(","));
  const url = URL.createObjectURL(new Blob(["\ufeff" + [head.map(q).join(","), ...lines].join("\n")], { type: "text/csv" }));
  const a = document.createElement("a"); a.href = url; a.download = "riwayat-etoll.csv"; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

document.addEventListener("click", e => {
  const el = e.target.closest("[data-act]");
  if (!el) return;
  const a = el.dataset.act, id = Number(el.dataset.id);
  if (a === "newTopup") ui = { edit: null, preset: "TOPUP" };
  else if (a === "newToll") ui = { edit: null, preset: "TOLL" };
  else if (a === "edit") ui = { edit: id, preset: null };
  else if (a === "del") { if (confirm("Hapus catatan ini?")) { db.txns = db.txns.filter(x => x.id !== id || x.source === "TERVERIFIKASI"); save(); render(true); } }
  else if (a === "klas") {
    if (!pend) return;
    const t = now();
    add(mk({ type: el.dataset.t, amount: Math.abs(pend.after - pend.before), time: t, source: "ESTIMASI", card: pend.card,
      bal_before: pend.before, bal_after: pend.after, note: "Dari perubahan saldo, dikonfirmasi pengguna", dedupe: `E|${pend.before}|${pend.after}|${t}` }));
    pend = null; render(true);
  }
  else if (a === "skip") { pend = null; render(true); }
  else if (a === "demo") { demo(); toast("Data demo dimuat."); render(true); }
  else if (a === "delDemo") { db.txns = db.txns.filter(x => x.source !== "DEMO"); save(); toast("Data demo dihapus."); }
  else if (a === "delAll") { if (confirm("Hapus SEMUA data lokal?")) { db = { txns: [], snaps: [], seq: 1 }; save(); pend = null; toast("Seluruh data dihapus."); } }
  else if (a === "csv") csv();
  else if (a === "print") window.print();
  else if (a === "install" && deferred) { deferred.prompt(); deferred = null; render(true); }
});

addEventListener("beforeinstallprompt", e => { e.preventDefault(); deferred = e; });
if ("serviceWorker" in navigator) addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
render(false);
