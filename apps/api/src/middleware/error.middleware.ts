import { Request, Response, NextFunction } from 'express';

export function errorHandler(
  err: Error & { statusCode?: number; code?: string },
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error(err);

  if (err.code === 'P2002') {
    res.status(409).json({ success: false, error: 'A record with this data already exists.' });
    return;
  }
  if (err.code === 'P2025') {
    res.status(404).json({ success: false, error: 'Record not found.' });
    return;
  }

  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}
