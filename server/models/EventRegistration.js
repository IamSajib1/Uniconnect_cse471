const mongoose = require('mongoose');

const eventRegistrationSchema = new mongoose.Schema({
  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true
  },
  eventTitle: {
    type: String,
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  studentName: {
    type: String,
    required: true
  },
  university: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'University',
    required: true
  },
  universityName: {
    type: String,
    required: true
  },
  registeredAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('EventRegistration', eventRegistrationSchema, 'eventregistrations');
