/* KB-JPS Android (HTML-only) – Offline-first (IndexedDB) – Waktu Malaysia (Asia/Kuala_Lumpur)
   Nota: Ini versi ringan untuk Android/Pydroid 3. Semua data disimpan secara REAL dalam IndexedDB telefon.
*/
(() => {
  "use strict";

  const KBJPS = {};
  window.KBJPS = KBJPS;

  // ----------------------------
  // Config
  // ----------------------------
  const DB_NAME = "kbjps_android_v4";
  const DB_VERSION = 2;

  \1

  // =================== ONLINE MODE (REAL SERVER) ===================
  // Set API base URL (example: https://api-kbjps.example.com).
  // You can override in runtime: localStorage.setItem("kbjps_api_base","https://..."); location.reload();
  const API_BASE = (localStorage.getItem("kbjps_api_base") || "").trim().replace(/\/+$/,"");
  const ONLINE_ENABLED = !!API_BASE;

  async function apiFetch(path, opts = {}) {
    const url = API_BASE + path;
    const headers = Object.assign({ "Content-Type": "application/json" }, (opts.headers || {}));
    const token = localStorage.getItem("kbjps_jwt");
    if (token) headers["Authorization"] = "Bearer " + token;
    const res = await fetch(url, Object.assign({}, opts, { headers }));
    let data = null;
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      data = await res.json().catch(() => null);
    } else {
      data = await res.text().catch(() => null);
    }
    if (!res.ok) {
      const msg = (data && data.message) ? data.message : ("HTTP " + res.status);
      const err = new Error(msg);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  function setOnlineBase(url) {
    if (!url) localStorage.removeItem("kbjps_api_base");
    else localStorage.setItem("kbjps_api_base", String(url).trim().replace(/\/+$/,""));
  }

  // Helper for online auth/user cache
  function setAuthSession(token, user) {
    if (token) localStorage.setItem("kbjps_jwt", token);
    if (user) localStorage.setItem("kbjps_loggedInUser", JSON.stringify(user));
  }
  function clearAuthSession() {
    localStorage.removeItem("kbjps_jwt");
    localStorage.removeItem("kbjps_loggedInUser");
  }

const LS_USER = "kbjps_loggedInUser";
  const LS_TOKEN = "kbjps_jwt"; // token ringkas (offline)

  // Stores
  const STORE_USERS = "users";
  const STORE_ACTIVITIES = "activities";
  const STORE_INVITATIONS = "invitations";
  const STORE_NOTIFICATIONS = "notifications";
  const STORE_AUDIT = "audit";
  const STORE_RESETS = "resets";
  const STORE_MASTER = "master";
  const STORE_ATTACHMENTS = "attachments";
  const STORE_NEWS = "news";
  const STORE_AI = "ai";

  // ----------------------------
  // Helpers
  // ----------------------------
  function nowMY() {
    // Date object is local; format display in MY timezone for logs.
    return new Date();
  }

  function myTimestamp() {
    return nowMY().toLocaleString("en-MY", { timeZone: TZ });
  }

  function pad2(n) { return String(n).padStart(2, "0"); }

  function formatMY(dateObj) {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: TZ,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: false
    }).formatToParts(dateObj);
    const m = Object.fromEntries(parts.map(p => [p.type, p.value]));
    return `${m.day}/${m.month}/${m.year}, ${m.hour}:${m.minute}`;
  }

  function randToken(len = 20) {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    let out = "";
    for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
  }

  function uid(prefix = "ID") {
    return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  }

  function uuid() { return uid("UUID"); }

  function safeJsonParse(s, fallback) {
    try { return JSON.parse(s); } catch { return fallback; }
  }

  function getLoggedInUser() {
    return safeJsonParse(localStorage.getItem(LS_USER) || "null", null);
  }

  function requireAuth({ roles } = {}) {
    const user = getLoggedInUser();
    if (!user || !user.email) {
      window.location.href = "index.html";
      return null;
    }
    if (roles && roles.length && !roles.includes(user.role)) {
      window.location.href = "menu.html";
      return null;
    }
    return user;
  }

  function setStatus(el, msg, type = "info") {
    if (!el) return;
    el.innerText = msg || "";
    el.className = `status ${type}`;
  }

  // ----------------------------
  // IndexedDB
  // ----------------------------
  function openDB() {
    // Cache connection to avoid repeated opens and reduce lag.
    if (openDB._p) return openDB._p;

    openDB._p = new Promise((resolve, reject) => {
      if (!("indexedDB" in window)) {
        reject(new Error("IndexedDB tidak disokong oleh browser ini."));
        return;
      }

      const req = indexedDB.open(DB_NAME, DB_VERSION);
      const timeoutMs = 3500;
      const timer = setTimeout(() => {
        try { req.onerror = null; req.onsuccess = null; req.onupgradeneeded = null; req.onblocked = null; } catch {}
        reject(new Error("DB_TIMEOUT"));
      }, timeoutMs);

      req.onupgradeneeded = (event) => {
        const db = event.target.result;

        const ensure = (name, opts) => {
          if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, opts);
        };

        ensure(STORE_USERS, { keyPath: "email" });
        ensure(STORE_ACTIVITIES, { keyPath: "id" });
        ensure(STORE_INVITATIONS, { keyPath: "id" });
        ensure(STORE_NOTIFICATIONS, { keyPath: "id" });
        ensure(STORE_AUDIT, { keyPath: "id", autoIncrement: true });
        ensure(STORE_RESETS, { keyPath: "token" });
        ensure(STORE_MASTER, { keyPath: "key" });
        ensure(STORE_ATTACHMENTS, { keyPath: "id" });
        ensure(STORE_NEWS, { keyPath: "id" });
        ensure(STORE_AI, { keyPath: "key" });
      };

      req.onblocked = () => {
        clearTimeout(timer);
        reject(new Error("DB_BLOCKED"));
      };

      req.onsuccess = () => {
        clearTimeout(timer);
        const db = req.result;

        // Auto close old connections when version changes (prevents "blocked" forever).
        db.onversionchange = () => {
          try { db.close(); } catch {}
        };

        resolve(db);
      };

      req.onerror = () => {
        clearTimeout(timer);
        reject(req.error || new Error("DB_ERROR"));
      };
    }).catch((err) => {
      // allow retry after failure
      openDB._p = null;
      throw err;
    });

    return openDB._p;
  }

  async function txGetAll(db, storeName) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readonly");
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async function txGet(db, storeName, key) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readonly");
      const store = tx.objectStore(storeName);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async function txPut(db, storeName, obj) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      const req = store.put(obj);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  async function txAdd(db, storeName, obj) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      const req = store.add(obj);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function txDelete(db, storeName, key) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      const req = store.delete(key);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  // ----------------------------
  // Master data (read-only)
  // ----------------------------
  function seedMaster() {
    const institutions = [
      { id: "INST_HQ_SDK", name: "HQ Sandakan" },
      { id: "INST_RDC_SEPILOK", name: "RDC Sepilok" },
      { id: "INST_IPS", name: "Institut Perhutanan Sabah" }
    ];

    const regions = [
      { id: "REG_SDK", name: "Sandakan" },
      { id: "REG_TWU", name: "Tawau" },
      { id: "REG_KDT", name: "Kudat" },
      { id: "REG_KK", name: "Kota Kinabalu" },
      { id: "REG_KNG", name: "Keningau" }
    ];

    const districts = [
      // Sandakan Region
      { id: "DST_SDK", regionId: "REG_SDK", name: "Sandakan" },
      { id: "DST_BLR", regionId: "REG_SDK", name: "Beluran" },
      { id: "DST_TLP", regionId: "REG_SDK", name: "Telupid" },
      { id: "DST_TNG", regionId: "REG_SDK", name: "Tongod" },
      { id: "DST_DMK", regionId: "REG_SDK", name: "Deramakot" },
      { id: "DST_KNB", regionId: "REG_SDK", name: "Kinabatangan" },
      // Tawau Region
      { id: "DST_TWU", regionId: "REG_TWU", name: "Tawau" },
      { id: "DST_KNK", regionId: "REG_TWU", name: "Kunak" },
      { id: "DST_LHD", regionId: "REG_TWU", name: "Lahad Datu" },
      { id: "DST_SPM", regionId: "REG_TWU", name: "Semporna" },
      { id: "DST_KLB", regionId: "REG_TWU", name: "Kalabakan" },
      { id: "DST_SRDG", regionId: "REG_TWU", name: "Serudong" },
      { id: "DST_USM", regionId: "REG_TWU", name: "Ulu Segama–Malua" },
      // Kudat Region
      { id: "DST_KDT", regionId: "REG_KDT", name: "Kudat" },
      { id: "DST_PTS", regionId: "REG_KDT", name: "Pitas" },
      { id: "DST_KMR", regionId: "REG_KDT", name: "Kota Marudu" },
      { id: "DST_KBD", regionId: "REG_KDT", name: "Kota Belud" },
      // Kota Kinabalu Region
      { id: "DST_KK", regionId: "REG_KK", name: "Kota Kinabalu" },
      { id: "DST_RNU", regionId: "REG_KK", name: "Ranau" },
      { id: "DST_BFT", regionId: "REG_KK", name: "Beaufort" },
      { id: "DST_SPT", regionId: "REG_KK", name: "Sipitang" },
      // Keningau Region
      { id: "DST_KNG", regionId: "REG_KNG", name: "Keningau" },
      { id: "DST_NBW", regionId: "REG_KNG", name: "Nabawan" },
      { id: "DST_TNM", regionId: "REG_KNG", name: "Tenom" },
      { id: "DST_TBN", regionId: "REG_KNG", name: "Tambunan" },
      { id: "DST_SOK", regionId: "REG_KNG", name: "Sook" },
      { id: "DST_TBW", regionId: "REG_KNG", name: "Tibow" }
    ];

    return { institutions, regions, districts };
  }

  async function ensureSeed() {
    const db = await openDB();
    const master = await txGet(db, STORE_MASTER, "masterData");
    if (!master) {
      await txPut(db, STORE_MASTER, { key: "masterData", ...seedMaster() });
    }

    // Seed SUPERADMIN (cannot delete / downgrade)
    const saEmail = "superadmin@superadmin.com";
    const existing = await txGet(db, STORE_USERS, saEmail);
    if (!existing) {
      await txPut(db, STORE_USERS, {
        name: "Super Admin",
        email: saEmail,
        phone: "-",
        password: "admin123", // plaintext
        role: "SUPERADMIN",
        status: "ACTIVE",
        institusi: "INST_HQ_SDK",
        regionId: "REG_SDK",
        districtId: "DST_SDK",
        createdAt: myTimestamp(),
        updatedAt: myTimestamp(),
        isSeed: true
      });
    }
  }

  async function getMaster() {
    const db = await openDB();
    const m = await txGet(db, STORE_MASTER, "masterData");
    return m || seedMaster();
  }

  function getRegionName(master, regionId) {
    return (master.regions || []).find(r => r.id === regionId)?.name || "-";
  }

  function getDistrictName(master, districtId) {
    return (master.districts || []).find(d => d.id === districtId)?.name || "-";
  }

  // ----------------------------
  // Audit + Notifications
  // ----------------------------
  async function addAuditLog(userEmail, action, details) {
    const db = await openDB();
    const user = userEmail || (getLoggedInUser()?.email || "-");
    const ipAddress = "ANDROID_LOCAL"; // tiada akses ip sebenar dalam HTML-only
    await txAdd(db, STORE_AUDIT, {
      userEmail: user,
      action,
      details: details || "",
      ipAddress,
      createdAt: formatMY(nowMY())
    });
  }

  async function addNotification(userEmail, type, message, meta = {}) {
    const db = await openDB();
    const n = {
      id: uid("NOTIF"),
      userEmail,
      type,
      message,
      meta,
      isRead: false,
      createdAt: formatMY(nowMY())
    };
    await txPut(db, STORE_NOTIFICATIONS, n);
  }

  // ----------------------------
  // Users
  // ----------------------------
  async function getUserByEmail(email) {
    const db = await openDB();
    return await txGet(db, STORE_USERS, email);
  }

  async function getAllUsers() {
    const db = await openDB();
    return await txGetAll(db, STORE_USERS);
  }

  async function registerStaff(payload) {
    const db = await openDB();
    const email = (payload.email || "").trim().toLowerCase();
    if (!email) throw new Error("Email wajib");
    const existing = await txGet(db, STORE_USERS, email);
    if (existing) throw new Error("Email sudah digunakan");

    const user = {
      name: (payload.name || "").trim(),
      email,
      phone: (payload.phone || "").trim(),
      password: (payload.password || "").trim(), // plaintext
      role: "STAFF",
      status: "PENDING",
      institusi: payload.institusi,
      regionId: payload.regionId,
      districtId: payload.districtId,
      createdAt: formatMY(nowMY()),
      updatedAt: formatMY(nowMY()),
      isSeed: false
    };
    await txPut(db, STORE_USERS, user);
    await addAuditLog(email, "REGISTER", "Pendaftaran STAFF (PENDING)");
    return user;
  }

  async function setUserStatus(actor, email, status) {
    const db = await openDB();
    const u = await txGet(db, STORE_USERS, email);
    if (!u) throw new Error("Pengguna tidak wujud");
    if (u.isSeed && u.role === "SUPERADMIN") throw new Error("SUPERADMIN seed tidak boleh diubah");
    u.status = status;
    u.updatedAt = formatMY(nowMY());
    await txPut(db, STORE_USERS, u);
    await addAuditLog(actor.email, "CHANGE_STATUS", `Status ${email} → ${status}`);
    await addNotification(email, "CHANGE_STATUS", `Status akaun anda ditetapkan kepada ${status}.`);
    return u;
  }

  async function setUserRole(actor, email, role) {
    const db = await openDB();
    const u = await txGet(db, STORE_USERS, email);
    if (!u) throw new Error("Pengguna tidak wujud");
    if (u.isSeed && u.role === "SUPERADMIN") throw new Error("SUPERADMIN seed tidak boleh diturunkan");
    u.role = role;
    u.updatedAt = formatMY(nowMY());
    await txPut(db, STORE_USERS, u);
    await addAuditLog(actor.email, "CHANGE_ROLE", `Role ${email} → ${role}`);
    await addNotification(email, "CHANGE_ROLE", `Role akaun anda ditetapkan kepada ${role}.`);
    return u;
  }

  async function deleteUser(actor, email) {
    const db = await openDB();
    const u = await txGet(db, STORE_USERS, email);
    if (!u) return true;
    if (u.isSeed && u.role === "SUPERADMIN") throw new Error("SUPERADMIN seed tidak boleh dipadam");
    await txDelete(db, STORE_USERS, email);
    await addAuditLog(actor.email, "DELETE_USER", `Padam pengguna: ${email}`);
    return true;
  }


  async function updateSelf(actorEmail, updates) {
    const db = await openDB();
    const e = (actorEmail || "").trim().toLowerCase();
    const u = await txGet(db, STORE_USERS, e);
    if (!u) throw new Error("Pengguna tidak wujud");
    // only allow safe fields
    if (typeof updates.name === "string") u.name = updates.name.trim();
    if (typeof updates.phone === "string") u.phone = updates.phone.trim();
    if (typeof updates.password === "string" && updates.password.trim()) u.password = updates.password.trim(); // plaintext
    u.updatedAt = formatMY(nowMY());
    await txPut(db, STORE_USERS, u);

    // update localStorage if this is the logged in user
    const cur = getLoggedInUser();
    if (cur && cur.email === u.email) {
      localStorage.setItem(LS_USER, JSON.stringify({ ...u, token: localStorage.getItem(LS_TOKEN) || cur.token || "" }));
    }

    await addAuditLog(u.email, "UPDATE_PROFILE", "Kemaskini profil sendiri");
    return u;
  }
  // ----------------------------
  // Auth
  // ----------------------------
  async function loginUser(email, password) {

    if (ONLINE_ENABLED) {
      const e = (email || "").trim().toLowerCase();
      const p = String(password || "");
      const out = await apiFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: e, password: p })
      });
      // out: { token, user }
      setAuthSession(out.token, out.user);
      return { success: true, user: out.user, token: out.token };
    }


    const db = await openDB();
    const e = (email || "").trim().toLowerCase();
    const u = await txGet(db, STORE_USERS, e);
    if (!u) return { success: false, message: "Pengguna tidak wujud" };
    if ((u.password || "") !== (password || "")) return { success: false, message: "Kata laluan salah" };
    if (u.status !== "ACTIVE") return { success: false, message: "Akaun tidak aktif" };

    const token = randToken(32);
    localStorage.setItem(LS_TOKEN, token);
    localStorage.setItem(LS_USER, JSON.stringify({ ...u, token }));

    await addAuditLog(u.email, "LOGIN", "Login berjaya");
    return { success: true, user: u, token };
  }

  async function logoutUser() {

    if (ONLINE_ENABLED) {
      try { await apiFetch("/api/auth/logout", { method: "POST", body: JSON.stringify({}) }); } catch(e) {}
      clearAuthSession();
      return { success: true };
    }


    const u = getLoggedInUser();
    if (u?.email) await addAuditLog(u.email, "LOGOUT", "Pengguna log keluar");
    localStorage.removeItem(LS_USER);
    localStorage.removeItem(LS_TOKEN);
  }

  // ----------------------------
  // Reset Password
  // ----------------------------
  async function requestReset(email, method) {
    const db = await openDB();
    const e = (email || "").trim().toLowerCase();
    const u = await txGet(db, STORE_USERS, e);
    if (!u) throw new Error("Pengguna tidak wujud");

    const token = randToken(10);
    const expiresAtMs = Date.now() + (30 * 60 * 1000);
    const item = {
      token,
      email: e,
      method: method || "EMAIL",
      expiresAtMs,
      used: false,
      createdAt: formatMY(nowMY())
    };
    await txPut(db, STORE_RESETS, item);
    await addAuditLog(e, "RESET_PASSWORD_REQUEST", `Reset diminta (method=${item.method})`);
    await addNotification(e, "RESET_PASSWORD_REQUEST", `Reset diminta. Token akan tamat dalam 30 minit.`);
    return item;
  }

  async function confirmReset(email, token, newPassword) {
    const db = await openDB();
    const e = (email || "").trim().toLowerCase();
    const t = (token || "").trim();
    const reset = await txGet(db, STORE_RESETS, t);
    if (!reset || reset.email !== e) throw new Error("Token tidak sah");
    if (reset.used) throw new Error("Token sudah digunakan");
    if (Date.now() > reset.expiresAtMs) throw new Error("Token sudah tamat tempoh");

    const u = await txGet(db, STORE_USERS, e);
    if (!u) throw new Error("Pengguna tidak wujud");
    u.password = (newPassword || "").trim();
    u.updatedAt = formatMY(nowMY());
    await txPut(db, STORE_USERS, u);

    reset.used = true;
    await txPut(db, STORE_RESETS, reset);

    await addAuditLog(e, "RESET_PASSWORD_SUCCESS", "Reset kata laluan berjaya");
    await addNotification(e, "RESET_PASSWORD_SUCCESS", "Kata laluan berjaya ditukar.");
    return true;
  }

  // ----------------------------
  // Activities + Invitations
  // ----------------------------
  async function addActivity(actor, payload) {
    const db = await openDB();
    const master = await getMaster();

    if (!["SUPERADMIN", "ADMIN"].includes(actor.role)) {
      throw new Error("Tiada kebenaran untuk cipta aktiviti");
    }

    const activity = {
      id: uid("ACT"),
      title: (payload.title || "").trim(),
      type: payload.type || "LAIN-LAIN",
      startDate: payload.startDate,
      endDate: payload.endDate,
      startTime: payload.startTime,
      endTime: payload.endTime,
      location: (payload.location || "").trim(),
      regionId: actor.role === "ADMIN" ? actor.regionId : payload.regionId,
      districtId: actor.role === "ADMIN" ? actor.districtId : payload.districtId,
      organizerEmail: actor.email,
      participants: [],
      status: "AKTIF",
      cancelReason: "",
      createdAt: formatMY(nowMY()),
      updatedAt: formatMY(nowMY())
    };

    // Validate region/district
    if (!activity.regionId || !activity.districtId) throw new Error("Wilayah/Daerah wajib");
    if (!activity.startDate || !activity.endDate) throw new Error("Tarikh wajib");
    if (!activity.title) throw new Error("Tajuk wajib");

    // Participants rule
    const allUsers = (await txGetAll(db, STORE_USERS)).filter(u => u.status === "ACTIVE");
    let invitedEmails = [];
    if (payload.inviteAll === true) {
      invitedEmails = allUsers.map(u => u.email);
    } else {
      invitedEmails = (payload.selectedEmails || []).map(e => String(e).toLowerCase());
    }
    invitedEmails = [...new Set(invitedEmails)].filter(Boolean);

    activity.participants = invitedEmails;

    await txPut(db, STORE_ACTIVITIES, activity);
    await addAuditLog(actor.email, "CREATE_ACTIVITY", `Cipta aktiviti: ${activity.title} (${getRegionName(master, activity.regionId)} / ${getDistrictName(master, activity.districtId)})`);

    // Create invitations + notifications
    for (const email of invitedEmails) {
      const inv = {
        id: uid("INV"),
        activityId: activity.id,
        invitedEmail: email,
        status: "PENDING",
        reasonReject: "",
        createdAt: formatMY(nowMY()),
        updatedAt: formatMY(nowMY())
      };
      await txPut(db, STORE_INVITATIONS, inv);
      await addNotification(email, "NEW_INVITATION", `Jemputan aktiviti: ${activity.title}`, { activityId: activity.id });
    }
    await addAuditLog(actor.email, "INVITE_USERS", payload.inviteAll ? `Jemput ALL SABAH (${invitedEmails.length} pengguna)` : `Jemput SELECTED (${invitedEmails.length} pengguna)`);

    return activity;
  }

  async function getAllActivities() {
    const db = await openDB();
    return await txGetAll(db, STORE_ACTIVITIES);
  }

  async function getInvitations() {
    const db = await openDB();
    return await txGetAll(db, STORE_INVITATIONS);
  }

  async function getActivitiesForUser(user) {
    const db = await openDB();
    const all = await txGetAll(db, STORE_ACTIVITIES);
    if (user.role === "SUPERADMIN") return all;

    if (user.role === "ADMIN") {
      return all.filter(a => (a.regionId === user.regionId && a.districtId === user.districtId));
    }

    // STAFF: activities they are invited to (any status)
    const invs = await txGetAll(db, STORE_INVITATIONS);
    const ids = new Set(invs.filter(i => i.invitedEmail === user.email).map(i => i.activityId));
    return all.filter(a => ids.has(a.id));
  }

  async function getInvitationForUser(activityId, email) {
    const invs = await getInvitations();
    return invs.find(i => i.activityId === activityId && i.invitedEmail === email) || null;
  }

  async function respondInvitation(actor, activityId, status, reasonReject = "") {

    if (ONLINE_ENABLED) {
      const out = await apiFetch("/api/invitations/" + encodeURIComponent(invitationId) + "/respond", {
        method: "POST",
        body: JSON.stringify({ status, reasonReject })
      });
      return out.invitation;
    }


    const db = await openDB();
    if (actor.role !== "STAFF") throw new Error("Hanya STAFF boleh respon jemputan");
    const invs = await txGetAll(db, STORE_INVITATIONS);
    const inv = invs.find(i => i.activityId === activityId && i.invitedEmail === actor.email);
    if (!inv) throw new Error("Jemputan tidak dijumpai");
    if (status === "REJECTED" && !String(reasonReject || "").trim()) throw new Error("Sebab reject wajib");

    inv.status = status;
    inv.reasonReject = status === "REJECTED" ? String(reasonReject || "").trim() : "";
    inv.updatedAt = formatMY(nowMY());
    await txPut(db, STORE_INVITATIONS, inv);

    const act = await txGet(db, STORE_ACTIVITIES, activityId);
    if (act) {
      await addAuditLog(actor.email, status === "ACCEPTED" ? "ACCEPT_INVITATION" : "REJECT_INVITATION", `Aktiviti: ${act.title}${inv.reasonReject ? " | Sebab: " + inv.reasonReject : ""}`);
      await addNotification(act.organizerEmail, status === "ACCEPTED" ? "INVITATION_ACCEPTED" : "INVITATION_REJECTED", `${actor.name} (${actor.email}) ${status === "ACCEPTED" ? "TERIMA" : "TOLAK"} jemputan: ${act.title}`, { activityId });
    }
    return true;
  }

  async function cancelActivity(actor, activityId, cancelReason) {

    if (ONLINE_ENABLED) {
      const out = await apiFetch("/api/activities/" + encodeURIComponent(activityId) + "/cancel", { method: "POST", body: JSON.stringify({ cancelReason }) });
      return out.activity;
    }


    const db = await openDB();
    const act = await txGet(db, STORE_ACTIVITIES, activityId);
    if (!act) throw new Error("Aktiviti tidak dijumpai");

    if (actor.role === "ADMIN") {
      if (!(act.regionId === actor.regionId && act.districtId === actor.districtId)) throw new Error("Tiada akses untuk batalkan aktiviti ini");
    }
    if (!["SUPERADMIN","ADMIN"].includes(actor.role)) throw new Error("Tiada akses");

    act.status = "DIBATALKAN";
    act.cancelReason = String(cancelReason || "").trim() || "-";
    act.updatedAt = formatMY(nowMY());
    await txPut(db, STORE_ACTIVITIES, act);

    await addAuditLog(actor.email, "CANCEL_ACTIVITY", `Batal aktiviti: ${act.title} | Sebab: ${act.cancelReason}`);

    // notify participants
    for (const email of (act.participants || [])) {
      await addNotification(email, "ACTIVITY_CANCELLED", `Aktiviti dibatalkan: ${act.title} | Sebab: ${act.cancelReason}`, { activityId });
    }
    return true;
  }

  // ----------------------------
  // Attachments (local IndexedDB blob storage)
  // ----------------------------
  async function uploadAttachment(actor, activityId, file, meta) {

    if (ONLINE_ENABLED) {
      // use multipart
      const token = localStorage.getItem("kbjps_jwt");
      const fd = new FormData();
      Object.keys(meta || {}).forEach(k => fd.append(k, meta[k]));
      fd.append("file", file);
      const res = await fetch(API_BASE + "/api/activities/" + encodeURIComponent(activityId) + "/attachments", {
        method: "POST",
        headers: token ? { "Authorization": "Bearer " + token } : {},
        body: fd
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error((data && data.message) ? data.message : ("HTTP " + res.status));
      return data.attachment;
    }


    const db = await openDB();
    const act = await txGet(db, STORE_ACTIVITIES, activityId);
    if (!act) throw new Error("Aktiviti tidak dijumpai");

    // Access: SUPERADMIN always; ADMIN only same region/district; STAFF only if invited & accepted
    if (actor.role === "ADMIN" && !(act.regionId === actor.regionId && act.districtId === actor.districtId)) {
      throw new Error("ADMIN hanya boleh upload untuk aktiviti di kawasan sendiri");
    }
    if (actor.role === "STAFF") {
      const inv = await getInvitationForUser(activityId, actor.email);
      if (!inv || inv.status !== "ACCEPTED") throw new Error("STAFF hanya boleh upload jika jemputan diterima");
    }

    const ext = (file.name || "").split(".").pop().toUpperCase();
    const fileType = (["PDF","DOC","DOCX"].includes(ext) ? ext : "PDF");
    const item = {
      id: uid("ATT"),
      activityId,
      uploadedBy: actor.email,
      title: (meta?.title || file.name || "Dokumen").trim(),
      notes: (meta?.notes || "").trim(),
      fileType,
      category: meta?.category || "ACTIVITY_ATTACHMENT",
      regionId: act.regionId,
      districtId: act.districtId,
      blob: file,
      createdAt: formatMY(nowMY())
    };
    await txPut(db, STORE_ATTACHMENTS, item);
    await addAuditLog(actor.email, "UPLOAD_DOCUMENT", `Upload dokumen: ${item.title} (${item.fileType}) untuk aktiviti ${act.title}`);

    // notify participants + organizer
    const targets = new Set([act.organizerEmail, ...(act.participants || [])]);
    for (const email of targets) {
      await addNotification(email, "DOCUMENT_UPLOADED", `Dokumen dimuat naik: ${item.title} (Aktiviti: ${act.title})`, { attachmentId: item.id, activityId });
    }
    return item;
  }

  async function listAttachmentsForUser(user) {
    const db = await openDB();
    const all = await txGetAll(db, STORE_ATTACHMENTS);
    if (user.role === "SUPERADMIN") return all;

    if (user.role === "ADMIN") {
      return all.filter(a => a.regionId === user.regionId && a.districtId === user.districtId);
    }

    // STAFF: attachments for activities they are invited to and accepted
    const invs = await txGetAll(db, STORE_INVITATIONS);
    const acceptedIds = new Set(invs.filter(i => i.invitedEmail === user.email && i.status === "ACCEPTED").map(i => i.activityId));
    return all.filter(a => acceptedIds.has(a.activityId));
  }

  async function getAttachmentById(id) {
    const db = await openDB();
    return await txGet(db, STORE_ATTACHMENTS, id);
  }

  async function deleteAttachment(actor, attachmentId) {

    if (ONLINE_ENABLED) {
      const out = await apiFetch("/api/attachments/" + encodeURIComponent(attachmentId), { method: "DELETE" });
      return out;
    }


    const db = await openDB();
    const a = await txGet(db, STORE_ATTACHMENTS, attachmentId);
    if (!a) return true;

    const act = await txGet(db, STORE_ACTIVITIES, a.activityId);
    if (!act) throw new Error("Aktiviti tidak dijumpai");

    if (actor.role === "ADMIN" && !(a.regionId === actor.regionId && a.districtId === actor.districtId)) {
      throw new Error("Tiada akses untuk delete");
    }
    if (actor.role === "STAFF") throw new Error("STAFF tidak boleh delete dokumen");

    await txDelete(db, STORE_ATTACHMENTS, attachmentId);
    await addAuditLog(actor.email, "DELETE_DOCUMENT", `Delete dokumen: ${a.title}`);
    return true;
  }

  // ----------------------------
  // UI: Header/Footer
  // ----------------------------
  KBJPS.renderHeader = async function renderHeader(opts) {
    const mount = document.getElementById("kbjpsHeader");
    if (!mount) return;

    const title = opts?.title || "KB-JPS";
    const backHref = opts?.backHref || "menu.html";
    const showBack = opts?.showBack !== false; // default true
    const showLogout = opts?.showLogout === true;

    const user = getLoggedInUser();

    const html = `
      <div class="topbar">
        <div class="tb-left">
          <img src="assets/logo-jps.png" class="tb-logo" alt="Logo JPS"/>
          <div class="tb-title">
            <div class="tb-system">KB‑JPS</div>
            <div class="tb-page">${title}</div>
          </div>
        </div>
        <div class="tb-right">
          ${showBack ? `<button class="tb-btn" id="btnBack">← Dashboard</button>` : ``}
          ${showLogout ? `<button class="tb-btn danger" id="btnLogout">LOGOUT</button>` : ``}
        </div>
      </div>
      ${user?.email ? `<div class="subbar neon-text-xs">Login: <b>${user.name || "Pengguna"}</b> (${user.role})</div>` : ``}
    `;
    mount.innerHTML = html;

    const btnBack = document.getElementById("btnBack");
    if (btnBack) btnBack.addEventListener("click", () => (window.location.href = backHref));

    const btnLogout = document.getElementById("btnLogout");
    if (btnLogout) btnLogout.addEventListener("click", async () => {
      await logoutUser();
      window.location.href = "index.html";
    });
  };

  KBJPS.renderFooter = function renderFooter() {
    const mount = document.getElementById("kbjpsFooter");
    if (!mount) return;
    mount.innerHTML = `<div class="footer">Generated by KB‑JPS • Waktu Malaysia</div>`;
  };


  
  // ----------------------------
  // AI Assistant (Offline + Online)
  // - Offline: rule-based assistant + tindakan (navigate / ringkasan)
  // - Online: panggil endpoint luaran (proxy) TANPA simpan API key dalam GitHub
  // ----------------------------
  const LS_AI_ENDPOINT = "kbjps_ai_endpoint";
  const LS_AI_MODE = "kbjps_ai_mode"; // "offline" | "online"

  function isOnline() {
    return typeof navigator !== "undefined" ? navigator.onLine : false;
  }

  function normalize(str) {
    return (str || "").toLowerCase().replace(/\s+/g, " ").trim();
  }

  function containsAny(s, arr) {
    return arr.some(k => s.includes(k));
  }

  async function offlineAnswer(userEmail, prompt) {
    const p = normalize(prompt);

    // Navigation / action intents
    if (containsAny(p, ["buka kalendar", "pergi kalendar", "kalendar"])) {
      return { type: "action", action: () => (window.location.href = "calendar.html"), text: "Baik. Saya buka Kalendar." };
    }
    if (containsAny(p, ["notifikasi", "notification"])) {
      return { type: "action", action: () => (window.location.href = "notifications.html"), text: "Baik. Saya buka Notifikasi." };
    }
    if (containsAny(p, ["profil", "profile"])) {
      return { type: "action", action: () => (window.location.href = "profile.html"), text: "Baik. Saya buka Profil." };
    }
    if (containsAny(p, ["laporan", "report"])) {
      return { type: "action", action: () => (window.location.href = "reports.html"), text: "Baik. Saya buka Laporan." };
    }
    if (containsAny(p, ["audit", "log audit", "audit log"])) {
      return { type: "action", action: () => (window.location.href = "audit.html"), text: "Baik. Saya buka Audit Log." };
    }
    if (containsAny(p, ["pengguna", "user management", "pengurusan pengguna", "user"])) {
      return { type: "action", action: () => (window.location.href = "user-management.html"), text: "Baik. Saya buka Pengurusan Pengguna." };
    }

    // Summary intents
    if (containsAny(p, ["aktiviti hari ini", "aktiviti hariini", "aktiviti today", "today"])) {
      const u = await getUserByEmail(userEmail);
      const acts = await getActivitiesForUser(u);
      const today = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year:"numeric", month:"2-digit", day:"2-digit" }).format(new Date());
      const todays = acts.filter(a => (a.startDate || "").slice(0,10) === today);
      if (!todays.length) return { type: "text", text: `Tiada aktiviti untuk hari ini (${formatMY(new Date())}).` };
      const lines = todays.slice(0, 8).map(a => `• ${a.title} (${a.startTime || "-"}–${a.endTime || "-"}) @ ${a.location || "-"}`);
      return { type: "text", text: `Aktiviti hari ini (${today}):\n${lines.join("\n")}` };
    }

    if (containsAny(p, ["aktiviti bulan ini", "bulan ini"])) {
      const u = await getUserByEmail(userEmail);
      const acts = await getActivitiesForUser(u);
      const now = new Date();
      const ym = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year:"numeric", month:"2-digit" }).format(now); // YYYY-MM
      const list = acts.filter(a => (a.startDate || "").startsWith(ym)).slice(0, 12);
      if (!list.length) return { type: "text", text: `Tiada aktiviti pada bulan ini (${ym}).` };
      const lines = list.map(a => `• ${a.startDate} ${a.startTime || ""} ${a.title}`);
      return { type: "text", text: `Senarai aktiviti bulan ini (${ym}):\n${lines.join("\n")}` };
    }

    // Help
    if (containsAny(p, ["help", "bantuan", "apa boleh"])) {
      return {
        type: "text",
        text:
`Saya boleh bantu (OFFLINE):
- "buka kalendar / notifikasi / laporan / audit / pengguna / profil"
- "aktiviti hari ini"
- "aktiviti bulan ini"

Mode ONLINE pula boleh bagi cadangan teks/rumusan bila awak set endpoint AI.`
      };
    }

    return { type: "text", text: "Cuba taip: 'help' untuk arahan ringkas (offline). Jika mahu AI lebih pintar, tukar ke Mode ONLINE dan set endpoint." };
  }

  async function onlineAnswer(prompt) {
    const endpoint = (localStorage.getItem(LS_AI_ENDPOINT) || "").trim();
    if (!endpoint) return { type: "text", text: "Endpoint AI belum diset. Pergi ke AI → Settings → masukkan URL endpoint (contoh: https://server-anda/api/ai)." };

    const payload = {
      prompt: String(prompt || ""),
      app: "KBJPS",
      timeMY: formatMY(new Date()) + " (Waktu Malaysia)",
      user: safeJsonParse(localStorage.getItem(LS_USER) || "null", null)
    };

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      return { type: "text", text: `Panggilan AI gagal (${res.status}). Pastikan endpoint betul dan server online.` };
    }

    const data = await res.json().catch(() => ({}));
    const answer = data.answer || data.message || data.text || "";
    return { type: "text", text: answer || "AI online tidak memulangkan jawapan." };
  }

  async function chat(userEmail, prompt) {
    const mode = (localStorage.getItem(LS_AI_MODE) || "offline").toLowerCase();
    if (mode === "online" && isOnline()) {
      try { return await onlineAnswer(prompt); }
      catch (e) { return { type: "text", text: `Mode ONLINE gagal, jatuh balik OFFLINE. Sebab: ${e?.message || e}` }; }
    }
    return await offlineAnswer(userEmail, prompt);
  }

  KBJPS.ai = {
    isOnline,
    getMode: () => (localStorage.getItem(LS_AI_MODE) || "offline"),
    setMode: (m) => localStorage.setItem(LS_AI_MODE, (m || "offline")),
    getEndpoint: () => (localStorage.getItem(LS_AI_ENDPOINT) || ""),
    setEndpoint: (url) => localStorage.setItem(LS_AI_ENDPOINT, (url || "").trim()),
    chat
  };

// ----------------------------
  // News (offline announcements)
  // ----------------------------
  async function listNews() {
    const db = await openDB();
    const all = await txGetAll(db, STORE_NEWS);
    return (all || []).sort((a,b)=> (b.createdAt||"").localeCompare(a.createdAt||""));
  }

  async function addNews(actor, { title, body }) {
    const u = await getUserByEmail(actor.email);
    if (!u || u.role !== "SUPERADMIN") throw new Error("Tidak dibenarkan");
    const db = await openDB();
    const item = {
      id: uuid(),
      title: (title||"").trim(),
      body: (body||"").trim(),
      createdAt: formatMY(nowMY()),
    };
    await txPut(db, STORE_NEWS, item);
    await addAuditLog(u.email, "ADD_NEWS", `Tambah pengumuman: ${item.title}`);
    return item;
  }

  // ----------------------------
  // Public APIs for pages
  // ----------------------------
  KBJPS.ensureSeed = ensureSeed;
  KBJPS.requireAuth = requireAuth;
  KBJPS.getMaster = getMaster;
  KBJPS.formatMY = formatMY;
  KBJPS.myTimestamp = myTimestamp;
  KBJPS.setStatus = setStatus;

  KBJPS.auth = { loginUser, logoutUser, getLoggedInUser };
  KBJPS.users = { getUserByEmail, getAllUsers, registerStaff, setUserStatus, setUserRole, deleteUser, updateSelf };
  KBJPS.audit = { addAuditLog, list: async () => { const db = await openDB(); return await txGetAll(db, STORE_AUDIT); } };
  KBJPS.notifications = {
    list: async (userEmail) => {
      const db = await openDB();
      const all = await txGetAll(db, STORE_NOTIFICATIONS);
      return all.filter(n => n.userEmail === userEmail);
    },
    markRead: async (notifId) => {
      const db = await openDB();
      const n = await txGet(db, STORE_NOTIFICATIONS, notifId);
      if (!n) return true;
      n.isRead = true;
      await txPut(db, STORE_NOTIFICATIONS, n);
      return true;
    },
    markAllRead: async (userEmail) => {
      const db = await openDB();
      const all = await txGetAll(db, STORE_NOTIFICATIONS);
      const mine = all.filter(n => n.userEmail === userEmail);
      for (const n of mine) {
        if (!n.isRead) {
          n.isRead = true;
          await txPut(db, STORE_NOTIFICATIONS, n);
        }
      }
      return true;
    }
  };

  KBJPS.reset = { requestReset, confirmReset };

  KBJPS.news = { list: listNews, add: addNews };

  KBJPS.activities = {
    addActivity,
    getAllActivities,
    getActivitiesForUser,
    getInvitations,
    getInvitationForUser,
    respondInvitation,
    cancelActivity
  };

  KBJPS.attachments = {
    uploadAttachment,
    listAttachmentsForUser,
    getAttachmentById,
    deleteAttachment
  };

  // ----------------------------
  // Boot
  // ----------------------------
  document.addEventListener("DOMContentLoaded", async () => {
    try { await ensureSeed(); } catch (e) { /* ignore */ }
  });

})();
