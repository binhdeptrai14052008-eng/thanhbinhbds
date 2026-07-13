function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=UTF-8"
    }
  });
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

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
    return json({
      ok: false,
      error: "Thiếu TELEGRAM_BOT_TOKEN hoặc TELEGRAM_CHAT_ID trong Cloudflare Pages"
    }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Dữ liệu gửi lên không hợp lệ" }, 400);
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
    return json({ ok: false, error: "Số điện thoại không hợp lệ" }, 400);
  }

  let timeText = "";
  if (submittedAt) {
    const date = new Date(submittedAt);
    if (!Number.isNaN(date.getTime())) {
      timeText = date.toLocaleString("vi-VN", {
        timeZone: "Asia/Ho_Chi_Minh"
      });
    }
  }

  const lines = [
    "🔥 <b>KHÁCH HÀNG MỚI</b>",
    "",
    `👤 <b>Họ tên:</b> ${escapeHtml(name)}`,
    `📞 <b>SĐT:</b> <code>${escapeHtml(phone)}</code>`,
    "",
    `🏡 <b>BĐS:</b> ${escapeHtml(title)}`,
    `💰 <b>Giá:</b> ${escapeHtml(price)}`,
    `📍 <b>Vị trí:</b> ${escapeHtml(location)}`,
    note ? `💬 <b>Nội dung:</b> ${escapeHtml(note)}` : "",
    timeText ? `🕒 <b>Thời gian:</b> ${escapeHtml(timeText)}` : ""
  ].filter(Boolean);

  const payload = {
    chat_id: env.TELEGRAM_CHAT_ID,
    text: lines.join("\n"),
    parse_mode: "HTML",
    disable_web_page_preview: true
  };

  if (propertyUrl.startsWith("https://")) {
    payload.reply_markup = {
      inline_keyboard: [
        [{ text: "🏡 Mở bất động sản", url: propertyUrl }]
      ]
    };
  }

  const response = await fetch(
    `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    }
  );

  const result = await response.json();

  if (!response.ok || !result.ok) {
    return json({
      ok: false,
      error: result.description || "Không gửi được Telegram"
    }, 502);
  }

  return json({ ok: true });
}

export function onRequestGet() {
  return json({
    ok: true,
    service: "Thanh Bình BĐS Telegram"
  });
}
