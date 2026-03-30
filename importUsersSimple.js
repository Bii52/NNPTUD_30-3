#!/usr/bin/env node

/**
 * Import User - ĐƠN GIẢN NHẤT
 * Chỉ cần: username, email
 * Tự động sinh password 16 ký tự + gửi email
 * 
 * Cách dùng:
 * 1. node importUsersSimple.js create
 * 2. Mở file, điền username + email
 * 3. node importUsersSimple.js import
 */

const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const ExcelJS = require('exceljs');
const bcrypt = require('bcrypt');
const { sendPasswordEmail } = require('./utils/mailHandler');
const userModel = require('./schemas/users');

// Sinh password ngẫu nhiên 16 ký tự
function generateRandomPassword(length = 16) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < length; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
}

// Tạo file Excel mẫu
async function createSampleExcel(filePath) {
    try {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Users');

        worksheet.columns = [
            { header: 'username', key: 'username', width: 20 },
            { header: 'email', key: 'email', width: 30 }
        ];

        worksheet.addRow({ username: 'user1', email: 'user1@gmail.com' });
        worksheet.addRow({ username: 'user2', email: 'user2@gmail.com' });

        worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF4472C4' }
        };

        await workbook.xlsx.writeFile(filePath);
        console.log(`✅ File: ${filePath}`);
    } catch (error) {
        console.error('❌ Lỗi:', error.message);
        throw error;
    }
}

// Đọc file Excel
async function readExcelFile(filePath) {
    try {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(filePath);
        const worksheet = workbook.getWorksheet(1);
        const users = [];

        worksheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return;
            if (!row.values || row.values.length === 0) return;

            const [, username, email] = row.values;
            if (username && email) {
                users.push({
                    username: String(username).trim(),
                    email: String(email).trim()
                });
            }
        });

        return users;
    } catch (error) {
        throw new Error(`❌ Lỗi đọc file: ${error.message}`);
    }
}

// Import User
async function importUsers(excelFilePath) {
    try {
        console.log('\n' + '='.repeat(70));
        console.log('📂 IMPORT USER');
        console.log('='.repeat(70) + '\n');

        if (!fs.existsSync(excelFilePath)) {
            throw new Error('File không tìm thấy');
        }

        // Kết nối MongoDB
        console.log('🔗 Kết nối MongoDB...');
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/NNPTUD-S2';
        await mongoose.connect(mongoUri);
        console.log('✅ Kết nối thành công\n');

        // Đọc Excel
        console.log('📖 Đọc file Excel...');
        const users = await readExcelFile(excelFilePath);
        console.log(`✅ Tìm thấy ${users.length} user\n`);

        if (users.length === 0) {
            console.log('⚠️  Không có user');
            await mongoose.disconnect();
            return;
        }

        // Import
        let successCount = 0;
        const results = [];

        console.log('📊 IMPORT:');
        console.log('-'.repeat(70));

        for (let i = 0; i < users.length; i++) {
            const user = users[i];

            try {
                const password = generateRandomPassword(16);
                const hashedPassword = await bcrypt.hash(password, 10);

                await userModel.create({
                    username: user.username,
                    email: user.email,
                    password: hashedPassword
                });

                console.log(`\n✅ [${i + 1}] ${user.username}`);
                console.log(`   🔐 Password: ${password}`);
                console.log(`   📧 Email: ${user.email}`);

                await sendPasswordEmail(user.email, password);
                console.log(`   ✅ Email sent!`);

                successCount++;
                results.push({
                    username: user.username,
                    email: user.email,
                    password: password
                });

            } catch (error) {
                console.log(`\n❌ [${i + 1}] ${user.username}`);
                console.log(`   Error: ${error.message}`);
            }
        }

        // Báo cáo
        console.log('\n' + '='.repeat(70));
        console.log(`✅ Thành công: ${successCount}/${users.length}`);
        console.log('='.repeat(70) + '\n');

        // Lưu báo cáo
        const report = results.map(r => `${r.username},${r.email},${r.password}`).join('\n');
        const reportPath = path.join(__dirname, 'import_report.txt');
        fs.writeFileSync(reportPath, report);
        console.log(`📄 Báo cáo: ${reportPath}\n`);

        await mongoose.disconnect();

    } catch (error) {
        console.error('\n❌ Lỗi:', error.message);
        process.exit(1);
    }
}

// Main
async function main() {
    const command = process.argv[2];
    const excelPath = path.join(__dirname, 'users_import_simple.xlsx');

    if (command === 'create') {
        console.log('\n🔄 Tạo file mẫu...\n');
        await createSampleExcel(excelPath);
        console.log('\n📝 Tiếp theo:');
        console.log('1. Mở file: users_import_simple.xlsx');
        console.log('2. Thêm username + email');
        console.log('3. Chạy: node importUsersSimple.js import\n');
    } else if (command === 'import') {
        await importUsers(excelPath);
    } else {
        console.log('\n📖 Dùng:');
        console.log('   node importUsersSimple.js create');
        console.log('   node importUsersSimple.js import\n');
    }
}

main().catch(error => {
    console.error('Error:', error);
    process.exit(1);
});
