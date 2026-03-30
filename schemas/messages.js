const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    from: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: [true, "From user is required"]
    },

    to: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: [true, "To user is required"]
    },

    contentMessage: {
      type: {
        type: String,
        enum: ["file", "text"],
        required: [true, "Content type is required"]
      },
      content: {
        type: String,
        required: [true, "Content is required"]
      }
    },

    isDeleted: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("message", messageSchema);
