import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import healthRouter from './routes/health.js';
import authRouter from './routes/auth.js';
import usersRouter from './routes/users.js';
import rolesRouter from './routes/roles.js';
import appealsRouter from './routes/appeals.js';
import categoriesRouter from './routes/categories.js';
import materialsRouter from './routes/materials.js';
import dashboardRouter from './routes/dashboard.js';
import mailRouter from './routes/mail.js';
import { errorHandler } from './middleware/errorHandler.js';

export function createApp() {
  const app = express();

  // Vercel иногда отдаёт функции укороченный путь. Полный путь лежит в x-invoke-path.
  app.use((req, _res, next) => {
    const header = req.headers['x-invoke-path'];
    const original = Array.isArray(header) ? header[0] : header;
    if (
      typeof original === 'string' &&
      original.startsWith('/api') &&
      !req.url.startsWith('/api/')
    ) {
      req.url = original;
    }
    next();
  });

  app.use(cors({ origin: env.corsOrigins }));
  app.use(express.json({ limit: '2mb' }));

  app.use('/api', healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/roles', rolesRouter);
  app.use('/api/appeals', appealsRouter);
  app.use('/api/categories', categoriesRouter);
  app.use('/api/materials', materialsRouter);
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/mail', mailRouter);

  app.use(errorHandler);

  return app;
}
