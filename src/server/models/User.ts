import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  bio: { type: String, default: '' },
  profileImage: { type: String, default: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="12" fill="%23DBDBDB"/><circle cx="12" cy="8.5" r="4" fill="%23FFFFFF"/><path d="M12 13.5c-4.4 0-8 2.2-8 5v.5h16v-.5c0-2.8-3.6-5-8-5z" fill="%23FFFFFF"/></svg>' },
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
