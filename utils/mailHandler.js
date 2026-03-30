const nodemailer = require("nodemailer");
require('dotenv').config();

const transporter = nodemailer.createTransport({
    host: process.env.MAILTRAP_HOST || "sandbox.smtp.mailtrap.io",
    port: parseInt(process.env.MAILTRAP_PORT) || 2525,
    secure: false,
    auth: {
        user: process.env.MAILTRAP_USER,
        pass: process.env.MAILTRAP_PASS,
    },
});

/**
 * Gửi email reset password
 */
async function sendResetPasswordMail(to, url) {
    try {
        const info = await transporter.sendMail({
            from: process.env.MAILTRAP_FROM_EMAIL,
            to: to,
            subject: "Reset Password email",
            text: "click vao day de reset password",
            html: "click vao <a href=" + url + ">day</a> de reset password",
        });
        return info;
    } catch (error) {
        console.error('Error sending reset password email:', error);
        throw error;
    }
}

/**
 * Gửi email password tạm thời cho user mới
 */
async function sendPasswordEmail(email, password) {
    try {
        const htmlContent = `
        <!DOCTYPE html>
        <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; background-color: #f4f4f4; }
                    .container { max-width: 600px; margin: 20px auto; background-color: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
                    .header { background-color: #007bff; color: white; padding: 20px; text-align: center; border-radius: 5px; }
                    .content { padding: 20px; }
                    .password-box { background-color: #f0f0f0; border-left: 4px solid #007bff; padding: 15px; margin: 20px 0; font-family: monospace; font-weight: bold; font-size: 16px; word-break: break-all; }
                    .warning { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; color: #856404; }
                    .footer { color: #666; font-size: 12px; text-align: center; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 10px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🔐 Tài khoản mới được tạo</h1>
                    </div>
                    <div class="content">
                        <p>Xin chào,</p>
                        <p>Tài khoản của bạn vừa được tạo thành công. Dưới đây là mật khẩu tạm thời:</p>
                        
                        <div class="password-box">
                            ${password}
                        </div>
                        
                        <div class="warning">
                            <strong>⚠️ Lưu ý quan trọng:</strong>
                            <ul>
                                <li>Vui lòng đổi mật khẩu ngay sau lần đăng nhập đầu tiên</li>
                                <li>Không chia sẻ mật khẩu với bất kỳ ai</li>
                                <li>Nếu bạn không yêu cầu tạo tài khoản, vui lòng liên hệ ngay</li>
                            </ul>
                        </div>
                        
                        <p>Trân trọng,<br/><strong>Đội ngũ quản lý hệ thống NNPTUD</strong></p>
                    </div>
                    <div class="footer">
                        <p>&copy; 2024 NNPTUD. All rights reserved.</p>
                    </div>
                </div>
            </body>
        </html>
        `;

        const info = await transporter.sendMail({
            from: process.env.MAILTRAP_FROM_EMAIL,
            to: email,
            subject: "🔐 Tài khoản mới - Mật khẩu tạm thời",
            text: `Mật khẩu tạm thời của bạn là: ${password}`,
            html: htmlContent
        });

        console.log(`✅ Email sent to ${email}`);
        return info;
    } catch (error) {
        console.error('Error sending password email:', error);
        throw error;
    }
}

module.exports = {
    sendResetPasswordMail: sendResetPasswordMail,
    sendPasswordEmail: sendPasswordEmail
}