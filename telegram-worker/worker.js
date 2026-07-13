const JSON_HEADERS = {
  "Content-Type": "application/json; charset=UTF-8"
};

function json(data, status = 200, cors = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...JSON_HEADERS,
      ...cors
    }
  });
}

function corsHeaders(origin, allowedOrigin) {
  const isAllowed =
    origin === allowedOrigin ||
    (allowedOrigin === "*" && Boolean(origin));

  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : allowedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}

function clean(value, maxLength = 500) {
  return String(value ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .trim()
    .slice(0, maxLength);
}

function escapeHtml(value) {
  return clean(value, 1500)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function validPhone(value) {
  return /^[0-9+\s().-]{8,20}$/.test(value);
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowedOrigin =
      env.ALLOWED_ORIGIN || "https://thanhbinhbds.id.vn";
    const cors = corsHeaders(origin, allowedOrigin);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: cors
      });
    }

    if (request.method !== "POST") {
      return json({ ok: false, error: "Method not allowed" }, 405, cors);
    }

    if (allowedOrigin !== "*" && origin !== allowedOrigin) {
      return json({ ok: false, error: "Origin not allowed" }, 403, cors);
    }

    if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
      return json(
        { ok: false, error: "Worker chưa có Telegram secrets" },
        500,
        cors
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, error: "JSON không hợp lệ" }, 400, cors);
    }

    const name = clean(body.name, 80) || "Khách chưa nhập tên";
    const phone = clean(body.phone, 20);
    const note = clean(body.note, 500);
    const title = clean(body.propertyTitle, 160) || "Bất động sản";
    const price = clean(body.propertyPrice, 80) || "Liên hệ";
    const location = clean(body.propertyLocation, 160) || "Chưa cập nhật";
    const propertyUrl = clean(body.propertyUrl, 600);
    const submittedAt = clean(body.submittedAt, 80);

    if (!validPhone(phone)) {
      return json(
        { ok: false, error: "Số điện thoại không hợp lệ" },
        400,
        cors
      );
    }

    const message = [
      "🔥 <b>KHÁCH HÀNG MỚI</b>",
      "",
      `👤 <b>Họ tên:</b> ${escapeHtml(name)}`,
      `📞 <b>SĐT:</b> <code>${escapeHtml(phone)}</code>`,
      "",
      `🏡 <b>BĐS:</b> ${escapeHtml(title)}`,
      `💰 <b>Giá:</b> ${escapeHtml(price)}`,
      `📍 <b>Vị trí:</b> ${escapeHtml(location)}`,
      note ? `💬 <b>Nội dung:</b> ${escapeHtml(note)}` : "",
      submittedAt
        ? `🕒 <b>Thời gian:</b> ${escapeHtml(
            new Date(submittedAt).toLocaleString("vi-VN", {
              timeZone: "Asia/Ho_Chi_Minh"
            })
          )}`
        : ""
    ].filter(Boolean).join("\n");

    const telegramPayload = {
      chat_id: env.TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: "HTML",
      disable_web_page_preview: true
    };

    if (propertyUrl.startsWith("https://")) {
      telegramPayload.reply_markup = {
        inline_keyboard: [
          [
            {
              text: "🏡 Mở bất động sản",
              url: propertyUrl
            }
          ],
          [
            {
              text: "📞 Gọi khách",
              url: `tel:${phone.replace(/[^\d+]/g, "")}`
            }
          ]
        ]
      };
    }

    const telegramResponse = await fetch(
      `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify(telegramPayload)
      }
    );

    const telegramData = await telegramResponse.json();

    if (!telegramResponse.ok || !telegramData.ok) {
      console.error("Telegram API error:", telegramData);
      return json(
        {
          ok: false,
          error: telegramData.description || "Không gửi được Telegram"
        },
        502,
        cors
      );
    }

    return json({ ok: true }, 200, cors);
  }
};
