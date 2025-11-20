const https = require("https");

// Hàm phụ: Lấy Access Token từ Refresh Token (Giống logic bên getToken)
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
        else reject("Không lấy được Token: " + JSON.stringify(data));
      });
    });
    req.on("error", (e) => reject(e.message));
    req.write(postData);
    req.end();
  });
}

// Hàm chính: Handler của Netlify
exports.handler = async function (event, context) {
  // Cấu hình CORS
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS")
    return { statusCode: 200, headers, body: "" };
  if (event.httpMethod !== "POST")
    return { statusCode: 405, headers, body: "Method Not Allowed" };

  try {
    const { fileId } = JSON.parse(event.body);
    if (!fileId) return { statusCode: 400, headers, body: "Thiếu fileId" };

    // 1. Lấy Token mới
    const accessToken = await getAccessToken();

    // 2. Gọi Google Drive API để xóa file
    // API: DELETE https://www.googleapis.com/drive/v3/files/{fileId}
    const options = {
      hostname: "www.googleapis.com",
      path: `/drive/v3/files/${fileId}`,
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    };

    await new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        // Google trả về 204 No Content nghĩa là xóa thành công
        if (res.statusCode === 204 || res.statusCode === 200) {
          resolve();
        } else {
          reject(`Lỗi Google Drive: ${res.statusCode}`);
        }
      });
      req.on("error", (e) => reject(e.message));
      req.end();
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: "Đã xóa file trên Drive thành công" }),
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
