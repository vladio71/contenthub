import express, { Express, Request, Response } from 'express';
import { randomBytes } from 'node:crypto';

/**
 * A tiny stand-in for GitHub's OAuth endpoints, so the project runs without secrets.
 * Not secure on purpose: it approves every authorize request and accepts any client secret.
 */
export interface MockUser {
  id: number;
  login: string;
  name: string;
  email: string;
}

export const MOCK_USERS: MockUser[] = [
  { id: 1001, login: 'alice', name: 'Alice Moroz', email: 'alice@example.com' },
  { id: 1002, login: 'bob', name: 'Bob Kovalenko', email: 'bob@example.com' },
  { id: 1003, login: 'carol', name: 'Carol Shevchenko', email: 'carol@example.com' },
];

export function createMockOAuthApp(users: MockUser[] = MOCK_USERS): Express {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  const codes = new Map<string, MockUser>();
  const tokens = new Map<string, MockUser>();

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'mock-oauth' });
  });

  // Step 1: the browser is sent here. We approve at once and send it back with a code.
  app.get('/authorize', (req: Request, res: Response) => {
    const redirectUri = singleParam(req.query.redirect_uri);
    const state = singleParam(req.query.state);
    const login = singleParam(req.query.login) ?? users[0].login;
    const user = users.find((candidate) => candidate.login === login);

    if (!redirectUri) {
      res.status(400).json({ error: 'redirect_uri is required' });
      return;
    }
    if (!user) {
      res.status(400).json({ error: `unknown mock user, use one of: ${users.map((u) => u.login).join(', ')}` });
      return;
    }

    let target: URL;
    try {
      target = new URL(redirectUri);
    } catch {
      res.status(400).json({ error: 'redirect_uri is not a valid URL' });
      return;
    }
    const code = randomBytes(12).toString('hex');
    codes.set(code, user);
    target.searchParams.set('code', code);
    if (state) {
      target.searchParams.set('state', state);
    }
    res.redirect(302, target.toString());
  });

  // Step 2: the server exchanges the code for an access token. A code works once.
  app.post('/access_token', (req: Request, res: Response) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const code = typeof body.code === 'string' ? body.code : '';
    const user = codes.get(code);
    if (!user) {
      // GitHub answers 200 with an error field, so the mock does the same.
      res.json({ error: 'bad_verification_code', error_description: 'The code passed is incorrect or expired.' });
      return;
    }
    codes.delete(code);
    const accessToken = `mock_${randomBytes(16).toString('hex')}`;
    tokens.set(accessToken, user);
    res.json({ access_token: accessToken, token_type: 'bearer', scope: 'read:user,user:email' });
  });

  // Step 3: the server reads the user with the access token.
  app.get('/user', (req: Request, res: Response) => {
    const user = userFromAuthorization(req, tokens);
    if (!user) {
      res.status(401).json({ message: 'Bad credentials' });
      return;
    }
    // Email is private on purpose, like on real GitHub, so clients must call /user/emails.
    res.json({ id: user.id, login: user.login, name: user.name, avatar_url: `https://example.com/avatars/${user.login}.png`, email: null });
  });

  app.get('/user/emails', (req: Request, res: Response) => {
    const user = userFromAuthorization(req, tokens);
    if (!user) {
      res.status(401).json({ message: 'Bad credentials' });
      return;
    }
    res.json([
      { email: `old-${user.email}`, primary: false, verified: true, visibility: null },
      { email: user.email, primary: true, verified: true, visibility: 'private' },
    ]);
  });

  return app;
}

function singleParam(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined;
}

function userFromAuthorization(req: Request, tokens: Map<string, MockUser>): MockUser | undefined {
  const header = req.header('authorization') ?? '';
  const token = header.replace(/^(Bearer|token)\s+/i, '');
  return tokens.get(token);
}
