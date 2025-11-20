const https = require("https");

exports.handler = async function (event, context) {
  // 1. Cấu hình CORS
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: "Method Not Allowed" };
  }

  try {
    const data = JSON.parse(event.body);

    // ⚠️ SỬA LỖI: Điền trực tiếp URL Database Châu Á của bạn vào đây
    // Không dùng biến môi trường nữa để tránh sai sót vùng miền
    const DATABASE_URL =
      "https://dnduc-drive-default-rtdb.asia-southeast1.firebasedatabase.app/files.json";

    // 3. Gửi request lưu vào Firebase
    return new Promise((resolve, reject) => {
      const req = https.request(
        DATABASE_URL,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        },
        (res) => {
          resolve({
            statusCode: 200,
            headers,
            body: JSON.stringify({ message: "Đã lưu vào Firebase DB" }),
          });
        }
      );

      req.on("error", (e) => {
        console.log("Lỗi Backend:", e);
        resolve({ statusCode: 500, headers, body: String(e) });
      });

      req.write(JSON.stringify(data));
      req.end();
    });
  } catch (error) {
    return { statusCode: 500, headers, body: String(error) };
  }
};
