// ==========================================
// 1. CẤU HÌNH (BẠN ĐIỀN THÔNG TIN VÀO ĐÂY)
// ==========================================
const CONFIG = {
  CLIENT_ID: "YOUR_CLIENT_ID", // Copy từ Google Cloud (Đuôi ...apps.googleusercontent.com)
  API_KEY: "YOUR_API_KEY", // Copy từ Google Cloud (Bắt đầu bằng AIza...)

  // URL Netlify Function sau khi deploy (Lúc test dưới máy thì dùng localhost)
  // Ví dụ: 'https://ten-app-cua-ban.netlify.app/.netlify/functions/saveFile'
  NETLIFY_URL: "YOUR_NETLIFY_URL/.netlify/functions/saveFile",

  FIREBASE: {
    // Copy từ Firebase Console > Project Settings
    apiKey: "YOUR_FIREBASE_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    databaseURL: "https://YOUR_PROJECT-default-rtdb.firebaseio.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "...",
    appId: "...",
  },
};

// ==========================================
// 2. KHỞI TẠO
// ==========================================
firebase.initializeApp(CONFIG.FIREBASE);
const db = firebase.database();

// Biến Google API
const DISCOVERY_DOC =
  "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest";
const SCOPES = "https://www.googleapis.com/auth/drive.file";
let tokenClient;
let gapiInited = false;
let gisInited = false;

// ==========================================
// 3. XỬ LÝ GOOGLE AUTH
// ==========================================
function gapiLoaded() {
  gapi.load("client", async () => {
    await gapi.client.init({
      apiKey: CONFIG.API_KEY,
      discoveryDocs: [DISCOVERY_DOC],
    });
    gapiInited = true;
    checkAuthLoaded();
  });
}

function gisLoaded() {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CONFIG.CLIENT_ID,
    scope: SCOPES,
    callback: "",
  });
  gisInited = true;
  checkAuthLoaded();
}

function checkAuthLoaded() {
  if (gapiInited && gisInited) {
    // Logic kiểm tra nếu đã đăng nhập thì hiện app luôn (tùy chọn)
  }
}

// Nút Đăng nhập
document.getElementById("authorize_button").onclick = () => {
  tokenClient.callback = async (resp) => {
    if (resp.error) throw resp;
    toggleViews(true); // Hiện giao diện App
    loadFilesFromFirebase(); // Tải danh sách
  };

  // Check token cũ hoặc xin mới
  if (gapi.client.getToken() === null) {
    tokenClient.requestAccessToken({ prompt: "consent" });
  } else {
    tokenClient.requestAccessToken({ prompt: "" });
  }
};

// Nút Đăng xuất
document.getElementById("signout_button").onclick = () => {
  const token = gapi.client.getToken();
  if (token !== null) {
    google.accounts.oauth2.revoke(token.access_token);
    gapi.client.setToken("");
    toggleViews(false); // Ẩn App, hiện nút login
  }
};

// ==========================================
// 4. XỬ LÝ UPLOAD (QUAN TRỌNG)
// ==========================================
document.getElementById("upload_btn").onclick = async () => {
  const fileInput = document.getElementById("fileInput");
  const file = fileInput.files[0];
  const statusDiv = document.getElementById("progress-status");

  if (!file) {
    alert("Vui lòng chọn file trước!");
    return;
  }

  statusDiv.innerText = "⏳ Đang upload lên Google Drive...";
  statusDiv.style.color = "#e67e22"; // Màu cam

  try {
    const accessToken = gapi.client.getToken().access_token;

    // Metadata cho Drive
    const metadata = {
      name: file.name,
      mimeType: file.type,
    };

    // Tạo form multipart
    const form = new FormData();
    form.append(
      "metadata",
      new Blob([JSON.stringify(metadata)], { type: "application/json" })
    );
    form.append("file", file);

    // Gửi request lên API Google Drive
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

    // GỌI NETLIFY FUNCTION ĐỂ LƯU DB
    await saveToDatabase(driveFile);

    statusDiv.innerText = "✅ Hoàn tất!";
    statusDiv.style.color = "green";
    fileInput.value = ""; // Reset ô chọn file
  } catch (error) {
    console.error(error);
    statusDiv.innerText = "❌ Lỗi: " + error.message;
    statusDiv.style.color = "red";
  }
};

async function saveToDatabase(fileData) {
  // Gửi dữ liệu file sang Netlify Function
  const payload = {
    fileId: fileData.id,
    fileName: fileData.name,
    viewLink: fileData.webViewLink,
    downloadLink: fileData.webContentLink,
  };

  await fetch(CONFIG.NETLIFY_URL, {
    method: "POST",
    body: JSON.stringify(payload),
  });

  // Refresh lại danh sách ngay
  loadFilesFromFirebase();
}

// ==========================================
// 5. XỬ LÝ DANH SÁCH & UI
// ==========================================
function loadFilesFromFirebase() {
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

      // Convert object sang array và đảo ngược để file mới nhất lên đầu
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

document.getElementById("refresh_btn").onclick = loadFilesFromFirebase;

function toggleViews(isLoggedIn) {
  if (isLoggedIn) {
    document.getElementById("auth-section").classList.add("hidden");
    document.getElementById("app-section").classList.remove("hidden");
  } else {
    document.getElementById("auth-section").classList.remove("hidden");
    document.getElementById("app-section").classList.add("hidden");
  }
}
