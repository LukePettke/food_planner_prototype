import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const COOKIE_NAME = 'meal_planner_session';

export function getTokenFromRequest(req) {
  const cookie = req.headers.cookie;
  if (!cookie) return null;
  const match = cookie.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  return match ? match[1].trim() : null;
}

export function signToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token) {
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    return payload?.userId ?? null;
  } catch {
    return null;
  }
}

export function getSessionCookieOptions() {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
    maxAge: 7 * 24 * 60 * 60, // 7 days
    path: '/',
  };
}

/** Attach req.user = { id } if a valid session cookie is present. Does not reject. */
export function optionalAuth(req, res, next) {
  const token = getTokenFromRequest(req);
  const userId = token ? verifyToken(token) : null;
  req.user = userId ? { id: userId } : null;
  next();
}

/** Require authentication; send 401 if not logged in. */
export function requireAuth(req, res, next) {
  const token = getTokenFromRequest(req);
  const userId = token ? verifyToken(token) : null;
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  req.user = { id: userId };
  next();
}

export { COOKIE_NAME, JWT_SECRET };
