/**
 * Middleware: Authentication
 * Xác thực user dựa trên JWT Token
 */

const jwt = require('jsonwebtoken');
const userModel = require('../schemas/users');

const authenticate = async (req, res, next) => {
  try {
    // Lấy token từ header
    const token = req.headers.authorization?.split(' ')[1] || req.cookies?.token;

    if (!token) {
      return res.status(401).json({
        status: 401,
        message: "❌ Vui lòng cung cấp token xác thực"
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    // Lấy user từ database
    const user = await userModel.findOne({
      _id: decoded.userId,
      isDeleted: false
    });

    if (!user) {
      return res.status(401).json({
        status: 401,
        message: "❌ User không tồn tại"
      });
    }

    // Lưu user vào request
    req.user = user;
    next();
  } catch (error) {
    // Nếu token hết hạn
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        status: 401,
        message: "❌ Token đã hết hạn"
      });
    }

    // Token không hợp lệ
    return res.status(401).json({
      status: 401,
      message: "❌ Token không hợp lệ",
      error: error.message
    });
  }
};

module.exports = authenticate;
