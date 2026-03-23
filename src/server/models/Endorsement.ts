import mongoose from 'mongoose';

const endorsementSchema = new mongoose.Schema({
  skill: { type: String, required: true },
  endorsedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  endorsedUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
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

export const Endorsement = mongoose.model('Endorsement', endorsementSchema);
