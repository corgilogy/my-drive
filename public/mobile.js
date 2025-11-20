const MY_PASSWORD = "321321";

const CONFIG = {
  GET_TOKEN_URL: "https://bsduc.netlify.app/.netlify/functions/getToken",
  SAVE_DB_URL: "https://bsduc.netlify.app/.netlify/functions/saveFile",
  DELETE_FILE_URL: "https://bsduc.netlify.app/.netlify/functions/deleteFile",
  SYNC_URL: "https://bsduc.netlify.app/.netlify/functions/syncFiles",
  FOLDER_ID: "1i__DIWWEX7HYemtyZ5wqwaYcYfnW50a3",
  FIREBASE: {
    apiKey: "AIzaSyDOUCC56svyZ5pGZV7z160PW4Z8rJ01jdw",
    authDomain: "dnduc-drive.firebaseapp.com",
    databaseURL:
      "https://dnduc-drive-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "dnduc-drive",
    storageBucket: "dnduc-drive.firebasestorage.app",
    messagingSenderId: "875885392954",
    appId: "1:875885392954:web:14fbd18df62155bf6b7103",
    measurementId: "G-455HFS41MH",
  },
};

let ALL_FILES_DATA = [];
let ACTIVE_TAGS = new Set(["ALL"]);
let ACTIVE_TYPES = new Set(["ALL"]);
let currentUploadTags = [];
let currentSelectedFile = null; // Lưu file đang thao tác

document.addEventListener("DOMContentLoaded", () => {
  // --- LOGIN LOGIC ---
  const loginScreen = document.getElementById("login-screen");
  const appScreen = document.getElementById("app-screen");
  const passInput = document.getElementById("pass-input");
  const loginBtn = document.getElementById("btn-login");

  if (sessionStorage.getItem("myDrive_isLoggedIn") === "true") {
    showApp();
  }

  loginBtn.addEventListener("click", checkLogin);
  passInput.addEventListener("keyup", (e) => {
    if (e.key === "Enter") checkLogin();
  });

  function checkLogin() {
    if (passInput.value === MY_PASSWORD) {
      sessionStorage.setItem("myDrive_isLoggedIn", "true");
      showApp();
    } else {
      document.getElementById("login-error").classList.remove("hidden");
    }
  }

  function showApp() {
    loginScreen.classList.add("hidden");
    appScreen.classList.remove("hidden");
    initializeApp();
  }

  // --- UI INTERACTIONS ---
  const drawer = document.getElementById("app-drawer");
  const overlay = document.getElementById("drawer-overlay");

  document.getElementById("menu-btn").onclick = () => {
    drawer.classList.add("open");
    overlay.classList.remove("hidden");
  };
  overlay.onclick = () => {
    drawer.classList.remove("open");
    overlay.classList.add("hidden");
  };

  document.getElementById("fab-upload").onclick = () => {
    document.getElementById("upload-modal").classList.remove("hidden");
    currentUploadTags = [];
    renderUploadTags();
    document.getElementById("file-input").value = "";
    document.getElementById("file-name-display").innerText = "Chọn file...";
  };

  document.getElementById("cancel-upload").onclick = () =>
    document.getElementById("upload-modal").classList.add("hidden");
  document.getElementById("file-input").onchange = (e) => {
    if (e.target.files.length)
      document.getElementById("file-name-display").innerText =
        e.target.files[0].name;
  };

  // --- TAG INPUT LOGIC ---
  document.getElementById("add-tag-btn").onclick = addTag;

  function addTag() {
    const input = document.getElementById("new-tag-input");
    let val = input.value.trim();
    if (val) {
      val = val.charAt(0).toUpperCase() + val.slice(1);
      if (!currentUploadTags.includes(val)) currentUploadTags.push(val);
      renderUploadTags();
      input.value = "";
    }
  }

  document.getElementById("confirm-upload").onclick = handleUpload;

  // SEARCH
  document
    .getElementById("search-input")
    .addEventListener("input", (e) => renderFileList(e.target.value));
  document.getElementById("sync-btn").onclick = handleSync;

  // ACTION SHEET CLOSE
  document.getElementById("sheet-close").onclick = () =>
    document.getElementById("action-sheet").classList.add("hidden");
  document.getElementById("cancel-rename").onclick = () =>
    document.getElementById("rename-modal").classList.add("hidden");
});

// --- CORE LOGIC ---
function initializeApp() {
  if (typeof firebase !== "undefined" && !firebase.apps.length)
    firebase.initializeApp(CONFIG.FIREBASE);
  loadFilesFromFirebase();
}

function renderUploadTags() {
  const div = document.getElementById("upload-tags-list");
  div.innerHTML = currentUploadTags
    .map(
      (t, i) =>
        `<span class="tag-badge" onclick="removeUploadTag(${i})">${t} &times;</span>`
    )
    .join("");
}
window.removeUploadTag = (i) => {
  currentUploadTags.splice(i, 1);
  renderUploadTags();
};

// --- LOAD FILES ---
function loadFilesFromFirebase() {
  const db = firebase.database();
  const list = document.getElementById("file-list");

  db.ref("files")
    .once("value")
    .then((snapshot) => {
      const data = snapshot.val();
      ALL_FILES_DATA = [];
      if (data) {
        Object.entries(data).forEach(([key, file]) => {
          ALL_FILES_DATA.push({ key: key, ...file, tag: file.tag || "Khác" });
        });
        ALL_FILES_DATA.reverse();
      }
      updateFilters();
      renderFileList();
    });
}

function renderFileList(search = "") {
  const list = document.getElementById("file-list");
  const count = document.getElementById("file-count");

  let filtered = ALL_FILES_DATA.filter((f) => {
    const fType = getFileType(f.fileName).name;
    const fTags = f.tag.split(",").map((t) => t.trim());
    const matchTag =
      ACTIVE_TAGS.has("ALL") || fTags.some((t) => ACTIVE_TAGS.has(t));
    const matchType = ACTIVE_TYPES.has("ALL") || ACTIVE_TYPES.has(fType);
    const matchSearch = f.fileName.toLowerCase().includes(search.toLowerCase());
    return matchTag && matchType && matchSearch;
  });

  count.innerText = filtered.length;
  list.innerHTML = "";

  if (filtered.length === 0) {
    list.innerHTML =
      '<div style="text-align:center; padding:20px; color:#999">Không có file nào</div>';
    return;
  }

  filtered.forEach((file) => {
    const typeInfo = getFileType(file.fileName);
    const tagsHTML = file.tag
      .split(",")
      .map((t) => `<span class="tag-badge">${t.trim()}</span>`)
      .join("");

    const li = document.createElement("li");
    li.className = "file-item";
    li.innerHTML = `
            <i class="fa-solid ${typeInfo.icon} file-icon" style="color:${typeInfo.color}"></i>
            <div class="file-info">
                <a href="${file.viewLink}" target="_blank" class="file-name">${file.fileName}</a>
                <div class="file-tags">${tagsHTML}</div>
            </div>
            <div class="menu-dots" onclick="openActionSheet('${file.key}')"><i class="fa-solid fa-ellipsis-vertical"></i></div>
        `;
    list.appendChild(li);
  });
}

// --- ACTION SHEET LOGIC ---
window.openActionSheet = (key) => {
  const file = ALL_FILES_DATA.find((f) => f.key === key);
  if (!file) return;
  currentSelectedFile = file;

  document.getElementById("sheet-filename").innerText = file.fileName;
  document.getElementById("sheet-download").href = file.downloadLink;
  document.getElementById("action-sheet").classList.remove("hidden");

  // Setup Delete
  document.getElementById("sheet-delete").onclick = () => {
    if (confirm(`Xóa "${file.fileName}"?`)) {
      handleDelete(file.key, file.fileId);
      document.getElementById("action-sheet").classList.add("hidden");
    }
  };

  // Setup Rename
  document.getElementById("sheet-rename").onclick = () => {
    document.getElementById("action-sheet").classList.add("hidden");
    document.getElementById("rename-modal").classList.remove("hidden");
    document.getElementById("rename-input").value = file.fileName;
    document.getElementById("confirm-rename").onclick = () =>
      handleRename(file);
  };
};

// --- UPLOAD ---
async function handleUpload() {
  const fileInput = document.getElementById("file-input");
  const file = fileInput.files[0];
  if (!file) return alert("Chưa chọn file!");

  const status = document.getElementById("upload-status");
  status.innerText = "Đang upload...";

  const tags =
    currentUploadTags.length > 0 ? currentUploadTags.join(", ") : "Khác";

  try {
    const tokenRes = await fetch(CONFIG.GET_TOKEN_URL);
    const { accessToken } = await tokenRes.json();

    const metadata = {
      name: file.name,
      mimeType: file.type,
      parents: [CONFIG.FOLDER_ID],
    };
    const form = new FormData();
    form.append(
      "metadata",
      new Blob([JSON.stringify(metadata)], { type: "application/json" })
    );
    form.append("file", file);

    const upRes = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink",
      {
        method: "POST",
        headers: new Headers({ Authorization: "Bearer " + accessToken }),
        body: form,
      }
    );
    const driveFile = await upRes.json();

    const payload = {
      fileId: driveFile.id,
      fileName: driveFile.name,
      viewLink: driveFile.webViewLink,
      downloadLink: driveFile.webContentLink,
      tag: tags,
    };
    await fetch(CONFIG.SAVE_DB_URL, {
      method: "POST",
      body: JSON.stringify(payload),
    });

    // Patch tag
    const db = firebase.database();
    const snap = await db
      .ref("files")
      .orderByChild("fileId")
      .equalTo(driveFile.id)
      .once("value");
    if (snap.val()) {
      const key = Object.keys(snap.val())[0];
      await db.ref(`files/${key}`).update({ tag: tags });
    }

    status.innerText = "Thành công!";
    setTimeout(() => {
      document.getElementById("upload-modal").classList.add("hidden");
      status.innerText = "";
      loadFilesFromFirebase();
    }, 1000);
  } catch (e) {
    alert("Lỗi: " + e.message);
    status.innerText = "";
  }
}

// --- RENAME ---
async function handleRename(file) {
  const newName = document.getElementById("rename-input").value.trim();
  if (!newName || newName === file.fileName) {
    document.getElementById("rename-modal").classList.add("hidden");
    return;
  }

  try {
    const tokenRes = await fetch(CONFIG.GET_TOKEN_URL);
    const { accessToken } = await tokenRes.json();
    await fetch(`https://www.googleapis.com/drive/v3/files/${file.fileId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: newName }),
    });
    await firebase
      .database()
      .ref(`files/${file.key}`)
      .update({ fileName: newName });

    document.getElementById("rename-modal").classList.add("hidden");
    loadFilesFromFirebase();
  } catch (e) {
    alert("Lỗi đổi tên: " + e.message);
  }
}

// --- DELETE ---
async function handleDelete(key, fileId) {
  try {
    await fetch(CONFIG.DELETE_FILE_URL, {
      method: "POST",
      body: JSON.stringify({ fileId }),
    });
    await firebase
      .database()
      .ref("files/" + key)
      .remove();
    loadFilesFromFirebase();
  } catch (e) {
    alert("Lỗi xóa: " + e.message);
  }
}

// --- SYNC ---
async function handleSync() {
  const btn = document.getElementById("sync-btn");
  btn.classList.add("fa-spin");
  try {
    // Backup logic omitted for brevity, similar to desktop
    await fetch(CONFIG.SYNC_URL, {
      method: "POST",
      body: JSON.stringify({ folderId: CONFIG.FOLDER_ID }),
    });
    loadFilesFromFirebase();
  } catch (e) {
    alert("Lỗi: " + e.message);
  } finally {
    btn.classList.remove("fa-spin");
  }
}

// --- HELPERS ---
function getFileType(name) {
  if (name.match(/\.(jpg|jpeg|png|gif)$/i))
    return { name: "Hình ảnh", icon: "fa-file-image", color: "#e67e22" };
  if (name.match(/\.(pdf)$/i))
    return { name: "PDF", icon: "fa-file-pdf", color: "#8e44ad" };
  if (name.match(/\.(doc|docx)$/i))
    return { name: "Word", icon: "fa-file-word", color: "#2b579a" };
  return { name: "Khác", icon: "fa-file", color: "#95a5a6" };
}

function updateFilters() {
  const tagContainer = document.getElementById("tag-filters");
  const typeContainer = document.getElementById("type-filters");

  // Extract Unique Tags
  const tags = new Set();
  ALL_FILES_DATA.forEach((f) =>
    f.tag.split(",").forEach((t) => tags.add(t.trim()))
  );

  tagContainer.innerHTML =
    `<div class="filter-chip active" onclick="toggleFilter(this, 'tag', 'ALL')">Tất cả</div>` +
    Array.from(tags)
      .map(
        (t) =>
          `<div class="filter-chip" onclick="toggleFilter(this, 'tag', '${t}')">${t}</div>`
      )
      .join("");

  // Extract Unique Types
  const types = new Set(
    ALL_FILES_DATA.map((f) => getFileType(f.fileName).name)
  );
  typeContainer.innerHTML =
    `<div class="filter-chip active" onclick="toggleFilter(this, 'type', 'ALL')">Tất cả</div>` +
    Array.from(types)
      .map(
        (t) =>
          `<div class="filter-chip" onclick="toggleFilter(this, 'type', '${t}')">${t}</div>`
      )
      .join("");
}

window.toggleFilter = (el, type, val) => {
  const set = type === "tag" ? ACTIVE_TAGS : ACTIVE_TYPES;
  const container =
    type === "tag"
      ? document.getElementById("tag-filters")
      : document.getElementById("type-filters");
  const allChip = container.firstElementChild;

  if (val === "ALL") {
    set.clear();
    set.add("ALL");
    Array.from(container.children).forEach((c) => c.classList.remove("active"));
    el.classList.add("active");
  } else {
    allChip.classList.remove("active");
    set.delete("ALL");
    if (set.has(val)) {
      set.delete(val);
      el.classList.remove("active");
    } else {
      set.add(val);
      el.classList.add("active");
    }
    if (set.size === 0) {
      set.add("ALL");
      allChip.classList.add("active");
    }
  }
  renderFileList(document.getElementById("search-input").value);
};
