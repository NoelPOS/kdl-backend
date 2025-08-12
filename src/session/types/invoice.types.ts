export interface SessionGroup {
  sessionId: string;
  transactionType: 'course' | 'courseplus' | 'package';
  actualId: string; // The actual ID to send to backend (could be session_id, courseplus_id, package_id)
}

export interface InvoiceItem {
  description: string;
  amount: number;
}

export interface InvoiceSubmission {
  studentId: number;
  documentId: string;
  date: string;
  paymentMethod: string;
  totalAmount: number;
  studentName: string;
  courseName: string;
  sessionGroups: SessionGroup[]; // Array of sessions with their types and IDs
  items: InvoiceItem[];
}
