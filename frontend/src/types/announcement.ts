export interface AnnouncementBatch {
  batch: {
    id: string;
    name: string;
    subject?: string;
  };
}

export interface Announcement {
  id: string;
  title: string;
  message: string;
  status: 'DRAFT' | 'SENT';
  created_at: string;
  sent_at?: string;
  created_by?: string;
  batches?: AnnouncementBatch[];
}
