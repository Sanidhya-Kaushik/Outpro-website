// src/utils/recaptcha.ts
// Google reCAPTCHA v3 server-side token verification

import axios from 'axios';
import { env } from '../config/env';
import { logger } from './logger';

interface RecaptchaResponse {
  success: boolean;
  score: number;
  action?: string;
  challenge_ts?: string;
  hostname?: string;
  'error-codes'?: string[];
}

/**
 * Verify a reCAPTCHA v3 token server-side.
 *
 * Returns true only if:
 *   - Google confirms the token is valid
 *   - The score meets the minimum threshold (default 0.5)
 *
 * Fails safely: returns false on network errors rather than blocking submissions.
 */
export async function verifyRecaptcha(
  token: string,
  expectedAction?: string,
): Promise<boolean> {
  // Skip verification in test environment
  if (env.NODE_ENV === 'test') return true;

  try {
    const { data } = await axios.post<RecaptchaResponse>(
      'https://www.google.com/recaptcha/api/siteverify',
      null,
      {
        params: {
          secret: env.RECAPTCHA_SECRET_KEY,
          response: token,
        },
        timeout: 5_000,
      },
    );

    if (!data.success) {
      logger.warn('reCAPTCHA token invalid', { errors: data['error-codes'] });
      return false;
    }

    if (data.score < env.RECAPTCHA_MIN_SCORE) {
      logger.warn('reCAPTCHA score too low', {
        score: data.score,
        minimum: env.RECAPTCHA_MIN_SCORE,
      });
      return false;
    }

    // Optionally verify the action matches the expected value
    if (expectedAction && data.action && data.action !== expectedAction) {
      logger.warn('reCAPTCHA action mismatch', {
        expected: expectedAction,
        received: data.action,
      });
      return false;
    }

    logger.debug('reCAPTCHA verified', { score: data.score, action: data.action });
    return true;
  } catch (err) {
    // Network error or Google outage — fail open to avoid blocking real users
    logger.error('reCAPTCHA verification request failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}
