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
let currentSelectedFile = null;
let currentSortMode = "newest";

document.addEventListener("DOMContentLoaded", () => {
  // --- LOGIN LOGIC ---
  const loginScreen = document.getElementById("login-screen");
  const passInput = document.getElementById("pass-input");
  const loginBtn = document.getElementById("btn-login");
  const loginError = document.getElementById("login-error");
  const btnText = loginBtn.querySelector(".btn-text");
  const spinner = loginBtn.querySelector(".spinner");

  if (sessionStorage.getItem("myDrive_isLoggedIn") === "true") {
    showApp(false); // No delay if already logged in
  }

  loginBtn.addEventListener("click", checkLogin);
  passInput.addEventListener("keyup", (e) => {
    if (e.key === "Enter") checkLogin();
  });

  function checkLogin() {
    if (passInput.value === MY_PASSWORD) {
      // Show loading state
      btnText.classList.add("hidden");
      spinner.classList.remove("hidden");
      loginBtn.disabled = true;
      loginError.classList.add("hidden");

      // Simulate network delay for effect
      setTimeout(() => {
        sessionStorage.setItem("myDrive_isLoggedIn", "true");
        showApp(true); // With fade transition
      }, 1500);
    } else {
      loginError.classList.remove("hidden");
      // Shake animation trigger reset
      loginError.style.animation = "none";
      loginError.offsetHeight; /* trigger reflow */
      loginError.style.animation = null;
    }
  }

  function showApp(withTransition) {
    if (withTransition) {
      loginScreen.style.opacity = "0";
      loginScreen.style.transition = "opacity 0.5s ease";
      setTimeout(() => {
        loginScreen.classList.add("hidden");
        document.getElementById("app-screen").classList.remove("hidden");
        initializeApp();
      }, 500);
    } else {
      loginScreen.classList.add("hidden");
      document.getElementById("app-screen").classList.remove("hidden");
      initializeApp();
    }
  }

  // --- UI INTERACTIONS ---
  // Drawer
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
  document.getElementById("reset-filter-btn").onclick = () => {
    ACTIVE_TAGS.clear();
    ACTIVE_TAGS.add("ALL");
    ACTIVE_TYPES.clear();
    ACTIVE_TYPES.add("ALL");
    updateFiltersUI();
    renderFileList(document.getElementById("search-input").value);
  };

  // Upload
  document.getElementById("fab-upload").onclick = () => {
    document.getElementById("upload-modal").classList.remove("hidden");
    resetUploadForm();
  };
  document.getElementById("cancel-upload").onclick = () =>
    document.getElementById("upload-modal").classList.add("hidden");

  document.getElementById("file-input").onchange = (e) => {
    if (e.target.files.length) {
      document.getElementById("file-name-display").innerText =
        e.target.files[0].name;
      document.getElementById("upload-rename-box").classList.remove("hidden");
      document.getElementById("upload-filename-input").value =
        e.target.files[0].name;
    }
  };
  document.getElementById("add-tag-btn").onclick = addTag;
  document.getElementById("confirm-upload").onclick = handleUpload;

  // Search & Sort
  document
    .getElementById("search-input")
    .addEventListener("input", (e) => renderFileList(e.target.value));
  document.getElementById("sort-btn").onclick = () =>
    document.getElementById("sort-sheet").classList.remove("hidden");
  document.getElementById("close-sort").onclick = () =>
    document.getElementById("sort-sheet").classList.add("hidden");

  document.querySelectorAll(".sort-option").forEach((btn) => {
    btn.onclick = () => {
      currentSortMode = btn.dataset.sort;
      document
        .querySelectorAll(".sort-option")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById("sort-sheet").classList.add("hidden");
      renderFileList(document.getElementById("search-input").value);
    };
  });

  // Sync
  document.getElementById("sync-btn").onclick = () => handleSync(false);

  // Action Sheet & Rename
  document.getElementById("sheet-close").onclick = () =>
    document.getElementById("action-sheet").classList.add("hidden");
  document.getElementById("cancel-rename").onclick = () =>
    document.getElementById("rename-modal").classList.add("hidden");
});

function initializeApp() {
  if (typeof firebase !== "undefined" && !firebase.apps.length)
    firebase.initializeApp(CONFIG.FIREBASE);
  loadFilesFromFirebase();

  // Auto sync quietly on load
  setTimeout(() => {
    handleSync(true);
  }, 1000);
}

function resetUploadForm() {
  currentUploadTags = [];
  renderUploadTags();
  document.getElementById("file-input").value = "";
  document.getElementById("file-name-display").innerText = "Chọn file...";
  document.getElementById("upload-rename-box").classList.add("hidden");
  document.getElementById("upload-filename-input").value = "";
  document.getElementById("upload-status").innerText = "";
}

// --- TAG INPUT LOGIC ---
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

function renderUploadTags() {
  const div = document.getElementById("upload-tags-list");
  div.innerHTML = currentUploadTags
    .map(
      (t, i) =>
        `<span class="upload-tag-chip" onclick="removeUploadTag(${i})">${t} &times;</span>`
    )
    .join("");
}
window.removeUploadTag = (i) => {
  currentUploadTags.splice(i, 1);
  renderUploadTags();
};

// --- LOAD & RENDER ---
function loadFilesFromFirebase() {
  const db = firebase.database();
  const list = document.getElementById("file-list");
  if (!list.querySelector(".file-item")) {
    list.innerHTML = '<li class="loading-msg">Đang tải dữ liệu...</li>';
  }

  db.ref("files")
    .once("value")
    .then((snapshot) => {
      const data = snapshot.val();
      ALL_FILES_DATA = [];
      if (data) {
        Object.entries(data).forEach(([key, file]) => {
          ALL_FILES_DATA.push({
            key: key,
            ...file,
            tag: file.tag || "Khác",
            isPinned: file.isPinned || false,
          });
        });
      }
      ALL_FILES_DATA.reverse(); // Default loaded
      updateFilterChips();
      renderFileList(document.getElementById("search-input").value);
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

  // Sort Logic
  filtered.sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;

    switch (currentSortMode) {
      case "name-asc":
        return a.fileName.localeCompare(b.fileName);
      case "name-desc":
        return b.fileName.localeCompare(a.fileName);
      case "type":
        return getFileType(a.fileName).name.localeCompare(
          getFileType(b.fileName).name
        );
      case "newest":
      default:
        return 0; // Đã reverse lúc load
    }
  });

  count.innerText = filtered.length;
  list.innerHTML = "";

  if (filtered.length === 0) {
    list.innerHTML =
      '<div style="text-align:center; padding:40px; color:#9ca3af">Không tìm thấy file nào</div>';
    return;
  }

  filtered.forEach((file) => {
    const typeInfo = getFileType(file.fileName);
    const tagsHTML = file.tag
      .split(",")
      .map((t) => `<span class="tag-badge">${t.trim()}</span>`)
      .join("");
    const pinnedClass = file.isPinned ? "show" : "";

    const li = document.createElement("li");
    li.className = "file-item";
    li.innerHTML = `
            <i class="fa-solid ${typeInfo.icon} file-icon" style="color:${typeInfo.color}"></i>
            <div class="file-info" onclick="window.open('${file.viewLink}', '_blank')">
                <div class="file-name">${file.fileName}</div>
                <div class="file-meta">
                    <i class="fa-solid fa-star pinned-icon ${pinnedClass}"></i>
                    <div class="file-tags">${tagsHTML}</div>
                </div>
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

  // Pin Toggle UI
  const pinBtnText = document.getElementById("sheet-pin-text");
  const pinBtnIcon = document.getElementById("sheet-pin-icon");
  if (file.isPinned) {
    pinBtnText.innerText = "Bỏ ghim";
    pinBtnIcon.className = "fa-solid fa-star";
    pinBtnIcon.style.color = "var(--gold-star)";
  } else {
    pinBtnText.innerText = "Ghim file";
    pinBtnIcon.className = "fa-regular fa-star";
    pinBtnIcon.style.color = "var(--text-light)";
  }

  document.getElementById("action-sheet").classList.remove("hidden");

  // Handle Buttons
  document.getElementById("sheet-pin").onclick = () => {
    togglePin(file.key, file.isPinned);
    document.getElementById("action-sheet").classList.add("hidden");
  };

  document.getElementById("sheet-delete").onclick = () => {
    if (confirm(`Xóa vĩnh viễn "${file.fileName}"?`)) {
      handleDelete(file.key, file.fileId);
      document.getElementById("action-sheet").classList.add("hidden");
    }
  };

  document.getElementById("sheet-rename").onclick = () => {
    document.getElementById("action-sheet").classList.add("hidden");
    document.getElementById("rename-modal").classList.remove("hidden");
    document.getElementById("rename-input").value = file.fileName;
    document.getElementById("confirm-rename").onclick = () =>
      handleRename(file);
  };
};

// --- ASYNC ACTIONS ---
async function togglePin(key, currentStatus) {
  const newStatus = !currentStatus;
  await firebase.database().ref(`files/${key}`).update({ isPinned: newStatus });
  const file = ALL_FILES_DATA.find((f) => f.key === key);
  if (file) file.isPinned = newStatus;
  renderFileList(document.getElementById("search-input").value);
}

async function handleUpload() {
  const fileInput = document.getElementById("file-input");
  const file = fileInput.files[0];
  const nameInput = document.getElementById("upload-filename-input");
  if (!file) return alert("Chưa chọn file!");

  const status = document.getElementById("upload-status");
  status.innerText = "Đang upload...";

  const tags =
    currentUploadTags.length > 0 ? currentUploadTags.join(", ") : "Khác";
  const finalName = nameInput.value.trim() || file.name;

  try {
    const tokenRes = await fetch(CONFIG.GET_TOKEN_URL);
    const { accessToken } = await tokenRes.json();

    const metadata = {
      name: finalName,
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
      isPinned: false,
    };
    await fetch(CONFIG.SAVE_DB_URL, {
      method: "POST",
      body: JSON.stringify(payload),
    });

    // Patch Tag
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
      loadFilesFromFirebase();
    }, 1000);
  } catch (e) {
    alert("Lỗi: " + e.message);
    status.innerText = "";
  }
}

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

async function handleSync(silent = false) {
  const btn = document.getElementById("sync-btn");
  const originalHTML = btn.innerHTML;

  if (silent !== true) {
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    btn.disabled = true;
  }

  try {
    // 1. Get Access Token
    const tokenRes = await fetch(CONFIG.GET_TOKEN_URL);
    const { accessToken } = await tokenRes.json();

    // 2. Fetch Drive Files
    const q = `'${CONFIG.FOLDER_ID}' in parents and trashed = false`;
    const driveRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
        q
      )}&fields=files(id,name,webViewLink,webContentLink,mimeType)&pageSize=1000`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const driveData = await driveRes.json();
    const driveFiles = driveData.files || [];

    // 3. Fetch Firebase
    const snapshot = await firebase.database().ref("files").once("value");
    const currentData = snapshot.val() || {};

    const metaMap = {};
    Object.entries(currentData).forEach(([key, f]) => {
      if (f.fileId)
        metaMap[f.fileId] = {
          key: key,
          tag: f.tag,
          isPinned: f.isPinned || false,
        };
    });

    const newDbData = {};
    driveFiles.forEach((file) => {
      const meta = metaMap[file.id];
      const rowKey = meta
        ? meta.key
        : firebase.database().ref("files").push().key;

      newDbData[rowKey] = {
        fileId: file.id,
        fileName: file.name,
        viewLink: file.webViewLink,
        downloadLink: file.webContentLink || file.webViewLink,
        tag: meta ? meta.tag : "Khác",
        isPinned: meta ? meta.isPinned : false,
      };
    });

    // 4. Update Firebase
    await firebase.database().ref("files").set(newDbData);

    loadFilesFromFirebase();
  } catch (e) {
    console.error(e);
    if (silent !== true) alert("Lỗi Sync: " + e.message);
  } finally {
    if (silent !== true) {
      btn.innerHTML = originalHTML;
      btn.disabled = false;
    }
  }
}

// --- HELPERS ---
function getFileType(name) {
  if (name.match(/\.(jpg|jpeg|png|gif|bmp|webp)$/i))
    return { name: "Hình ảnh", icon: "fa-file-image", color: "#e67e22" };
  if (name.match(/\.(pdf)$/i))
    return { name: "PDF", icon: "fa-file-pdf", color: "#8e44ad" };
  if (name.match(/\.(doc|docx)$/i))
    return { name: "Word", icon: "fa-file-word", color: "#2b579a" };
  if (name.match(/\.(xls|xlsx|csv)$/i))
    return { name: "Excel", icon: "fa-file-excel", color: "#217346" };
  if (name.match(/\.(ppt|pptx)$/i))
    return { name: "PowerPoint", icon: "fa-file-powerpoint", color: "#d24726" };
  if (name.match(/\.(zip|rar|7z)$/i))
    return { name: "Nén", icon: "fa-file-zipper", color: "#f1c40f" };
  return { name: "Khác", icon: "fa-file", color: "#9ca3af" };
}

function updateFilterChips() {
  const tagContainer = document.getElementById("tag-filters");
  const typeContainer = document.getElementById("type-filters");

  // Tags
  const tags = new Set();
  ALL_FILES_DATA.forEach((f) =>
    f.tag.split(",").forEach((t) => tags.add(t.trim()))
  );

  let tagHTML = `<div class="filter-chip ${
    ACTIVE_TAGS.has("ALL") ? "active" : ""
  }" onclick="toggleFilter('tag', 'ALL')">Tất cả</div>`;
  Array.from(tags)
    .sort()
    .forEach((t) => {
      tagHTML += `<div class="filter-chip ${
        ACTIVE_TAGS.has(t) ? "active" : ""
      }" onclick="toggleFilter('tag', '${t}')">${t}</div>`;
    });
  tagContainer.innerHTML = tagHTML;

  // Types
  const types = new Set(
    ALL_FILES_DATA.map((f) => getFileType(f.fileName).name)
  );
  let typeHTML = `<div class="filter-chip ${
    ACTIVE_TYPES.has("ALL") ? "active" : ""
  }" onclick="toggleFilter('type', 'ALL')">Tất cả</div>`;
  Array.from(types)
    .sort()
    .forEach((t) => {
      typeHTML += `<div class="filter-chip ${
        ACTIVE_TYPES.has(t) ? "active" : ""
      }" onclick="toggleFilter('type', '${t}')">${t}</div>`;
    });
  typeContainer.innerHTML = typeHTML;
}

function updateFiltersUI() {
  updateFilterChips();
}

window.toggleFilter = (type, val) => {
  const set = type === "tag" ? ACTIVE_TAGS : ACTIVE_TYPES;
  if (val === "ALL") {
    set.clear();
    set.add("ALL");
  } else {
    if (set.has("ALL")) set.delete("ALL");
    if (set.has(val)) set.delete(val);
    else set.add(val);
    if (set.size === 0) set.add("ALL");
  }
  updateFiltersUI();
  renderFileList(document.getElementById("search-input").value);
};
