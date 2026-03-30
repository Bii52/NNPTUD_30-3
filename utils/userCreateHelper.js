const bcrypt = require('bcrypt');
const userModel = require('../schemas/users');
const { sendPasswordEmail } = require('./mailHandler');

/**
 * Tạo chuỗi mật khẩu ngẫu nhiên dài 16 ký tự
 * @returns {string} Mật khẩu ngẫu nhiên 16 ký tự
 */
function generateRandomPassword(length = 16) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < length; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
}

/**
 * Hash mật khẩu sử dụng bcrypt
 * @param {string} password - Mật khẩu cần hash
 * @returns {Promise<string>} Mật khẩu đã được hash
 */
async function hashPassword(password) {
    const saltRounds = 10;
    return await bcrypt.hash(password, saltRounds);
}

/**
 * Tạo User mới và gửi mật khẩu qua email
 * @param {object} userData - {username, email, role, fullName, avatarUrl, status}
 * @param {object} userController - User controller
 * @param {object} session - Mongoose session (optional)
 * @returns {object} User vừa được tạo
 */
async function createUserWithRandomPassword(userData, userController, session = null) {
    try {
        // 1. Generate random password
        const randomPassword = generateRandomPassword(16);
        
        // 2. Hash password
        const hashedPassword = await hashPassword(randomPassword);
        
        // 3. Create user in database
        const newUser = await userController.CreateAnUser(
            userData.username,
            hashedPassword,
            userData.email,
            userData.role,
            userData.fullName || "",
            userData.avatarUrl || "https://i.sstatic.net/l60Hf.png",
            userData.status || false,
            session
        );
        
        // 4. Send password via email
        await sendPasswordEmail(newUser.email, randomPassword);
        
        return {
            success: true,
            user: newUser,
            message: `User ${newUser.username} created successfully. Password sent to ${newUser.email}`
        };
    } catch (error) {
        throw new Error(error.message || error);
    }
}

/**
 * Gửi mật khẩu via email
 * @param {string} email - Email người nhận
 * @param {string} password - Mật khẩu cần gửi
 */
async function sendPasswordEmailDirect(email, password) {
    try {
        return await sendPasswordEmail(email, password);
    } catch (error) {
        console.error('Error sending password email:', error);
        throw error;
    }
}

module.exports = {
    generateRandomPassword,
    hashPassword,
    createUserWithRandomPassword,
    sendPasswordEmailDirect
};