<?php

namespace App\Services;

use Illuminate\Support\Facades\Config;

/**
 * Everything the app is allowed to know about a licence number.
 *
 * The number is never stored in the clear. Two derived values exist:
 *  - a bcrypt hash, for verifying a number someone supplies;
 *  - a keyed HMAC "blind index", which is deterministic so a driver can be
 *    looked up at login, but not reversible into the original number.
 *
 * Neither is ever serialised to a client — see User::$hidden.
 */
class LicenceIdentity
{
    /**
     * PH driver's licence numbers follow a 3-2-6 pattern: one letter, two
     * digits, then two and six digits — e.g. N01-19-123456.
     *
     * There is no published checksum, so this validates SHAPE only. It catches
     * typos and obviously invented numbers; it cannot tell you the licence
     * exists, because LTO exposes no public verification API.
     */
    public const PATTERN = '/^[A-Z]\d{2}-\d{2}-\d{6}$/';

    /** Strip formatting and upper-case, so "n01 19 123456" indexes the same as "N01-19-123456". */
    public function normalise(string $licenceNumber): string
    {
        $bare = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', $licenceNumber) ?? '');

        // 3 + 2 + 6 = 11 characters once separators are stripped.
        if (strlen($bare) !== 11) {
            return strtoupper(trim($licenceNumber));
        }

        return sprintf('%s-%s-%s', substr($bare, 0, 3), substr($bare, 3, 2), substr($bare, 5, 6));
    }

    public function isWellFormed(string $licenceNumber): bool
    {
        return (bool) preg_match(self::PATTERN, $this->normalise($licenceNumber));
    }

    /**
     * Deterministic, keyed, one-way. Rotating APP_KEY invalidates every index,
     * which is the same blast radius as rotating it already has for sessions.
     */
    public function blindIndex(string $licenceNumber): string
    {
        return hash_hmac('sha256', $this->normalise($licenceNumber), (string) Config::get('app.key'));
    }
}
