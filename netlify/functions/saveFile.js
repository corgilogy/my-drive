const https = require("https");

exports.handler = async function (event, context) {
  // 1. Cấu hình CORS (Để Frontend gọi được Backend)
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  // Xử lý preflight request
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const data = JSON.parse(event.body);

    // Lấy Project ID từ biến môi trường (Cài trong Netlify Dashboard)
    // Hoặc điền cứng ID vào đây nếu test: const PROJECT_ID = "ten-project-cua-ban";
    const PROJECT_ID = process.env.FIREBASE_PROJECT_ID;

    if (!PROJECT_ID) {
      return {
        statusCode: 500,
        headers,
        body: "Thiếu biến môi trường FIREBASE_PROJECT_ID",
      };
    }

    const DATABASE_URL = `https://${PROJECT_ID}-default-rtdb.firebaseio.com/files.json`;

    // Gọi API REST của Firebase để lưu
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
            body: JSON.stringify({ message: "Success" }),
          });
        }
      );

      req.on("error", (e) => {
        resolve({ statusCode: 500, headers, body: String(e) });
      });

      req.write(JSON.stringify(data));
      req.end();
    });
  } catch (error) {
    return { statusCode: 500, headers, body: String(error) };
  }
};
