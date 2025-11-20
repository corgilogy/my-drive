// ==========================================
// 1. CẤU HÌNH & BẢO MẬT
// ==========================================
const MY_PASSWORD = "321321"; // Mật khẩu của bạn

const CONFIG = {
  // 👇 QUAN TRỌNG: Phải dùng đường dẫn đầy đủ tới Netlify
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

// ==========================================
// 2. LOGIC ĐĂNG NHẬP & KHỞI TẠO
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  const loginOverlay = document.getElementById("login-overlay");
  const mainApp = document.getElementById("main-app");
  const passwordInput = document.getElementById("password-input");
  const loginBtn = document.getElementById("login-btn");
  const errorMsg = document.getElementById("error-message");

  // Kiểm tra session
  if (sessionStorage.getItem("myDrive_isLoggedIn") === "true") {
    unlockApp();
  } else {
    if (passwordInput) passwordInput.focus();
  }

  // Sự kiện click nút Đăng nhập
  if (loginBtn) {
    loginBtn.addEventListener("click", checkLogin);
  }
  // Sự kiện nhấn Enter
  if (passwordInput) {
    passwordInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") checkLogin();
    });
  }

  function checkLogin() {
    if (passwordInput.value === MY_PASSWORD) {
      sessionStorage.setItem("myDrive_isLoggedIn", "true");
      unlockApp();
    } else {
      errorMsg.style.display = "block";
      passwordInput.value = "";
      passwordInput.focus();
    }
  }

  function unlockApp() {
    if (loginOverlay) loginOverlay.style.display = "none";
    if (mainApp) mainApp.style.display = "flex";

    // Chạy logic chính sau khi mở khóa
    initializeAppLogic();
  }
});

// ==========================================
// 3. LOGIC CHÍNH CỦA APP
// ==========================================
function initializeAppLogic() {
  console.log("App connecting to Netlify Functions...");

  if (typeof firebase !== "undefined" && !firebase.apps.length) {
    firebase.initializeApp(CONFIG.FIREBASE);
  }

  const btnUpload = document.getElementById("upload_btn");
  const btnRefresh = document.getElementById("refresh_btn");
  const btnSync = document.getElementById("sync_btn");

  if (btnUpload) btnUpload.onclick = handleUpload;
  if (btnRefresh) btnRefresh.onclick = loadFilesFromFirebase;
  if (btnSync) btnSync.onclick = handleSync;

  loadFilesFromFirebase();
}

// --- CÁC HÀM XỬ LÝ ---

async function handleUpload() {
  const fileInput = document.getElementById("fileInput");
  const file = fileInput.files[0];
  const statusDiv = document.getElementById("progress-status");

  if (!file) return alert("Vui lòng chọn file trước!");

  statusDiv.innerText = "⏳ Đang kết nối máy chủ...";
  statusDiv.style.color = "#e67e22";

  try {
    const tokenRes = await fetch(CONFIG.GET_TOKEN_URL);
    if (!tokenRes.ok)
      throw new Error("Lỗi Netlify lấy token (Kiểm tra link API)");
    const tokenData = await tokenRes.json();
    const accessToken = tokenData.accessToken;

    statusDiv.innerText = "⏳ Đang upload lên Google Drive...";

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

    const response = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink",
      {
        method: "POST",
        headers: new Headers({ Authorization: "Bearer " + accessToken }),
        body: form,
      }
    );

    const driveFile = await response.json();
    if (driveFile.error) throw new Error(driveFile.error.message);

    statusDiv.innerText = "💾 Đang lưu Database...";
    await saveToDatabase(driveFile);

    statusDiv.innerText = "✅ Hoàn tất!";
    statusDiv.style.color = "green";
    fileInput.value = "";
  } catch (error) {
    console.error(error);
    statusDiv.innerText = "❌ Lỗi: " + error.message;
    statusDiv.style.color = "red";
  }
}

async function saveToDatabase(fileData) {
  const payload = {
    fileId: fileData.id,
    fileName: fileData.name,
    viewLink: fileData.webViewLink,
    downloadLink: fileData.webContentLink,
  };

  const res = await fetch(CONFIG.SAVE_DB_URL, {
    method: "POST",
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error("Lỗi lưu Firebase");
  loadFilesFromFirebase();
}

function loadFilesFromFirebase() {
  if (typeof firebase === "undefined") return;

  const db = firebase.database();
  const list = document.getElementById("file-list");

  list.innerHTML =
    '<li style="text-align:center; color:#999">Đang cập nhật...</li>';

  db.ref("files")
    .once("value")
    .then((snapshot) => {
      list.innerHTML = "";
      const data = snapshot.val();

      if (!data) {
        list.innerHTML =
          '<li style="text-align:center; padding:10px; color:#999">Chưa có file nào</li>';
        return;
      }

      const entries = Object.entries(data).reverse();

      entries.forEach(([key, file]) => {
        const li = document.createElement("li");
        li.className = "file-item";
        li.innerHTML = `
                <span class="file-name" title="${file.fileName}">${file.fileName}</span>
                <div class="file-actions">
                    <a href="${file.viewLink}" target="_blank" class="link-btn view-link" title="Xem">👁️</a>
                    <a href="${file.downloadLink}" class="link-btn down-link" title="Tải xuống">⬇️</a>
                    <button class="link-btn del-link" title="Xóa" 
                        id="btn-del-${key}"
                        onclick="handleDelete('${key}', '${file.fileId}', '${file.fileName}')">🗑️</button>
                </div>
            `;
        list.appendChild(li);
      });
    })
    .catch((err) => {
      console.error(err);
      list.innerHTML =
        '<li style="color:red; text-align:center">Lỗi tải danh sách</li>';
    });
}

async function handleDelete(firebaseKey, googleFileId, fileName) {
  if (!confirm(`Bạn có chắc muốn xóa file "${fileName}" không?`)) return;

  const btnDelete = document.getElementById(`btn-del-${firebaseKey}`);
  if (btnDelete) {
    btnDelete.innerText = "⏳";
    btnDelete.disabled = true;
  }

  try {
    const res = await fetch(CONFIG.DELETE_FILE_URL, {
      method: "POST",
      body: JSON.stringify({ fileId: googleFileId }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn("Drive delete warning:", errText);
    }

    await firebase
      .database()
      .ref("files/" + firebaseKey)
      .remove();
    loadFilesFromFirebase();
    alert("✅ Đã xóa thành công!");
  } catch (error) {
    console.error(error);
    alert("❌ Lỗi: " + error.message);
    if (btnDelete) {
      btnDelete.innerText = "🗑️";
      btnDelete.disabled = false;
    }
  }
}

async function handleSync() {
  const btnSync = document.getElementById("sync_btn");
  const originalText = btnSync.innerText;

  if (!confirm("Đồng bộ lại danh sách từ Drive?")) return;

  btnSync.innerText = "⏳...";
  btnSync.disabled = true;

  try {
    const res = await fetch(CONFIG.SYNC_URL, {
      method: "POST",
      body: JSON.stringify({ folderId: CONFIG.FOLDER_ID }),
    });

    if (!res.ok) throw new Error("Lỗi Server Sync");
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    alert(`✅ Đồng bộ xong! (${data.count} file)`);
    loadFilesFromFirebase();
  } catch (error) {
    console.error(error);
    alert("❌ Lỗi: " + error.message);
  } finally {
    btnSync.innerText = originalText;
    btnSync.disabled = false;
  }
}
