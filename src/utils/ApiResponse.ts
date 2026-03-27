class ApiResponse<T = any> {
  public statusCode: number;
  public success: boolean;
  public message: string;
  public data: T;

  constructor(statusCode: number, data: T, message: string = "Success") {
    this.statusCode = statusCode;
    this.data = data;
    this.message = message;
    this.success = statusCode < 400;
  }

  
}

export { ApiResponse };