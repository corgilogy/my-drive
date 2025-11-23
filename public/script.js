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
let currentSortMode = "newest";

document.addEventListener("DOMContentLoaded", () => {
  const loginOverlay = document.getElementById("login-overlay");
  const mainApp = document.getElementById("main-app");
  const passwordInput = document.getElementById("password-input");
  const loginBtn = document.getElementById("login-btn");
  const errorMsg = document.getElementById("error-message");

  const btnText = loginBtn ? loginBtn.querySelector(".btn-text") : null;
  const spinner = loginBtn ? loginBtn.querySelector(".spinner") : null;

  const modal = document.getElementById("upload-modal-overlay");
  const btnOpenModal = document.getElementById("btn-open-modal");
  const btnCloseModal = document.getElementById("btn-close-modal");
  const btnCancelUpload = document.getElementById("btn-cancel-upload");

  const fileInput = document.getElementById("fileInput");
  const fileNameDisplay = document.getElementById("fileNameDisplay");
  const uploadFileNameInput = document.getElementById("uploadFileNameInput");
  const renameContainer = document.getElementById("rename-upload-container");

  const tagInput = document.getElementById("tagInput");
  const addTagBtn = document.getElementById("add-tag-btn");
  const sortSelect = document.getElementById("sort-select");

  startClock();

  if (btnOpenModal) {
    btnOpenModal.onclick = () => {
      modal.classList.remove("hidden");
      resetUploadForm();
    };
  }
  const closeModalFunc = () => modal.classList.add("hidden");
  if (btnCloseModal) btnCloseModal.onclick = closeModalFunc;
  if (btnCancelUpload) btnCancelUpload.onclick = closeModalFunc;

  if (addTagBtn && tagInput) {
    addTagBtn.addEventListener("click", () => addTagToList(tagInput));
    tagInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        addTagToList(tagInput);
      }
    });
  }

  document
    .getElementById("search-input")
    .addEventListener("input", (e) => renderFilesTable(e.target.value));
  if (sortSelect) {
    sortSelect.addEventListener("change", (e) => {
      currentSortMode = e.target.value;
      renderFilesTable(document.getElementById("search-input").value);
    });
  }

  if (fileInput) {
    fileInput.addEventListener("change", (e) => {
      if (e.target.files.length > 0) {
        const file = e.target.files[0];
        fileNameDisplay.innerText = file.name;
        fileNameDisplay.style.color = "#4f46e5";
        fileNameDisplay.style.fontWeight = "bold";
        renameContainer.classList.remove("hidden");
        uploadFileNameInput.value = file.name;
      } else {
        fileNameDisplay.innerText = "Nhấn để chọn file";
        fileNameDisplay.style.color = "#4f46e5";
        fileNameDisplay.style.fontWeight = "600";
        renameContainer.classList.add("hidden");
      }
    });
  }

  if (sessionStorage.getItem("myDrive_isLoggedIn") === "true") unlockApp(false);
  else if (passwordInput) passwordInput.focus();

  if (loginBtn) loginBtn.addEventListener("click", checkLogin);
  if (passwordInput)
    passwordInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") checkLogin();
    });

  function checkLogin() {
    if (passwordInput.value === MY_PASSWORD) {
      if (btnText) btnText.classList.add("hidden");
      if (spinner) spinner.classList.remove("hidden");
      loginBtn.disabled = true;
      errorMsg.classList.add("hidden");

      setTimeout(() => {
        sessionStorage.setItem("myDrive_isLoggedIn", "true");
        unlockApp(true);
      }, 1500);
    } else {
      errorMsg.classList.remove("hidden");
      errorMsg.style.animation = "none";
      errorMsg.offsetHeight;
      errorMsg.style.animation = null;
      passwordInput.value = "";
      passwordInput.focus();
    }
  }

  function unlockApp(withTransition) {
    if (withTransition && loginOverlay) {
      loginOverlay.style.opacity = "0";
      loginOverlay.style.transition = "opacity 0.5s ease";
      setTimeout(() => {
        loginOverlay.style.display = "none";
        if (mainApp) mainApp.classList.remove("hidden");
        initializeAppLogic();
      }, 500);
    } else {
      if (loginOverlay) loginOverlay.style.display = "none";
      if (mainApp) mainApp.classList.remove("hidden");
      initializeAppLogic();
    }
  }
});

function startClock() {
  const dateEl = document.getElementById("current-date");
  const timeEl = document.getElementById("current-time");
  if (!dateEl || !timeEl) return;
  function update() {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, "0");
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const year = now.getFullYear();
    dateEl.innerText = `${day}/${month}/${year}`;
    const hrs = String(now.getHours()).padStart(2, "0");
    const min = String(now.getMinutes()).padStart(2, "0");
    const sec = String(now.getSeconds()).padStart(2, "0");
    timeEl.innerText = `${hrs}:${min}:${sec}`;
  }
  update();
  setInterval(update, 1000);
}

function resetUploadForm() {
  document.getElementById("fileInput").value = "";
  document.getElementById("fileNameDisplay").innerText = "Nhấn để chọn file";
  document.getElementById("fileNameDisplay").style.color = "#4f46e5";
  document.getElementById("tagInput").value = "";
  document.getElementById("progress-status").innerText = "";
  document.getElementById("rename-upload-container").classList.add("hidden");
  document.getElementById("uploadFileNameInput").value = "";
  currentUploadTags = [];
  renderUploadTags();
}

function initializeAppLogic() {
  if (typeof firebase !== "undefined" && !firebase.apps.length)
    firebase.initializeApp(CONFIG.FIREBASE);

  document.getElementById("upload_btn").onclick = handleUpload;
  document.getElementById("sync_btn").onclick = () => handleSync(false);

  loadFilesFromFirebase();

  setTimeout(() => {
    handleSync(true);
  }, 1500);
}

function addTagToList(inputElement) {
  let val = inputElement.value.trim();
  if (!val) return;
  val = val.charAt(0).toUpperCase() + val.slice(1);
  if (!currentUploadTags.includes(val)) {
    currentUploadTags.push(val);
    renderUploadTags();
  }
  inputElement.value = "";
  inputElement.focus();
}

function renderUploadTags() {
  const container = document.getElementById("selected-tags-container");
  container.innerHTML = "";
  currentUploadTags.forEach((tag, index) => {
    const chip = document.createElement("div");
    chip.className = "upload-tag-chip";
    chip.innerHTML = `${tag} <i class="fa-solid fa-xmark" onclick="removeUploadTag(${index})"></i>`;
    container.appendChild(chip);
  });
}

window.removeUploadTag = function (index) {
  currentUploadTags.splice(index, 1);
  renderUploadTags();
};

async function handleUpload() {
  const fileInput = document.getElementById("fileInput");
  const file = fileInput.files[0];
  const nameInput = document.getElementById("uploadFileNameInput");
  const statusDiv = document.getElementById("progress-status");

  if (!file) return alert("Vui lòng chọn file!");

  const tagInput = document.getElementById("tagInput");
  if (tagInput.value.trim()) addTagToList(tagInput);

  let finalTagString =
    currentUploadTags.length > 0 ? currentUploadTags.join(", ") : "Khác";
  let finalFileName = nameInput.value.trim() || file.name;

  statusDiv.innerText = "⏳ Đang tải lên Drive...";
  statusDiv.style.color = "#e67e22";

  try {
    const tokenRes = await fetch(CONFIG.GET_TOKEN_URL);
    if (!tokenRes.ok) throw new Error("Lỗi Token");
    const { accessToken } = await tokenRes.json();

    const metadata = {
      name: finalFileName,
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
    if (driveFile.error) throw new Error(driveFile.error.message);

    statusDiv.innerText = "💾 Đang lưu Database...";

    const payload = {
      fileId: driveFile.id,
      fileName: driveFile.name,
      viewLink: driveFile.webViewLink,
      downloadLink: driveFile.webContentLink,
      tag: finalTagString,
      isPinned: false,
    };

    await fetch(CONFIG.SAVE_DB_URL, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    await patchTagForFile(driveFile.id, finalTagString);

    statusDiv.innerText = "✅ Upload thành công!";
    statusDiv.style.color = "green";

    loadFilesFromFirebase();
    setTimeout(() => {
      document.getElementById("upload-modal-overlay").classList.add("hidden");
    }, 1000);
  } catch (error) {
    console.error(error);
    statusDiv.innerText = "❌ Lỗi: " + error.message;
    statusDiv.style.color = "red";
  }
}

async function patchTagForFile(fileId, tag) {
  const db = firebase.database();
  const snapshot = await db
    .ref("files")
    .orderByChild("fileId")
    .equalTo(fileId)
    .once("value");
  const data = snapshot.val();
  if (data) {
    const key = Object.keys(data)[0];
    await db.ref(`files/${key}`).update({ tag: tag });
  }
}

async function handleSync(silent = false) {
  const btnSync = document.getElementById("sync_btn");
  const originalHTML = btnSync.innerHTML;

  if (!silent) {
    btnSync.innerHTML =
      '<i class="fa-solid fa-spinner fa-spin"></i> Đang đồng bộ...';
    btnSync.disabled = true;
  }

  try {
    const tokenRes = await fetch(CONFIG.GET_TOKEN_URL);
    if (!tokenRes.ok) throw new Error("Không lấy được Token");
    const { accessToken } = await tokenRes.json();

    let allDriveFiles = [];
    let pageToken = null;
    const q = `'${CONFIG.FOLDER_ID}' in parents and trashed = false`;

    do {
      let url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
        q
      )}&fields=nextPageToken,files(id,name,webViewLink,webContentLink,mimeType)&pageSize=1000&_t=${Date.now()}`;
      if (pageToken) {
        url += `&pageToken=${pageToken}`;
      }

      const driveRes = await fetch(url, {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });

      const driveData = await driveRes.json();
      if (driveData.files) {
        allDriveFiles = allDriveFiles.concat(driveData.files);
      }
      pageToken = driveData.nextPageToken;
    } while (pageToken);

    const fbSnap = await firebase.database().ref("files").once("value");
    const fbFiles = fbSnap.val() || {};

    const fbIdToKeyMap = {};
    Object.entries(fbFiles).forEach(([key, val]) => {
      if (val.fileId) fbIdToKeyMap[val.fileId] = key;
    });

    const updates = {};
    const driveFileIds = new Set();

    allDriveFiles.forEach((dFile) => {
      driveFileIds.add(dFile.id);
      const existingKey = fbIdToKeyMap[dFile.id];

      if (existingKey) {
        updates[`files/${existingKey}/fileName`] = dFile.name;
        updates[`files/${existingKey}/viewLink`] = dFile.webViewLink;
        updates[`files/${existingKey}/downloadLink`] =
          dFile.webContentLink || dFile.webViewLink;
      } else {
        const newKey = firebase.database().ref("files").push().key;
        updates[`files/${newKey}`] = {
          fileId: dFile.id,
          fileName: dFile.name,
          viewLink: dFile.webViewLink,
          downloadLink: dFile.webContentLink || dFile.webViewLink,
          tag: "Khác",
          isPinned: false,
        };
      }
    });

    Object.entries(fbFiles).forEach(([key, val]) => {
      if (val.fileId && !driveFileIds.has(val.fileId)) {
        updates[`files/${key}`] = null;
      }
    });

    if (Object.keys(updates).length > 0) {
      await firebase.database().ref().update(updates);
    }

    loadFilesFromFirebase();
  } catch (error) {
    console.error("Lỗi Sync:", error);
    if (!silent) console.warn("Lỗi đồng bộ: " + error.message);
  } finally {
    if (!silent) {
      btnSync.innerHTML = originalHTML;
      btnSync.disabled = false;
    }
  }
}

function loadFilesFromFirebase() {
  const db = firebase.database();
  const tbody = document.getElementById("file-list");

  if (tbody.innerHTML.trim() === "") {
    tbody.innerHTML =
      '<tr><td colspan="3" class="loading-text">Đang tải dữ liệu...</td></tr>';
  }

  db.ref("files")
    .once("value")
    .then((snapshot) => {
      const data = snapshot.val();
      ALL_FILES_DATA = [];
      if (!data) {
        tbody.innerHTML =
          '<tr><td colspan="3" style="text-align:center; padding:20px;">Chưa có file nào</td></tr>';
        updateFilters([], []);
        return;
      }
      Object.entries(data).forEach(([key, file]) => {
        ALL_FILES_DATA.push({
          key: key,
          ...file,
          tag: file.tag || "Khác",
          isPinned: file.isPinned || false,
        });
      });
      ALL_FILES_DATA.reverse();
      updateDatalist(ALL_FILES_DATA);
      updateFilters(ALL_FILES_DATA);
      renderFilesTable(document.getElementById("search-input").value);
    });
}

function getUniqueTags(files) {
  const tagSet = new Set();
  files.forEach((f) =>
    f.tag
      .split(",")
      .map((t) => t.trim())
      .forEach((t) => tagSet.add(t))
  );
  return Array.from(tagSet).sort();
}

function updateDatalist(files) {
  const datalist = document.getElementById("existing-tags");
  const tags = getUniqueTags(files);
  datalist.innerHTML = "";
  tags.forEach((tag) => {
    const option = document.createElement("option");
    option.value = tag;
    datalist.appendChild(option);
  });
}

function updateFilters(files) {
  const tagContainer = document.getElementById("tag-filter-list");
  const tags = getUniqueTags(files);

  let tagHTML = `<label class="filter-item"><input type="checkbox" value="ALL" class="tag-cb" ${
    ACTIVE_TAGS.has("ALL") ? "checked" : ""
  }> Tất cả</label>`;
  tags.forEach((tag) => {
    const isChecked = ACTIVE_TAGS.has(tag) ? "checked" : "";
    tagHTML += `<label class="filter-item"><input type="checkbox" value="${tag}" class="tag-cb" ${isChecked}> ${tag}</label>`;
  });
  tagContainer.innerHTML = tagHTML;

  const typeContainer = document.getElementById("type-filter-list");
  const types = new Set(files.map((f) => getFileType(f.fileName).name));

  let typeHTML = `<label class="filter-item"><input type="checkbox" value="ALL" class="type-cb" ${
    ACTIVE_TYPES.has("ALL") ? "checked" : ""
  }> Tất cả</label>`;
  types.forEach((type) => {
    const isChecked = ACTIVE_TYPES.has(type) ? "checked" : "";
    typeHTML += `<label class="filter-item"><input type="checkbox" value="${type}" class="type-cb" ${isChecked}> ${type}</label>`;
  });
  typeContainer.innerHTML = typeHTML;

  setupFilterEvents();
}

function setupFilterEvents() {
  document.querySelectorAll(".tag-cb").forEach((cb) =>
    cb.addEventListener("change", (e) => {
      handleCheckboxGroup(e.target, ".tag-cb", ACTIVE_TAGS);
      renderFilesTable(document.getElementById("search-input").value);
    })
  );
  document.querySelectorAll(".type-cb").forEach((cb) =>
    cb.addEventListener("change", (e) => {
      handleCheckboxGroup(e.target, ".type-cb", ACTIVE_TYPES);
      renderFilesTable(document.getElementById("search-input").value);
    })
  );
}

function handleCheckboxGroup(target, selector, activeSet) {
  const val = target.value;
  const allCb = document.querySelector(`${selector}[value="ALL"]`);
  if (val === "ALL") {
    if (target.checked) {
      document.querySelectorAll(selector).forEach((c) => {
        if (c.value !== "ALL") c.checked = false;
      });
      activeSet.clear();
      activeSet.add("ALL");
    } else target.checked = true;
  } else {
    allCb.checked = false;
    activeSet.delete("ALL");
    if (target.checked) activeSet.add(val);
    else activeSet.delete(val);
    if (activeSet.size === 0) {
      allCb.checked = true;
      activeSet.add("ALL");
    }
  }
}

function getFileType(fileName) {
  if (fileName.match(/\.(jpg|jpeg|png|gif|bmp|webp)$/i))
    return { name: "Hình ảnh", icon: "fa-file-image" };
  if (fileName.match(/\.(pdf)$/i)) return { name: "PDF", icon: "fa-file-pdf" };
  if (fileName.match(/\.(doc|docx)$/i))
    return { name: "Word", icon: "fa-file-word" };
  if (fileName.match(/\.(xls|xlsx|csv)$/i))
    return { name: "Excel", icon: "fa-file-excel" };
  if (fileName.match(/\.(ppt|pptx)$/i))
    return { name: "PowerPoint", icon: "fa-file-powerpoint" };
  if (fileName.match(/\.(zip|rar|7z)$/i))
    return { name: "Nén", icon: "fa-file-zipper" };
  return { name: "Khác", icon: "fa-file" };
}

function renderFilesTable(searchText = "") {
  const tbody = document.getElementById("file-list");

  let filtered = ALL_FILES_DATA.filter((file) => {
    const fileType = getFileType(file.fileName).name;
    const fileTags = file.tag.split(",").map((t) => t.trim());
    const matchTag =
      ACTIVE_TAGS.has("ALL") || fileTags.some((t) => ACTIVE_TAGS.has(t));
    const matchType = ACTIVE_TYPES.has("ALL") || ACTIVE_TYPES.has(fileType);
    const matchSearch = file.fileName
      .toLowerCase()
      .includes(searchText.toLowerCase());
    return matchTag && matchType && matchSearch;
  });

  filtered.sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;

    switch (currentSortMode) {
      case "name-asc":
        return a.fileName.localeCompare(b.fileName);
      case "name-desc":
        return b.fileName.localeCompare(a.fileName);
      case "type":
        const typeA = getFileType(a.fileName).name;
        const typeB = getFileType(b.fileName).name;
        return typeA.localeCompare(typeB);
      case "tag":
        return a.tag.localeCompare(b.tag);
      case "newest":
      default:
        return 0;
    }
  });

  tbody.innerHTML = "";
  if (filtered.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="3" style="text-align:center; padding:20px; color:#999">Không có dữ liệu phù hợp</td></tr>';
    return;
  }

  filtered.forEach((file) => {
    const typeInfo = getFileType(file.fileName);
    const tagsArr = file.tag.split(",").map((t) => t.trim());
    let tagsHTML = `<div class="tags-cell" onclick="enableEditTag('${file.key}', '${file.tag}')">`;
    tagsArr.forEach(
      (t) =>
        (tagsHTML += `<span class="tag-badge ${
          t === "Khác" ? "no-tag" : ""
        }">${t}</span>`)
    );
    tagsHTML += `</div>`;

    const pinIconClass = file.isPinned
      ? "fa-solid fa-star"
      : "fa-regular fa-star";
    const pinActiveClass = file.isPinned ? "active" : "";

    const tr = document.createElement("tr");
    tr.innerHTML = `
            <td>
                <div class="file-name-cell" id="name-cell-${file.key}">
                    <i class="fa-solid ${typeInfo.icon} file-icon"></i>
                    <span class="file-name-text" title="${file.fileName}">
                        <a href="${file.viewLink}" target="_blank" style="text-decoration:none; color:inherit;">${file.fileName}</a>
                    </span>
                    <div class="inline-actions">
                        <i class="fa-solid fa-pen action-icon-btn btn-rename" onclick="enableEditName('${file.key}', '${file.fileId}', '${file.fileName}')" title="Đổi tên"></i>
                        <a href="${file.downloadLink}" class="action-icon-btn btn-download" title="Tải xuống"><i class="fa-solid fa-download"></i></a>
                        <button class="action-icon-btn btn-delete" title="Xóa" id="btn-del-${file.key}" onclick="handleDelete('${file.key}', '${file.fileId}', '${file.fileName}')"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>
            </td>
            <td>
                <div class="pin-btn ${pinActiveClass}" onclick="togglePin('${file.key}', ${file.isPinned})">
                    <i class="${pinIconClass}"></i>
                </div>
            </td>
            <td id="tag-cell-${file.key}">
                ${tagsHTML}
            </td>
        `;
    tbody.appendChild(tr);
  });
}

async function togglePin(key, currentStatus) {
  const newStatus = !currentStatus;
  await firebase.database().ref(`files/${key}`).update({ isPinned: newStatus });
  const file = ALL_FILES_DATA.find((f) => f.key === key);
  if (file) file.isPinned = newStatus;
  renderFilesTable(document.getElementById("search-input").value);
}

function enableEditName(key, fileId, currentName) {
  const cell = document.getElementById(`name-cell-${key}`);
  cell.innerHTML = `
        <i class="fa-solid ${getFileType(currentName).icon} file-icon"></i>
        <input type="text" class="edit-input" value="${currentName}" id="input-name-${key}">
    `;
  const input = document.getElementById(`input-name-${key}`);
  input.focus();
  const saveHandler = () => saveNameEdit(key, fileId, input.value, currentName);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") input.blur();
  });
  input.addEventListener("blur", saveHandler);
}

async function saveNameEdit(key, fileId, newName, oldName) {
  newName = newName.trim();
  if (!newName || newName === oldName) {
    renderFilesTable(document.getElementById("search-input").value);
    return;
  }
  const cell = document.getElementById(`name-cell-${key}`);
  cell.innerHTML = `<span style="color:#e67e22; font-size:0.9rem">⏳ Đang lưu...</span>`;
  try {
    const tokenRes = await fetch(CONFIG.GET_TOKEN_URL);
    const { accessToken } = await tokenRes.json();
    await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: newName }),
    });
    await firebase.database().ref(`files/${key}`).update({ fileName: newName });
    const file = ALL_FILES_DATA.find((f) => f.key === key);
    if (file) file.fileName = newName;
    updateFilters(ALL_FILES_DATA);
    renderFilesTable(document.getElementById("search-input").value);
  } catch (error) {
    alert("❌ Lỗi đổi tên: " + error.message);
    renderFilesTable(document.getElementById("search-input").value);
  }
}

function enableEditTag(key, currentTag) {
  const cell = document.getElementById(`tag-cell-${key}`);
  cell.innerHTML = `<input type="text" class="edit-input" value="${currentTag}" onblur="saveTagEdit('${key}', this.value)" onkeydown="if(event.key==='Enter') this.blur()" placeholder="Tag1, Tag2...">`;
  cell.querySelector("input").focus();
}

async function saveTagEdit(key, newTag) {
  newTag = newTag.trim();
  if (!newTag) newTag = "Khác";
  const tagsFormatted = newTag
    .split(",")
    .map((t) => t.trim().charAt(0).toUpperCase() + t.trim().slice(1))
    .join(", ");
  await firebase.database().ref(`files/${key}`).update({ tag: tagsFormatted });
  const file = ALL_FILES_DATA.find((f) => f.key === key);
  if (file) file.tag = tagsFormatted;
  updateDatalist(ALL_FILES_DATA);
  updateFilters(ALL_FILES_DATA);
  renderFilesTable(document.getElementById("search-input").value);
}

async function handleDelete(key, fileId, fileName) {
  if (!confirm(`Bạn có chắc chắn muốn xóa file:\n"${fileName}"?`)) return;
  const btn = document.getElementById(`btn-del-${key}`);
  if (btn) btn.innerHTML = '<i class="fa-solid fa-spinner"></i>';
  try {
    await fetch(CONFIG.DELETE_FILE_URL, {
      method: "POST",
      body: JSON.stringify({ fileId }),
    });
    await firebase
      .database()
      .ref("files/" + key)
      .remove();
    ALL_FILES_DATA = ALL_FILES_DATA.filter((f) => f.key !== key);
    renderFilesTable();
    updateFilters(ALL_FILES_DATA);
  } catch (e) {
    alert("Lỗi xóa: " + e.message);
    if (btn) btn.innerHTML = '<i class="fa-solid fa-trash"></i>';
  }
}
