const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: 6
  },
  role: {
    type: String,
    enum: ['Student', 'Club Admin', 'Administrator'],
    default: 'Student',
    required: [true, 'User role is required']
  },
  university: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'University',
    required: [true, 'University is required']
  },
  major: {
    type: String,
    trim: true
  },
  year: {
    type: String,
    enum: ['Freshman', 'Sophomore', 'Junior', 'Senior']
  },
  studentId: {
    type: String,
    trim: true,
    unique: true,
    sparse: true
  },
  bio: {
    type: String,
    maxlength: 500
  },
  interests: [{
    type: String,
    trim: true
  }],
  profilePicture: {
    type: String,
    default: ''
  },
  clubMemberships: [{
    club: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Club'
    },
    role: {
      type: String,
      enum: ['Member', 'Officer', 'President', 'Vice President', 'Secretary'],
      default: 'Member'
    },
    joinedDate: {
      type: Date,
      default: Date.now
    }
  }],
  eventsAttended: [{
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event'
    },
    attendedDate: {
      type: Date,
      default: Date.now
    }
  }],
  registeredEvents: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event'
  }],
  phone: {
    type: String,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
