import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  bio: { type: String, default: '' },
  profileImage: { type: String, default: '' },
  resumeLink: { type: String, default: '' },
  githubLink: { type: String, default: '' },
  linkedinLink: { type: String, default: '' },
  phoneNumber: { type: String, default: '' },
  skills: { type: [String], default: [] },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  createdAt: { type: Date, default: Date.now },
}, { 
  toJSON: {
    transform: (doc, ret: any) => {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      delete ret.password;
      return ret;
    }
  }
});

export const User = mongoose.model('User', userSchema);
