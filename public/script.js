// ==========================================
// 1. CẤU HÌNH & BẢO MẬT
// ==========================================
const MY_PASSWORD = "123456"; // <--- ĐỔI MẬT KHẨU Ở ĐÂY

const CONFIG = {
  // Đường dẫn đến các Netlify Functions (Backend)
  GET_TOKEN_URL: "/.netlify/functions/getToken",
  SAVE_DB_URL: "/.netlify/functions/saveFile",
  DELETE_FILE_URL: "/.netlify/functions/deleteFile",
  SYNC_URL: "/.netlify/functions/syncFiles",

  // ID thư mục trên Google Drive
  FOLDER_ID: "1i__DIWWEX7HYemtyZ5wqwaYcYfnW50a3",

  // Cấu hình Firebase
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

  // 1. Kiểm tra xem đã đăng nhập trong phiên này chưa
  if (sessionStorage.getItem("myDrive_isLoggedIn") === "true") {
    unlockApp();
  } else {
    // Nếu chưa, focus vào ô nhập password
    if (passwordInput) passwordInput.focus();
  }

  // 2. Xử lý sự kiện click nút Đăng nhập
  if (loginBtn) {
    loginBtn.addEventListener("click", checkLogin);
  }

  // 3. Xử lý sự kiện nhấn phím Enter
  if (passwordInput) {
    passwordInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") checkLogin();
    });
  }

  // Hàm kiểm tra mật khẩu
  function checkLogin() {
    if (passwordInput.value === MY_PASSWORD) {
      sessionStorage.setItem("myDrive_isLoggedIn", "true");
      unlockApp();
    } else {
      errorMsg.style.display = "block"; // Hiện thông báo lỗi
      passwordInput.value = "";
      passwordInput.focus();
    }
  }

  // Hàm mở khóa ứng dụng
  function unlockApp() {
    if (loginOverlay) loginOverlay.style.display = "none";
    if (mainApp) mainApp.style.display = "flex"; // Hoặc block tùy layout

    // Sau khi giao diện hiện lên, mới chạy logic kết nối Firebase
    initializeAppLogic();
  }
});

// ==========================================
// 3. LOGIC CHÍNH CỦA APP (CHỈ CHẠY KHI ĐÃ LOGIN)
// ==========================================
function initializeAppLogic() {
  console.log("App started...");

  // 1. Khởi tạo Firebase nếu chưa có
  if (typeof firebase !== "undefined" && !firebase.apps.length) {
    firebase.initializeApp(CONFIG.FIREBASE);
  }

  // 2. Gán sự kiện cho các nút chức năng (Upload, Refresh, Sync)
  const btnUpload = document.getElementById("upload_btn");
  const btnRefresh = document.getElementById("refresh_btn");
  const btnSync = document.getElementById("sync_btn");

  if (btnUpload) btnUpload.onclick = handleUpload;
  if (btnRefresh) btnRefresh.onclick = loadFilesFromFirebase;
  if (btnSync) btnSync.onclick = handleSync;

  // 3. Tải danh sách file lần đầu
  loadFilesFromFirebase();
}

// --- CÁC HÀM XỬ LÝ (UPLOAD, SYNC, DELETE...) ---

// Hàm Upload
async function handleUpload() {
  const fileInput = document.getElementById("fileInput");
  const file = fileInput.files[0];
  const statusDiv = document.getElementById("progress-status");

  if (!file) return alert("Vui lòng chọn file trước!");

  statusDiv.innerText = "⏳ Đang kết nối máy chủ...";
  statusDiv.style.color = "#e67e22";

  try {
    // Lấy token từ Netlify Function
    const tokenRes = await fetch(CONFIG.GET_TOKEN_URL);
    if (!tokenRes.ok) throw new Error("Lỗi Netlify lấy token");
    const tokenData = await tokenRes.json();
    const accessToken = tokenData.accessToken;

    statusDiv.innerText = "⏳ Đang upload lên Google Drive...";

    const metadata = {
      name: file.name,
      mimeType: file.type,
      parents: [CONFIG.FOLDER_ID],
    };

    // Tạo Form Data để gửi file
    const form = new FormData();
    form.append(
      "metadata",
      new Blob([JSON.stringify(metadata)], { type: "application/json" })
    );
    form.append("file", file);

    // Gửi lên Google Drive API
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
    fileInput.value = ""; // Xóa file đã chọn trong input
  } catch (error) {
    console.error(error);
    statusDiv.innerText = "❌ Lỗi: " + error.message;
    statusDiv.style.color = "red";
  }
}

// Hàm lưu thông tin file vào Firebase
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

// Hàm tải danh sách từ Firebase về giao diện
function loadFilesFromFirebase() {
  if (typeof firebase === "undefined") return; // Phòng hờ lỗi chưa load thư viện

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

      const entries = Object.entries(data).reverse(); // Đảo ngược để file mới nhất lên đầu

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

// Hàm xóa file
async function handleDelete(firebaseKey, googleFileId, fileName) {
  if (
    !confirm(
      `Bạn có chắc muốn xóa file "${fileName}" không?\n(Hành động này sẽ xóa vĩnh viễn trên Google Drive)`
    )
  ) {
    return;
  }

  const btnDelete = document.getElementById(`btn-del-${firebaseKey}`);
  if (btnDelete) {
    btnDelete.innerText = "⏳";
    btnDelete.disabled = true;
  }

  try {
    // 1. Xóa trên Drive qua Netlify Function
    const res = await fetch(CONFIG.DELETE_FILE_URL, {
      method: "POST",
      body: JSON.stringify({ fileId: googleFileId }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn("Drive delete warning:", errText);
    }

    // 2. Xóa trên Firebase
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

// Hàm đồng bộ (Sync)
async function handleSync() {
  const btnSync = document.getElementById("sync_btn");
  const originalText = btnSync.innerText;

  if (
    !confirm(
      "Đồng bộ sẽ lấy danh sách từ Google Drive và cập nhật lại Web.\nBạn có muốn tiếp tục?"
    )
  )
    return;

  btnSync.innerText = "⏳ Đang quét...";
  btnSync.disabled = true;

  try {
    const res = await fetch(CONFIG.SYNC_URL, {
      method: "POST",
      body: JSON.stringify({ folderId: CONFIG.FOLDER_ID }),
    });

    if (!res.ok) throw new Error("Lỗi kết nối Server Sync");

    const data = await res.json();
    if (data.error) throw new Error(data.error);

    alert(`✅ Đồng bộ xong! Tìm thấy ${data.count} file.`);
    loadFilesFromFirebase();
  } catch (error) {
    console.error(error);
    alert("❌ Lỗi đồng bộ: " + error.message);
  } finally {
    btnSync.innerText = originalText;
    btnSync.disabled = false;
  }
}
