/**
 * Controller: Messages
 * Xử lý logic cho tin nhắn
 */

const mongoose = require('mongoose');
const messageModel = require('../schemas/messages');
const userModel = require('../schemas/users');

module.exports = {
  /**
   * Lấy danh sách cuộc trò chuyện (tin nhắn mới nhất từ mỗi user)
   */
  getConversations: async function (currentUserId) {
    try {
      const conversations = await messageModel.aggregate([
        {
          $match: {
            $or: [
              { from: new mongoose.Types.ObjectId(currentUserId) },
              { to: new mongoose.Types.ObjectId(currentUserId) }
            ],
            isDeleted: false
          }
        },
        {
          $sort: { createdAt: -1 }
        },
        {
          $group: {
            _id: {
              $cond: [
                { $eq: ['$from', new mongoose.Types.ObjectId(currentUserId)] },
                '$to',
                '$from'
              ]
            },
            lastMessage: { $first: '$$ROOT' },
            messageCount: { $sum: 1 }
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'userInfo'
          }
        },
        {
          $unwind: '$userInfo'
        },
        {
          $project: {
            _id: '$userInfo._id',
            username: '$userInfo.username',
            fullName: '$userInfo.fullName',
            avatarUrl: '$userInfo.avatarUrl',
            email: '$userInfo.email',
            lastMessage: {
              messageId: '$lastMessage._id',
              from: '$lastMessage.from',
              to: '$lastMessage.to',
              contentType: '$lastMessage.contentMessage.type',
              content: '$lastMessage.contentMessage.content',
              createdAt: '$lastMessage.createdAt'
            },
            messageCount: 1
          }
        },
        {
          $sort: { 'lastMessage.createdAt': -1 }
        }
      ]);

      return conversations;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Lấy tất cả tin nhắn giữa 2 user
   */
  getMessagesByUser: async function (currentUserId, targetUserId) {
    try {
      // Kiểm tra user tồn tại
      const targetUser = await userModel.findOne({
        _id: targetUserId,
        isDeleted: false
      });

      if (!targetUser) {
        throw new Error('User không tồn tại');
      }

      // Lấy tất cả tin nhắn 2 chiều
      const messages = await messageModel.find({
        $or: [
          {
            from: new mongoose.Types.ObjectId(currentUserId),
            to: new mongoose.Types.ObjectId(targetUserId)
          },
          {
            from: new mongoose.Types.ObjectId(targetUserId),
            to: new mongoose.Types.ObjectId(currentUserId)
          }
        ],
        isDeleted: false
      })
        .populate('from', 'username fullName avatarUrl email')
        .populate('to', 'username fullName avatarUrl email')
        .sort({ createdAt: 1 });

      return messages;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Tạo tin nhắn mới
   */
  createMessage: async function (currentUserId, toUserId, messageType, messageContent) {
    try {
      // Kiểm tra user nhận tồn tại
      const recipientUser = await userModel.findOne({
        _id: toUserId,
        isDeleted: false
      });

      if (!recipientUser) {
        throw new Error('User nhận không tồn tại');
      }

      // Không cho gửi tin nhắn cho chính mình
      if (currentUserId.toString() === toUserId) {
        throw new Error('Không thể gửi tin nhắn cho chính mình');
      }

      // Tạo message mới
      const newMessage = new messageModel({
        from: new mongoose.Types.ObjectId(currentUserId),
        to: new mongoose.Types.ObjectId(toUserId),
        contentMessage: {
          type: messageType,
          content: messageContent
        }
      });

      await newMessage.save();

      // Populate user info
      await newMessage.populate('from', 'username fullName avatarUrl email');
      await newMessage.populate('to', 'username fullName avatarUrl email');

      return newMessage;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Xóa tin nhắn (soft delete)
   */
  deleteMessage: async function (messageId, currentUserId) {
    try {
      const message = await messageModel.findOne({
        _id: messageId,
        $or: [
          { from: new mongoose.Types.ObjectId(currentUserId) },
          { to: new mongoose.Types.ObjectId(currentUserId) }
        ]
      });

      if (!message) {
        throw new Error('Tin nhắn không tồn tại hoặc bạn không có quyền xóa');
      }

      message.isDeleted = true;
      await message.save();

      return message;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Lấy thống kê tin nhắn
   */
  getMessageStats: async function (currentUserId) {
    try {
      const stats = await messageModel.aggregate([
        {
          $match: {
            $or: [
              { from: new mongoose.Types.ObjectId(currentUserId) },
              { to: new mongoose.Types.ObjectId(currentUserId) }
            ],
            isDeleted: false
          }
        },
        {
          $facet: {
            totalMessages: [
              {
                $count: "count"
              }
            ],
            sentMessages: [
              {
                $match: { from: new mongoose.Types.ObjectId(currentUserId) }
              },
              {
                $count: "count"
              }
            ],
            receivedMessages: [
              {
                $match: { to: new mongoose.Types.ObjectId(currentUserId) }
              },
              {
                $count: "count"
              }
            ],
            fileMessages: [
              {
                $match: { "contentMessage.type": "file" }
              },
              {
                $count: "count"
              }
            ]
          }
        }
      ]);

      return {
        totalMessages: stats[0].totalMessages[0]?.count || 0,
        sentMessages: stats[0].sentMessages[0]?.count || 0,
        receivedMessages: stats[0].receivedMessages[0]?.count || 0,
        fileMessages: stats[0].fileMessages[0]?.count || 0
      };
    } catch (error) {
      throw error;
    }
  }
};
