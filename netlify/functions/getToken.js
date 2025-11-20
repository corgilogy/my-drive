// netlify/functions/getToken.js
const https = require("https");

exports.handler = async function (event, context) {
  // Cấu hình CORS
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS")
    return { statusCode: 200, headers, body: "" };

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
    headers: {
      "Content-Type": "application/json",
      "Content-Length": postData.length,
    },
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        const data = JSON.parse(body);
        if (data.access_token) {
          resolve({
            statusCode: 200,
            headers,
            body: JSON.stringify({ accessToken: data.access_token }),
          });
        } else {
          resolve({
            statusCode: 500,
            headers,
            body: JSON.stringify({
              error: "Không lấy được token",
              details: data,
            }),
          });
        }
      });
    });

    req.on("error", (e) => {
      resolve({
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: e.message }),
      });
    });

    req.write(postData);
    req.end();
  });
};
