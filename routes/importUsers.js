/**
 * Routes: Import Users từ Excel
 * POST /import-users/upload - Upload file và import users
 * GET /import-users/sample - Tải file mẫu Excel
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const userController = require('../controllers/users');
const {
    importUsersFromExcel,
    printImportReport,
    createSampleExcelFile
} = require('../utils/excelImportHandler');

// Setup multer cho upload file
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../uploads/import-excel');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        // Chỉ cho phép file Excel
        const allowedMimes = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel'
        ];
        
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('❌ Chỉ cho phép file Excel (.xlsx, .xls)'));
        }
    },
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB
    }
});

/**
 * GET /import-users/sample
 * Tải file mẫu Excel
 */
router.get('/sample', async (req, res) => {
    try {
        const samplePath = path.join(__dirname, '../uploads/sample-users.xlsx');
        
        // Tạo file mẫu nếu chưa có
        if (!fs.existsSync(samplePath)) {
            await createSampleExcelFile(samplePath);
        }
        
        res.download(samplePath, 'sample-users.xlsx');
    } catch (error) {
        console.error('Error downloading sample file:', error);
        res.status(500).json({
            success: false,
            message: '❌ Lỗi: ' + error.message
        });
    }
});

/**
 * POST /import-users/upload
 * Upload file và import users
 */
router.post('/upload', upload.single('excelFile'), async (req, res) => {
    let session;
    
    try {
        // Kiểm tra file được upload
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: '❌ Vui lòng chọn file Excel'
            });
        }

        console.log('\n📂 Bắt đầu import User từ Excel...');
        console.log(`📋 File: ${req.file.filename}\n`);

        // Import users từ Excel
        const results = await importUsersFromExcel(
            req.file.path,
            userController
        );

        // Xóa file sau khi import
        setTimeout(() => {
            fs.unlink(req.file.path, (err) => {
                if (err) console.error('Error deleting file:', err);
            });
        }, 1000);

        // Trả về kết quả
        res.json({
            success: true,
            message: '✅ Import thành công',
            data: {
                total: results.total,
                successCount: results.successCount,
                failedCount: results.failedCount,
                successRate: ((results.successCount / results.total) * 100).toFixed(2) + '%',
                successList: results.success,
                failedList: results.failed
            }
        });

    } catch (error) {
        console.error('\n❌ LỖI IMPORT:', error.message);
        console.error(error);
        
        // Xóa file nếu có lỗi
        if (req.file) {
            fs.unlink(req.file.path, (err) => {});
        }

        res.status(500).json({
            success: false,
            message: '❌ Lỗi: ' + error.message
        });

    } finally {
        if (session) {
            session.endSession();
        }
    }
});

module.exports = router;
