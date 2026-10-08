export interface MyBookingSession {
  starts_at: string;
  status: string;
}

export interface MyBooking {
  group_key: string;
  form_title: string;
  service: string;
  status: string;
  cancellable: boolean;
  series: boolean;
  time_zone: string;
  sessions: MyBookingSession[];
}

export interface GetMyBookingsResponse {
  bookings: MyBooking[];
}
