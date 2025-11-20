// ==========================================
// 1. CẤU HÌNH (HÃY ĐIỀN 3 DÒNG ĐẦU TIÊN)
// ==========================================
const CONFIG = {
  // ⚠️ BẮT BUỘC THAY BẰNG MÃ CỦA BẠN
  CLIENT_ID:
    "511529666068-k3efqgqos81laubpval0ibgqjihas4nj.apps.googleusercontent.com",
  API_KEY: "AIzaSyAs51r-N13B7iFeTV1lyR5D_doShhnRf-s",

  // URL function sau khi deploy (Ví dụ: https://my-app.netlify.app/.netlify/functions/saveFile)
  // Nếu chạy localhost thì để trống hoặc localhost, nhưng quan trọng nhất là lúc Deploy
  NETLIFY_URL: "https://dnduc-drive.netlify.app/.netlify/functions/saveFile",

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
// 2. LOGIC CHƯƠNG TRÌNH
// ==========================================

// Đợi trang load xong mới chạy logic DOM
document.addEventListener("DOMContentLoaded", () => {
  firebase.initializeApp(CONFIG.FIREBASE);
  const db = firebase.database();

  // Gán sự kiện cho các nút bấm
  document.getElementById("authorize_button").onclick = handleAuthClick;
  document.getElementById("signout_button").onclick = handleSignoutClick;
  document.getElementById("upload_btn").onclick = handleUpload;
  document.getElementById("refresh_btn").onclick = loadFilesFromFirebase;
});

// Biến Global cần thiết cho Google Script gọi lại
const DISCOVERY_DOC =
  "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest";
const SCOPES = "https://www.googleapis.com/auth/drive.file";
let tokenClient;
let gapiInited = false;
let gisInited = false;

// --- Google Auth Functions ---
function gapiLoaded() {
  gapi.load("client", async () => {
    await gapi.client.init({
      apiKey: CONFIG.API_KEY,
      discoveryDocs: [DISCOVERY_DOC],
    });
    gapiInited = true;
    maybeEnableButtons();
  });
}

function gisLoaded() {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CONFIG.CLIENT_ID,
    scope: SCOPES,
    callback: "", // Sẽ được gán khi click nút
  });
  gisInited = true;
  maybeEnableButtons();
}

function maybeEnableButtons() {
  if (gapiInited && gisInited) {
    // Kiểm tra nếu đã có session từ trước (Tùy chọn)
    // Hiển thị nút đăng nhập
  }
}

function handleAuthClick() {
  tokenClient.callback = async (resp) => {
    if (resp.error) {
      console.error(resp);
      alert("Lỗi đăng nhập: " + JSON.stringify(resp));
      return;
    }
    toggleViews(true);
    loadFilesFromFirebase();
  };

  if (gapi.client.getToken() === null) {
    tokenClient.requestAccessToken({ prompt: "consent" });
  } else {
    tokenClient.requestAccessToken({ prompt: "" });
  }
}

function handleSignoutClick() {
  const token = gapi.client.getToken();
  if (token !== null) {
    google.accounts.oauth2.revoke(token.access_token);
    gapi.client.setToken("");
    toggleViews(false);
  }
}

// --- Upload Logic ---
async function handleUpload() {
  const fileInput = document.getElementById("fileInput");
  const file = fileInput.files[0];
  const statusDiv = document.getElementById("progress-status");

  if (!file) return alert("Vui lòng chọn file trước!");

  statusDiv.innerText = "⏳ Đang upload lên Google Drive...";
  statusDiv.style.color = "#e67e22";

  try {
    const accessToken = gapi.client.getToken().access_token;
    const metadata = { name: file.name, mimeType: file.type };
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

    statusDiv.innerText = "💾 Upload xong. Đang lưu vào Database...";

    // Gửi sang Netlify Function
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

  // Gọi Backend
  const res = await fetch(CONFIG.NETLIFY_URL, {
    method: "POST",
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error("Lỗi khi gọi Netlify Function: " + res.statusText);
  }

  loadFilesFromFirebase();
}

// --- UI & Helpers ---
function loadFilesFromFirebase() {
  const db = firebase.database(); // Lấy lại instance
  const list = document.getElementById("file-list");

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
      const files = Object.values(data).reverse();
      files.forEach((file) => {
        const li = document.createElement("li");
        li.className = "file-item";
        li.innerHTML = `
            <span class="file-name" title="${file.fileName}">${file.fileName}</span>
            <div class="file-actions">
                <a href="${file.viewLink}" target="_blank" class="link-btn view-link">👁️ Mở</a>
                <a href="${file.downloadLink}" class="link-btn down-link">⬇️ Tải</a>
            </div>
        `;
        list.appendChild(li);
      });
    });
}

function toggleViews(isLoggedIn) {
  if (isLoggedIn) {
    document.getElementById("auth-section").classList.add("hidden");
    document.getElementById("app-section").classList.remove("hidden");
  } else {
    document.getElementById("auth-section").classList.remove("hidden");
    document.getElementById("app-section").classList.add("hidden");
  }
}
