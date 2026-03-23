import mongoose from 'mongoose';

const projectSchema = new mongoose.Schema({
  title: { type: String, required: true },
  summary: { type: String, required: true },
  description: { type: String, required: true },
  techStack: { type: [String], default: [] },
  requiredRoles: { type: [String], default: [] },
  commitmentLevel: { type: String, required: true },
  projectType: { type: String, required: true },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['Open', 'Closed', 'Ongoing', 'Completed', 'Reopened'], default: 'Open' },
  userRoles: { type: Map, of: String, default: {} },
  applicants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  acceptedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  createdAt: { type: Date, default: Date.now },
}, { 
  toJSON: {
    transform: (doc, ret: any) => {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  }
});

export const Project = mongoose.model('Project', projectSchema);
