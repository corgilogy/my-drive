// ==========================================
// 1. CẤU HÌNH
// ==========================================
const CONFIG = {
  // Link gọi Backend
  GET_TOKEN_URL: "https://dnduc-drive.netlify.app/.netlify/functions/getToken",
  SAVE_DB_URL: "https://dnduc-drive.netlify.app/.netlify/functions/saveFile",

  // ID thư mục bạn muốn lưu
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
// 2. KHỞI TẠO (Đã sửa lỗi null)
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  // Khởi tạo Firebase
  firebase.initializeApp(CONFIG.FIREBASE);

  // Gán sự kiện nút bấm (Chỉ gán, không chạy lệnh ẩn/hiện giao diện nữa)
  const btnUpload = document.getElementById("upload_btn");
  const btnRefresh = document.getElementById("refresh_btn");

  if (btnUpload) btnUpload.onclick = handleUpload;
  if (btnRefresh) btnRefresh.onclick = loadFilesFromFirebase;

  // Tải danh sách ngay lập tức
  loadFilesFromFirebase();
});

// ==========================================
// 3. UPLOAD LOGIC (SERVER-SIDE AUTH)
// ==========================================
async function handleUpload() {
  const fileInput = document.getElementById("fileInput");
  const file = fileInput.files[0];
  const statusDiv = document.getElementById("progress-status");

  if (!file) return alert("Vui lòng chọn file trước!");

  statusDiv.innerText = "⏳ Đang kết nối máy chủ...";
  statusDiv.style.color = "#e67e22";

  try {
    // BƯỚC 1: Xin Token từ Netlify
    const tokenRes = await fetch(CONFIG.GET_TOKEN_URL);
    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      throw new Error("Lỗi Netlify: " + errText);
    }

    const tokenData = await tokenRes.json();
    if (!tokenData.accessToken)
      throw new Error(
        "Server không trả về Token (Kiểm tra lại Env Var trên Netlify)"
      );

    const accessToken = tokenData.accessToken;

    // BƯỚC 2: Upload lên Google Drive
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

    // BƯỚC 3: Lưu thông tin vào Firebase
    statusDiv.innerText = "💾 Upload xong. Đang lưu Database...";
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

  if (!res.ok) throw new Error("Lỗi khi lưu vào Firebase");
  loadFilesFromFirebase();
}

// ==========================================
// 4. DANH SÁCH & UI
// ==========================================
function loadFilesFromFirebase() {
  const db = firebase.database();
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
    })
    .catch((err) => {
      console.error(err);
      list.innerHTML = '<li style="color:red">Lỗi tải danh sách</li>';
    });
}
