// -----------------------------------------------
// IndexedDB Setup
// -----------------------------------------------

const DB_NAME = "KBJPS_DB";
const DB_VERSION = 1;
const STORE_USERS = "users";
const STORE_ACTIVITIES = "activities";

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = function (e) {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_USERS)) {
        db.createObjectStore(STORE_USERS, { keyPath: "email" });
      }
      if (!db.objectStoreNames.contains(STORE_ACTIVITIES)) {
        db.createObjectStore(STORE_ACTIVITIES, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject("IndexedDB gagal dibuka");
  });
}

async function initDB() {
  const db = await openDB();
  const tx = db.transaction(STORE_USERS, "readonly");
  const store = tx.objectStore(STORE_USERS);
  const req = store.get("superadmin@superadmin.com");

  req.onsuccess = function () {
    if (!req.result) {
      const superadmin = {
        email: "superadmin@superadmin.com",
        password: "admin123",
        name: "Super Admin",
        phone: "0123456789",
        role: "SUPERADMIN",
        status: "ACTIVE",
        institusi: "HQ Sandakan",
        regionId: "Sandakan",
        districtId: "Sandakan",
        createdAt: new Date().toLocaleString("en-MY", { timeZone: "Asia/Kuala_Lumpur" }),
        updatedAt: new Date().toLocaleString("en-MY", { timeZone: "Asia/Kuala_Lumpur" })
      };
      const writeTx = db.transaction(STORE_USERS, "readwrite");
      writeTx.objectStore(STORE_USERS).add(superadmin);
    }
  };
}

// -----------------------------------------------
// Users (IndexedDB)
// -----------------------------------------------

async function loginUserIndexedDB(email, password) {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_USERS, "readonly");
    const store = tx.objectStore(STORE_USERS);
    const req = store.get(email);

    req.onsuccess = () => {
      const user = req.result;
      if (!user || user.password !== password) {
        resolve({ success: false, message: "Login gagal: Emel atau kata laluan salah." });
      } else if (user.status !== "ACTIVE") {
        resolve({ success: false, message: "Akaun tidak aktif." });
      } else {
        localStorage.setItem("loggedInUser", JSON.stringify(user));
        resolve({ success: true });
      }
    };
    req.onerror = () => resolve({ success: false, message: "Ralat login." });
  });
}

async function addUserIndexedDB(userObj) {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_USERS, "readwrite");
    const store = tx.objectStore(STORE_USERS);
    const req = store.add(userObj);
    req.onsuccess = () => resolve(true);
    req.onerror = () => resolve(false);
  });
}

async function getAllUsersIndexedDB() {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_USERS, "readonly");
    const store = tx.objectStore(STORE_USERS);
    const arr = [];
    store.openCursor().onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) {
        arr.push(cursor.value);
        cursor.continue();
      } else {
        resolve(arr);
      }
    };
  });
}

async function updateUserPassword(email, newPass) {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_USERS, "readwrite");
    const store = tx.objectStore(STORE_USERS);
    const getReq = store.get(email);

    getReq.onsuccess = () => {
      const user = getReq.result;
      if (!user) return resolve(false);
      user.password = newPass;
      user.updatedAt = new Date().toLocaleString("en-MY", { timeZone: "Asia/Kuala_Lumpur" });
      store.put(user);
      resolve(true);
    };
    getReq.onerror = () => resolve(false);
  });
}

// -----------------------------------------------
// Activities (IndexedDB)
// -----------------------------------------------

async function addActivity(activityObj) {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_ACTIVITIES, "readwrite");
    const store = tx.objectStore(STORE_ACTIVITIES);
    const req = store.add(activityObj);
    req.onsuccess = () => resolve(true);
    req.onerror = () => resolve(false);
  });
}

async function getAllActivities() {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_ACTIVITIES, "readonly");
    const store = tx.objectStore(STORE_ACTIVITIES);
    const arr = [];
    store.openCursor().onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) {
        arr.push(cursor.value);
        cursor.continue();
      } else {
        resolve(arr);
      }
    };
  });
}

function logoutUser() {
  localStorage.removeItem("loggedInUser");
}