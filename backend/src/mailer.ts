import nodemailer from "nodemailer";

function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "email-smtp.ap-southeast-1.amazonaws.com",
    port: parseInt(process.env.SMTP_PORT || "587", 10),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

export async function sendMail(opts: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<void> {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn("[Mailer] SMTP credentials not configured, skipping email.");
    return;
  }
  const from = process.env.SMTP_FROM || "noreply@yourdomain.com";
  await getTransporter().sendMail({ from, ...opts });
}

const BRAND_COLOR = "#a797ff";
const BRAND_DARK  = "#3e2d9c";
const SITE_URL    = "https://composter.ruangawan.com";
const LOGO_URL    = "https://file.ruangawan.com/composter/compost-icon.png";

function emailShell(contentHtml: string): string {
  return `<!DOCTYPE html><html xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" lang="id"><head><title>Smart Composter</title><meta http-equiv="Content-Type" content="text/html; charset=utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch><o:AllowPNG/></o:OfficeDocumentSettings></xml><![endif]--><style>*{box-sizing:border-box}body{margin:0;padding:0}a[x-apple-data-detectors]{color:inherit!important;text-decoration:inherit!important}#MessageViewBody a{color:inherit;text-decoration:none}p{line-height:inherit}.desktop_hide,.desktop_hide table{mso-hide:all;display:none;max-height:0;overflow:hidden}.image_block img+div{display:none}@media(max-width:700px){.row-content{width:100%!important}.stack .column{width:100%;display:block}.col-pad{padding:0 24px 40px!important}.footer-pad{padding:32px 16px 48px!important}h1{font-size:22px!important}}</style></head><body style="background-color:#f8f6ff;margin:0;padding:0;-webkit-text-size-adjust:none;text-size-adjust:none"><table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace:0;mso-table-rspace:0;background-color:#f8f6ff"><tbody><tr><td>

<!-- HEADER -->
<table align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace:0;mso-table-rspace:0"><tbody><tr><td><table class="row-content stack" align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace:0;mso-table-rspace:0;background-color:${BRAND_COLOR};width:680px;margin:0 auto" width="680"><tbody><tr><td class="column column-1" width="100%" style="mso-table-lspace:0;mso-table-rspace:0;font-weight:400;text-align:left;vertical-align:top"><table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace:0;mso-table-rspace:0"><tr><td style="padding:28px 48px"><table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace:0;mso-table-rspace:0"><tr><td style="vertical-align:middle"><img src="${LOGO_URL}" width="54" height="54" alt="Smart Composter" style="display:inline-block;height:54px;width:54px;border:0;border-radius:10px;vertical-align:middle;margin-right:10px"><span style="color:#fff;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:20px;font-weight:700;vertical-align:middle;letter-spacing:0.3px">Smart Composter</span></td></tr></table></td></tr></table></td></tr></tbody></table></td></tr></tbody></table>

<!-- ILLUSTRATION -->
<table align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace:0;mso-table-rspace:0"><tbody><tr><td><table class="row-content stack" align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace:0;mso-table-rspace:0;background-color:${BRAND_COLOR};width:680px;margin:0 auto" width="680"><tbody><tr><td class="column column-1" width="100%" style="mso-table-lspace:0;mso-table-rspace:0;font-weight:400;text-align:left;vertical-align:top"><table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace:0;mso-table-rspace:0"><tr><td style="width:100%;padding:0" align="center"><img src="https://file.ruangawan.com/composter/email.png" style="display:block;height:auto;border:0;width:100%;max-width:680px" width="680" alt="Notifikasi Email" height="auto"></td></tr></table></td></tr></tbody></table></td></tr></tbody></table>

<!-- CONTENT -->
<table align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace:0;mso-table-rspace:0"><tbody><tr><td><table class="row-content stack" align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace:0;mso-table-rspace:0;background-color:#ffffff;width:680px;margin:0 auto" width="680"><tbody><tr><td class="column column-1" width="100%" style="mso-table-lspace:0;mso-table-rspace:0;font-weight:400;text-align:left;vertical-align:top"><table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace:0;mso-table-rspace:0"><tr><td class="col-pad" style="padding:40px 48px 48px">${contentHtml}</td></tr></table></td></tr></tbody></table></td></tr></tbody></table>

<!-- SPACER -->
<table align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace:0;mso-table-rspace:0"><tbody><tr><td><table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace:0;mso-table-rspace:0;background-color:#ffffff;width:680px;margin:0 auto" width="680"><tbody><tr><td style="mso-table-lspace:0;mso-table-rspace:0;font-weight:400;text-align:left;vertical-align:top"><div style="height:40px;line-height:40px;font-size:1px">&#8202;</div></td></tr></tbody></table></td></tr></tbody></table>

<!-- FOOTER -->
<table align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace:0;mso-table-rspace:0"><tbody><tr><td><table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace:0;mso-table-rspace:0;background-color:${BRAND_COLOR};width:680px;margin:0 auto" width="680"><tbody><tr><td width="100%" style="mso-table-lspace:0;mso-table-rspace:0;font-weight:400;text-align:left;vertical-align:top"><table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace:0;mso-table-rspace:0"><tr><td class="footer-pad" style="padding:40px 48px 48px;text-align:center">
<p style="margin:0 0 20px"><a href="${SITE_URL}/dashboard" target="_blank" style="color:${BRAND_DARK};font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;font-weight:400;text-decoration:none;padding:0 12px">Dashboard</a><span style="color:${BRAND_DARK};font-size:14px">|</span><a href="${SITE_URL}/settings" target="_blank" style="color:${BRAND_DARK};font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;font-weight:400;text-decoration:none;padding:0 12px">Pengaturan</a><span style="color:${BRAND_DARK};font-size:14px">|</span><a href="mailto:support@ruangawan.com" target="_blank" style="color:${BRAND_DARK};font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;font-weight:400;text-decoration:none;padding:0 12px">Bantuan</a></p>
<table border="0" cellpadding="0" cellspacing="0" role="presentation" width="85%" style="mso-table-lspace:0;mso-table-rspace:0;margin:0 auto 20px"><tr><td style="font-size:1px;line-height:1px;border-top:1px solid #9583ff">&#8202;</td></tr></table>
<p style="margin:0;color:${BRAND_DARK};font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:12px">Kamu menerima email ini karena notifikasi diaktifkan di <a href="${SITE_URL}" target="_blank" style="color:${BRAND_DARK};text-decoration:underline">composter.ruangawan.com</a></p>
</td></tr></table></td></tr></tbody></table></td></tr></tbody></table>

</td></tr></tbody></table></body></html>`;
}

export async function sendActivationEmail(to: string, name: string | null): Promise<void> {
  const greeting = name ? `Halo, <strong>${name}</strong>!` : "Halo!";
  const contentHtml = `
<h1 style="margin:0 0 12px;color:#292929;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:28px;font-weight:700;line-height:1.2">Notifikasi Email Diaktifkan!</h1>
<p style="margin:0 0 16px;color:#101112;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6">${greeting}</p>
<p style="margin:0 0 16px;color:#101112;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6">Notifikasi email untuk akun <strong>Smart Composter</strong> kamu telah berhasil diaktifkan. Kamu akan menerima peringatan otomatis ketika kondisi kompos memerlukan perhatianmu.</p>
<p style="margin:0 0 8px;color:#292929;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:15px;font-weight:600">Kamu akan diberitahu jika:</p>
<ul style="margin:0 0 24px;padding-left:20px;color:#444;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.8">
  <li>Suhu kompos melebihi batas maksimum</li>
  <li>Suhu kompos di bawah batas minimum</li>
  <li>Kelembaban terlalu rendah</li>
</ul>
<table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace:0;mso-table-rspace:0"><tr><td style="padding-top:8px" align="left"><a href="${SITE_URL}/dashboard" target="_blank" style="color:#ffffff;text-decoration:none"><!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${SITE_URL}/dashboard" style="height:48px;width:160px;v-text-anchor:middle;" arcsize="17%" fillcolor="${BRAND_COLOR}"><v:stroke dashstyle="Solid" weight="0px" color="${BRAND_COLOR}"/><w:anchorlock/><v:textbox inset="0px,0px,0px,0px"><center dir="false" style="color:#ffffff;font-family:sans-serif;font-size:16px"><![endif]--><span style="background-color:${BRAND_COLOR};border-radius:8px;color:#ffffff;display:inline-block;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;text-align:center;word-break:keep-all;letter-spacing:normal;padding:14px 28px">Buka Dashboard</span><!--[if mso]></center></v:textbox></v:roundrect><![endif]--></a></td></tr></table>
<p style="margin:24px 0 0;color:#888;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:12px;line-height:1.5">Kamu dapat menonaktifkan notifikasi kapan saja melalui halaman <strong>Pengaturan → Notifikasi</strong>.</p>`;

  await sendMail({
    to,
    subject: "[Smart Composter] Notifikasi Email Diaktifkan",
    text: [
      `Halo${name ? " " + name : ""},`,
      "",
      "Notifikasi email untuk akun Smart Composter kamu telah berhasil diaktifkan.",
      "",
      "Kamu akan diberitahu jika:",
      "- Suhu kompos melebihi batas maksimum",
      "- Suhu kompos di bawah batas minimum",
      "- Kelembaban terlalu rendah",
      "",
      `Buka dashboard: ${SITE_URL}/dashboard`,
      "",
      "Kamu dapat menonaktifkan notifikasi kapan saja melalui halaman Pengaturan → Notifikasi.",
    ].join("\n"),
    html: emailShell(contentHtml),
  });
}

export async function sendAlertEmail(opts: {
  to: string;
  deviceId: string;
  alertType: string;
  value: number;
  threshold: number;
  unit: string;
}): Promise<void> {
  const { to, deviceId, alertType, value, threshold, unit } = opts;
  const time = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });

  const contentHtml = `
<h1 style="margin:0 0 16px;color:#c0392b;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:28px;font-weight:700;line-height:1.2">⚠️ Peringatan Kondisi Kompos</h1>
<p style="margin:0 0 20px;color:#101112;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6">Kondisi kompos pada perangkat kamu memerlukan perhatian segera.</p>
<table width="100%" border="0" cellpadding="0" cellspacing="0" style="mso-table-lspace:0;mso-table-rspace:0;border-collapse:collapse;margin-bottom:24px">
  <tr style="background:#f8f6ff"><td style="padding:10px 14px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;color:#666;width:50%">Perangkat</td><td style="padding:10px 14px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;font-weight:600;color:#292929">${deviceId}</td></tr>
  <tr><td style="padding:10px 14px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;color:#666">Kondisi</td><td style="padding:10px 14px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;font-weight:600;color:#c0392b">${alertType}</td></tr>
  <tr style="background:#f8f6ff"><td style="padding:10px 14px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;color:#666">Nilai saat ini</td><td style="padding:10px 14px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;font-weight:600;color:#292929">${value} ${unit}</td></tr>
  <tr><td style="padding:10px 14px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;color:#666">Ambang batas</td><td style="padding:10px 14px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;font-weight:600;color:#292929">${threshold} ${unit}</td></tr>
  <tr style="background:#f8f6ff"><td style="padding:10px 14px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;color:#666">Waktu</td><td style="padding:10px 14px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;color:#292929">${time}</td></tr>
</table>
<table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace:0;mso-table-rspace:0"><tr><td align="left"><a href="${SITE_URL}/dashboard" target="_blank" style="color:#ffffff;text-decoration:none"><span style="background-color:#c0392b;border-radius:8px;color:#ffffff;display:inline-block;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;text-align:center;padding:14px 28px">Periksa Dashboard</span></a></td></tr></table>`;

  await sendMail({
    to,
    subject: `[Smart Composter] ⚠️ Peringatan: ${alertType} pada perangkat ${deviceId}`,
    text: [
      `Peringatan dari Smart Composter!`,
      ``,
      `Perangkat      : ${deviceId}`,
      `Kondisi        : ${alertType}`,
      `Nilai saat ini : ${value} ${unit}`,
      `Ambang batas   : ${threshold} ${unit}`,
      `Waktu          : ${time}`,
      ``,
      `Harap periksa kompos Anda segera: ${SITE_URL}/dashboard`,
    ].join("\n"),
    html: emailShell(contentHtml),
  });
}
