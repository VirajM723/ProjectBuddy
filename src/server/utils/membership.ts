type ProjectLike = { ownerId: any; acceptedUsers: any[] };

export const idOf = (ref: any): string => (ref?._id ?? ref)?.toString();

export const isProjectOwner = (project: ProjectLike, userId?: string) =>
  !!userId && idOf(project.ownerId) === userId;

export const isProjectMember = (project: ProjectLike, userId?: string) =>
  isProjectOwner(project, userId) || (!!userId && project.acceptedUsers.some(u => idOf(u) === userId));
