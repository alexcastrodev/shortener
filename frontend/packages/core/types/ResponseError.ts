export type ResponseError = {
  error: string;
  errors?: {
    [key: string]: string;
  };
};
