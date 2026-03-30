/**
 * Excel Import Handler
 * Import User từ file Excel
 * 
 * File Excel structure:
 * Column A: username (required)
 * Column B: email (required)
 * Column C: fullName (optional)
 */

const ExcelJS = require('exceljs');
const { createUserWithRandomPassword } = require('./userCreateHelper');
const mongoose = require('mongoose');

/**
 * Đọc file Excel và trả về dữ liệu
 * @param {string} filePath - Đường dẫn tới file Excel
 * @returns {Promise<Array>} Mảng dữ liệu user
 */
async function readExcelFile(filePath) {
    try {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(filePath);

        const worksheet = workbook.getWorksheet(1);
        const users = [];

        worksheet.eachRow((row, rowNumber) => {
            // Bỏ qua dòng header (dòng 1)
            if (rowNumber === 1) return;

            // Bỏ qua dòng trống
            if (!row.values || row.values.length === 0) return;

            const [, username, email, fullName, roleId] = row.values;

            // Validate dữ liệu
            if (username && email) {
                users.push({
                    username: String(username).trim(),
                    email: String(email).trim(),
                    fullName: fullName ? String(fullName).trim() : '',
                    roleId: roleId ? String(roleId).trim() : null
                });
            }
        });

        return users;
    } catch (error) {
        throw new Error(`❌ Lỗi đọc file Excel: ${error.message}`);
    }
}

/**
 * Import User từ Excel vào database
 * @param {string} filePath - Đường dẫn tới file Excel
 * @param {object} userController - User controller
 * @returns {Promise<object>} Kết quả import
 */
async function importUsersFromExcel(filePath, userController) {
    const results = {
        success: [],
        failed: [],
        total: 0,
        successCount: 0,
        failedCount: 0
    };

    let session;

    try {
        console.log('\n📂 Bắt đầu import User từ Excel...\n');

        // Bước 1: Đọc file Excel
        console.log('📋 Bước 1: Đọc file Excel...');
        const users = await readExcelFile(filePath);
        results.total = users.length;

        console.log(`✅ Tìm thấy ${users.length} user\n`);

        if (users.length === 0) {
            console.log('⚠️  Không có user nào để import');
            return results;
        }

        // Bước 2: Tạo session MongoDB
        console.log('📋 Bước 2: Kết nối MongoDB...');
        session = await mongoose.startSession();
        session.startTransaction();
        console.log('✅ Kết nối thành công\n');

        // Bước 3: Import từng user
        console.log('📋 Bước 3: Import user...\n');

        for (let i = 0; i < users.length; i++) {
            const user = users[i];
            const rowNumber = i + 2; // +2 vì bỏ qua header (dòng 1) và index từ 0

            try {
                console.log(`⏳ [${i + 1}/${users.length}] Đang import: ${user.username}...`);

                const userData = {
                    username: user.username,
                    email: user.email,
                    fullName: user.fullName || user.username,
                    role: user.roleId || null,
                    status: false
                };

                // Tạo user
                const result = await createUserWithRandomPassword(userData, userController, session);

                results.success.push({
                    rowNumber,
                    username: result.user.username,
                    email: result.user.email,
                    userId: result.user._id,
                    status: 'Created'
                });

                results.successCount++;
                console.log(`   ✅ Tạo thành công\n`);

            } catch (error) {
                const errorMsg = error.message || error.error || String(error) || 'Unknown error';
                
                results.failed.push({
                    rowNumber,
                    username: user.username,
                    email: user.email,
                    error: errorMsg
                });

                results.failedCount++;
                console.log(`   ❌ Lỗi: ${errorMsg}\n`);
            }
        }

        // Bước 4: Commit transaction
        console.log('📋 Bước 4: Lưu vào database...');
        await session.commitTransaction();
        console.log('✅ Lưu thành công\n');

        return results;

    } catch (error) {
        console.error(`\n❌ LỖI IMPORT: ${error.message}`);

        if (session) {
            await session.abortTransaction();
        }

        throw error;

    } finally {
        if (session) {
            session.endSession();
        }
    }
}

/**
 * In báo cáo import
 * @param {object} results - Kết quả từ importUsersFromExcel
 */
function printImportReport(results) {
    console.log('\n' + '='.repeat(70));
    console.log('📊 BÁO CÁO IMPORT USER TỪ EXCEL');
    console.log('='.repeat(70) + '\n');

    console.log('📈 Thống kê:');
    console.log(`   ✓ Tổng cộng: ${results.total} user`);
    console.log(`   ✓ Thành công: ${results.successCount} user`);
    console.log(`   ✗ Thất bại: ${results.failedCount} user`);
    console.log(`   ✓ Tỉ lệ: ${((results.successCount / results.total) * 100).toFixed(2)}%\n`);

    if (results.successCount > 0) {
        console.log('✅ USER ĐƯỢC TẠO THÀNH CÔNG:');
        console.log('-'.repeat(70));
        results.success.forEach((item, index) => {
            console.log(
                `${index + 1}. ${item.username} (${item.email}) - Row ${item.rowNumber}`
            );
        });
        console.log('');
    }

    if (results.failedCount > 0) {
        console.log('❌ USER THẤT BẠI:');
        console.log('-'.repeat(70));
        results.failed.forEach((item, index) => {
            console.log(
                `${index + 1}. ${item.username} (${item.email}) - Row ${item.rowNumber}`
            );
            console.log(`   Error: ${item.error}`);
        });
        console.log('');
    }

    console.log('='.repeat(70) + '\n');
}

/**
 * Tạo file Excel mẫu
 * @param {string} filePath - Đường dẫn tới file Excel sẽ tạo
 */
async function createSampleExcelFile(filePath) {
    try {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Users');

        // Tạo header
        worksheet.columns = [
            { header: 'username', key: 'username', width: 20 },
            { header: 'email', key: 'email', width: 30 },
            { header: 'fullName', key: 'fullName', width: 25 },
            { header: 'roleId', key: 'roleId', width: 30 }
        ];

        // Thêm dữ liệu mẫu
        worksheet.addRow({
            username: 'john_doe',
            email: 'john@example.com',
            fullName: 'John Doe',
            roleId: '663a8c5b7f8c1d2e3f4g5h6i'
        });

        worksheet.addRow({
            username: 'jane_smith',
            email: 'jane@example.com',
            fullName: 'Jane Smith',
            roleId: '663a8c5b7f8c1d2e3f4g5h6i'
        });

        worksheet.addRow({
            username: 'bob_johnson',
            email: 'bob@example.com',
            fullName: 'Bob Johnson',
            roleId: '663a8c5b7f8c1d2e3f4g5h6i'
        });

        // Format header
        worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF4472C4' }
        };

        // Lưu file
        await workbook.xlsx.writeFile(filePath);
        console.log(`✅ Tạo file mẫu thành công: ${filePath}`);

    } catch (error) {
        console.error(`❌ Lỗi tạo file mẫu: ${error.message}`);
        throw error;
    }
}

module.exports = {
    readExcelFile,
    importUsersFromExcel,
    printImportReport,
    createSampleExcelFile
};
