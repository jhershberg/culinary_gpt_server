import { NextFunction, Request, Response } from 'express';
import { ZodError, ZodSchema } from 'zod';
import ErrorResponse from './interfaces/ErrorResponse';
import clerkClient from './utils/clerkClient';
import CustomRequest from './interfaces/CustomRequest';

export async function authMiddleware(req: CustomRequest, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    res.status(401);
    next(new Error('Unauthorized. No token provided'));
  }

  let client;
  try {
    client = await clerkClient.verifyToken(token as string);

    if (!req.userId) req.userId = client.sub;
    next()
  } catch (error) {
    console.log(error);
    res.status(401);
    next(new Error('Unauthorized. Invalid token'));
  }
}

export function notFound(req: Request, res: Response, next: NextFunction) {
  res.status(404);
  const error = new Error(`🔍 - Not Found - ${req.originalUrl}`);
  next(error);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: Error, req: Request, res: Response<ErrorResponse>, next: NextFunction) {
  const statusCode = res.statusCode !== 200 ? res.statusCode : 500;
  res.status(statusCode);
  res.json({
    message: err.message,
    stack: process.env.NODE_ENV === 'production' ? '🥞' : err.stack,
  });
}

// This function will return a middleware fucntion
export const validate = (schema: ZodSchema<any>) => (req: Request, res: Response, next: NextFunction) => {
  console.log('BODY: ', req.body.recipe?.ingredients)

  try {
    schema.parse({
      body: req.body,
      query: req.query,
      params: req.params,
    });
    next();
  } catch (error: any) {
    console.log(error.errors)
    if (error instanceof ZodError) {
      const errorMessages = error.errors.map((issue: any) => ({
        message: `${issue.path.join('.')} is ${issue.message}`,
      }))
      res.status(400).json({ error: 'Invalid data', details: errorMessages });
    } else {
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}