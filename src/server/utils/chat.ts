import { ChatRoom } from '../models/ChatRoom.js';
import { idOf } from './membership.js';

// Gets the project's chat room, creating it or syncing its member list as needed
export async function getOrCreateChatRoom(project: any) {
  const members = [project.ownerId, ...project.acceptedUsers].map(idOf);
  let chatRoom = await ChatRoom.findOne({ projectId: project._id });

  if (!chatRoom) {
    try {
      chatRoom = await ChatRoom.create({ projectId: project._id, members });
    } catch (error: any) {
      // Another request created it concurrently (unique projectId index)
      if (error?.code !== 11000) throw error;
      chatRoom = await ChatRoom.findOne({ projectId: project._id });
      if (!chatRoom) throw error;
    }
    return chatRoom;
  }

  const dbMembers = chatRoom.members.map(idOf);
  const needsSync = dbMembers.length !== members.length || members.some(m => !dbMembers.includes(m));
  if (needsSync) {
    chatRoom.members = members as any;
    await chatRoom.save();
  }
  return chatRoom;
}
