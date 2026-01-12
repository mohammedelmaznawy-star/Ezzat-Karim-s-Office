
export type Role = 'CITIZEN' | 'ADMIN' | 'SUPER_ADMIN';

export interface LocationData {
  province: string;
  city: string;
  area: string; // القرية أو المنطقة
  district?: string; // الحي
  address: string;
}

export interface User {
  id: string;
  phoneNumber: string;
  fullName: string;
  password?: string;
  nationalId?: string;
  role: Role;
  isActive: boolean;
  permittedCategories: string[];
  location?: LocationData;
}

export enum ComplaintStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  RESOLVED = 'RESOLVED',
  REJECTED = 'REJECTED'
}

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: Date;
  isAiGenerated?: boolean;
}

export interface Attachment {
  type: 'IMAGE' | 'VIDEO' | 'FILE';
  url: string;
  name?: string;
}

export interface TeamMessage {
  id: string;
  senderId: string;
  senderName: string;
  channelId: string; // 'GLOBAL' or 'PRIVATE_{userId}'
  text?: string;
  attachment?: Attachment;
  timestamp: Date;
}

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  timestamp: Date;
  read: boolean;
  type: 'STATUS' | 'MESSAGE' | 'TEAM';
  targetId: string;
}

export interface Complaint {
  id: string;
  citizenId: string;
  citizenName: string;
  citizenPhone: string;
  title: string;
  category: string;
  description: string;
  status: ComplaintStatus;
  createdAt: Date;
  resolvedAt?: Date;
  messages: Message[];
  aiSummary?: string;
  location: LocationData;
}

export interface TranslationStrings {
  appName: string;
  login: string;
  signup: string;
  phone: string;
  password: string;
  newPassword: string;
  fullName: string;
  nationalId: string;
  scanId: string;
  scanning: string;
  scanSuccess: string;
  scanError: string;
  noAccount: string;
  hasAccount: string;
  logout: string;
  myComplaints: string;
  newComplaint: string;
  allComplaints: string;
  title: string;
  category: string;
  description: string;
  submit: string;
  status: string;
  date: string;
  reply: string;
  sendMessage: string;
  aiHelp: string;
  summarize: string;
  pending: string;
  inProgress: string;
  resolved: string;
  rejected: string;
  welcome: string;
  adminPortal: string;
  citizenPortal: string;
  notifications: string;
  noNotifications: string;
  newUpdate: string;
  changeCategory: string;
  cat_infrastructure: string;
  cat_healthcare: string;
  cat_education: string;
  cat_security: string;
  cat_utilities: string;
  cat_legal: string;
  reports: string;
  totalComplaints: string;
  resolutionRate: string;
  avgResolutionTime: string;
  complaintsByCategory: string;
  complaintsOverTime: string;
  days: string;
  periodWeek: string;
  periodMonth: string;
  periodYear: string;
  periodDay: string;
  periodAll: string;
  manageAdmins: string;
  addAdmin: string;
  editAdmin: string;
  adminRole: string;
  superAdmin: string;
  manager: string;
  supervisor: string;
  permissions: string;
  active: string;
  inactive: string;
  accountStatus: string;
  accessAll: string;
  restrictedAccess: string;
  saveChanges: string;
  errorDeactivated: string;
  confirmDeactivate: string;
  confirmActivate: string;
  teamChat: string;
  changePass: string;
  attachFile: string;
  recordVideo: string;
  stopRecord: string;
  sendImage: string;
  internalMsg: string;
  back: string;
  home: string;
  globalChat: string;
  privateChat: string;
  aiRefine: string;
  aiRefining: string;
  drafting: string;
  province: string;
  city: string;
  area: string;
  district: string;
  address: string;
  qanatar_center: string;
  village_shalaqan: string;
  village_monira: string;
  village_abughait: string;
  village_kharqania: string;
  village_bassous: string;
  village_barada: string;
  employeeCount: string;
}
