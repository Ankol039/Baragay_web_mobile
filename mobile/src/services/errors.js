export class ApiError extends Error { constructor(message, status = 0) { super(message); this.status = status } }
