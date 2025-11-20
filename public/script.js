// ==========================================
// 1. CẤU HÌNH & BẢO MẬT
// ==========================================
const MY_PASSWORD = '321321'; // <--- ĐỔI MẬT KHẨU Ở ĐÂY

const CONFIG = {
    GET_TOKEN_URL: "/.netlify/functions/getToken",
    SAVE_DB_URL: "/.netlify/functions/saveFile",
    DELETE_FILE_URL: "/.netlify/functions/deleteFile",
    SYNC_URL: "/.netlify/functions/syncFiles",
    
    FOLDER_ID: "1i__DIWWEX7HYemtyZ5wqwaYcYfnW50a3",

    FIREBASE: {
        apiKey: "AIzaSyDOUCC56svyZ5pGZV7z160PW4Z8rJ01jdw",
        authDomain: "dnduc-drive.firebaseapp.com",
        databaseURL: "https://dnduc-drive-default-rtdb.asia-southeast1.firebasedatabase.app",
        projectId: "dnduc-drive",
        storageBucket: "dnduc-drive.firebasestorage.app",
        messagingSenderId: "875885392954",
        appId: "1:875885392954:web:14fbd18df62155bf6b7103",
        measurementId: "G-455HFS41MH"
    }
};

// ==========================================
// 2. LOGIC ĐĂNG NHẬP & KHỞI TẠO
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const loginOverlay = document.getElementById('login-overlay');
    const mainApp = document.getElementById('main-app');
    const passwordInput = document.getElementById('password-input');
    const loginBtn = document.getElementById('login-btn');
    const errorMsg = document.getElementById('error-message');

    // Kiểm tra session ngay khi mở web
    if (sessionStorage.getItem('myDrive_isLoggedIn') === 'true') {
        unlockApp();
    } else {
        // Focus vào ô nhập
        if(passwordInput) passwordInput.focus();
    }

    // Sự kiện nút Login
    if(loginBtn) {
        loginBtn.addEventListener('click', checkLogin);
    }
    if(passwordInput) {
        passwordInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') checkLogin();
        });
    }

    function checkLogin() {
        if (passwordInput.value === MY_PASSWORD) {
            sessionStorage.setItem('myDrive_isLoggedIn', 'true');
            unlockApp();
        } else {
            errorMsg.style.display = 'block';
            passwordInput.value = '';
            passwordInput.focus();
        }
    }

    function unlockApp() {
        loginOverlay.style.display = 'none';
        mainApp.style.display = 'flex'; // Hiện nội dung chính
        
        // SAU KHI MỞ KHÓA MỚI CHẠY LOGIC APP
        initializeAppLogic();
    }
});

// ==========================================
// 3. LOGIC CHÍNH CỦA APP (CHỈ CHẠY KHI ĐÃ LOGIN)
// ==========================================
function initializeAppLogic() {
    console.log("App started...");
    
    // 1. Khởi tạo Firebase
    if (!firebase.apps.length) {
        firebase.initializeApp(CONFIG.FIREBASE);
    }

    // 2. Gán sự kiện cho các nút chức năng
    const btnUpload = document.getElementById("upload_btn");
    const btnRefresh = document.getElementById("refresh_btn");
    const btnSync = document.getElementById("sync_btn");

    if (btnUpload) btnUpload.onclick = handleUpload;
    if (btnRefresh) btnRefresh.onclick = loadFilesFromFirebase;
    if (btnSync) btnSync.onclick = handleSync;

    // 3. Tải danh sách lần đầu
    loadFilesFromFirebase();
}

// --- CÁC HÀM XỬ LÝ (UPLOAD, SYNC, DELETE...) ---

async function handleUpload() {
    const fileInput = document.getElementById("fileInput");
    const file = fileInput.files[0];
    const statusDiv = document.getElementById("progress-status");

    if (!file) return alert("Vui lòng chọn file trước!");

    statusDiv.innerText = "⏳ Đang kết nối máy chủ...";
    statusDiv.style.color = "#e67e22";

    try {
        // Lấy token
        const tokenRes = await fetch(CONFIG.GET_TOKEN_URL);
        if (!tokenRes.ok) throw new Error("Lỗi Netlify lấy token");
        const tokenData = await tokenRes.json();
        const accessToken = tokenData.accessToken;

        statusDiv.innerText = "⏳ Đang upload lên Google Drive...";

        const metadata = {
            name: file.name,
            mimeType: file.type,
            parents: [CONFIG.FOLDER_ID]
        };

        const form = new FormData();
        form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
        form.append("file", file);

        const response = await fetch(
            "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink",
            {
                method: "POST",
                headers: new Headers({ "Authorization": "Bearer " + accessToken }),
                body: form
            }
        );

        const driveFile = await response.json();
        if (driveFile.error) throw new Error(driveFile.error.message);

        statusDiv.innerText = "💾 Đang lưu Database...";
        await saveToDatabase(driveFile);

        statusDiv.innerText = "✅ Hoàn tất!";
        statusDiv.style.color = "green";
        fileInput.value = ""; // Xóa input

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
        downloadLink: fileData.webContentLink
    };

    const res = await fetch(CONFIG.SAVE_DB_URL, {
        method: "POST",
        body: JSON.stringify(payload)
    });

    if (!res.ok) throw new Error("Lỗi lưu Firebase");
    loadFilesFromFirebase();
}

function loadFilesFromFirebase() {
    const db = firebase.database();
    const list = document.getElementById("file-list");

    list.innerHTML = '<li style="text-align:center; color:#999">Đang cập nhật...</li>';

    db.ref("files").once("value").then(snapshot => {
        list.innerHTML = "";
        const data = snapshot.val();

        if (!data) {
            list.innerHTML = '<li style="text-align:center; padding:10px; color:#999">Chưa có file nào</li>';
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
    }).catch(err => {
        console.error(err);
        list.innerHTML = '<li style="color:red; text-align:center">Lỗi tải danh sách</li>';
    });
}

async function handleDelete(firebaseKey, googleFileId, fileName) {
    if (!confirm(`Bạn có chắc muốn xóa file "${fileName}" không?\n(Hành độn