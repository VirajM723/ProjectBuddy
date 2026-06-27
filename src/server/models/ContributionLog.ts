import mongoose from 'mongoose';

const contributionLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  date: { type: String, required: true }, // YYYY-MM-DD
  contributionType: { type: String, enum: ['Joined', 'Completed', 'Milestone', 'Task'], required: true },
  title: { type: String, default: '' },
  details: { type: String, default: '' },
  points: { type: Number, default: 0 },
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

export const ContributionLog = mongoose.model('ContributionLog', contributionLogSchema);
