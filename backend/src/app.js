import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import routes from './routes/index.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';
import { apiLimiter } from './middlewares/rateLimit.js';
import { env, isProduction } from './config/env.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const frontendDist = path.resolve(here, '../../frontend/dist');

export function createApp() {
  const app = express();

  // So confia no cabecalho de IP encaminhado quando existe mesmo um proxy na
  // frente (hospedagem). Rodando local nao ha proxy, e confiar no cabecalho
  // deixaria qualquer cliente forjar o proprio IP para escapar dos limites.
  app.set('trust proxy', isProduction ? 1 : false);
  app.disable('x-powered-by');

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc: ["'self'"],
          // O frontend compilado carrega apenas arquivos proprios: nenhum
          // script inline, nenhuma CDN, nenhuma fonte externa.
          scriptSrc: ["'self'"],
          styleSrc: ["'self'"],
          // Estilos calculados em atributo style= (posicao dos blocos da
          // agenda). Nao executam codigo; blocos <style> seguem bloqueados.
          styleSrcAttr: ["'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
          fontSrc: ["'self'"],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"], // nao pode ser embutido em outro site
          baseUri: ["'self'"],
          formAction: ["'self'"],
          ...(isProduction ? { upgradeInsecureRequests: [] } : {}),
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );

  // helmet nao define esta; desliga APIs do navegador que o sistema nao usa.
  app.use((req, res, next) => {
    res.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
    );
    // Agenda de uma psicologa: nada aqui deve aparecer em buscador.
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
    next();
  });

  app.use(cors({ origin: env.corsOrigin, credentials: true }));
  app.use(express.json({ limit: '256kb' }));
  app.use(cookieParser());

  app.get('/robots.txt', (req, res) => {
    res.type('text/plain').send('User-agent: *\nDisallow: /\n');
  });

  app.use('/api', apiLimiter, routes);

  // Em producao o mesmo servidor entrega o frontend ja compilado.
  if (fs.existsSync(frontendDist)) {
    app.use(express.static(frontendDist));
    app.get(/^(?!\/api).*/, (req, res) => {
      res.sendFile(path.join(frontendDist, 'index.html'));
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
