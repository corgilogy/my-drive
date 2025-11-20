// ==========================================
// 1. CẤU HÌNH
// ==========================================
const CONFIG = {
  GET_TOKEN_URL: "https://dnduc-drive.netlify.app/.netlify/functions/getToken",
  SAVE_DB_URL: "https://dnduc-drive.netlify.app/.netlify/functions/saveFile",
  DELETE_FILE_URL: "//dnduc-drive.netlify.app/.netlify/functions/deleteFile",

  SYNC_URL: "//dnduc-drive.netlify.app/.netlify/functions/syncFiles",

  // 👇 MỚI: Thêm đường dẫn function xóa
  DELETE_FILE_URL:
    "https://dnduc-drive.netlify.app/.netlify/functions/deleteFile",

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
// 2. KHỞI TẠO
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  firebase.initializeApp(CONFIG.FIREBASE);

  const btnUpload = document.getElementById("upload_btn");
  const btnRefresh = document.getElementById("refresh_btn");

  if (btnUpload) btnUpload.onclick = handleUpload;
  if (btnRefresh) btnRefresh.onclick = loadFilesFromFirebase;

  loadFilesFromFirebase();
});

// ==========================================
// 3. UPLOAD LOGIC
// ==========================================
async function handleUpload() {
  const fileInput = document.getElementById("fileInput");
  const file = fileInput.files[0];
  const statusDiv = document.getElementById("progress-status");

  if (!file) return alert("Vui lòng chọn file trước!");

  statusDiv.innerText = "⏳ Đang kết nối máy chủ...";
  statusDiv.style.color = "#e67e22";

  try {
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

// ==========================================
// 4. XỬ LÝ XÓA FILE (MỚI)
// ==========================================
async function handleDelete(firebaseKey, googleFileId, fileName) {
  if (
    !confirm(
      `Bạn có chắc muốn xóa file "${fileName}" không?\n(Hành động này sẽ xóa vĩnh viễn trên Google Drive)`
    )
  ) {
    return;
  }

  const btnDelete = document.getElementById(`btn-del-${firebaseKey}`);
  const originalText = btnDelete.innerText;
  btnDelete.innerText = "⏳...";
  btnDelete.disabled = true;

  try {
    // Bước 1: Gọi Netlify để xóa trên Google Drive trước
    const res = await fetch(CONFIG.DELETE_FILE_URL, {
      method: "POST",
      body: JSON.stringify({ fileId: googleFileId }),
    });

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || "Lỗi xóa Drive");
    }

    // Bước 2: Nếu Drive xóa OK -> Xóa trên Firebase Database
    await firebase
      .database()
      .ref("files/" + firebaseKey)
      .remove();

    // Bước 3: Làm mới danh sách
    loadFilesFromFirebase();
    alert("✅ Đã xóa thành công!");
  } catch (error) {
    console.error(error);
    alert("❌ Lỗi: " + error.message);
    btnDelete.innerText = originalText;
    btnDelete.disabled = false;
  }
}

// ==========================================
// 5. DANH SÁCH & UI (CẬP NHẬT)
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

      // 👇 CẬP NHẬT: Dùng Object.entries để lấy cả KEY và VALUE
      // Object.entries trả về mảng: [ ['key1', {data}], ['key2', {data}] ]
      const entries = Object.entries(data).reverse();

      entries.forEach(([key, file]) => {
        const li = document.createElement("li");
        li.className = "file-item";

        // Tạo HTML có thêm nút Xóa
        li.innerHTML = `
            <span class="file-name" title="${file.fileName}">${file.fileName}</span>
            <div class="file-actions">
                <a href="${file.viewLink}" target="_blank" class="link-btn view-link">👁️</a>
                <a href="${file.downloadLink}" class="link-btn down-link">⬇️</a>
                
                <!-- Nút Xóa mới -->
                <button 
                    id="btn-del-${key}"
                    class="link-btn del-link" 
                    onclick="handleDelete('${key}', '${file.fileId}', '${file.fileName}')"
                >🗑️</button>
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
async function handleSync() {
  const btnSync = document.getElementById("sync_btn");
  const originalText = btnSync.innerText;

  if (
    !confirm(
      "Bạn có muốn đồng bộ lại danh sách từ Google Drive không?\n(Hành động này sẽ cập nhật lại toàn bộ danh sách trên web giống hệt trong Drive)"
    )
  ) {
    return;
  }

  btnSync.innerText = "⏳ Đang quét...";
  btnSync.disabled = true;

  try {
    const res = await fetch(CONFIG.SYNC_URL, {
      method: "POST",
      body: JSON.stringify({ folderId: CONFIG.FOLDER_ID }),
    });

    if (!res.ok) throw new Error("Lỗi kết nối Server");

    const data = await res.json();
    if (data.error) throw new Error(data.error);

    alert(`✅ Đã đồng bộ xong! Tìm thấy ${data.count} file.`);
    loadFilesFromFirebase(); // Tải lại danh sách mới
  } catch (error) {
    console.error(error);
    alert("❌ Lỗi đồng bộ: " + error.message);
  } finally {
    btnSync.innerText = originalText;
    btnSync.disabled = false;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  firebase.initializeApp(CONFIG.FIREBASE);

  const btnUpload = document.getElementById("upload_btn");
  const btnRefresh = document.getElementById("refresh_btn");

  // 👇 THÊM NÚT SYNC (Lát nữa sẽ thêm vào HTML)
  const btnSync = document.getElementById("sync_btn");

  if (btnUpload) btnUpload.onclick = handleUpload;
  if (btnRefresh) btnRefresh.onclick = loadFilesFromFirebase;

  // 👇 GÁN SỰ KIỆN
  if (btnSync) btnSync.onclick = handleSync;

  loadFilesFromFirebase();
});
