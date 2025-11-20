const https = require("https");

// Hàm phụ lấy Token (Copy y hệt từ các file khác)
function getAccessToken() {
  const postData = JSON.stringify({
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
    grant_type: "refresh_token",
  });

  const options = {
    hostname: "oauth2.googleapis.com",
    path: "/token",
    method: "POST",
    headers: { "Content-Type": "application/json" },
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        const data = JSON.parse(body);
        if (data.access_token) resolve(data.access_token);
        else reject("Lỗi lấy Token");
      });
    });
    req.write(postData);
    req.end();
  });
}

exports.handler = async function (event, context) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS")
    return { statusCode: 200, headers, body: "" };

  try {
    const { folderId } = JSON.parse(event.body);
    if (!folderId) return { statusCode: 400, headers, body: "Thiếu folderId" };

    // 1. Lấy Token
    const accessToken = await getAccessToken();

    // 2. Lấy danh sách file từ Google Drive (Chỉ lấy file chưa bị xóa)
    // Query: parents chứa folderId VÀ trashed = false
    const driveQuery = encodeURIComponent(
      `'${folderId}' in parents and trashed = false`
    );
    const driveUrl = `/drive/v3/files?q=${driveQuery}&fields=files(id,name,webViewLink,webContentLink)`;

    const driveData = await new Promise((resolve, reject) => {
      const req = https.request(
        {
          hostname: "www.googleapis.com",
          path: driveUrl,
          method: "GET",
          headers: { Authorization: `Bearer ${accessToken}` },
        },
        (res) => {
          let body = "";
          res.on("data", (chunk) => (body += chunk));
          res.on("end", () => resolve(JSON.parse(body)));
        }
      );
      req.end();
    });

    if (!driveData.files)
      throw new Error("Không lấy được danh sách file từ Drive");

    // 3. Chuẩn bị dữ liệu để lưu vào Firebase
    // Firebase lưu dạng Object, nên ta chuyển Array thành Object
    const firebaseData = {};
    driveData.files.forEach((file) => {
      // Tạo key ngẫu nhiên hoặc dùng luôn ID file làm key
      firebaseData[file.id] = {
        fileId: file.id,
        fileName: file.name,
        viewLink: file.webViewLink,
        downloadLink: file.webContentLink,
      };
    });

    // 4. Ghi đè vào Firebase (Dùng method PUT để thay thế hoàn toàn danh sách cũ)
    // Thay URL này bằng URL Database Asia của bạn
    const DATABASE_URL =
      "https://dnduc-drive-default-rtdb.asia-southeast1.firebasedatabase.app/files.json";

    await new Promise((resolve, reject) => {
      const req = https.request(
        DATABASE_URL,
        {
          method: "PUT", // PUT là ghi đè toàn bộ
          headers: { "Content-Type": "application/json" },
        },
        (res) => resolve()
      );
      req.write(JSON.stringify(firebaseData));
      req.end();
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: "Đã đồng bộ thành công",
        count: driveData.files.length,
      }),
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: String(error) }),
    };
  }
};
