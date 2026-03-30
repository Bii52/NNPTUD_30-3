/**
 * Routes: Messages
 * GET / - Lấy tin nhắn mới nhất từ mỗi cuộc trò chuyện
 * GET /:userID - Lấy toàn bộ tin nhắn giữa user hiện tại với userID
 * POST / - Gửi tin nhắn (text hoặc file)
 * DELETE /:messageID - Xóa tin nhắn (soft delete)
 * GET /stats/overview - Lấy thống kê tin nhắn
 */

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const messageModel = require('../schemas/messages');
const userModel = require('../schemas/users');
const messageController = require('../controllers/messages');
const authenticate = require('../middlewares/authenticate');

// Setup multer cho upload file
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/messages');
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
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB
  }
});

/**
 * GET /messages/
 * Lấy tin nhắn mới nhất từ mỗi user mà user hiện tại đã nhắn tin hoặc user khác nhắn cho user hiện tại
 * Response: Danh sách cuộc trò chuyện với tin nhắn mới nhất
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const conversations = await messageController.getConversations(req.user._id);

    return res.status(200).json({
      status: 200,
      message: "✅ Lấy danh sách cuộc trò chuyện thành công",
      data: conversations
    });
  } catch (error) {
    console.error("❌ Lỗi lấy danh sách cuộc trò chuyện:", error);
    return res.status(500).json({
      status: 500,
      message: "❌ Lỗi lấy danh sách cuộc trò chuyện",
      error: error.message
    });
  }
});

/**
 * GET /messages/:userID
 * Lấy toàn bộ tin nhắn giữa user hiện tại với userID
 * Cả 2 chiều: tin nhắn từ hiện tại tới userID và từ userID tới hiện tại
 */
router.get('/:userID', authenticate, async (req, res) => {
  try {
    const { userID: targetUserId } = req.params;

    // Kiểm tra userID có hợp lệ không
    if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
      return res.status(400).json({
        status: 400,
        message: "❌ User ID không hợp lệ"
      });
    }

    // Lấy tin nhắn từ controller
    const messages = await messageController.getMessagesByUser(req.user._id, targetUserId);

    return res.status(200).json({
      status: 200,
      message: "✅ Lấy tin nhắn thành công",
      totalMessages: messages.length,
      data: messages
    });
  } catch (error) {
    console.error("❌ Lỗi lấy tin nhắn:", error);
    
    if (error.message === 'User không tồn tại') {
      return res.status(404).json({
        status: 404,
        message: "❌ User không tồn tại"
      });
    }

    return res.status(500).json({
      status: 500,
      message: "❌ Lỗi lấy tin nhắn",
      error: error.message
    });
  }
});

/**
 * POST /messages
 * Gửi tin nhắn (text hoặc file)
 * Body (form-data): 
 *   - to: userID người nhận
 *   - content: nội dung tin nhắn (nếu text)
 *   - file: file upload (nếu type là "file")
 */
router.post('/', authenticate, upload.single('file'), async (req, res) => {
  try {
    const { to, content } = req.body;

    // Validation
    if (!to) {
      return res.status(400).json({
        status: 400,
        message: "❌ Vui lòng chỉ định người nhận (to)"
      });
    }

    if (!mongoose.Types.ObjectId.isValid(to)) {
      return res.status(400).json({
        status: 400,
        message: "❌ User ID người nhận không hợp lệ"
      });
    }

    let messageContent = '';
    let type = 'text';

    // Xử lý file hoặc text
    if (req.file) {
      // File được upload
      type = 'file';
      // URL dẫn đến file: /uploads/messages/filename
      messageContent = `/uploads/messages/${req.file.filename}`;
    } else if (content) {
      // Text message
      type = 'text';
      messageContent = content;

      if (messageContent.trim() === '') {
        return res.status(400).json({
          status: 400,
          message: "❌ Nội dung tin nhắn không được để trống"
        });
      }
    } else {
      return res.status(400).json({
        status: 400,
        message: "❌ Vui lòng cung cấp nội dung (text hoặc file)"
      });
    }

    // Tạo message từ controller
    const newMessage = await messageController.createMessage(
      req.user._id,
      to,
      type,
      messageContent
    );

    return res.status(201).json({
      status: 201,
      message: "✅ Gửi tin nhắn thành công",
      data: newMessage
    });
  } catch (error) {
    console.error("❌ Lỗi gửi tin nhắn:", error);
    
    // Xóa file nếu upload thất bại
    if (req.file) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error("Lỗi xóa file:", err);
      });
    }

    if (error.message.includes('User')) {
      return res.status(404).json({
        status: 404,
        message: "❌ " + error.message
      });
    }

    if (error.message.includes('chính mình')) {
      return res.status(400).json({
        status: 400,
        message: "❌ " + error.message
      });
    }

    return res.status(500).json({
      status: 500,
      message: "❌ Lỗi gửi tin nhắn",
      error: error.message
    });
  }
});

/**
 * DELETE /messages/:messageID
 * Xóa tin nhắn (soft delete)
 */
router.delete('/:messageID', authenticate, async (req, res) => {
  try {
    const { messageID } = req.params;

    if (!mongoose.Types.ObjectId.isValid(messageID)) {
      return res.status(400).json({
        status: 400,
        message: "❌ Message ID không hợp lệ"
      });
    }

    const deletedMessage = await messageController.deleteMessage(messageID, req.user._id);

    return res.status(200).json({
      status: 200,
      message: "✅ Xóa tin nhắn thành công",
      data: deletedMessage
    });
  } catch (error) {
    console.error("❌ Lỗi xóa tin nhắn:", error);
    
    if (error.message.includes('không tồn tại')) {
      return res.status(404).json({
        status: 404,
        message: "❌ " + error.message
      });
    }

    return res.status(500).json({
      status: 500,
      message: "❌ Lỗi xóa tin nhắn",
      error: error.message
    });
  }
});

/**
 * GET /messages/stats/overview
 * Lấy thống kê tin nhắn
 */
router.get('/stats/overview', authenticate, async (req, res) => {
  try {
    const stats = await messageController.getMessageStats(req.user._id);

    return res.status(200).json({
      status: 200,
      message: "✅ Lấy thống kê thành công",
      data: stats
    });
  } catch (error) {
    console.error("❌ Lỗi lấy thống kê:", error);
    return res.status(500).json({
      status: 500,
      message: "❌ Lỗi lấy thống kê",
      error: error.message
    });
  }
});

module.exports = router;
