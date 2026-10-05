export interface DeleteAccountBody {
  confirm_email: string;
  current_password?: string;
}

export interface DeleteAccountResponse {
  deletion_due_at: string;
}
